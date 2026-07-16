import { Text } from 'react-native';
import { PlaceholderScreen } from '../components/PlaceholderScreen';

export default function LogFoodScreen() {
  return (
    <PlaceholderScreen
      eyebrow="Manual Logging"
      title="Log food"
      description="Placeholder for creating and editing manual calorie entries."
      links={[{ href: '/home', label: 'Return to Today' }]}
    >
      <Text>Future fields: food name, calories, date, and optional notes.</Text>
    </PlaceholderScreen>
  );
}
