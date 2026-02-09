
import React from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'default' | 'danger' | 'success';
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  type = 'default',
}: ConfirmModalProps) {
  // CRITICAL FIX #2: Force high-contrast button colors
  const getConfirmButtonColor = () => {
    switch (type) {
      case 'danger':
        return '#FF3B30'; // Red
      case 'success':
        return '#007AFF'; // Blue
      default:
        return '#007AFF'; // Blue
    }
  };

  const getIconName = () => {
    switch (type) {
      case 'danger':
        return 'exclamationmark.triangle.fill';
      case 'success':
        return 'checkmark.circle.fill';
      default:
        return 'questionmark.circle.fill';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'danger':
        return '#FF3B30';
      case 'success':
        return '#16A34A';
      default:
        return '#007AFF';
    }
  };

  const confirmButtonColor = getConfirmButtonColor();

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.iconContainer}>
            <IconSymbol
              ios_icon_name={getIconName()}
              android_material_icon_name="info"
              size={48}
              color={getIconColor()}
            />
          </View>
          
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
            >
              <Text style={styles.cancelButtonText}>{cancelText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.confirmButton, { backgroundColor: confirmButtonColor }]}
              onPress={onConfirm}
            >
              {/* CRITICAL FIX #2: EXPLICIT Bold White text - MAXIMUM VISIBILITY */}
              <Text style={styles.confirmButtonText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </RNModal>
  );
}

interface AlertModalProps {
  visible: boolean;
  title: string;
  message: string;
  buttonText?: string;
  onClose: () => void;
  type?: 'info' | 'error' | 'success';
}

export function AlertModal({
  visible,
  title,
  message,
  buttonText = 'CLOSE',
  onClose,
  type = 'info',
}: AlertModalProps) {
  const getIconName = () => {
    switch (type) {
      case 'error':
        return 'xmark.circle.fill';
      case 'success':
        return 'checkmark.circle.fill';
      default:
        return 'info.circle.fill';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'error':
        return '#FF3B30'; // Red
      case 'success':
        return '#16A34A'; // Green
      default:
        return '#007AFF'; // Blue
    }
  };

  // CRITICAL FIX #2: Force high-contrast button colors - Red for errors, Blue for others
  const getButtonColor = () => {
    switch (type) {
      case 'error':
        return '#FF3B30'; // Red for errors - MAXIMUM CONTRAST
      case 'success':
        return '#007AFF'; // Blue for success
      default:
        return '#007AFF'; // Blue for info
    }
  };

  const buttonColor = getButtonColor();

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.iconContainer}>
            <IconSymbol
              ios_icon_name={getIconName()}
              android_material_icon_name="info"
              size={48}
              color={getIconColor()}
            />
          </View>
          
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <TouchableOpacity
            style={[styles.button, styles.singleButton, { backgroundColor: buttonColor }]}
            onPress={onClose}
          >
            {/* CRITICAL FIX #2: EXPLICIT Bold White text - MAXIMUM VISIBILITY */}
            <Text style={styles.confirmButtonText}>{buttonText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700', // CRITICAL FIX #2: Bold - MAXIMUM VISIBILITY
    color: '#FFFFFF', // CRITICAL FIX #2: White - ALWAYS visible on red/blue backgrounds
    textShadowColor: 'rgba(0, 0, 0, 0.3)', // Added subtle shadow for extra contrast
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  singleButton: {
    backgroundColor: '#007AFF',
    width: '100%',
  },
});
