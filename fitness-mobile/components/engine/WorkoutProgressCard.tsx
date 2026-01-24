import React, { useRef, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import IntervalRow from './IntervalRow'
import { calculateFluxPeriods, FluxPeriod } from '@/lib/engine/progressHelpers'

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
  currentFluxSegmentIndex?: number // Track which segment we're in for flux intervals
  elapsedTimeInInterval?: number // Time elapsed in current interval (for flux segment tracking)
  isActive: boolean
  baselines: Record<string, any>
  selectedModality: string
  calculateTargetPaceWithData: (interval: Interval, fluxIntensity?: number | null) => any
}

const INTERVAL_ROW_HEIGHT = 68 // Approximate height of each row including margin

export default function WorkoutProgressCard({
  intervals,
  currentInterval,
  currentFluxSegmentIndex,
  elapsedTimeInInterval,
  isActive,
  baselines,
  selectedModality,
  calculateTargetPaceWithData
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
  
  // Expand flux intervals into segments for display
  const expandedRows: Array<{
    type: 'interval' | 'flux-segment'
    interval: Interval
    segmentIndex?: number
    segmentType?: 'base' | 'flux'
    segmentDuration?: number
    segmentIntensity?: number
    fluxPeriods?: FluxPeriod[]
    originalIntervalIndex: number
  }> = []

  intervals.forEach((interval, index) => {
    const isFlux = interval.fluxDuration && interval.baseDuration

    if (isFlux) {
      // Expand flux interval into segment rows
      const fluxPeriods = calculateFluxPeriods(
        interval.baseDuration!,
        interval.fluxDuration!,
        interval.duration,
        interval.fluxStartIntensity || 0.75,
        interval.fluxIncrement || 0.05
      )

      fluxPeriods.forEach((period, segIdx) => {
        expandedRows.push({
          type: 'flux-segment',
          interval,
          segmentIndex: segIdx,
          segmentType: period.type,
          segmentDuration: period.duration,
          segmentIntensity: period.intensity,
          fluxPeriods,
          originalIntervalIndex: index
        })
      })
    } else {
      // Regular interval
      expandedRows.push({
        type: 'interval',
        interval,
        originalIntervalIndex: index
      })
    }
  })

  // Calculate max duration for bar width normalization (use segment durations for flux)
  const maxDuration = expandedRows.length > 0
    ? Math.max(...expandedRows.map(row =>
        row.type === 'flux-segment' ? row.segmentDuration! : row.interval.duration
      ))
    : 0

  // Calculate current segment index for flux intervals
  const getCurrentFluxSegmentIndex = (): number => {
    if (currentInterval < 0 || !isActive) return -1
    const currentInt = intervals[currentInterval]
    if (!currentInt?.fluxDuration || !currentInt?.baseDuration || elapsedTimeInInterval === undefined) return -1

    const fluxPeriods = calculateFluxPeriods(
      currentInt.baseDuration,
      currentInt.fluxDuration,
      currentInt.duration,
      currentInt.fluxStartIntensity || 0.75,
      currentInt.fluxIncrement || 0.05
    )

    let cumulativeTime = 0
    for (let i = 0; i < fluxPeriods.length; i++) {
      cumulativeTime += fluxPeriods[i].duration
      if (elapsedTimeInInterval < cumulativeTime) {
        return i
      }
    }
    return fluxPeriods.length - 1
  }

  const activeFluxSegmentIndex = getCurrentFluxSegmentIndex()

  return (
    <View style={styles.card}>
      <Text style={styles.cardHeader}>Workout Progress</Text>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {expandedRows.map((row, rowIndex) => {
          const { interval, originalIntervalIndex } = row

          // Check if this is the start of a new block
          const prevRow = rowIndex > 0 ? expandedRows[rowIndex - 1] : null
          const isNewBlock = prevRow &&
            interval.blockNumber &&
            prevRow.interval.blockNumber &&
            interval.blockNumber !== prevRow.interval.blockNumber

          // Check if this is the first row of a block
          const isFirstRowOfBlock = rowIndex === 0 || isNewBlock

          if (row.type === 'flux-segment') {
            // Flux segment row
            const isCurrentInterval = originalIntervalIndex === currentInterval && isActive

            // Calculate which segments are completed based on elapsed time
            let isSegmentCompleted = false
            let isSegmentCurrent = false

            if (interval.completed) {
              isSegmentCompleted = true
            } else if (isCurrentInterval && activeFluxSegmentIndex >= 0) {
              if (row.segmentIndex! < activeFluxSegmentIndex) {
                isSegmentCompleted = true
              } else if (row.segmentIndex === activeFluxSegmentIndex) {
                isSegmentCurrent = true
              }
            } else if (originalIntervalIndex < currentInterval) {
              isSegmentCompleted = true
            }

            // Calculate target for this segment
            const fluxIntensity = row.segmentType === 'flux' ? row.segmentIntensity : null
            const segmentTarget = calculateTargetPaceWithData(interval, fluxIntensity)

            return (
              <React.Fragment key={`${interval.id}-seg-${row.segmentIndex}`}>
                {/* Block header */}
                {isFirstRowOfBlock && interval.blockNumber && (
                  <View style={styles.blockHeader}>
                    <Text style={styles.blockHeaderText}>Block {interval.blockNumber}</Text>
                  </View>
                )}

                <IntervalRow
                  interval={interval}
                  index={rowIndex}
                  isCurrent={isSegmentCurrent}
                  isCompleted={isSegmentCompleted}
                  maxDuration={maxDuration}
                  target={segmentTarget}
                  isFluxSegment={true}
                  fluxSegmentType={row.segmentType}
                  fluxSegmentDuration={row.segmentDuration}
                  fluxSegmentIntensity={row.segmentIntensity}
                />
              </React.Fragment>
            )
          } else {
            // Regular interval row
            const isCurrent = originalIntervalIndex === currentInterval && isActive
            const isCompleted = interval.completed
            const target = interval.targetPace || calculateTargetPaceWithData(interval)

            return (
              <React.Fragment key={interval.id}>
                {/* Block header */}
                {isFirstRowOfBlock && interval.blockNumber && (
                  <View style={styles.blockHeader}>
                    <Text style={styles.blockHeaderText}>Block {interval.blockNumber}</Text>
                  </View>
                )}

                <IntervalRow
                  interval={interval}
                  index={rowIndex}
                  isCurrent={isCurrent}
                  isCompleted={!!isCompleted}
                  maxDuration={maxDuration}
                  target={target}
                />
              </React.Fragment>
            )
          }
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
