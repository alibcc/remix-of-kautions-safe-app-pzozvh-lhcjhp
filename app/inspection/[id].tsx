
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

interface Inspection {
  id: string;
  propertyAddress: string;
  inspectionType: string;
  status: string;
  rooms: Room[];
  createdAt: string;
}

export default function InspectionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);
  
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

  useEffect(() => {
    console.log('InspectionDetailScreen mounted for inspection:', id);
    loadInspection();
  }, [id]);

  const loadInspection = async () => {
    try {
      console.log('Fetching inspection details from backend');
      const response = await authenticatedGet<Inspection>(`/api/inspections/${id}`);
      setInspection(response);
      console.log('Inspection loaded successfully');
    } catch (error) {
      console.error('Error loading inspection:', error);
      setInspection(null);
    } finally {
      setLoading(false);
    }
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
      setInspection(prev => prev ? { ...prev, rooms: [...prev.rooms, response] } : null);
      
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

      // Update the inspection state with the new item
      setInspection(prev => {
        if (!prev) return null;
        return {
          ...prev,
          rooms: prev.rooms.map(room => 
            room.id === selectedRoom.id 
              ? { ...room, items: [...room.items, response] }
              : room
          ),
        };
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
    if (type === 'move_in') return 'Einzug (Move In)';
    if (type === 'move_out') return 'Auszug (Move Out)';
    return type;
  };

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
        </View>
      </>
    );
  }

  if (!inspection) {
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
        </View>
      </>
    );
  }

  const typeText = getTypeText(inspection.inspectionType);

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
            <Text style={styles.address}>{inspection.propertyAddress}</Text>
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

            {inspection.rooms.length === 0 ? (
              <View style={styles.emptyState}>
                <IconSymbol
                  ios_icon_name="door.left.hand.open"
                  android_material_icon_name="meeting-room"
                  size={48}
                  color={colors.textSecondary}
                />
                <Text style={styles.emptyText}>No rooms added yet</Text>
              </View>
            ) : (
              <View style={styles.roomsList}>
                {inspection.rooms.map((room) => (
                  <TouchableOpacity
                    key={room.id}
                    style={commonStyles.card}
                    onPress={() => {
                      console.log('User tapped room:', room.nameDe);
                      setSelectedRoom(room);
                      setShowAddItemModal(true);
                    }}
                  >
                    <View style={styles.roomHeader}>
                      <View style={styles.roomNameContainer}>
                        <Text style={styles.roomNameDe}>{room.nameDe}</Text>
                        <Text style={styles.roomNameEn}>{room.nameEn}</Text>
                      </View>
                      <IconSymbol
                        ios_icon_name="chevron.right"
                        android_material_icon_name="chevron-right"
                        size={20}
                        color={colors.textSecondary}
                      />
                    </View>

                    {room.items && room.items.length > 0 && (
                      <View style={styles.itemsList}>
                        {room.items.map((item) => {
                          const statusColor = 
                            item.status === 'OK' ? colors.success : 
                            item.status === 'Defect' ? colors.error : 
                            colors.warning;

                          return (
                            <View key={item.id} style={styles.itemRow}>
                              <Text style={styles.itemName}>{item.itemName}</Text>
                              <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                                <Text style={styles.statusText}>{item.status}</Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
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

        {/* Add Room Item Modal */}
        <Modal
          visible={showAddItemModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAddItemModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Log Condition - {selectedRoom?.nameDe}
                </Text>
                <TouchableOpacity onPress={() => {
                  setShowAddItemModal(false);
                  setSelectedRoom(null);
                  setSelectedItem('');
                  setSelectedStatus('OK');
                  setItemNotes('');
                  setCapturedPhoto(null);
                  setPhotoLocation(null);
                  setPhotoTimestamp(null);
                }}>
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
                  <Text style={styles.label}>Item *</Text>
                  <View style={styles.itemButtonList}>
                    {ROOM_ITEMS.map((item) => (
                      <TouchableOpacity
                        key={item}
                        style={[
                          styles.itemButton,
                          selectedItem === item && styles.itemButtonActive,
                        ]}
                        onPress={() => {
                          console.log('User selected item:', item);
                          setSelectedItem(item);
                        }}
                      >
                        <Text
                          style={[
                            styles.itemButtonText,
                            selectedItem === item && styles.itemButtonTextActive,
                          ]}
                        >
                          {item}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Status *</Text>
                  <View style={styles.statusButtonList}>
                    {STATUS_OPTIONS.map((status) => (
                      <TouchableOpacity
                        key={status}
                        style={[
                          styles.statusButton,
                          selectedStatus === status && styles.statusButtonActive,
                        ]}
                        onPress={() => {
                          console.log('User selected status:', status);
                          setSelectedStatus(status);
                        }}
                      >
                        <Text
                          style={[
                            styles.statusButtonText,
                            selectedStatus === status && styles.statusButtonTextActive,
                          ]}
                        >
                          {status}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Notes (Optional)</Text>
                  <TextInput
                    style={[commonStyles.input, styles.textArea]}
                    placeholder="Add any additional notes..."
                    value={itemNotes}
                    onChangeText={setItemNotes}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Photo (Optional)</Text>
                  {capturedPhoto ? (
                    <View style={styles.photoPreview}>
                      <Image source={{ uri: capturedPhoto }} style={styles.photoImage} />
                      {photoLocation && (
                        <View style={styles.photoMetadata}>
                          <Text style={styles.metadataText}>
                            GPS: {photoLocation.latitude.toFixed(6)}, {photoLocation.longitude.toFixed(6)}
                          </Text>
                          {photoTimestamp && (
                            <Text style={styles.metadataText}>
                              Time: {new Date(photoTimestamp).toLocaleString()}
                            </Text>
                          )}
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.retakeButton}
                        onPress={handleOpenCamera}
                      >
                        <Text style={styles.retakeButtonText}>Retake Photo</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.photoButton} onPress={handleOpenCamera}>
                      <IconSymbol
                        ios_icon_name="camera.fill"
                        android_material_icon_name="camera"
                        size={32}
                        color={colors.primary}
                      />
                      <Text style={styles.photoButtonText}>Take Photo</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>

              <TouchableOpacity
                style={[
                  styles.modalSaveButton,
                  (!selectedItem || !selectedStatus) && styles.modalSaveButtonDisabled,
                ]}
                onPress={handleAddRoomItem}
                disabled={!selectedItem || !selectedStatus}
              >
                <Text style={styles.modalSaveButtonText}>Log Condition</Text>
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
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
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
  roomsList: {
    gap: 12,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomNameContainer: {
    flex: 1,
  },
  roomNameDe: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  roomNameEn: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemsList: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
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
  itemButtonList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  itemButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  itemButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  itemButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  itemButtonTextActive: {
    color: '#FFFFFF',
  },
  statusButtonList: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  statusButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  statusButtonTextActive: {
    color: '#FFFFFF',
  },
  photoButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.card,
  },
  photoButtonText: {
    fontSize: 14,
    color: colors.primary,
    marginTop: 8,
    fontWeight: '600',
  },
  photoPreview: {
    alignItems: 'center',
  },
  photoImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
  },
  photoMetadata: {
    width: '100%',
    padding: 12,
    backgroundColor: colors.card,
    borderRadius: 8,
    marginBottom: 12,
  },
  metadataText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  retakeButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  retakeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
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
