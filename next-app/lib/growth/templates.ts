export interface CreativeTemplate {
 id:string; name:string; category:"product"|"sale"|"ugc"|"luxury"|"seasonal"|"launch";
 aspect:"9:16"|"4:5"|"1:1"|"16:9"; durationMs:number;
 tags:string[]; featured:boolean;
}
export const STARTER_TEMPLATES:CreativeTemplate[]=[
 {id:"product-launch-15",name:"Product Launch",category:"launch",aspect:"9:16",durationMs:15000,tags:["launch","product"],featured:true},
 {id:"sale-15",name:"Limited-Time Sale",category:"sale",aspect:"9:16",durationMs:15000,tags:["sale","offer"],featured:true},
 {id:"luxury-product",name:"Luxury Product",category:"luxury",aspect:"4:5",durationMs:15000,tags:["luxury","premium"],featured:true},
 {id:"ugc-product",name:"UGC Product",category:"ugc",aspect:"9:16",durationMs:15000,tags:["ugc","social"],featured:false},
 {id:"seasonal-product",name:"Seasonal Product",category:"seasonal",aspect:"9:16",durationMs:15000,tags:["seasonal"],featured:false}
];
