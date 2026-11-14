import { render, screen } from '@testing-library/react-native';

import TodayScreen from '../app/(tabs)/today';

test('today screen shows the daily bank placeholders', () => {
  render(<TodayScreen />);

  expect(screen.getByText('Today')).toBeTruthy();
  expect(screen.getByText('Bank Balance')).toBeTruthy();
  expect(screen.getByText('Projected Today')).toBeTruthy();
  expect(screen.getByText('Consumed')).toBeTruthy();
  expect(screen.getByText('Daily Target')).toBeTruthy();
  expect(screen.getAllByText('0 cal')).toHaveLength(4);
});
