import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'
import { createClient } from '@/lib/supabase/client'

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
        // User is logged in, check if they have a program
        const { data: userData } = await supabase
          .from('users')
          .select('id, subscription_tier')
          .eq('auth_id', session.user.id)
          .single()

        if (userData) {
          // Check subscription tier routing
          if (userData.subscription_tier === 'BTN') {
            router.replace('/(tabs)')  // BTN users go to Training tab (which shows generator)
            return
          }

          if (userData.subscription_tier === 'ENGINE') {
            router.replace('/engine/training')
            return
          }

          // For Premium/Applied Power, check if they have a program
          const { data: programData } = await supabase
            .from('programs')
            .select('id')
            .eq('user_id', userData.id)
            .limit(1)
            .single()

          if (programData) {
            router.replace('/(tabs)')
          } else {
            router.replace('/auth/signin')
          }
        } else {
          router.replace('/auth/signin')
        }
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
