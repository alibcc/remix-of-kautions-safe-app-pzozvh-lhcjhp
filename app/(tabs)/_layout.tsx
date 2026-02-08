
import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';

export default function TabLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Only run auth check after auth context has initialized
    if (loading) {
      console.log('Auth still loading, waiting...');
      return;
    }

    // Check if we're in the (tabs) group
    const inTabsGroup = segments[0] === '(tabs)';

    console.log('TabLayout auth check - User:', user?.email, 'In tabs:', inTabsGroup);

    // If user is not authenticated and we're in the tabs group, redirect to auth
    if (!user && inTabsGroup) {
      console.log('No user found in protected route, redirecting to /auth');
      router.replace('/auth');
    }
  }, [user, loading, segments]);

  // Show loading spinner while auth is initializing
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // If no user after loading, return null (redirect will happen in useEffect)
  if (!user) {
    return null;
  }

  // User is authenticated, render the protected content
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

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
