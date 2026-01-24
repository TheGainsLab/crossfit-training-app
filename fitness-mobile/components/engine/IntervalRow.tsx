import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Line } from 'react-native-svg'
import { calculateFluxPeriods, calculateBurstTimes, formatTime, normalizeBarWidth } from '@/lib/engine/progressHelpers'

interface Interval {
  id: number
  duration: number
  restDuration?: number
  blockNumber?: number | null
  roundNumber?: number | null
  completed?: boolean
  fluxDuration?: number
  baseDuration?: number
  fluxStartIntensity?: number
  fluxIncrement?: number
  fluxIntensity?: number | null
  burstTiming?: string
  burstDuration?: number
  targetPace?: any
  actualOutput?: number
}

interface IntervalRowProps {
  interval: Interval
  index: number
  isCurrent: boolean
  isCompleted: boolean
  maxDuration: number
  target: any
  // Flux segment props
  isFluxSegment?: boolean
  fluxSegmentType?: 'base' | 'flux'
  fluxSegmentDuration?: number
  fluxSegmentIntensity?: number
}

export default function IntervalRow({
  interval,
  index,
  isCurrent,
  isCompleted,
  maxDuration,
  target,
  isFluxSegment,
  fluxSegmentType,
  fluxSegmentDuration,
  fluxSegmentIntensity
}: IntervalRowProps) {
  // For flux segments, use segment duration; otherwise use interval duration
  const displayDuration = isFluxSegment && fluxSegmentDuration ? fluxSegmentDuration : interval.duration

  // Calculate bar width normalized to max duration
  const barWidth = normalizeBarWidth(displayDuration, maxDuration)

  // Determine bar color based on status and segment type
  let barColor = isCurrent ? '#FE5858' : isCompleted ? '#DAE2EA' : '#282B34'

  // For flux segments, use blue for FLUX when current
  if (isFluxSegment && fluxSegmentType === 'flux' && isCurrent) {
    barColor = '#3B82F6' // Blue for active flux
  }

  // Check if this is a flux interval (for legacy rendering - not used when isFluxSegment is true)
  const isFlux = !isFluxSegment && interval.fluxDuration && interval.baseDuration

  // Check if this is a polarized interval with bursts
  const hasBursts = interval.burstTiming && interval.burstTiming.length > 0
  
  return (
    <View
      style={[
        styles.intervalRow,
        isCurrent && styles.currentRow,
        isCompleted && styles.completedRow,
        isFluxSegment && fluxSegmentType === 'flux' && isCurrent && styles.fluxCurrentRow
      ]}
    >
      {/* Left label - WORK/FLUX for segments, Round number for intervals */}
      <View style={styles.labelContainer}>
        {isFluxSegment ? (
          <Text style={[
            styles.labelText,
            fluxSegmentType === 'flux' && styles.fluxLabelText,
            isCurrent && (fluxSegmentType === 'flux' ? styles.fluxCurrentText : styles.currentText),
            isCompleted && styles.completedText
          ]}>
            {fluxSegmentType === 'base' ? 'WORK' : 'FLUX'}
          </Text>
        ) : (
          <Text style={[
            styles.labelText,
            isCurrent && styles.currentText,
            isCompleted && styles.completedText
          ]}>
            R{interval.roundNumber || index + 1}
          </Text>
        )}
      </View>
      
      {/* Bar chart */}
      {isFluxSegment ? (
        // Flux segment: render a simple bar for this segment
        <View style={styles.barContainer}>
          <View style={styles.barBackground} />
          <View
            style={[
              styles.progressBar,
              {
                width: `${Math.min(barWidth, 100)}%`,
                backgroundColor: barColor
              }
            ]}
          >
            <Text style={[
              styles.barText,
              isCurrent && (fluxSegmentType === 'flux' ? styles.fluxCurrentBarText : styles.currentBarText),
              isCompleted && styles.completedBarText
            ]}>
              {formatTime(displayDuration)}
            </Text>
          </View>
        </View>
      ) : isFlux ? (
        // Legacy: Flux intervals with segmented view (now unused since we expand)
        <View style={styles.fluxBarContainer}>
          {(() => {
            const fluxPeriods = calculateFluxPeriods(
              interval.baseDuration!,
              interval.fluxDuration!,
              interval.duration,
              interval.fluxStartIntensity || 0.75,
              interval.fluxIncrement || 0.05
            )
            const totalWidth = barWidth

            return fluxPeriods.map((period, periodIdx) => {
              const segmentDuration = period.duration
              const segmentWidth = (segmentDuration / interval.duration) * totalWidth
              const isBase = period.type === 'base'

              return (
                <View
                  key={periodIdx}
                  style={[
                    styles.fluxSegment,
                    {
                      width: `${segmentWidth}%`,
                      backgroundColor: isBase ? '#FE5858' : '#DAE2EA'
                    }
                  ]}
                >
                  {!isBase && segmentWidth >= 8 && (
                    <Text style={[
                      styles.fluxLabel,
                      { color: '#282B34' }
                    ]}>
                      {Math.round((interval.fluxIntensity !== null && interval.fluxIntensity !== undefined
                        ? interval.fluxIntensity
                        : period.intensity) * 100)}%
                    </Text>
                  )}
                </View>
              )
            })
          })()}
        </View>
      ) : (
        // Non-flux intervals: render standard single bar
        <View style={styles.barContainer}>
          {/* Background bar */}
          <View style={styles.barBackground} />
          
          {/* Burst markers for polarized intervals */}
          {hasBursts && (() => {
            const burstTimes = calculateBurstTimes(
              interval.burstTiming!,
              interval.duration,
              interval.burstDuration || 7
            )
            const normalizedWidth = barWidth / 100 // Convert percentage to decimal
            
            return (
              <Svg
                height={36}
                width="100%"
                style={styles.burstOverlay}
              >
                {burstTimes.map((burst, idx) => {
                  const markerPosition = (burst.start / interval.duration) * normalizedWidth * 100
                  return (
                    <Line
                      key={`burst-${idx}`}
                      x1={`${Math.min(markerPosition, 100)}%`}
                      y1="0"
                      x2={`${Math.min(markerPosition, 100)}%`}
                      y2="36"
                      stroke="#FE5858"
                      strokeWidth="3"
                    />
                  )
                })}
              </Svg>
            )
          })()}
          
          {/* Progress bar */}
          <View
            style={[
              styles.progressBar,
              {
                width: `${Math.min(barWidth, 100)}%`,
                backgroundColor: barColor
              }
            ]}
          >
            <Text style={[
              styles.barText,
              isCurrent && styles.currentBarText,
              isCompleted && styles.completedBarText
            ]}>
              {formatTime(interval.duration)}
              {(interval.restDuration ?? 0) > 0 && ` + ${formatTime(interval.restDuration ?? 0)} rest`}
            </Text>
          </View>
        </View>
      )}
      
      {/* Right labels - Target goal for this interval */}
      <View style={styles.targetContainer}>
        {target ? (
          target.needsRocketRacesA ? (
            <Text style={styles.errorText}>
              {target.message}
            </Text>
          ) : target.isMaxEffort && !target.pace ? (
            <Text style={styles.maxEffortText}>
              Max Effort
            </Text>
          ) : target.pace ? (
            <View style={styles.targetInfo}>
              <Text style={[
                styles.goalText,
                isCurrent && (isFluxSegment && fluxSegmentType === 'flux' ? styles.fluxCurrentText : styles.currentText)
              ]}>
                {Math.round(target.pace * (displayDuration / 60))} {target.units || 'cal'}
              </Text>
              {target.source === 'metrics_adjusted' && (
                <View style={styles.aiBadge}>
                  <Text style={styles.aiBadgeText}>AI</Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.noBaselineText}>—</Text>
          )
        ) : (
          <Text style={styles.noBaselineText}>—</Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 8,
  },
  currentRow: {
    borderColor: '#FE5858',
    backgroundColor: 'transparent',
  },
  completedRow: {
    borderColor: '#282B34',
    backgroundColor: 'transparent',
  },
  labelContainer: {
    width: 40,
  },
  labelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#282B34',
  },
  currentText: {
    color: '#FE5858',
  },
  completedText: {
    color: '#DAE2EA',
  },
  fluxLabelText: {
    color: '#3B82F6',
  },
  fluxCurrentText: {
    color: '#3B82F6',
  },
  fluxCurrentRow: {
    borderColor: '#3B82F6',
  },
  fluxCurrentBarText: {
    color: '#FFFFFF',
  },
  fluxBarContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 2,
    height: 32,
    alignItems: 'center',
    backgroundColor: '#e5e7eb',
    borderRadius: 9999,
    padding: 2,
    overflow: 'hidden',
  },
  fluxSegment: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  fluxLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  barContainer: {
    flex: 1,
    backgroundColor: '#e5e7eb',
    borderRadius: 9999,
    height: 32,
    position: 'relative',
    overflow: 'visible',
  },
  barBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 9999,
    backgroundColor: '#e5e7eb',
  },
  burstOverlay: {
    position: 'absolute',
    top: -2,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  progressBar: {
    height: '100%',
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    position: 'relative',
    zIndex: 1,
  },
  barText: {
    color: '#F8FBFE',
    fontSize: 12,
    fontWeight: '600',
  },
  currentBarText: {
    color: '#F8FBFE',
  },
  completedBarText: {
    color: '#282B34',
  },
  targetContainer: {
    width: 70,
    alignItems: 'flex-end',
  },
  targetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  goalText: {
    color: '#282B34',
    fontWeight: '600',
    fontSize: 14,
  },
  intensityText: {
    color: '#6b7280',
    fontWeight: '500',
    fontSize: 12,
  },
  aiBadge: {
    backgroundColor: '#9333ea',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aiBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  errorText: {
    color: '#dc2626',
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  maxEffortText: {
    color: '#dc2626',
    fontWeight: '600',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noBaselineText: {
    color: '#9ca3af',
    fontStyle: 'italic',
    fontSize: 10,
  },
})
