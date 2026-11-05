import {useEffect,useRef,useState} from 'react';
import {StyleSheet,TextInput,View} from 'react-native';
import type {EatingBudgetResponse,TodayResponse} from '@caloriebank/schemas';
import {Text} from './ScaleAwareText';
import {colors,radii,spacing,typography} from '../../constants/caloriebank-theme';
import {fetchEatingPlan,eatingBudgetEnabled} from '../../lib/api/eating-budget';
import {eatingBudgetReason,eatingComparison,selectEatingBudget,selectProjectedEatingBudget,selectStepsForIntake,type BoundIntakePlan} from '../../lib/today/eating-budget-guidance';
import {usePlanningClock} from '../../lib/today/use-planning-clock';
import {selectQuietWalkingForecast} from '../../lib/today/quiet-walking-forecast';
import {useEditorDraft} from '../../lib/drafts/use-editor-draft';

export function EatingPlanPanel({today,budget,pending,allowed,projectionAllowed=allowed,enabled=eatingBudgetEnabled}:{today:TodayResponse|null;budget:EatingBudgetResponse|null;pending:boolean;allowed:boolean;projectionAllowed?:boolean;enabled?:boolean}){
 const [bound,setBound]=useState<BoundIntakePlan|null>(null),generation=useRef(0);
 const expiry=[budget?.projectedEstimate&&budget.projectedEstimate.status!=='unavailable'?budget.projectedEstimate.expiresAt:null,budget?.budget.status!=='unavailable'?budget?.budget.expiresAt:null,budget?.budget.status!=='unavailable'?budget?.budget.comparisonExpiresAt:null,budget?.planningModel?.expiresAt,bound?.response?.plan.status==='ready'?bound.response.plan.expiresAt:null].filter((x):x is string=>Boolean(x));
 const {now}=usePlanningClock(today?.restOfDayProjection,expiry.length?new Date(Math.min(...expiry.map(Date.parse))).toISOString():undefined);
 const current=selectEatingBudget(today,budget,now,enabled&&allowed&&!pending),quiet=today?selectQuietWalkingForecast(today,now):null;
 const draft=useEditorDraft('eating-plan',{calories:''},JSON.stringify([today?.date,today?.timezone,today?.burned.source,today?.steps.source]));
 const desired=Number(draft.value.calories),valid=draft.value.calories!==''&&Number.isSafeInteger(desired)&&desired>=0;
 const canPlan=Boolean(current?.planningAvailable&&quiet&&enabled&&allowed&&!pending);
 useEffect(()=>{
  const request=++generation.current;setBound(null);
  if(!canPlan||!valid||!current)return;
  const timer=setTimeout(()=>{void fetchEatingPlan({direction:'intake_to_steps',totalIntakeCalories:desired},current.timezone).then(response=>{if(generation.current===request)setBound({requestedTotalIntakeCalories:desired,response});}).catch(()=>{if(generation.current===request)setBound(null);});},300);
  return()=>{clearTimeout(timer);if(generation.current===request)generation.current=request+1;};
 },[canPlan,valid,desired,current]);
 const plan=valid?selectStepsForIntake(today,current,bound,desired,now,enabled&&allowed&&!pending):null;
 const projected=selectProjectedEatingBudget(today,budget,now,enabled&&projectionAllowed&&!pending);
 const comparison=eatingComparison(current,now),total=projected?.status==='ready'?projected.totalCalories:budget?.projectedEstimate?null:current?.budget.status==='ready'?current.budget.totalCalories:null;
 const unavailable=eatingBudgetReason(budget?.projectedEstimate?.status==='unavailable'?budget.projectedEstimate.reason:projected?.status==='non_positive'?'non_positive_projected_budget':budget?.budget.status==='unavailable'?budget.budget.reason:budget?.planningUnavailableReason);
 return <View style={styles.container}>
  <View style={styles.card}>
   <Text accessibilityRole="header" style={styles.title}>Eating budget</Text>
   <Text style={styles.value}>{total===null?'Unavailable':`${total.toLocaleString()} kcal`}</Text>
   <Text style={styles.detail}>{total===null?(pending?'Updating your estimate…':unavailable):'Estimated total intake today'}</Text>
   {total!==null&&!projected?(comparison.kind==='remaining_today'?<View><Text style={styles.label}>Remaining Today</Text><Text style={styles.body}>{comparison.calories<0?`${Math.abs(comparison.calories).toLocaleString()} kcal over this budget`:`${comparison.calories.toLocaleString()} kcal`}</Text></View>:comparison.kind==='estimated_day_difference'?<View><Text style={styles.label}>Compared with your whole-day estimate</Text><Text style={styles.body}>{Math.abs(comparison.calories).toLocaleString()} kcal {comparison.calories<0?'above':'below'} this budget</Text></View>:<Text style={styles.detail}>{comparison.text}</Text>):null}
  </View>
  <View style={styles.card}>
   <Text accessibilityRole="header" style={styles.title}>If I eat…</Text>
   <Text style={styles.detail}>Total calories for the day</Text>
   <TextInput accessibilityLabel="Planned total calories today" keyboardType="number-pad" maxLength={6} selectTextOnFocus placeholder="Calories" editable={enabled&&!pending} value={draft.value.calories} {...draft.selection('calories')} onChangeText={calories=>draft.update({calories:calories.replace(/\D/g,'')})} style={styles.input}/>
   {plan?<View accessibilityLiveRegion="polite">
    <Text style={styles.label}>Estimated total steps today</Text>
    <Text style={styles.value}>{plan.totalSteps.toLocaleString()}</Text>
    <Text style={styles.body}>{plan.additionalSteps===0?'No extra walking in this estimate.':`About ${plan.additionalSteps.toLocaleString()} more walking steps`}</Text>
   </View>:<Text accessibilityLiveRegion="polite" style={styles.detail}>{!enabled?'Eating planning isn’t available yet.':pending?'Updating your estimate…':!canPlan?unavailable:!valid?'Enter a total to explore your walking estimate.':'Your walking plan is unavailable. Try refreshing your estimate.'}</Text>}
  </View>
  <Text style={styles.detail}>A hypothetical plan. This does not log food or change your bank.</Text>
 </View>;
}
export const eatingPlanStyles=StyleSheet.create({
 container:{gap:spacing.lg},card:{backgroundColor:colors.surface,borderColor:colors.border,borderWidth:1,borderRadius:radii.lg,padding:spacing.lg,gap:spacing.sm},
 title:{color:colors.text,fontSize:typography.body,fontWeight:'800'},label:{color:colors.text,fontSize:typography.body,fontWeight:'700'},value:{color:colors.primaryDark,fontSize:typography.heading,fontWeight:'800'},
 body:{color:colors.text,fontSize:typography.body},detail:{color:colors.textMuted,fontSize:typography.caption,lineHeight:20},input:{minHeight:48,padding:spacing.md,borderWidth:1,borderColor:colors.border,borderRadius:radii.sm,color:colors.text,fontSize:typography.heading,fontWeight:'700'},
});
const styles=eatingPlanStyles;
