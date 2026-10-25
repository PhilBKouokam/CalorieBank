import { FitbitConnectionDisclosure } from '../../apps/mobile/components/caloriebank/FitbitConnectionDisclosure';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DailyBankTargetForm } from '../../apps/mobile/components/caloriebank/DailyBankTargetForm';
import { IntakeAdjustmentEditor } from '../../apps/mobile/components/caloriebank/IntakeAdjustmentEditor';
import { PrivacyPolicyRow } from '../../apps/mobile/components/caloriebank/PrivacyPolicyRow';
import { PlaceholderScreen } from '../../apps/mobile/components/caloriebank/PlaceholderScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StepPlanningCards } from '../../apps/mobile/components/caloriebank/StepPlanningCards';
import { KeyboardSafeScrollView } from '../../apps/mobile/components/caloriebank/KeyboardSafeScrollView';
import type { IntakeAdjustmentState, TodayResponse } from '@caloriebank/schemas';

const params = new URLSearchParams(location.search);
const scenario = params.get('state') ?? 'ready';
const width = params.get('width') === '390' ? 390 : 320;
const scale = params.get('scale') === '2' ? 2 : 1;
const today = {
  date: '2026-10-18', timezone: 'UTC',
  burned: { status: 'ready', source: 'Fitbit', adjustmentFactor: 0.8 },
  steps: { status: scenario === 'empty' ? 'unavailable' : 'ready', source: 'Fitbit', count: scenario === 'large' ? 100000 : 2000, caloriesPerStep: 0.05, walkingPace: { stepsPerMinute: 100, sampleCount: 3 } },
  restOfDayProjection: { status: scenario === 'empty' || scenario === 'error' || scenario === 'loading' ? 'insufficient_data' : 'ready', coverageStatus: scenario === 'error' ? 'uncertain' : 'known', projectedProviderBurnCalories: scenario === 'large' ? 100000 : 3540, unroundedProjectedProviderBurnCalories: scenario === 'large' ? 100000 : 3540 },
} as TodayResponse; // Deliberately partial synthetic response: only the component's consumed fields.
const correction: IntakeAdjustmentState = {
  localDate: '2026-10-18', revision: 0, selectionRevision: null, manualRevision: 0,
  source: scenario === 'long' ? 'Synthetic calorie tracker with a deliberately long source label' : 'Synthetic tracker',
  baseCalories: scenario === 'empty' ? null : scenario === 'large' ? 100000 : 1600,
  calories: scenario === 'empty' ? null : scenario === 'large' ? 100000 : 1800,
  adjustment: scenario === 'empty' ? null : { mode: 'add', calories: 200 },
};
function Playground() {
  const [component, setComponent] = useState(params.get('component') ?? 'target');
  const [result, setResult] = useState('');
  return <>
    <header><h1>CalorieBank component playground</h1><p>Synthetic data only · {width}px · {scale * 100}% simulated text · {scenario}</p>
      <label>Component <select value={component} onChange={event => { setComponent(event.target.value); params.set('component', event.target.value); setResult(''); }}>
        <option value="fitbit-disclosure">Fitbit disclosure</option><option value="brand">Brand header</option><option value="privacy">Privacy Policy</option><option value="target">Daily Bank Target</option><option value="correction">Calorie correction</option><option value="steps">Step Planning</option>
      </select></label>{' '}
      <label>State <select value={scenario} onChange={event => { params.set('state', event.target.value); location.search = params.toString(); }}>
        {['ready', 'empty', 'large', 'long', 'loading', 'error'].map(value => <option key={value}>{value}</option>)}
      </select></label>{' '}
      {[320, 390].map(value => <a key={value} href={`?${new URLSearchParams({ state: scenario, width: String(value), scale: String(scale), component })}`}>{value}px </a>)}
      <a href={`?${new URLSearchParams({ state: scenario, width: String(width), scale: scale === 1 ? '2' : '1', component })}`}>Toggle simulated text scale</a>
      <p>Web layout preview only. Native keyboard, TalkBack/VoiceOver, font scaling and Android underline require device qualification.</p>
    </header>
    <section aria-label="Component preview" style={{ width, height: 680, maxWidth: '100%', border: '1px solid #ccc', display: 'flex', flexDirection: 'column', background: '#F7F7F2' }}>
      {component === 'fitbit-disclosure' ? <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width, height: 680 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } }}><FitbitConnectionDisclosure onCancel={() => setResult('Cancelled; no authorization request was made.')} onContinue={async () => { setResult('Synthetic continuation only; no provider request was made.'); }} /></SafeAreaProvider>
        : component === 'brand' ? <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width, height: 680 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } }}><PlaceholderScreen eyebrow="Synthetic preview" title="Brand header" description="The monogram stays inside its fixed square; readable text follows your text size." /></SafeAreaProvider>
        : component === 'correction' ? <IntakeAdjustmentEditor state={correction} onSaved={() => setResult('Synthetic save completed; nothing was sent.')} onCancel={() => setResult('Cancelled.')} />
        : <KeyboardSafeScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          {component === 'privacy' ? <PrivacyPolicyRow /> : component === 'steps' ? <StepPlanningCards today={today} /> : <DailyBankTargetForm initialCalories={scenario === 'large' ? 2000 : 200} onSaved={() => setResult('Synthetic save completed; nothing was sent.')} />}
        </KeyboardSafeScrollView>}
    </section><p role="status">{result}</p>
  </>;
}
createRoot(document.getElementById('root')!).render(<Playground />);
