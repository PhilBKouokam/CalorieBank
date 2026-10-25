import { createRoot } from 'react-dom/client';
import { AndroidFoodChoices } from '../../apps/mobile/components/caloriebank/AndroidFoodChoices';
import { KeyboardSafeScrollView } from '../../apps/mobile/components/caloriebank/KeyboardSafeScrollView';
const params = new URLSearchParams(location.search);
const width = Number(params.get('width') || 320);
const allowed = params.get('private') === '1';
createRoot(document.getElementById('root')!).render(<>
  <h1>Food source contingency — synthetic preview</h1>
  <p>Actual production chooser. No credentials or health records. Web has no native Health Connect.</p>
  <section aria-label="Food choices" style={{ width, maxWidth: '100%', height: 680, display: 'flex', background: '#F7F7F2' }}>
    <KeyboardSafeScrollView contentContainerStyle={{ padding: 16 }}><AndroidFoodChoices allowFatSecret={allowed} onSelected={async () => {}} onBusyChange={() => {}} /></KeyboardSafeScrollView>
  </section>
</>);
