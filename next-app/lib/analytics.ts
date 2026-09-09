export const RANGE_DAYS:Record<string,number>={"7d":7,"30d":30,"90d":90};

export function rangeSince(range:string){
  const days=RANGE_DAYS[range]||30;
  const since=new Date();
  since.setDate(since.getDate()-days);
  return {since,days};
}

export interface DayBucket{date:string;value:number}

/** Buckets timestamped rows into per-day counts/sums over the given window (fills gaps with 0). */
export function bucketByDay(rows:{created_at:string;value?:number}[],days:number):DayBucket[]{
  const buckets=new Map<string,number>();
  const today=new Date();
  for(let i=days-1;i>=0;i--){
    const d=new Date(today);
    d.setDate(d.getDate()-i);
    buckets.set(d.toISOString().slice(0,10),0);
  }
  for(const r of rows){
    const key=r.created_at.slice(0,10);
    if(buckets.has(key))buckets.set(key,(buckets.get(key)||0)+(r.value??1));
  }
  return [...buckets.entries()].map(([date,value])=>({date,value}));
}

export function groupCount<T extends Record<string,any>>(rows:T[],key:keyof T):Record<string,number>{
  const out:Record<string,number>=  {};
  for(const r of rows){
    const k=String(r[key]??"unknown");
    out[k]=(out[k]||0)+1;
  }
  return out;
}

export function avgBy<T extends Record<string,any>>(rows:T[],key:keyof T,filter?:(r:T)=>boolean):number{
  const filtered=filter?rows.filter(filter):rows;
  const vals=filtered.map(r=>Number(r[key])).filter(v=>Number.isFinite(v));
  if(!vals.length)return 0;
  return vals.reduce((a,b)=>a+b,0)/vals.length;
}

export function toCsv(headers:string[],rows:(string|number)[][]):string{
  const esc=(v:string|number)=>{
    const s=String(v);
    return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;
  };
  return [headers.map(esc).join(","),...rows.map(r=>r.map(esc).join(","))].join("\n");
}
