import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from './types';
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://uxcqlvlealowlsmrxmrn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4Y3FsdmxlYWxvd2xzbXJ4bXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NDMxMDgsImV4cCI6MjA4NjExOTEwOH0.2NeIt74RNfwolOjwnvV1V96NW6IKJq8P0SoQpyLKJ5k";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
