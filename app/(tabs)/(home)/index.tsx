
import { Stack, useRouter } from "expo-router";
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
import { colors, commonStyles } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { useAuth } from "@/contexts/AuthContext";
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
  const router = useRouter();
  const { user } = useAuth();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // This screen is protected by the (tabs) layout, so user will always exist here
    if (user) {
      console.log('HomeScreen mounted - loading inspections for user:', user.id);
      loadInspections();
    }
  }, [user]);

  const loadInspections = async () => {
    try {
      console.log('Fetching inspections from backend');
      const response = await authenticatedGet<Inspection[]>('/api/inspections');
      setInspections(response);
      console.log('Inspections loaded successfully:', response.length);
    } catch (error) {
      console.error('Error loading inspections:', error);
      setInspections([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    console.log('User triggered refresh');
    setRefreshing(true);
    loadInspections();
  };

  const handleCreateInspection = () => {
    console.log('User tapped Create New Inspection button');
    router.push('/new-inspection');
  };

  const handleOpenInspection = (id: string) => {
    console.log('User tapped inspection:', id);
    router.push(`/inspection/${id}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  const getStatusColor = (status: string) => {
    if (status === 'completed') return colors.success;
    if (status === 'exported') return colors.primary;
    return colors.textSecondary;
  };

  const getStatusText = (status: string) => {
    if (status === 'completed') return 'Completed';
    if (status === 'exported') return 'Exported';
    return 'Draft';
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
            title: "Kautions-Safe",
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: '#FFFFFF',
          }}
        />
        <View style={[commonStyles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Kautions-Safe",
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: '#FFFFFF',
        }}
      />
      <View style={commonStyles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Apartment Inspections</Text>
            <Text style={styles.headerSubtitle}>
              Document apartment condition for handovers
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.createButton}
            onPress={handleCreateInspection}
          >
            <IconSymbol 
              ios_icon_name="plus.circle.fill"
              android_material_icon_name="add-circle"
              size={24}
              color="#FFFFFF"
            />
            <Text style={styles.createButtonText}>Create New Inspection</Text>
          </TouchableOpacity>

          {inspections.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol 
                ios_icon_name="doc.text"
                android_material_icon_name="description"
                size={64}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyTitle}>No Inspections Yet</Text>
              <Text style={styles.emptyText}>
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
                    style={commonStyles.card}
                    onPress={() => handleOpenInspection(inspection.id)}
                  >
                    <View style={styles.inspectionHeader}>
                      <View style={styles.inspectionTitleRow}>
                        <Text style={styles.inspectionAddress}>
                          {inspection.propertyAddress}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                          <Text style={styles.statusText}>{statusText}</Text>
                        </View>
                      </View>
                      <Text style={styles.inspectionType}>{typeText}</Text>
                    </View>

                    <View style={styles.inspectionStats}>
                      <View style={styles.statItem}>
                        <IconSymbol 
                          ios_icon_name="door.left.hand.open"
                          android_material_icon_name="meeting-room"
                          size={20}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.statText}>{inspection.roomCount}</Text>
                        <Text style={styles.statLabel}>Rooms</Text>
                      </View>

                      <View style={styles.statItem}>
                        <IconSymbol 
                          ios_icon_name="gauge"
                          android_material_icon_name="speed"
                          size={20}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.statText}>{inspection.meterCount}</Text>
                        <Text style={styles.statLabel}>Meters</Text>
                      </View>

                      <View style={styles.statItem}>
                        <IconSymbol 
                          ios_icon_name="calendar"
                          android_material_icon_name="calendar-today"
                          size={20}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.statText}>{formattedDate}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
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
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  inspectionsList: {
    gap: 12,
  },
  inspectionHeader: {
    marginBottom: 12,
  },
  inspectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  inspectionAddress: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  inspectionType: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  inspectionStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  statLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
