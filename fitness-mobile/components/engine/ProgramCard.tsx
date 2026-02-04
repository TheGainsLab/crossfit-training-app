import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { EngineProgram } from '@/lib/api/enginePrograms'

interface ProgramCardProps {
  program: EngineProgram
  isActive?: boolean
  onPress: () => void
  buttonText: string
  buttonStyle?: 'primary' | 'secondary' | 'active'
}

export default function ProgramCard({
  program,
  isActive = false,
  onPress,
  buttonText,
  buttonStyle = 'primary'
}: ProgramCardProps) {
  return (
    <TouchableOpacity
      style={[
        styles.card,
        isActive && styles.activeCard
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardContent}>
        {/* Icon and Title */}
        <View style={styles.header}>
          {program.icon && (
            <Text style={styles.icon}>{program.icon}</Text>
          )}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>
              {program.display_name}
              {isActive && (
                <Text style={styles.activeBadge}> ✓</Text>
              )}
            </Text>
          </View>
        </View>

        {/* Metadata */}
        <View style={styles.metadata}>
          <Text style={styles.metadataText}>
            {program.frequency_per_week} days/week
          </Text>
          <Text style={styles.metadataSeparator}>•</Text>
          <Text style={styles.metadataText}>
            {program.total_days} workouts
          </Text>
        </View>

        {/* Description */}
        {program.description && (
          <Text style={styles.description} numberOfLines={2}>
            {program.description}
          </Text>
        )}

        {/* Focus Areas */}
        {program.focus_areas && program.focus_areas.length > 0 && (
          <View style={styles.tags}>
            {program.focus_areas.slice(0, 3).map((area, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>
                  {area.replace(/_/g, ' ')}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Button */}
        <View
          style={[
            styles.button,
            buttonStyle === 'active' && styles.buttonActive,
            buttonStyle === 'secondary' && styles.buttonSecondary
          ]}
        >
          <Text
            style={[
              styles.buttonText,
              buttonStyle === 'active' && styles.buttonTextActive,
              buttonStyle === 'secondary' && styles.buttonTextSecondary
            ]}
          >
            {buttonText}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activeCard: {
    borderColor: '#FE5858',
    backgroundColor: '#FFF5F5',
  },
  cardContent: {
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 24,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  activeBadge: {
    color: '#FE5858',
    fontSize: 20,
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metadataText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  metadataSeparator: {
    fontSize: 14,
    color: '#D1D5DB',
  },
  description: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  button: {
    backgroundColor: '#FE5858',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonActive: {
    backgroundColor: '#10B981',
  },
  buttonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FE5858',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextActive: {
    color: '#FFFFFF',
  },
  buttonTextSecondary: {
    color: '#FE5858',
  },
})
