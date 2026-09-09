export interface PlanDefinition{
  id:"free"|"starter"|"pro"|"agency";
  name:string;
  monthlyPriceCents:number;
  annualPriceCents:number; // billed yearly, shown as effective monthly rate in UI
  creditsPerMonth:number;
  features:string[];
}

export const PLANS:PlanDefinition[]=[
  {id:"free",name:"Free",monthlyPriceCents:0,annualPriceCents:0,creditsPerMonth:20,
   features:["20 credits / month","Image & photoshoot studio","Watermarked exports","Community support"]},
  {id:"starter",name:"Starter",monthlyPriceCents:2900,annualPriceCents:2400*12,creditsPerMonth:300,
   features:["300 credits / month","All studios incl. Video & Shorts","No watermark","Email support"]},
  {id:"pro",name:"Pro",monthlyPriceCents:9900,annualPriceCents:7900*12,creditsPerMonth:1200,
   features:["1,200 credits / month","Priority render queue","Brand kits & templates","Priority support"]},
  {id:"agency",name:"Agency",monthlyPriceCents:29900,annualPriceCents:24900*12,creditsPerMonth:5000,
   features:["5,000 credits / month","Team seats & roles","API access","Dedicated support"]}
];

export function planById(id:string){return PLANS.find(p=>p.id===id)||PLANS[0]}

export function priceFor(plan:PlanDefinition,period:"monthly"|"annual"){
  return period==="monthly"?plan.monthlyPriceCents:Math.round(plan.annualPriceCents/12);
}
