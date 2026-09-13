import type {TaskKind} from "@/lib/ai/types";

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

/**
 * Server-side price list, keyed by the task the router will actually run.
 *
 * This is the authority on what a generation costs. /api/ai/generate used to
 * take the price from the request body (`Number(body.creditCost||1)`), so a
 * client could ask for a 10-credit video and pay 1 credit — an unbounded
 * revenue leak against real provider spend.
 *
 * reserve_credits() rejects amounts <= 0, so every billable task must be >= 1.
 * `chat` and `copy` are billed at 1 rather than 0 for the same reason: a task
 * that reserves nothing is a task with no abuse ceiling.
 */
export const TASK_CREDIT_COSTS:Record<TaskKind,number>={
  chat:1,
  copy:1,
  analysis:1,
  image:2,
  image_edit:2,
  background_remove:1,
  upscale:1,
  video:10,
  voice:2,
  render:5
};

/** Never returns less than 1: reserve_credits() raises on a non-positive amount. */
export function creditCostForTask(task:TaskKind):number{
  return Math.max(1,TASK_CREDIT_COSTS[task]??1);
}
