import React, { useRef, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import IntervalRow from './IntervalRow'

interface Interval {
  id: number
  type: string
  duration: number
  restDuration?: number
  targetPace: any
  description?: string
  blockNumber?: number | null
  roundNumber?: number | null
  paceRange?: any
  paceProgression?: string | null
  workProgression?: string
  isMaxEffort?: boolean
  completed?: boolean
  workCompleted?: boolean
  actualOutput?: number
  fluxDuration?: number
  baseDuration?: number
  fluxStartIntensity?: number
  fluxIncrement?: number
  fluxIntensity?: number | null
  burstTiming?: string
  burstDuration?: number
  burstIntensity?: string
  basePace?: any
}

interface WorkoutProgressCardProps {
  intervals: Interval[]
  currentInterval: number
  isActive: boolean
  baselines: Record<string, any>
  selectedModality: string
  calculateTargetPaceWithData: (interval: Interval) => any
  shouldShowIntervalInputs: () => boolean
  onIntervalOutputChange: (intervalId: number, value: string) => void
}

const INTERVAL_ROW_HEIGHT = 68 // Approximate height of each row including margin

export default function WorkoutProgressCard({
  intervals,
  currentInterval,
  isActive,
  baselines,
  selectedModality,
  calculateTargetPaceWithData,
  shouldShowIntervalInputs,
  onIntervalOutputChange
}: WorkoutProgressCardProps) {
  const scrollViewRef = useRef<ScrollView>(null)
  
  // Auto-scroll to current interval
  useEffect(() => {
    if (currentInterval >= 0 && scrollViewRef.current && isActive) {
      // Scroll to current interval with some offset for visibility
      const yPosition = currentInterval * INTERVAL_ROW_HEIGHT
      scrollViewRef.current.scrollTo({
        y: Math.max(0, yPosition - 100), // Offset to show interval near top
        animated: true
      })
    }
  }, [currentInterval, isActive])
  
  // Calculate max duration for bar width normalization
  const maxDuration = intervals.length > 0 
    ? Math.max(...intervals.map(i => i.duration))
    : 0
  
  return (
    <View style={styles.card}>
      <Text style={styles.cardHeader}>Workout Progress</Text>
      
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {intervals.map((interval, index) => {
          const isCurrent = index === currentInterval && isActive
          const isCompleted = interval.completed
          
          // Calculate target pace for this interval
          const target = interval.targetPace || calculateTargetPaceWithData(interval)
          
          // Check if this is the start of a new block
          const prevInterval = index > 0 ? intervals[index - 1] : null
          const isNewBlock = prevInterval && 
            interval.blockNumber && 
            prevInterval.blockNumber && 
            interval.blockNumber !== prevInterval.blockNumber
          
          // Check if this is the first interval of a block (including first interval overall)
          const isFirstIntervalOfBlock = index === 0 || isNewBlock
          
          return (
            <React.Fragment key={interval.id}>
              {/* Block header */}
              {isFirstIntervalOfBlock && interval.blockNumber && (
                <View style={styles.blockHeader}>
                  <Text style={styles.blockHeaderText}>Block {interval.blockNumber}</Text>
                </View>
              )}
              
              <IntervalRow
                interval={interval}
                index={index}
                isCurrent={isCurrent}
                isCompleted={isCompleted}
                maxDuration={maxDuration}
                target={target}
                shouldShowInput={shouldShowIntervalInputs()}
                onOutputChange={onIntervalOutputChange}
              />
            </React.Fragment>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  scrollView: {
    maxHeight: 350, // Limit height to make it scrollable
  },
  scrollContent: {
    paddingBottom: 8,
  },
  blockHeader: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    marginTop: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  blockHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    letterSpacing: 0.5,
  },
})
