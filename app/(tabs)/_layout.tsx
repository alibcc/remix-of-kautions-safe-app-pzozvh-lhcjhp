
import { Tabs } from 'expo-router';
import React from 'react';
import FloatingTabBar from '@/components/FloatingTabBar';
import { colors } from '@/styles/commonStyles';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => (
        <FloatingTabBar
          {...props}
          tabs={[
            {
              name: 'index',
              title: 'List',
              icon: '📋',
              route: '/(home)',
              label: 'List',
            },
            {
              name: 'history',
              title: 'Done',
              icon: '✅',
              route: '/history',
              label: 'Done',
            },
            {
              name: 'profile',
              title: 'Me',
              icon: '👤',
              route: '/profile',
              label: 'Me',
            },
          ]}
        />
      )}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'List',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Done',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Me',
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
