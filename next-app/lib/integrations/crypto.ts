import crypto from "crypto";

/**
 * AES-256-GCM encryption for OAuth tokens before they touch the database.
 * Requires INTEGRATIONS_ENCRYPTION_KEY (32 bytes, base64) — if it's not set,
 * connect flows fail closed with a clear error rather than ever storing a
 * credential in plaintext.
 */
function getKey():Buffer{
  const b64=process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if(!b64)throw new Error("INTEGRATIONS_ENCRYPTION_KEY is not configured — cannot safely store integration credentials");
  const key=Buffer.from(b64,"base64");
  if(key.length!==32)throw new Error("INTEGRATIONS_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return key;
}

export function encryptCredentials(plaintext:string):string{
  const key=getKey();
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv("aes-256-gcm",key,iv);
  const encrypted=Buffer.concat([cipher.update(plaintext,"utf8"),cipher.final()]);
  const tag=cipher.getAuthTag();
  return Buffer.concat([iv,tag,encrypted]).toString("base64");
}

export function decryptCredentials(payload:string):string{
  const key=getKey();
  const raw=Buffer.from(payload,"base64");
  const iv=raw.subarray(0,12),tag=raw.subarray(12,28),encrypted=raw.subarray(28);
  const decipher=crypto.createDecipheriv("aes-256-gcm",key,iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted),decipher.final()]).toString("utf8");
}
