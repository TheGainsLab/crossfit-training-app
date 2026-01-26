import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getActiveSubscriptions, restorePurchases, PROGRAMS } from '@/lib/subscriptions';
import { CustomerInfo } from 'react-native-purchases';
import Purchases from 'react-native-purchases';

export default function SubscriptionStatusScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [activeSubscriptions, setActiveSubscriptions] = useState<string[]>([]);

  useEffect(() => {
    loadSubscriptionStatus();
  }, []);

  const loadSubscriptionStatus = async () => {
    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      const active = await getActiveSubscriptions();
      setActiveSubscriptions(active);
    } catch (error) {
      console.error('Error loading subscription status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    try {
      setLoading(true);
      await restorePurchases();
      await loadSubscriptionStatus();
      Alert.alert('Success', 'Subscriptions restored successfully!');
    } catch (error) {
      Alert.alert('Error', 'Unable to restore purchases. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = () => {
    Linking.openURL('https://apps.apple.com/account/subscriptions');
  };

  const handleBrowsePrograms = () => {
    router.push('/subscriptions');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE5858" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#282B34" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscription</Text>
      </View>

      <View style={styles.content}>
        {activeSubscriptions.length > 0 ? (
          <>
            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <Ionicons name="checkmark-circle" size={48} color="#10B981" />
                <Text style={styles.statusTitle}>Active Subscriptions</Text>
              </View>

              {activeSubscriptions.map((entitlement) => {
                const program = PROGRAMS[entitlement as keyof typeof PROGRAMS];
                if (!program) return null;

                const entitlementInfo = customerInfo?.entitlements.active[entitlement];
                const expirationDate = entitlementInfo?.expirationDate;
                const willRenew = entitlementInfo?.willRenew;

                return (
                  <View key={entitlement} style={styles.subscriptionItem}>
                    <Text style={styles.programIcon}>{program.icon}</Text>
                    <View style={styles.subscriptionInfo}>
                      <Text style={styles.programName}>{program.displayName}</Text>
                      {expirationDate && (
                        <Text style={styles.expirationText}>
                          {willRenew ? 'Renews' : 'Expires'}:{' '}
                          {new Date(expirationDate).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                  </View>
                );
              })}
            </View>

            <TouchableOpacity style={styles.button} onPress={handleManageSubscription}>
              <Ionicons name="settings-outline" size={20} color="#FE5858" />
              <Text style={styles.buttonText}>Manage Subscription in App Store</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={handleBrowsePrograms}>
              <Ionicons name="add-circle-outline" size={20} color="#FE5858" />
              <Text style={styles.buttonText}>Browse Other Programs</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.emptyState}>
              <Ionicons name="sad-outline" size={64} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>No Active Subscriptions</Text>
              <Text style={styles.emptyText}>
                Subscribe to a program to unlock all features and start your training journey.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleBrowsePrograms}
            >
              <Text style={styles.primaryButtonText}>Browse Programs</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={styles.restoreButton} onPress={handleRestore}>
          <Ionicons name="refresh-outline" size={20} color="#6B7280" />
          <Text style={styles.restoreButtonText}>Restore Purchases</Text>
        </TouchableOpacity>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>About Subscriptions</Text>
          <Text style={styles.infoText}>
            • Subscriptions automatically renew unless cancelled at least 24 hours
            before the end of the current period
          </Text>
          <Text style={styles.infoText}>
            • You can manage and cancel subscriptions in your App Store account settings
          </Text>
          <Text style={styles.infoText}>
            • All subscriptions include a 3-day free trial for new subscribers
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDFBFE',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#EDFBFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#282B34',
  },
  content: {
    padding: 24,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#282B34',
    marginTop: 12,
  },
  subscriptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  programIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  subscriptionInfo: {
    flex: 1,
  },
  programName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 2,
  },
  expirationText: {
    fontSize: 14,
    color: '#6B7280',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FE5858',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FE5858',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#282B34',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  primaryButton: {
    backgroundColor: '#FE5858',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 32,
  },
  restoreButtonText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 6,
  },
  infoSection: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 8,
  },
});

