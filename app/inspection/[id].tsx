
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect, useRef } from "react";
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
  Platform,
} from "react-native";
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { colors, commonStyles } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { authenticatedGet, authenticatedPost, authenticatedPut, authenticatedDelete } from "@/utils/api";
import { ConfirmModal, AlertModal } from "@/components/ui/Modal";
import { supabase } from "@/app/integrations/supabase/client";

// Room preset list with English and German names
const ROOM_PRESETS = [
  { nameEn: 'Living Room', nameDe: 'Wohnzimmer' },
  { nameEn: 'Kitchen', nameDe: 'Küche' },
  { nameEn: 'Bathroom', nameDe: 'Bad' },
  { nameEn: 'Bedroom', nameDe: 'Schlafzimmer' },
  { nameEn: 'Hallway', nameDe: 'Flur' },
];

// Room item presets
const ROOM_ITEMS = ['Walls', 'Floor', 'Windows', 'Ceiling', 'Doors'];

// Status options
const STATUS_OPTIONS = ['OK', 'Defect', 'Wear & Tear'];

interface RoomItem {
  id: string;
  roomId: string;
  itemName: string;
  status: string;
  notes?: string;
  photoUrl?: string;
  photoLatitude?: number;
  photoLongitude?: number;
  photoTimestamp?: string;
}

interface Room {
  id: string;
  nameEn: string;
  nameDe: string;
  items: RoomItem[];
}

interface Report {
  id: string;
  address: string;
  inspection_type: string;
  status: string;
  created_at: string;
}

export default function InspectionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Room modal state
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [selectedRoomPreset, setSelectedRoomPreset] = useState<typeof ROOM_PRESETS[0] | null>(null);
  
  // Room item modal state
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('OK');
  const [itemNotes, setItemNotes] = useState('');
  
  // Camera state
  const [showCamera, setShowCamera] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [photoLocation, setPhotoLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [photoTimestamp, setPhotoTimestamp] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  
  // Alert modal
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

  // CRITICAL FIX: Only fetch if ID is present, with retry button on error
  useEffect(() => {
    let isMounted = true;

    const loadInspection = async () => {
      // CRITICAL FIX: Only fetch if ID is present
      if (!id) {
        console.log('InspectionDetailScreen: No ID provided');
        return;
      }

      console.log('InspectionDetailScreen: Loading inspection for ID:', id);
      setLoading(true);
      setError(null);
      setReport(null);

      // CRITICAL FIX: 1-second delay to give Supabase time to index new reports
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (!isMounted) return;

      try {
        const { data, error: fetchError } = await supabase
          .from('reports')
          .select('*')
          .eq('id', id)
          .single();

        if (!isMounted) return;

        if (fetchError) {
          console.error('InspectionDetailScreen: Supabase error:', {
            message: fetchError.message,
            details: fetchError.details,
            hint: fetchError.hint,
            code: fetchError.code,
          });

          // CRITICAL FIX: Check for "Not Found" error specifically
          if (fetchError.code === 'PGRST116') {
            setError('Inspection not found. It may have been deleted or you may not have access to it.');
          } else {
            setError(`Failed to load inspection: ${fetchError.message}`);
          }
        } else if (data) {
          console.log('InspectionDetailScreen: Report loaded successfully');
          setReport(data);
        } else {
          setError('Inspection not found.');
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error('InspectionDetailScreen: Unexpected error:', err);
        setError(`An unexpected error occurred: ${err.message}`);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadInspection();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleRetry = () => {
    console.log('InspectionDetailScreen: User tapped Retry button');
    setError(null);
    setLoading(true);
    
    // Trigger re-fetch by updating a dummy state
    const loadInspection = async () => {
      if (!id) return;

      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        const { data, error: fetchError } = await supabase
          .from('reports')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError) {
          console.error('InspectionDetailScreen: Retry - Supabase error:', fetchError);
          if (fetchError.code === 'PGRST116') {
            setError('Inspection not found. It may have been deleted or you may not have access to it.');
          } else {
            setError(`Failed to load inspection: ${fetchError.message}`);
          }
        } else if (data) {
          console.log('InspectionDetailScreen: Retry - Report loaded successfully');
          setReport(data);
          setError(null);
        } else {
          setError('Inspection not found.');
        }
      } catch (err: any) {
        console.error('InspectionDetailScreen: Retry - Unexpected error:', err);
        setError(`An unexpected error occurred: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadInspection();
  };

  const handleAddRoom = async () => {
    console.log('User tapped Add Room button');
    
    if (!selectedRoomPreset) {
      console.log('Validation failed: Room preset is required');
      showAlert('Validation Error', 'Please select a room type', 'error');
      return;
    }

    try {
      console.log('Adding room:', selectedRoomPreset);
      const response = await authenticatedPost<Room>(`/api/inspections/${id}/rooms`, { 
        nameEn: selectedRoomPreset.nameEn,
        nameDe: selectedRoomPreset.nameDe,
      });
      
      setShowAddRoomModal(false);
      setSelectedRoomPreset(null);
      console.log('Room added successfully');
      showAlert('Success', 'Room added successfully', 'success');
    } catch (error) {
      console.error('Error adding room:', error);
      showAlert('Error', 'Failed to add room. Please try again.', 'error');
    }
  };

  const handleOpenCamera = async () => {
    console.log('User tapped Take Photo button');
    
    if (!cameraPermission) {
      console.log('Camera permission not loaded yet');
      return;
    }

    if (!cameraPermission.granted) {
      console.log('Requesting camera permission');
      const result = await requestCameraPermission();
      if (!result.granted) {
        console.log('Camera permission denied');
        showAlert('Permission Required', 'Camera permission is required to take photos', 'error');
        return;
      }
    }

    // Request location permission
    console.log('Requesting location permission');
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('Location permission denied');
      showAlert('Permission Required', 'Location permission is required for legal proof', 'error');
      return;
    }

    setShowCamera(true);
  };

  const handleTakePhoto = async () => {
    console.log('Capturing photo');
    
    if (!cameraRef.current) {
      console.log('Camera ref not available');
      return;
    }

    try {
      // Capture photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });

      if (!photo) {
        console.log('Failed to capture photo');
        return;
      }

      console.log('Photo captured:', photo.uri);

      // Get GPS coordinates
      console.log('Getting GPS coordinates');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      // Get current timestamp in ISO 8601 format
      const timestamp = new Date().toISOString();

      console.log('GPS coordinates:', coords);
      console.log('Timestamp:', timestamp);

      setCapturedPhoto(photo.uri);
      setPhotoLocation(coords);
      setPhotoTimestamp(timestamp);
      setShowCamera(false);

      showAlert('Success', 'Photo captured with GPS and timestamp', 'success');
    } catch (error) {
      console.error('Error capturing photo:', error);
      showAlert('Error', 'Failed to capture photo. Please try again.', 'error');
    }
  };

  const handleAddRoomItem = async () => {
    console.log('User tapped Add Condition button');
    
    if (!selectedRoom || !selectedItem || !selectedStatus) {
      console.log('Validation failed: All fields are required');
      showAlert('Validation Error', 'Please fill in all required fields', 'error');
      return;
    }

    try {
      console.log('Adding room item:', { selectedItem, selectedStatus, itemNotes, capturedPhoto, photoLocation, photoTimestamp });
      const response = await authenticatedPost<RoomItem>(`/api/rooms/${selectedRoom.id}/items`, { 
        itemName: selectedItem,
        status: selectedStatus,
        notes: itemNotes || undefined,
        photoUrl: capturedPhoto || undefined,
        photoLatitude: photoLocation?.latitude,
        photoLongitude: photoLocation?.longitude,
        photoTimestamp: photoTimestamp || undefined,
      });
      
      setShowAddItemModal(false);
      setSelectedRoom(null);
      setSelectedItem('');
      setSelectedStatus('OK');
      setItemNotes('');
      setCapturedPhoto(null);
      setPhotoLocation(null);
      setPhotoTimestamp(null);
      console.log('Room item added successfully');
      showAlert('Success', 'Condition logged successfully', 'success');
    } catch (error) {
      console.error('Error adding room item:', error);
      showAlert('Error', 'Failed to log condition. Please try again.', 'error');
    }
  };

  const getTypeText = (type: string) => {
    if (type === 'Einzug') return 'Einzug (Move In)';
    if (type === 'Auszug') return 'Auszug (Move Out)';
    if (type === 'move_in') return 'Einzug (Move In)';
    if (type === 'move_out') return 'Auszug (Move Out)';
    return type;
  };

  // CRITICAL FIX: Show loading state
  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Inspection",
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: '#FFFFFF',
            headerBackTitle: 'Back',
          }}
        />
        <View style={[commonStyles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading inspection...</Text>
        </View>
      </>
    );
  }

  // CRITICAL FIX: Show error with Retry button
  if (error) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Inspection",
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: '#FFFFFF',
            headerBackTitle: 'Back',
          }}
        />
        <View style={[commonStyles.container, styles.centerContent]}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle"
            android_material_icon_name="error"
            size={64}
            color={colors.error}
          />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <IconSymbol
              ios_icon_name="arrow.clockwise"
              android_material_icon_name="refresh"
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  if (!report) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Inspection",
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: '#FFFFFF',
            headerBackTitle: 'Back',
          }}
        />
        <View style={[commonStyles.container, styles.centerContent]}>
          <Text style={styles.errorText}>Inspection not found</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <IconSymbol
              ios_icon_name="arrow.clockwise"
              android_material_icon_name="refresh"
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  const typeText = getTypeText(report.inspection_type);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Inspection Overview",
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: '#FFFFFF',
          headerBackTitle: 'Back',
        }}
      />
      <View style={commonStyles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={commonStyles.card}>
            <Text style={styles.address}>{report.address}</Text>
            <Text style={styles.type}>{typeText}</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Rooms</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  console.log('User tapped Add Room button');
                  setShowAddRoomModal(true);
                }}
              >
                <IconSymbol
                  ios_icon_name="plus.circle.fill"
                  android_material_icon_name="add-circle"
                  size={24}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="door.left.hand.open"
                android_material_icon_name="meeting-room"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyText}>No rooms added yet</Text>
            </View>
          </View>
        </ScrollView>

        {/* Add Room Modal */}
        <Modal
          visible={showAddRoomModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAddRoomModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Room</Text>
                <TouchableOpacity onPress={() => setShowAddRoomModal(false)}>
                  <IconSymbol
                    ios_icon_name="xmark.circle.fill"
                    android_material_icon_name="close"
                    size={28}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Select Room Type *</Text>
                  <View style={styles.roomPresetList}>
                    {ROOM_PRESETS.map((preset) => (
                      <TouchableOpacity
                        key={preset.nameEn}
                        style={[
                          styles.presetButton,
                          selectedRoomPreset?.nameEn === preset.nameEn && styles.presetButtonActive,
                        ]}
                        onPress={() => {
                          console.log('User selected room preset:', preset.nameDe);
                          setSelectedRoomPreset(preset);
                        }}
                      >
                        <Text style={styles.presetNameDe}>{preset.nameDe}</Text>
                        <Text style={styles.presetNameEn}>{preset.nameEn}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>

              <TouchableOpacity
                style={[
                  styles.modalSaveButton,
                  !selectedRoomPreset && styles.modalSaveButtonDisabled,
                ]}
                onPress={handleAddRoom}
                disabled={!selectedRoomPreset}
              >
                <Text style={styles.modalSaveButtonText}>Add Room</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Camera Modal */}
        <Modal
          visible={showCamera}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowCamera(false)}
        >
          <View style={styles.cameraContainer}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="back"
            />
            <View style={styles.cameraControls}>
              <TouchableOpacity
                style={styles.cancelCameraButton}
                onPress={() => setShowCamera(false)}
              >
                <Text style={styles.cancelCameraText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.captureButton}
                onPress={handleTakePhoto}
              >
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
              <View style={styles.cancelCameraButton} />
            </View>
          </View>
        </Modal>

        <AlertModal
          visible={alertVisible}
          title={alertTitle}
          message={alertMessage}
          type={alertType}
          onClose={() => setAlertVisible(false)}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 12,
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  address: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  type: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.text,
  },
  addButton: {
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '90%',
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
    color: colors.text,
    flex: 1,
  },
  modalScroll: {
    paddingHorizontal: 20,
    maxHeight: 500,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  roomPresetList: {
    gap: 12,
  },
  presetButton: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  presetButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  presetNameDe: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  presetNameEn: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalSaveButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginHorizontal: 20,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveButtonDisabled: {
    backgroundColor: colors.textSecondary,
    opacity: 0.5,
  },
  modalSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  cancelCameraButton: {
    width: 80,
  },
  cancelCameraText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
});
