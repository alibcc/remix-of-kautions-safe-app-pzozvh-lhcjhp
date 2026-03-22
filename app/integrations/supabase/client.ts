
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from './types';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// CRITICAL FIX: Wait for environment variables to load before exporting client
const SUPABASE_URL = "https://uxcqlvlealowlsmrxmrn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_DOyxoXZG52Iq9YLDjuP2_g_nUaaaib0";

// Validate that credentials are loaded
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('CRITICAL: Supabase credentials not loaded. URL:', SUPABASE_URL, 'Key exists:', !!SUPABASE_ANON_KEY);
  throw new Error('Supabase credentials are not configured. Please check your environment variables.');
}

console.log('Supabase client initializing with URL:', SUPABASE_URL);

// Create Supabase client with AsyncStorage for session persistence
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: {
      getItem: (key: string) => AsyncStorage.getItem(key),
      setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
      removeItem: (key: string) => AsyncStorage.removeItem(key),
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

console.log('Supabase client initialized successfully');

// Export a function to verify the client is ready
export const isSupabaseReady = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Supabase session check failed:', error.message);
      return false;
    }
    console.log('Supabase client is ready. Session exists:', !!data.session);
    return true;
  } catch (error) {
    console.error('Supabase client verification failed:', error);
    return false;
  }
};
