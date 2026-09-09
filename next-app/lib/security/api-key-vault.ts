import crypto from "node:crypto";

export function encryptSecret(value:string,key:string){
  const secret=crypto.createHash("sha256").update(key).digest();
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv("aes-256-gcm",secret,iv);
  const ciphertext=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
  const tag=cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}
export function decryptSecret(payload:string,key:string){
  const [ivB,tagB,dataB]=payload.split(".");
  if(!ivB||!tagB||!dataB)throw new Error("INVALID_SECRET");
  const secret=crypto.createHash("sha256").update(key).digest();
  const decipher=crypto.createDecipheriv("aes-256-gcm",secret,Buffer.from(ivB,"base64url"));
  decipher.setAuthTag(Buffer.from(tagB,"base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataB,"base64url")),decipher.final()]).toString("utf8");
}
