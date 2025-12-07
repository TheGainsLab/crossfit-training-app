import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
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
            router.replace('/btn/workouts')
            return
          }

          if (userData.subscription_tier === 'ENGINE') {
            router.replace('/engine')
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
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FE5858" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
