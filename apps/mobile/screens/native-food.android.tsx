import { Redirect } from 'expo-router';

/** Older links enter the same consumer chooser used by Health Connections. */
export default function NativeFood() {
  return <Redirect href={{ pathname: '/integrations', params: { foodChooser: '1' } }} />;
}
