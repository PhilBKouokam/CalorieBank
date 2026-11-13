import type { ConfigContext, ExpoConfig } from 'expo/config';

export default function configure(context: ConfigContext): ExpoConfig;
export const nutritionPermission: string;
export const qualificationPermissions: string[];
export function healthConnectReleasePolicy(profile: string | undefined, flag: string | undefined): {
  qualification: boolean;
  permissions: string[];
  blockedPermissions: string[];
};
