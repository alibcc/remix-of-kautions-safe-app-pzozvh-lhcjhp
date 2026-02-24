
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
  Platform,
  Linking,
  Alert,
  TextInput,
} from "react-native";
import { colors, commonStyles } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { AlertModal } from "@/components/ui/Modal";
import { supabase } from "@/app/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { sendPdfEmail } from "@/utils/api";

// EXPANDED Room preset list with English and German names
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

// VERSION 3.0.0 - UPDATED CREDENTIALS (STRICT)
const CRAFTMYPDF_API_KEY = '9cf6Mjg1MjM6Mjg2ODQ6a3ZWUDBhZ2lGUE9CU1UzdA=';
const CRAFTMYPDF_TEMPLATE_ID = '5c477b23ea34170c';
const CRAFTMYPDF_ENDPOINT = 'https://api.craftmypdf.com/v1/create';

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
}

interface Participant {
  id: string;
  report_id: string;
  role: string;
  name: string;
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
  
  // Room modal state
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [selectedRoomPreset, setSelectedRoomPreset] = useState<typeof ROOM_PRESETS[0] | null>(null);
  
  // Final Details modal state
  const [showFinalDetailsModal, setShowFinalDetailsModal] = useState(false);
  
  // Meter readings state
  const [electricityNo, setElectricityNo] = useState('');
  const [electricityVal, setElectricityVal] = useState('');
  const [gasNo, setGasNo] = useState('');
  const [gasVal, setGasVal] = useState('');
  const [waterNo, setWaterNo] = useState('');
  const [waterVal, setWaterVal] = useState('');
  const [heatingNo, setHeatingNo] = useState('');
  const [heatingVal, setHeatingVal] = useState('');
  
  // Keys and handover type state
  const [keysHandedOver, setKeysHandedOver] = useState('');
  const [isMoveIn, setIsMoveIn] = useState(false);
  const [isMoveOut, setIsMoveOut] = useState(false);
  
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

  // Fetch report and rooms
  useEffect(() => {
    let isMounted = true;

    const loadInspection = async () => {
      if (!id) {
        console.log('InspectionDetailScreen: No ID provided');
        return;
      }

      console.log('InspectionDetailScreen: Loading inspection for ID:', id);
      setLoading(true);
      setError(null);
      setReport(null);
      setRooms([]);

      // 1-second delay to give Supabase time to index new reports
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (!isMounted) return;

      try {
        // Fetch report
        const { data: reportData, error: fetchError } = await supabase
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

          if (fetchError.code === 'PGRST116') {
            setError('Inspection not found. It may have been deleted or you may not have access to it.');
          } else {
            setError(`Failed to load inspection: ${fetchError.message}`);
          }
        } else if (reportData) {
          console.log('InspectionDetailScreen: Report loaded successfully');
          setReport(reportData);

          // Fetch rooms for this report
          const { data: roomsData, error: roomsError } = await supabase
            .from('rooms')
            .select('*')
            .eq('report_id', id)
            .order('name_de', { ascending: true });

          if (roomsError) {
            console.error('InspectionDetailScreen: Error loading rooms:', roomsError);
          } else if (roomsData) {
            console.log('InspectionDetailScreen: Loaded rooms:', roomsData.length);
            setRooms(roomsData);
          }
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

          // Fetch rooms
          const { data: roomsData, error: roomsError } = await supabase
            .from('rooms')
            .select('*')
            .eq('report_id', id)
            .order('name_de', { ascending: true });

          if (roomsError) {
            console.error('InspectionDetailScreen: Error loading rooms:', roomsError);
          } else if (roomsData) {
            console.log('InspectionDetailScreen: Loaded rooms:', roomsData.length);
            setRooms(roomsData);
          }
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

    if (!id) {
      console.log('Error: No report ID available');
      showAlert('Error', 'Report ID is missing', 'error');
      return;
    }

    setSavingRoom(true);

    try {
      console.log('Adding room to Supabase:', {
        report_id: id,
        name_en: selectedRoomPreset.nameEn,
        name_de: selectedRoomPreset.nameDe,
      });

      // Insert directly into Supabase rooms table
      const { data: newRoom, error: insertError } = await supabase
        .from('rooms')
        .insert([{
          report_id: id,
          name_en: selectedRoomPreset.nameEn,
          name_de: selectedRoomPreset.nameDe,
        }])
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting room:', {
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code,
        });
        showAlert('Error', `Failed to add room: ${insertError.message}`, 'error');
        return;
      }

      console.log('Room added successfully:', newRoom);

      // Refresh the rooms list
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select('*')
        .eq('report_id', id)
        .order('name_de', { ascending: true });

      if (roomsError) {
        console.error('Error refreshing rooms:', roomsError);
      } else if (roomsData) {
        console.log('Rooms list refreshed:', roomsData.length);
        setRooms(roomsData);
      }

      setShowAddRoomModal(false);
      setSelectedRoomPreset(null);
      showAlert('Success', 'Room added successfully', 'success');
    } catch (error: any) {
      console.error('Unexpected error adding room:', error);
      showAlert('Error', `Failed to add room: ${error.message}`, 'error');
    } finally {
      setSavingRoom(false);
    }
  };

  const handleOpenRoom = (roomId: string) => {
    console.log('User tapped room card, navigating to room details:', roomId);
    router.push(`/inspection/room/${roomId}`);
  };

  const handleOpenFinalDetails = () => {
    console.log('User tapped Create Official Protocol button - opening Final Details');
    setShowFinalDetailsModal(true);
  };

  const handleGeneratePDF = async () => {
    console.log('User tapped Create Official Protocol button - Production Ready');
    
    if (!id || !report) {
      showAlert('Error', 'Report data is not available', 'error');
      return;
    }

    if (!user || !user.email) {
      showAlert('Error', 'User email is not available', 'error');
      return;
    }

    setGeneratingPDF(true);
    setShowFinalDetailsModal(false);

    try {
      console.log('Fetching all data for PDF generation');

      // Fetch participants
      const { data: participantsData, error: participantsError } = await supabase
        .from('participants')
        .select('*')
        .eq('report_id', id);

      if (participantsError) {
        console.error('Error fetching participants:', participantsError);
      }

      const participants = participantsData || [];
      console.log('Participants:', participants.length);

      // Extract landlord and tenant names
      const landlordParticipant = participants.find((p: Participant) => p.role === 'Landlord');
      const tenantParticipant = participants.find((p: Participant) => p.role === 'Tenant');
      
      const landlordName = landlordParticipant?.name || '';
      const tenantName = tenantParticipant?.name || '';

      // Fetch all rooms with their items and photos
      const roomsWithData = await Promise.all(
        rooms.map(async (room) => {
          // Fetch room items
          const { data: itemsData, error: itemsError } = await supabase
            .from('room_items')
            .select('*')
            .eq('room_id', room.id);

          if (itemsError) {
            console.error(`Error fetching items for room ${room.id}:`, itemsError);
            return { ...room, room_items: [] };
          }

          const items = itemsData || [];
          
          // Fetch photos for each item
          const itemsWithPhotos = await Promise.all(
            items.map(async (item: RoomItem) => {
              const { data: photosData, error: photosError } = await supabase
                .from('photos')
                .select('*')
                .eq('item_id', item.id)
                .limit(1);

              if (photosError) {
                console.error(`Error fetching photos for item ${item.id}:`, photosError);
                return { ...item, photo_url: '' };
              }

              const photo = photosData && photosData.length > 0 ? photosData[0] : null;
              return { ...item, photo_url: photo?.storage_url || '' };
            })
          );

          return { ...room, room_items: itemsWithPhotos };
        })
      );

      console.log('All data fetched successfully');

      // Format inspection date
      const inspectionDate = new Date(report.created_at).toLocaleDateString('de-DE');

      // Construct payload with EXACT keys matching template
      const pdfPayload = {
        template_id: CRAFTMYPDF_TEMPLATE_ID,
        data: {
          property_address: report.address,
          tenant_name: tenantName,
          landlord_name: landlordName,
          inspection_date: inspectionDate,
          is_move_in: isMoveIn,
          is_move_out: isMoveOut,
          meters: {
            electricity_no: electricityNo,
            electricity_val: electricityVal,
            gas_no: gasNo,
            gas_val: gasVal,
            water_no: waterNo,
            water_val: waterVal,
            heating_no: heatingNo,
            heating_val: heatingVal,
          },
          keys_handed_over: keysHandedOver,
          rooms_list: roomsWithData.map((room) => ({
            room_name: room.name_de,
            items: room.room_items.map((item: any) => ({
              item_name: item.item_name_de,
              status: item.condition_status,
              comment: item.notes || '',
              photo_url: item.photo_url || '',
            })),
          })),
        },
        load_data_from_url: false,
      };

      console.log('═══════════════════════════════════════');
      console.log('PDF GENERATION REQUEST - PRODUCTION');
      console.log('Endpoint URL:', CRAFTMYPDF_ENDPOINT);
      console.log('Payload:', JSON.stringify(pdfPayload, null, 2));
      console.log('═══════════════════════════════════════');

      // Save session data to Supabase before generating PDF
      console.log('Saving session data to Supabase');
      const { error: updateError } = await supabase
        .from('reports')
        .update({
          electricity_no: electricityNo,
          electricity_val: electricityVal,
          gas_no: gasNo,
          gas_val: gasVal,
          water_no: waterNo,
          water_val: waterVal,
          heating_no: heatingNo,
          heating_val: heatingVal,
          keys_handed_over: keysHandedOver,
          is_move_in: isMoveIn,
          is_move_out: isMoveOut,
        })
        .eq('id', id);

      if (updateError) {
        console.error('Error saving session data:', updateError);
      } else {
        console.log('Session data saved successfully');
      }

      // Call CraftMyPDF API
      const response = await fetch(CRAFTMYPDF_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-API-KEY': CRAFTMYPDF_API_KEY,
        },
        body: JSON.stringify(pdfPayload),
      });

      console.log('CraftMyPDF API response status:', response.status);

      if (!response.ok) {
        let errorMessage = `PDF generation failed with status ${response.status}`;
        let errorDetails = '';
        
        try {
          const errorData = await response.json();
          console.error('CraftMyPDF API error response:', errorData);
          
          if (errorData.message) {
            errorDetails = errorData.message;
          } else if (errorData.error) {
            errorDetails = errorData.error;
          } else if (errorData.errors && Array.isArray(errorData.errors)) {
            errorDetails = errorData.errors.join(', ');
          }
        } catch (parseError) {
          const errorText = await response.text();
          console.error('CraftMyPDF API error text:', errorText);
          if (errorText) {
            errorDetails = errorText;
          }
        }
        
        const fullErrorMessage = `${errorMessage}\n\nError Details:\n${errorDetails}`;
        throw new Error(fullErrorMessage);
      }

      const result = await response.json();
      console.log('PDF generated successfully:', result);

      // Extract PDF URL from response
      const pdfUrl = result.file || result.url || result.pdf_url;

      if (!pdfUrl) {
        console.error('No PDF URL in response:', result);
        throw new Error('PDF URL not found in response');
      }

      console.log('PDF URL received:', pdfUrl);

      // 1. Save PDF URL to Supabase
      console.log('Saving PDF URL to Supabase');
      const { error: pdfUrlUpdateError } = await supabase
        .from('reports')
        .update({ 
          pdf_url: pdfUrl,
          status: 'COMPLETED'
        })
        .eq('id', id);

      if (pdfUrlUpdateError) {
        console.error('Error saving PDF URL to Supabase:', pdfUrlUpdateError);
        showAlert('Warning', 'PDF generated but failed to save URL to database', 'error');
      } else {
        console.log('PDF URL saved successfully to Supabase');
      }

      // 2. Trigger email with PDF attachment
      console.log('Triggering email to:', user.email);
      try {
        await sendPdfEmail(user.email, pdfUrl, id as string, report.address);
        console.log('Email sent successfully');
      } catch (emailError: any) {
        console.error('Error sending email:', emailError);
        // Don't fail the whole operation if email fails
      }

      // Open the PDF URL
      console.log('Opening PDF URL:', pdfUrl);
      const canOpen = await Linking.canOpenURL(pdfUrl);
      if (canOpen) {
        await Linking.openURL(pdfUrl);
        showAlert('Success', 'PDF generated successfully! An email with the PDF has been sent to your address.', 'success');
      } else {
        console.error('Cannot open URL:', pdfUrl);
        showAlert('Success', 'PDF generated and saved! An email with the PDF has been sent to your address.', 'success');
      }
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      showAlert('PDF Generation Error', error.message || 'Failed to generate PDF. Please check your Template ID and API Key.', 'error');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const getTypeText = (type: string) => {
    if (type === 'Einzug') return 'Einzug (Move In)';
    if (type === 'Auszug') return 'Auszug (Move Out)';
    if (type === 'move_in') return 'Einzug (Move In)';
    if (type === 'move_out') return 'Auszug (Move Out)';
    return type;
  };

  // Show loading state
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

  // Show error with Retry button
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
  const hasRooms = rooms.length > 0;

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

          <TouchableOpacity
            style={[styles.pdfButton, generatingPDF && styles.pdfButtonDisabled]}
            onPress={handleOpenFinalDetails}
            disabled={generatingPDF}
          >
            {generatingPDF ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.pdfButtonText}>Processing...</Text>
              </>
            ) : (
              <>
                <IconSymbol
                  ios_icon_name="doc.fill"
                  android_material_icon_name="description"
                  size={24}
                  color="#FFFFFF"
                />
                <Text style={styles.pdfButtonText}>Create Official Protocol</Text>
              </>
            )}
          </TouchableOpacity>

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

            {!hasRooms && (
              <View style={styles.emptyState}>
                <IconSymbol
                  ios_icon_name="door.left.hand.open"
                  android_material_icon_name="meeting-room"
                  size={48}
                  color={colors.textSecondary}
                />
                <Text style={styles.emptyText}>No rooms added yet</Text>
              </View>
            )}

            {hasRooms && (
              <View style={styles.roomsList}>
                {rooms.map((room) => (
                  <TouchableOpacity
                    key={room.id}
                    style={styles.roomCard}
                    onPress={() => handleOpenRoom(room.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.roomCardHeader}>
                      <View style={styles.roomCardTitleContainer}>
                        <Text style={styles.roomCardTitleDe}>{room.name_de}</Text>
                        <Text style={styles.roomCardTitleEn}>{room.name_en}</Text>
                      </View>
                      <IconSymbol
                        ios_icon_name="chevron.right"
                        android_material_icon_name="chevron-right"
                        size={20}
                        color={colors.textSecondary}
                      />
                    </View>
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
                    {ROOM_PRESETS.map((preset) => {
                      const isSelected = selectedRoomPreset?.nameEn === preset.nameEn;
                      return (
                        <TouchableOpacity
                          key={preset.nameEn}
                          style={[
                            styles.presetButton,
                            isSelected && styles.presetButtonActive,
                          ]}
                          onPress={() => {
                            console.log('User selected room preset:', preset.nameDe);
                            setSelectedRoomPreset(preset);
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
              </ScrollView>

              <TouchableOpacity
                style={[
                  styles.modalSaveButton,
                  (!selectedRoomPreset || savingRoom) && styles.modalSaveButtonDisabled,
                ]}
                onPress={handleAddRoom}
                disabled={!selectedRoomPreset || savingRoom}
              >
                {savingRoom ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveButtonText}>Add Room</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Final Details Modal */}
        <Modal
          visible={showFinalDetailsModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowFinalDetailsModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Final Details</Text>
                <TouchableOpacity onPress={() => setShowFinalDetailsModal(false)}>
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
                  <Text style={styles.sectionSubtitle}>Handover Type</Text>
                  <View style={styles.checkboxContainer}>
                    <TouchableOpacity
                      style={styles.checkboxRow}
                      onPress={() => setIsMoveIn(!isMoveIn)}
                    >
                      <View style={[styles.checkbox, isMoveIn && styles.checkboxChecked]}>
                        {isMoveIn && (
                          <IconSymbol
                            ios_icon_name="checkmark"
                            android_material_icon_name="check"
                            size={16}
                            color="#FFFFFF"
                          />
                        )}
                      </View>
                      <Text style={styles.checkboxLabel}>Vor dem Einzug (Move-in)</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.checkboxRow}
                      onPress={() => setIsMoveOut(!isMoveOut)}
                    >
                      <View style={[styles.checkbox, isMoveOut && styles.checkboxChecked]}>
                        {isMoveOut && (
                          <IconSymbol
                            ios_icon_name="checkmark"
                            android_material_icon_name="check"
                            size={16}
                            color="#FFFFFF"
                          />
                        )}
                      </View>
                      <Text style={styles.checkboxLabel}>Vor dem Auszug (Move-out)</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.sectionSubtitle}>Meter Readings</Text>
                  
                  <Text style={styles.meterLabel}>Strom (Electricity)</Text>
                  <View style={styles.meterRow}>
                    <View style={styles.meterInputContainer}>
                      <Text style={styles.meterInputLabel}>Zählernummer</Text>
                      <TextInput
                        style={styles.meterInput}
                        placeholder="Number"
                        value={electricityNo}
                        onChangeText={setElectricityNo}
                      />
                    </View>
                    <View style={styles.meterInputContainer}>
                      <Text style={styles.meterInputLabel}>Stand</Text>
                      <TextInput
                        style={styles.meterInput}
                        placeholder="Reading"
                        value={electricityVal}
                        onChangeText={setElectricityVal}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <Text style={styles.meterLabel}>Gas</Text>
                  <View style={styles.meterRow}>
                    <View style={styles.meterInputContainer}>
                      <Text style={styles.meterInputLabel}>Zählernummer</Text>
                      <TextInput
                        style={styles.meterInput}
                        placeholder="Number"
                        value={gasNo}
                        onChangeText={setGasNo}
                      />
                    </View>
                    <View style={styles.meterInputContainer}>
                      <Text style={styles.meterInputLabel}>Stand</Text>
                      <TextInput
                        style={styles.meterInput}
                        placeholder="Reading"
                        value={gasVal}
                        onChangeText={setGasVal}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <Text style={styles.meterLabel}>Wasser (Water)</Text>
                  <View style={styles.meterRow}>
                    <View style={styles.meterInputContainer}>
                      <Text style={styles.meterInputLabel}>Zählernummer</Text>
                      <TextInput
                        style={styles.meterInput}
                        placeholder="Number"
                        value={waterNo}
                        onChangeText={setWaterNo}
                      />
                    </View>
                    <View style={styles.meterInputContainer}>
                      <Text style={styles.meterInputLabel}>Stand</Text>
                      <TextInput
                        style={styles.meterInput}
                        placeholder="Reading"
                        value={waterVal}
                        onChangeText={setWaterVal}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <Text style={styles.meterLabel}>Heizung (Heating)</Text>
                  <View style={styles.meterRow}>
                    <View style={styles.meterInputContainer}>
                      <Text style={styles.meterInputLabel}>Zählernummer</Text>
                      <TextInput
                        style={styles.meterInput}
                        placeholder="Number"
                        value={heatingNo}
                        onChangeText={setHeatingNo}
                      />
                    </View>
                    <View style={styles.meterInputContainer}>
                      <Text style={styles.meterInputLabel}>Stand</Text>
                      <TextInput
                        style={styles.meterInput}
                        placeholder="Reading"
                        value={heatingVal}
                        onChangeText={setHeatingVal}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.sectionSubtitle}>Schlüssel (Keys)</Text>
                  <TextInput
                    style={[commonStyles.input, styles.keysInput]}
                    placeholder="e.g., 3 House, 2 Mailbox"
                    value={keysHandedOver}
                    onChangeText={setKeysHandedOver}
                    multiline
                    numberOfLines={2}
                  />
                </View>
              </ScrollView>

              <TouchableOpacity
                style={[
                  styles.modalSaveButton,
                  generatingPDF && styles.modalSaveButtonDisabled,
                ]}
                onPress={handleGeneratePDF}
                disabled={generatingPDF}
              >
                {generatingPDF ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveButtonText}>Create Official Protocol</Text>
                )}
              </TouchableOpacity>
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
    borderRadius: 0,
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
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.primary,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 0,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pdfButtonDisabled: {
    backgroundColor: colors.textSecondary,
    opacity: 0.6,
  },
  pdfButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
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
    borderRadius: 0,
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
  roomCard: {
    backgroundColor: colors.card,
    borderRadius: 0,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roomCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomCardTitleContainer: {
    flex: 1,
  },
  roomCardTitleDe: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  roomCardTitleEn: {
    fontSize: 14,
    color: colors.textSecondary,
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
    borderRadius: 0,
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
  modalSaveButton: {
    backgroundColor: colors.primary,
    borderRadius: 0,
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
  sectionSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  checkboxContainer: {
    gap: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    fontSize: 16,
    color: colors.text,
  },
  meterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  meterRow: {
    flexDirection: 'row',
    gap: 12,
  },
  meterInputContainer: {
    flex: 1,
  },
  meterInputLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  meterInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.text,
  },
  keysInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
});
