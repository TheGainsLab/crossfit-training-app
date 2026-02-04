import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, Alert } from 'react-native'
import { getAvailableEnginePrograms, type EngineProgram } from '@/lib/api/enginePrograms'
import ProgramCard from './ProgramCard'

interface ProgramBrowserProps {
  onProgramSelect: (programId: string) => void
  hasEngineAccess: boolean
}

export default function ProgramBrowser({
  onProgramSelect,
  hasEngineAccess
}: ProgramBrowserProps) {
  const [programs, setPrograms] = useState<EngineProgram[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPrograms()
  }, [])

  const loadPrograms = async () => {
    setLoading(true)
    try {
      const { programs: programsData, error } = await getAvailableEnginePrograms()
      
      if (error) {
        console.error('Error loading programs:', error)
        Alert.alert('Error', 'Failed to load programs. Please try again.')
        return
      }

      if (programsData) {
        setPrograms(programsData)
      }
    } catch (error) {
      console.error('Error in loadPrograms:', error)
      Alert.alert('Error', 'Failed to load programs. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleProgramPress = (programId: string) => {
    onProgramSelect(programId)
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE5858" />
        <Text style={styles.loadingText}>Loading programs...</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Engine Conditioning</Text>
        <Text style={styles.subtitle}>
          {hasEngineAccess 
            ? 'Choose your training program'
            : 'Explore our conditioning programs'}
        </Text>
      </View>

      {/* Program Cards */}
      <View style={styles.programsList}>
        {programs.map((program) => (
          <ProgramCard
            key={program.id}
            program={program}
            onPress={() => handleProgramPress(program.id)}
            buttonText={hasEngineAccess ? 'View Program' : '🔒 Subscribe to Start'}
            buttonStyle={hasEngineAccess ? 'secondary' : 'primary'}
          />
        ))}
      </View>

      {/* Footer Info */}
      {!hasEngineAccess && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            All programs included with Engine subscription
          </Text>
          <Text style={styles.footerSubtext}>
            Switch between programs anytime • No extra cost
          </Text>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
  },
  programsList: {
    gap: 12,
  },
  footer: {
    marginTop: 32,
    padding: 20,
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
})
