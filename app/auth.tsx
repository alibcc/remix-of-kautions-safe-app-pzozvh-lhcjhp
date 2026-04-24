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
let AppleAuthentication: any = null;
try { AppleAuthentication = require("expo-apple-authentication"); } catch {}
import { useAuth } from "@/contexts/AuthContext";
import { AlertModal } from "@/components/ui/Modal";
import { useRouter } from "expo-router";
import { supabase } from "@/app/integrations/supabase/client";

type Mode = "signin" | "signup";

export default function AuthScreen() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState<"info" | "error" | "success">("info");

  const showAlert = (title: string, message: string, type: "info" | "error" | "success" = "info") => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertType(type);
    setAlertVisible(true);
  };

  const handleEmailAuth = async () => {
    if (!email || !password) {
      showAlert("Error", "Please enter email and password", "error");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signin") {
        await signInWithEmail(email, password);
        router.replace("/(tabs)/(home)");
      } else {
        await signUpWithEmail(email, password);
        showAlert("Success", "Account created! Please check your email to verify your account.", "success");
      }
    } catch (error: any) {
      showAlert("Error", error.message || "Authentication failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      router.replace("/(tabs)/(home)");
    } catch (error: any) {
      showAlert("Error", error.message || "Authentication failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAppleAuth = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken!,
      });
      if (error) throw error;
      router.replace("/(tabs)/(home)");
    } catch (error: any) {
      if (error.code !== "ERR_REQUEST_CANCELED") {
        showAlert("Error", error.message || "Apple sign in failed", "error");
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      showAlert("Error", "Please enter your email address above first", "error");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "moveproof://reset-password",
      });
      if (error) throw error;
      setResetSent(true);
    } catch (error: any) {
      showAlert("Error", error.message || "Failed to send reset email", "error");
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot password success state ──
  if (resetSent) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a password reset link to {email}
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => { setResetSent(false); setForgotMode(false); }}
          >
            <Text style={styles.primaryButtonText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>
            {forgotMode ? "Reset Password" : mode === "signin" ? "Sign In" : "Sign Up"}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {!forgotMode && (
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          )}

          {/* Forgot password link — only show on sign in */}
          {mode === "signin" && !forgotMode && (
            <TouchableOpacity
              style={styles.forgotButton}
              onPress={() => setForgotMode(true)}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={forgotMode ? handleForgotPassword : handleEmailAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {forgotMode ? "Send Reset Link" : mode === "signin" ? "Sign In" : "Sign Up"}
              </Text>
            )}
          </TouchableOpacity>

          {forgotMode ? (
            <TouchableOpacity
              style={styles.switchModeButton}
              onPress={() => setForgotMode(false)}
            >
              <Text style={styles.switchModeText}>Back to Sign In</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.switchModeButton}
              onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              <Text style={styles.switchModeText}>
                {mode === "signin"
                  ? "Don't have an account? Sign Up"
                  : "Already have an account? Sign In"}
              </Text>
            </TouchableOpacity>
          )}

          {!forgotMode && (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or continue with</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.socialButton}
                onPress={handleGoogleAuth}
                disabled={loading}
              >
                <Text style={styles.socialButtonText}>Continue with Google</Text>
              </TouchableOpacity>

              {/* Apple Sign In — iOS only */}
              {Platform.OS === "ios" && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={0}
                  style={styles.appleButton}
                  onPress={handleAppleAuth}
                />
              )}
            </>
          )}
        </View>
      </ScrollView>

      <AlertModal
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        type={alertType}
        onClose={() => setAlertVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scrollContent: { flexGrow: 1 },
  content: { flex: 1, padding: 24, justifyContent: "center" },
  title: { fontSize: 32, fontWeight: "bold", marginBottom: 32, textAlign: "center", color: "#000" },
  subtitle: { fontSize: 15, color: "#666", textAlign: "center", marginBottom: 32 },
  input: {
    height: 50, borderWidth: 1, borderColor: "#ddd", borderRadius: 0,
    paddingHorizontal: 16, marginBottom: 16, fontSize: 16, backgroundColor: "#fff",
  },
  primaryButton: {
    height: 50, backgroundColor: "#86D9F9", borderRadius: 0,
    justifyContent: "center", alignItems: "center", marginTop: 8,
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  buttonDisabled: { opacity: 0.6 },
  forgotButton: { alignItems: "flex-end", marginBottom: 8, marginTop: -8 },
  forgotText: { color: "#86D9F9", fontSize: 13 },
  switchModeButton: { marginTop: 16, alignItems: "center" },
  switchModeText: { color: "#86D9F9", fontSize: 14 },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#ddd" },
  dividerText: { marginHorizontal: 12, color: "#666", fontSize: 14 },
  socialButton: {
    height: 50, borderWidth: 1, borderColor: "#ddd", borderRadius: 0,
    justifyContent: "center", alignItems: "center", marginBottom: 12, backgroundColor: "#fff",
  },
  socialButtonText: { fontSize: 16, color: "#000", fontWeight: "500" },
  appleButton: { width: "100%", height: 50 },
});
