
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
  Platform,
} from "react-native";
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { colors, commonStyles } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { AlertModal, ConfirmModal } from "@/components/ui/Modal";
import { supabase } from "@/app/integrations/supabase/client";

// Room item presets
const ROOM_ITEMS = [
  { nameEn: 'Walls', nameDe: 'Wände' },
  { nameEn: 'Floor', nameDe: 'Boden' },
  { nameEn: 'Windows', nameDe: 'Fenster' },
  { nameEn: 'Ceiling', nameDe: 'Decke' },
  { nameEn: 'Doors', nameDe: 'Türen' },
];

// Status options
const STATUS_OPTIONS = [
  { value: 'OK', label: 'OK' },
  { value: 'Defect', label: 'Defect / Mangelhaft' },
  { value: 'Wear & Tear', label: 'Wear & Tear / Abnutzung' },
];

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
  gps_coords: {
    latitude: number;
    longitude: number;
  } | null;
  timestamp_verified: string;
}

// Helper to resolve image sources
function resolveImageSource(source: string | number | undefined): { uri: string } | number {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as number;
}

export default function RoomDetailScreen() {
  const router = useRouter();
  const { roomId } = useLocalSearchParams();
  const [room, setRoom] = useState<Room | null>(null);
  const [roomItems, setRoomItems] = useState<RoomItem[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Log Condition modal state
  const [showLogConditionModal, setShowLogConditionModal] = useState(false);
  const [selectedItemPreset, setSelectedItemPreset] = useState<typeof ROOM_ITEMS[0] | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('OK');
  const [itemNotes, setItemNotes] = useState('');
  const [savingItem, setSavingItem] = useState(false);
  
  // Edit state
  const [editingItem, setEditingItem] = useState<RoomItem | null>(null);
  
  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<RoomItem | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);
  
  // Camera state
  const [showCamera, setShowCamera] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [photoLocation, setPhotoLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [photoTimestamp, setPhotoTimestamp] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [currentItemId, setCurrentItemId] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  
  // Alert modal
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'info' | 'error' | 'success'>('info');
  
  // Lightbox state for full-screen image viewing
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string>('');
  
  const showAlert = (title: string, message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertType(type);
    setAlertVisible(true);
  };

  const openLightbox = (imageUrl: string) => {
    console.log('Opening lightbox for image:', imageUrl);
    setLightboxImageUrl(imageUrl);
    setLightboxVisible(true);
  };

  const closeLightbox = () => {
    console.log('Closing lightbox');
    setLightboxVisible(false);
    setLightboxImageUrl('');
  };

  // Fetch room details and items
  const fetchRoomData = useCallback(async () => {
    if (!roomId) {
      console.log('RoomDetailScreen: No room ID provided');
      return;
    }

    console.log('RoomDetailScreen: Loading room data for ID:', roomId);
    setLoading(true);
    setError(null);

    try {
      // Fetch room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (roomError) {
        console.error('RoomDetailScreen: Error loading room:', roomError);
        setError(`Failed to load room: ${roomError.message}`);
        return;
      }

      console.log('RoomDetailScreen: Room loaded successfully');
      setRoom(roomData);

      // CRITICAL FIX: Ensure room_id is explicitly passed when fetching items
      const { data: itemsData, error: itemsError } = await supabase
        .from('room_items')
        .select('*')
        .eq('room_id', roomId)
        .order('item_name_de', { ascending: true });

      if (itemsError) {
        console.error('RoomDetailScreen: Error loading items:', itemsError);
      } else if (itemsData) {
        console.log('RoomDetailScreen: Loaded items:', itemsData.length);
        setRoomItems(itemsData);

        // Fetch photos for all items
        if (itemsData.length > 0) {
          const itemIds = itemsData.map(item => item.id);
          const { data: photosData, error: photosError } = await supabase
            .from('photos')
            .select('*')
            .in('item_id', itemIds)
            .order('timestamp_verified', { ascending: false });

          if (photosError) {
            console.error('RoomDetailScreen: Error loading photos:', photosError);
          } else if (photosData) {
            console.log('RoomDetailScreen: Loaded photos:', photosData.length);
            setPhotos(photosData);
          }
        }
      }
    } catch (err: any) {
      console.error('RoomDetailScreen: Unexpected error:', err);
      setError(`An unexpected error occurred: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchRoomData();
  }, [fetchRoomData]);

  const handleOpenCamera = async (itemId: string) => {
    console.log('User tapped Take Photo button for item:', itemId);
    setCurrentItemId(itemId);
    
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
      // PERFORMANCE FIX #3: Optimized camera settings
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.3, // Reduced quality for performance
        base64: false, // Disable base64 for performance
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

      // Automatically upload the photo
      await uploadPhotoToSupabase(photo.uri, coords, timestamp);
    } catch (error) {
      console.error('Error capturing photo:', error);
      showAlert('Error', 'Failed to capture photo. Please try again.', 'error');
    }
  };

  const uploadPhotoToSupabase = async (
    photoUri: string,
    coords: { latitude: number; longitude: number },
    timestamp: string
  ) => {
    if (!currentItemId || !room) {
      console.error('Missing item ID or room data');
      return;
    }

    console.log('Uploading photo to Supabase');
    setUploadingPhoto(true);

    try {
      // Convert photo URI to blob
      const response = await fetch(photoUri);
      const blob = await response.blob();

      // Create file path: [report_id]/[room_id]/[timestamp].jpg
      const fileName = `${timestamp.replace(/[:.]/g, '-')}.jpg`;
      const filePath = `${room.report_id}/${room.id}/${fileName}`;

      console.log('Uploading to path:', filePath);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('inspection-photos')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        console.error('Error uploading photo:', uploadError);
        showAlert('Upload Error', `Failed to upload photo: ${uploadError.message}`, 'error');
        return;
      }

      console.log('Photo uploaded successfully:', uploadData);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('inspection-photos')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;
      console.log('Public URL:', publicUrl);

      // Save photo record to database
      const { data: photoData, error: photoError } = await supabase
        .from('photos')
        .insert([{
          item_id: currentItemId,
          storage_url: publicUrl,
          gps_coords: coords,
          timestamp_verified: timestamp,
        }])
        .select()
        .single();

      if (photoError) {
        console.error('Error saving photo record:', photoError);
        showAlert('Database Error', `Failed to save photo record: ${photoError.message}`, 'error');
        return;
      }

      console.log('Photo record saved successfully:', photoData);

      // Refresh photos list
      await fetchRoomData();

      showAlert('Success', 'Photo uploaded successfully with GPS verification', 'success');
      
      // Clear captured photo state
      setCapturedPhoto(null);
      setPhotoLocation(null);
      setPhotoTimestamp(null);
      setCurrentItemId(null);
    } catch (error: any) {
      console.error('Unexpected error uploading photo:', error);
      showAlert('Error', `Failed to upload photo: ${error.message}`, 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleLogCondition = async () => {
    console.log('User tapped Save Condition button');
    
    if (!selectedItemPreset) {
      console.log('Validation failed: Item preset is required');
      showAlert('Validation Error', 'Please select an item type', 'error');
      return;
    }

    if (!roomId) {
      console.log('Error: No room ID available');
      showAlert('Error', 'Room ID is missing', 'error');
      return;
    }

    setSavingItem(true);

    try {
      // CRITICAL FIX: Explicitly pass room_id to ensure it's saved correctly
      const itemData = {
        room_id: roomId, // Explicitly pass room_id
        item_name_en: selectedItemPreset.nameEn,
        item_name_de: selectedItemPreset.nameDe,
        condition_status: selectedStatus,
        notes: itemNotes || null,
        requires_repair: selectedStatus === 'Defect',
      };

      console.log('Adding room item to Supabase:', itemData);

      if (editingItem) {
        // Update existing item
        const { data: updatedItem, error: updateError } = await supabase
          .from('room_items')
          .update(itemData)
          .eq('id', editingItem.id)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating room item:', updateError);
          showAlert('Error', `Failed to update item: ${updateError.message}`, 'error');
          return;
        }

        console.log('Room item updated successfully:', updatedItem);
        showAlert('Success', 'Condition updated successfully', 'success');
      } else {
        // Insert new item
        const { data: newItem, error: insertError } = await supabase
          .from('room_items')
          .insert([itemData])
          .select()
          .single();

        if (insertError) {
          console.error('Error inserting room item:', insertError);
          showAlert('Error', `Failed to add item: ${insertError.message}`, 'error');
          return;
        }

        console.log('Room item added successfully:', newItem);
        showAlert('Success', 'Condition logged successfully', 'success');
      }

      // Refresh the room data
      await fetchRoomData();

      setShowLogConditionModal(false);
      setSelectedItemPreset(null);
      setSelectedStatus('OK');
      setItemNotes('');
      setEditingItem(null);
    } catch (error: any) {
      console.error('Unexpected error saving room item:', error);
      showAlert('Error', `Failed to save item: ${error.message}`, 'error');
    } finally {
      setSavingItem(false);
    }
  };

  const handleEditItem = (item: RoomItem) => {
    console.log('User tapped Edit button for item:', item.id);
    setEditingItem(item);
    
    // Find the preset that matches this item
    const preset = ROOM_ITEMS.find(p => p.nameEn === item.item_name_en);
    setSelectedItemPreset(preset || null);
    setSelectedStatus(item.condition_status);
    setItemNotes(item.notes || '');
    
    setShowLogConditionModal(true);
  };

  const handleDeleteItem = (item: RoomItem) => {
    console.log('User tapped Delete button for item:', item.id);
    setItemToDelete(item);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;

    console.log('Deleting item:', itemToDelete.id);
    setDeletingItem(true);

    try {
      // Delete the item from Supabase
      const { error: deleteError } = await supabase
        .from('room_items')
        .delete()
        .eq('id', itemToDelete.id);

      if (deleteError) {
        console.error('Error deleting item:', deleteError);
        showAlert('Error', `Failed to delete item: ${deleteError.message}`, 'error');
        return;
      }

      console.log('Item deleted successfully');
      showAlert('Success', 'Item deleted successfully', 'success');

      // Refresh the room data
      await fetchRoomData();

      setShowDeleteConfirm(false);
      setItemToDelete(null);
    } catch (error: any) {
      console.error('Unexpected error deleting item:', error);
      showAlert('Error', `Failed to delete item: ${error.message}`, 'error');
    } finally {
      setDeletingItem(false);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Room Details",
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: '#FFFFFF',
            headerBackTitle: 'Back',
          }}
        />
        <View style={[commonStyles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading room details...</Text>
        </View>
      </>
    );
  }

  // Show error state
  if (error || !room) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Room Details",
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
          <Text style={styles.errorText}>{error || 'Room not found'}</Text>
        </View>
      </>
    );
  }

  const hasItems = roomItems.length > 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: room.name_de,
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: '#FFFFFF',
          headerBackTitle: 'Back',
        }}
      />
      <View style={commonStyles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={commonStyles.card}>
            <Text style={styles.roomNameDe}>{room.name_de}</Text>
            <Text style={styles.roomNameEn}>{room.name_en}</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Logged Conditions</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  console.log('User tapped Log Condition button');
                  setEditingItem(null);
                  setSelectedItemPreset(null);
                  setSelectedStatus('OK');
                  setItemNotes('');
                  setShowLogConditionModal(true);
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

            {!hasItems && (
              <View style={styles.emptyState}>
                <IconSymbol
                  ios_icon_name="doc.text"
                  android_material_icon_name="description"
                  size={48}
                  color={colors.textSecondary}
                />
                <Text style={styles.emptyText}>No conditions logged yet</Text>
              </View>
            )}

            {hasItems && (
              <View style={styles.itemsList}>
                {roomItems.map((item) => {
                  const itemPhotos = photos.filter(p => p.item_id === item.id);
                  const statusColor = item.condition_status === 'OK' ? colors.success : 
                                     item.condition_status === 'Defect' ? colors.error : 
                                     colors.warning;
                  
                  return (
                    <View key={item.id} style={styles.itemCard}>
                      <View style={styles.itemHeader}>
                        <View style={styles.itemTitleContainer}>
                          <Text style={styles.itemNameDe}>{item.item_name_de}</Text>
                          <Text style={styles.itemNameEn}>{item.item_name_en}</Text>
                        </View>
                        <View style={styles.itemActions}>
                          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                            <Text style={styles.statusText}>{item.condition_status}</Text>
                          </View>
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => handleEditItem(item)}
                          >
                            <IconSymbol
                              ios_icon_name="pencil"
                              android_material_icon_name="edit"
                              size={20}
                              color={colors.primary}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => handleDeleteItem(item)}
                          >
                            <IconSymbol
                              ios_icon_name="trash"
                              android_material_icon_name="delete"
                              size={20}
                              color={colors.error}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {item.notes && (
                        <Text style={styles.itemNotes}>{item.notes}</Text>
                      )}

                      <TouchableOpacity
                        style={styles.takePhotoButton}
                        onPress={() => handleOpenCamera(item.id)}
                        disabled={uploadingPhoto}
                      >
                        <IconSymbol
                          ios_icon_name="camera.fill"
                          android_material_icon_name="camera"
                          size={20}
                          color="#FFFFFF"
                        />
                        <Text style={styles.takePhotoButtonText}>Take Photo</Text>
                      </TouchableOpacity>

                      {/* CRITICAL FIX #3: Evidence Gallery with 100x100 thumbnails and lightbox */}
                      {itemPhotos.length > 0 && (
                        <View style={styles.evidenceGallery}>
                          <Text style={styles.evidenceTitle}>Evidence Gallery</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
                            {itemPhotos.map((photo) => {
                              return (
                                <TouchableOpacity
                                  key={photo.id}
                                  style={styles.thumbnailContainer}
                                  onPress={() => openLightbox(photo.storage_url)}
                                  activeOpacity={0.7}
                                >
                                  <Image
                                    source={resolveImageSource(photo.storage_url)}
                                    style={styles.thumbnail}
                                    resizeMode="cover"
                                  />
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Log Condition Modal */}
        <Modal
          visible={showLogConditionModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowLogConditionModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingItem ? 'Edit Condition' : 'Log Condition'}
                </Text>
                <TouchableOpacity onPress={() => setShowLogConditionModal(false)}>
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
                  <Text style={styles.label}>Select Item *</Text>
                  <View style={styles.itemPresetList}>
                    {ROOM_ITEMS.map((preset) => {
                      const isSelected = selectedItemPreset?.nameEn === preset.nameEn;
                      return (
                        <TouchableOpacity
                          key={preset.nameEn}
                          style={[
                            styles.presetButton,
                            isSelected && styles.presetButtonActive,
                          ]}
                          onPress={() => {
                            console.log('User selected item preset:', preset.nameDe);
                            setSelectedItemPreset(preset);
                          }}
                        >
                          <Text style={[
                            styles.presetNameDe,
                            isSelected && styles.presetNameDeActive,
                          ]}>
                            {preset.nameDe}
                          </Text>
                          <Text style={[
                            styles.presetNameEn,
                            isSelected && styles.presetNameEnActive,
                          ]}>
                            {preset.nameEn}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Condition Status *</Text>
                  <View style={styles.statusList}>
                    {STATUS_OPTIONS.map((status) => {
                      const isSelected = selectedStatus === status.value;
                      return (
                        <TouchableOpacity
                          key={status.value}
                          style={[
                            styles.statusButton,
                            isSelected && styles.statusButtonActive,
                          ]}
                          onPress={() => {
                            console.log('User selected status:', status.value);
                            setSelectedStatus(status.value);
                          }}
                        >
                          <Text style={[
                            styles.statusButtonText,
                            isSelected && styles.statusButtonTextActive,
                          ]}>
                            {status.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Notes (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Add any additional notes..."
                    placeholderTextColor={colors.textSecondary}
                    value={itemNotes}
                    onChangeText={setItemNotes}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              </ScrollView>

              <TouchableOpacity
                style={[
                  styles.modalSaveButton,
                  (!selectedItemPreset || savingItem) && styles.modalSaveButtonDisabled,
                ]}
                onPress={handleLogCondition}
                disabled={!selectedItemPreset || savingItem}
              >
                {savingItem ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveButtonText}>
                    {editingItem ? 'Update Condition' : 'Save Condition'}
                  </Text>
                )}
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

        {/* Upload Progress Modal */}
        <Modal
          visible={uploadingPhoto}
          transparent={true}
          animationType="fade"
        >
          <View style={styles.uploadOverlay}>
            <View style={styles.uploadModal}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.uploadText}>Processing...</Text>
              <Text style={styles.uploadSubtext}>Uploading photo with GPS verification</Text>
            </View>
          </View>
        </Modal>

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          visible={showDeleteConfirm}
          title="Delete Item"
          message={`Are you sure you want to delete "${itemToDelete?.item_name_de}"? This action cannot be undone.`}
          confirmText={deletingItem ? "Deleting..." : "Delete"}
          cancelText="Cancel"
          onConfirm={confirmDeleteItem}
          onCancel={() => {
            setShowDeleteConfirm(false);
            setItemToDelete(null);
          }}
          type="danger"
        />

        {/* CRITICAL FIX #3: Full-Screen Lightbox Modal */}
        <Modal
          visible={lightboxVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={closeLightbox}
        >
          <View style={styles.lightboxOverlay}>
            <TouchableOpacity
              style={styles.lightboxCloseButton}
              onPress={closeLightbox}
              activeOpacity={0.8}
            >
              <IconSymbol
                ios_icon_name="xmark.circle.fill"
                android_material_icon_name="close"
                size={36}
                color="#FFFFFF"
              />
            </TouchableOpacity>
            <Image
              source={resolveImageSource(lightboxImageUrl)}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
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
  },
  roomNameDe: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  roomNameEn: {
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
    fontSize: 20,
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
  itemsList: {
    gap: 16,
  },
  itemCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemTitleContainer: {
    flex: 1,
  },
  itemNameDe: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  itemNameEn: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  itemNotes: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  takePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  takePhotoButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  evidenceGallery: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  evidenceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  photoScroll: {
    marginHorizontal: -4,
  },
  thumbnailContainer: {
    marginHorizontal: 4,
  },
  thumbnail: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  lightboxImage: {
    width: '100%',
    height: '100%',
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
  itemPresetList: {
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
  presetNameDeActive: {
    color: '#FFFFFF',
  },
  presetNameEn: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  presetNameEnActive: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  statusList: {
    gap: 12,
  },
  statusButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  statusButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  statusButtonTextActive: {
    color: '#FFFFFF',
  },
  textInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    minHeight: 100,
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
    minHeight: 52,
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
  uploadOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadModal: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    minWidth: 200,
  },
  uploadText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  uploadSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
});
