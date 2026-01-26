import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { hasActiveSubscription, ProgramType } from '@/lib/subscriptions';

interface SubscriptionGateProps {
  children: React.ReactNode;
  requiredProgram?: ProgramType;
  fallbackMessage?: string;
}

/**
 * SubscriptionGate component - Shows content only if user has active subscription
 * Otherwise shows a paywall prompt
 */
export default function SubscriptionGate({
  children,
  requiredProgram,
  fallbackMessage,
}: SubscriptionGateProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const access = await hasActiveSubscription(requiredProgram);
      setHasAccess(access);
    } catch (error) {
      console.error('Error checking subscription access:', error);
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = () => {
    if (requiredProgram) {
      router.push(`/subscriptions/${requiredProgram}`);
    } else {
      router.push('/subscriptions');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE5858" />
      </View>
    );
  }

  if (!hasAccess) {
    return (
      <View style={styles.gateContainer}>
        <View style={styles.gateContent}>
          <Ionicons name="lock-closed" size={64} color="#FE5858" />
          <Text style={styles.gateTitle}>Subscription Required</Text>
          <Text style={styles.gateMessage}>
            {fallbackMessage || 'Subscribe to unlock this feature and start your training journey.'}
          </Text>
          <TouchableOpacity style={styles.subscribeButton} onPress={handleSubscribe}>
            <Text style={styles.subscribeButtonText}>
              {requiredProgram ? 'View Subscription Options' : 'Browse Programs'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F6FBFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gateContainer: {
    flex: 1,
    backgroundColor: '#F6FBFE',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  gateContent: {
    alignItems: 'center',
    maxWidth: 400,
  },
  gateTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#282B34',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  gateMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  subscribeButton: {
    backgroundColor: '#FE5858',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
  },
  subscribeButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

