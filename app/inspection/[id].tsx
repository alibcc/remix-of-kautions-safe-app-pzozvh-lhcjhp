import { AlertModal } from "@/components/ui/Modal";
import { useAuth } from "@/contexts/AuthContext";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
  Linking,
  TextInput,
  KeyboardAvoidingView,
  ImageBackground,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { decode } from 'base64-arraybuffer';
import SignatureCanvas from "react-native-signature-canvas";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { Linking } from "react-native";
import { supabase } from "@/app/integrations/supabase/client";
import { colors, commonStyles } from "@/styles/commonStyles";
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from "@/components/IconSymbol";
import React, { useState, useEffect, useRef } from "react";

interface Room {
  id: string;
  report_id: string;
  name_en: string;
  name_de: string;
}

interface Report {
  id: string;
  address: string;
  inspection_type: string;
  status: string;
  created_at: string;
  user_id: string;
}

interface Participant {
  id: string;
  report_id: string;
  role: string;
  name: string;
  email?: string;
}

interface RoomItem {
  id: string;
  room_id: string;
  item_name_en: string;
  item_name_de: string;
  condition_status: string;
  notes?: string;
  requires_repair: boolean;
}

interface Photo {
  id: string;
  item_id: string;
  storage_url: string;
  gps_coords: { latitude: number; longitude: number } | null;
  timestamp_verified: string;
}

type EmailStatus = 'idle' | 'sending' | 'success' | 'error';

interface EmailModalState {
  visible: boolean;
  tenantEmail: string;
  landlordEmail: string;
  status: EmailStatus;
  errorMsg: string;
}

const ROOM_PRESETS = [
  { nameEn: 'Living Room', nameDe: 'Wohnzimmer' },
  { nameEn: 'Bedroom', nameDe: 'Schlafzimmer' },
  { nameEn: 'Kitchen', nameDe: 'Küche' },
  { nameEn: 'Bathroom', nameDe: 'Bad' },
  { nameEn: 'Hallway', nameDe: 'Flur' },
  { nameEn: 'Balcony', nameDe: 'Balkon' },
  { nameEn: 'Basement', nameDe: 'Keller' },
  { nameEn: 'Guest WC', nameDe: 'Gäste-WC' },
  { nameEn: 'Storage Room', nameDe: 'Abstellraum' },
  { nameEn: 'Garden', nameDe: 'Garten' },
];

const CRAFTMYPDF_TIMEOUT = 30000;

const createDotMatrixPattern = () =>
  `data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1' fill='%23ED7B58' opacity='0.15'/%3E%3C/svg%3E`;

export default function InspectionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();

  const [report, setReport] = useState<Report | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingRoom, setSavingRoom] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [selectedRoomPreset, setSelectedRoomPreset] = useState<typeof ROOM_PRESETS[0] | null>(null);
  const [showFinalDetailsModal, setShowFinalDetailsModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  const [electricityNo, setElectricityNo] = useState('');
  const [electricityVal, setElectricityVal] = useState('');
  const [gasNo, setGasNo] = useState('');
  const [gasVal, setGasVal] = useState('');
  const [waterNo, setWaterNo] = useState('');
  const [waterVal, setWaterVal] = useState('');
  const [heatNo, setHeatNo] = useState('');
  const [heatVal, setHeatVal] = useState('');
  const [keysHandedOver, setKeysHandedOver] = useState('');
  const [notes, setNotes] = useState('');
  const [isMoveIn, setIsMoveIn] = useState(false);
  const [isMoveOut, setIsMoveOut] = useState(false);

  const [landlordSignature, setLandlordSignature] = useState<string | null>(null);
  const [tenantSignature, setTenantSignature] = useState<string | null>(null);
  const [witnessSignature, setWitnessSignature] = useState<string | null>(null);
  const [witnessName, setWitnessName] = useState('');
  const [tenantSignatureDate, setTenantSignatureDate] = useState(new Date());

  const landlordSignatureRef = useRef<any>(null);
  const tenantSignatureRef = useRef<any>(null);
  const witnessSignatureRef = useRef<any>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'info' | 'error' | 'success'>('info');

const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [generatedDocSerial, setGeneratedDocSerial] = useState<string>('');
  const [isPaid, setIsPaid] = useState(false);
  const [tenantName, setTenantName] = useState('');
  const [landlordName, setLandlordName] = useState('');
  const [emailModal, setEmailModal] = useState<EmailModalState>({
    visible: false,
    tenantEmail: '',
    landlordEmail: '',
    status: 'idle',
    errorMsg: '',
  });

  const showAlert = (title: string, message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertType(type);
    setAlertVisible(true);
  };

useEffect(() => {
    const checkPaidStatus = async () => {
      if (!id) return;
      const { data } = await supabase.from('reports').select('is_paid').eq('id', id).single();
      if (data?.is_paid) setIsPaid(true);
    };

    const handleDeepLink = (event: { url: string }) => {
      if (event.url.includes('payment-complete') && event.url.includes(id as string)) {
        checkPaidStatus();
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);
    checkPaidStatus();

    return () => subscription.remove();
  }, [id]);

  useEffect(() => {
    let isMounted = true;
    const loadInspection = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      setReport(null);
      setRooms([]);
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!isMounted) return;
      try {
        const { data: reportData, error: fetchError } = await supabase
          .from('reports').select('*').eq('id', id).single();
        if (!isMounted) return;
        if (fetchError) {
          setError(fetchError.code === 'PGRST116'
            ? 'Inspection not found. It may have been deleted or you may not have access to it.'
            : `Failed to load inspection: ${fetchError.message}`);
        } else if (reportData) {
          setReport(reportData);
          const { data: roomsData, error: roomsError } = await supabase
            .from('rooms').select('*').eq('report_id', id).order('name_de', { ascending: true });
          if (!roomsError && roomsData) setRooms(roomsData);
          const { data: participantsData } = await supabase
            .from('participants').select('*').eq('report_id', id);
          if (participantsData) {
            const t = participantsData.find((p: Participant) => p.role === 'Tenant');
            const l = participantsData.find((p: Participant) => p.role === 'Landlord');
            setTenantName(t?.name || '');
            setLandlordName(l?.name || '');
            setEmailModal(s => ({ ...s, tenantEmail: t?.email || '', landlordEmail: l?.email || '' }));
          }
        } else {
          setError('Inspection not found.');
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(`An unexpected error occurred: ${err.message}`);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadInspection();
    return () => { isMounted = false; };
  }, [id]);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    const loadInspection = async () => {
      if (!id) return;
      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        const { data, error: fetchError } = await supabase.from('reports').select('*').eq('id', id).single();
        if (fetchError) {
          setError(fetchError.code === 'PGRST116' ? 'Inspection not found.' : `Failed to load inspection: ${fetchError.message}`);
        } else if (data) {
          setReport(data);
          setError(null);
          const { data: roomsData } = await supabase.from('rooms').select('*').eq('report_id', id).order('name_de', { ascending: true });
          if (roomsData) setRooms(roomsData);
        } else {
          setError('Inspection not found.');
        }
      } catch (err: any) {
        setError(`An unexpected error occurred: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    loadInspection();
  };

  const handleAddRoom = async () => {
    if (!selectedRoomPreset) { showAlert('Validation Error', 'Please select a room type', 'error'); return; }
    if (!id) { showAlert('Error', 'Report ID is missing', 'error'); return; }
    setSavingRoom(true);
    try {
      const { error: insertError } = await supabase.from('rooms').insert([{
        report_id: id, name_en: selectedRoomPreset.nameEn, name_de: selectedRoomPreset.nameDe,
      }]).select().single();
      if (insertError) { showAlert('Error', `Failed to add room: ${insertError.message}`, 'error'); return; }
      const { data: roomsData } = await supabase.from('rooms').select('*').eq('report_id', id).order('name_de', { ascending: true });
      if (roomsData) setRooms(roomsData);
      setShowAddRoomModal(false);
      setSelectedRoomPreset(null);
      showAlert('Success', 'Room added successfully', 'success');
    } catch (error: any) {
      showAlert('Error', `Failed to add room: ${error.message}`, 'error');
    } finally {
      setSavingRoom(false);
    }
  };

  const handleOpenRoom = (roomId: string) => router.push(`/inspection/room/${roomId}`);
  const handleOpenFinalDetails = () => setShowFinalDetailsModal(true);
  const handleProceedToSignatures = () => { setShowFinalDetailsModal(false); setShowSignatureModal(true); };
  const handleClearLandlordSignature = () => { setLandlordSignature(null); landlordSignatureRef.current?.clearSignature(); };
  const handleClearTenantSignature = () => { setTenantSignature(null); tenantSignatureRef.current?.clearSignature(); };
  const handleClearWitnessSignature = () => { setWitnessSignature(null); witnessSignatureRef.current?.clearSignature(); };
  const handleCloseSignatureModal = () => setShowSignatureModal(false);

  const sendProtocolEmail = async () => {
 if (!emailModal.tenantEmail && !emailModal.landlordEmail) {
      setEmailModal(s => ({ ...s, errorMsg: 'Bitte mindestens eine E-Mail-Adresse eingeben.\nPlease enter at least one email address.' }));
      return;
    }
    if (!generatedPdfUrl) {
      setEmailModal(s => ({ ...s, errorMsg: 'No PDF found. Please generate the protocol first.' }));
      return;
    }
    setEmailModal(s => ({ ...s, status: 'sending', errorMsg: '' }));
    try {
      const currentDate = new Date();
      const formattedDate = `${String(currentDate.getDate()).padStart(2, '0')}.${String(currentDate.getMonth() + 1).padStart(2, '0')}.${currentDate.getFullYear()}`;
      const response = await fetch('https://movproof-pdf-api.vercel.app/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfUrl: generatedPdfUrl,
          protocolId: id,
          tenant: { name: tenantName, email: emailModal.tenantEmail },
          landlord: { name: landlordName, email: emailModal.landlordEmail },
          address: report?.address || '',
          date: formattedDate,
          docSerial: generatedDocSerial,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Sending failed');
      setEmailModal(s => ({ ...s, status: 'success' }));
      setTimeout(() => { setEmailModal(s => ({ ...s, visible: false, status: 'idle' })); }, 3000);
    } catch (err: any) {
      setEmailModal(s => ({ ...s, status: 'error', errorMsg: err.message }));
    }
  };

const handleGeneratePDF = async () => {
// signatures optional - can be signed on paper


    if (!id || !report) { showAlert('Error', 'Report data is not available', 'error'); return; }
    if (!user || !user.id) { showAlert('Error', 'User authentication is not available', 'error'); return; }

    setGeneratingPDF(true);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (!session || sessionError) {
        showAlert('Error', 'Session expired. Please log in again.', 'error');
        setGeneratingPDF(false);
        return;
      }

      const { data: participantsData } = await supabase.from('participants').select('*').eq('report_id', id);
      const participants = participantsData || [];
      const fetchedLandlordName = participants.find((p: Participant) => p.role === 'Landlord')?.name || '';
      const fetchedTenantName = participants.find((p: Participant) => p.role === 'Tenant')?.name || '';
      setTenantName(fetchedTenantName);
      setLandlordName(fetchedLandlordName);

      const tenantEmail = participants.find((p: Participant) => p.role === 'Tenant')?.email || '';
      const landlordEmail = participants.find((p: Participant) => p.role === 'Landlord')?.email || '';
      setEmailModal(s => ({
        ...s,
        tenantEmail: s.tenantEmail || tenantEmail,
        landlordEmail: s.landlordEmail || landlordEmail,
      }));

      const uploadSignature = async (sigData: string | null, path: string): Promise<string> => {
        if (!sigData) return '';
        const base64 = sigData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = decode(base64);
        const { error } = await supabase.storage.from('signatures').upload(path, buffer, {
          contentType: 'image/png', upsert: true,
        });
        if (error) throw new Error(`Signature upload failed: ${error.message}`);
        const { data: urlData } = supabase.storage.from('signatures').getPublicUrl(path);
        if (!urlData.publicUrl) throw new Error('Failed to get signature URL after upload');
        return urlData.publicUrl;
      };

      const landlordSignatureUrl = await uploadSignature(landlordSignature, `${id}_landlord_${Date.now()}.png`);
      const tenantSignatureUrl = await uploadSignature(tenantSignature, `${id}_tenant_${Date.now()}.png`);
      const witnessSignatureUrl = await uploadSignature(witnessSignature, `${id}_witness_${Date.now()}.png`);

      const { data: allRoomsData, error: allRoomsError } = await supabase
        .from('rooms').select('*').eq('report_id', id).order('name_de', { ascending: true });
      if (allRoomsError) { showAlert('Error', `Failed to fetch rooms: ${allRoomsError.message}`, 'error'); return; }

      const roomsWithData = await Promise.all(
        (allRoomsData || []).map(async (room) => {
          const { data: itemsData } = await supabase.from('room_items').select('*').eq('room_id', room.id);
          const items = itemsData || [];
          const roomComment = items.map((item: RoomItem) => item.notes).filter(Boolean).join('\n');
          const roomCondition = items.length > 0
            ? items.every((item: RoomItem) => item.condition_status === 'OK') ? 'OK' : 'Defects Found'
            : 'Not Inspected';
          const allPhotoUrls: string[] = [];
          for (const item of items) {
            const { data: photosData } = await supabase.from('photos').select('*').eq('item_id', item.id);
            for (const photo of (photosData || [])) {
              if (photo.storage_url) allPhotoUrls.push(photo.storage_url);
            }
          }
          return { room_name: room.name_de || '', condition: roomCondition, comment: roomComment, photos: allPhotoUrls };
        })
      );

      const currentDate = new Date();
      const formattedCurrentDate = `${String(currentDate.getDate()).padStart(2, '0')}.${String(currentDate.getMonth() + 1).padStart(2, '0')}.${currentDate.getFullYear()}`;

      const { error: updateError } = await supabase.from('reports').update({
        user_id: user.id,
        electricity_no: electricityNo || '', electricity_val: electricityVal || '',
        gas_no: gasNo || '', gas_val: gasVal || '',
        water_no: waterNo || '', water_val: waterVal || '',
        heat_no: heatNo || '', heat_val: heatVal || '',
        keys_handed_over: keysHandedOver || '',
        is_move_in: isMoveIn, is_move_out: isMoveOut,
        tenant_signature_date: tenantSignatureDate.toISOString(),
      }).eq('id', id);

      if (updateError) { showAlert('Error', `Failed to save data: ${updateError.message}`, 'error'); return; }

      await new Promise(resolve => setTimeout(resolve, 1000));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CRAFTMYPDF_TIMEOUT);

      try {
        const response = await fetch('https://movproof-pdf-api.vercel.app/api/generate-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isPaid: isPaid,
            protocol: {
              id,
              date: formattedCurrentDate,
              tenant: { name: fetchedTenantName },
              landlord: { name: fetchedLandlordName },
              property: { address: report.address || '' },
              isMoveIn, isMoveOut,
              keysHandedOver: keysHandedOver || '',
              notes: notes || '',
              rooms: roomsWithData.map(r => ({
                name: r.room_name, condition: r.condition, notes: r.comment, photos: r.photos,
              })),
              meterReadings: [
                electricityNo ? { type: 'Strom', number: electricityNo, value: electricityVal } : null,
                gasNo ? { type: 'Gas', number: gasNo, value: gasVal } : null,
                waterNo ? { type: 'Wasser', number: waterNo, value: waterVal } : null,
                heatNo ? { type: 'Heizung', number: heatNo, value: heatVal } : null,
              ].filter(Boolean),
              landlordSignature: landlordSignatureUrl,
              tenantSignature: tenantSignatureUrl,
              witnessSignature: witnessSignatureUrl,
              witness: witnessName || '',
            }
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const responseText = await response.text();
        if (!response.ok) {
          let errorDetails = '';
          try { errorDetails = JSON.parse(responseText).message || JSON.parse(responseText).error || responseText; }
          catch { errorDetails = responseText; }
          throw new Error(errorDetails || `PDF generation failed with status ${response.status}`);
        }

        let result;
        try { result = JSON.parse(responseText); }
        catch { throw new Error('Invalid response from PDF server'); }

        const pdfUrl = result.url;
        if (!pdfUrl) throw new Error('PDF URL not found in response');

        setGeneratedPdfUrl(pdfUrl);
        setGeneratedDocSerial(`MP-${Date.now().toString(36).toUpperCase()}`);

        await supabase.from('reports').update({ pdf_url: pdfUrl, status: 'COMPLETED' }).eq('id', id);
        await new Promise(resolve => setTimeout(resolve, 1000));
        setShowSignatureModal(false);

        const canOpen = await Linking.canOpenURL(pdfUrl);
        if (canOpen) await Linking.openURL(pdfUrl);

        setTimeout(() => {
          setEmailModal(s => ({ ...s, visible: true, status: 'idle' }));
        }, 800);

      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') throw new Error('PDF generation timed out. Please try again.');
        throw fetchError;
      }

    } catch (error: any) {
      console.error('Error generating PDF:', error);
      showAlert('PDF Generation Error', error.message || 'Failed to generate PDF.', 'error');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleBackToList = () => router.back();

  const getTypeText = (type: string) => {
    if (type === 'Einzug' || type === 'move_in') return 'Einzug (Move In)';
    if (type === 'Auszug' || type === 'move_out') return 'Auszug (Move Out)';
    return type;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Stack.Screen options={{ title: "Inspection", headerStyle: { backgroundColor: colors.primary }, headerTintColor: '#FFFFFF' }} />
        <View style={[commonStyles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading inspection...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Stack.Screen options={{ title: "Inspection", headerStyle: { backgroundColor: colors.primary }, headerTintColor: '#FFFFFF' }} />
        <View style={[commonStyles.container, styles.centerContent]}>
          <IconSymbol ios_icon_name="exclamationmark.triangle" android_material_icon_name="error" size={64} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!report) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Stack.Screen options={{ title: "Inspection", headerStyle: { backgroundColor: colors.primary }, headerTintColor: '#FFFFFF' }} />
        <View style={[commonStyles.container, styles.centerContent]}>
          <Text style={styles.errorText}>Inspection not found</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: "Inspection Overview", headerStyle: { backgroundColor: colors.primary }, headerTintColor: '#FFFFFF', headerBackTitle: 'Back' }} />
      <View style={commonStyles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={commonStyles.card}>
            <Text style={styles.address}>{report.address}</Text>
            <Text style={styles.type}>{getTypeText(report.inspection_type)}</Text>
          </View>

          <TouchableOpacity style={styles.pdfButton} onPress={handleOpenFinalDetails}>
            <IconSymbol ios_icon_name="doc.fill" android_material_icon_name="description" size={24} color="#FFFFFF" />
            <Text style={styles.pdfButtonText}>Create Official Protocol</Text>
          </TouchableOpacity>

          {generatedPdfUrl ? (
{generatedPdfUrl && !isPaid ? (
            <TouchableOpacity
              style={[styles.sendEmailBtn, { backgroundColor: '#E85D26' }]}
              onPress={async () => {
                const response = await fetch('https://movproof-pdf-api.vercel.app/api/create-checkout', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    protocolId: id,
                    tenantEmail: emailModal.tenantEmail,
                    landlordEmail: emailModal.landlordEmail,
                  }),
                });
                const data = await response.json();
                if (data.url) await Linking.openURL(data.url);
              }}
              activeOpacity={0.85}>
              <Text style={styles.sendEmailBtnIcon}>🔓</Text>
              <View>
                <Text style={[styles.sendEmailBtnLabel, { color: '#FFFFFF' }]}>Protokoll freischalten / Unlock Protocol</Text>
                <Text style={[styles.sendEmailBtnSub, { color: 'rgba(255,255,255,0.8)' }]}>€2 · PDF per E-Mail an beide Parteien</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {generatedPdfUrl && isPaid ? (
            <TouchableOpacity style={styles.sendEmailBtn} onPress={() => setEmailModal(s => ({ ...s, visible: true }))} activeOpacity={0.85}>
              <Text style={styles.sendEmailBtnIcon}>✉️</Text>
              <View>
                <Text style={styles.sendEmailBtnLabel}>Send Protocol / Protokoll senden</Text>
                <Text style={styles.sendEmailBtnSub}>PDF + link · tenant & landlord</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Rooms</Text>
              <TouchableOpacity style={styles.addButton} onPress={() => setShowAddRoomModal(true)}>
                <IconSymbol ios_icon_name="plus.circle.fill" android_material_icon_name="add-circle" size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {rooms.length > 0 && (
              <ImageBackground source={{ uri: createDotMatrixPattern() }} style={styles.onboardingTip} imageStyle={{ opacity: 0.3 }}>
                <IconSymbol ios_icon_name="lightbulb.fill" android_material_icon_name="lightbulb" size={20} color={colors.primary} />
                <View style={styles.onboardingTipTextContainer}>
                  <Text style={styles.onboardingTipTextDe}>Tipp: Klicken Sie auf einen Raum, um Zustände zu protokollieren und Fotos hinzuzufügen.</Text>
                  <Text style={styles.onboardingTipTextEn}>Tip: Click on a room to log conditions and add photos.</Text>
                </View>
              </ImageBackground>
            )}

            {rooms.length === 0 && (
              <View style={styles.emptyState}>
                <IconSymbol ios_icon_name="door.left.hand.open" android_material_icon_name="meeting-room" size={48} color={colors.textSecondary} />
                <Text style={styles.emptyText}>No rooms added yet</Text>
              </View>
            )}

            {rooms.length > 0 && (
              <View style={styles.roomsList}>
                {rooms.map((room) => (
                  <TouchableOpacity key={room.id} style={styles.roomCard} onPress={() => handleOpenRoom(room.id)} activeOpacity={0.7}>
                    <View style={styles.roomCardHeader}>
                      <View style={styles.roomCardTitleContainer}>
                        <Text style={styles.roomCardTitleDe}>{room.name_de}</Text>
                        <Text style={styles.roomCardTitleEn}>{room.name_en}</Text>
                      </View>
                      <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={20} color={colors.textSecondary} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.backButton} onPress={handleBackToList}>
            <IconSymbol ios_icon_name="arrow.left" android_material_icon_name="arrow-back" size={20} color={colors.primary} />
            <Text style={styles.backButtonText}>Back to List</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Add Room Modal */}
        <Modal visible={showAddRoomModal} animationType="slide" transparent={true} onRequestClose={() => setShowAddRoomModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Room</Text>
                <TouchableOpacity onPress={() => setShowAddRoomModal(false)}>
                  <IconSymbol ios_icon_name="xmark.circle.fill" android_material_icon_name="close" size={28} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Select Room Type *</Text>
                  <View style={styles.roomPresetList}>
                    {ROOM_PRESETS.map((preset) => {
                      const isSelected = selectedRoomPreset?.nameEn === preset.nameEn;
                      return (
                        <TouchableOpacity key={preset.nameEn} style={[styles.presetButton, isSelected && styles.presetButtonActive]} onPress={() => setSelectedRoomPreset(preset)}>
                          <Text style={[styles.presetNameDe, isSelected && styles.presetNameDeActive]}>{preset.nameDe}</Text>
                          <Text style={[styles.presetNameEn, isSelected && styles.presetNameEnActive]}>{preset.nameEn}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>
              <TouchableOpacity style={[styles.modalSaveButton, (!selectedRoomPreset || savingRoom) && styles.modalSaveButtonDisabled]} onPress={handleAddRoom} disabled={!selectedRoomPreset || savingRoom}>
                {savingRoom ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.modalSaveButtonText}>Add Room</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Final Details Modal */}
        <Modal visible={showFinalDetailsModal} animationType="slide" transparent={true} onRequestClose={() => setShowFinalDetailsModal(false)}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.modalOverlay}>
              <ImageBackground source={{ uri: createDotMatrixPattern() }} style={styles.modalContent} imageStyle={{ opacity: 0.2 }}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Final Details</Text>
                  <TouchableOpacity onPress={() => setShowFinalDetailsModal(false)}>
                    <IconSymbol ios_icon_name="xmark.circle.fill" android_material_icon_name="close" size={28} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.modalScroll}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.sectionSubtitle}>Übergabetyp / Handover Type</Text>
                    <View style={styles.checkboxContainer}>
                      <TouchableOpacity style={styles.checkboxRow} onPress={() => setIsMoveIn(!isMoveIn)}>
                        <View style={[styles.checkbox, isMoveIn && styles.checkboxChecked]}>
                          {isMoveIn && <IconSymbol ios_icon_name="checkmark" android_material_icon_name="check" size={16} color="#FFFFFF" />}
                        </View>
                        <Text style={styles.checkboxLabel}>Vor dem Einzug (Move-in)</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.checkboxRow} onPress={() => setIsMoveOut(!isMoveOut)}>
                        <View style={[styles.checkbox, isMoveOut && styles.checkboxChecked]}>
                          {isMoveOut && <IconSymbol ios_icon_name="checkmark" android_material_icon_name="check" size={16} color="#FFFFFF" />}
                        </View>
                        <Text style={styles.checkboxLabel}>Vor dem Auszug (Move-out)</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.sectionSubtitle}>Zählerstände / Meter Readings</Text>
                    {[
                      { label: 'Strom (Electricity)', no: electricityNo, setNo: setElectricityNo, val: electricityVal, setVal: setElectricityVal },
                      { label: 'Gas', no: gasNo, setNo: setGasNo, val: gasVal, setVal: setGasVal },
                      { label: 'Wasser (Water)', no: waterNo, setNo: setWaterNo, val: waterVal, setVal: setWaterVal },
                      { label: 'Heizung (Heating)', no: heatNo, setNo: setHeatNo, val: heatVal, setVal: setHeatVal },
                    ].map(meter => (
                      <View key={meter.label}>
                        <Text style={styles.meterLabel}>{meter.label}</Text>
                        <View style={styles.meterRow}>
                          <View style={styles.meterInputContainer}>
                            <Text style={styles.meterInputLabel}>Zählernummer / Number</Text>
                            <TextInput style={styles.meterInput} placeholder="Number" value={meter.no} onChangeText={meter.setNo} />
                          </View>
                          <View style={styles.meterInputContainer}>
                            <Text style={styles.meterInputLabel}>Stand / Reading</Text>
                            <TextInput style={styles.meterInput} placeholder="Reading" value={meter.val} onChangeText={meter.setVal} keyboardType="numeric" />
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.sectionSubtitle}>Schlüssel / Keys</Text>
                    <TextInput style={[commonStyles.input, styles.keysInput]} placeholder="z.B. 3x Hausschlüssel, 2x Briefkasten / e.g. 3 House keys, 2 Mailbox" value={keysHandedOver} onChangeText={setKeysHandedOver} multiline numberOfLines={2} />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.sectionSubtitle}>Bemerkungen / Notes</Text>
                    <TextInput style={[commonStyles.input, styles.keysInput]} placeholder="Weitere Bemerkungen / Additional notes" value={notes} onChangeText={setNotes} multiline numberOfLines={3} />
                  </View>
                </ScrollView>
                <TouchableOpacity style={styles.modalSaveButton} onPress={handleProceedToSignatures}>
                  <Text style={styles.modalSaveButtonText}>Weiter zu Unterschriften / Proceed to Signatures</Text>
                </TouchableOpacity>
              </ImageBackground>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Signature Modal */}
        <Modal visible={showSignatureModal} animationType="slide" transparent={false} onRequestClose={handleCloseSignatureModal}>
          <SafeAreaView style={{ flex: 1, paddingTop: 8 }} edges={['top', 'bottom']}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={styles.signatureModalContainer}>
                <View style={styles.signatureModalHeader}>
                  <Text style={styles.signatureModalTitle}>Unterschriften / Signatures</Text>
                  <TouchableOpacity onPress={handleCloseSignatureModal}>
                    <IconSymbol ios_icon_name="xmark.circle.fill" android_material_icon_name="close" size={28} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.signatureScrollView} contentContainerStyle={styles.signatureScrollContent} scrollEnabled={scrollEnabled} nestedScrollEnabled={true}>
                  <View style={styles.signatureSection}>
                    <Text style={styles.signatureLabel}>Zeuge / Witness Name (optional)</Text>
                    <TextInput style={styles.meterInput} placeholder="Name des Zeugen / Witness name" value={witnessName} onChangeText={setWitnessName} />
                  </View>
                  {[
                    { label: 'Vermieter / Landlord Unterschrift', ref: landlordSignatureRef, sig: landlordSignature, setSig: setLandlordSignature, clear: handleClearLandlordSignature },
                    { label: 'Mieter / Tenant Unterschrift', ref: tenantSignatureRef, sig: tenantSignature, setSig: setTenantSignature, clear: handleClearTenantSignature },
                    { label: 'Zeuge / Witness Unterschrift (optional)', ref: witnessSignatureRef, sig: witnessSignature, setSig: setWitnessSignature, clear: handleClearWitnessSignature },
                  ].map((item) => (
                    <View key={item.label} style={styles.signatureSection}>
                      <Text style={styles.signatureLabel}>{item.label}</Text>
                      <View style={styles.signatureCanvasContainer} onStartShouldSetResponder={() => { setScrollEnabled(false); return true; }} onResponderRelease={() => setScrollEnabled(true)}>
                        <SignatureCanvas ref={item.ref} onOK={(sig) => item.setSig(sig)} onEnd={() => item.ref.current?.readSignature()} onEmpty={() => {}} descriptionText="Sign above" clearText="Clear" confirmText="Save" webStyle={`.m-signature-pad {box-shadow: none; border: 1px solid ${colors.border};} .m-signature-pad--body {border: none;} .m-signature-pad--footer {display: none;}`} style={styles.signatureCanvas} />
                      </View>
                      {item.sig && (
                        <View style={styles.signatureConfirmation}>
                          <IconSymbol ios_icon_name="checkmark.circle.fill" android_material_icon_name="check-circle" size={20} color={colors.success} />
                          <Text style={styles.signatureConfirmationText}>Unterschrift erfasst / Signature captured</Text>
                        </View>
                      )}
                      <TouchableOpacity style={styles.clearSignatureButton} onPress={item.clear}>
                        <Text style={styles.clearSignatureButtonText}>CLEAR</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <View style={styles.signatureSection}>
                    <Text style={styles.signatureLabel}>Datum / Date</Text>
                    <DateTimePicker value={tenantSignatureDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(event, selectedDate) => { if (selectedDate) setTenantSignatureDate(selectedDate); }} style={styles.datePicker} />
                    <Text style={styles.dateDisplay}>Selected: {tenantSignatureDate.toLocaleDateString('de-DE')}</Text>
                  </View>
                </ScrollView>
                <View style={styles.signatureModalFooter}>
                  <TouchableOpacity style={styles.generatePdfButton} onPress={handleGeneratePDF} disabled={generatingPDF}>
                    {generatingPDF ? (
                      <><ActivityIndicator size="small" color="#FFFFFF" /><Text style={styles.generatePdfButtonText}>Generating...</Text></>
                    ) : (
                      <><IconSymbol ios_icon_name="doc.fill" android_material_icon_name="description" size={24} color="#FFFFFF" /><Text style={styles.generatePdfButtonText}>Protokoll erstellen / Create Protocol</Text></>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>

        {/* Email Modal */}
        <Modal visible={emailModal.visible} transparent animationType="slide" onRequestClose={() => setEmailModal(s => ({ ...s, visible: false, status: 'idle' }))}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.modalOverlay}>
              <View style={styles.emailModalCard}>
                <View style={styles.emailModalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.emailModalTitle}>Send Protocol</Text>
                    <Text style={styles.emailModalTitleDE}>Protokoll senden</Text>
                  </View>
                  <TouchableOpacity style={styles.emailModalClose} onPress={() => setEmailModal(s => ({ ...s, visible: false, status: 'idle' }))}>
                    <Text style={styles.emailModalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.emailDivider} />
                {emailModal.status === 'success' ? (
                  <View style={styles.emailSuccessContainer}>
                    <Text style={styles.emailSuccessIcon}>✓</Text>
                    <Text style={styles.emailSuccessTitle}>Sent! / Gesendet!</Text>
                    <Text style={styles.emailSuccessSub}>PDF + link sent to both parties.{'\n'}PDF + Link an beide Parteien gesendet.</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.emailInfoRow}>
                      <View style={styles.emailChip}><Text style={styles.emailChipText}>📎 PDF attached</Text></View>
                      <View style={styles.emailChip}><Text style={styles.emailChipText}>🔗 Link included</Text></View>
                      <View style={styles.emailChip}><Text style={styles.emailChipText}>🇩🇪 🇬🇧 Bilingual</Text></View>
                    </View>
                    <View style={styles.emailFieldGroup}>
                      <Text style={styles.emailFieldLabel}>Tenant / Mieter</Text>
                      <TextInput style={styles.emailInput} placeholder="tenant@email.com" placeholderTextColor="#C9920A" value={emailModal.tenantEmail} onChangeText={v => setEmailModal(s => ({ ...s, tenantEmail: v, errorMsg: '' }))} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                    </View>
                    <View style={styles.emailFieldGroup}>
                      <Text style={styles.emailFieldLabel}>Landlord / Vermieter</Text>
                      <TextInput style={styles.emailInput} placeholder="landlord@email.com" placeholderTextColor="#C9920A" value={emailModal.landlordEmail} onChangeText={v => setEmailModal(s => ({ ...s, landlordEmail: v, errorMsg: '' }))} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                    </View>
                    {emailModal.errorMsg ? <Text style={styles.emailError}>{emailModal.errorMsg}</Text> : null}
                    <TouchableOpacity style={[styles.emailSendBtn, emailModal.status === 'sending' && styles.emailSendBtnDisabled]} onPress={sendProtocolEmail} disabled={emailModal.status === 'sending'} activeOpacity={0.85}>
                      {emailModal.status === 'sending' ? <ActivityIndicator color="#4A3008" /> : <Text style={styles.emailSendBtnText}>Send to both / An beide senden →</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setEmailModal(s => ({ ...s, visible: false, status: 'idle' }))} style={styles.emailCancelBtn}>
                      <Text style={styles.emailCancelText}>Cancel / Abbrechen</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <AlertModal visible={alertVisible} title={alertTitle} message={alertMessage} type={alertType} onClose={() => setAlertVisible(false)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  signatureSafeArea: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  centerContent: { justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { fontSize: 16, color: colors.textSecondary, marginTop: 12 },
  errorText: { fontSize: 16, color: colors.error, textAlign: 'center', marginTop: 12, marginBottom: 20 },
  retryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 0 },
  retryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  address: { fontSize: 20, fontWeight: '600', color: colors.text, marginBottom: 4 },
  type: { fontSize: 16, color: colors.textSecondary },
  pdfButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.primary, paddingVertical: 18, paddingHorizontal: 24, borderRadius: 0, marginTop: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  pdfButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  sendEmailBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F2C12E', borderRadius: 0, padding: 16, marginTop: 12 },
  sendEmailBtnIcon: { fontSize: 22 },
  sendEmailBtnLabel: { fontSize: 15, fontWeight: '700', color: '#4A3008' },
  sendEmailBtnSub: { fontSize: 11, color: '#8C5E04', marginTop: 2 },
  section: { marginTop: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 22, fontWeight: '600', color: colors.text },
  addButton: { padding: 4 },
  onboardingTip: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#FFF9E6', borderLeftWidth: 4, borderLeftColor: colors.primary, padding: 12, marginBottom: 16, borderRadius: 0, overflow: 'hidden' },
  onboardingTipTextContainer: { flex: 1 },
  onboardingTipTextDe: { fontSize: 14, color: '#8B6914', lineHeight: 20, fontWeight: '600', marginBottom: 4 },
  onboardingTipTextEn: { fontSize: 13, color: '#A0825A', lineHeight: 18, fontStyle: 'italic' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, backgroundColor: colors.card, borderRadius: 0, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  emptyText: { fontSize: 14, color: colors.textSecondary, marginTop: 12 },
  roomsList: { gap: 12 },
  roomCard: { backgroundColor: colors.card, borderRadius: 0, padding: 16, borderWidth: 1, borderColor: colors.border },
  roomCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roomCardTitleContainer: { flex: 1 },
  roomCardTitleDe: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 2 },
  roomCardTitleEn: { fontSize: 14, color: colors.textSecondary },
  backButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.card, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 0, marginTop: 24, borderWidth: 2, borderColor: colors.primary },
  backButtonText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 20, paddingBottom: 40, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, flex: 1 },
  modalScroll: { paddingHorizontal: 20, maxHeight: 500 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  roomPresetList: { gap: 12 },
  presetButton: { paddingVertical: 16, paddingHorizontal: 16, borderRadius: 0, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card },
  presetButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  presetNameDe: { fontSize: 16, fontWeight: '600', color: colors.text },
  presetNameDeActive: { color: '#FFFFFF' },
  presetNameEn: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  presetNameEnActive: { color: 'rgba(255, 255, 255, 0.8)' },
  modalSaveButton: { backgroundColor: colors.primary, borderRadius: 0, paddingVertical: 16, paddingHorizontal: 24, marginHorizontal: 20, marginTop: 20, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  modalSaveButtonDisabled: { backgroundColor: colors.textSecondary, opacity: 0.5 },
  modalSaveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  sectionSubtitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 12 },
  checkboxContainer: { gap: 12 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: { width: 24, height: 24, borderWidth: 2, borderColor: colors.border, borderRadius: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxLabel: { fontSize: 16, color: colors.text },
  meterLabel: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 16, marginBottom: 8 },
  meterRow: { flexDirection: 'row', gap: 12 },
  meterInputContainer: { flex: 1 },
  meterInputLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  meterInput: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 0, paddingVertical: 10, paddingHorizontal: 12, fontSize: 14, color: colors.text },
  keysInput: { minHeight: 60, textAlignVertical: 'top' },
  signatureModalContainer: { flex: 1, backgroundColor: colors.background },
  signatureModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card },
  signatureModalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  signatureScrollView: { flex: 1 },
  signatureScrollContent: { padding: 20, paddingBottom: 40 },
  signatureSection: { marginBottom: 32 },
  signatureLabel: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 12 },
  signatureCanvasContainer: { height: 200, borderWidth: 2, borderColor: colors.border, borderRadius: 0, backgroundColor: colors.card, overflow: 'hidden' },
  signatureCanvas: { flex: 1 },
  signatureConfirmation: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  signatureConfirmationText: { fontSize: 14, color: colors.success, fontWeight: '600' },
  clearSignatureButton: { marginTop: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 0, backgroundColor: colors.primary, alignItems: 'center' },
  clearSignatureButtonText: { fontSize: 16, color: '#FFFFFF', fontWeight: '700' },
  datePicker: { width: '100%', backgroundColor: colors.card },
  dateDisplay: { fontSize: 16, color: colors.text, marginTop: 12, padding: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 0 },
  signatureModalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  generatePdfButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#E85D26', paddingVertical: 18, paddingHorizontal: 24, borderRadius: 0 },
  generatePdfButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  emailModalCard: { backgroundColor: '#F7F2E8', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  emailModalHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  emailModalTitle: { fontSize: 20, fontWeight: '700', color: '#4A3008' },
  emailModalTitleDE: { fontSize: 13, color: '#8C5E04', marginTop: 2 },
  emailModalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0E4C0', alignItems: 'center', justifyContent: 'center' },
  emailModalCloseText: { fontSize: 14, color: '#8C5E04' },
  emailDivider: { height: 2, backgroundColor: '#F2C12E', borderRadius: 1, marginBottom: 20 },
  emailInfoRow: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  emailChip: { backgroundColor: '#F0E4C0', borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10 },
  emailChipText: { fontSize: 11, fontWeight: '600', color: '#4A3008' },
  emailFieldGroup: { marginBottom: 14 },
  emailFieldLabel: { fontSize: 12, fontWeight: '700', color: '#C9920A', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  emailInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8D49A', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, fontSize: 15, color: '#4A3008' },
  emailError: { fontSize: 13, color: colors.error, marginBottom: 12, lineHeight: 18 },
  emailSendBtn: { backgroundColor: '#F2C12E', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  emailSendBtnDisabled: { opacity: 0.6 },
  emailSendBtnText: { fontSize: 16, fontWeight: '700', color: '#4A3008' },
  emailCancelBtn: { alignItems: 'center', paddingTop: 14 },
  emailCancelText: { fontSize: 13, color: '#8C5E04' },
  emailSuccessContainer: { alignItems: 'center', paddingVertical: 24 },
  emailSuccessIcon: { fontSize: 48, marginBottom: 12 },
  emailSuccessTitle: { fontSize: 22, fontWeight: '700', color: '#4A3008', marginBottom: 8 },
  emailSuccessSub: { fontSize: 13, color: '#8C5E04', textAlign: 'center', lineHeight: 20 },
});
