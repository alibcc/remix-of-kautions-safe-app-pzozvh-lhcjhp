
import { AlertModal } from "@/components/ui/Modal";
import { sendPdfEmail } from "@/utils/api";
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

const CRAFTMYPDF_API_KEY = '9cf6Mjg1MjM6Mjg2ODQ6a3ZWUDBhZ2lGUE9CU1UzdA=';
const CRAFTMYPDF_TEMPLATE_ID = '5c477b23ea34170c';
const CRAFTMYPDF_ENDPOINT = 'https://api-de.craftmypdf.com/v1/create';
const CRAFTMYPDF_TIMEOUT = 30000;

const createDotMatrixPattern = () => {
  return `data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1' fill='%23ED7B58' opacity='0.15'/%3E%3C/svg%3E`;
};

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
  const [isMoveIn, setIsMoveIn] = useState(false);
  const [isMoveOut, setIsMoveOut] = useState(false);
  
  const [landlordSignature, setLandlordSignature] = useState<string | null>(null);
  const [tenantSignature, setTenantSignature] = useState<string | null>(null);
  const [tenantSignatureDate, setTenantSignatureDate] = useState(new Date());
  
  const landlordSignatureRef = useRef<any>(null);
  const tenantSignatureRef = useRef<any>(null);
  
  const [scrollEnabled, setScrollEnabled] = useState(true);
  
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

      await new Promise(resolve => setTimeout(resolve, 1000));

      if (!isMounted) return;

      try {
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

  const handleProceedToSignatures = () => {
    console.log('User tapped Proceed to Signatures button');
    setShowFinalDetailsModal(false);
    setShowSignatureModal(true);
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

  const handleCloseSignatureModal = () => {
    console.log('User tapped X button on signature modal - closing instantly');
    setShowSignatureModal(false);
  };

  const handleGeneratePDF = async () => {
    console.log('═══════════════════════════════════════');
    console.log('🚨 URGENT DATA MAPPING & IMAGE FIX - FINAL VERSION');
    console.log('User tapped Create Official Protocol button');
    console.log('═══════════════════════════════════════');
    
    if (!id || !report) {
      showAlert('Error', 'Report data is not available', 'error');
      return;
    }

    if (!user || !user.id) {
      showAlert('Error', 'User authentication is not available', 'error');
      return;
    }

    setGeneratingPDF(true);

    try {
      console.log('Step 1: Fetching all data for PDF generation');

      const { data: participantsData, error: participantsError } = await supabase
        .from('participants')
        .select('*')
        .eq('report_id', id);

      if (participantsError) {
        console.error('Error fetching participants:', participantsError);
      }

      const participants = participantsData || [];
      console.log('Participants fetched:', participants.length);

      const landlordParticipant = participants.find((p: Participant) => p.role === 'Landlord');
      const tenantParticipant = participants.find((p: Participant) => p.role === 'Tenant');
      
      const landlordName = landlordParticipant?.name || '';
      const tenantName = tenantParticipant?.name || '';

      console.log('═══════════════════════════════════════');
      console.log('🔧 FIX #1: COMMENT FIELD SYNC (notes → comment)');
      console.log('Fetching rooms for report_id:', id);
      console.log('═══════════════════════════════════════');

      const { data: allRoomsData, error: allRoomsError } = await supabase
        .from('rooms')
        .select('*')
        .eq('report_id', id)
        .order('name_de', { ascending: true });

      if (allRoomsError) {
        console.error('❌ Error fetching rooms:', allRoomsError);
        showAlert('Error', `Failed to fetch rooms: ${allRoomsError.message}`, 'error');
        setGeneratingPDF(false);
        return;
      }

      const allRooms = allRoomsData || [];
      console.log(`✅ Found ${allRooms.length} rooms for this report`);

      const roomsWithData = await Promise.all(
        allRooms.map(async (room) => {
          console.log(`Processing room: ${room.name_de} (${room.id})`);
          
          const { data: itemsData, error: itemsError } = await supabase
            .from('room_items')
            .select('*')
            .eq('room_id', room.id);

          if (itemsError) {
            console.error(`❌ Error fetching items for room ${room.id}:`, itemsError);
            return { 
              room_name: room.name_de || '',
              condition: 'Not Inspected',
              comment: '',
              photo_url: ''
            };
          }

          const items = itemsData || [];
          console.log(`  → Found ${items.length} items in ${room.name_de}`);
          
          console.log('🔧 FIX #1: Mapping notes field to singular "comment" key');
          const allNotesForRoom = items
            .map((item: RoomItem) => item.notes)
            .filter(Boolean)
            .join('\n');
          
          const roomComment = allNotesForRoom || '';
          console.log(`  → Room comment (aggregated notes): "${roomComment}"`);
          
          console.log('🔧 FIX #2: Getting FIRST photo URL using getPublicUrl from room-photos bucket');
          let firstPhotoUrl = '';
          
          for (const item of items) {
            const { data: photosData, error: photosError } = await supabase
              .from('photos')
              .select('*')
              .eq('item_id', item.id)
              .limit(1);

            if (photosError) {
              console.error(`❌ Error fetching photos for item ${item.id}:`, photosError);
              continue;
            }

            const photos = photosData || [];
            if (photos.length > 0 && photos[0].storage_url) {
              console.log(`    → Found photo for item "${item.item_name_de}": ${photos[0].storage_url}`);
              
              const { data: publicUrlData } = supabase.storage
                .from('room-photos')
                .getPublicUrl(photos[0].storage_url);
              
              firstPhotoUrl = publicUrlData.publicUrl || '';
              console.log(`    → Public URL generated: ${firstPhotoUrl}`);
              break;
            }
          }

          const roomCondition = items.length > 0 
            ? items.every((item: RoomItem) => item.condition_status === 'OK') ? 'OK' : 'Defects Found'
            : 'Not Inspected';

          console.log(`  → Room "${room.name_de}" final mapping:`);
          console.log(`    - room_name: ${room.name_de}`);
          console.log(`    - condition: ${roomCondition}`);
          console.log(`    - comment: "${roomComment}" (mapped from notes field)`);
          console.log(`    - photo_url: "${firstPhotoUrl}" (first photo only)`);

          return {
            room_name: room.name_de || '',
            condition: roomCondition,
            comment: roomComment,
            photo_url: firstPhotoUrl
          };
        })
      );

      console.log('✅ All rooms mapped successfully with FIXED structure');
      console.log('Total rooms for PDF:', roomsWithData.length);

      const inspectionDate = new Date(report.created_at).toLocaleDateString('de-DE');
      const tenantSigDate = tenantSignatureDate.toLocaleDateString('de-DE');

      console.log('═══════════════════════════════════════');
      console.log('🔧 FIX #3: SIGNATURE FINAL FIX - Creating SIGNED URLs');
      console.log('Using createSignedUrl with 600s expiry for BOTH signatures');
      console.log('═══════════════════════════════════════');

      let landlordSignatureUrl = '';
      let tenantSignatureUrl = '';

      if (landlordSignature) {
        try {
          const landlordSigBase64 = landlordSignature.replace(/^data:image\/\w+;base64,/, '');
          const landlordSigBuffer = decode(landlordSigBase64);
          const landlordSigPath = `${id}_landlord_${Date.now()}.png`;
          
          console.log('Uploading landlord signature to "signatures" bucket:', landlordSigPath);
          
          const { error: landlordUploadError } = await supabase.storage
            .from('signatures')
            .upload(landlordSigPath, landlordSigBuffer, {
              contentType: 'image/png',
              upsert: true,
            });

          if (landlordUploadError) {
            console.error('❌ Error uploading landlord signature:', landlordUploadError);
          } else {
            console.log('✅ Landlord signature uploaded, creating SIGNED URL (600s expiry)...');
            const { data: landlordSignedData, error: landlordSignedError } = await supabase.storage
              .from('signatures')
              .createSignedUrl(landlordSigPath, 600);
            
            if (landlordSignedError) {
              console.error('❌ Error creating signed URL for landlord signature:', landlordSignedError);
            } else if (landlordSignedData) {
              landlordSignatureUrl = landlordSignedData.signedUrl || '';
              console.log('✅ Landlord signature SIGNED URL created:', landlordSignatureUrl);
            }
          }
        } catch (sigError: any) {
          console.error('❌ Error processing landlord signature:', sigError);
        }
      }

      if (tenantSignature) {
        try {
          const tenantSigBase64 = tenantSignature.replace(/^data:image\/\w+;base64,/, '');
          const tenantSigBuffer = decode(tenantSigBase64);
          const tenantSigPath = `${id}_tenant_${Date.now()}.png`;
          
          console.log('Uploading tenant signature to "signatures" bucket:', tenantSigPath);
          
          const { error: tenantUploadError } = await supabase.storage
            .from('signatures')
            .upload(tenantSigPath, tenantSigBuffer, {
              contentType: 'image/png',
              upsert: true,
            });

          if (tenantUploadError) {
            console.error('❌ Error uploading tenant signature:', tenantUploadError);
          } else {
            console.log('✅ Tenant signature uploaded, creating SIGNED URL (600s expiry)...');
            const { data: tenantSignedData, error: tenantSignedError } = await supabase.storage
              .from('signatures')
              .createSignedUrl(tenantSigPath, 600);
            
            if (tenantSignedError) {
              console.error('❌ Error creating signed URL for tenant signature:', tenantSignedError);
            } else if (tenantSignedData) {
              tenantSignatureUrl = tenantSignedData.signedUrl || '';
              console.log('✅ Tenant signature SIGNED URL created:', tenantSignatureUrl);
            }
          }
        } catch (sigError: any) {
          console.error('❌ Error processing tenant signature:', sigError);
        }
      }

      console.log('═══════════════════════════════════════');
      console.log('Saving meter data to Supabase with user_id');
      console.log('═══════════════════════════════════════');
      
      const { error: updateError } = await supabase
        .from('reports')
        .update({
          user_id: user.id,
          electricity_no: electricityNo || '',
          electricity_val: electricityVal || '',
          gas_no: gasNo || '',
          gas_val: gasVal || '',
          water_no: waterNo || '',
          water_val: waterVal || '',
          heat_no: heatNo || '',
          heat_val: heatVal || '',
          keys_handed_over: keysHandedOver || '',
          is_move_in: isMoveIn,
          is_move_out: isMoveOut,
          tenant_signature_date: tenantSignatureDate.toISOString(),
        })
        .eq('id', id);

      if (updateError) {
        console.error('❌ Error saving data to Supabase:', updateError);
        showAlert('Error', `Failed to save data: ${updateError.message}`, 'error');
        setGeneratingPDF(false);
        return;
      } else {
        console.log('✅ Data saved successfully to Supabase with user_id');
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('═══════════════════════════════════════');
      console.log('🔧 FIX #4: DEBUGGING - Ensuring empty strings for missing values');
      console.log('Preparing CraftMyPDF payload with ALL FIXES APPLIED');
      console.log('═══════════════════════════════════════');

      const pdfPayload = {
        template_id: CRAFTMYPDF_TEMPLATE_ID,
        data: {
          property_address: report.address || '',
          tenant_name: tenantName || '',
          landlord_name: landlordName || '',
          inspection_date: inspectionDate || '',
          signature_date: tenantSigDate || '',
          is_move_in: isMoveIn,
          is_move_out: isMoveOut,
          keys_handed_over: keysHandedOver || '',
          landlord_signature: landlordSignatureUrl || '',
          tenant_signature: tenantSignatureUrl || '',
          meters: {
            electricity_no: electricityNo || '',
            electricity_val: electricityVal || '',
            gas_no: gasNo || '',
            gas_val: gasVal || '',
            water_no: waterNo || '',
            water_val: waterVal || '',
            heat_no: heatNo || '',
            heat_val: heatVal || ''
          },
          rooms: roomsWithData,
        },
        load_data_from_url: false,
      };

      console.log('✅ PDF Payload prepared with ALL FIXES:');
      console.log('  - Rooms count:', roomsWithData.length);
      console.log('  - Landlord signature URL (TOP LEVEL):', landlordSignatureUrl ? 'Present (Signed URL)' : 'Empty string');
      console.log('  - Tenant signature URL (TOP LEVEL):', tenantSignatureUrl ? 'Present (Signed URL)' : 'Empty string');
      roomsWithData.forEach((room, index) => {
        console.log(`  - Room ${index + 1}:`);
        console.log(`    • room_name: ${room.room_name}`);
        console.log(`    • condition: ${room.condition}`);
        console.log(`    • comment: "${room.comment}" (singular, from notes field)`);
        console.log(`    • photo_url: "${room.photo_url}" (first photo only)`);
      });

      console.log('═══════════════════════════════════════');
      console.log('Calling CraftMyPDF API');
      console.log('Endpoint:', CRAFTMYPDF_ENDPOINT);
      console.log('═══════════════════════════════════════');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CRAFTMYPDF_TIMEOUT);

      try {
        const response = await fetch(CRAFTMYPDF_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-API-KEY': CRAFTMYPDF_API_KEY,
          },
          body: JSON.stringify(pdfPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

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
          
          const fullErrorMessage = errorDetails || errorMessage;
          throw new Error(fullErrorMessage);
        }

        const result = await response.json();
        console.log('CraftMyPDF returned JSON response:', result);
        
        const pdfUrl = result.file || result.url || result.pdf_url || result.file_url;

        if (!pdfUrl) {
          console.error('No PDF URL in response:', result);
          throw new Error('PDF URL not found in response');
        }

        console.log('✅ PDF URL received from CraftMyPDF:', pdfUrl);

        console.log('═══════════════════════════════════════');
        console.log('Opening PDF directly in native browser');
        console.log('═══════════════════════════════════════');

        const { error: pdfUrlUpdateError } = await supabase
          .from('reports')
          .update({ 
            pdf_url: pdfUrl,
            status: 'COMPLETED'
          })
          .eq('id', id);

        if (pdfUrlUpdateError) {
          console.error('❌ Error saving PDF URL to Supabase:', pdfUrlUpdateError);
        } else {
          console.log('✅ PDF URL saved successfully to Supabase');
        }

        await new Promise(resolve => setTimeout(resolve, 2000));

        setShowSignatureModal(false);

        console.log('Opening PDF in native browser:', pdfUrl);
        const canOpen = await Linking.canOpenURL(pdfUrl);
        if (canOpen) {
          await Linking.openURL(pdfUrl);
          console.log('✅ PDF opened successfully in native browser');
          showAlert('Success', 'PDF generated successfully! Opening in your browser...', 'success');
        } else {
          console.error('Cannot open URL:', pdfUrl);
          showAlert('Error', 'Cannot open PDF URL. Please check your device settings.', 'error');
        }

        console.log('═══════════════════════════════════════');
        console.log('✅✅✅ PDF GENERATION COMPLETE - ALL URGENT FIXES APPLIED ✅✅✅');
        console.log('✅ FIX #1: Comment field synced (notes → comment singular)');
        console.log('✅ FIX #2: Room photo fixed (photo_url from room-photos bucket, first photo only)');
        console.log('✅ FIX #3: Signatures using createSignedUrl (600s expiry, TOP LEVEL)');
        console.log('✅ FIX #4: Empty strings for all missing values (no undefined)');
        console.log('═══════════════════════════════════════');
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('PDF generation timed out after 30 seconds. Please try again.');
        }
        throw fetchError;
      }
    } catch (error: any) {
      console.error('❌ Error generating PDF:', error);
      showAlert('PDF Generation Error', error.message || 'Failed to generate PDF. Please check your Template ID and API Key.', 'error');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleBackToList = () => {
    console.log('User tapped Back button - navigating to inspection list');
    router.back();
  };

  const getTypeText = (type: string) => {
    if (type === 'Einzug') return 'Einzug (Move In)';
    if (type === 'Auszug') return 'Auszug (Move Out)';
    if (type === 'move_in') return 'Einzug (Move In)';
    if (type === 'move_out') return 'Auszug (Move Out)';
    return type;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
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
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
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
      </SafeAreaView>
    );
  }

  if (!report) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
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
      </SafeAreaView>
    );
  }

  const typeText = getTypeText(report.inspection_type);
  const hasRooms = rooms.length > 0;
  const hasRoomsWithoutConditions = rooms.length > 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
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
            style={styles.pdfButton}
            onPress={handleOpenFinalDetails}
          >
            <IconSymbol
              ios_icon_name="doc.fill"
              android_material_icon_name="description"
              size={24}
              color="#FFFFFF"
            />
            <Text style={styles.pdfButtonText}>Create Official Protocol</Text>
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

            {hasRoomsWithoutConditions && (
              <ImageBackground
                source={{ uri: createDotMatrixPattern() }}
                style={styles.onboardingTip}
                imageStyle={{ opacity: 0.3 }}
              >
                <IconSymbol
                  ios_icon_name="lightbulb.fill"
                  android_material_icon_name="lightbulb"
                  size={20}
                  color={colors.primary}
                />
                <View style={styles.onboardingTipTextContainer}>
                  <Text style={styles.onboardingTipTextDe}>
                    Tipp: Klicken Sie auf einen Raum, um Zustände zu protokollieren und Fotos hinzuzufügen.
                  </Text>
                  <Text style={styles.onboardingTipTextEn}>
                    Tip: Click on a room to log conditions and add photos.
                  </Text>
                </View>
              </ImageBackground>
            )}

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

          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackToList}
          >
            <IconSymbol
              ios_icon_name="arrow.left"
              android_material_icon_name="arrow-back"
              size={20}
              color={colors.primary}
            />
            <Text style={styles.backButtonText}>Back to List</Text>
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

        <Modal
          visible={showFinalDetailsModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowFinalDetailsModal(false)}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <View style={styles.modalOverlay}>
              <ImageBackground
                source={{ uri: createDotMatrixPattern() }}
                style={styles.modalContent}
                imageStyle={{ opacity: 0.2 }}
              >
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
                        value={heatNo}
                        onChangeText={setHeatNo}
                      />
                    </View>
                    <View style={styles.meterInputContainer}>
                      <Text style={styles.meterInputLabel}>Stand</Text>
                      <TextInput
                        style={styles.meterInput}
                        placeholder="Reading"
                        value={heatVal}
                        onChangeText={setHeatVal}
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
                style={styles.modalSaveButton}
                onPress={handleProceedToSignatures}
              >
                <Text style={styles.modalSaveButtonText}>Proceed to Signatures</Text>
              </TouchableOpacity>
              </ImageBackground>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal
          visible={showSignatureModal}
          animationType="slide"
          transparent={false}
          onRequestClose={handleCloseSignatureModal}
        >
          <SafeAreaView style={styles.signatureSafeArea} edges={['top', 'bottom']}>
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
              <View style={styles.signatureModalContainer}>
                <View style={styles.signatureModalHeader}>
                  <Text style={styles.signatureModalTitle}>Digital Signatures</Text>
                  <TouchableOpacity onPress={handleCloseSignatureModal}>
                    <IconSymbol
                      ios_icon_name="xmark.circle.fill"
                      android_material_icon_name="close"
                      size={28}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>

                <ScrollView 
                  style={styles.signatureScrollView} 
                  contentContainerStyle={styles.signatureScrollContent}
                  scrollEnabled={scrollEnabled}
                  nestedScrollEnabled={true}
                >
                  <View style={styles.signatureSection}>
                    <Text style={styles.signatureLabel}>Vermieter (Landlord) Signature</Text>
                    <View 
                      style={styles.signatureCanvasContainer}
                      onStartShouldSetResponder={() => {
                        console.log('Landlord signature pad touched - disabling scroll');
                        setScrollEnabled(false);
                        return true;
                      }}
                      onResponderRelease={() => {
                        console.log('Landlord signature pad released - enabling scroll');
                        setScrollEnabled(true);
                      }}
                    >
                      <SignatureCanvas
                        ref={landlordSignatureRef}
                        onOK={(signature) => {
                          console.log('Landlord signature captured');
                          setLandlordSignature(signature);
                        }}
                        onEmpty={() => console.log('Landlord signature is empty')}
                        descriptionText="Sign above"
                        clearText="Clear"
                        confirmText="Save"
                        webStyle={`.m-signature-pad {box-shadow: none; border: 1px solid ${colors.border};} .m-signature-pad--body {border: none;} .m-signature-pad--footer {display: none;}`}
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
                        <Text style={styles.signatureConfirmationText}>Signature captured</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.clearSignatureButton}
                      onPress={handleClearLandlordSignature}
                    >
                      <Text style={styles.clearSignatureButtonText}>CLEAR</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.signatureSection}>
                    <Text style={styles.signatureLabel}>Mieter (Tenant) Signature</Text>
                    <View 
                      style={styles.signatureCanvasContainer}
                      onStartShouldSetResponder={() => {
                        console.log('Tenant signature pad touched - disabling scroll');
                        setScrollEnabled(false);
                        return true;
                      }}
                      onResponderRelease={() => {
                        console.log('Tenant signature pad released - enabling scroll');
                        setScrollEnabled(true);
                      }}
                    >
                      <SignatureCanvas
                        ref={tenantSignatureRef}
                        onOK={(signature) => {
                          console.log('Tenant signature captured');
                          setTenantSignature(signature);
                        }}
                        onEmpty={() => console.log('Tenant signature is empty')}
                        descriptionText="Sign above"
                        clearText="Clear"
                        confirmText="Save"
                        webStyle={`.m-signature-pad {box-shadow: none; border: 1px solid ${colors.border};} .m-signature-pad--body {border: none;} .m-signature-pad--footer {display: none;}`}
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
                        <Text style={styles.signatureConfirmationText}>Signature captured</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.clearSignatureButton}
                      onPress={handleClearTenantSignature}
                    >
                      <Text style={styles.clearSignatureButtonText}>CLEAR</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.signatureSection}>
                    <Text style={styles.signatureLabel}>Tenant Signature Date</Text>
                    <DateTimePicker
                      value={tenantSignatureDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(event, selectedDate) => {
                        if (selectedDate) {
                          console.log('Tenant signature date selected:', selectedDate);
                          setTenantSignatureDate(selectedDate);
                        }
                      }}
                      style={styles.datePicker}
                    />
                    <Text style={styles.dateDisplay}>
                      Selected: {tenantSignatureDate.toLocaleDateString('de-DE')}
                    </Text>
                  </View>
                </ScrollView>

                <View style={styles.signatureModalFooter}>
                  <TouchableOpacity
                    style={styles.generatePdfButton}
                    onPress={handleGeneratePDF}
                    disabled={generatingPDF}
                  >
                    {generatingPDF ? (
                      <>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text style={styles.generatePdfButtonText}>Generating...</Text>
                      </>
                    ) : (
                      <>
                        <IconSymbol
                          ios_icon_name="doc.fill"
                          android_material_icon_name="description"
                          size={24}
                          color="#FFFFFF"
                        />
                        <Text style={styles.generatePdfButtonText}>Create Official Protocol</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>

        <AlertModal
          visible={alertVisible}
          title={alertTitle}
          message={alertMessage}
          type={alertType}
          onClose={() => setAlertVisible(false)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  signatureSafeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
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
  onboardingTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFF9E6',
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    padding: 12,
    marginBottom: 16,
    borderRadius: 0,
    overflow: 'hidden',
  },
  onboardingTipTextContainer: {
    flex: 1,
  },
  onboardingTipTextDe: {
    fontSize: 14,
    color: '#8B6914',
    lineHeight: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  onboardingTipTextEn: {
    fontSize: 13,
    color: '#A0825A',
    lineHeight: 18,
    fontStyle: 'italic',
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.card,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 0,
    marginTop: 24,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 16,
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
  signatureModalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  signatureModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  signatureModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  signatureScrollView: {
    flex: 1,
  },
  signatureScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  signatureSection: {
    marginBottom: 32,
  },
  signatureLabel: {
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
  signatureConfirmationText: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '600',
  },
  clearSignatureButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 0,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  clearSignatureButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  datePicker: {
    width: '100%',
    backgroundColor: colors.card,
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
  signatureModalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  generatePdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.primary,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 0,
  },
  generatePdfButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
