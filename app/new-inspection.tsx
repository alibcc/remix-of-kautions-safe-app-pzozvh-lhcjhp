import { Stack, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { colors, commonStyles } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { supabase } from "@/app/integrations/supabase/client";
import { AlertModal } from "@/components/ui/Modal";

export default function NewInspectionScreen() {
  const router = useRouter();
  const [propertyAddress, setPropertyAddress] = useState('');
  const [inspectionType, setInspectionType] = useState<'Move In' | 'Move Out'>('Move In');
  const [landlordName, setLandlordName] = useState('');
  const [landlordEmail, setLandlordEmail] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [loading, setLoading] = useState(false);

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

  const handleCreate = async () => {
    console.log('User tapped Create Inspection button');

    if (!propertyAddress.trim()) {
      showAlert('Validation Error', 'Please enter a property address', 'error');
      return;
    }

    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError) {
        showAlert('Authentication Error', `Failed to get user: ${userError.message}`, 'error');
        setLoading(false);
        return;
      }

      if (!user) {
        showAlert('Authentication Error', 'You must be logged in to create an inspection', 'error');
        setLoading(false);
        return;
      }

      const mappedInspectionType = inspectionType === 'Move In' ? 'Einzug' :
                                   inspectionType === 'Move Out' ? 'Auszug' :
                                   'Einzug';

      const { data: reportData, error: reportError } = await supabase
        .from('reports')
        .insert([{
          address: propertyAddress,
          inspection_type: mappedInspectionType,
          status: 'IN PROGRESS',
          user_id: user.id,
        }])
        .select('id')
        .single();

      if (reportError) {
        showAlert('Database Error', `Failed to create report: ${reportError.message}`, 'error');
        setLoading(false);
        return;
      }

      if (!reportData || !reportData.id) {
        showAlert('Error', 'Failed to create report: No data returned', 'error');
        setLoading(false);
        return;
      }

      if (landlordName.trim() || tenantName.trim()) {
        const participantsToInsert = [];

        if (landlordName.trim()) {
          participantsToInsert.push({
            report_id: reportData.id,
            role: 'Landlord',
            name: landlordName.trim(),
            email: landlordEmail.trim(),
          });
        }

        if (tenantName.trim()) {
          participantsToInsert.push({
            report_id: reportData.id,
            role: 'Tenant',
            name: tenantName.trim(),
            email: tenantEmail.trim(),
          });
        }

        const { error: participantsError } = await supabase
          .from('participants')
          .insert(participantsToInsert);

        if (participantsError) {
          console.warn('Participants not saved, but report was created successfully');
        }
      }

      router.replace(`/inspection/${reportData.id}`);
    } catch (err: any) {
      showAlert('Unexpected Error', `An unexpected error occurred: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => router.back();

  return (
    <>
      <Stack.Screen
        options={{
          title: "New Inspection",
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: '#FFFFFF',
          headerBackTitle: 'Back',
        }}
      />
      <View style={commonStyles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

          {/* ── Property Details ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Property Details</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Property Address *</Text>
              <TextInput
                style={commonStyles.input}
                placeholder="e.g., Hauptstraße 123, 10115 Berlin"
                value={propertyAddress}
                onChangeText={setPropertyAddress}
                multiline
                numberOfLines={2}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Inspection Type *</Text>
              <View style={styles.typeButtons}>
                <TouchableOpacity
                  style={[styles.typeButton, inspectionType === 'Move In' && styles.typeButtonActive]}
                  onPress={() => setInspectionType('Move In')}
                >
                  <IconSymbol ios_icon_name="arrow.down.circle" android_material_icon_name="arrow-downward" size={24} color={inspectionType === 'Move In' ? '#FFFFFF' : colors.primary} />
                  <Text style={[styles.typeButtonText, inspectionType === 'Move In' && styles.typeButtonTextActive]}>Move In</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.typeButton, inspectionType === 'Move Out' && styles.typeButtonActive]}
                  onPress={() => setInspectionType('Move Out')}
                >
                  <IconSymbol ios_icon_name="arrow.up.circle" android_material_icon_name="arrow-upward" size={24} color={inspectionType === 'Move Out' ? '#FFFFFF' : colors.primary} />
                  <Text style={[styles.typeButtonText, inspectionType === 'Move Out' && styles.typeButtonTextActive]}>Move Out</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ── Participants ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Participants (Optional)</Text>

            {/* Landlord */}
            <View style={styles.participantGroup}>
              <Text style={styles.participantGroupTitle}>Landlord / Vermieter</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={commonStyles.input}
                  placeholder="e.g., Max Mustermann"
                  value={landlordName}
                  onChangeText={setLandlordName}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={commonStyles.input}
                  placeholder="e.g., landlord@email.com"
                  value={landlordEmail}
                  onChangeText={setLandlordEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Tenant */}
            <View style={styles.participantGroup}>
              <Text style={styles.participantGroupTitle}>Tenant / Mieter</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={commonStyles.input}
                  placeholder="e.g., Anna Schmidt"
                  value={tenantName}
                  onChangeText={setTenantName}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={commonStyles.input}
                  placeholder="e.g., tenant@email.com"
                  value={tenantEmail}
                  onChangeText={setTenantEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
          </View>

          <View style={styles.infoBox}>
            <IconSymbol ios_icon_name="info.circle" android_material_icon_name="info" size={20} color={colors.primary} />
            <Text style={styles.infoText}>
              You can add rooms, meters, and signatures after creating the inspection.
              {'\n'}Emails are used to send the final PDF automatically.
            </Text>
          </View>

        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={loading}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.createButton, (!propertyAddress.trim() || loading) && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={!propertyAddress.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <IconSymbol ios_icon_name="checkmark.circle" android_material_icon_name="check-circle" size={20} color="#FFFFFF" />
                <Text style={styles.createButtonText}>Create Inspection</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <AlertModal visible={alertVisible} title={alertTitle} message={alertMessage} type={alertType} onClose={() => setAlertVisible(false)} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: colors.text, marginBottom: 16 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  participantGroup: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.border,
  },
  participantGroupTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 12,
  },
  typeButtons: { flexDirection: 'row', gap: 12 },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: '#FFFFFF',
  },
  typeButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeButtonText: { fontSize: 16, fontWeight: '600', color: colors.primary },
  typeButtonTextActive: { color: '#FFFFFF' },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoText: { flex: 1, fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: colors.text },
  createButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 0,
    backgroundColor: colors.primary,
  },
  createButtonDisabled: { backgroundColor: colors.textSecondary, opacity: 0.5 },
  createButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
