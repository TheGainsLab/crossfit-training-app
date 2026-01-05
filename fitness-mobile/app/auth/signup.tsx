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

        // Link RevenueCat to new user - CRITICAL for linking anonymous purchase
        try {
          await Purchases.logIn(data.user.id)
          console.log('RevenueCat linked to user:', data.user.id)
        } catch (error) {
          console.error('Error linking user to RevenueCat:', error)
          // Continue even if this fails - we'll handle it later
        }

        // Get RevenueCat entitlements
        let subscriptionTier = null
        let hasActiveSubscription = false
        
        try {
          const customerInfo = await Purchases.getCustomerInfo()
          const activeEntitlements = Object.keys(customerInfo.entitlements.active)
          
          if (activeEntitlements.length > 0) {
            hasActiveSubscription = true
            
            // Get pending program from AsyncStorage
            const pendingProgram = await AsyncStorage.getItem('pending_subscription_program')
            
            if (pendingProgram) {
              subscriptionTier = PROGRAM_TO_TIER[pendingProgram]
              console.log('Mapped program to tier:', pendingProgram, '->', subscriptionTier)
            } else {
              // Fallback: use first entitlement
              subscriptionTier = PROGRAM_TO_TIER[activeEntitlements[0]] || activeEntitlements[0].toUpperCase()
            }
          }
        } catch (error) {
          console.error('Error getting customer info:', error)
        }

        // Create user record with subscription info
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            auth_id: data.user.id,
            email: data.user.email,
            subscription_tier: subscriptionTier,
            subscription_status: hasActiveSubscription ? 'active' : null,
            intake_status: 'draft' // Ready for intake
          })

        if (insertError) {
          console.error('Error creating user record:', insertError)
          Alert.alert('Error', 'Failed to create user profile. Please contact support.')
          return
        }

        // Clean up AsyncStorage
        await AsyncStorage.removeItem('pending_subscription_program')
        await AsyncStorage.removeItem('pending_subscription_entitlements')

        // Navigate based on subscription status
        // Use setLoading(false) before navigation to avoid race conditions
        setLoading(false)

        if (hasActiveSubscription) {
          // Has subscription, proceed to intake
          console.log('[Signup] User has active subscription, navigating to intake')
          router.replace('/intake')
        } else {
          // No subscription, send to subscription browse
          console.log('[Signup] No active subscription, navigating to subscriptions')
          router.replace('/subscriptions')
        }
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
