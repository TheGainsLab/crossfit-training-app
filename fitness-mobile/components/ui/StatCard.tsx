import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

interface StatCardProps {
  label: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
}

export function StatCard({ label, value, subtitle, icon }: StatCardProps) {
  return (
    <View style={styles.card}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {subtitle && (
        <Text style={styles.subtitle}>{subtitle}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  iconContainer: {
    marginBottom: 8,
  },
  value: {
    fontSize: 30,
    fontWeight: '700',
    color: '#FE5858',
    marginBottom: 4,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
})
