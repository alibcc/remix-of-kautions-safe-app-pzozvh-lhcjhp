import React from 'react';
import { Stack } from 'expo-router';

export default function TabLayout() {
  // Simple single-screen layout - no tabs needed for this app
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'none',
      }}
    >
      <Stack.Screen name="(home)" />
    </Stack>
  );
}
