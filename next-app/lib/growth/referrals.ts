export function normalizeReferralCode(code:string){
 return String(code||"").trim().toUpperCase().replace(/[^A-Z0-9_-]/g,"").slice(0,32);
}
export function referralRewardEligible(inviterHasAccount:boolean,newUserIsFirstSignup:boolean){
 return inviterHasAccount && newUserIsFirstSignup;
}
