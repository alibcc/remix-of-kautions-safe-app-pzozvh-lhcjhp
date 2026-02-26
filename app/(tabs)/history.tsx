
import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from "react-native";
import { Stack } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";
import { colors, commonStyles } from "@/styles/commonStyles";
import { supabase } from "@/app/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AlertModal } from "@/components/ui/Modal";

interface CompletedInspection {
  id: string;
  address: string;
  inspection_type: string;
  inspection_date: string;
  pdf_url: string | null;
  created_at: string;
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const [completedInspections, setCompletedInspections] = useState<CompletedInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
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

  const fetchCompletedInspections = useCallback(async () => {
    if (!user || !user.id) {
      console.log('HistoryScreen: No user found, cannot fetch inspections');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      console.log('HistoryScreen: Fetching completed inspections for user:', user.id);

      // CRITICAL FIX #3: Query reports table correctly with user_id filter
      const { data, error } = await supabase
        .from('reports')
        .select('id, address, inspection_type, inspection_date, pdf_url, created_at')
        .eq('user_id', user.id)
        .eq('status', 'COMPLETED')
        .not('pdf_url', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('HistoryScreen: Error fetching completed inspections:', error);
        showAlert('Error', `Failed to load history: ${error.message}`, 'error');
        setCompletedInspections([]);
      } else {
        console.log('HistoryScreen: Loaded completed inspections:', data?.length || 0);
        setCompletedInspections(data || []);
      }
    } catch (error: any) {
      console.error('HistoryScreen: Unexpected error loading history:', error);
      showAlert('Error', `Failed to load history: ${error.message}`, 'error');
      setCompletedInspections([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    console.log('HistoryScreen: Checking user authentication');
    
    if (!user) {
      console.log('HistoryScreen: No user found, staying in loading state');
      setLoading(false);
      return;
    }
    
    console.log('HistoryScreen: User is authenticated, loading history');
    fetchCompletedInspections();
  }, [user, fetchCompletedInspections]);

  const handleRefresh = () => {
    console.log('HistoryScreen: User pulled to refresh');
    setRefreshing(true);
    fetchCompletedInspections();
  };

  const handleReopenPdf = async (url: string, address: string) => {
    console.log('HistoryScreen: User tapped Re-open PDF button for:', address);
    
    if (!url) {
      showAlert('Error', 'PDF URL is not available', 'error');
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        console.log('HistoryScreen: PDF opened successfully');
      } else {
        console.error('HistoryScreen: Cannot open URL:', url);
        showAlert('Error', 'Cannot open PDF URL. Please check your device settings.', 'error');
      }
    } catch (error: any) {
      console.error('HistoryScreen: Error opening PDF:', error);
      showAlert('Error', `Failed to open PDF: ${error.message}`, 'error');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'short' });
    const year = date.getFullYear();
    const formattedDate = `${day} ${month} ${year}`;
    return formattedDate;
  };

  const getTypeText = (type: string) => {
    if (type === 'Einzug') return 'Move In';
    if (type === 'Auszug') return 'Move Out';
    if (type === 'move_in') return 'Move In';
    if (type === 'move_out') return 'Move Out';
    return type;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'History' }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'History' }} />
        <Text style={styles.errorText}>Please log in to view history</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'History' }} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Completed Inspections</Text>
          <Text style={styles.headerSubtitle}>
            View and download your completed inspection reports
          </Text>
        </View>

        {completedInspections.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol
              ios_icon_name="doc.text"
              android_material_icon_name="description"
              size={64}
              color="#ccc"
            />
            <Text style={styles.emptyStateTitle}>No Completed Inspections</Text>
            <Text style={styles.emptyStateText}>
              Completed inspections with generated PDFs will appear here
            </Text>
          </View>
        ) : (
          <View style={styles.inspectionsList}>
            {completedInspections.map((inspection) => {
              const typeText = getTypeText(inspection.inspection_type);
              const formattedDate = formatDate(inspection.inspection_date || inspection.created_at);

              return (
                <View key={inspection.id} style={styles.inspectionCard}>
                  <View style={styles.inspectionHeader}>
                    <View style={styles.inspectionIconContainer}>
                      <IconSymbol
                        ios_icon_name="doc.fill"
                        android_material_icon_name="description"
                        size={32}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.inspectionInfo}>
                      <Text style={styles.inspectionAddress}>
                        {inspection.address}
                      </Text>
                      <View style={styles.inspectionDetails}>
                        <View style={styles.detailRow}>
                          <IconSymbol
                            ios_icon_name="calendar"
                            android_material_icon_name="calendar-today"
                            size={14}
                            color="#666"
                          />
                          <Text style={styles.detailText}>{formattedDate}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <IconSymbol
                            ios_icon_name="house"
                            android_material_icon_name="home"
                            size={14}
                            color="#666"
                          />
                          <Text style={styles.detailText}>{typeText}</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {inspection.pdf_url && (
                    <TouchableOpacity
                      style={styles.reopenButton}
                      onPress={() => handleReopenPdf(inspection.pdf_url!, inspection.address)}
                      activeOpacity={0.7}
                    >
                      <IconSymbol
                        ios_icon_name="arrow.down.doc"
                        android_material_icon_name="download"
                        size={20}
                        color="#FFFFFF"
                      />
                      <Text style={styles.reopenButtonText}>Re-open PDF</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <AlertModal
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        type={alertType}
        onClose={() => setAlertVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  inspectionsList: {
    gap: 16,
  },
  inspectionCard: {
    backgroundColor: '#fff',
    borderRadius: 0,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inspectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  inspectionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 0,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  inspectionInfo: {
    flex: 1,
  },
  inspectionAddress: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  inspectionDetails: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
  reopenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 0,
  },
  reopenButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
