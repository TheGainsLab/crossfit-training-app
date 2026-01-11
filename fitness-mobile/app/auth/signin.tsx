import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet
} from 'react-native'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Purchases from 'react-native-purchases'
import { createClient } from '@/lib/supabase/client'
import { setRevenueCatUserId } from '@/lib/subscriptions'

// Map program IDs to subscription tiers
const PROGRAM_TO_TIER: Record<string, string> = {
  'btn': 'BTN',
  'engine': 'ENGINE',
  'applied_power': 'APPLIED_POWER',
  'competitor': 'PREMIUM'
}

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleSignIn = async () => {
    if (!email || !password) {
      setMessage('❌ Please enter both email and password')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setMessage(`❌ Error: ${error.message}`)
        return
      }

      if (data.user) {
        setMessage('✅ Signed in successfully!')

        // Link user to RevenueCat - CRITICAL for purchase tracking
        try {
          await setRevenueCatUserId(data.user.id)
        } catch (error) {
          console.error('Error linking user to RevenueCat:', error)
          // Don't block sign-in if RevenueCat fails, but log it
        }

        // Check for pending subscription from purchase flow
        const pendingProgram = await AsyncStorage.getItem('pending_subscription_program');
        if (pendingProgram) {
          console.log('📦 Found pending subscription program:', pendingProgram);

          const subscriptionTier = PROGRAM_TO_TIER[pendingProgram] || 'PREMIUM';

          // Update database with pending subscription
          const { error: updateError } = await supabase
            .from('users')
            .update({
              subscription_tier: subscriptionTier,
              subscription_status: 'active'
            })
            .eq('auth_id', data.user.id);

          if (updateError) {
            console.error('❌ Error updating subscription_tier:', updateError);
          } else {
            console.log(`✅ Updated subscription_tier to ${subscriptionTier} from pending purchase`);

            // Clear AsyncStorage
            await AsyncStorage.removeItem('pending_subscription_program');
            await AsyncStorage.removeItem('pending_subscription_entitlements');
          }
        }

        // Check user's subscription tier, intake_status, and program status
        const { data: userData } = await supabase
          .from('users')
          .select('id, subscription_tier, intake_status')
          .eq('auth_id', data.user.id)
          .single()

        if (userData) {
          let typedUserData = userData as any

          // FALLBACK: If subscription_tier is missing, check RevenueCat for active entitlements
          // This ensures tier is always set even if it was missed during purchase
          if (!typedUserData.subscription_tier) {
            console.log('[SignIn] No subscription_tier in DB, checking RevenueCat...');
            try {
              const customerInfo = await Purchases.getCustomerInfo();
              const activeEntitlements = Object.keys(customerInfo.entitlements.active);

              if (activeEntitlements.length > 0) {
                // Map entitlement to tier - entitlements may be program IDs or tier names
                let detectedTier = PROGRAM_TO_TIER[activeEntitlements[0]];
                if (!detectedTier) {
                  // Try uppercase version as fallback (e.g., 'btn' -> 'BTN')
                  detectedTier = activeEntitlements[0].toUpperCase();
                }

                console.log(`[SignIn] Found RevenueCat entitlement: ${activeEntitlements[0]}, mapping to tier: ${detectedTier}`);

                // Update database with detected subscription tier
                const { error: tierUpdateError } = await supabase
                  .from('users')
                  .update({
                    subscription_tier: detectedTier,
                    subscription_status: 'active'
                  })
                  .eq('auth_id', data.user.id);

                if (tierUpdateError) {
                  console.error('[SignIn] Error updating subscription_tier from RevenueCat:', tierUpdateError);
                } else {
                  console.log(`[SignIn] ✅ Updated subscription_tier to ${detectedTier} from RevenueCat`);
                  typedUserData.subscription_tier = detectedTier;
                }
              }
            } catch (rcError) {
              console.error('[SignIn] Error checking RevenueCat entitlements:', rcError);
              // Continue without blocking sign-in
            }
          }

          // Check intake_status first - redirect to intake if needed
          const status = typedUserData.intake_status
          if (status === 'draft' || status === null || status === 'generating' || status === 'failed') {
            router.replace('/intake')
            return
          }

          // BTN users should go to main tabs (generator is in Training tab)
          if (typedUserData.subscription_tier === 'BTN') {
            router.replace('/(tabs)')
            return
          }

          // Engine users should go to Engine dashboard
          if (typedUserData.subscription_tier === 'ENGINE') {
            router.replace('/engine/training')
            return
          }

          // Check if user has a program (for Premium/Applied Power)
          const { data: programData } = await supabase
            .from('programs')
            .select('id')
            .eq('user_id', typedUserData.id)
            .limit(1)
            .single()

          if (programData) {
            // User has a program, go to tabs (with bottom navigation)
            router.replace('/(tabs)')
          } else {
            // No program yet, redirect to intake
            router.replace('/intake')
          }
        }
      }
    } catch (error) {
      setMessage('❌ An unexpected error occurred')
      console.error('Sign in error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              Sign in to your account
            </Text>
            <Text style={styles.subtitle}>
              Welcome back to your training
            </Text>
          </View>

          {/* Message */}
          {message && (
            <View
              style={[
                styles.messageContainer,
                message.startsWith('✅')
                  ? styles.messageSuccess
                  : styles.messageError
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  message.startsWith('✅') ? styles.messageTextSuccess : styles.messageTextError
                ]}
              >
                {message}
              </Text>
            </View>
          )}

          {/* Form */}
          <View style={styles.form}>
            <View>
              <Text style={styles.label}>
                Email address
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email address"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                style={styles.input}
              />
            </View>

            <View>
              <Text style={styles.label}>
                Password
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                style={styles.input}
              />
            </View>

            <TouchableOpacity
              onPress={handleSignIn}
              disabled={loading}
              style={[
                styles.button,
                loading && styles.buttonDisabled
              ]}
            >
              {loading ? (
                <View style={styles.buttonContent}>
                  <ActivityIndicator color="white" />
                  <Text style={styles.buttonText}>
                    Signing in...
                  </Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>
                  Sign in
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Don't have an account?{' '}
              </Text>
              <TouchableOpacity onPress={() => router.push('/auth/signup')}>
                <Text style={styles.linkText}>Create account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FBFE',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  formContainer: {
    maxWidth: 448,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#282B34',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
  },
  messageContainer: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    borderWidth: 1,
  },
  messageSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  messageError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  messageText: {
    fontSize: 14,
  },
  messageTextSuccess: {
    color: '#166534',
  },
  messageTextError: {
    color: '#991B1B',
  },
  form: {
    gap: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#282B34',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#DAE2EA',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    color: '#282B34',
    fontSize: 16,
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: '#FE5858',
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  footer: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#4B5563',
  },
  linkText: {
    fontSize: 14,
    color: '#FE5858',
    fontWeight: '600',
  },
})
