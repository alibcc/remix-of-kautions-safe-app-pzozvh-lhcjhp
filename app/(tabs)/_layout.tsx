
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
              title: 'Inspections',
              icon: 'home',
              route: '/(home)',
              label: 'Inspections',
            },
            {
              name: 'history',
              title: 'Archive',
              icon: 'archive',
              route: '/history',
              label: 'Archive',
            },
            {
              name: 'profile',
              title: 'Profile',
              icon: 'person',
              route: '/profile',
              label: 'Profile',
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
          title: 'Inspections',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Archive',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
