import { forwardRef } from 'react';
import { Platform, ScrollView, type ScrollViewProps } from 'react-native';

type Props = Omit<ScrollViewProps,
  'automaticallyAdjustKeyboardInsets' | 'keyboardDismissMode' | 'keyboardShouldPersistTaps'>;

/** One keyboard owner: native iOS insets/focus scrolling, Android window resize.
 * Keep fields, explanations/results and completion actions inside this scroll view.
 * Do not wrap it in KeyboardAvoidingView or add timed/device-specific offsets.
 */
export const KeyboardSafeScrollView = forwardRef<ScrollView, Props>(function KeyboardSafeScrollView(props, ref) {
  return <ScrollView {...props} ref={ref}
    automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
    keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
    keyboardShouldPersistTaps="handled"
  />;
});
