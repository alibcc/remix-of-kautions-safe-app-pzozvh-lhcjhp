
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect } from "react";
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
import * as ImagePicker from 'expo-image-picker';
import { colors, commonStyles } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { authenticatedGet, authenticatedPost, authenticatedPut, authenticatedDelete, uploadImage } from "@/utils/api";
import { ConfirmModal, AlertModal } from "@/components/ui/Modal";

interface Room {
  id: string;
  roomName: string;
  condition: 'ok' | 'defect';
  defectDescription?: string;
  defectPhotoUrl?: string;
  sortOrder: number;
}

interface Meter {
  id: string;
  meterType: string;
  meterNumber: string;
  reading: string;
  photoUrl?: string;
}

interface Inspection {
  id: string;
  propertyAddress: string;
  inspectionType: string;
  landlordName?: string;
  tenantName?: string;
  landlordSignature?: string;
  tenantSignature?: string;
  status: string;
  rooms: Room[];
  meters: Meter[];
  createdAt: string;
}

export default function InspectionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [showAddMeterModal, setShowAddMeterModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCondition, setNewRoomCondition] = useState<'ok' | 'defect'>('ok');
  const [newRoomDescription, setNewRoomDescription] = useState('');
  const [newRoomPhoto, setNewRoomPhoto] = useState<string | null>(null);
  
  // Meter modal state
  const [newMeterType, setNewMeterType] = useState<string>('electricity');
  const [newMeterNumber, setNewMeterNumber] = useState('');
  const [newMeterReading, setNewMeterReading] = useState('');
  const [newMeterPhoto, setNewMeterPhoto] = useState<string | null>(null);
  
  // Delete confirmation modals
  const [deleteRoomId, setDeleteRoomId] = useState<string | null>(null);
  const [deleteMeterId, setDeleteMeterId] = useState<string | null>(null);
  const [deleteInspectionConfirm, setDeleteInspectionConfirm] = useState(false);
  
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
    
    if (!newRoomName.trim()) {
      console.log('Validation failed: Room name is required');
      return;
    }

    if (newRoomCondition === 'defect' && (!newRoomDescription.trim() || !newRoomPhoto)) {
      console.log('Validation failed: Defect requires description and photo');
      return;
    }

    try {
      console.log('Adding room:', { newRoomName, newRoomCondition, newRoomDescription, newRoomPhoto });
      const response = await authenticatedPost<Room>(`/api/inspections/${id}/rooms`, { 
        roomName: newRoomName, 
        condition: newRoomCondition, 
        defectDescription: newRoomCondition === 'defect' ? newRoomDescription : undefined, 
        defectPhotoUrl: newRoomCondition === 'defect' ? newRoomPhoto : undefined, 
        sortOrder: inspection?.rooms.length || 0 
      });
      setInspection(prev => prev ? { ...prev, rooms: [...prev.rooms, response] } : null);
      
      setShowAddRoomModal(false);
      setNewRoomName('');
      setNewRoomCondition('ok');
      setNewRoomDescription('');
      setNewRoomPhoto(null);
      console.log('Room added successfully');
    } catch (error) {
      console.error('Error adding room:', error);
    }
  };

  const handleTakePhoto = async (forMeter: boolean = false) => {
    console.log('User tapped Take Photo button');
    
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (!permissionResult.granted) {
      console.log('Camera permission denied');
      showAlert('Permission Required', 'Camera permission is required to take photos', 'error');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      console.log('Photo captured:', result.assets[0].uri);
      
      try {
        // Upload image to backend using the helper function
        const uploadResponse = await uploadImage(result.assets[0].uri);
        
        if (forMeter) {
          setNewMeterPhoto(uploadResponse.url);
        } else {
          setNewRoomPhoto(uploadResponse.url);
        }
        console.log('Photo uploaded successfully:', uploadResponse.url);
      } catch (error) {
        console.error('Error uploading photo:', error);
        showAlert('Upload Failed', 'Failed to upload photo. Please try again.', 'error');
        // Fallback to local URI if upload fails
        if (forMeter) {
          setNewMeterPhoto(result.assets[0].uri);
        } else {
          setNewRoomPhoto(result.assets[0].uri);
        }
      }
    }
  };

  const handleAddMeter = async () => {
    console.log('User tapped Add Meter button');
    
    if (!newMeterType || !newMeterNumber.trim() || !newMeterReading.trim()) {
      showAlert('Validation Error', 'Please fill in all required fields', 'error');
      return;
    }

    try {
      console.log('Adding meter:', { newMeterType, newMeterNumber, newMeterReading, newMeterPhoto });
      const response = await authenticatedPost<Meter>(`/api/inspections/${id}/meters`, { 
        meterType: newMeterType, 
        meterNumber: newMeterNumber, 
        reading: newMeterReading,
        photoUrl: newMeterPhoto || undefined
      });
      setInspection(prev => prev ? { ...prev, meters: [...prev.meters, response] } : null);
      
      setShowAddMeterModal(false);
      setNewMeterType('electricity');
      setNewMeterNumber('');
      setNewMeterReading('');
      setNewMeterPhoto(null);
      console.log('Meter added successfully');
      showAlert('Success', 'Meter added successfully', 'success');
    } catch (error) {
      console.error('Error adding meter:', error);
      showAlert('Error', 'Failed to add meter. Please try again.', 'error');
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    console.log('Deleting room:', roomId);
    try {
      await authenticatedDelete(`/api/rooms/${roomId}`);
      setInspection(prev => prev ? { ...prev, rooms: prev.rooms.filter(r => r.id !== roomId) } : null);
      setDeleteRoomId(null);
      console.log('Room deleted successfully');
      showAlert('Success', 'Room deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting room:', error);
      showAlert('Error', 'Failed to delete room. Please try again.', 'error');
    }
  };

  const handleDeleteMeter = async (meterId: string) => {
    console.log('Deleting meter:', meterId);
    try {
      await authenticatedDelete(`/api/meters/${meterId}`);
      setInspection(prev => prev ? { ...prev, meters: prev.meters.filter(m => m.id !== meterId) } : null);
      setDeleteMeterId(null);
      console.log('Meter deleted successfully');
      showAlert('Success', 'Meter deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting meter:', error);
      showAlert('Error', 'Failed to delete meter. Please try again.', 'error');
    }
  };

  const handleDeleteInspection = async () => {
    console.log('Deleting inspection:', id);
    try {
      await authenticatedDelete(`/api/inspections/${id}`);
      setDeleteInspectionConfirm(false);
      console.log('Inspection deleted successfully');
      showAlert('Success', 'Inspection deleted successfully', 'success');
      setTimeout(() => router.replace('/'), 1000);
    } catch (error) {
      console.error('Error deleting inspection:', error);
      showAlert('Error', 'Failed to delete inspection. Please try again.', 'error');
    }
  };

  const handleExportPDF = async () => {
    console.log('User tapped Export PDF button');
    
    try {
      console.log('Generating PDF for inspection:', id);
      const response = await authenticatedPost<{ pdfUrl: string }>(`/api/inspections/${id}/generate-pdf`, {});
      console.log('PDF generated successfully:', response.pdfUrl);
      
      // TODO: Open PDF URL in browser or share
      // Linking.openURL(response.pdfUrl);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const getTypeText = (type: string) => {
    if (type === 'move_in') return 'Move In';
    return 'Move Out';
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
          title: "Inspection Details",
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: '#FFFFFF',
          headerBackTitle: 'Back',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setDeleteInspectionConfirm(true)}
              style={{ marginRight: 16 }}
            >
              <IconSymbol
                ios_icon_name="trash"
                android_material_icon_name="delete"
                size={24}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={commonStyles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={commonStyles.card}>
            <Text style={styles.address}>{inspection.propertyAddress}</Text>
            <Text style={styles.type}>{typeText}</Text>
            
            {inspection.landlordName && (
              <View style={styles.participantRow}>
                <Text style={styles.participantLabel}>Landlord:</Text>
                <Text style={styles.participantName}>{inspection.landlordName}</Text>
              </View>
            )}
            
            {inspection.tenantName && (
              <View style={styles.participantRow}>
                <Text style={styles.participantLabel}>Tenant:</Text>
                <Text style={styles.participantName}>{inspection.tenantName}</Text>
              </View>
            )}
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
                {inspection.rooms.map((room) => {
                  const conditionColor = room.condition === 'ok' ? colors.success : colors.warning;
                  const conditionText = room.condition === 'ok' ? 'OK' : 'Defect';

                  return (
                    <View key={room.id} style={commonStyles.card}>
                      <View style={styles.roomHeader}>
                        <Text style={styles.roomName}>{room.roomName}</Text>
                        <View style={styles.roomActions}>
                          <View style={[styles.conditionBadge, { backgroundColor: conditionColor }]}>
                            <Text style={styles.conditionText}>{conditionText}</Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => setDeleteRoomId(room.id)}
                            style={styles.deleteButton}
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

                      {room.condition === 'defect' && (
                        <View style={styles.defectDetails}>
                          {room.defectPhotoUrl && (
                            <Image
                              source={{ uri: room.defectPhotoUrl }}
                              style={styles.defectPhoto}
                            />
                          )}
                          <Text style={styles.defectDescription}>{room.defectDescription}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Meters</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  console.log('User tapped Add Meter button');
                  setShowAddMeterModal(true);
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

            {inspection.meters.length === 0 ? (
              <View style={styles.emptyState}>
                <IconSymbol
                  ios_icon_name="gauge"
                  android_material_icon_name="speed"
                  size={48}
                  color={colors.textSecondary}
                />
                <Text style={styles.emptyText}>No meters added yet</Text>
              </View>
            ) : (
              <View style={styles.metersList}>
                {inspection.meters.map((meter) => (
                  <View key={meter.id} style={commonStyles.card}>
                    <View style={styles.meterHeader}>
                      <Text style={styles.meterType}>{meter.meterType}</Text>
                      <TouchableOpacity
                        onPress={() => setDeleteMeterId(meter.id)}
                        style={styles.deleteButton}
                      >
                        <IconSymbol
                          ios_icon_name="trash"
                          android_material_icon_name="delete"
                          size={20}
                          color={colors.error}
                        />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.meterRow}>
                      <Text style={styles.meterLabel}>Number:</Text>
                      <Text style={styles.meterValue}>{meter.meterNumber}</Text>
                    </View>
                    <View style={styles.meterRow}>
                      <Text style={styles.meterLabel}>Reading:</Text>
                      <Text style={styles.meterValue}>{meter.reading}</Text>
                    </View>
                    {meter.photoUrl && (
                      <Image
                        source={{ uri: meter.photoUrl }}
                        style={styles.meterPhoto}
                      />
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.exportButton}
            onPress={handleExportPDF}
          >
            <IconSymbol
              ios_icon_name="doc.text"
              android_material_icon_name="description"
              size={24}
              color="#FFFFFF"
            />
            <Text style={styles.exportButtonText}>Export PDF (€8.99)</Text>
          </TouchableOpacity>
        </ScrollView>

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
                  <Text style={styles.label}>Room Name *</Text>
                  <TextInput
                    style={commonStyles.input}
                    placeholder="e.g., Wohnzimmer, Bad, Küche"
                    value={newRoomName}
                    onChangeText={setNewRoomName}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Condition *</Text>
                  <View style={styles.conditionButtons}>
                    <TouchableOpacity
                      style={[
                        styles.conditionButton,
                        newRoomCondition === 'ok' && styles.conditionButtonOk,
                      ]}
                      onPress={() => {
                        console.log('User selected OK condition');
                        setNewRoomCondition('ok');
                      }}
                    >
                      <Text
                        style={[
                          styles.conditionButtonText,
                          newRoomCondition === 'ok' && styles.conditionButtonTextActive,
                        ]}
                      >
                        OK
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.conditionButton,
                        newRoomCondition === 'defect' && styles.conditionButtonDefect,
                      ]}
                      onPress={() => {
                        console.log('User selected Defect condition');
                        setNewRoomCondition('defect');
                      }}
                    >
                      <Text
                        style={[
                          styles.conditionButtonText,
                          newRoomCondition === 'defect' && styles.conditionButtonTextActive,
                        ]}
                      >
                        Defect
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {newRoomCondition === 'defect' && (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Description *</Text>
                      <TextInput
                        style={[commonStyles.input, styles.textArea]}
                        placeholder="Describe the defect..."
                        value={newRoomDescription}
                        onChangeText={setNewRoomDescription}
                        multiline
                        numberOfLines={3}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Photo *</Text>
                      {newRoomPhoto ? (
                        <View style={styles.photoPreview}>
                          <Image source={{ uri: newRoomPhoto }} style={styles.photoImage} />
                          <TouchableOpacity
                            style={styles.retakeButton}
                            onPress={handleTakePhoto}
                          >
                            <Text style={styles.retakeButtonText}>Retake Photo</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.photoButton} onPress={handleTakePhoto}>
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
                  </>
                )}
              </ScrollView>

              <TouchableOpacity
                style={[
                  styles.modalSaveButton,
                  (!newRoomName.trim() ||
                    (newRoomCondition === 'defect' &&
                      (!newRoomDescription.trim() || !newRoomPhoto))) &&
                    styles.modalSaveButtonDisabled,
                ]}
                onPress={handleAddRoom}
                disabled={
                  !newRoomName.trim() ||
                  (newRoomCondition === 'defect' &&
                    (!newRoomDescription.trim() || !newRoomPhoto))
                }
              >
                <Text style={styles.modalSaveButtonText}>Add Room</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showAddMeterModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAddMeterModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Meter</Text>
                <TouchableOpacity onPress={() => setShowAddMeterModal(false)}>
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
                  <Text style={styles.label}>Meter Type *</Text>
                  <View style={styles.meterTypeButtons}>
                    {['electricity', 'gas', 'water', 'heating'].map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.meterTypeButton,
                          newMeterType === type && styles.meterTypeButtonActive,
                        ]}
                        onPress={() => {
                          console.log('User selected meter type:', type);
                          setNewMeterType(type);
                        }}
                      >
                        <Text
                          style={[
                            styles.meterTypeButtonText,
                            newMeterType === type && styles.meterTypeButtonTextActive,
                          ]}
                        >
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Meter Number *</Text>
                  <TextInput
                    style={commonStyles.input}
                    placeholder="e.g., 12345678"
                    value={newMeterNumber}
                    onChangeText={setNewMeterNumber}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Reading *</Text>
                  <TextInput
                    style={commonStyles.input}
                    placeholder="e.g., 1234.56"
                    value={newMeterReading}
                    onChangeText={setNewMeterReading}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Photo (Optional)</Text>
                  {newMeterPhoto ? (
                    <View style={styles.photoPreview}>
                      <Image source={{ uri: newMeterPhoto }} style={styles.photoImage} />
                      <TouchableOpacity
                        style={styles.retakeButton}
                        onPress={() => handleTakePhoto(true)}
                      >
                        <Text style={styles.retakeButtonText}>Retake Photo</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.photoButton} onPress={() => handleTakePhoto(true)}>
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
                  (!newMeterType || !newMeterNumber.trim() || !newMeterReading.trim()) &&
                    styles.modalSaveButtonDisabled,
                ]}
                onPress={handleAddMeter}
                disabled={!newMeterType || !newMeterNumber.trim() || !newMeterReading.trim()}
              >
                <Text style={styles.modalSaveButtonText}>Add Meter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <ConfirmModal
          visible={!!deleteRoomId}
          title="Delete Room"
          message="Are you sure you want to delete this room? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          type="danger"
          onConfirm={() => deleteRoomId && handleDeleteRoom(deleteRoomId)}
          onCancel={() => setDeleteRoomId(null)}
        />

        <ConfirmModal
          visible={!!deleteMeterId}
          title="Delete Meter"
          message="Are you sure you want to delete this meter? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          type="danger"
          onConfirm={() => deleteMeterId && handleDeleteMeter(deleteMeterId)}
          onCancel={() => setDeleteMeterId(null)}
        />

        <ConfirmModal
          visible={deleteInspectionConfirm}
          title="Delete Inspection"
          message="Are you sure you want to delete this entire inspection? This will delete all rooms, meters, and data. This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          type="danger"
          onConfirm={handleDeleteInspection}
          onCancel={() => setDeleteInspectionConfirm(false)}
        />

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
    marginBottom: 12,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  participantLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginRight: 8,
  },
  participantName: {
    fontSize: 14,
    color: colors.text,
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
    marginBottom: 8,
  },
  roomName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  roomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteButton: {
    padding: 4,
  },
  conditionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  conditionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  defectDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  defectPhoto: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  defectDescription: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  metersList: {
    gap: 12,
  },
  meterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  meterType: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    textTransform: 'capitalize',
    flex: 1,
  },
  meterPhoto: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginTop: 12,
  },
  meterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  meterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginRight: 8,
    width: 80,
  },
  meterValue: {
    fontSize: 14,
    color: colors.text,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.highlight,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginTop: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
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
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
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
  conditionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  conditionButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conditionButtonOk: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  conditionButtonDefect: {
    backgroundColor: colors.warning,
    borderColor: colors.warning,
  },
  conditionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  conditionButtonTextActive: {
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
  meterTypeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  meterTypeButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meterTypeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  meterTypeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  meterTypeButtonTextActive: {
    color: '#FFFFFF',
  },
});
