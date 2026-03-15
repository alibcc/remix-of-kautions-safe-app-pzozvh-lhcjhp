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
  const [photos, setPhotos] = useState<Photo[]>([])