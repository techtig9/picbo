export interface StorageAdapter {
  createSignedDownload(path:string, expiresInSeconds:number):Promise<string>;
  upload(localPath:string, destination:string, contentType:string):Promise<{path:string}>;
  createSignedDownloadFromPublicPath(path:string, expiresInSeconds:number):Promise<string>;
}

/**
 * Supabase Storage implementation belongs in the worker/service environment.
 * The web app should only persist storage paths and request short-lived URLs.
 */
export class SupabaseStorageAdapter implements StorageAdapter {
  async createSignedDownload(_path:string,_expiresInSeconds:number):Promise<string>{throw new Error("STORAGE_WORKER_NOT_CONFIGURED")}
  async upload(_localPath:string,_destination:string,_contentType:string):Promise<{path:string}>{throw new Error("STORAGE_WORKER_NOT_CONFIGURED")}
  async createSignedDownloadFromPublicPath(_path:string,_expiresInSeconds:number):Promise<string>{throw new Error("STORAGE_WORKER_NOT_CONFIGURED")}
}
