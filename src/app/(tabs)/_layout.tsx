import { Tabs } from 'expo-router';
import { TabBarIcon } from '../../components/TabBarIcon';
import { cardShadow, colors, radius } from '../../constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 20,
          height: 64,
          borderRadius: radius.xl + 10,
          backgroundColor: colors.bgElevated,
          borderWidth: 1,
          borderColor: colors.border,
          ...cardShadow,
        },
        tabBarItemStyle: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          height: 64,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon focused={focused} icon="pulse-outline" iconFocused="pulse" label="Dashboard" />
          ),
        }}
      />
      <Tabs.Screen
        name="pinned"
        options={{
          title: 'Pinned',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon focused={focused} icon="pin-outline" iconFocused="pin" label="Pinned" />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon focused={focused} icon="book-outline" iconFocused="book" label="Journal" />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon focused={focused} icon="settings-outline" iconFocused="settings" label="Settings" />
          ),
        }}
      />
    </Tabs>
  );
}
