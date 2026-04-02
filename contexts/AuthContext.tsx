
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/app/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { Linking } from "react-native";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("AuthProvider: Initializing auth state");
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("AuthProvider: Initial session:", session?.user?.email || "No session");
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("AuthProvider: Auth state changed:", _event, session?.user?.email || "No session");
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Handle deep link redirect after OAuth
    const handleDeepLink = async (event: { url: string }) => {
      if (event.url.includes("auth/callback")) {
        console.log("AuthProvider: OAuth callback received:", event.url);
        const { data, error } = await supabase.auth.getSessionFromUrl({ url: event.url });
        if (error) {
          console.error("AuthProvider: Error getting session from URL:", error.message);
        } else {
          console.log("AuthProvider: Session from URL:", data?.session?.user?.email);
        }
      }
    };

    const linkingSubscription = Linking.addEventListener("url", handleDeepLink);

    // Handle case where app was opened from a deep link (cold start)
    Linking.getInitialURL().then((url) => {
      if (url && url.includes("auth/callback")) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.unsubscribe();
      linkingSubscription.remove();
    };
```

---

## One more thing — Supabase Dashboard

Go to your **Supabase project → Authentication → URL Configuration** and add this to the **Redirect URLs** list:
```
moveproof://auth/callback  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    console.log("AuthProvider: Signing in with email:", email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("AuthProvider: Sign in error:", error.message);
      throw error;
    }

    console.log("AuthProvider: Sign in successful:", data.user?.email);
  };

  const signUpWithEmail = async (email: string, password: string) => {
    console.log("AuthProvider: Signing up with email:", email);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.error("AuthProvider: Sign up error:", error.message);
      throw error;
    }

    console.log("AuthProvider: Sign up successful:", data.user?.email);
  };

const signInWithGoogle = async () => {
    console.log("AuthProvider: Signing in with Google");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "moveproof://auth/callback",
      },
    });

    if (error) {
      console.error("AuthProvider: Google sign in error:", error.message);
      throw error;
    }

    if (data?.url) {
      await Linking.openURL(data.url);
    }

    console.log("AuthProvider: Google sign in initiated");
  };

  const signInWithApple = async () => {
    console.log("AuthProvider: Signing in with Apple");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: {
        redirectTo: "moveproof://auth/callback",
      },
    });

    if (error) {
      console.error("AuthProvider: Apple sign in error:", error.message);
      throw error;
    }

    if (data?.url) {
      await Linking.openURL(data.url);
    }

    console.log("AuthProvider: Apple sign in initiated");
  };

  const signOut = async () => {
    console.log("AuthProvider: Signing out");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("AuthProvider: Sign out error:", error.message);
      }
    } finally {
      // Always clear local state
      setUser(null);
      setSession(null);
      console.log("AuthProvider: Sign out complete");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signInWithApple,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
