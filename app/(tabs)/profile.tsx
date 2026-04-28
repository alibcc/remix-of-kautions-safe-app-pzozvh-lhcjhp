import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";
import { GlassView } from "expo-glass-effect";
import { useTheme } from "@react-navigation/native";
import { ConfirmModal, AlertModal } from "@/components/ui/Modal";
import { colors } from "@/styles/commonStyles";
import { supabase } from "@/app/integrations/supabase/client";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit Profile modal state
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // Alert modal state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'info' | 'error' | 'success'>('info');

  const showAlert = (title: string, message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertType(type);
    setAlertVisible(true);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/auth');
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setSigningOut(false);
      setShowSignOutModal(false);
    }
  };

  const handleEditProfile = () => {
    const userName = user?.user_metadata?.name || '';
    const userEmail = user?.email || '';
    setEditName(userName);
    setEditEmail(userEmail);
    setShowEditProfileModal(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      showAlert('Error', 'Name cannot be empty', 'error');
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({
        email: editEmail.trim() !== user?.email ? editEmail.trim() : undefined,
        data: { name: editName.trim() },
      });
      if (error) {
        showAlert('Error', error.message, 'error');
        return;
      }
      showAlert('Success', editEmail.trim() !== user?.email
        ? 'Profile updated. Please check your new email for a confirmation link.'
        : 'Profile updated successfully.', 'success');
      setShowEditProfileModal(false);
    } catch (err: any) {
      showAlert('Error', err.message, 'error');
    }
  };

  const handleChangePassword = async () => {
    if (!user?.email) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: 'moveproof://auth/callback',
      });
      if (error) {
        showAlert('Error', error.message, 'error');
        return;
      }
      showAlert('Email Sent', 'Check your email for a password reset link.', 'success');
    } catch (err: any) {
      showAlert('Error', err.message, 'error');
    }
  };

  const handleContactSupport = () => {
    showAlert('Contact Support', 'Please email us at support@moveproof.app for assistance.', 'info');
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-user');
      if (error) throw error;
      await signOut();
      router.replace('/auth');
    } catch (err: any) {
      showAlert('Error', 'Failed to delete account. Please contact support@moveproof.app', 'error');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const userEmail = user?.email || "No email";
  const userName = user?.user_metadata?.name || "User";

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        <GlassView style={styles.profileHeader} glassEffectStyle="regular">
          <Text style={styles.profileIcon}>👤</Text>
          <Text style={[styles.name, { color: theme.colors.text }]}>{userName}</Text>
          <Text style={[styles.email, { color: theme.dark ? '#98989D' : '#666' }]}>{userEmail}</Text>
        </GlassView>

        <View style={styles.optionsSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Account Settings</Text>

          <TouchableOpacity
            style={[styles.optionButton, { backgroundColor: theme.dark ? 'rgba(255, 255, 255, 0.05)' : '#fff' }]}
            onPress={handleEditProfile}
          >
            <View style={styles.optionIconContainer}>
              <IconSymbol ios_icon_name="person.circle" android_material_icon_name="account-circle" size={24} color={colors.primary} />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={[styles.optionTitle, { color: theme.colors.text }]}>Edit Profile</Text>
              <Text style={[styles.optionSubtitle, { color: theme.dark ? '#98989D' : '#666' }]}>Update your name and email</Text>
            </View>
            <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={20} color={theme.dark ? '#98989D' : '#666'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionButton, { backgroundColor: theme.dark ? 'rgba(255, 255, 255, 0.05)' : '#fff' }]}
            onPress={handleChangePassword}
          >
            <View style={styles.optionIconContainer}>
              <IconSymbol ios_icon_name="lock.shield" android_material_icon_name="lock" size={24} color={colors.primary} />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={[styles.optionTitle, { color: theme.colors.text }]}>Security</Text>
              <Text style={[styles.optionSubtitle, { color: theme.dark ? '#98989D' : '#666' }]}>Change your password</Text>
            </View>
            <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={20} color={theme.dark ? '#98989D' : '#666'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionButton, { backgroundColor: theme.dark ? 'rgba(255, 255, 255, 0.05)' : '#fff' }]}
            onPress={handleContactSupport}
          >
            <View style={styles.optionIconContainer}>
              <IconSymbol ios_icon_name="questionmark.circle" android_material_icon_name="help" size={24} color={colors.primary} />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={[styles.optionTitle, { color: theme.colors.text }]}>Support</Text>
              <Text style={[styles.optionSubtitle, { color: theme.dark ? '#98989D' : '#666' }]}>Contact support team</Text>
            </View>
            <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={20} color={theme.dark ? '#98989D' : '#666'} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.signOutButton, { backgroundColor: colors.error }]}
          onPress={() => setShowSignOutModal(true)}
          disabled={signingOut}
        >
          {signingOut ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <IconSymbol ios_icon_name="arrow.right.square" android_material_icon_name="logout" size={20} color="#fff" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.signOutButton, { backgroundColor: '#FF3B30', marginTop: 12 }]}
          onPress={() => setShowDeleteModal(true)}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <IconSymbol ios_icon_name="trash" android_material_icon_name="delete" size={20} color="#fff" />
              <Text style={styles.signOutText}>Delete Account</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditProfileModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditProfileModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowEditProfileModal(false)}>
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="close"
                  size={28}
                  color={theme.dark ? '#98989D' : '#666'}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Name</Text>
                <TextInput
                  style={[styles.input, {
                    backgroundColor: theme.dark ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5',
                    color: theme.colors.text,
                    borderColor: theme.dark ? 'rgba(255, 255, 255, 0.1)' : '#e0e0e0'
                  }]}
                  placeholder="Enter your name"
                  placeholderTextColor={theme.dark ? '#98989D' : '#999'}
                  value={editName}
                  onChangeText={setEditName}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Email</Text>
                <TextInput
                  style={[styles.input, {
                    backgroundColor: theme.dark ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5',
                    color: theme.colors.text,
                    borderColor: theme.dark ? 'rgba(255, 255, 255, 0.1)' : '#e0e0e0'
                  }]}
                  placeholder="Enter your email"
                  placeholderTextColor={theme.dark ? '#98989D' : '#999'}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>
            <TouchableOpacity
              style={[styles.modalSaveButton, { backgroundColor: colors.primary }]}
              onPress={handleSaveProfile}
            >
              <Text style={styles.modalSaveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={showSignOutModal}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        confirmText="Sign Out"
        cancelText="Cancel"
        type="danger"
        onConfirm={handleSignOut}
        onCancel={() => setShowSignOutModal(false)}
      />

      <ConfirmModal
        visible={showDeleteModal}
        title="Delete Account"
        message="This will permanently delete your account and all your data. This cannot be undone."
        confirmText="Delete Account"
        cancelText="Cancel"
        type="danger"
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteModal(false)}
      />

      <AlertModal
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        type={alertType}
        onClose={() => setAlertVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  profileHeader: {
    alignItems: 'center',
    borderRadius: 12,
    padding: 32,
    marginBottom: 24,
    gap: 12,
  },
  profileIcon: {
    fontSize: 80,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  email: {
    fontSize: 16,
  },
  optionsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  optionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 14,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  signOutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  modalBody: {
    paddingHorizontal: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  modalSaveButton: {
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
