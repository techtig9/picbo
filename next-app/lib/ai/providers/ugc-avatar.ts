export interface UgcAvatar{id:string;label:string;previewUrl?:string}

export interface UgcRenderInput{
  avatarId:string;
  script:string;
  productAssetUrl?:string;
  aspectRatio:"9:16"|"1:1"|"16:9";
}

export interface UgcRenderResult{videoUrl:string}

export interface UgcAvatarProvider{
  readonly configured:boolean;
  listAvatars():Promise<UgcAvatar[]>;
  render(input:UgcRenderInput):Promise<UgcRenderResult>;
}

/**
 * No UGC avatar/lip-sync vendor is wired up yet (this needs a dedicated external
 * provider — e.g. HeyGen, Synthesia, D-ID — none of which are configured in this
 * project). Isolated behind this adapter per the "isolate external providers"
 * requirement so the rest of the app never has to know it's unimplemented, and
 * so the UI can show a clear, honest "not connected" state instead of a fake render.
 */
export class UnconfiguredUgcAvatarProvider implements UgcAvatarProvider{
  readonly configured=false;
  async listAvatars():Promise<UgcAvatar[]>{return []}
  async render(_input:UgcRenderInput):Promise<UgcRenderResult>{
    throw new Error("UGC_AVATAR_PROVIDER_NOT_CONFIGURED");
  }
}

export function getUgcAvatarProvider():UgcAvatarProvider{
  // Swap in a real adapter here once a UGC avatar vendor is selected and its
  // API key is available as an env var — nothing else in the app needs to change.
  return new UnconfiguredUgcAvatarProvider();
}
