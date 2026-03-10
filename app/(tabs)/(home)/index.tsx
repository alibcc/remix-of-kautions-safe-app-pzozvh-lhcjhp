
import React, { useState, useEffect, useCallback } from "react";
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { Stack, useRouter } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";
import { colors, commonStyles } from "@/styles/commonStyles";
import { supabase } from "@/app/integrations/supabase/client";
import { AlertModal, ConfirmModal } from "@/components/ui/Modal";
import { SafeAreaView } from 'react-native-safe-area-context';

interface Report {
  id: string;
  address: string;
  inspection_type: string;
  status: string;
  created_at: string;
  roomCount?: number;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<Report | null>(null);
  const [deletingReport, setDeletingReport] = useState(false);
  
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

  // MEGA-FIX #1: Show ALL reports regardless of status or PDF presence
  const fetchReports = useCallback(async () => {
    if (!user || !user.id) {
      console.log('HomeScreen: No user found, cannot fetch reports');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      console.log('HomeScreen: Fetching ALL reports from Supabase for user:', user.id);
      
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('HomeScreen: Session error:', sessionError);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (!sessionData.session) {
        console.log('HomeScreen: No active session, cannot fetch reports');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      console.log('HomeScreen: Session confirmed, fetching reports');

      // MEGA-FIX #1: Remove ALL filters - show every report
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('HomeScreen: Supabase error fetching reports:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        setReports([]);
      } else {
        console.log('HomeScreen: Loaded ALL reports (no filters):', data?.length || 0);
        
        // Fetch room count for each report
        const reportsWithRoomCount = await Promise.all(
          (data || []).map(async (report) => {
            const { count, error: countError } = await supabase
              .from('rooms')
              .select('*', { count: 'exact', head: true })
              .eq('report_id', report.id);
            
            if (countError) {
              console.error(`Error fetching room count for report ${report.id}:`, countError);
              return { ...report, roomCount: 0 };
            }
            
            return { ...report, roomCount: count || 0 };
          })
        );
        
        setReports(reportsWithRoomCount);
      }
    } catch (error: any) {
      console.error('HomeScreen: Unexpected error loading reports:', error);
      setReports([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    console.log('HomeScreen: Checking user authentication');
    
    if (!user) {
      console.log('HomeScreen: No user found, staying in loading state');
      setLoading(false);
      return;
    }
    
    console.log('HomeScreen: User is authenticated, loading reports');
    fetchReports();
  }, [user, fetchReports]);

  const handleRefresh = () => {
    console.log('HomeScreen: User pulled to refresh');
    setRefreshing(true);
    fetchReports();
  };

  const handleCreateInspection = () => {
    console.log('HomeScreen: User tapped Create Inspection button');
    router.push('/new-inspection');
  };

  const handleOpenInspection = (id: string) => {
    console.log('HomeScreen: User tapped inspection:', id);
    router.push(`/inspection/${id}`);
  };

  const handleDeleteReport = (report: Report) => {
    console.log('HomeScreen: User tapped delete button for report:', report.id);
    setReportToDelete(report);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteReport = async () => {
    if (!reportToDelete) return;

    console.log('HomeScreen: Deleting report:', reportToDelete.id);
    setDeletingReport(true);

    try {
      const { error: deleteError } = await supabase
        .from('reports')
        .delete()
        .eq('id', reportToDelete.id);

      if (deleteError) {
        console.error('HomeScreen: Error deleting report:', deleteError);
        showAlert('Error', `Failed to delete inspection: ${deleteError.message}`, 'error');
        return;
      }

      console.log('HomeScreen: Report deleted successfully');
      
      setShowDeleteConfirm(false);
      setReportToDelete(null);
      
      showAlert('Success', 'Inspection deleted successfully', 'success');

      await fetchReports();
    } catch (error: any) {
      console.error('HomeScreen: Unexpected error deleting report:', error);
      showAlert('Error', `Failed to delete inspection: ${error.message}`, 'error');
    } finally {
      setDeletingReport(false);
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

  const getStatusColor = (status: string) => {
    const upperStatus = status.toUpperCase();
    if (upperStatus === 'IN PROGRESS' || upperStatus === 'ACTIVE' || upperStatus === 'PENDING' || upperStatus === 'DRAFT') {
      return '#FFA500';
    }
    if (upperStatus === 'COMPLETED') {
      return '#4CAF50';
    }
    if (upperStatus === 'EXPORTED') {
      return '#2196F3';
    }
    return '#999';
  };

  const getStatusText = (status: string) => {
    const upperStatus = status.toUpperCase();
    if (upperStatus === 'IN PROGRESS' || upperStatus === 'ACTIVE' || upperStatus === 'PENDING') {
      return 'In Progress';
    }
    if (upperStatus === 'COMPLETED') {
      return 'Completed';
    }
    if (upperStatus === 'EXPORTED') {
      return 'Exported';
    }
    if (upperStatus === 'DRAFT') {
      return 'Draft';
    }
    return status;
  };

  const getTypeText = (type: string) => {
    if (type === 'Einzug') {
      return 'Move In';
    }
    if (type === 'Auszug') {
      return 'Move Out';
    }
    if (type === 'move_in') {
      return 'Move In';
    }
    if (type === 'move_out') {
      return 'Move Out';
    }
    return type;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <Stack.Screen options={{ title: 'Inspections' }} />
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <Stack.Screen options={{ title: 'Inspections' }} />
          <Text style={styles.errorText}>Please log in to view inspections</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Inspections' }} />
        
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>My Inspections</Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={handleCreateInspection}
            >
              <IconSymbol
                ios_icon_name="plus"
                android_material_icon_name="add"
                size={20}
                color="#fff"
              />
              <Text style={styles.createButtonText}>New Inspection</Text>
            </TouchableOpacity>
          </View>

          {reports.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="doc.text"
                android_material_icon_name="description"
                size={64}
                color="#ccc"
              />
              <Text style={styles.emptyStateTitle}>No Inspections Yet</Text>
              <Text style={styles.emptyStateText}>
                Create your first apartment inspection to get started
              </Text>
            </View>
          ) : (
            <View style={styles.inspectionsList}>
              {reports.map((report) => {
                const statusColor = getStatusColor(report.status);
                const statusText = getStatusText(report.status);
                const typeText = getTypeText(report.inspection_type);
                const formattedDate = formatDate(report.created_at);
                const roomCountText = `${report.roomCount || 0} Room${report.roomCount === 1 ? '' : 's'}`;

                return (
                  <View key={report.id} style={styles.inspectionCardWrapper}>
                    <TouchableOpacity
                      style={styles.inspectionCard}
                      onPress={() => handleOpenInspection(report.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.inspectionHeader}>
                        <Text style={styles.inspectionAddress}>
                          {report.address}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                          <Text style={styles.statusText}>{statusText}</Text>
                        </View>
                      </View>

                      <View style={styles.inspectionDetails}>
                        <View style={styles.detailRow}>
                          <IconSymbol
                            ios_icon_name="calendar"
                            android_material_icon_name="calendar-today"
                            size={16}
                            color="#666"
                          />
                          <Text style={styles.detailText}>{formattedDate}</Text>
                        </View>

                        <View style={styles.detailRow}>
                          <IconSymbol
                            ios_icon_name="house"
                            android_material_icon_name="home"
                            size={16}
                            color="#666"
                          />
                          <Text style={styles.detailText}>{typeText}</Text>
                        </View>

                        <View style={styles.detailRow}>
                          <IconSymbol
                            ios_icon_name="door.left.hand.open"
                            android_material_icon_name="meeting-room"
                            size={16}
                            color="#666"
                          />
                          <Text style={styles.detailText}>{roomCountText}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteReport(report)}
                      activeOpacity={0.7}
                    >
                      <IconSymbol
                        ios_icon_name="trash"
                        android_material_icon_name="delete"
                        size={20}
                        color={colors.error}
                      />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        <ConfirmModal
          visible={showDeleteConfirm}
          title="Delete Inspection"
          message={`Are you sure you want to delete the inspection for "${reportToDelete?.address}"? This will permanently delete all rooms, items, and photos. This action cannot be undone.`}
          confirmText={deletingReport ? "Deleting..." : "Delete"}
          cancelText="Cancel"
          onConfirm={confirmDeleteReport}
          onCancel={() => {
            setShowDeleteConfirm(false);
            setReportToDelete(null);
          }}
          type="danger"
        />

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
    marginBottom: 16,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 0,
    gap: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  inspectionCardWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inspectionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 0,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 0,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  inspectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  inspectionAddress: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 0,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  inspectionDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
});
