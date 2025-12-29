import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'
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
        const hasSubscription = await hasActiveSubscription()

        if (!hasSubscription) {
          // No active subscription - redirect to subscription browse
          router.replace('/subscriptions')
          return
        }

        // User has subscription - check if they've completed intake
        const { data: userData } = await supabase
          .from('users')
          .select('intake_status')
          .eq('auth_id', session.user.id)
          .single()

        const intakeStatus = userData?.intake_status

        // If intake is not complete, redirect to intake
        if (intakeStatus === 'draft' || intakeStatus === null || intakeStatus === 'generating' || intakeStatus === 'failed') {
          router.replace('/intake')
          return
        }

        // User has subscription AND completed intake - continue to app
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
