import crypto from "crypto";

export interface GeneratedKey{plaintext:string;prefix:string;hash:string}

/** Generates a new API key. The plaintext is returned once and never stored — only its SHA-256 hash is persisted. */
export function generateApiKey():GeneratedKey{
  const random=crypto.randomBytes(24).toString("base64url");
  const plaintext=`pk_live_${random}`;
  const prefix=plaintext.slice(0,12); // shown in the UI so a user can tell keys apart without ever seeing the full secret again
  const hash=hashApiKey(plaintext);
  return {plaintext,prefix,hash};
}

export function hashApiKey(plaintext:string):string{
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

export function looksLikeApiKey(value:string):boolean{
  return /^pk_live_[A-Za-z0-9_-]{20,}$/.test(value);
}
