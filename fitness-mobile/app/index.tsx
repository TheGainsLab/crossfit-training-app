import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { View, ActivityIndicator, Alert } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@/lib/supabase/client'
import { setRevenueCatUserId, hasActiveSubscription } from '@/lib/subscriptions'
import { registerForPushNotifications } from '@/lib/notifications'

export default function Index() {
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      // Check for pending subscription from anonymous purchase FIRST
      const pendingProgram = await AsyncStorage.getItem('pending_subscription_program')
      
      if (pendingProgram) {
        console.log('Pending subscription found:', pendingProgram)
        
        // Check if user has a session
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          // User purchased anonymously but hasn't signed up yet
          console.log('No session - redirecting to signup')
          router.replace('/auth/signup')
          return
        }
        
        // User has session but pending subscription - signup flow will handle linking
        console.log('Session exists with pending subscription - will be handled by signup')
      }

      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        // Link user to RevenueCat - CRITICAL for purchase tracking
        try {
          await setRevenueCatUserId(session.user.id)
        } catch (error) {
          console.error('Error linking user to RevenueCat:', error)
          // Don't block app flow if RevenueCat fails, but log it
        }

        // Register for push notifications and save token
        try {
          const pushToken = await registerForPushNotifications()
          if (pushToken) {
            // Save push token to database
            await supabase
              .from('users')
              .update({
                push_token: pushToken,
                push_token_updated_at: new Date().toISOString()
              })
              .eq('auth_id', session.user.id)
          }
        } catch (error) {
          console.error('Error registering push notifications:', error)
          // Don't block app flow if push registration fails
        }

        // Check if user has active subscription via RevenueCat
        console.log('[Index] Checking subscription status...')
        const hasSubscription = await hasActiveSubscription()
        console.log('[Index] RevenueCat subscription status:', hasSubscription)

        // Also check database for subscription_status as backup
        const { data: userData } = await supabase
          .from('users')
          .select('intake_status, subscription_status, subscription_tier')
          .eq('auth_id', session.user.id)
          .single()

        console.log('[Index] User data:', {
          intakeStatus: userData?.intake_status,
          subscriptionStatus: userData?.subscription_status,
          subscriptionTier: userData?.subscription_tier
        })

        // Check for NULL subscription_tier - indicates purchase flow issue
        if (userData && !userData.subscription_tier) {
          router.replace('/subscriptions')
          return
        }

        // User needs to subscribe if:
        // 1. RevenueCat says no subscription AND
        // 2. Database shows no active subscription
        const dbHasSubscription = userData?.subscription_status?.toUpperCase() === 'ACTIVE'

        if (!hasSubscription && !dbHasSubscription) {
          // No active subscription - redirect to subscription browse
          console.log('[Index] No active subscription, redirecting to /subscriptions')
          router.replace('/subscriptions')
          return
        }

        const intakeStatus = userData?.intake_status

        // If intake is not complete, redirect to intake
        if (intakeStatus === 'draft' || intakeStatus === null || intakeStatus === 'generating' || intakeStatus === 'failed') {
          console.log('[Index] Intake not complete, redirecting to /intake')
          router.replace('/intake')
          return
        }

        // User has subscription AND completed intake - continue to app
        console.log('[Index] User has subscription and completed intake, redirecting to /(tabs)')
        router.replace('/(tabs)')
      } else {
        // No session, go to sign in
        router.replace('/auth/signin')
      }
    } catch (error) {
      console.error('Auth check error:', error)
      router.replace('/auth/signin')
    }
  }

  return (
    <View className="flex-1 bg-ice-blue items-center justify-center">
      <ActivityIndicator size="large" color="#FE5858" />
    </View>
  )
}
