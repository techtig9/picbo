/**
 * Content validation for anything we accept into storage — whether it came
 * back from an AI provider or was uploaded by a user.
 *
 * The declared Content-Type is not evidence. A provider can return an HTML
 * error page with `content-type: image/png`, and a user can rename
 * `payload.svg` to `photo.png`. We therefore sniff the actual leading bytes
 * and only accept formats we intend to serve back.
 *
 * SVG is deliberately NOT accepted: it is an active document format that can
 * carry <script> and external references, and these files are later handed
 * back to browsers from our own origin via signed URLs.
 */

export type MediaKind="image"|"video";

export interface MediaFormat{
  mime:string;
  extension:string;
  kind:MediaKind;
}

const FORMATS:Array<MediaFormat&{matches:(b:Uint8Array)=>boolean}>=[
  {
    mime:"image/png",extension:"png",kind:"image",
    matches:b=>b[0]===0x89&&b[1]===0x50&&b[2]===0x4e&&b[3]===0x47&&b[4]===0x0d&&b[5]===0x0a&&b[6]===0x1a&&b[7]===0x0a
  },
  {
    mime:"image/jpeg",extension:"jpg",kind:"image",
    matches:b=>b[0]===0xff&&b[1]===0xd8&&b[2]===0xff
  },
  {
    mime:"image/webp",extension:"webp",kind:"image",
    // "RIFF" .... "WEBP"
    matches:b=>b[0]===0x52&&b[1]===0x49&&b[2]===0x46&&b[3]===0x46&&b[8]===0x57&&b[9]===0x45&&b[10]===0x42&&b[11]===0x50
  },
  {
    mime:"image/gif",extension:"gif",kind:"image",
    matches:b=>b[0]===0x47&&b[1]===0x49&&b[2]===0x46&&b[3]===0x38
  },
  {
    mime:"video/mp4",extension:"mp4",kind:"video",
    // ISO-BMFF: bytes 4..7 are "ftyp"
    matches:b=>b[4]===0x66&&b[5]===0x74&&b[6]===0x79&&b[7]===0x70
  },
  {
    mime:"video/webm",extension:"webm",kind:"video",
    matches:b=>b[0]===0x1a&&b[1]===0x45&&b[2]===0xdf&&b[3]===0xa3
  }
];

/** Identifies a media format from its leading bytes, or null if unrecognised. */
export function sniffMediaFormat(bytes:Uint8Array):MediaFormat|null{
  if(bytes.length<12)return null;
  const hit=FORMATS.find(f=>f.matches(bytes));
  return hit?{mime:hit.mime,extension:hit.extension,kind:hit.kind}:null;
}

export const MAX_IMAGE_BYTES=25*1024*1024;   // 25MB
export const MAX_VIDEO_BYTES=200*1024*1024;  // 200MB

export class MediaValidationError extends Error{
  constructor(message:string,public code:string){
    super(message);
    this.name="MediaValidationError";
  }
}

export interface ValidatedMedia{
  bytes:Uint8Array;
  format:MediaFormat;
  sizeBytes:number;
  /** Present for PNG/JPEG/GIF/WebP where dimensions are cheap to read from the header. */
  width?:number;
  height?:number;
}

/**
 * Validates a downloaded/uploaded buffer. Throws MediaValidationError with a
 * message safe to show a user.
 */
export function validateMedia(bytes:Uint8Array,opts:{expectKind?:MediaKind}={}):ValidatedMedia{
  if(bytes.length===0){
    throw new MediaValidationError("The file is empty.","EMPTY_FILE");
  }

  const format=sniffMediaFormat(bytes);
  if(!format){
    // Most common real cause: the provider returned a JSON error or an HTML
    // page and we followed it as if it were the image.
    const head=new TextDecoder().decode(bytes.subarray(0,80)).trim();
    const looksTextual=/^[{<]/.test(head);
    throw new MediaValidationError(
      looksTextual
        ? "The provider returned a text response instead of an image or video."
        : "The file is not a supported image or video format (PNG, JPEG, WebP, GIF, MP4 or WebM).",
      "UNSUPPORTED_FORMAT"
    );
  }

  if(opts.expectKind&&format.kind!==opts.expectKind){
    throw new MediaValidationError(
      `Expected ${opts.expectKind==="image"?"an image":"a video"} but received ${format.mime}.`,
      "WRONG_MEDIA_KIND"
    );
  }

  const limit=format.kind==="video"?MAX_VIDEO_BYTES:MAX_IMAGE_BYTES;
  if(bytes.length>limit){
    throw new MediaValidationError(
      `File is ${(bytes.length/1024/1024).toFixed(1)}MB, over the ${(limit/1024/1024).toFixed(0)}MB limit.`,
      "FILE_TOO_LARGE"
    );
  }

  const dims=format.kind==="image"?readImageDimensions(bytes,format.mime):undefined;
  return {bytes,format,sizeBytes:bytes.length,width:dims?.width,height:dims?.height};
}

/**
 * Reads intrinsic dimensions straight from the file header. Returns undefined
 * rather than throwing for anything unparseable — dimensions are useful
 * metadata, never a reason to reject a file that is otherwise valid.
 */
export function readImageDimensions(bytes:Uint8Array,mime:string):{width:number;height:number}|undefined{
  try{
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);

    if(mime==="image/png"){
      // IHDR width/height are big-endian uint32 at offsets 16 and 20.
      return {width:view.getUint32(16,false),height:view.getUint32(20,false)};
    }

    if(mime==="image/gif"){
      // Logical screen descriptor: little-endian uint16 at 6 and 8.
      return {width:view.getUint16(6,true),height:view.getUint16(8,true)};
    }

    if(mime==="image/jpeg"){
      // Walk the marker segments to the first SOFn frame header.
      let offset=2;
      while(offset<bytes.length-9){
        if(bytes[offset]!==0xff){offset++;continue}
        const marker=bytes[offset+1];
        // SOFn markers carry the frame size; skip DHT/DAC/RST/SOS variants.
        const isSOF=marker>=0xc0&&marker<=0xcf&&marker!==0xc4&&marker!==0xc8&&marker!==0xcc;
        if(isSOF){
          return {height:view.getUint16(offset+5,false),width:view.getUint16(offset+7,false)};
        }
        offset+=2+view.getUint16(offset+2,false);
      }
      return undefined;
    }

    if(mime==="image/webp"){
      const chunk=new TextDecoder().decode(bytes.subarray(12,16));
      if(chunk==="VP8X"){
        // 24-bit little-endian, stored as (dimension - 1).
        const w=1+(bytes[24]|(bytes[25]<<8)|(bytes[26]<<16));
        const h=1+(bytes[27]|(bytes[28]<<8)|(bytes[29]<<16));
        return {width:w,height:h};
      }
      if(chunk==="VP8 "){
        return {width:view.getUint16(26,true)&0x3fff,height:view.getUint16(28,true)&0x3fff};
      }
      if(chunk==="VP8L"){
        const bits=view.getUint32(21,true);
        return {width:1+(bits&0x3fff),height:1+((bits>>14)&0x3fff)};
      }
      return undefined;
    }
  }catch{
    return undefined;
  }
  return undefined;
}
