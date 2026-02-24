
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import SignatureCanvas from 'react-native-signature-canvas';
import DateTimePicker from '@react-native-community/datetimepicker';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';

export default function SignatureScreen() {
  const router = useRouter();
  const { inspectionId } = useLocalSearchParams();
  
  const [landlordSignature, setLandlordSignature] = useState<string | null>(null);
  const [tenantSignature, setTenantSignature] = useState<string | null>(null);
  const [tenantSignatureDate, setTenantSignatureDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const landlordSignatureRef = useRef<any>(null);
  const tenantSignatureRef = useRef<any>(null);

  const handleLandlordSignature = (signature: string) => {
    console.log('Landlord signature captured');
    setLandlordSignature(signature);
  };

  const handleTenantSignature = (signature: string) => {
    console.log('Tenant signature captured');
    setTenantSignature(signature);
  };

  const handleClearLandlordSignature = () => {
    console.log('Clearing landlord signature');
    setLandlordSignature(null);
    if (landlordSignatureRef.current) {
      landlordSignatureRef.current.clearSignature();
    }
  };

  const handleClearTenantSignature = () => {
    console.log('Clearing tenant signature');
    setTenantSignature(null);
    if (tenantSignatureRef.current) {
      tenantSignatureRef.current.clearSignature();
    }
  };

  const handleProceed = () => {
    if (!landlordSignature || !tenantSignature) {
      console.log('Both signatures are required');
      return;
    }

    console.log('Proceeding with signatures');
    router.back();
    // Pass signatures back via navigation params or state management
  };

  const signatureWebStyle = `.m-signature-pad {
    box-shadow: none;
    border: 2px solid ${colors.border};
    border-radius: 0;
  }
  .m-signature-pad--body {
    border: none;
  }
  .m-signature-pad--footer {
    display: none;
  }`;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Digital Signatures',
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: '#FFFFFF',
          headerBackTitle: 'Back',
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Landlord Signature */}
          <View style={styles.signatureSection}>
            <Text style={styles.sectionTitle}>Vermieter (Landlord) Signature</Text>
            <View style={styles.signatureCanvasContainer}>
              <SignatureCanvas
                ref={landlordSignatureRef}
                onOK={handleLandlordSignature}
                onEmpty={() => console.log('Landlord signature is empty')}
                descriptionText="Sign above"
                clearText="Clear"
                confirmText="Save"
                webStyle={signatureWebStyle}
                style={styles.signatureCanvas}
              />
            </View>
            {landlordSignature && (
              <View style={styles.signatureConfirmation}>
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check-circle"
                  size={20}
                  color={colors.success}
                />
                <Text style={styles.confirmationText}>Signature captured</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearLandlordSignature}
            >
              <Text style={styles.clearButtonText}>Clear Signature</Text>
            </TouchableOpacity>
          </View>

          {/* Tenant Signature */}
          <View style={styles.signatureSection}>
            <Text style={styles.sectionTitle}>Mieter (Tenant) Signature</Text>
            <View style={styles.signatureCanvasContainer}>
              <SignatureCanvas
                ref={tenantSignatureRef}
                onOK={handleTenantSignature}
                onEmpty={() => console.log('Tenant signature is empty')}
                descriptionText="Sign above"
                clearText="Clear"
                confirmText="Save"
                webStyle={signatureWebStyle}
                style={styles.signatureCanvas}
              />
            </View>
            {tenantSignature && (
              <View style={styles.signatureConfirmation}>
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check-circle"
                  size={20}
                  color={colors.success}
                />
                <Text style={styles.confirmationText}>Signature captured</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearTenantSignature}
            >
              <Text style={styles.clearButtonText}>Clear Signature</Text>
            </TouchableOpacity>
          </View>

          {/* Tenant Signature Date */}
          <View style={styles.signatureSection}>
            <Text style={styles.sectionTitle}>Tenant Signature Date</Text>
            {Platform.OS === 'ios' ? (
              <DateTimePicker
                value={tenantSignatureDate}
                mode="date"
                display="spinner"
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    console.log('Tenant signature date selected:', selectedDate);
                    setTenantSignatureDate(selectedDate);
                  }
                }}
                style={styles.datePicker}
              />
            ) : (
              <>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <IconSymbol
                    ios_icon_name="calendar"
                    android_material_icon_name="calendar-today"
                    size={20}
                    color={colors.text}
                  />
                  <Text style={styles.dateButtonText}>
                    {tenantSignatureDate.toLocaleDateString('de-DE')}
                  </Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={tenantSignatureDate}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowDatePicker(false);
                      if (selectedDate) {
                        console.log('Tenant signature date selected:', selectedDate);
                        setTenantSignatureDate(selectedDate);
                      }
                    }}
                  />
                )}
              </>
            )}
            <Text style={styles.dateDisplay}>
              Selected: {tenantSignatureDate.toLocaleDateString('de-DE')}
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.proceedButton,
              (!landlordSignature || !tenantSignature) && styles.proceedButtonDisabled,
            ]}
            onPress={handleProceed}
            disabled={!landlordSignature || !tenantSignature}
          >
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={24}
              color="#FFFFFF"
            />
            <Text style={styles.proceedButtonText}>Proceed to Generate PDF</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  signatureSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  signatureCanvasContainer: {
    height: 200,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 0,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  signatureCanvas: {
    flex: 1,
  },
  signatureConfirmation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  confirmationText: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '600',
  },
  clearButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  datePicker: {
    width: '100%',
    backgroundColor: colors.card,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 0,
  },
  dateButtonText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  dateDisplay: {
    fontSize: 16,
    color: colors.text,
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 0,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  proceedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.primary,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 0,
  },
  proceedButtonDisabled: {
    backgroundColor: colors.textSecondary,
    opacity: 0.5,
  },
  proceedButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
