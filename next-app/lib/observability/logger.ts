export type LogLevel="info"|"warn"|"error";
export function log(level:LogLevel,event:string,metadata:Record<string,unknown>={}){
  const entry={timestamp:new Date().toISOString(),level,event,...metadata};
  if(level==="error") console.error(JSON.stringify(entry));
  else if(level==="warn") console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}
