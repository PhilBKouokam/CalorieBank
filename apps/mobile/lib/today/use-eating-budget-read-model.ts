import {useCallback,useState,useSyncExternalStore} from 'react';
import {useFocusEffect} from 'expo-router';
import type {EatingBudgetResponse,TodayResponse} from '@caloriebank/schemas';
import {fetchToday,fetchProviderSelection} from '../api/client';
import {fetchEatingBudget,eatingBudgetEnabled} from '../api/eating-budget';
import {subscribeToAccountLifecycle,subscribeToAccountLifecycleActivity,isAccountLifecycleRunning} from '../lifecycle/account-lifecycle';
import {subscribeToLocalDateChange} from './local-date-change';
import {onDraftSessionReset,draftSessionGeneration} from '../drafts/session-drafts';
import {needsConnectionRecovery} from './presentation';

/** Reads existing owner-authenticated models only; never starts a health sync. */
export function useEatingBudgetReadModel(){
 const ownerEpoch=useSyncExternalStore(onDraftSessionReset,draftSessionGeneration,draftSessionGeneration);
 const [state,setState]=useState<{today:TodayResponse|null;budget:EatingBudgetResponse|null;pending:boolean;failed:boolean;allowed:boolean;projectionAllowed:boolean;ownerEpoch:number}>({ownerEpoch,today:null,budget:null,pending:eatingBudgetEnabled,failed:false,allowed:false,projectionAllowed:false});
 const [revision,setRevision]=useState(0);
 useFocusEffect(useCallback(()=>{
  if(!eatingBudgetEnabled)return;
  let active=true,generation=0;
  async function load(){
   const request=++generation;setState(old=>({...old,budget:null,pending:true,failed:false,allowed:false,projectionAllowed:false}));
   const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
   const [today,budget,provider]=await Promise.allSettled([fetchToday(timezone),fetchEatingBudget(timezone),fetchProviderSelection()]);
   if(!active||request!==generation||ownerEpoch!==draftSessionGeneration())return;
   const success=today.status==='fulfilled'&&budget.status==='fulfilled'&&provider.status==='fulfilled',running=isAccountLifecycleRunning();
   setState(old=>({ownerEpoch,today:today.status==='fulfilled'?today.value:old.ownerEpoch===ownerEpoch?old.today:null,budget:budget.status==='fulfilled'?budget.value:null,pending:running,failed:!success,projectionAllowed:success&&!running&&provider.status==='fulfilled'&&provider.value.expenditure.status==='ready'&&provider.value.expenditure.selected!==false,allowed:success&&!running&&provider.status==='fulfilled'&&provider.value.expenditure.status==='ready'&&provider.value.activityContext.status==='ready'&&!needsConnectionRecovery(provider.value)}));
  }
  void load();
  const stopActivity=subscribeToAccountLifecycleActivity(running=>{if(running){generation++;setState(old=>({...old,budget:null,pending:true,allowed:false,projectionAllowed:false}));}});
  const stopLifecycle=subscribeToAccountLifecycle(()=>{void load();});
  const stopDate=subscribeToLocalDateChange(()=>{setState(old=>({...old,budget:null,allowed:false,projectionAllowed:false}));void load();});
  return()=>{active=false;generation++;stopActivity();stopLifecycle();stopDate();};
 // Retry changes callback identity so the focus hook cancels the previous read generation.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[revision,ownerEpoch]));
 return {...state,projectionAllowed:state.ownerEpoch===ownerEpoch&&state.projectionAllowed,today:state.ownerEpoch===ownerEpoch?state.today:null,budget:state.ownerEpoch===ownerEpoch?state.budget:null,allowed:state.ownerEpoch===ownerEpoch&&state.allowed,pending:eatingBudgetEnabled&&(state.pending||state.ownerEpoch!==ownerEpoch),enabled:eatingBudgetEnabled,reload:()=>setRevision(value=>value+1)};
}
