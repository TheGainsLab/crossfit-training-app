import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

interface SectionHeaderProps {
  title: string
  subtitle?: string
  action?: {
    label: string
    onPress: () => void
  }
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <View style={[styles.container, !action && styles.containerCentered]}>
      <View style={[styles.left, !action && styles.leftCentered]}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && (
          <Text style={styles.subtitle}>{subtitle}</Text>
        )}
      </View>
      {action && (
        <TouchableOpacity
          onPress={action.onPress}
          style={styles.actionButton}
        >
          <Text style={styles.actionText}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  containerCentered: {
    justifyContent: 'center',
  },
  left: {
    flex: 1,
  },
  leftCentered: {
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#282B34',
  },
  subtitle: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 4,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionText: {
    color: '#FE5858',
    fontWeight: '600',
    fontSize: 14,
  },
})
