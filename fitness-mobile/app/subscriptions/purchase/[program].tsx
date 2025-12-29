import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PurchasesPackage } from 'react-native-purchases';
import { PROGRAMS, ProgramType, getOfferings, purchasePackage } from '@/lib/subscriptions';

type BillingPeriod = 'monthly' | 'quarterly' | 'yearly';

// Map program IDs to RevenueCat offering identifiers
const OFFERING_IDS: Record<ProgramType, string> = {
  'btn': 'The Gains AI BTN',
  'engine': 'The Gains AI Engine',
  'applied_power': 'The Gains AI Applied Power',
  'competitor': 'The Gains AI Competitor'
};

export default function PurchaseScreen() {
  const router = useRouter();
  const { program: programId } = useLocalSearchParams<{ program: string }>();
  const [selectedPeriod, setSelectedPeriod] = useState<BillingPeriod>('yearly');
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [packages, setPackages] = useState<Record<BillingPeriod, PurchasesPackage | null>>({
    monthly: null,
    quarterly: null,
    yearly: null,
  });

  const program = PROGRAMS[programId as ProgramType];

  useEffect(() => {
    loadOfferings();
  }, []);

  const loadOfferings = async () => {
    try {
      const offerings = await getOfferings();
      
      console.log('RevenueCat offerings received:', offerings);
      console.log('All offerings:', offerings?.all);
      
      if (!offerings || !offerings.all) {
        console.error('No offerings returned from RevenueCat');
        Alert.alert('Error', 'Unable to load subscription options. Please try again.');
        setLoading(false);
        return;
      }

      // Get the specific offering for this program
      const offeringId = OFFERING_IDS[programId as ProgramType];
      console.log(`Looking for offering: ${offeringId} for program: ${programId}`);
      
      const offering = offerings.all[offeringId];
      
      if (!offering) {
        console.error(`No offering found with ID: ${offeringId}`);
        console.log('Available offerings:', Object.keys(offerings.all));
        Alert.alert(
          'Configuration Error', 
          `Subscription not available for ${program.displayName}. Please contact support.`
        );
        setLoading(false);
        return;
      }

      console.log(`Found offering ${offeringId} with ${offering.availablePackages.length} packages`);

      // Map packages by identifier (monthly, quarterly, yearly)
      const packageMap: Record<BillingPeriod, PurchasesPackage | null> = {
        monthly: offering.availablePackages.find(pkg => pkg.identifier === '$rc_monthly' || pkg.identifier === 'monthly') || null,
        quarterly: offering.availablePackages.find(pkg => pkg.identifier === '$rc_quarterly' || pkg.identifier === 'quarterly') || null,
        yearly: offering.availablePackages.find(pkg => pkg.identifier === '$rc_annual' || pkg.identifier === 'yearly') || null,
      };

      console.log('Package mapping:', {
        monthly: packageMap.monthly?.product.identifier,
        quarterly: packageMap.quarterly?.product.identifier,
        yearly: packageMap.yearly?.product.identifier,
      });

      setPackages(packageMap);
      setLoading(false);
    } catch (error) {
      console.error('Error loading offerings:', error);
      Alert.alert('Error', 'Unable to load subscription options. Please try again.');
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    const selectedPackage = packages[selectedPeriod];
    
    if (!selectedPackage) {
      Alert.alert('Error', 'Selected subscription option not available.');
      return;
    }

    setPurchasing(true);
    
    try {
      const customerInfo = await purchasePackage(selectedPackage);
      
      if (customerInfo) {
        Alert.alert(
          'Success!',
          'Your subscription is now active. Enjoy your training!',
          [
            {
              text: 'Start Training',
              onPress: () => router.push('/(tabs)'),
            },
          ]
        );
      }
    } catch (error: any) {
      if (!error.userCancelled) {
        Alert.alert('Purchase Failed', 'Unable to complete purchase. Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  if (!program) {
    return (
      <View style={styles.container}>
        <Text>Program not found</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE5858" />
        <Text style={styles.loadingText}>Loading subscription options...</Text>
      </View>
    );
  }

  const getPeriodDetails = (period: BillingPeriod) => {
    const pkg = packages[period];
    if (!pkg) return null;

    const price = pkg.product.priceString;
    const description = pkg.product.title;

    return { price, description };
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#282B34" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscribe to {program.displayName}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Choose Your Plan</Text>
        <Text style={styles.subtitle}>
          Start with a 3-day free trial, then you'll be charged
        </Text>

        <View style={styles.optionsContainer}>
          {(['monthly', 'quarterly', 'yearly'] as BillingPeriod[]).map((period) => {
            const details = getPeriodDetails(period);
            if (!details) return null;

            const isSelected = selectedPeriod === period;
            const isRecommended = period === 'yearly';

            return (
              <TouchableOpacity
                key={period}
                style={[
                  styles.optionCard,
                  isSelected && styles.optionCardSelected,
                ]}
                onPress={() => setSelectedPeriod(period)}
              >
                {isRecommended && (
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedText}>BEST VALUE</Text>
                  </View>
                )}

                <View style={styles.optionHeader}>
                  <View style={styles.radioButton}>
                    {isSelected && <View style={styles.radioButtonInner} />}
                  </View>
                  <View style={styles.optionInfo}>
                    <Text style={styles.optionTitle}>
                      {period.charAt(0).toUpperCase() + period.slice(1)}
                    </Text>
                    <Text style={styles.optionPrice}>{details.price}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.trialInfo}>
          <Ionicons name="information-circle" size={20} color="#6B7280" />
          <Text style={styles.trialInfoText}>
            Free for 3 days, then {getPeriodDetails(selectedPeriod)?.price}. Cancel anytime.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.subscribeButton, purchasing && styles.subscribeButtonDisabled]}
          onPress={handlePurchase}
          disabled={purchasing}
        >
          {purchasing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.subscribeButtonText}>Start Free Trial</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
          Subscription automatically renews unless cancelled at least 24 hours
          before the end of the current period.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FBFE',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8FBFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#282B34',
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  optionCardSelected: {
    borderColor: '#FE5858',
  },
  recommendedBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#FE5858',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  recommendedText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FE5858',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FE5858',
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 2,
  },
  optionPrice: {
    fontSize: 16,
    color: '#6B7280',
  },
  savingsBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  savingsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  trialInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  trialInfoText: {
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  subscribeButton: {
    backgroundColor: '#FE5858',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  subscribeButtonDisabled: {
    opacity: 0.6,
  },
  subscribeButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  disclaimer: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
});

