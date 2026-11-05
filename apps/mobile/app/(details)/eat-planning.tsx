import {Pressable,StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {KeyboardSafeScrollView} from '@/components/caloriebank/KeyboardSafeScrollView';
import {EatingPlanPanel} from '@/components/caloriebank/EatingPlanPanel';
import {Text} from '@/components/caloriebank/ScaleAwareText';
import {useEatingBudgetReadModel} from '@/lib/today/use-eating-budget-read-model';
import {colors,spacing,typography} from '@/constants/caloriebank-theme';
export default function EatingPlanningScreen(){
 const model=useEatingBudgetReadModel();
 return <SafeAreaView edges={['bottom']} style={styles.safeArea}>
  <KeyboardSafeScrollView contentContainerStyle={styles.container}>
   <EatingPlanPanel today={model.today} budget={model.budget} pending={model.pending} allowed={model.allowed} projectionAllowed={model.projectionAllowed} enabled={model.enabled}/>
   {model.failed?<Text style={styles.detail}>Your estimates could not refresh.</Text>:null}
   {model.enabled?<Pressable accessibilityRole="button" disabled={model.pending} onPress={model.reload} style={styles.action}><Text style={styles.actionText}>Refresh estimate</Text></Pressable>:null}
  </KeyboardSafeScrollView>
 </SafeAreaView>;
}
const styles=StyleSheet.create({safeArea:{flex:1,backgroundColor:colors.background},container:{padding:spacing.lg,gap:spacing.lg},detail:{color:colors.textMuted,fontSize:typography.body},action:{minHeight:48,justifyContent:'center'},actionText:{color:colors.primaryDark,fontSize:typography.body,fontWeight:'700'}});
