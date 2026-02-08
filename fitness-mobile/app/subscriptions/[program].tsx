import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { PROGRAMS, ProgramType, getOfferings } from '@/lib/subscriptions';
import { Ionicons } from '@expo/vector-icons';

// Map program IDs to RevenueCat offering identifiers
const OFFERING_IDS: Record<ProgramType, string> = {
  'btn': 'The Gains AI BTN',
  'engine': 'The Gains AI Engine',
  'applied_power': 'The Gains AI Applied Power',
  'competitor': 'The Gains AI Competitor'
};

interface PricingInfo {
  monthly: string | null;
  quarterly: string | null;
  yearly: string | null;
}

export default function ProgramDetailScreen() {
  const router = useRouter();
  const { program: programId } = useLocalSearchParams<{ program: string }>();
  const [pricing, setPricing] = useState<PricingInfo | null>(null);
  const [loadingPrices, setLoadingPrices] = useState(true);

  const program = PROGRAMS[programId as ProgramType];

  useEffect(() => {
    loadPricing();
  }, []);

  const loadPricing = async () => {
    try {
      const offerings = await getOfferings();
      if (offerings?.all) {
        const offeringId = OFFERING_IDS[programId as ProgramType];
        const offering = offerings.all[offeringId];
        if (offering) {
          const monthly = offering.availablePackages.find(
            pkg => pkg.identifier === '$rc_monthly' || pkg.identifier === 'monthly'
          );
          const quarterly = offering.availablePackages.find(
            pkg => pkg.identifier === '$rc_three_month' || pkg.identifier === 'quarterly'
          );
          const yearly = offering.availablePackages.find(
            pkg => pkg.identifier === '$rc_annual' || pkg.identifier === 'yearly'
          );
          setPricing({
            monthly: monthly?.product.priceString ?? null,
            quarterly: quarterly?.product.priceString ?? null,
            yearly: yearly?.product.priceString ?? null,
          });
        }
      }
    } catch (error) {
      console.error('Error loading pricing:', error);
    } finally {
      setLoadingPrices(false);
    }
  };

  if (!program) {
    return (
      <View style={styles.container}>
        <Text>Program not found</Text>
      </View>
    );
  }

  const handleStartTrial = () => {
    router.push(`/subscriptions/purchase/${program.id}`);
  };

  // Use RevenueCat prices if loaded, fall back to hardcoded
  const monthlyPrice = pricing?.monthly ?? program.monthlyPrice;
  const quarterlyPrice = pricing?.quarterly ?? program.quarterlyPrice;
  const yearlyPrice = pricing?.yearly ?? program.yearlyPrice;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#F6FBFE" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Plan Details</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{program.displayName}</Text>
        <Text style={styles.description}>{program.shortDescription}</Text>

        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>What's Included:</Text>
          {program.bullets.map((bullet, index) => (
            <View key={index} style={styles.bulletItem}>
              <Ionicons name="checkmark" size={24} color="#FE5858" />
              <Text style={styles.bulletText}>{bullet}</Text>
            </View>
          ))}
        </View>

        <View style={styles.pricingContainer}>
          <Text style={styles.pricingTitle}>Pricing Options:</Text>
          {loadingPrices ? (
            <ActivityIndicator size="small" color="#FE5858" style={{ paddingVertical: 12 }} />
          ) : (
            <>
              {monthlyPrice && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Monthly:</Text>
                  <Text style={styles.priceValue}>{monthlyPrice}/month</Text>
                </View>
              )}
              {quarterlyPrice && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Quarterly:</Text>
                  <Text style={styles.priceValue}>{quarterlyPrice}/3 months</Text>
                </View>
              )}
              {yearlyPrice && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Yearly:</Text>
                  <Text style={styles.priceValue}>{yearlyPrice}/year</Text>
                </View>
              )}
            </>
          )}
        </View>

        <View style={styles.trialInfo}>
          <Ionicons name="gift" size={24} color="#FE5858" />
          <Text style={styles.trialText}>
            Start with a 3-day free trial. Cancel anytime.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.startButton}
          onPress={handleStartTrial}
        >
          <Text style={styles.startButtonText}>Start 3-Day Free Trial</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Cancel anytime. No commitment. Terms apply.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6FBFE',
  },
  header: {
    backgroundColor: '#282B34',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: 60,
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#F6FBFE',
  },
  content: {
    padding: 24,
  },
  icon: {
    fontSize: 80,
    marginBottom: 16,
    textAlign: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#282B34',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 18,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 26,
  },
  featuresContainer: {
    marginBottom: 32,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 16,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  bulletText: {
    fontSize: 16,
    color: '#4B5563',
    marginLeft: 12,
    flex: 1,
  },
  pricingContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  pricingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  priceLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#282B34',
  },
  saveBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  saveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  trialInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  trialText: {
    fontSize: 14,
    color: '#991B1B',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  startButton: {
    backgroundColor: '#FE5858',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  disclaimer: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});

