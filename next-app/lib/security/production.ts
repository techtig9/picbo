export function requireEnv(name:string){
  const value=process.env[name];
  if(!value) throw new Error(`MISSING_ENV:${name}`);
  return value;
}
export function safeLimit(value:number,min=1,max=100){
  return Math.max(min,Math.min(max,Number.isFinite(value)?value:min));
}
export function isAllowedOrigin(origin:string|undefined,allowed:string[]){
  if(!origin)return true;
  return allowed.includes(origin);
}
