import test from "node:test";
import assert from "node:assert/strict";
import {
  sniffMediaFormat,validateMedia,readImageDimensions,
  MediaValidationError,MAX_IMAGE_BYTES
} from "../lib/generation/media-validation";

/**
 * Output validation. A "completed" generation used to mean "the provider
 * returned 200" — the bytes were never checked, and nothing was ever
 * displayed, so a JSON error body would have been stored as an image and the
 * user charged for it.
 */

// Minimal but structurally real headers.
function pngBytes(width=1600,height=900){
  const b=new Uint8Array(64);
  b.set([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a],0);
  new DataView(b.buffer).setUint32(16,width,false);
  new DataView(b.buffer).setUint32(20,height,false);
  return b;
}
function jpegBytes(width=800,height=600){
  const b=new Uint8Array(32);
  b.set([0xff,0xd8,0xff,0xe0],0);
  b[4]=0x00;b[5]=0x10;            // APP0 segment length = 16
  b.set([0xff,0xc0],22);          // SOF0
  const v=new DataView(b.buffer);
  v.setUint16(24,11,false);       // segment length
  b[26]=8;                        // precision
  v.setUint16(27,height,false);
  v.setUint16(29,width,false);
  return b;
}
function gifBytes(width=320,height=240){
  const b=new Uint8Array(32);
  b.set([0x47,0x49,0x46,0x38,0x39,0x61],0);
  new DataView(b.buffer).setUint16(6,width,true);
  new DataView(b.buffer).setUint16(8,height,true);
  return b;
}
function mp4Bytes(){
  const b=new Uint8Array(32);
  b.set([0x00,0x00,0x00,0x20,0x66,0x74,0x79,0x70,0x69,0x73,0x6f,0x6d],0);
  return b;
}

test("recognises PNG, JPEG, GIF and MP4 from their leading bytes",()=>{
  assert.equal(sniffMediaFormat(pngBytes())?.mime,"image/png");
  assert.equal(sniffMediaFormat(jpegBytes())?.mime,"image/jpeg");
  assert.equal(sniffMediaFormat(gifBytes())?.mime,"image/gif");
  assert.equal(sniffMediaFormat(mp4Bytes())?.mime,"video/mp4");
});

test("classifies video separately from image",()=>{
  assert.equal(sniffMediaFormat(mp4Bytes())?.kind,"video");
  assert.equal(sniffMediaFormat(pngBytes())?.kind,"image");
});

test("a JSON error body is rejected, not stored as an image",()=>{
  // The exact failure this guards: provider returns 200 with an error object.
  const json=new TextEncoder().encode(JSON.stringify({error:"quota exceeded"}));
  assert.throws(
    ()=>validateMedia(json,{expectKind:"image"}),
    (e:any)=>e instanceof MediaValidationError
      &&e.code==="UNSUPPORTED_FORMAT"
      &&/text response/i.test(e.message)
  );
});

test("an HTML error page is rejected",()=>{
  const html=new TextEncoder().encode("<!doctype html><html><body>502 Bad Gateway</body></html>");
  assert.throws(()=>validateMedia(html,{expectKind:"image"}),/text response/i);
});

test("SVG is rejected — it is an active document format",()=>{
  // SVG can carry <script> and is served back from our own origin.
  const svg=new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  assert.throws(()=>validateMedia(svg,{expectKind:"image"}),MediaValidationError);
});

test("an empty response is rejected",()=>{
  assert.throws(
    ()=>validateMedia(new Uint8Array(0),{expectKind:"image"}),
    (e:any)=>e.code==="EMPTY_FILE"
  );
});

test("a video is rejected where an image was expected",()=>{
  assert.throws(
    ()=>validateMedia(mp4Bytes(),{expectKind:"image"}),
    (e:any)=>e.code==="WRONG_MEDIA_KIND"
  );
});

test("oversized files are rejected with a readable message",()=>{
  const big=new Uint8Array(MAX_IMAGE_BYTES+1);
  big.set([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a],0);
  assert.throws(
    ()=>validateMedia(big,{expectKind:"image"}),
    (e:any)=>e.code==="FILE_TOO_LARGE"&&/MB/.test(e.message)
  );
});

test("a renamed text file does not pass as PNG",()=>{
  // Content-Type and filename are both attacker-controlled; only bytes count.
  const fake=new TextEncoder().encode("this is definitely not a png, honest");
  assert.throws(()=>validateMedia(fake,{expectKind:"image"}),MediaValidationError);
});

test("reads PNG dimensions from the IHDR header",()=>{
  assert.deepEqual(readImageDimensions(pngBytes(1920,1080),"image/png"),{width:1920,height:1080});
});

test("reads JPEG dimensions by walking to the SOF0 marker",()=>{
  assert.deepEqual(readImageDimensions(jpegBytes(1024,768),"image/jpeg"),{width:1024,height:768});
});

test("reads GIF dimensions from the logical screen descriptor",()=>{
  assert.deepEqual(readImageDimensions(gifBytes(640,480),"image/gif"),{width:640,height:480});
});

test("valid media returns its size and dimensions",()=>{
  const result=validateMedia(pngBytes(512,512),{expectKind:"image"});
  assert.equal(result.format.mime,"image/png");
  assert.equal(result.width,512);
  assert.equal(result.height,512);
  assert.equal(result.sizeBytes,64);
});

test("unreadable dimensions do not reject an otherwise valid file",()=>{
  // Dimensions are metadata; a truncated header is not grounds for failure.
  const truncated=new Uint8Array(20);
  truncated.set([0xff,0xd8,0xff,0xe0],0);
  assert.equal(readImageDimensions(truncated,"image/jpeg"),undefined);
});
