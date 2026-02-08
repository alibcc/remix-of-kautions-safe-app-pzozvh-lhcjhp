
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
      console.log('TabLayout: Auth still loading, waiting...');
      return;
    }

    // Check if we're in the (tabs) group
    const inTabsGroup = segments[0] === '(tabs)';

    console.log('TabLayout: Auth check - User:', user?.email || 'No user', 'In tabs:', inTabsGroup);

    // ✅ ONLY redirect to auth if user is NOT authenticated and trying to access protected routes
    // ❌ DO NOT create redirect loops - check if we're already navigating
    if (!user && inTabsGroup) {
      console.log('TabLayout: No user found in protected route, redirecting to /auth');
      // Use replace to avoid navigation stack buildup
      router.replace('/auth');
    }
  }, [user, loading, segments, router]);

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
      <Stack.Screen name="profile" />
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
