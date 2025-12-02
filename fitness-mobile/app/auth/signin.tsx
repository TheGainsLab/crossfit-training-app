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
  Alert
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
      className="flex-1 bg-ice-blue"
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-6 py-12"
        keyboardShouldPersistTaps="handled"
      >
        <View className="max-w-md w-full mx-auto">
          {/* Header */}
          <View className="mb-8">
            <Text className="text-3xl font-bold text-charcoal text-center mb-2">
              Sign in to your account
            </Text>
            <Text className="text-sm text-gray-600 text-center">
              Welcome back to your training
            </Text>
          </View>

          {/* Message */}
          {message && (
            <View
              className={`p-4 rounded-lg mb-6 border ${
                message.startsWith('✅')
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <Text
                className={
                  message.startsWith('✅') ? 'text-green-800' : 'text-red-800'
                }
              >
                {message}
              </Text>
            </View>
          )}

          {/* Form */}
          <View className="space-y-4">
            <View>
              <Text className="text-sm font-medium text-charcoal mb-2">
                Email address
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email address"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                className="w-full px-4 py-3 border border-slate-blue rounded-lg bg-white text-charcoal"
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-charcoal mb-2">
                Password
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                className="w-full px-4 py-3 border border-slate-blue rounded-lg bg-white text-charcoal"
              />
            </View>

            <TouchableOpacity
              onPress={handleSignIn}
              disabled={loading}
              className={`w-full py-4 rounded-lg ${
                loading ? 'bg-gray-400' : 'bg-coral'
              }`}
            >
              {loading ? (
                <View className="flex-row items-center justify-center">
                  <ActivityIndicator color="white" />
                  <Text className="text-white font-semibold ml-2">
                    Signing in...
                  </Text>
                </View>
              ) : (
                <Text className="text-white text-center font-semibold text-base">
                  Sign in
                </Text>
              )}
            </TouchableOpacity>

            <View className="mt-4">
              <Text className="text-sm text-gray-600 text-center">
                Just completed a purchase? Access your intake form on the web app
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
