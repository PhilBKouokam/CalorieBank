import { Text } from 'react-native';

import { PlaceholderScreen } from '@/components/caloriebank/PlaceholderScreen';

export default function AddFoodScreen() {
  return (
    <PlaceholderScreen
      eyebrow="Manual Logging"
      title="Add food"
      description="A placeholder for manual food-name and calorie entry. USDA lookup and barcode scanning are intentionally excluded."
      links={[{ href: '/today', label: 'Return to Today' }]}
    >
      <Text>Future fields: food name, calories, date, optional macros, and edit/delete states.</Text>
    </PlaceholderScreen>
  );
}
