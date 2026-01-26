import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'

export default function TabOneScreen() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to our main auth flow
    router.replace('/')
  }, [])

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDFBFE' }}>
      <ActivityIndicator size="large" color="#FE5858" />
    </View>
  )
}
