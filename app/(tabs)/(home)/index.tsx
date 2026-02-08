
import React, { useState, useEffect } from "react";
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
import { authenticatedGet } from "@/utils/api";

interface Inspection {
  id: string;
  propertyAddress: string;
  inspectionType: string;
  status: string;
  createdAt: string;
  roomCount: number;
  meterCount: number;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      console.log('HomeScreen: User is authenticated, loading inspections');
      loadInspections();
    }
  }, [user]);

  const loadInspections = async () => {
    try {
      console.log('HomeScreen: Fetching inspections from API');
      const data = await authenticatedGet<Inspection[]>('/api/inspections');
      console.log('HomeScreen: Loaded inspections:', data.length);
      setInspections(data);
    } catch (error) {
      console.error('HomeScreen: Failed to load inspections:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    console.log('HomeScreen: User pulled to refresh');
    setRefreshing(true);
    loadInspections();
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
    return `${day} ${month} ${year}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return '#FFA500';
      case 'completed':
        return '#4CAF50';
      case 'exported':
        return '#2196F3';
      default:
        return '#999';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Draft';
      case 'completed':
        return 'Completed';
      case 'exported':
        return 'Exported';
      default:
        return status;
    }
  };

  const getTypeText = (type: string) => {
    switch (type) {
      case 'move_in':
        return 'Move In';
      case 'move_out':
        return 'Move Out';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'Inspections' }} />
        <ActivityIndicator size="large" color={colors.primary} />
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

        {inspections.length === 0 ? (
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
            {inspections.map((inspection) => {
              const statusColor = getStatusColor(inspection.status);
              const statusText = getStatusText(inspection.status);
              const typeText = getTypeText(inspection.inspectionType);
              const formattedDate = formatDate(inspection.createdAt);

              return (
                <TouchableOpacity
                  key={inspection.id}
                  style={styles.inspectionCard}
                  onPress={() => handleOpenInspection(inspection.id)}
                >
                  <View style={styles.inspectionHeader}>
                    <Text style={styles.inspectionAddress}>
                      {inspection.propertyAddress}
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

                  <View style={styles.inspectionFooter}>
                    <View style={styles.countBadge}>
                      <IconSymbol
                        ios_icon_name="door.left.hand.open"
                        android_material_icon_name="meeting-room"
                        size={16}
                        color="#666"
                      />
                      <Text style={styles.countText}>{inspection.roomCount}</Text>
                      <Text style={styles.countLabel}>rooms</Text>
                    </View>

                    <View style={styles.countBadge}>
                      <IconSymbol
                        ios_icon_name="gauge"
                        android_material_icon_name="speed"
                        size={16}
                        color="#666"
                      />
                      <Text style={styles.countText}>{inspection.meterCount}</Text>
                      <Text style={styles.countLabel}>meters</Text>
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
    marginBottom: 12,
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
  inspectionFooter: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  countLabel: {
    fontSize: 14,
    color: '#666',
  },
});
