import {eatPlanningRequestSchema,eatPlanningResponseSchema,eatingBudgetResponseSchema,type EatPlanningRequest} from '@caloriebank/schemas';
import {apiRequest} from './client';
export const eatingBudgetEnabled=process.env.EXPO_PUBLIC_EATING_BUDGET_ENABLED==='1';
/** Flag checked before transport, including when called outside Today. */
export async function fetchEatingBudget(timezone:string,enabled=eatingBudgetEnabled,request?:typeof apiRequest){
 if(!enabled)return null;
 const response=await (request??apiRequest)(`/v1/me/eating-budget?timezone=${encodeURIComponent(timezone)}`);
 if(response.status===404)return null;
 if(!response.ok)throw new Error('Eating estimate unavailable');
 return eatingBudgetResponseSchema.parse(await response.json());
}
export async function fetchEatingPlan(input:EatPlanningRequest,timezone:string,enabled=eatingBudgetEnabled,request?:typeof apiRequest){
 if(!enabled)return null;
 const response=await (request??apiRequest)(`/v1/me/eating-budget/plan?timezone=${encodeURIComponent(timezone)}`,{method:'POST',body:JSON.stringify(eatPlanningRequestSchema.parse(input))});
 if(response.status===404)return null;
 if(!response.ok)throw new Error('Eating estimate unavailable');
 return eatPlanningResponseSchema.parse(await response.json());
}
