
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';

// Dot matrix pattern generator for SVG
const createDotMatrixPattern = () => {
  return `data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1' fill='%23ED7B58' opacity='0.1'/%3E%3C/svg%3E`;
};

export default function WelcomeTipScreen() {
  const router = useRouter();

  const handleContinue = () => {
    console.log('User tapped Continue button on welcome tip screen');
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <ImageBackground
        source={{ uri: createDotMatrixPattern() }}
        style={styles.container}
        imageStyle={{ opacity: 0.3 }}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <IconSymbol
              ios_icon_name="lightbulb.fill"
              android_material_icon_name="lightbulb"
              size={80}
              color={colors.primary}
            />
          </View>

          <Text style={styles.titleDe}>Willkommen bei Kautions-Safe</Text>
          <Text style={styles.titleEn}>Welcome to Kautions-Safe</Text>

          <View style={styles.tipBox}>
            <Text style={styles.tipTextDe}>
              Tipp: Dokumentieren Sie jeden Raum sorgfältig mit Fotos und Notizen. Dies schützt Ihre Kaution bei Auszug.
            </Text>
            <Text style={styles.tipTextEn}>
              Tip: Document each room carefully with photos and notes. This protects your deposit when moving out.
            </Text>
          </View>

          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <IconSymbol
                ios_icon_name="checkmark.circle.fill"
                android_material_icon_name="check-circle"
                size={24}
                color={colors.primary}
              />
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTextDe}>Raum-für-Raum Inspektion</Text>
                <Text style={styles.featureTextEn}>Room-by-room inspection</Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <IconSymbol
                ios_icon_name="checkmark.circle.fill"
                android_material_icon_name="check-circle"
                size={24}
                color={colors.primary}
              />
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTextDe}>GPS-verifizierte Fotos</Text>
                <Text style={styles.featureTextEn}>GPS-verified photos</Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <IconSymbol
                ios_icon_name="checkmark.circle.fill"
                android_material_icon_name="check-circle"
                size={24}
                color={colors.primary}
              />
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTextDe}>Digitale Unterschriften</Text>
                <Text style={styles.featureTextEn}>Digital signatures</Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <IconSymbol
                ios_icon_name="checkmark.circle.fill"
                android_material_icon_name="check-circle"
                size={24}
                color={colors.primary}
              />
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTextDe}>Rechtsgültiges PDF-Protokoll</Text>
                <Text style={styles.featureTextEn}>Legally valid PDF protocol</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.continueButtonText}>Los geht's / Let's Start</Text>
            <IconSymbol
              ios_icon_name="arrow.right"
              android_material_icon_name="arrow-forward"
              size={24}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 32,
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 0,
  },
  titleDe: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  titleEn: {
    fontSize: 20,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 32,
  },
  tipBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 0,
    padding: 20,
    marginBottom: 32,
    borderLeftWidth: 4,
    borderLeftColor: '#FFFFFF',
  },
  tipTextDe: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  tipTextEn: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  featuresList: {
    width: '100%',
    gap: 16,
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    borderRadius: 0,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTextDe: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 2,
  },
  featureTextEn: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 0,
    width: '100%',
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
});
