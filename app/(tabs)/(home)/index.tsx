
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

interface Report {
  id: string;
  address: string;
  inspection_type: string;
  status: string;
  created_at: string;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // CRITICAL FIX: Use useCallback to memoize fetchReports
  const fetchReports = useCallback(async () => {
    // CRITICAL FIX: Only fetch if user exists
    if (!user || !user.id) {
      console.log('HomeScreen: No user found, cannot fetch reports');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      console.log('HomeScreen: Fetching reports from Supabase for user:', user.id);
      
      // CRITICAL FIX: Wait for session to be confirmed
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

      // Fetch reports with status 'IN PROGRESS', 'ACTIVE', or 'PENDING'
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['IN PROGRESS', 'ACTIVE', 'PENDING'])
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
        console.log('HomeScreen: Loaded reports:', data?.length || 0);
        setReports(data || []);
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
    
    // CRITICAL FIX: Only fetch reports if user exists
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
    if (upperStatus === 'IN PROGRESS' || upperStatus === 'ACTIVE' || upperStatus === 'PENDING') {
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
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'Inspections' }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'Inspections' }} />
        <Text style={styles.errorText}>Please log in to view inspections</Text>
      </View>
    );
  }

  return (
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

              return (
                <TouchableOpacity
                  key={report.id}
                  style={styles.inspectionCard}
                  onPress={() => handleOpenInspection(report.id)}
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
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
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
    marginBottom: 16,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
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
  inspectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    ...commonStyles.shadow,
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
    borderRadius: 4,
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
