import type {DayBucket} from "@/lib/analytics";

export function BarChart({data,height=120,color="#8b7cff"}:{data:DayBucket[];height?:number;color?:string}){
  const max=Math.max(1,...data.map(d=>d.value));
  const barWidth=Math.max(4,Math.floor(600/data.length)-2);
  return <svg viewBox={`0 0 ${data.length*(barWidth+2)} ${height}`} width="100%" height={height} preserveAspectRatio="none">
    {data.map((d,i)=>{
      const h=Math.max(1,(d.value/max)*(height-16));
      return <g key={d.date}>
        <rect x={i*(barWidth+2)} y={height-h-14} width={barWidth} height={h} rx={2} fill={color} opacity={d.value?1:0.15}/>
        {i%Math.ceil(data.length/6||1)===0&&<text x={i*(barWidth+2)} y={height-2} fontSize={8} fill="#6b7280">{d.date.slice(5)}</text>}
      </g>;
    })}
  </svg>;
}
