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
import { createClient } from '@/lib/supabase/client'

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

        // Check user's subscription tier and program status
        const { data: userData } = await supabase
          .from('users')
          .select('id, subscription_tier')
          .eq('auth_id', data.user.id)
          .single()

        if (userData) {
          // BTN users should go to workout history
          if (userData.subscription_tier === 'BTN') {
            router.replace('/btn/workouts')
            return
          }

          // Engine users should go to Engine dashboard
          if (userData.subscription_tier === 'ENGINE') {
            router.replace('/engine')
            return
          }

          // Check if user has a program (for Premium/Applied Power)
          const { data: programData } = await supabase
            .from('programs')
            .select('id')
            .eq('user_id', userData.id)
            .limit(1)
            .single()

          if (programData) {
            // User has a program, go to dashboard
            router.replace('/dashboard')
          } else {
            // No program yet, show message
            Alert.alert(
              'No Program Found',
              'Please complete your intake form on the web app first.',
              [{ text: 'OK' }]
            )
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
                Just completed a purchase? Access your intake form on the web app
              </Text>
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
  },
  footerText: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
  },
})
