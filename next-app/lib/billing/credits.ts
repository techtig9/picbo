export interface CreditCost{
  chat:number; copy:number; image:number; product_photo:number; storyboard:number; video:number;
}
export const DEFAULT_CREDIT_COSTS:CreditCost={
  chat:0,copy:0,image:2,product_photo:3,storyboard:1,video:10
};
export function creditCost(task:keyof CreditCost, custom?:Partial<CreditCost>){
  return Number(custom?.[task] ?? DEFAULT_CREDIT_COSTS[task]);
}
export function canSpend(balance:number,cost:number){return balance>=Math.max(0,cost)}
