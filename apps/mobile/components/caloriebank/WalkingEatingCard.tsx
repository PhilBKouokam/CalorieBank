import { compactGlassCard } from '@/constants/card-surface';
import { FrostedView } from '@/components/caloriebank/FrostedSurface';
import { calculateStepToBurnPlan, suggestNextStepTarget } from '@caloriebank/domain';
import {useEffect,useRef,useState} from 'react';
import {fetchEatingPlan,eatingBudgetEnabled} from '../../lib/api/eating-budget';
import {selectEatingPlan,eatingBudgetReason} from '../../lib/today/eating-budget-guidance';
import type {EatingBudgetResponse,EatPlanningResponse,TodayResponse} from '@caloriebank/schemas';
import { Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { Text } from './ScaleAwareText';
import { colors, radii, spacing, typography } from '../../constants/caloriebank-theme';
import { useEditorDraft } from '../../lib/drafts/use-editor-draft';
import { usePlanningClock } from '../../lib/today/use-planning-clock';
import { selectQuietWalkingForecast } from '../../lib/today/quiet-walking-forecast';
import { currentDateSnapshot } from '../../lib/today/current-date';

/** Existing walking math only. No eating allowance without the qualified Budget path. */
export function WalkingEatingCard({today,budget=null,pending,guidanceAllowed=true,onOpenDetails}:{budget?:EatingBudgetResponse|null;today:TodayResponse|null;pending:boolean;guidanceAllowed?:boolean;onOpenDetails:()=>void}) {
  const {fontScale}=useWindowDimensions();
  const forecast=today?.steps.quietWalkingForecast;
  const deadlines=[forecast?.status==='ready'?forecast.expiresAt:null,budget?.budget.status!=='unavailable'?budget?.budget.expiresAt:null,budget?.planningModel?.expiresAt].filter((v):v is string=>Boolean(v));
  const additionalExpiry=deadlines.length?new Date(Math.min(...deadlines.map(Date.parse))).toISOString():undefined;
  const {now,expired}=usePlanningClock(today?.restOfDayProjection,additionalExpiry);
  const current=currentDateSnapshot(today,now),quiet=current?selectQuietWalkingForecast(current,now):null;
  const projection=current?.restOfDayProjection;
  const baseline=projection?.unroundedProjectedProviderBurnCalories??null;
  const needsQuiet=projection?.evidenceType==='historical_low_activity_hours';
  const q=needsQuiet?quiet?.rawIncrementalKcalPerStep??null:current?.steps.caloriesPerStep??null;
  const draft=useEditorDraft('walking-eat-planning',{steps:current?.steps.count==null?'':String(suggestNextStepTarget(current.steps.count))},JSON.stringify([current?.date,current?.timezone,current?.burned.source,current?.steps.source]));
  const supportedBaseline=needsQuiet||projection?.evidenceType==='provider_resting_energy'||projection?.evidenceType==='historical_daily_basal';
  const ordinaryMode=Boolean(current?.steps.ordinaryProjection);
  const ready=guidanceAllowed&&supportedBaseline&&!ordinaryMode&&!pending&&!expired&&current&&current.steps.status==='ready'&&current.burned.status==='ready'&&current.steps.planningSnapshotReady!==false&&projection?.status==='ready'&&baseline!==null&&current.steps.count!==null&&q!==null;
  const plan=ready?calculateStepToBurnPlan({currentSteps:current.steps.count!,targetSteps:Number(draft.value.steps)||0,providerCaloriesPerStep:q!,projectedProviderBurnAtRest:baseline!,adjustmentFactor:current.burned.adjustmentFactor}):null;
  const [eatingResponse,setEatingResponse]=useState<EatPlanningResponse|null>(null);
  const requestGeneration=useRef(0);
  const requestedSteps=Number(draft.value.steps);
  const context=budget?.guidanceContextVersion??null;
  useEffect(()=>{
    const generation=++requestGeneration.current;setEatingResponse(null);
    if(!eatingBudgetEnabled||!ready||!budget?.planningAvailable||!context||!quiet||!Number.isSafeInteger(requestedSteps)||requestedSteps<0)return;
    const timer=setTimeout(()=>{void fetchEatingPlan({direction:'steps_to_intake',totalSteps:requestedSteps},budget.timezone).then(result=>{if(generation===requestGeneration.current)setEatingResponse(result);}).catch(()=>{if(generation===requestGeneration.current)setEatingResponse(null);});},300);
    return()=>{clearTimeout(timer);if(requestGeneration.current===generation)requestGeneration.current=generation+1;};
  },[ready,context,budget,requestedSteps,quiet]);
  const eatingPlan=selectEatingPlan(current,budget,eatingResponse,requestedSteps,now,Boolean(ready)&&eatingBudgetEnabled);
  return <FrostedView style={styles.card}>
    <Text accessibilityRole="header" style={styles.heading}>If I walk…</Text>
    <View style={styles.inputRow}>
      <TextInput accessibilityLabel="Walking plan total steps today" keyboardType="number-pad" maxLength={6} selectTextOnFocus editable={Boolean(current)&&!pending&&guidanceAllowed} placeholder="Steps"
        {...draft.selection('steps')} value={draft.value.steps} onChangeText={steps=>draft.update({steps:steps.replace(/\D/g,'')})}
        style={[styles.input,{width:132*Math.max(1,fontScale)}]} />
      <Text style={styles.unit}>total steps today</Text>
    </View>
    <Text style={styles.detail}>Eating estimate</Text>
    <Text accessibilityLiveRegion="polite" style={eatingPlan?styles.value:styles.unavailable}>{eatingPlan?`${eatingPlan.totalIntakeCalories.toLocaleString()} kcal`:'Unavailable'}</Text>
    <Text style={styles.detail}>{eatingPlan?'Hypothetical total intake today, while staying on track.':eatingBudgetReason(budget?.budget.status==='unavailable'?budget.budget.reason:budget?.planningUnavailableReason)}</Text>
    {plan?<View accessibilityLiveRegion="polite" style={styles.estimate}>
      <Text style={styles.detail}>Estimated daily burn at this step total</Text>
      <Text style={styles.value}>{plan.projectedAdjustedBurnCalories.toLocaleString()} kcal</Text>
    </View>:<Text style={styles.detail}>{pending?'Updating your walking estimate…':'Your walking estimate needs recent activity data.'}</Text>}
    <Pressable accessibilityRole="button" accessibilityHint="Opens your current steps and walking estimates." onPress={onOpenDetails} style={styles.action}>
      <Text style={styles.actionText}>See walking details</Text>
    </Pressable>
  </FrostedView>;
}
const styles=StyleSheet.create({
card:{...compactGlassCard,padding:18,gap:16},
heading:{color:'#176E61',fontSize:typography.subheading,fontWeight:'700'},
inputRow:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:spacing.sm},
input:{maxWidth:'100%',minHeight:48,padding:spacing.sm,borderWidth:1,borderColor:colors.border,borderRadius:radii.sm,color:'#176E61',fontSize:typography.heading,fontWeight:'700'},
unit:{color:colors.text,fontSize:typography.body,flexShrink:1},
detail:{color:colors.textMuted,fontSize:typography.body,lineHeight:23},
unavailable:{color:colors.textMuted,fontSize:typography.body,fontWeight:'700'},
estimate:{gap:spacing.xs},
value:{color:'#176E61',fontSize:28,fontWeight:'800'},
action:{minHeight:48,justifyContent:'center'},
actionText:{color:colors.primaryDark,fontSize:typography.body,fontWeight:'700'},
scenario:{gap:spacing.sm},
calorieInput:{fontSize:typography.body,paddingHorizontal:spacing.sm},
targetLink:{minHeight:44,maxWidth:'100%',flexShrink:1,justifyContent:'center'},
targetLinkText:{color:colors.primaryDark,fontSize:typography.body,fontWeight:'600',textDecorationLine:'underline'},
answerLabel:{color:colors.text,fontSize:typography.body,fontWeight:'600'}
});
