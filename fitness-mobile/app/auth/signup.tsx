import React, { useState, useEffect } from 'react'
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
import { createClient } from '@/lib/supabase/client'
import { PROGRAM_TO_TIER } from '@/lib/subscriptions'
import Purchases from 'react-native-purchases'

// Map program IDs to subscription tiers
const PROGRAM_TO_TIER: Record<string, string> = {
  'btn': 'BTN',
  'engine': 'ENGINE',
  'applied_power': 'APPLIED_POWER',
  'competitor': 'PREMIUM'
}

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [hasPendingSubscription, setHasPendingSubscription] = useState(false)
  const router = useRouter()

  useEffect(() => {
    checkPendingSubscription()
  }, [])

  const checkPendingSubscription = async () => {
    const pendingProgram = await AsyncStorage.getItem('pending_subscription_program')
    setHasPendingSubscription(!!pendingProgram)
  }

  const handleSignUp = async () => {
    if (!email || !password) {
      setMessage('❌ Please enter both email and password')
      return
    }

    if (password.length < 6) {
      setMessage('❌ Password must be at least 6 characters')
      return
    }

    if (password !== confirmPassword) {
      setMessage('❌ Passwords do not match')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const supabase = createClient()
      
      // Create Supabase account
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        setMessage(`❌ Error: ${error.message}`)
        return
      }

      if (data.user) {
        setMessage('✅ Account created successfully!')

        // Helper to add timeout to promises (RevenueCat can hang on simulator)
        const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | null> => {
          return Promise.race([
            promise,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
          ])
        }

        // Link RevenueCat to new user - CRITICAL for linking anonymous purchase
        try {
          console.log('[Signup] Linking RevenueCat to user...')
          const loginResult = await withTimeout(Purchases.logIn(data.user.id), 5000)
          if (loginResult) {
            console.log('[Signup] RevenueCat linked to user:', data.user.id)
          } else {
            console.log('[Signup] RevenueCat login timed out, continuing...')
          }
        } catch (error) {
          console.error('[Signup] Error linking user to RevenueCat:', error)
          // Continue even if this fails - we'll handle it later
        }

        // Get RevenueCat entitlements
        let subscriptionTier = null
        let hasActiveSubscription = false

        try {
          console.log('[Signup] Getting RevenueCat customer info...')
          const customerInfo = await withTimeout(Purchases.getCustomerInfo(), 5000)

          if (customerInfo) {
            const activeEntitlements = Object.keys(customerInfo.entitlements.active)

            if (activeEntitlements.length > 0) {
              hasActiveSubscription = true

              // Get pending program from AsyncStorage
              const pendingProgram = await AsyncStorage.getItem('pending_subscription_program')

              if (pendingProgram) {
                subscriptionTier = PROGRAM_TO_TIER[pendingProgram]
                console.log('[Signup] Mapped program to tier:', pendingProgram, '->', subscriptionTier)
              } else {
                // Fallback: use first entitlement
                subscriptionTier = PROGRAM_TO_TIER[activeEntitlements[0]] || activeEntitlements[0].toUpperCase()
              }
            }
          } else {
            console.log('[Signup] RevenueCat getCustomerInfo timed out, continuing without subscription...')
          }
        } catch (error) {
          console.error('[Signup] Error getting customer info:', error)
        }

        // Create or update user record with subscription info
        // Using upsert to handle case where trigger already created the user
        console.log('[Signup] Creating/updating user record in database...')
        const { error: insertError } = await supabase
          .from('users')
          .upsert({
            auth_id: data.user.id,
            email: data.user.email,
            name: data.user.email?.split('@')[0] || 'New User',
            subscription_tier: subscriptionTier,
            subscription_status: subscriptionTier ? 'active' : null,  // If they have a tier, they're active
            intake_status: 'draft' // Ready for intake
          }, { onConflict: 'email' })

        if (insertError) {
          console.error('[Signup] Error creating/updating user record:', insertError)
          Alert.alert('Error', 'Failed to create user profile. Please contact support.')
          setLoading(false)
          return
        }
        console.log('[Signup] User record created/updated successfully')

        // Clean up AsyncStorage (with timeout in case it hangs)
        console.log('[Signup] Cleaning up AsyncStorage...')
        try {
          await Promise.race([
            Promise.all([
              AsyncStorage.removeItem('pending_subscription_program'),
              AsyncStorage.removeItem('pending_subscription_entitlements')
            ]),
            new Promise((resolve) => setTimeout(resolve, 2000))
          ])
        } catch (e) {
          console.log('[Signup] AsyncStorage cleanup failed, continuing...')
        }
        console.log('[Signup] AsyncStorage cleanup complete')

        // Navigate based on subscription status
        console.log('[Signup] Preparing to navigate, hasActiveSubscription:', hasActiveSubscription)
        setLoading(false)

        // Use setTimeout to ensure state updates before navigation
        setTimeout(() => {
          if (hasActiveSubscription) {
            console.log('[Signup] Navigating to /intake')
            router.replace('/intake')
          } else {
            console.log('[Signup] Navigating to /subscriptions')
            router.replace('/subscriptions')
          }
        }, 100)
        return // Exit early - navigation will handle the rest
      }
    } catch (error) {
      setMessage('❌ An unexpected error occurred')
      console.error('Sign up error:', error)
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
              Create your account
            </Text>
            {hasPendingSubscription ? (
              <Text style={styles.subtitle}>
                🎉 Your subscription is active! Complete your account to get started.
              </Text>
            ) : (
              <Text style={styles.subtitle}>
                Start your fitness journey
              </Text>
            )}
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
                placeholder="Password (min 6 characters)"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                style={styles.input}
              />
            </View>

            <View>
              <Text style={styles.label}>
                Confirm Password
              </Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm password"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                style={styles.input}
              />
            </View>

            <TouchableOpacity
              onPress={handleSignUp}
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
                    Creating account...
                  </Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>
                  Create account
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Already have an account?{' '}
              </Text>
              <TouchableOpacity onPress={() => router.push('/auth/signin')}>
                <Text style={styles.linkText}>Sign in</Text>
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
