import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { createClient } from '@/lib/supabase/client'
import { fetchEngineAnalytics } from '@/lib/api/analytics'
import { EngineTab } from '@/components/engine/EngineAnalyticsViews'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDFBFE',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 16,
    color: '#4B5563',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  }
})

export default function EngineAnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userId, setUserId] = useState<number | null>(null)
  const [engineData, setEngineData] = useState<any>(null)

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    if (userId) {
      loadEngineData()
    }
  }, [userId])

  const loadUser = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (userData) {
        setUserId((userData as any).id)
      }
    } catch (error) {
      console.error('Error loading user:', error)
    }
  }

  const loadEngineData = async () => {
    if (!userId) return
    
    try {
      setLoading(true)
      const data = await fetchEngineAnalytics(userId)
      setEngineData(data)
    } catch (error) {
      console.error('Error loading engine data:', error)
    } finally {
      setLoading(false)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadEngineData()
    setRefreshing(false)
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE5858" />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <EngineTab engineData={engineData} userId={userId} />
      </ScrollView>
    </View>
  )
}
