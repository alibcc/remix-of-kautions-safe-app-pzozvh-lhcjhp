import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { AlertModal } from "@/components/ui/Modal";
import { useRouter } from "expo-router";
import { supabase } from "@/app/integrations/supabase/client";

type Mode = "signin" | "signup" | "forgot";

export default function AuthScreen() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState<'info' | 'error' | 'success'>('info');

  const showAlert = (title: string, message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertType(type);
    setAlertVisible(true);
  };

  const handleEmailAuth = async () => {
    if (!email || !password) {
      showAlert("Error", "Please enter email and password", 'error');
      return;
    }
    setLoading(true);
    try {
      if (mode === "signin") {
        await signInWithEmail(email, password);
        router.replace('/(tabs)/(home)');
      } else {
        await signUpWithEmail(email, password);
        showAlert("Success", "Account created! Please check your email to verify your account.", 'success');
      }
    } catch (error: any) {
      showAlert("Error", error.message || "Authentication failed", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      showAlert("Error", "Please enter your email address first", 'error');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'moveproof://auth/callback',
      });
      if (error) throw error;
      showAlert("Check your email", "We sent a password reset link to " + email, 'success');
      setMode("signin");
    } catch (error: any) {
      showAlert("Error", error.message || "Failed to send reset email", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/(tabs)/(home)');
    } catch (error: any) {
      showAlert("Error", error.message || "Authenti
