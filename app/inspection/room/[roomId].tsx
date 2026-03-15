import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { colors, commonStyles } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { AlertModal } from "@/components/ui/Modal";
import { supabase } from "@/app/integrations/supabase/client";
import { SafeAreaView } from 'react-native-safe-area-context';

const ROOM_ITEMS = [
  { nameEn: 'Walls', nameDe: 'Wände' },
  { nameEn: 'Floor', nameDe: 'Boden' },
  { nameEn: 'Windows', nameDe: 'Fenster' },
  { nameEn: 'Ceiling', nameDe: 'Decke' },
  { nameEn: 'Doors', nameDe: 'Türen' },
];

const conditionColors: Record<string, string> = {
  'OK': '#22C55E',
  'Defect': '#EF4444',
  'Wear & Tear': '#F59E0B',
};

interface Room {
  id: string;
  report_id: string;
  name_en: string;
  name_de: string;
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

interface ItemState {
  dbItem: RoomItem | null;
  condition: string;
  notes: string;
  saving: boolean;
}

export default function RoomDetailScreen() {
  const router = useRouter();
  const { roomId } = useLocalSearchParams();
  const [room, setRoom] = useState<Room | null>(null);
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCamera, setShowCamera] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [photoLocation, setPhotoLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [currentItemKey, setCurrentItemKey] = useState<string | null>(null);

  const cameraRef = useRef<CameraView>(null);

  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState('');

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'info' | 'error' | 'success'>('info');

  const showAlert = (title: string, message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setAlertTitle(title); setAlertMessage(message); setAlertType(type); setAlertVisible(true);
  };

  const fetchRoomData = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const { data: roomData, error: roomError } = await supabase.from('rooms').select('*').eq('id', roomId).single();
      if (roomError) { setError(`Failed to load room: ${roomError.message}`); return; }
      setRoom(roomData);

      const { data: itemsData } = await supabase.from('room_items').select('*').eq('room_id', roomId);
      const items = itemsData || [];

      const states: Record<string, ItemState> = {};
      for (const preset of ROOM_ITEMS) {
        const dbItem = items.find(i => i.item_name_en === preset.nameEn) || null;
        states[preset.nameEn] = {
          dbItem,
          condition: dbItem?.condition_status || 'OK',
          notes: dbItem?.notes || '',
          saving: false,
        };
      }
      setItemStates(states);

      if (items.length > 0) {
        const { data: photosData } = await supabase.from('photos').select('*').in('item_id', items.map(i => i.id));
        setPhotos(photosData || []);
      } else {
        setPhotos([]);
      }
    } catch (err: any) {
      setError(`An unexpected error occurred: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => { fetchRoomData(); }, [fetchRoomData]);

  const handleConditionChange = async (presetNameEn: string, condition: string) => {
    if (!roomId) return;
    const preset = ROOM_ITEMS.find(p => p.nameEn === presetNameEn)!;
    const state = itemStates[presetNameEn];

    setItemStates(prev => ({ ...prev, [presetNameEn]: { ...prev[presetNameEn], condition, saving: true } }));

    try {
      if (state.dbItem) {
        await supabase.from('room_items').update({
          condition_status: condition,
          requires_repair: condition === 'Defect',
        }).eq('id', state.dbItem.id);
        setItemStates(prev => ({
          ...prev,
          [presetNameEn]: { ...prev[presetNameEn], condition, saving: false, dbItem: { ...prev[presetNameEn].dbItem!, condition_status: condition } }
        }));
      } else {
        const { data: newItem } = await supabase.from('room_items').insert([{
          room_id: roomId,
          item_name_en: preset.nameEn,
          item_name_de: preset.nameDe,
          condition_status: condition,
          notes: state.notes || null,
          requires_repair: condition === 'Defect',
        }]).select().single();
        setItemStates(prev => ({
          ...prev,
          [presetNameEn]: { ...prev[presetNameEn], condition, saving: false, dbItem: newItem }
        }));
      }
    } catch (err: any) {
      showAlert('Error', `Failed to save: ${err.message}`, 'error');
      setItemStates(prev => ({ ...prev, [presetNameEn]: { ...prev[presetNameEn], saving: false } }));
    }
  };

  const handleNotesChange = (presetNameEn: string, notes: string) => {
    setItemStates(prev => ({ ...prev, [presetNameEn]: { ...prev[presetNameEn], notes } }));
  };

  const handleNotesSave = async (presetNameEn: string) => {
    const state = itemStates[presetNameEn];
    if (!state.dbItem || !roomId) return;
    try {
      await supabase.from('room_items').update({ notes: state.notes || null }).eq('id', state.dbItem.id);
    } catch (err: any) {
      showAlert('Error', `Failed to save notes: ${err.message}`, 'error');
    }
  };

  const handleOpenCamera = async (presetNameEn: string) => {
    const state = itemStates[presetNameEn];
    let itemId = state.dbItem?.id;

    if (!itemId && roomId) {
      const preset = ROOM_ITEMS.find(p => p.nameEn === presetNameEn)!;
      const { data: newItem } = await supabase.from('room_items').insert([{
        room_id: roomId,
        item_name_en: preset.nameEn,
        item_name_de: preset.nameDe,
        condition_status: state.condition,
        notes: state.notes || null,
        requires_repair: state.condition === 'Defect',
      }]).select().single();
      if (newItem) {
        itemId = newItem.id;
        setItemStates(prev => ({ ...prev, [presetNameEn]: { ...prev[presetNameEn], dbItem: newItem } }));
      }
    }

    if (!itemId) return;
    setCurrentItemKey(presetNameEn);

    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) { showAlert('Permission Required', 'Camera permission is required.', 'error'); return; }
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { showAlert('Permission Required', 'Location permission is required.', 'error'); return; }

    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then(loc => setPhotoLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude }))
      .catch(() => setPhotoLocation(null));

    setShowCamera(true);
  };

  const handleTakePhoto = async () => {
    if (!cameraRef.current || !currentItemKey) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.3, base64: false });
      if (!photo) return;
      const timestamp = new Date().toISOString();
      setShowCamera(false);

      const state = itemStates[currentItemKey];
      const itemId = state.dbItem?.id;
      if (!itemId || !room) return;

      setUploadingPhoto(true);
      const base64Data = await FileSystem.readAsStringAsync(photo.uri, { encoding: FileSystem.EncodingType.Base64 });
      const arrayBuffer = decode(base64Data);
      const filePath = `${room.report_id}/${room.id}/room_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage.from('inspection-photos').upload(filePath, arrayBuffer, { contentType: 'image/jpeg', upsert: false });
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const { data: urlData } = supabase.storage.from('inspection-photos').getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      await supabase.from('photos').insert([{
        item_id: itemId,
        storage_url: publicUrl,
        gps_coords: photoLocation || { latitude: 0, longitude: 0 },
        timestamp_verified: timestamp,
      }]);

      await fetchRoomData();
      showAlert('Success', 'Photo saved!', 'success');
    } catch (err: any) {
      showAlert('Error', `Failed to save photo: ${err.message}`, 'error');
    } finally {
      setUploadingPhoto(false);
      setCurrentItemKey(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Stack.Screen options={{ title: "Room", headerStyle: { backgroundColor: colors.primary }, headerTintColor: '#FFFFFF' }} />
        <View style={[commonStyles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !room) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Stack.Screen options={{ title: "Room", headerStyle: { backgroundColor: colors.primary }, headerTintColor: '#FFFFFF' }} />
        <View style={[commonStyles.container, styles.centerContent]}>
          <Text style={styles.errorText}>{error || 'Room not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: room.name_de, headerStyle: { backgroundColor: colors.primary }, headerTintColor: '#FFFFFF', headerBackTitle: 'Back' }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <View style={commonStyles.container}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={commonStyles.card}>
              <Text style={styles.roomNameDe}>{room.name_de}</Text>
              <Text style={styles.roomNameEn}>{room.name_en}</Text>
            </View>

            {ROOM_ITEMS.map((preset) => {
              const state = itemStates[preset.nameEn] || { condition: 'OK', notes: '', saving: false, dbItem: null };
              const itemPhotos = state.dbItem ? photos.filter(p => p.item_id === state.dbItem!.id) : [];
              const isDefect = state.condition !== 'OK';

              return (
                <View key={preset.nameEn} style={[styles.itemCard, isDefect && styles.itemCardDefect]}>
                  <View style={styles.itemHeader}>
                    <View>
                      <Text style={styles.itemNameDe}>{preset.nameDe}</Text>
                      <Text style={styles.itemNameEn}>{preset.nameEn}</Text>
                    </View>
                    {state.saving && <ActivityIndicator size="small" color={colors.primary} />}
                  </View>

                  <View style={styles.conditionRow}>
                    {['OK', 'Defect', 'Wear & Tear'].map(c => {
                      const isActive = state.condition === c;
                      return (
                        <TouchableOpacity
                          key={c}
                          style={[
                            styles.conditionBtn,
                            isActive && { backgroundColor: conditionColors[c], borderColor: conditionColors[c] }
                          ]}
                          onPress={() => handleConditionChange(preset.nameEn, c)}
                        >
                          <Text style={[styles.conditionBtnText, isActive && styles.conditionBtnTextActive]}>
                            {c === 'Wear & Tear' ? 'Wear' : c}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {state.condition !== 'OK' && (
                    <TextInput
                      style={styles.notesInput}
                      placeholder="Bemerkungen / Notes..."
                      placeholderTextColor={colors.textSecondary}
                      value={state.notes}
                      onChangeText={(t) => handleNotesChange(preset.nameEn, t)}
                      onBlur={() => handleNotesSave(preset.nameEn)}
                      multiline
                    />
                  )}

                  <TouchableOpacity
                    style={styles.photoBtn}
                    onPress={() => handleOpenCamera(preset.nameEn)}
                    disabled={uploadingPhoto}
                  >
                    <IconSymbol ios_icon_name="camera.fill" android_material_icon_name="camera" size={18} color="#FFFFFF" />
                    <Text style={styles.photoBtnText}>
                      {itemPhotos.length > 0 ? `${itemPhotos.length} Foto(s) — Add More` : 'Foto aufnehmen / Take Photo'}
                    </Text>
                  </TouchableOpacity>

                  {itemPhotos.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
                      {itemPhotos.map(photo => (
                        <TouchableOpacity key={photo.id} onPress={() => { setLightboxImageUrl(photo.storage_url); setLightboxVisible(true); }}>
                          <Image source={{ uri: photo.storage_url }} style={styles.thumbnail} resizeMode="cover" />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              );
            })}

            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <IconSymbol ios_icon_name="arrow.left" android_material_icon_name="arrow-back" size={20} color={colors.primary} />
              <Text style={styles.backButtonText}>Back to Inspection</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Camera Modal */}
          <Modal visible={showCamera} animationType="slide" transparent={false} onRequestClose={() => setShowCamera(false)}>
            <View style={styles.cameraContainer}>
              <CameraView ref={cameraRef} style={styles.camera} facing="back" />
              <View style={styles.cameraControls}>
                <TouchableOpacity style={styles.cancelCameraButton} onPress={() => setShowCamera(false)}>
                  <Text style={styles.cancelCameraText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.captureButton} onPress={handleTakePhoto}>
                  <View style={styles.captureButtonInner} />
                </TouchableOpacity>
                <View style={{ width: 80 }} />
              </View>
            </View>
          </Modal>

          <Modal visible={uploadingPhoto} transparent={true} animationType="fade">
            <View style={styles.uploadOverlay}>
              <View style={styles.uploadModal}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.uploadText}>Saving photo...</Text>
              </View>
            </View>
          </Modal>

          <Modal visible={lightboxVisible} transparent={true} animationType="fade" onRequestClose={() => setLightboxVisible(false)}>
            <View style={styles.lightboxOverlay}>
              <TouchableOpacity style={styles.lightboxCloseButton} onPress={() => setLightboxVisible(false)}>
                <IconSymbol ios_icon_name="xmark.circle.fill" android_material_icon_name="close" size={36} color="#FFFFFF" />
              </TouchableOpacity>
              <Image source={{ uri: lightboxImageUrl }} style={styles.lightboxImage} resizeMode="contain" />
            </View>
          </Modal>

          <AlertModal visible={alertVisible} title={alertTitle} message={alertMessage} type={alertType} onClose={() => setAlertVisible(false)} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32, gap: 12 },
  centerContent: { justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { fontSize: 16, color: colors.textSecondary, marginTop: 12 },
  errorText: { fontSize: 16, color: colors.error, textAlign: 'center', marginTop: 12 },
  roomNameDe: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 4 },
  roomNameEn: { fontSize: 16, color: colors.textSecondary },
  itemCard: { backgroundColor: colors.card, borderRadius: 0, padding: 16, borderWidth: 1, borderColor: colors.border },
  itemCardDefect: { borderColor: '#EF4444', borderLeftWidth: 4 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  itemNameDe: { fontSize: 17, fontWeight: '700', color: colors.text },
  itemNameEn: { fontSize: 13, color: colors.textSecondary, marginTop: 1 },
  conditionRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  conditionBtn: { flex: 1, paddingVertical: 10, borderRadius: 0, borderWidth: 2, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.background },
  conditionBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  conditionBtnTextActive: { color: '#FFFFFF' },
  notesInput: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 0, padding: 10, fontSize: 14, color: colors.text, minHeight: 60, textAlignVertical: 'top', marginBottom: 10 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, paddingVertical: 10, borderRadius: 0, marginTop: 4 },
  photoBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  photoScroll: { marginTop: 10 },
  thumbnail: { width: 80, height: 80, borderRadius: 0, marginRight: 8, borderWidth: 1, borderColor: colors.border },
  backButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.card, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 0, marginTop: 8, borderWidth: 2, borderColor: colors.primary },
  backButtonText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraControls: { position: 'absolute', bottom: 40, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 40 },
  cancelCameraButton: { width: 80 },
  cancelCameraText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  captureButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.5)' },
  captureButtonInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFFFF' },
  uploadOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  uploadModal: { backgroundColor: colors.card, borderRadius: 16, padding: 32, alignItems: 'center' },
  uploadText: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 12 },
  lightboxOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  lightboxCloseButton: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
  lightboxImage: { width: '100%', height: '100%' },
});