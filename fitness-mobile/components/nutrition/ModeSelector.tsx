import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

interface ModeSelectorProps {
  mode: 'log' | 'create' | 'edit'
  onModeChange: (mode: 'log' | 'create' | 'edit') => void
}

export default function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
  return (
    <View style={styles.container}>
      {[
        { key: 'log' as const, label: 'Log Food', icon: '🍽️' },
        { key: 'create' as const, label: 'Create Meal', icon: '➕' },
        { key: 'edit' as const, label: 'Edit Meals', icon: '✏️' }
      ].map(({ key, label, icon }) => (
        <TouchableOpacity
          key={key}
          style={[styles.modeTab, mode === key && styles.modeTabActive]}
          onPress={() => {
            console.log('🎛️ ModeSelector: changing to', key)
            onModeChange(key)
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.modeTabText, mode === key && styles.modeTabTextActive]}>
            {icon} {label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#F8FBFE',
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modeTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  modeTabTextActive: {
    color: '#FE5858',
    fontWeight: '600',
  },
})






















