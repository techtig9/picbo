export type PhotoStyle="studio"|"luxury"|"minimal"|"lifestyle"|"seasonal"|"ugc"|"editorial";
export interface PhotoGenerationRequest{
  productImageUrls:string[];
  style:PhotoStyle;
  scene:string;
  lighting:string;
  cameraAngle:string;
  aspect:"9:16"|"4:5"|"1:1"|"16:9";
  preserveProduct:true;
}
export function validatePhotoRequest(r:PhotoGenerationRequest){
  if(!r.productImageUrls?.length)throw new Error("PRODUCT_IMAGE_REQUIRED");
  if(r.preserveProduct!==true)throw new Error("PRODUCT_PRESERVATION_REQUIRED");
  return r;
}
