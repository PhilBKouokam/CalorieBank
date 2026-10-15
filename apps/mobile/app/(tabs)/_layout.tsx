import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTextLayoutScale } from '@/components/caloriebank/ScaleAwareText';

import { colors } from '@/constants/caloriebank-theme';

type TabIconName = keyof typeof Ionicons.glyphMap;

function ScaleAwareTabBar(props: BottomTabBarProps) {
  const fontScale = useTextLayoutScale();
  // Refresh library-owned labels, not the navigator or its mounted screens.
  return <BottomTabBar key={fontScale} {...props} />;
}

function TabIcon({ name, color }: { name: TabIconName; color: string }) {
  return <Ionicons name={name} size={24} color={color} />;
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={ScaleAwareTabBar}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => <TabIcon name="wallet-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <TabIcon name="calendar-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <TabIcon name="settings-outline" color={color} />,
        }}
      />
    </Tabs>
  );
}
