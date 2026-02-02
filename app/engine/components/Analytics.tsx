'use client'

import React, { useState, useEffect } from 'react'
import { 
  ArrowLeft, 
  LineChart, 
  Target,
  Calendar,
  Filter,
  TrendingUp,
  CheckCircle
} from 'lucide-react'
import engineDatabaseService from '@/lib/engine/databaseService'

interface AnalyticsProps {
  onBack: () => void
}

interface WorkoutSession {
  id?: string
  user_id?: string
  workout_id?: string
  date?: string
  program_day?: number
  program_day_number?: number
  program_version?: string
  user_phase?: number
  modality?: string
  time_trial_baseline_id?: string
  day_type?: string
  total_output?: number
  actual_pace?: number
  target_pace?: number
  performance_ratio?: number
  units?: string
  average_heart_rate?: number
  peak_heart_rate?: number
  perceived_exertion?: number
  completed?: boolean
  workout_data?: any
  created_at?: string
  day_number?: number
  workout_day?: number
  duration_minutes?: number
  duration_seconds?: number
  avg_work_rest_ratio?: number | null
}

interface TimeTrial {
  id?: string
  user_id?: string
  modality?: string
  date?: string
  total_output?: number
  units?: string
  calculated_rpm?: number
  is_current?: boolean
  workout_id?: string
  duration_seconds?: number
  peak_heart_rate?: number
  average_heart_rate?: number
  perceived_exertion?: number
  program_day_number?: number
  day_type?: string
  program_version?: string
  created_at?: string
}

interface Workout {
  id?: string
  day_number?: number
  program_type?: string
  day_type?: string
  phase?: number
  block_count?: number
  block_1_params?: any
  block_2_params?: any
  block_3_params?: any
  block_4_params?: any
}

export default function Analytics({ onBack }: AnalyticsProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [connected, setConnected] = useState<boolean>(false);
  const [programVersion, setProgramVersion] = useState<any>(null); // User's program version
  const [workoutSessions, setWorkoutSessions] = useState<any[]>([]);
  const [timeTrials, setTimeTrials] = useState<any[]>([]);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [currentView, setCurrentView] = useState<string>('main'); // 'main', 'reviewHistory', 'compareDayTypes', 'showTimeTrials', 'targetVsActual', 'personalRecords', 'heartRateAnalytics', 'hrDayTypeDetails', 'workRestRatio', 'volumeProgression', 'structureAnalysis', 'completionRates', 'hrSessionDetails', 'intervalResults', 'variabilityTrend', 'variabilityComparison'
  const [analyticsModalityFilter, setAnalyticsModalityFilter] = useState<string>('');
  const [selectedHrDayType, setSelectedHrDayType] = useState<string>('');
  const [selectedHrMetric, setSelectedHrMetric] = useState<any>(null); // null until user selects a metric
  const [selectedHrDayTypeForCards, setSelectedHrDayTypeForCards] = useState<any>(null); // Track which day type bar was clicked
  const [previousViewForHrDetails, setPreviousViewForHrDetails] = useState<any>(null); // Track previous view for HR details navigation
  
  // Review History state
  const [selectedDayType, setSelectedDayType] = useState<string>('');
  const [selectedModality, setSelectedModality] = useState<string>('');
  const [startMonth, setStartMonth] = useState<string>('');
  const [endMonth, setEndMonth] = useState<string>('');
  
  // Compare Day Types state
  const [selectedDayTypes, setSelectedDayTypes] = useState<any[]>([]);
  const [compareModality, setCompareModality] = useState<string>('');
  const [compareStartMonth, setCompareStartMonth] = useState<string>('');
  const [compareEndMonth, setCompareEndMonth] = useState<string>('');
  const [dayTypeA, setDayTypeA] = useState<string>('');
  const [dayTypeB, setDayTypeB] = useState<any[]>([]); // Array to support multiple denominators
  const [showRatioComparison, setShowRatioComparison] = useState<boolean>(false);
  const [showMonthlyAverage, setShowMonthlyAverage] = useState<boolean>(true); // true = average, false = high
  const [showRatioCharts, setShowRatioCharts] = useState<boolean>(false); // Controls whether ratio charts are displayed
  
  // Personal Records state
  const [performanceView, setPerformanceView] = useState<string>('best'); // 'best', 'average', 'consistency'
  const [personalRecordsModality, setPersonalRecordsModality] = useState<string>('');
  
  // Target vs Actual filters
  const [targetVsActualModality, setTargetVsActualModality] = useState<string>('');
  const [targetVsActualDayType, setTargetVsActualDayType] = useState<string>('');
  
  // Time Trials filters
  const [timeTrialBaselineFilter, setTimeTrialBaselineFilter] = useState<string>('all'); // 'all', 'current', 'previous'
  const [timeTrialModalityFilter, setTimeTrialModalityFilter] = useState<string>('');
  
  // Work:Rest Ratio filters
  const [workRestRatioDayType, setWorkRestRatioDayType] = useState<string>('');

  // Interval Results state
  const [intervalResultsDayType, setIntervalResultsDayType] = useState<string>('');
  const [intervalResultsDay, setIntervalResultsDay] = useState<string>('');

  // Navigation state - track previous view for back button
  const [previousView, setPreviousView] = useState<any>(null);

  // Variability Trend state
  const [variabilityTrendDayType, setVariabilityTrendDayType] = useState<string>('');
  const [showDayTypeAverages, setShowDayTypeAverages] = useState<boolean>(false);

  // Interval Variation state
  const [variabilityComparisonDayTypes, setVariabilityComparisonDayTypes] = useState<any[]>([]);

  // Summary metrics state
  const [selectedSummaryModality, setSelectedSummaryModality] = useState<string>('');

  // Helper function to get the page title based on current view
  const getPageTitle = (): string => {
    const titleMap: Record<string, string> = {
      'main': 'Analytics',
      'reviewHistory': 'My History',
      'compareDayTypes': 'Comparisons',
      'ratioComparison': 'Ratio Comparison',
      'showTimeTrials': 'Time Trials',
      'targetVsActual': 'Targets vs Actual',
      'personalRecords': 'Personal Records',
      'heartRateAnalytics': 'HR Analytics',
      'hrDayTypeDetails': 'HR Analytics',
      'hrSessionDetails': 'HR Analytics',
      'workRestRatio': 'Work:Rest Ratio',
      'structureAnalysis': 'Structure Analysis',
      'intervalResults': 'Interval Results',
      'variabilityTrend': 'Variability Trend',
      'variabilityComparison': 'Interval Variation'
    };
    return titleMap[currentView] || 'Analytics';
  };

  useEffect(() => {
    const isConnected = engineDatabaseService.isConnected();
    setConnected(isConnected);
    
    if (isConnected) {
      loadProgramVersionAndData();
    }
  }, []);

  // Reset showRatioCharts when selections change
  useEffect(() => {
    setShowRatioCharts(false);
  }, [dayTypeA, dayTypeB, compareModality]);

  // Initialize selectedSummaryModality to most used modality when data loads
  useEffect(() => {
    if (!selectedSummaryModality && (workoutSessions.length > 0 || timeTrials.length > 0)) {
      const mostUsed = getMostUsedModality();
      if (mostUsed) {
        setSelectedSummaryModality(mostUsed);
      }
    }
  }, [workoutSessions, timeTrials]);

  const loadProgramVersionAndData = async () => {
    setLoading(true);
    try {
      // Load program version first
      const version = await engineDatabaseService.loadProgramVersion();
      setProgramVersion(version || '5-day'); // Default to 5-day if null
      
      // Load analytics data
      const [sessions, trials, workouts] = await Promise.all([
        engineDatabaseService.loadCompletedSessions(),
        engineDatabaseService.loadTimeTrials(),
        engineDatabaseService.loadWorkouts()
      ]);
      
      // Filter sessions to only include those matching user's program_version
      // Note: loadCompletedSessions now normalizes NULL program_version to '5-day'
      const userProgramVersion = version || '5-day';
      const filteredSessions = (sessions || []).filter((session: WorkoutSession) => {
        return session.program_version === userProgramVersion;
      });
      
      // Enrich time trials with workout data to get program_day_number
      const enrichedTrials = await Promise.all((trials || []).map(async (trial: TimeTrial) => {
        if (trial.workout_id && workouts) {
          const workout = workouts.find((w: Workout) => w.id === trial.workout_id);
          if (workout) {
            // Get source day_number from workout
            const sourceDayNumber = workout.day_number;
            
            // Convert to program_day_number based on program version
            let programDayNumber = null;
            if (userProgramVersion === '5-day') {
              programDayNumber = sourceDayNumber;
            } else if (userProgramVersion === '3-day') {
              // Use getProgramDayNumber to convert source_day_number to program_day_number
              programDayNumber = await engineDatabaseService.getProgramDayNumber(
                sourceDayNumber, 
                userProgramVersion
              );
            }
            
            return {
              ...trial,
              program_day_number: programDayNumber,
              day_type: 'time_trial',
              program_version: userProgramVersion
            };
          }
        }
        // If no workout_id, still add day_type
        return {
          ...trial,
          day_type: 'time_trial'
        };
      }));
      
      setWorkoutSessions(filteredSessions);
      setTimeTrials(enrichedTrials);
      setWorkouts(workouts || []);
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableDayTypes = (): string[] => {
    const dayTypes = new Set<string>();
    workoutSessions.forEach((session: WorkoutSession) => {
      if (session.day_type) {
        dayTypes.add(session.day_type);
      }
    });
    // Add 'time_trial' if there are any time trials with program_day_number
    if (timeTrials && timeTrials.length > 0) {
      const hasTimeTrialsWithDayNumber = timeTrials.some((trial: TimeTrial) => trial.program_day_number);
      if (hasTimeTrialsWithDayNumber) {
        dayTypes.add('time_trial');
      }
    }
    return Array.from(dayTypes).sort();
  };

  // Helper function to get day types eligible for work:rest ratio analysis
  // Excludes continuous workouts without rest segments
  const getWorkRestEligibleDayTypes = (): string[] => {
    const allDayTypes = getAvailableDayTypes();
    // Day types that don't have rest segments (continuous workouts)
    const continuousDayTypes = ['endurance', 'threshold', 'polarized', 'tempo', 'recovery'];
    return allDayTypes.filter((dayType: string) => !continuousDayTypes.includes(dayType));
  };

  const getAvailableModalities = (dayType: string | null = null): string[] => {
    const modalities = new Set<string>();
    const sessions = dayType 
      ? workoutSessions.filter((s: WorkoutSession) => s.day_type === dayType)
      : workoutSessions;
    
    sessions.forEach((session: WorkoutSession) => {
      if (session.modality) {
        modalities.add(session.modality);
      }
    });
    
    // Add modalities from time trials if filtering by time_trial or no filter
    if (!dayType || dayType === 'time_trial') {
      timeTrials.forEach((trial: TimeTrial) => {
        if (trial.modality && trial.program_day_number) {
          modalities.add(trial.modality);
        }
      });
    }
    
    return Array.from(modalities).sort();
  };

  // Helper function to format modality names for display
  const getModalityDisplayName = (modality: string | null): string => {
    if (!modality) return 'Unknown Modality';
    // Replace underscores with spaces and capitalize each word
    return modality
      .split('_')
      .map((word: string) => {
        // Handle special cases like "c2" -> "C2"
        if (word.toLowerCase() === 'c2') {
          return 'C2';
        }
        // Capitalize first letter of each word
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  };

  // Helper function to format day type names for display
  const getWorkoutTypeDisplayName = (dayType: string | null): string => {
    if (!dayType) return 'Workout';
    const typeMap: Record<string, string> = {
      'time_trial': 'Time Trial',
      'endurance': 'Endurance',
      'anaerobic': 'Anaerobic',
      'max_aerobic_power': 'Max Aerobic Power',
      'interval': 'Interval',
      'polarized': 'Polarized',
      'threshold': 'Threshold',
      'tempo': 'Tempo',
      'recovery': 'Recovery',
      'flux': 'Flux',
      'flux_stages': 'Flux Stages',
      'devour': 'Devour',
      'towers': 'Towers',
      'towers_block_1': 'Towers',
      'afterburner': 'Afterburner',
      'synthesis': 'Synthesis',
      'hybrid_anaerobic': 'Hybrid Anaerobic',
      'hybrid_aerobic': 'Hybrid Aerobic',
      'ascending': 'Ascending',
      'descending': 'Descending',
      'ascending_devour': 'Ascending Devour',
      'descending_devour': 'Descending Devour',
      'infinity': 'Infinity',
      'infinity_block_1': 'Infinity',
      'infinity_block_2': 'Infinity',
      'atomic': 'Atomic',
      'atomic_block_2': 'Atomic',
      'rocket_races_a': 'Rocket Races A',
      'rocket_races_b': 'Rocket Races B'
    };
    return typeMap[dayType] || dayType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Workout';
  };

  // Helper function to calculate summary ratios (Glycolytic, Aerobic, Systems)
  const calculateSummaryRatios = (modality: string): { glycolytic: number | null, aerobic: number | null, systems: number | null } => {
    if (!modality) return { glycolytic: null, aerobic: null, systems: null };

    // Get anaerobic sessions for this modality
    const anaerobicSessions = workoutSessions.filter(
      (s: WorkoutSession) => s.day_type === 'anaerobic' && s.modality === modality && s.actual_pace && s.actual_pace > 0
    );
    const anaerobicAvg = anaerobicSessions.length > 0
      ? anaerobicSessions.reduce((sum, s) => sum + (s.actual_pace || 0), 0) / anaerobicSessions.length
      : null;

    // Get max aerobic power sessions for this modality
    const maxAerobicSessions = workoutSessions.filter(
      (s: WorkoutSession) => s.day_type === 'max_aerobic_power' && s.modality === modality && s.actual_pace && s.actual_pace > 0
    );
    const maxAerobicAvg = maxAerobicSessions.length > 0
      ? maxAerobicSessions.reduce((sum, s) => sum + (s.actual_pace || 0), 0) / maxAerobicSessions.length
      : null;

    // Get most recent time trial for this modality
    const modalityTimeTrials = timeTrials
      .filter((t: TimeTrial) => t.modality === modality && t.calculated_rpm && t.calculated_rpm > 0)
      .sort((a: TimeTrial, b: TimeTrial) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    const recentTimeTrial = modalityTimeTrials.length > 0 ? modalityTimeTrials[0].calculated_rpm : null;

    // Calculate ratios
    const glycolytic = (anaerobicAvg && recentTimeTrial) ? anaerobicAvg / recentTimeTrial : null;
    const aerobic = (maxAerobicAvg && recentTimeTrial) ? maxAerobicAvg / recentTimeTrial : null;
    const systems = (anaerobicAvg && maxAerobicAvg) ? anaerobicAvg / maxAerobicAvg : null;

    return { glycolytic, aerobic, systems };
  };

  // Helper function to get the most used modality
  const getMostUsedModality = (): string => {
    const modalityCounts: Record<string, number> = {};
    workoutSessions.forEach((s: WorkoutSession) => {
      if (s.modality) {
        modalityCounts[s.modality] = (modalityCounts[s.modality] || 0) + 1;
      }
    });
    timeTrials.forEach((t: TimeTrial) => {
      if (t.modality) {
        modalityCounts[t.modality] = (modalityCounts[t.modality] || 0) + 1;
      }
    });
    const sortedModalities = Object.entries(modalityCounts).sort((a, b) => b[1] - a[1]);
    return sortedModalities.length > 0 ? sortedModalities[0][0] : '';
  };

  // Helper function to get modalities with sufficient data for ratios
  const getModalitiesWithRatioData = (): string[] => {
    const modalities = getAvailableModalities();
    return modalities.filter(modality => {
      const hasAnaerobic = workoutSessions.some(
        (s: WorkoutSession) => s.day_type === 'anaerobic' && s.modality === modality && s.actual_pace
      );
      const hasMaxAerobic = workoutSessions.some(
        (s: WorkoutSession) => s.day_type === 'max_aerobic_power' && s.modality === modality && s.actual_pace
      );
      const hasTimeTrial = timeTrials.some(
        (t: TimeTrial) => t.modality === modality && t.calculated_rpm
      );
      // Return true if at least one ratio can be calculated
      return (hasAnaerobic && hasTimeTrial) || (hasMaxAerobic && hasTimeTrial) || (hasAnaerobic && hasMaxAerobic);
    });
  };

  // Helper function to get days per month based on program version
  const getDaysPerMonth = (programVersion: string): number => {
    if (!programVersion) return 20; // Default to 5-day
    return programVersion === '3-day' ? 12 : 20;
  };

  const getProgramMonths = (): number[] => {
    const months = new Set<number>();
    const daysPerMonth = getDaysPerMonth(programVersion);
    
    workoutSessions.forEach((session: WorkoutSession) => {
      // Use program_day_number if available, fallback to program_day for backward compatibility
      const dayNumber = session.program_day_number || session.program_day;
      if (dayNumber) {
        const month = Math.ceil(dayNumber / daysPerMonth);
        months.add(month);
      }
    });
    
    // Add months from time trials
    timeTrials.forEach((trial: TimeTrial) => {
      if (trial.program_day_number) {
        const month = Math.ceil(trial.program_day_number / daysPerMonth);
        months.add(month);
      }
    });
    
    return Array.from(months).sort((a: any, b: any) => a - b);
  };

  const getFilteredSessions = (dayType: string | string[] | null, modality: string, startMonth: string, endMonth: string): WorkoutSession[] => {
    const daysPerMonth = getDaysPerMonth(programVersion);
    const allSessions = [...workoutSessions];
    
    // If filtering by time_trial or no day type filter, include time trials
    if (dayType === 'time_trial' || !dayType) {
      const convertedTrials = timeTrials
        .filter((trial: TimeTrial) => trial.program_day_number) // Only include trials with program_day_number
        .map((trial: TimeTrial) => ({
          id: trial.id,
          user_id: trial.user_id,
          date: trial.date,
          modality: trial.modality,
          day_type: 'time_trial',
          total_output: trial.total_output,
          calculated_rpm: trial.calculated_rpm,
          units: trial.units,
          actual_pace: trial.calculated_rpm, // Use calculated_rpm as actual_pace
          target_pace: null,
          performance_ratio: null,
          average_heart_rate: trial.average_heart_rate,
          peak_heart_rate: trial.peak_heart_rate,
          perceived_exertion: trial.perceived_exertion,
          completed: true,
          duration_seconds: trial.duration_seconds || 600,
          program_day_number: trial.program_day_number,
          program_day: null,
          program_version: trial.program_version || programVersion
        }));
      
      // Only add time trials if filtering by time_trial or no filter
      if (dayType === 'time_trial' || !dayType) {
        allSessions.push(...convertedTrials);
      }
    }
    
    return allSessions.filter((session: WorkoutSession) => {
      // Filter by day type
      if (dayType && session.day_type !== dayType) {
        return false;
      }
      
      // Filter by modality
      if (modality && session.modality !== modality) {
        return false;
      }
      
      // Filter by month range using program_day_number
      const dayNumber = session.program_day_number || session.program_day;
      if (dayNumber) {
        const month = Math.ceil(dayNumber / daysPerMonth);
        if (startMonth && month < parseInt(startMonth, 10)) return false;
        if (endMonth && month > parseInt(endMonth, 10)) return false;
      } else if (startMonth || endMonth) {
        // If no program_day_number and month filters are set, exclude it
        return false;
      }
      
      return true;
    });
  };

  const calculatePace = (session: WorkoutSession): number | null => {
    if (session.actual_pace) {
      return session.actual_pace;
    }
    
    if (session.total_output && session.workout_data?.total_work_time) {
      return session.total_output / (session.workout_data.total_work_time / 60);
    }
    
    return 0;
  };

  // Helper function to get target pace range for a session
  const getTargetPaceRange = (session: WorkoutSession): any => {
    // Special handling for max effort days (anaerobic, rocket races)
    if (session.day_type === 'anaerobic' || session.day_type === 'rocket_races_a' || session.day_type === 'rocket_races_b') {
      return { min: 0, max: 0, isMaxEffort: true };
    }
    
    // Use target_pace from session if available
    if (session.target_pace) {
      const targetPace = session.target_pace;
      const tolerance = targetPace * 0.10; // 10% tolerance
      return { 
        min: targetPace - tolerance, 
        max: targetPace + tolerance 
      };
    }
    
    // For time trial, use the baseline RPM converted to pace
    if (session.day_type === 'time_trial') {
      // Time trials are max effort, so all are considered successful
      return { min: 0, max: 0, isMaxEffort: true };
    }
    
    // Try to get target pace from workout_data if available
    if (session.workout_data?.target_pace) {
      const targetPace = session.workout_data.target_pace;
      const tolerance = targetPace * 0.10;
      return { 
        min: targetPace - tolerance, 
        max: targetPace + tolerance 
      };
    }
    
    // Try to extract from block parameters
    if (session.workout_data?.block_1_params) {
      const block1 = session.workout_data.block_1_params;
      
      // Handle pace ranges (e.g., basePace)
      if (block1.basePace && Array.isArray(block1.basePace) && block1.basePace.length === 2) {
        return { 
          min: block1.basePace[0], 
          max: block1.basePace[1] 
        };
      }
      
      // Handle single target pace
      if (block1.targetPace) {
        const targetPace = block1.targetPace;
        const tolerance = targetPace * 0.10;
        return { 
          min: targetPace - tolerance, 
          max: targetPace + tolerance 
        };
      }
    }
    
    // Fallback: couldn't determine target
    return { min: 0, max: 0, isUnknown: true };
  };

  // Helper function to get a single target pace value (for averaging)
  const getTargetPaceValue = (session: WorkoutSession): number | null => {
    // Prefer direct target_pace field (most reliable)
    if (session.target_pace) {
      return session.target_pace;
    }
    
    // Try workout_data
    if (session.workout_data?.target_pace) {
      return session.workout_data.target_pace;
    }
    
    // Extract from range (use midpoint)
    const range = getTargetPaceRange(session);
    if (!range.isUnknown && !range.isMaxEffort && range.min > 0 && range.max > 0) {
      return (range.min + range.max) / 2;
    }
    
    return null; // No target available
  };

  // Helper function to determine if actual pace is within target
  const getPacePerformance = (session: WorkoutSession): any => {
    const actualPace = calculatePace(session);
    const targetRange = getTargetPaceRange(session);
    
    // Max effort sessions are always considered successful
    if (targetRange.isMaxEffort) {
      return { status: 'within_target', actualPace, targetRange };
    }
    
    // If target is unknown, we can't evaluate performance
    if (targetRange.isUnknown || (targetRange.min === 0 && targetRange.max === 0)) {
      return { status: 'unknown', actualPace, targetRange };
    }
    
    const { min, max } = targetRange;
    
    if (actualPace !== null && actualPace >= min && actualPace <= max) {
      return { status: 'within_target', actualPace, targetRange };
    } else {
      // Check if within 10% tolerance
      if (actualPace === null) {
        return { status: 'unknown', actualPace, targetRange };
      }
      const rangeMid = (min + max) / 2;
      const tolerance = rangeMid * 0.10;
      
      if (actualPace >= (min - tolerance) && actualPace <= (max + tolerance)) {
        return { status: 'close', actualPace, targetRange };
      } else {
        return { status: 'outside_target', actualPace, targetRange };
      }
    }
  };

  // Helper function to get monthly ratio data between two day types
  const getMonthlyRatioData = (dayTypeA: string, dayTypeB: string[], modality: string, startMonth: string, endMonth: string): Record<number, any> => {
    const sessionsA = getFilteredSessions(dayTypeA, modality, startMonth, endMonth);
    const sessionsB = getFilteredSessions(dayTypeB, modality, startMonth, endMonth);
    
    const monthlyDataA: Record<number, number[]> = {};
    const monthlyDataB: Record<number, number[]> = {};
    const daysPerMonth = getDaysPerMonth(programVersion);
    
    // Process sessions for day type A
    sessionsA.forEach((session: WorkoutSession) => {
      // Use program_day_number if available, fallback to program_day for backward compatibility
      const dayNumber = session.program_day_number || session.program_day;
      const month = dayNumber ? Math.ceil(dayNumber / daysPerMonth) : 1;
      
      if (!monthlyDataA[month]) {
        monthlyDataA[month] = [];
      }
      
      const pace = calculatePace(session);
      if (pace !== null && pace > 0) {
        monthlyDataA[month].push(pace);
      }
    });
    
    // Process sessions for day type B
    sessionsB.forEach((session: WorkoutSession) => {
      // Use program_day_number if available, fallback to program_day for backward compatibility
      const dayNumber = session.program_day_number || session.program_day;
      const month = dayNumber ? Math.ceil(dayNumber / daysPerMonth) : 1;
      
      if (!monthlyDataB[month]) {
        monthlyDataB[month] = [];
      }
      
      const pace = calculatePace(session);
      if (pace !== null && pace > 0) {
        monthlyDataB[month].push(pace);
      }
    });
    
    // Calculate monthly ratios
    const ratioData: Record<number, any> = {};
    const allMonths = new Set([...Object.keys(monthlyDataA), ...Object.keys(monthlyDataB)].map(k => parseInt(k, 10)));
    
    allMonths.forEach((month: number) => {
      const pacesA = monthlyDataA[month] || [];
      const pacesB = monthlyDataB[month] || [];
      
      if (pacesA.length > 0 && pacesB.length > 0) {
        const avgA = pacesA.reduce((sum: number, pace: number) => sum + pace, 0) / pacesA.length;
        const avgB = pacesB.reduce((sum: number, pace: number) => sum + pace, 0) / pacesB.length;
        const highA = Math.max(...pacesA);
        const highB = Math.max(...pacesB);
        
        ratioData[month] = {
          averageRatio: avgA / avgB,
          highRatio: highA / highB,
          countA: pacesA.length,
          countB: pacesB.length,
          avgA,
          avgB,
          highA,
          highB
        };
      }
    });
    
    return ratioData;
  };

  // Helper function to get personal records data
  const getPersonalRecordsData = (modalityFilter: string = ''): any => {
    const records: Record<string, any> = {};
    
    workoutSessions.forEach((session: WorkoutSession) => {
      // Filter by modality if selected
      if (modalityFilter && session.modality !== modalityFilter) {
        return;
      }
      
      const dayType = session.day_type;
      const dayTypeKey = dayType || 'unknown';
      const pace = calculatePace(session);
      
      if (!records[dayTypeKey]) {
        records[dayTypeKey] = {
          best: { pace: 0, date: null, session: null },
          sessions: []
        };
      }
      
      records[dayTypeKey].sessions.push({ pace, date: session.date, session });
      
      if (pace !== null && pace > records[dayTypeKey].best.pace) {
        records[dayTypeKey].best = { pace, date: session.date, session };
      }
    });
    
    // Calculate averages
    Object.keys(records).forEach((dayType: string) => {
      const sessions = records[dayType].sessions;
      const totalPace = sessions.reduce((sum: number, s: any) => sum + s.pace, 0);
      records[dayType].average = sessions.length > 0 ? totalPace / sessions.length : 0;
    });
    
    return records;
  };

  // Helper function to get baseline paces by modality from time trials
  const getBaselinePaces = (): any => {
    const baselines: Record<string, any> = {};
    
    // Get the most recent time trial for each modality
    const modalityTrials: Record<string, TimeTrial> = {};
    timeTrials.forEach((trial: TimeTrial) => {
      const modality = trial.modality || 'unknown';
      if (!modalityTrials[modality]) {
        modalityTrials[modality] = trial;
      } else {
        // Keep most recent
        const trialDate = trial.date ? new Date(trial.date) : new Date(0);
        const existingDate = modalityTrials[modality].date ? new Date(modalityTrials[modality].date) : new Date(0);
        if (trialDate > existingDate) {
          modalityTrials[modality] = trial;
        }
      }
    });
    
    // Extract baseline pace for each modality
    Object.entries(modalityTrials).forEach(([modality, trial]: [string, TimeTrial]) => {
      if (trial.total_output && trial.duration_seconds) {
        baselines[modality] = trial.total_output / (trial.duration_seconds / 60);
      }
    });
    
    return baselines;
  };

  // Helper function to get heart rate analytics data
  const getHeartRateAnalyticsData = (): any => {
    const baselines = getBaselinePaces();
    const hrData: Record<string, any> = {};
    const sessionsWithHR = workoutSessions.filter((session: WorkoutSession) => 
      session.average_heart_rate && session.peak_heart_rate &&
      (!analyticsModalityFilter || session.modality === analyticsModalityFilter)
    );
    
    // Group by day type
    sessionsWithHR.forEach((session: WorkoutSession) => {
      const dayType: string = session.day_type || 'unknown';
      const pace = calculatePace(session);
      const avgHR = session.average_heart_rate;
      const peakHR = session.peak_heart_rate;
      
      // Get duration in minutes
      let durationMinutes = 0;
      if (session.workout_data?.total_work_time) {
        durationMinutes = session.workout_data.total_work_time / 60; // Convert seconds to minutes
      } else if (session.duration_minutes) {
        durationMinutes = session.duration_minutes;
      } else if (session.duration_seconds) {
        durationMinutes = session.duration_seconds / 60;
      }
      
      // Get baseline for this modality to normalize efficiency
      const modality = session.modality || 'unknown';
      const baseline = baselines[modality];
      let efficiency = 0;
      let normalizedTrainingLoad = 0;
      
      if (avgHR !== undefined && avgHR > 0 && pace !== null) {
        if (baseline && baseline > 0) {
          // Normalized efficiency: (pace / baseline) / avgHR
          // This cancels out units and makes it comparable across modalities
          // Multiply by 1000 to make numbers more comprehensible (e.g., 0.005 becomes 5.0)
          efficiency = ((pace / baseline) / avgHR) * 1000;
          // Training load: intensity × HR × duration
          normalizedTrainingLoad = (pace / baseline) * avgHR * durationMinutes;
        } else {
          // Fallback to original calculation if no baseline available
          // Multiply by 1000 to make numbers more comprehensible
          efficiency = (pace / avgHR) * 1000;
          normalizedTrainingLoad = pace * avgHR * durationMinutes;
        }
      }
      
      if (!hrData[dayType]) {
        hrData[dayType] = {
          sessions: [],
          avgHR: [],
          peakHR: [],
          efficiency: [],
          trainingLoad: [] // Normalized training load
        };
      }
      
      hrData[dayType].sessions.push({
        date: session.date,
        pace,
        avgHR,
        peakHR,
        efficiency,
        trainingLoad: normalizedTrainingLoad,
        session
      });
      
      hrData[dayType].avgHR.push(avgHR);
      hrData[dayType].peakHR.push(peakHR);
      hrData[dayType].efficiency.push(efficiency);
      hrData[dayType].trainingLoad.push(normalizedTrainingLoad);
    });
    
    // Calculate averages and trends
    Object.keys(hrData).forEach((dayType: string) => {
      const data = hrData[dayType];
      const sessionCount = data.sessions.length;
      
      if (sessionCount > 0) {
        data.avgHRMean = data.avgHR.reduce((sum: number, hr: number) => sum + hr, 0) / sessionCount;
        data.peakHRMean = data.peakHR.reduce((sum: number, hr: number) => sum + hr, 0) / sessionCount;
        data.efficiencyMean = data.efficiency.reduce((sum: number, eff: number) => sum + eff, 0) / sessionCount;
        data.trainingLoadMean = data.trainingLoad.reduce((sum: number, load: number) => sum + load, 0) / sessionCount;
        
        // Calculate trends (simple linear regression slope)
        data.avgHRTrend = calculateTrend(data.sessions.map((s: any) => s.avgHR));
        data.efficiencyTrend = calculateTrend(data.sessions.map((s: any) => s.efficiency));
        data.trainingLoadTrend = calculateTrend(data.sessions.map((s: any) => s.trainingLoad));
      }
    });
    
    return hrData;
  };

  // Helper function to calculate trend slope
  const calculateTrend = (values: number[]): number => {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const x = Array.from({length: n}, (_, i) => i);
    const sumX = x.reduce((sum: number, val: number) => sum + val, 0);
    const sumY = values.reduce((sum: number, val: number) => sum + val, 0);
    const sumXY = x.reduce((sum: number, val: number, i: number) => sum + val * values[i], 0);
    const sumXX = x.reduce((sum: number, val: number) => sum + val * val, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  };

  // Helper function to get recovery insights
  const getRecoveryInsights = (): any => {
    const baselines = getBaselinePaces();
    const sessionsWithHR = workoutSessions.filter((session: WorkoutSession) => 
      session.average_heart_rate && session.peak_heart_rate
    ).sort((a: any, b: any) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
    
    const insights: {
      highStressDays: Array<{
        date?: string;
        dayType?: string;
        trainingLoad: number;
        avgHR?: number;
        peakHR?: number;
        pace: number;
      }>;
      recoveryPatterns: any[];
      efficiencyTrends: any[];
    } = {
      highStressDays: [],
      recoveryPatterns: [],
      efficiencyTrends: []
    };
    
    // Identify high stress days (top 20% training load) - using normalized load
    const trainingLoads = sessionsWithHR.map((session: WorkoutSession) => {
      const pace = calculatePace(session);
      const baseline = baselines[session.modality || 'unknown'];
      const avgHR = session.average_heart_rate;
      
      // Get duration
      let durationMinutes = 0;
      if (session.workout_data?.total_work_time) {
        durationMinutes = session.workout_data.total_work_time / 60;
      } else if (session.duration_minutes) {
        durationMinutes = session.duration_minutes;
      } else if (session.duration_seconds) {
        durationMinutes = session.duration_seconds / 60;
      }
      
      // Normalize training load to make it comparable across modalities: intensity × HR × duration
      if (pace === null || !avgHR) {
        return 0;
      }
      if (baseline && baseline > 0) {
        return (pace / baseline) * avgHR * durationMinutes;
      } else {
        return pace * avgHR * durationMinutes;
      }
    });
    
    const sortedLoads = [...trainingLoads].sort((a: number, b: number) => b - a);
    const threshold = sortedLoads[Math.floor(sortedLoads.length * 0.2)];
    
    sessionsWithHR.forEach((session: WorkoutSession) => {
      const pace = calculatePace(session);
      const baseline = baselines[session.modality || 'unknown'];
      const avgHR = session.average_heart_rate;
      
      // Get duration
      let durationMinutes = 0;
      if (session.workout_data?.total_work_time) {
        durationMinutes = session.workout_data.total_work_time / 60;
      } else if (session.duration_minutes) {
        durationMinutes = session.duration_minutes;
      } else if (session.duration_seconds) {
        durationMinutes = session.duration_seconds / 60;
      }
      
      // Use normalized training load: intensity × HR × duration
      if (pace === null || !avgHR) {
        return; // Skip this session
      }
      const trainingLoad = baseline && baseline > 0 
        ? (pace / baseline) * avgHR * durationMinutes
        : pace * avgHR * durationMinutes;
      
      if (trainingLoad >= threshold) {
        insights.highStressDays.push({
          date: session.date,
          dayType: session.day_type,
          trainingLoad,
          avgHR: session.average_heart_rate,
          peakHR: session.peak_heart_rate,
          pace
        });
      }
    });
    
    return insights;
  };

  const renderMainMenu = (): React.ReactElement => {
    const hasData = workoutSessions.length > 0 || timeTrials.length > 0;
    
    return (
      <div>
        {!hasData && (
          <div style={{
            background: '#DAE2EA',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            padding: '2rem',
            border: '1px solid #FE5858',
            textAlign: 'center',
            marginBottom: '2rem'
          }}>
            <div style={{
              fontSize: '3rem',
              marginBottom: '1rem',
              opacity: 0.5
            }}>📊</div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#111827',
              marginBottom: '0.5rem'
            }}>No Data Available Yet</h3>
            <p style={{
              color: '#6b7280',
              marginBottom: '1.5rem',
              lineHeight: '1.6'
            }}>
              Complete some workouts and time trials to see your analytics here.
            </p>
            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button 
                onClick={() => window.location.href = '#dashboard'}
                style={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                  (e.target as HTMLElement).style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.4)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.transform = 'translateY(0)';
                  (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.3)';
                }}
              >
                Start Workout
              </button>
              <button 
                onClick={() => window.location.href = '#timetrial'}
                style={{
                  background: '#DAE2EA',
                  color: '#6b7280',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.9)';
                  (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.7)';
                  (e.target as HTMLElement).style.transform = 'translateY(0)';
                }}
              >
                Take Time Trial
              </button>
            </div>
          </div>
        )}

        {/* Summary Section */}
        {hasData && (
          <div style={{
            background: '#DAE2EA',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            padding: '1.5rem',
            border: '1px solid #E5E7EB',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: '#282B34',
              marginBottom: '1rem',
              textAlign: 'center'
            }}>Summary</h3>

            {/* Workouts and Time Trials row */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                background: 'white',
                borderRadius: '0.75rem',
                padding: '1rem 2rem',
                border: '1px solid #E5E7EB',
                textAlign: 'center',
                minWidth: '120px'
              }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#FE5858' }}>
                  {workoutSessions.filter((s: WorkoutSession) => s.day_type !== 'time_trial').length}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6B7280' }}>Workouts</div>
              </div>
              <div style={{
                background: 'white',
                borderRadius: '0.75rem',
                padding: '1rem 2rem',
                border: '1px solid #E5E7EB',
                textAlign: 'center',
                minWidth: '120px'
              }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#FE5858' }}>
                  {timeTrials.filter((t: TimeTrial) => t.program_day_number).length}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6B7280' }}>Time Trials</div>
              </div>
            </div>

            {/* Modality selector for ratios */}
            {getModalitiesWithRatioData().length > 0 && (
              <>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  marginBottom: '1rem'
                }}>
                  <span style={{ fontSize: '0.875rem', color: '#6B7280' }}>Modality:</span>
                  <select
                    value={selectedSummaryModality}
                    onChange={(e) => setSelectedSummaryModality(e.target.value)}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #E5E7EB',
                      background: 'white',
                      fontSize: '0.875rem',
                      color: '#282B34',
                      cursor: 'pointer'
                    }}
                  >
                    {getModalitiesWithRatioData().map((modality) => (
                      <option key={modality} value={modality}>
                        {getModalityDisplayName(modality)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Ratio Cards */}
                {(() => {
                  const ratios = calculateSummaryRatios(selectedSummaryModality);
                  const hasAnyRatio = ratios.glycolytic !== null || ratios.aerobic !== null || ratios.systems !== null;

                  if (!hasAnyRatio) {
                    return (
                      <div style={{ textAlign: 'center', color: '#6B7280', fontSize: '0.875rem', padding: '1rem' }}>
                        Not enough data for this modality. Complete Anaerobic, Max Aerobic Power workouts and Time Trials to see ratios.
                      </div>
                    );
                  }

                  return (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '0.75rem'
                    }}>
                      {/* Glycolytic Ratio */}
                      <div style={{
                        background: 'white',
                        borderRadius: '0.75rem',
                        padding: '1rem',
                        border: '1px solid #E5E7EB',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: ratios.glycolytic !== null ? '#FE5858' : '#9CA3AF' }}>
                          {ratios.glycolytic !== null ? ratios.glycolytic.toFixed(2) : '--'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem' }}>Glycolytic Ratio</div>
                        <div style={{ fontSize: '0.625rem', color: '#9CA3AF', marginTop: '0.125rem' }}>Anaerobic / TT</div>
                      </div>

                      {/* Aerobic Ratio */}
                      <div style={{
                        background: 'white',
                        borderRadius: '0.75rem',
                        padding: '1rem',
                        border: '1px solid #E5E7EB',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: ratios.aerobic !== null ? '#FE5858' : '#9CA3AF' }}>
                          {ratios.aerobic !== null ? ratios.aerobic.toFixed(2) : '--'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem' }}>Aerobic Ratio</div>
                        <div style={{ fontSize: '0.625rem', color: '#9CA3AF', marginTop: '0.125rem' }}>MAP / TT</div>
                      </div>

                      {/* Systems Ratio */}
                      <div style={{
                        background: 'white',
                        borderRadius: '0.75rem',
                        padding: '1rem',
                        border: '1px solid #E5E7EB',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: ratios.systems !== null ? '#FE5858' : '#9CA3AF' }}>
                          {ratios.systems !== null ? ratios.systems.toFixed(2) : '--'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem' }}>Systems Ratio</div>
                        <div style={{ fontSize: '0.625rem', color: '#9CA3AF', marginTop: '0.125rem' }}>Anaerobic / MAP</div>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.5rem'
        }}>
        {/* Review Day Type History */}
        <div 
          onClick={() => setCurrentView('reviewHistory')}
          style={{
            background: '#DAE2EA',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            padding: '1.25rem',
            cursor: 'pointer',
            border: '1px solid #FE5858',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.transform = 'translateY(-4px)';
            (e.target as HTMLElement).style.boxShadow = '0 8px 30px -5px rgba(0, 0, 0, 0.15), 0 15px 15px -5px rgba(0, 0, 0, 0.08)';
            (e.target as HTMLElement).style.borderColor = 'rgba(59, 130, 246, 0.3)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.transform = 'translateY(0)';
            (e.target as HTMLElement).style.boxShadow = '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
            (e.target as HTMLElement).style.borderColor = '#FE5858';
          }}
          className="animate-fade-in"
        >
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: 'bold',
            color: '#282B34',
            marginBottom: '0.5rem'
          }}>My History</h3>
          <p style={{
            color: '#282B34',
            lineHeight: '1.5',
            fontSize: '0.875rem',
            margin: 0
          }}>
            View performance of each day type and modality to see your gains over time
          </p>
        </div>

        {/* Compare Day Types */}
        <div 
          onClick={() => setCurrentView('compareDayTypes')}
          style={{
            background: '#DAE2EA',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            padding: '1.25rem',
            cursor: 'pointer',
            border: '1px solid #FE5858',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.transform = 'translateY(-4px)';
            (e.target as HTMLElement).style.boxShadow = '0 8px 30px -5px rgba(0, 0, 0, 0.15), 0 15px 15px -5px rgba(0, 0, 0, 0.08)';
            (e.target as HTMLElement).style.borderColor = 'rgba(34, 197, 94, 0.3)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.transform = 'translateY(0)';
            (e.target as HTMLElement).style.boxShadow = '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
            (e.target as HTMLElement).style.borderColor = '#FE5858';
          }}
          className="animate-fade-in"
        >
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: 'bold',
            color: '#282B34',
            marginBottom: '0.5rem'
          }}>Comparisons</h3>
          <p style={{
            color: '#282B34',
            lineHeight: '1.5',
            fontSize: '0.875rem',
            margin: 0
          }}>
            Side by side comparisons for detailed understanding of my Engine
          </p>
        </div>

        {/* Show Time Trials */}
        <div 
          onClick={() => setCurrentView('showTimeTrials')}
          style={{
            background: '#DAE2EA',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            padding: '1.25rem',
            cursor: 'pointer',
            border: '1px solid #FE5858',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.transform = 'translateY(-4px)';
            (e.target as HTMLElement).style.boxShadow = '0 8px 30px -5px rgba(0, 0, 0, 0.15), 0 15px 15px -5px rgba(0, 0, 0, 0.08)';
            (e.target as HTMLElement).style.borderColor = 'rgba(168, 85, 247, 0.3)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.transform = 'translateY(0)';
            (e.target as HTMLElement).style.boxShadow = '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
            (e.target as HTMLElement).style.borderColor = '#FE5858';
          }}
          className="animate-fade-in"
        >
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: 'bold',
            color: '#282B34',
            marginBottom: '0.5rem'
          }}>My Time Trials</h3>
          <p style={{
            color: '#282B34',
            lineHeight: '1.5',
            fontSize: '0.875rem',
            margin: 0
          }}>
            Detailed review of critical data points
          </p>
        </div>

        {/* Target vs Actual Analysis */}
        <div 
          onClick={() => setCurrentView('targetVsActual')}
          style={{
            background: '#DAE2EA',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            padding: '1.25rem',
            cursor: 'pointer',
            border: '1px solid #FE5858',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.transform = 'translateY(-4px)';
            (e.target as HTMLElement).style.boxShadow = '0 8px 30px -5px rgba(0, 0, 0, 0.15), 0 15px 15px -5px rgba(0, 0, 0, 0.08)';
            (e.target as HTMLElement).style.borderColor = 'rgba(239, 68, 68, 0.3)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.transform = 'translateY(0)';
            (e.target as HTMLElement).style.boxShadow = '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
            (e.target as HTMLElement).style.borderColor = '#FE5858';
          }}
          className="animate-fade-in"
        >
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: 'bold',
            color: '#282B34',
            marginBottom: '0.5rem'
          }}>Targets vs Actual</h3>
          <p style={{
            color: '#282B34',
            lineHeight: '1.5',
            fontSize: '0.875rem',
            margin: 0
          }}>
            Compare performance against dynamic targets
          </p>
        </div>

        {/* Personal Records */}
        <div 
          onClick={() => setCurrentView('personalRecords')}
          style={{
            background: '#DAE2EA',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            padding: '1.25rem',
            cursor: 'pointer',
            border: '1px solid #FE5858',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.transform = 'translateY(-4px)';
            (e.target as HTMLElement).style.boxShadow = '0 8px 30px -5px rgba(0, 0, 0, 0.15), 0 15px 15px -5px rgba(0, 0, 0, 0.08)';
            (e.target as HTMLElement).style.borderColor = 'rgba(245, 158, 11, 0.3)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.transform = 'translateY(0)';
            (e.target as HTMLElement).style.boxShadow = '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
            (e.target as HTMLElement).style.borderColor = '#FE5858';
          }}
          className="animate-fade-in"
        >
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: 'bold',
            color: '#282B34',
            marginBottom: '0.5rem'
          }}>My Personal Records</h3>
          <p style={{
            color: '#282B34',
            lineHeight: '1.5',
            fontSize: '0.875rem',
            margin: 0
          }}>
            View my best top score in each day type
          </p>
        </div>

        {/* Heart Rate Analytics */}
        <div 
          onClick={() => setCurrentView('heartRateAnalytics')}
          style={{
            background: '#DAE2EA',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            padding: '1.25rem',
            cursor: 'pointer',
            border: '1px solid #FE5858',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.transform = 'translateY(-4px)';
            (e.target as HTMLElement).style.boxShadow = '0 8px 30px -5px rgba(0, 0, 0, 0.15), 0 15px 15px -5px rgba(0, 0, 0, 0.08)';
            (e.target as HTMLElement).style.borderColor = 'rgba(239, 68, 68, 0.3)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.transform = 'translateY(0)';
            (e.target as HTMLElement).style.boxShadow = '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
            (e.target as HTMLElement).style.borderColor = '#FE5858';
          }}
          className="animate-fade-in"
        >
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: 'bold',
            color: '#282B34',
            marginBottom: '0.5rem'
          }}>My HR Analytics</h3>
          <p style={{
            color: '#282B34',
            lineHeight: '1.5',
            fontSize: '0.875rem',
            margin: 0
          }}>
            Analyze efficiency, training load and recovery from different stimuli
          </p>
        </div>

        {/* Work:Rest Ratio Performance */}
        <div 
          onClick={() => setCurrentView('workRestRatio')}
          style={{
            background: '#DAE2EA',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            padding: '1.25rem',
            cursor: 'pointer',
            border: '1px solid #FE5858',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.transform = 'translateY(-4px)';
            (e.target as HTMLElement).style.boxShadow = '0 8px 30px -5px rgba(0, 0, 0, 0.15), 0 15px 15px -5px rgba(0, 0, 0, 0.08)';
            (e.target as HTMLElement).style.borderColor = 'rgba(139, 92, 246, 0.3)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.transform = 'translateY(0)';
            (e.target as HTMLElement).style.boxShadow = '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
            (e.target as HTMLElement).style.borderColor = '#FE5858';
          }}
        >
            <h3 style={{
            fontSize: '1.125rem',
              fontWeight: 'bold',
            color: '#282B34',
            marginBottom: '0.5rem'
            }}>My Work : Rest Ratio Data</h3>
          <p style={{
            color: '#282B34',
            lineHeight: '1.5',
            fontSize: '0.875rem',
            margin: 0
          }}>
            See how my pace and rest are related
          </p>
            </div>

        {/* Variability Trend */}
        <div 
          onClick={() => setCurrentView('variabilityTrend')}
          style={{
            background: '#DAE2EA',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            padding: '1.25rem',
            cursor: 'pointer',
            border: '1px solid #FE5858',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.transform = 'translateY(-4px)';
            (e.target as HTMLElement).style.boxShadow = '0 8px 30px -5px rgba(0, 0, 0, 0.15), 0 15px 15px -5px rgba(0, 0, 0, 0.08)';
            (e.target as HTMLElement).style.borderColor = 'rgba(34, 197, 94, 0.3)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.transform = 'translateY(0)';
            (e.target as HTMLElement).style.boxShadow = '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
            (e.target as HTMLElement).style.borderColor = '#FE5858';
          }}
        >
            <h3 style={{
            fontSize: '1.125rem',
              fontWeight: 'bold',
            color: '#282B34',
            marginBottom: '0.5rem'
          }}>Variability Trend</h3>
          <p style={{
            color: '#282B34',
            lineHeight: '1.5',
            fontSize: '0.875rem',
            margin: 0
          }}>
            Track consistency improvement over time
          </p>
        </div>

        {/* Ratio Comparison */}
        <div 
          onClick={() => {
            setShowRatioComparison(true);
            setCurrentView('ratioComparison');
          }}
          style={{
            background: '#DAE2EA',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            padding: '1.25rem',
            cursor: 'pointer',
            border: '1px solid #FE5858',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.transform = 'translateY(-4px)';
            (e.target as HTMLElement).style.boxShadow = '0 8px 30px -5px rgba(0, 0, 0, 0.15), 0 15px 15px -5px rgba(0, 0, 0, 0.08)';
            (e.target as HTMLElement).style.borderColor = 'rgba(168, 85, 247, 0.3)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.transform = 'translateY(0)';
            (e.target as HTMLElement).style.boxShadow = '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
            (e.target as HTMLElement).style.borderColor = '#FE5858';
          }}
        >
            <h3 style={{
            fontSize: '1.125rem',
              fontWeight: 'bold',
            color: '#282B34',
            marginBottom: '0.5rem'
            }}>My Capacity Ratios</h3>
          <p style={{
            color: '#282B34',
            lineHeight: '1.5',
            fontSize: '0.875rem',
            margin: 0
          }}>
            Measures the changing relationship between stimuli as your conditioning improves
          </p>
        </div>

      </div>
    </div>
  );
  };

  const renderReviewHistory = (): React.ReactElement => {
    const availableDayTypes = getAvailableDayTypes();
    const availableModalities = getAvailableModalities(selectedDayType);
    const programMonths = getProgramMonths();
    
    const filteredSessions = getFilteredSessions(selectedDayType, selectedModality, startMonth, endMonth);
    
    return (
      <div style={{ marginBottom: '1.5rem' }}>
        {/* Filters */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
          marginBottom: '1.5rem'
          }}>
            {/* Day Type */}
            <div style={{ 
              gridColumn: '1 / -1',
              border: '1px solid #282B34',
              borderRadius: '0.75rem',
              background: '#FFFFFF',
              padding: '1.25rem',
              marginBottom: '1rem'
            }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#282B34',
                marginBottom: '0.5rem',
                textAlign: 'center'
              }}>Select Day Type</label>
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '1rem',
                flexWrap: 'wrap'
              }}>
                {availableDayTypes.length > 0 ? (
                  availableDayTypes.map((dayType: string) => {
                    const isSelected = selectedDayType === dayType;
                    return (
                      <button
                        key={dayType}
                        onClick={() => {
                          setSelectedDayType(dayType);
                  setSelectedModality(''); // Reset modality when day type changes
                }}
                style={{
                          padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                          border: '2px solid',
                          borderColor: isSelected ? '#FE5858' : '#e5e7eb',
                          background: '#DAE2EA',
                          color: '#282B34',
                          fontWeight: '600',
                fontSize: '0.875rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          whiteSpace: 'nowrap'
                        }}
                        onMouseEnter={(e) => {
                          (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                          (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                          (e.target as HTMLElement).style.borderColor = '#FE5858';
                        }}
                        onMouseLeave={(e) => {
                          (e.target as HTMLElement).style.transform = 'translateY(0)';
                          (e.target as HTMLElement).style.boxShadow = 'none';
                          (e.target as HTMLElement).style.borderColor = isSelected ? '#FE5858' : '#e5e7eb';
                        }}
                      >
                        <span>{getWorkoutTypeDisplayName(dayType)}</span>
                      </button>
                    );
                  })
                ) : (
                  <div style={{ color: '#282B34', fontSize: '0.875rem' }}>No completed workouts found</div>
                )}
              </div>
            </div>

            {/* Modality */}
            <div style={{ 
              gridColumn: '1 / -1',
              border: '1px solid #282B34',
              borderRadius: '0.75rem',
              background: '#FFFFFF',
              padding: '1.25rem',
              marginBottom: '1rem'
            }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#282B34',
                marginBottom: '0.5rem',
                textAlign: 'center'
              }}>Select Modality</label>
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '1rem',
                flexWrap: 'wrap'
              }}>
                {availableModalities.length > 0 ? (
                  availableModalities.map((modality: string) => {
                    const isSelected = selectedModality === modality;
                    return (
          <button
                        key={modality}
                        onClick={() => setSelectedModality(modality)}
            style={{
                          padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
                          border: '2px solid',
                          borderColor: isSelected ? '#FE5858' : '#e5e7eb',
                          background: '#DAE2EA',
                          color: '#282B34',
              fontWeight: '600',
                          fontSize: '0.875rem',
              cursor: 'pointer',
                          transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
                          justifyContent: 'center',
                          whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                          (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                          (e.target as HTMLElement).style.borderColor = '#FE5858';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.transform = 'translateY(0)';
              (e.target as HTMLElement).style.boxShadow = 'none';
                          (e.target as HTMLElement).style.borderColor = isSelected ? '#FE5858' : '#e5e7eb';
            }}
          >
                        <span>{getModalityDisplayName(modality)}</span>
          </button>
                    );
                  })
                ) : (
                  <div style={{ color: '#282B34', fontSize: '0.875rem' }}>No modalities found</div>
                )}
              </div>
                  </div>
        </div>

        {/* Performance Chart - Only show when both day type and modality are selected */}
        {selectedDayType && selectedModality && (
          <>
          <h3 
            onClick={() => {
              setPreviousViewForHrDetails('reviewHistory');
              setSelectedHrDayTypeForCards(selectedDayType);
              setCurrentView('hrDayTypeDetails');
            }}
            style={{
              fontSize: '1rem',
              fontWeight: '600',
              color: '#282B34',
              marginBottom: '1rem',
              marginTop: '1.5rem',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#FE5858';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#282B34';
            }}
          >
            Performance Chart {filteredSessions && filteredSessions.length > 0 && (
              <span style={{
                background: '#FE5858',
                color: '#F8FBFE',
                padding: '0.25rem 0.5rem',
                borderRadius: '9999px',
                fontSize: '0.875rem',
                fontWeight: '600'
              }}>
                {filteredSessions.length}
              </span>
            )}
          </h3>
          
            {filteredSessions.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              color: '#282B34'
            }}>
              <div style={{
                fontSize: '2rem',
                marginBottom: '1rem',
                opacity: 0.5
              }}>📈</div>
              <h4 style={{
                fontSize: '1.125rem',
                fontWeight: '600',
                color: '#282B34',
                marginBottom: '0.5rem'
              }}>
                No Data Found
              </h4>
              <p style={{
                color: '#282B34',
                lineHeight: '1.6'
              }}>
                No workouts found for {selectedDayType} on {selectedModality}. 
                Try adjusting your filters or complete some workouts with this combination.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Simple Bar Chart */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {filteredSessions.map((session, index) => {
                  const pace = calculatePace(session);
                  // Use program_day_number if available, fallback to program_day for backward compatibility
                  const dayNumber = session.program_day_number || session.program_day;
                  const daysPerMonth = getDaysPerMonth(programVersion);
                  const month = dayNumber ? Math.ceil(dayNumber / daysPerMonth) : 'Unknown';
                  
                  if (pace === null) return null;
                  
                  return (
                    <div key={index} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '0.75rem',
                      background: '#FFFFFF',
                      borderRadius: '0.5rem',
                      border: '1px solid rgba(255, 255, 255, 0.3)'
                    }}>
                      <div style={{
                        width: '5rem',
                        fontSize: '0.875rem',
                        color: '#282B34',
                        fontWeight: '500'
                      }}>
                        Day {dayNumber}
                      </div>
                      <div style={{
                        flex: 1,
                        background: '#e5e7eb',
                        borderRadius: '9999px',
                        height: '1.5rem',
                        position: 'relative',
                        overflow: 'hidden'
                      }}>
                        <div 
                          style={{
                            background: '#FE5858',
                            height: '100%',
                            borderRadius: '9999px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            paddingRight: '0.5rem',
                            transition: 'width 0.5s ease',
                            width: `${Math.min(((pace || 0) / 100) * 100, 100)}%`
                          }}
                        >
                          <span style={{
                            color: 'white',
                            fontSize: '0.75rem',
                            fontWeight: '500'
                          }}>
                            {pace.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div style={{
                        width: '4rem',
                        fontSize: '0.875rem',
                        color: '#282B34',
                        textAlign: 'right',
                        fontWeight: '500'
                      }}>
                        Month {month}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </>
          )}
      </div>
    );
  };

  const renderCompareDayTypes = (): React.ReactElement => {
    const availableDayTypes = getAvailableDayTypes();
    const availableModalities = getAvailableModalities();
    const programMonths = getProgramMonths();
    
    // If this is being called from the Ratio Comparison menu, show only ratio inputs
    const isRatioComparisonView = showRatioComparison;
    
    return (
          <div style={{
        background: isRatioComparisonView ? '#F8FBFE' : 'transparent',
        margin: isRatioComparisonView ? '-1.5rem' : '0',
        marginBottom: isRatioComparisonView ? '0' : '1.5rem',
        padding: isRatioComparisonView ? '1.5rem' : '0'
          }}>
        {/* Filters - only show for regular Compare Day Types view */}
        {!isRatioComparisonView && (
          <>
            {/* Day Types Selection */}
          <div style={{
              border: '1px solid #282B34',
              borderRadius: '0.75rem',
              background: '#FFFFFF',
              padding: '1.25rem',
            marginBottom: '1.5rem'
          }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#282B34',
                marginBottom: '0.5rem',
                textAlign: 'center'
              }}>Select Day Types (up to 3)</label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '0.5rem'
              }}>
                {availableDayTypes.map((dayType: string) => {
                  const isSelected = selectedDayTypes.includes(dayType);
                  const isDisabled = !isSelected && selectedDayTypes.length >= 3;
                  
                  return (
                    <button
                      key={dayType}
                      onClick={() => {
                        if (isSelected) {
                          // Unselect if already selected
                          setSelectedDayTypes(selectedDayTypes.filter((dt: string) => dt !== dayType));
                        } else if (!isDisabled) {
                          // Select if under limit
                          setSelectedDayTypes([...selectedDayTypes, dayType]);
                        }
                      }}
                      disabled={isDisabled}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        border: '2px solid',
                        borderColor: isSelected ? '#FE5858' : '#e5e7eb',
                        background: '#DAE2EA',
                        color: '#282B34',
                        fontWeight: '600',
                        fontSize: '0.875rem',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDisabled ? 0.5 : 1,
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        flex: '1 1 0',
                        minWidth: '0'
                      }}
                      onMouseEnter={(e) => {
                        if (!isDisabled) {
                          (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                          (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                          (e.target as HTMLElement).style.borderColor = '#FE5858';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isDisabled) {
                          (e.target as HTMLElement).style.transform = 'translateY(0)';
                          (e.target as HTMLElement).style.boxShadow = 'none';
                          (e.target as HTMLElement).style.borderColor = isSelected ? '#FE5858' : '#e5e7eb';
                        }
                      }}
                    >
                      <span>{getWorkoutTypeDisplayName(dayType)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Modality Selection - Separate section */}
        {!isRatioComparisonView && (
            <div style={{
            background: '#FFFFFF',
            borderRadius: '0.75rem',
            border: '1px solid #282B34',
            padding: '1.25rem',
            marginBottom: '1.5rem'
          }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
              color: '#282B34',
              marginBottom: '0.75rem',
              textAlign: 'center'
                }}>Select Modality</label>
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              gap: '0.5rem',
              flexWrap: 'wrap'
            }}>
              {availableModalities.map((modality: string) => {
                const isSelected = compareModality === modality;
                return (
                  <button
                    key={modality}
                    onClick={() => setCompareModality(modality)}
                  style={{
                      padding: '0.75rem',
                    borderRadius: '0.5rem',
                      border: '2px solid',
                      borderColor: isSelected ? '#FE5858' : '#e5e7eb',
                      background: '#DAE2EA',
                      color: '#282B34',
                      fontWeight: '600',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      flex: '1 1 0',
                      minWidth: '0'
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                      (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                      (e.target as HTMLElement).style.borderColor = '#FE5858';
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.transform = 'translateY(0)';
                      (e.target as HTMLElement).style.boxShadow = 'none';
                      (e.target as HTMLElement).style.borderColor = isSelected ? '#FE5858' : '#e5e7eb';
                    }}
                  >
                    <span>{getModalityDisplayName(modality)}</span>
                  </button>
                );
              })}
              </div>
          </div>
        )}

        {/* Month Range Selection */}
        {!isRatioComparisonView && (
          <div style={{
            background: '#FFFFFF',
            borderRadius: '0.75rem',
            border: '1px solid #282B34',
            padding: '1.25rem',
            marginBottom: '1.5rem'
          }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
              color: '#282B34',
              marginBottom: '0.5rem',
              textAlign: 'center'
            }}>Select Month Range</label>
            
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              gap: '2rem',
              padding: '1rem 0'
            }}>
              {/* Start Month Input */}
                    <div style={{
                      display: 'flex',
                flexDirection: 'column',
                      alignItems: 'center',
                gap: '0.5rem'
                    }}>
                <label style={{
                  fontSize: '0.875rem',
                  color: '#282B34',
                  fontWeight: '600'
                }}>
                        Start Month
                </label>
                    <input
                  type="number"
                  min="1"
                  max={programMonths.length > 0 ? Math.max(...programMonths) : 1}
                  value={compareStartMonth || ''}
                      onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || value === '0') {
                          setCompareStartMonth('');
                        } else {
                      const monthNum = parseInt(value);
                      const maxMonth = programMonths.length > 0 ? Math.max(...programMonths) : 1;
                      if (monthNum >= 1 && monthNum <= maxMonth) {
                        setCompareStartMonth(monthNum.toString());
                      }
                        }
                      }}
                  placeholder="All Time"
                  style={{
                    width: '80px',
                    padding: '0.5rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #282B34',
                    fontSize: '0.875rem',
                    color: '#282B34',
                    background: '#FFFFFF',
                    textAlign: 'center'
                  }}
                />
              </div>

              {/* End Month Input */}
                    <div style={{
                      display: 'flex',
                flexDirection: 'column',
                      alignItems: 'center',
                gap: '0.5rem'
                    }}>
                <label style={{
                  fontSize: '0.875rem',
                  color: '#282B34',
                  fontWeight: '600'
                }}>
                        End Month
                </label>
                    <input
                  type="number"
                  min="1"
                  max={programMonths.length > 0 ? Math.max(...programMonths) : 1}
                  value={compareEndMonth || ''}
                      onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || value === '0') {
                          setCompareEndMonth('');
                        } else {
                      const monthNum = parseInt(value);
                      const maxMonth = programMonths.length > 0 ? Math.max(...programMonths) : 1;
                      if (monthNum >= 1 && monthNum <= maxMonth) {
                        setCompareEndMonth(monthNum.toString());
                      }
                        }
                      }}
                  placeholder="All Time"
                  style={{
                    width: '80px',
                    padding: '0.5rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #282B34',
                    fontSize: '0.875rem',
                    color: '#282B34',
                    background: '#FFFFFF',
                    textAlign: 'center'
                  }}
                />
            </div>
          </div>
          </div>
        )}

        {/* Ratio Comparison Filters - Styled like Review History */}
        {isRatioComparisonView && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
              {/* Modality */}
              <div style={{ 
                gridColumn: '1 / -1',
                border: '1px solid #282B34',
                borderRadius: '0.75rem',
                background: '#FFFFFF',
                padding: '1.25rem',
                marginBottom: '1rem'
              }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#282B34',
                  marginBottom: '0.5rem',
                  textAlign: 'center'
                }}>Modality</label>
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                  gap: '1rem',
                flexWrap: 'wrap'
              }}>
                  <button
                    onClick={() => setCompareModality('')}
                style={{
                      padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                      border: '2px solid',
                      borderColor: compareModality === '' ? '#FE5858' : '#e5e7eb',
                      background: '#DAE2EA',
                      color: '#282B34',
                      fontWeight: '600',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                      (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                      (e.target as HTMLElement).style.borderColor = '#FE5858';
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.transform = 'translateY(0)';
                      (e.target as HTMLElement).style.boxShadow = 'none';
                      (e.target as HTMLElement).style.borderColor = compareModality === '' ? '#FE5858' : '#e5e7eb';
                    }}
                  >
                    <span>All Modalities</span>
                  </button>
                {availableModalities.map((modality: string) => {
                  const isSelected = compareModality === modality;
                  return (
                    <button
                      key={modality}
                      onClick={() => setCompareModality(modality)}
                style={{
                          padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                        border: '2px solid',
                        borderColor: isSelected ? '#FE5858' : '#e5e7eb',
                        background: '#DAE2EA',
                        color: '#282B34',
                        fontWeight: '600',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                          whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                        (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                        (e.target as HTMLElement).style.borderColor = '#FE5858';
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.transform = 'translateY(0)';
                        (e.target as HTMLElement).style.boxShadow = 'none';
                        (e.target as HTMLElement).style.borderColor = isSelected ? '#FE5858' : '#e5e7eb';
                      }}
                    >
                        <span>{getModalityDisplayName(modality)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            
              {/* Day Type A */}
              <div style={{ 
                gridColumn: '1 / -1',
                border: '1px solid #282B34',
                borderRadius: '0.75rem',
                background: '#FFFFFF',
                padding: '1.25rem',
                marginBottom: '1rem'
              }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#282B34',
                    marginBottom: '0.5rem',
                    textAlign: 'center'
                  }}>Day Type A (Numerator)</label>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: '1rem',
                    flexWrap: 'wrap'
                  }}>
                    {availableDayTypes.map((dayType: string) => {
                      const isSelected = dayTypeA === dayType;
                      return (
                        <button
                          key={dayType}
                          onClick={() => setDayTypeA(dayType)}
                    style={{
                            padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                            border: '2px solid',
                            borderColor: isSelected ? '#FE5858' : '#e5e7eb',
                            background: '#DAE2EA',
                            color: '#282B34',
                            fontWeight: '600',
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            whiteSpace: 'nowrap'
                          }}
                          onMouseEnter={(e) => {
                            (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                            (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                            (e.target as HTMLElement).style.borderColor = '#FE5858';
                          }}
                          onMouseLeave={(e) => {
                            (e.target as HTMLElement).style.transform = 'translateY(0)';
                            (e.target as HTMLElement).style.boxShadow = 'none';
                            (e.target as HTMLElement).style.borderColor = isSelected ? '#FE5858' : '#e5e7eb';
                          }}
                        >
                        <span>{getWorkoutTypeDisplayName(dayType)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                
              {/* Day Type B */}
              <div style={{ 
                gridColumn: '1 / -1',
                border: '1px solid #282B34',
                borderRadius: '0.75rem',
                background: '#FFFFFF',
                padding: '1.25rem',
                marginBottom: '1rem'
              }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#282B34',
                    marginBottom: '0.5rem',
                    textAlign: 'center'
                  }}>Day Type B (Denominator)</label>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: '1rem',
                    flexWrap: 'wrap'
                  }}>
                    {availableDayTypes.map((dayType: string) => {
                    const isSelected = dayTypeB.includes(dayType);
                      return (
                        <button
                          key={dayType}
                        onClick={() => {
                          if (isSelected) {
                            setDayTypeB(dayTypeB.filter((dt: string) => dt !== dayType)); // Remove if selected
                          } else {
                            setDayTypeB([...dayTypeB, dayType]); // Add if not selected
                          }
                        }}
                    style={{
                            padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                            border: '2px solid',
                            borderColor: isSelected ? '#FE5858' : '#e5e7eb',
                            background: '#DAE2EA',
                            color: '#282B34',
                            fontWeight: '600',
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            whiteSpace: 'nowrap'
                          }}
                          onMouseEnter={(e) => {
                            (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                            (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                            (e.target as HTMLElement).style.borderColor = '#FE5858';
                          }}
                          onMouseLeave={(e) => {
                            (e.target as HTMLElement).style.transform = 'translateY(0)';
                            (e.target as HTMLElement).style.boxShadow = 'none';
                            (e.target as HTMLElement).style.borderColor = isSelected ? '#FE5858' : '#e5e7eb';
                          }}
                        >
                        <span>{getWorkoutTypeDisplayName(dayType)}</span>
                        </button>
                      );
                    })}
                </div>
                </div>
              
              {/* Generate Button for dedicated view */}
              {dayTypeA && dayTypeB.length > 0 && compareModality && (
                <div style={{ 
                  gridColumn: '1 / -1',
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  width: '100%', 
                  marginTop: '1.5rem', 
                  marginBottom: '1.5rem' 
                }}>
                  <button
                    onClick={() => setShowRatioCharts(true)}
                    style={{
                      background: '#FE5858',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      padding: '0.75rem 2rem',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.background = '#dc2626';
                      (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                      (e.target as HTMLElement).style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.background = '#FE5858';
                      (e.target as HTMLElement).style.transform = 'translateY(0)';
                      (e.target as HTMLElement).style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                    }}
                  >
                    Generate
                  </button>
              </div>
            )}
          </div>
        )}
        
        {/* Ratio Comparison Toggle (for regular Compare Day Types view) */}
        {!isRatioComparisonView && selectedDayTypes.length > 0 && compareModality && showRatioComparison && (
          <div style={{
            background: '#DAE2EA',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            padding: '1rem',
            border: '1px solid #FE5858',
            marginBottom: '1.5rem'
          }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Day Type A Selection */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#282B34',
                    marginBottom: '0.5rem',
                    textAlign: 'center'
                  }}>Day Type A (Numerator)</label>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: '1rem',
                    flexWrap: 'wrap'
                  }}>
                    {availableDayTypes.map((dayType: string) => {
                      const isSelected = dayTypeA === dayType;
                      return (
                        <button
                          key={dayType}
                          onClick={() => setDayTypeA(dayType)}
                    style={{
                            padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                            border: '2px solid',
                            borderColor: isSelected ? '#FE5858' : '#e5e7eb',
                            background: '#DAE2EA',
                            color: '#282B34',
                            fontWeight: '600',
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            whiteSpace: 'nowrap'
                          }}
                          onMouseEnter={(e) => {
                            (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                            (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                            (e.target as HTMLElement).style.borderColor = '#FE5858';
                          }}
                          onMouseLeave={(e) => {
                            (e.target as HTMLElement).style.transform = 'translateY(0)';
                            (e.target as HTMLElement).style.boxShadow = 'none';
                            (e.target as HTMLElement).style.borderColor = isSelected ? '#FE5858' : '#e5e7eb';
                          }}
                        >
                          <span>{getWorkoutTypeDisplayName(dayType)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Day Type B Selection */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#282B34',
                    marginBottom: '0.5rem',
                    textAlign: 'center'
                  }}>Day Type B (Denominator)</label>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: '1rem',
                    flexWrap: 'wrap'
                  }}>
                    {availableDayTypes.map((dayType: string) => {
                      const isSelected = Array.isArray(dayTypeB) ? dayTypeB.includes(dayType) : dayTypeB === dayType;
                      return (
                        <button
                          key={dayType}
                          onClick={() => {
                            if (Array.isArray(dayTypeB)) {
                              if (dayTypeB.includes(dayType)) {
                                setDayTypeB(dayTypeB.filter((d: string) => d !== dayType));
                              } else {
                                setDayTypeB([...dayTypeB, dayType]);
                              }
                            } else {
                              setDayTypeB([dayType]);
                            }
                          }}
                    style={{
                            padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                            border: '2px solid',
                            borderColor: isSelected ? '#FE5858' : '#e5e7eb',
                            background: '#DAE2EA',
                            color: '#282B34',
                            fontWeight: '600',
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            whiteSpace: 'nowrap'
                          }}
                          onMouseEnter={(e) => {
                            (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                            (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                            (e.target as HTMLElement).style.borderColor = '#FE5858';
                          }}
                          onMouseLeave={(e) => {
                            (e.target as HTMLElement).style.transform = 'translateY(0)';
                            (e.target as HTMLElement).style.boxShadow = 'none';
                            (e.target as HTMLElement).style.borderColor = isSelected ? '#FE5858' : '#e5e7eb';
                          }}
                        >
                          <span>{getWorkoutTypeDisplayName(dayType)}</span>
                        </button>
                      );
                    })}
                </div>
              </div>
              
              {/* Generate Button */}
              {dayTypeA && dayTypeB.length > 0 && compareModality && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                  <button
                    onClick={() => setShowRatioCharts(true)}
                    style={{
                      background: '#FE5858',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      padding: '0.75rem 2rem',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.background = '#dc2626';
                      (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                      (e.target as HTMLElement).style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.background = '#FE5858';
                      (e.target as HTMLElement).style.transform = 'translateY(0)';
                      (e.target as HTMLElement).style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                    }}
                  >
                    Generate
                  </button>
              </div>
            )}
              </div>
          </div>
        )}

        {/* Charts */}
        {!isRatioComparisonView && selectedDayTypes.length > 0 && compareModality ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Ratio Comparison Chart - Render separate graph for each denominator */}
            {showRatioComparison && showRatioCharts && dayTypeA && dayTypeB.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {dayTypeB.map((denominator: string) => {
                  const ratioData = getMonthlyRatioData(dayTypeA, [denominator], compareModality, compareStartMonth, compareEndMonth);
                  const months = Object.keys(ratioData).map(m => parseInt(m, 10)).sort((a: number, b: number) => a - b);
                  
                  // Don't render if no data available
                  if (months.length === 0) {
                    return null;
                  }
                  
                  return (
                    <div key={denominator} style={{
                background: '#DAE2EA',
                backdropFilter: 'blur(10px)',
                borderRadius: '1rem',
                boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                padding: '1.5rem',
                border: '1px solid #FE5858'
              }}>
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#111827',
                        marginBottom: '1rem'
                }}>
                        {getWorkoutTypeDisplayName(dayTypeA)} / {getWorkoutTypeDisplayName(denominator)} Ratio - {showMonthlyAverage ? 'Monthly Average' : 'Monthly High'}
                </h3>
                
                    <div style={{ marginBottom: '1rem' }}>
                      {months.map((month: number) => {
                        const data = ratioData[month];
                        const ratio = showMonthlyAverage ? data.averageRatio : data.highRatio;
                            const barColor = '#FE5858';
                        const barWidth = Math.min(Math.max(ratio * 50, 10), 100); // Scale ratio to bar width
                        
                        return (
                          <div key={month} style={{
                            marginBottom: '1rem',
                            padding: '1rem',
                            background: 'rgba(255, 255, 255, 0.5)',
                            borderRadius: '0.75rem',
                            border: '1px solid rgba(255, 255, 255, 0.3)'
                          }}>
                            <div style={{
                              marginBottom: '0.75rem'
                            }}>
                              <div style={{
                                fontWeight: 'bold',
                                color: '#111827',
                                fontSize: '1rem'
                              }}>
                                Month {month}
                              </div>
                            </div>
                            
                            {/* Ratio Bar */}
                            <div style={{
                              width: '100%',
                              height: '1rem',
                              background: 'rgba(229, 231, 235, 0.5)',
                              borderRadius: '0.5rem',
                              overflow: 'hidden',
                              position: 'relative',
                              marginBottom: '0.75rem'
                            }}>
                              <div style={{
                                width: `${barWidth}%`,
                                height: '100%',
                                background: `linear-gradient(90deg, ${barColor} 0%, ${barColor}dd 100%)`,
                                borderRadius: '0.5rem',
                                transition: 'width 0.3s ease',
                                position: 'relative'
                              }}>
                                <div style={{
                                  position: 'absolute',
                                  right: '0.5rem',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  fontSize: '0.75rem',
                                  fontWeight: 'bold',
                                  color: 'white',
                                  textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                                }}>
                                  {ratio.toFixed(2)}
                                </div>
                              </div>
                            </div>
                            
                            {/* Additional Stats */}
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                              gap: '0.5rem',
                              fontSize: '0.875rem',
                              color: '#6b7280'
                            }}>
                              <div>
                                    <strong>{getWorkoutTypeDisplayName(dayTypeA)}:</strong> {showMonthlyAverage ? data.avgA.toFixed(1) : data.highA.toFixed(1)} cal/min
                                <br />
                                <small>({data.countA} sessions)</small>
                              </div>
                              <div>
                                    <strong>{getWorkoutTypeDisplayName(denominator)}:</strong> {showMonthlyAverage ? data.avgB.toFixed(1) : data.highB.toFixed(1)} cal/min
                                <br />
                                <small>({data.countB} sessions)</small>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Average Pace Chart */}
            <>
              <h3 style={{
                fontSize: '1rem',
                fontWeight: '600',
                color: '#282B34',
                marginBottom: '1rem',
                marginTop: '1.5rem',
                textAlign: 'center'
              }}>
                Average Pace
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {selectedDayTypes.map((dayType: string) => {
                  const sessions = getFilteredSessions(dayType, compareModality, compareStartMonth, compareEndMonth);
                  const averagePace = sessions.length > 0 
                    ? sessions.reduce((sum: number, session: WorkoutSession) => {
                        const pace = calculatePace(session);
                        return sum + (pace !== null ? pace : 0);
                      }, 0) / sessions.length
                    : 0;
                  
                  return (
                    <div key={dayType} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '0.75rem',
                      background: 'rgba(255, 255, 255, 0.5)',
                      borderRadius: '0.5rem',
                      border: '1px solid rgba(255, 255, 255, 0.3)'
                    }}>
                      <div style={{
                        width: '8rem',
                        fontSize: '0.875rem',
                        color: '#282B34',
                        fontWeight: '600'
                      }}>
                        <span style={{ color: '#FE5858' }}>({sessions.length})</span> {getWorkoutTypeDisplayName(dayType)}
                      </div>
                      <div style={{
                        flex: 1,
                        background: '#e5e7eb',
                        borderRadius: '9999px',
                        height: '1.5rem',
                        position: 'relative',
                        overflow: 'hidden'
                      }}>
                        <div 
                          style={{
                            background: '#FE5858',
                            height: '100%',
                            borderRadius: '9999px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            paddingRight: '0.5rem',
                            transition: 'width 0.5s ease',
                            width: `${Math.min((averagePace / 100) * 100, 100)}%`
                          }}
                        >
                          <span style={{
                            color: 'white',
                            fontSize: '0.75rem',
                            fontWeight: '500'
                          }}>
                            {averagePace.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          </div>
        ) : (
          isRatioComparisonView ? null : (
            <div style={{
              background: '#DAE2EA',
              backdropFilter: 'blur(10px)',
              borderRadius: '1rem',
              boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              padding: '2rem',
              border: '1px solid #FE5858',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '3rem',
                marginBottom: '1rem',
                opacity: 0.5
              }}>📊</div>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#111827',
                marginBottom: '0.5rem'
              }}>
                Select Day Types and Modality
              </h3>
              <p style={{
                color: '#6b7280',
                lineHeight: '1.6'
              }}>
                Please select at least one day type and a modality to view comparison charts. 
                Cross-modality comparisons are not available due to different calculation algorithms.
              </p>
            </div>
          )
        )}
        
        {/* Ratio Comparison Chart for dedicated view - Render separate graph for each denominator */}
        {isRatioComparisonView && showRatioCharts && dayTypeA && dayTypeB.length > 0 && compareModality && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {dayTypeB.map((denominator: string) => {
              const ratioData = getMonthlyRatioData(dayTypeA, [denominator], compareModality, '', '');
              const months = Object.keys(ratioData).map(m => parseInt(m, 10)).sort((a: number, b: number) => a - b);
              
              // Don't render if no data available
              if (months.length === 0) {
                return null;
              }
              
              return (
                <div key={denominator}>
              <h3 style={{
                fontSize: '1rem',
                fontWeight: '600',
                color: '#111827',
                marginBottom: '1rem',
                    marginTop: '1.5rem'
              }}>
                    {getWorkoutTypeDisplayName(dayTypeA)} / {getWorkoutTypeDisplayName(denominator)} Ratio
              </h3>
              
                  <div style={{ marginBottom: '1rem' }}>
                      {months.map((month: number) => {
                        const data = ratioData[month];
                      const ratio = data.averageRatio;
                        const barColor = '#FE5858';
                      const barWidth = Math.min(Math.max(ratio * 50, 10), 100);
                      
                      return (
                        <div key={month} style={{
                          marginBottom: '1rem',
                          padding: '1rem',
                          background: 'rgba(255, 255, 255, 0.5)',
                          borderRadius: '0.5rem'
                        }}>
                          <div style={{
                            marginBottom: '0.5rem'
                          }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280' }}>
                              Month {month}
                            </span>
                          </div>
                          <div style={{
                            width: '100%',
                            height: '1.5rem',
                            background: 'rgba(229, 231, 235, 0.5)',
                            borderRadius: '0.25rem',
                            overflow: 'hidden',
                            position: 'relative'
                          }}>
                            <div style={{
                              width: `${barWidth}%`,
                              height: '100%',
                              background: `linear-gradient(90deg, ${barColor} 0%, ${barColor}dd 100%)`,
                              borderRadius: '0.25rem',
                              transition: 'width 0.3s ease',
                              position: 'relative'
                            }}>
                              <div style={{
                                position: 'absolute',
                                right: '0.5rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                color: 'white',
                                textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                              }}>
                                {ratio.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    );
  };

  const renderShowTimeTrials = (): React.ReactElement => {
    // Helper function to format units for display
    const formatUnits = (units: string | null | undefined): string => {
      if (!units) return 'units';
      const unitMap: Record<string, string> = {
        'cal': 'calories',
        'watts': 'watts',
        'mph': 'mph',
        'kph': 'kph',
        'miles': 'miles',
        'meters': 'meters'
      };
      const normalizedUnits = units as string;
      return unitMap[normalizedUnits] || normalizedUnits;
    };
    
    // Get available modalities from time trials
    const availableModalities = [...new Set(timeTrials.map(t => t.modality).filter(Boolean))].sort();
    
    // Group by modality and determine current (most recent by date)
    const groupedByModality: Record<string, TimeTrial[]> = {};
    timeTrials.forEach((trial: TimeTrial) => {
      const modality = trial.modality || 'unknown';
      if (!groupedByModality[modality]) {
        groupedByModality[modality] = [];
      }
      groupedByModality[modality].push(trial);
    });
    
    // Sort by date within each modality and mark most recent as current
    const enrichedTrials: any[] = [];
    Object.values(groupedByModality).forEach((trials: TimeTrial[]) => {
      // Sort by date descending
      trials.sort((a: TimeTrial, b: TimeTrial) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });
      
      // Mark most recent as current
      trials.forEach((trial: TimeTrial, index: number) => {
        enrichedTrials.push({
          ...trial,
          isCurrent: index === 0
        });
      });
    });
    
    // Apply filters
    let filteredTrials = enrichedTrials;
    
    // Apply baseline type filter
    if (timeTrialBaselineFilter === 'current') {
      filteredTrials = filteredTrials.filter(t => t.isCurrent);
    } else if (timeTrialBaselineFilter === 'previous') {
      filteredTrials = filteredTrials.filter(t => !t.isCurrent);
    }
    
    // Apply modality filter
    if (timeTrialModalityFilter) {
      filteredTrials = filteredTrials.filter(t => t.modality === timeTrialModalityFilter);
    }
    
    // Sort filtered trials by modality then by date
    filteredTrials.sort((a: any, b: any) => {
      if (a.modality !== b.modality) {
        return (a.modality || '').localeCompare(b.modality || '');
      }
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });
    
    // Separate current and previous for display
    const currentTrials = filteredTrials.filter(t => t.isCurrent);
    const previousTrials = filteredTrials.filter(t => !t.isCurrent);
    
    // Determine if we should show each box based on filters
    const showCurrentBox = timeTrialBaselineFilter === 'all' || timeTrialBaselineFilter === 'current';
    const showPreviousBox = timeTrialBaselineFilter === 'all' || timeTrialBaselineFilter === 'previous';
    
    return (
      <div style={{ marginBottom: '1.5rem' }}>
        {enrichedTrials.length === 0 ? (
          <div style={{
            background: '#DAE2EA',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            padding: '2rem',
            textAlign: 'center',
            border: '1px solid #FE5858',
            color: '#6b7280'
          }}>
            No time trials completed yet.
          </div>
        ) : (
          <>
            {/* Filters */}
            <div style={{ marginBottom: '1.5rem' }}>
              {/* Baseline Type Filter */}
              <div style={{ 
                marginBottom: '1.5rem',
                border: '1px solid #282B34',
                borderRadius: '0.75rem',
                padding: '1.25rem'
              }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#282B34',
                  marginBottom: '0.5rem',
                  textAlign: 'center'
                }}>Select Baseline Type</label>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: '1rem',
                    flexWrap: 'wrap'
                  }}>
          <button 
                      onClick={() => setTimeTrialBaselineFilter('all')}
            style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        border: '2px solid',
                        borderColor: timeTrialBaselineFilter === 'all' ? '#FE5858' : '#e5e7eb',
                        background: '#DAE2EA',
                        color: '#282B34',
                        fontWeight: '600',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                        (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                        (e.target as HTMLElement).style.borderColor = '#FE5858';
            }}
            onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.transform = 'translateY(0)';
                        (e.target as HTMLElement).style.boxShadow = 'none';
                        (e.target as HTMLElement).style.borderColor = timeTrialBaselineFilter === 'all' ? '#FE5858' : '#e5e7eb';
            }}
          >
                      <span>All</span>
          </button>
                    <button
                      onClick={() => setTimeTrialBaselineFilter('current')}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        border: '2px solid',
                        borderColor: timeTrialBaselineFilter === 'current' ? '#FE5858' : '#e5e7eb',
                        background: '#DAE2EA',
                        color: '#282B34',
            fontWeight: '600',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                        (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                        (e.target as HTMLElement).style.borderColor = '#FE5858';
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.transform = 'translateY(0)';
                        (e.target as HTMLElement).style.boxShadow = 'none';
                        (e.target as HTMLElement).style.borderColor = timeTrialBaselineFilter === 'current' ? '#FE5858' : '#e5e7eb';
                      }}
                    >
                      <span>Current</span>
                    </button>
                    <button
                      onClick={() => setTimeTrialBaselineFilter('previous')}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        border: '2px solid',
                        borderColor: timeTrialBaselineFilter === 'previous' ? '#FE5858' : '#e5e7eb',
                        background: '#DAE2EA',
                        color: '#282B34',
                        fontWeight: '600',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                        (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                        (e.target as HTMLElement).style.borderColor = '#FE5858';
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.transform = 'translateY(0)';
                        (e.target as HTMLElement).style.boxShadow = 'none';
                        (e.target as HTMLElement).style.borderColor = timeTrialBaselineFilter === 'previous' ? '#FE5858' : '#e5e7eb';
                      }}
                    >
                      <span>Previous</span>
                    </button>
                  </div>
        </div>

              {/* Modality Filter */}
              {availableModalities.length > 0 && (
        <div style={{
                  marginBottom: '1.5rem',
                  border: '1px solid #282B34',
                  borderRadius: '0.75rem',
                  padding: '1.25rem'
        }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
            fontWeight: '600',
            color: '#282B34',
                    marginBottom: '0.5rem',
            textAlign: 'center'
                  }}>Select Modality</label>
                    <div style={{
            display: 'flex',
                      flexDirection: 'row',
                      gap: '1rem',
                      flexWrap: 'wrap'
                    }}>
                      <button
                        onClick={() => setTimeTrialModalityFilter('')}
                        style={{
                          padding: '0.75rem 1rem',
                          borderRadius: '0.5rem',
                          border: '2px solid',
                          borderColor: timeTrialModalityFilter === '' ? '#FE5858' : '#e5e7eb',
                          background: '#DAE2EA',
                          color: '#282B34',
                          fontWeight: '600',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          whiteSpace: 'nowrap'
                        }}
                        onMouseEnter={(e) => {
                          (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                          (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                          (e.target as HTMLElement).style.borderColor = '#FE5858';
                        }}
                        onMouseLeave={(e) => {
                          (e.target as HTMLElement).style.transform = 'translateY(0)';
                          (e.target as HTMLElement).style.boxShadow = 'none';
                          (e.target as HTMLElement).style.borderColor = timeTrialModalityFilter === '' ? '#FE5858' : '#e5e7eb';
                        }}
                      >
                        <span>All Modalities</span>
                      </button>
                      {availableModalities.map((modality: string) => {
                        const isSelected = timeTrialModalityFilter === modality;
                        return (
                          <button
                            key={modality}
                            onClick={() => setTimeTrialModalityFilter(modality)}
                            style={{
                              padding: '0.75rem 1rem',
                              borderRadius: '0.5rem',
                              border: '2px solid',
                              borderColor: isSelected ? '#FE5858' : '#e5e7eb',
                              background: '#DAE2EA',
                              color: '#282B34',
                              fontWeight: '600',
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              whiteSpace: 'nowrap'
                            }}
                            onMouseEnter={(e) => {
                              (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                              (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                              (e.target as HTMLElement).style.borderColor = '#FE5858';
                            }}
                            onMouseLeave={(e) => {
                              (e.target as HTMLElement).style.transform = 'translateY(0)';
                              (e.target as HTMLElement).style.boxShadow = 'none';
                              (e.target as HTMLElement).style.borderColor = isSelected ? '#FE5858' : '#e5e7eb';
                            }}
                          >
                            <span>{getModalityDisplayName(modality)}</span>
                          </button>
                        );
                      })}
                    </div>
                </div>
              )}
            </div>
            
            {/* No Results Message */}
            {filteredTrials.length === 0 && enrichedTrials.length > 0 && (
            <div style={{
                background: '#DAE2EA',
                backdropFilter: 'blur(10px)',
                borderRadius: '1rem',
                boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              padding: '2rem',
                textAlign: 'center',
                border: '1px solid #FE5858',
              color: '#6b7280'
            }}>
                No time trials match the selected filters.
            </div>
            )}
            
            {/* Current Baselines - Separate Box */}
            {showCurrentBox && currentTrials.length > 0 && (
            <>
                  <h4 style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: '#111827',
                    marginBottom: '1rem',
                  marginTop: '1.5rem',
                  textAlign: 'center'
                  }}>
                    Current Baselines
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {currentTrials.map((trial, index) => {
                      const maxOutput = Math.max(...filteredTrials.map(t => t.total_output || 0));
                      const barWidth = maxOutput > 0 ? (trial.total_output / maxOutput) * 100 : 0;
                      return (
                        <div key={`current-${index}`} style={{
                          background: '#FFFFFF',
                          borderRadius: '1rem',
                          padding: '1.5rem',
                          border: '2px solid rgba(254, 88, 88, 0.3)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <div style={{
                              fontSize: '1.125rem',
                              fontWeight: 'bold',
                              color: '#111827'
                            }}>
                              {getModalityDisplayName(trial.modality)}
                            </div>
                            <div style={{
                              fontSize: '0.875rem',
                              color: '#282B34',
                              fontWeight: '500'
                            }}>
                              {trial.date ? new Date(trial.date).toLocaleDateString() : 'Unknown Date'}
                            </div>
                          </div>
                          
                          {/* Bar Chart */}
                          <div style={{ marginBottom: '0.5rem' }}>
                            <div style={{
                              width: '100%',
                              height: '2rem',
                              background: 'rgba(229, 231, 235, 0.5)',
                              borderRadius: '0.5rem',
                              overflow: 'hidden',
                              position: 'relative'
                            }}>
                              <div style={{
                                width: `${Math.max(barWidth, 30)}%`,
                                height: '100%',
                                background: '#FE5858',
                                borderRadius: '0.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                padding: '0 0.75rem',
                                transition: 'width 0.5s ease'
                              }}>
                                <span style={{ fontSize: '0.875rem', fontWeight: 'bold', color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                                  {trial.total_output || 0} {formatUnits(trial.units)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
              </>
              )}
              
            {/* Previous Baselines - Separate Box */}
            {showPreviousBox && previousTrials.length > 0 && (
              <>
                  <h4 style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: '#111827',
                    marginBottom: '1rem',
                  marginTop: '1.5rem',
                  textAlign: 'center'
                  }}>
                    Previous Baselines
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {previousTrials.map((trial, index) => {
                      const maxOutput = Math.max(...filteredTrials.map(t => t.total_output || 0));
                      const barWidth = maxOutput > 0 ? (trial.total_output / maxOutput) * 100 : 0;
                      return (
                        <div key={`previous-${index}`} style={{
                          background: 'rgba(107, 114, 128, 0.1)',
                          borderRadius: '1rem',
                          padding: '1.5rem',
                          border: '1px solid rgba(107, 114, 128, 0.2)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <div style={{
                              fontSize: '1.125rem',
                              fontWeight: 'bold',
                              color: '#111827'
                            }}>
                              {getModalityDisplayName(trial.modality)}
                            </div>
                            <div style={{
                              fontSize: '0.875rem',
                              color: '#6b7280',
                              fontWeight: '500'
                            }}>
                              {trial.date ? new Date(trial.date).toLocaleDateString() : 'Unknown Date'}
                            </div>
                          </div>
                          
                          {/* Bar Chart */}
                          <div style={{ marginBottom: '0.5rem' }}>
                            <div style={{
                              width: '100%',
                              height: '2rem',
                              background: 'rgba(229, 231, 235, 0.5)',
                              borderRadius: '0.5rem',
                              overflow: 'hidden',
                              position: 'relative'
                            }}>
                              <div style={{
                                width: `${Math.max(barWidth, 30)}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, #6b7280 0%, #9ca3af 100%)',
                                borderRadius: '0.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                padding: '0 0.75rem',
                                transition: 'width 0.5s ease'
                              }}>
                                <span style={{ fontSize: '0.875rem', fontWeight: 'bold', color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                                  {trial.total_output || 0} {formatUnits(trial.units)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
              </>
              )}
            </>
          )}
      </div>
    );
  };

  const renderTargetVsActual = (): React.ReactElement => {
    const availableDayTypes = getAvailableDayTypes().filter(dayType => dayType !== 'time_trial');
    const availableModalities = getAvailableModalities();
    
    // Filter sessions based on selected filters
    // Exclude time_trial sessions as they don't use target pace development
    let filteredSessions = workoutSessions.filter((s: WorkoutSession) => s.day_type !== 'time_trial');
    if (targetVsActualModality) {
      filteredSessions = filteredSessions.filter((s: WorkoutSession) => s.modality === targetVsActualModality);
    }
    if (targetVsActualDayType) {
      filteredSessions = filteredSessions.filter((s: WorkoutSession) => s.day_type === targetVsActualDayType);
    }
    
    // Group sessions by day type first, then modality
    const analysisDataByDayType: Record<string, Record<string, any>> = {};
    
    filteredSessions.forEach((session: WorkoutSession) => {
      const dayType = session.day_type || 'unknown';
      const modality = session.modality || 'unknown';
      
      // Initialize day type if not exists
      if (!analysisDataByDayType[dayType]) {
        analysisDataByDayType[dayType] = {};
      }
      
      // Initialize modality within day type if not exists
      if (!analysisDataByDayType[dayType][modality]) {
        analysisDataByDayType[dayType][modality] = {
          dayType: dayType,
          modality: modality,
          sessions: [],
          sessionObjects: [],
          withinTarget: 0,
          close: 0,
          outsideTarget: 0,
          maxEffort: 0
        };
      }
      
      const performance = getPacePerformance(session);
      analysisDataByDayType[dayType][modality].sessions.push(performance);
      analysisDataByDayType[dayType][modality].sessionObjects.push(session);
      
      if (performance.status === 'within_target') analysisDataByDayType[dayType][modality].withinTarget++;
      else if (performance.status === 'close') analysisDataByDayType[dayType][modality].close++;
      else if (performance.status === 'outside_target') analysisDataByDayType[dayType][modality].outsideTarget++;
      else if (performance.status === 'max_effort') analysisDataByDayType[dayType][modality].maxEffort++;
    });
    
    // Calculate default aggregated view (all sessions)
    let defaultAggregatedData = null;
    if (!targetVsActualModality && !targetVsActualDayType) {
      let totalWithinTarget = 0;
      let totalClose = 0;
      let totalEvaluable = 0;
      
      Object.values(analysisDataByDayType).forEach((dayTypeData: Record<string, any>) => {
        Object.values(dayTypeData).forEach((modalityData: any) => {
          const evaluableSessions = modalityData.sessions.filter((s: any) => s.status !== 'unknown');
          totalEvaluable += evaluableSessions.length;
          totalWithinTarget += modalityData.withinTarget;
          totalClose += modalityData.close;
        });
      });
      
      const successRate = totalEvaluable > 0 ? ((totalWithinTarget + totalClose) / totalEvaluable * 100).toFixed(1) : '0';
      
      defaultAggregatedData = {
        totalWithinTarget,
        totalClose,
        totalEvaluable,
        successRate: parseFloat(successRate as string),
        label: 'All Training'
      };
    }
    
    // Convert to array grouped by day type (for filtered views)
    const groupedChartData = Object.keys(analysisDataByDayType).map((dayType: string) => {
      const modalities = Object.values(analysisDataByDayType[dayType]).map((data: any) => {
      const evaluableSessions = data.sessions.filter((s: any) => s.status !== 'unknown');
      const total = evaluableSessions.length;
      const successRate = total > 0 ? ((data.withinTarget + data.close) / total * 100).toFixed(1) : 0;
        
        const targetPaces = data.sessionObjects
          .map((session: WorkoutSession) => getTargetPaceValue(session))
          .filter((tp: number | null) => tp !== null && tp > 0);
        
          const avgTargetPace = targetPaces.length > 0 
            ? targetPaces.reduce((sum: number, tp: number) => sum + tp, 0) / targetPaces.length
          : null;
        
        const units = data.sessionObjects[0]?.units || 'cal';
        const unitLabel = units === 'meters' ? 'meters/min' : 'cal/min';
      
      return {
        ...data,
          total: data.sessions.length,
          evaluableTotal: total,
        successRate: parseFloat(successRate as string),
          avgActualPace: data.sessions.reduce((sum: number, s: any) => sum + (s.actualPace || 0), 0) / data.sessions.length,
          avgTargetPace: avgTargetPace,
          units: unitLabel
        };
      }).filter(data => data.evaluableTotal > 0);
      
      return {
        dayType: dayType,
        modalities: modalities.sort((a: any, b: any) => (b.successRate || 0) - (a.successRate || 0))
      };
    }).filter((group: any) => group.modalities.length > 0)
      .sort((a: any, b: any) => {
        const maxA = Math.max(...a.modalities.map((m: any) => m.successRate));
        const maxB = Math.max(...b.modalities.map((m: any) => m.successRate));
        return (maxB || 0) - (maxA || 0);
      });
    
    // Determine what to display based on filters
    const showDefaultView = !targetVsActualModality && !targetVsActualDayType;
    const showModalityView = targetVsActualModality && !targetVsActualDayType;
    const showDayTypeView = !targetVsActualModality && targetVsActualDayType;
    const showCombinedView = targetVsActualModality && targetVsActualDayType;
    
    return (
      <div>
        {/* Default Aggregated View - Moved to top */}
        {showDefaultView && defaultAggregatedData && (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{
              padding: '1.5rem',
              background: 'rgba(255, 255, 255, 0.5)',
              borderRadius: '0.75rem',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem'
              }}>
                <div style={{
                  fontWeight: 'bold',
                  color: '#282B34',
                  fontSize: '1rem'
                }}>
                  All Training
                </div>
                <div style={{
                  fontSize: '1.25rem',
                  fontWeight: 'bold',
                  color: '#282B34'
                }}>
                  {defaultAggregatedData.totalWithinTarget + defaultAggregatedData.totalClose}/{defaultAggregatedData.totalEvaluable}
                </div>
              </div>
              
              <div style={{
                width: '100%',
                height: '1.5rem',
                background: 'rgba(229, 231, 235, 0.5)',
                borderRadius: '0.5rem',
                overflow: 'hidden',
                position: 'relative'
              }}>
                <div style={{
                  width: `${Math.max(defaultAggregatedData.successRate, 5)}%`,
                  height: '100%',
                  background: '#FE5858',
                  borderRadius: '0.5rem',
                  transition: 'width 0.3s ease',
                  position: 'relative'
                }}>
                  <div style={{
                    position: 'absolute',
                    right: '0.5rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '0.875rem',
                    fontWeight: 'bold',
                    color: 'white',
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                  }}>
                    {defaultAggregatedData.successRate}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Filters */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}
        className="target-vs-actual-filters"
        >
            {/* Modality Filter */}
            <div style={{ 
              border: '1px solid #282B34',
              borderRadius: '0.75rem',
              background: '#FFFFFF',
              padding: '1.25rem',
              marginBottom: '1rem'
            }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#282B34',
                marginBottom: '0.5rem',
                textAlign: 'center'
              }}>Select Modality</label>
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '1rem',
                flexWrap: 'wrap'
              }}>
          <button 
                  onClick={() => setTargetVsActualModality('')}
            style={{
                    padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
                    border: '2px solid',
                    borderColor: targetVsActualModality === '' ? '#FE5858' : '#e5e7eb',
                    background: '#DAE2EA',
                    color: '#282B34',
                    fontWeight: '600',
                    fontSize: '0.875rem',
              cursor: 'pointer',
                    transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
                    justifyContent: 'center',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                    (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                    (e.target as HTMLElement).style.borderColor = '#FE5858';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.transform = 'translateY(0)';
                    (e.target as HTMLElement).style.boxShadow = 'none';
                    (e.target as HTMLElement).style.borderColor = targetVsActualModality === '' ? '#FE5858' : '#e5e7eb';
                  }}
                >
                  <span>All Modalities</span>
                </button>
                {availableModalities.map((modality: string) => {
                  const isSelected = targetVsActualModality === modality;
                  return (
                    <button
                      key={modality}
                      onClick={() => setTargetVsActualModality(modality)}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        border: '2px solid',
                        borderColor: isSelected ? '#FE5858' : '#e5e7eb',
                        background: '#DAE2EA',
                        color: '#282B34',
                        fontWeight: '600',
              fontSize: '0.875rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        whiteSpace: 'nowrap'
            }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                        (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                        (e.target as HTMLElement).style.borderColor = '#FE5858';
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.transform = 'translateY(0)';
                        (e.target as HTMLElement).style.boxShadow = 'none';
                        (e.target as HTMLElement).style.borderColor = isSelected ? '#FE5858' : '#e5e7eb';
                      }}
                    >
                      <span>{getModalityDisplayName(modality)}</span>
          </button>
                  );
                })}
              </div>
        </div>
        
            {/* Day Type Filter */}
            <div style={{ 
              border: '1px solid #282B34',
              borderRadius: '0.75rem',
              background: '#FFFFFF',
              padding: '1.25rem',
              marginBottom: '1rem'
            }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#282B34',
            marginBottom: '0.5rem',
                textAlign: 'center'
              }}>Select Day Type</label>
              <div style={{
            display: 'flex',
                flexDirection: 'row',
                gap: '1rem',
                flexWrap: 'wrap'
          }}>
                <button
                  onClick={() => setTargetVsActualDayType('')}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '0.5rem',
                    border: '2px solid',
                    borderColor: targetVsActualDayType === '' ? '#FE5858' : '#e5e7eb',
                    background: '#DAE2EA',
                    color: '#282B34',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                    (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                    (e.target as HTMLElement).style.borderColor = '#FE5858';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.transform = 'translateY(0)';
                    (e.target as HTMLElement).style.boxShadow = 'none';
                    (e.target as HTMLElement).style.borderColor = targetVsActualDayType === '' ? '#FE5858' : '#e5e7eb';
                  }}
                >
                  <span>All Day Types</span>
                </button>
                {availableDayTypes.map((dayType: string) => {
                  const isSelected = targetVsActualDayType === dayType;
                  return (
                    <button
                      key={dayType}
                      onClick={() => setTargetVsActualDayType(dayType)}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        border: '2px solid',
                        borderColor: isSelected ? '#FE5858' : '#e5e7eb',
                        background: '#DAE2EA',
                        color: '#282B34',
                        fontWeight: '600',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                        (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                        (e.target as HTMLElement).style.borderColor = '#FE5858';
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.transform = 'translateY(0)';
                        (e.target as HTMLElement).style.boxShadow = 'none';
                        (e.target as HTMLElement).style.borderColor = isSelected ? '#FE5858' : '#e5e7eb';
                      }}
                    >
                      <span>{getWorkoutTypeDisplayName(dayType)}</span>
                    </button>
                  );
                })}
            </div>
            </div>
        </div>
        
        {/* Filtered Views - only show when filters are active */}
        {(showModalityView || showDayTypeView || showCombinedView) && (
          groupedChartData.length === 0 ? (
          <div style={{
            background: '#DAE2EA',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            padding: '2rem',
            textAlign: 'center',
            border: '1px solid #FE5858'
          }}>
            <p style={{ color: '#282B34', fontSize: '1rem' }}>No completed workouts found for analysis.</p>
          </div>
        ) : (
            <>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#282B34', marginBottom: '1rem', marginTop: '1.5rem' }}>
                {showModalityView && `Success Rate by Day Type (${getModalityDisplayName(targetVsActualModality)})`}
                {showDayTypeView && `Success Rate by Modality (${getWorkoutTypeDisplayName(targetVsActualDayType)})`}
                {showCombinedView && `${getWorkoutTypeDisplayName(targetVsActualDayType)} - ${getModalityDisplayName(targetVsActualModality)}`}
              </h3>
              
              <div style={{ marginBottom: '2rem' }}>
                {groupedChartData.map((dayTypeGroup, groupIndex) => (
                  <div key={dayTypeGroup.dayType} style={{
                    marginBottom: groupIndex < groupedChartData.length - 1 ? '2.5rem' : '0'
                  }}>
                    {dayTypeGroup.modalities.map((data, index) => {
                      const barWidth = Math.max(data.successRate, 5);
                  
                  return (
                    <div key={`${data.dayType}_${data.modality}`} style={{
                          marginBottom: index < dayTypeGroup.modalities.length - 1 ? '1.5rem' : '0',
                      padding: '1rem',
                            background: '#FFFFFF',
                      borderRadius: '0.75rem',
                      border: '1px solid rgba(255, 255, 255, 0.3)'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.75rem'
                      }}>
                        <div style={{
                          fontWeight: 'bold',
                              color: '#282B34',
                          fontSize: '1rem',
                                textTransform: showDayTypeView ? 'capitalize' : 'none'
                        }}>
                                {showDayTypeView ? getModalityDisplayName(data.modality) : getWorkoutTypeDisplayName(data.dayType)}
                        </div>
                        <div style={{
                          fontSize: '1.25rem',
                          fontWeight: 'bold',
                              color: '#282B34'
                        }}>
                              {data.withinTarget + data.close}/{data.evaluableTotal}
                        </div>
                      </div>
                      
                      <div style={{
                        width: '100%',
                        height: '1rem',
                        background: 'rgba(229, 231, 235, 0.5)',
                        borderRadius: '0.5rem',
                        overflow: 'hidden',
                        position: 'relative'
                      }}>
                        <div style={{
                          width: `${barWidth}%`,
                          height: '100%',
                              background: '#FE5858',
                          borderRadius: '0.5rem',
                          transition: 'width 0.3s ease',
                          position: 'relative'
                        }}>
                          <div style={{
                            position: 'absolute',
                            right: '0.5rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            color: 'white',
                            textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                          }}>
                            {data.successRate}%
                          </div>
                        </div>
                      </div>
                      
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: '0.75rem',
                        fontSize: '0.875rem',
                            color: '#282B34'
                          }}>
                            <span>Avg Pace: {data.avgActualPace.toFixed(1)} {data.units}</span>
                            {data.avgTargetPace && (
                              <span>Avg Target: <span style={{ color: '#FE5858' }}>{data.avgTargetPace.toFixed(1)} {data.units}</span></span>
                            )}
                      </div>
                    </div>
                  );
                })}
              </div>
                ))}
              </div>
            </>
          )
        )}
              
        {/* No data message when no filters and no default data */}
        {!showDefaultView && !showModalityView && !showDayTypeView && !showCombinedView && groupedChartData.length === 0 && !defaultAggregatedData && (
              <div style={{
            background: '#DAE2EA',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            padding: '2rem',
            textAlign: 'center',
            border: '1px solid #FE5858'
          }}>
            <p style={{ color: '#282B34', fontSize: '1rem' }}>No completed workouts found for analysis.</p>
          </div>
        )}
      </div>
    );
  };

  const renderPersonalRecords = (): React.ReactElement => {
    const availableModalities = getAvailableModalities();
    const recordsData = getPersonalRecordsData(personalRecordsModality);
    const dayTypes = Object.keys(recordsData).sort((a: any, b: any) => {
      let valueA, valueB;
      if (performanceView === 'best') {
        valueA = recordsData[a].best.pace;
        valueB = recordsData[b].best.pace;
      } else if (performanceView === 'average') {
        valueA = recordsData[a].average;
        valueB = recordsData[b].average;
      } else { // consistency
        const consistencyA = recordsData[a].best.pace > 0 
          ? (recordsData[a].average / recordsData[a].best.pace) * 100 
          : 0;
        const consistencyB = recordsData[b].best.pace > 0 
          ? (recordsData[b].average / recordsData[b].best.pace) * 100 
          : 0;
        valueA = consistencyA;
        valueB = consistencyB;
      }
      return valueB - valueA; // Sort descending
    });
    
    return (
      <div>
        {/* Modality Filter */}
        {availableModalities.length > 0 && (
          <div style={{ 
            marginBottom: '1.5rem',
            border: '1px solid #282B34',
            borderRadius: '0.75rem',
            background: '#FFFFFF',
            padding: '1.25rem'
          }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#282B34',
              marginBottom: '0.75rem'
            }}>
              Select Modality
            </label>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
          <button 
                onClick={() => setPersonalRecordsModality('')}
            style={{
                  padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
                  border: '2px solid',
                  borderColor: personalRecordsModality === '' ? '#FE5858' : '#e5e7eb',
                  background: '#DAE2EA',
                  color: '#282B34',
                  fontWeight: '600',
                  fontSize: '0.875rem',
              cursor: 'pointer',
                  transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                  (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                  (e.target as HTMLElement).style.borderColor = '#FE5858';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.transform = 'translateY(0)';
                  (e.target as HTMLElement).style.boxShadow = 'none';
                  (e.target as HTMLElement).style.borderColor = personalRecordsModality === '' ? '#FE5858' : '#e5e7eb';
                }}
              >
                <span>All Modalities</span>
          </button>
              {availableModalities.map((modality: string) => {
                const isSelected = personalRecordsModality === modality;
                return (
                  <button
                    key={modality}
                    onClick={() => setPersonalRecordsModality(modality)}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                      border: '2px solid',
                      borderColor: isSelected ? '#FE5858' : '#e5e7eb',
                      background: '#DAE2EA',
                      color: '#282B34',
                      fontWeight: '600',
              fontSize: '0.875rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
                      justifyContent: 'center',
                      whiteSpace: 'nowrap'
            }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                      (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                      (e.target as HTMLElement).style.borderColor = '#FE5858';
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.transform = 'translateY(0)';
                      (e.target as HTMLElement).style.boxShadow = 'none';
                      (e.target as HTMLElement).style.borderColor = isSelected ? '#FE5858' : '#e5e7eb';
                    }}
                  >
                    <span>{getModalityDisplayName(modality)}</span>
          </button>
                );
              })}
            </div>
        </div>
        )}
        
        {/* Toggle Button */}
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            background: '#DAE2EA',
            borderRadius: '0.75rem',
            padding: '0.25rem',
            border: '1px solid rgba(255, 255, 255, 0.3)'
          }}>
            <button
              onClick={() => setPerformanceView('best')}
              style={{
                background: performanceView === 'best' ? 'rgba(254, 88, 88, 0.1)' : 'transparent',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.5rem 1rem',
                cursor: 'pointer',
                color: performanceView === 'best' ? '#FE5858' : '#282B34',
                fontWeight: performanceView === 'best' ? '600' : '400',
                fontSize: '0.875rem',
                transition: 'all 0.2s ease'
              }}
            >
              My Records
            </button>
            <button
              onClick={() => setPerformanceView('average')}
              style={{
                background: performanceView === 'average' ? 'rgba(254, 88, 88, 0.1)' : 'transparent',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.5rem 1rem',
                cursor: 'pointer',
                color: performanceView === 'average' ? '#FE5858' : '#282B34',
                fontWeight: performanceView === 'average' ? '600' : '400',
                fontSize: '0.875rem',
                transition: 'all 0.2s ease'
              }}
            >
              My Averages
            </button>
            <button
              onClick={() => setPerformanceView('consistency')}
              style={{
                background: performanceView === 'consistency' ? 'rgba(254, 88, 88, 0.1)' : 'transparent',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.5rem 1rem',
                cursor: 'pointer',
                color: performanceView === 'consistency' ? '#FE5858' : '#282B34',
                fontWeight: performanceView === 'consistency' ? '600' : '400',
                fontSize: '0.875rem',
                transition: 'all 0.2s ease'
              }}
            >
              Consistency
            </button>
          </div>
        </div>
        
        {dayTypes.length === 0 ? (
          <div style={{
            background: '#DAE2EA',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            padding: '2rem',
            textAlign: 'center',
            border: '1px solid #FE5858'
          }}>
            <p style={{ color: '#282B34', fontSize: '1rem' }}>No completed workouts found for personal records.</p>
          </div>
        ) : (
          <>
              {/* Bar Chart */}
              <div>
                {dayTypes.map((dayType, index) => {
                  const data = recordsData[dayType];
                  let displayValue, displayDate, displayLabel;
                  
                  if (performanceView === 'best') {
                    displayValue = data.best.pace;
                    displayDate = data.best.date;
                    displayLabel = `${displayValue.toFixed(1)} cal/min`;
                  } else if (performanceView === 'average') {
                    displayValue = data.average;
                    displayDate = null;
                    displayLabel = `${displayValue.toFixed(1)} cal/min`;
                  } else { // consistency
                    const consistency = data.best.pace > 0 
                      ? (data.average / data.best.pace) * 100 
                      : 0;
                    displayValue = consistency;
                    displayDate = null;
                    displayLabel = `${consistency.toFixed(1)}%`;
                  }
                  
                  // Calculate bar height based on max value for visual comparison
                  const maxValue = Math.max(...dayTypes.map(dt => {
                    if (performanceView === 'best') {
                      return recordsData[dt].best.pace;
                    } else if (performanceView === 'average') {
                      return recordsData[dt].average;
                    } else { // consistency
                      return recordsData[dt].best.pace > 0 
                        ? (recordsData[dt].average / recordsData[dt].best.pace) * 100 
                        : 0;
                    }
                  }));
                  const barHeight = (displayValue / maxValue) * 100;
                  const barColor = '#FE5858';
                  
                  return (
                    <div key={dayType} style={{
                      marginBottom: '1.5rem',
                      padding: '1rem',
                      background: '#FFFFFF',
                      borderRadius: '0.75rem',
                      border: '1px solid rgba(255, 255, 255, 0.3)'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.75rem'
                      }}>
                        <div style={{
                          fontWeight: 'bold',
                          color: '#282B34',
                          fontSize: '1rem',
                        }}>
                          {getWorkoutTypeDisplayName(dayType)} <span style={{ color: '#FE5858' }}>({data.sessions.length})</span>
                        </div>
                        {displayDate && (
                        <div style={{
                            fontSize: '0.875rem',
                            color: '#282B34'
                        }}>
                            {new Date(displayDate).toLocaleDateString()}
                        </div>
                        )}
                      </div>
                      
                      {/* Bar Chart */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'end',
                        height: '3rem',
                        borderRadius: '1.5rem',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${Math.max(barHeight, 10)}%`,
                          height: '100%',
                          background: `linear-gradient(180deg, ${barColor} 0%, ${barColor}dd 100%)`,
                          borderRadius: '1.5rem 0 0 1.5rem',
                          transition: 'width 0.3s ease',
                          position: 'relative',
                          minWidth: '2rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          paddingLeft: '0.75rem'
                        }}>
                          <div style={{
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            color: '#F8FBFE',
                            whiteSpace: 'nowrap',
                            textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                          }}>
                            {displayLabel}
                          </div>
                        </div>
                        <div style={{
                          flex: 1,
                          height: '100%',
                          background: 'rgba(229, 231, 235, 0.3)',
                          borderRadius: '0 1.5rem 1.5rem 0'
                        }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
        )}
      </div>
    );
  };

  const renderHeartRateAnalytics = (): React.ReactElement => {
    const hrData = getHeartRateAnalyticsData();
    const recoveryInsights = getRecoveryInsights();
    const dayTypes = Object.keys(hrData).sort((a: any, b: any) => hrData[b].sessions.length - hrData[a].sessions.length);
    
    return (
      <div>
        {/* Modality Filter */}
        {(() => {
          const modalities = [...new Set(workoutSessions
            .filter((s: WorkoutSession) => s.average_heart_rate && s.peak_heart_rate)
            .map(s => s.modality)
            .filter(Boolean)
          )].sort();
          
          if (modalities.length === 0) {
            return null; // No modalities available
          }
          
          return (
            <div style={{
              border: '1px solid #282B34',
              borderRadius: '0.75rem',
              background: '#FFFFFF',
              padding: '1.25rem',
              marginBottom: '1.5rem'
            }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#282B34',
                marginBottom: '0.5rem',
                textAlign: 'center'
              }}>Select Modality</label>
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '0.75rem',
                flexWrap: 'wrap',
                justifyContent: 'center'
              }}>
          <button 
                  onClick={() => setAnalyticsModalityFilter('')}
            style={{
                    padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
                    border: '2px solid',
                    borderColor: analyticsModalityFilter === '' ? '#FE5858' : '#282B34',
                    background: '#DAE2EA',
                    color: '#282B34',
                    fontWeight: '600',
                    fontSize: '0.875rem',
              cursor: 'pointer',
                    transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
                    justifyContent: 'center',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => {
                    if (analyticsModalityFilter !== '') {
                      (e.target as HTMLElement).style.borderColor = '#FE5858';
                      (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                      (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.transform = 'translateY(0)';
                    (e.target as HTMLElement).style.boxShadow = 'none';
                    (e.target as HTMLElement).style.borderColor = analyticsModalityFilter === '' ? '#FE5858' : '#282B34';
                  }}
                >
                  All Modalities
          </button>
                {modalities.map(modality => {
                  const isSelected = analyticsModalityFilter === modality;
                  return (
                    <button
                      key={modality}
                      onClick={() => setAnalyticsModalityFilter(modality)}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        border: '2px solid',
                        borderColor: isSelected ? '#FE5858' : '#282B34',
                        background: '#DAE2EA',
                        color: '#282B34',
                        fontWeight: '600',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
                        justifyContent: 'center',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          (e.target as HTMLElement).style.borderColor = '#FE5858';
                          (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                          (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.transform = 'translateY(0)';
                        (e.target as HTMLElement).style.boxShadow = 'none';
                        (e.target as HTMLElement).style.borderColor = isSelected ? '#FE5858' : '#282B34';
                      }}
                    >
                      {getModalityDisplayName(modality)}
                    </button>
                  );
                })}
            </div>
        </div>
          );
        })()}
        
        {dayTypes.length === 0 ? (
          <div style={{
            background: '#DAE2EA',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            padding: '2rem',
            textAlign: 'center',
            border: '1px solid #FE5858'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>💓</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', marginBottom: '0.5rem' }}>
              No Heart Rate Data Available
            </h3>
            <p style={{ color: '#6b7280', lineHeight: '1.6' }}>
              Complete some workouts with heart rate data to see analytics here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Metric Comparison Chart */}
            <div style={{
              background: '#FFFFFF',
              backdropFilter: 'blur(10px)',
              borderRadius: '1rem',
              padding: '2rem',
              border: '1px solid #FE5858'
            }}>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: '#282B34',
                marginBottom: '1rem',
                textAlign: 'center'
              }}>
                {selectedHrMetric === 'avgHR' && 'Average HR by Day Type'}
                {selectedHrMetric === 'peakHR' && 'Peak HR by Day Type'}
                {selectedHrMetric === 'efficiency' && 'HR Efficiency by Day Type'}
                {selectedHrMetric === 'trainingLoad' && 'Training Load by Day Type'}
                {!selectedHrMetric && 'Select a metric to view comparison'}
              </h3>
              
              {/* Metric Selection Buttons */}
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '0.75rem',
                flexWrap: 'wrap',
                justifyContent: 'center',
                marginBottom: '1.5rem'
              }}>
                {[
                  { key: 'avgHR', label: 'Average HR' },
                  { key: 'peakHR', label: 'Peak HR' },
                  { key: 'efficiency', label: 'HR Efficiency' },
                  { key: 'trainingLoad', label: 'Training Load' }
                ].map(metric => {
                  const isSelected = selectedHrMetric === metric.key;
                  return (
                    <button
                      key={metric.key}
                      onClick={() => setSelectedHrMetric(metric.key)}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        border: '2px solid',
                        borderColor: isSelected ? '#FE5858' : '#282B34',
                        background: '#DAE2EA',
                        color: '#282B34',
                        fontWeight: '600',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          (e.target as HTMLElement).style.borderColor = '#FE5858';
                          (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                          (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.transform = 'translateY(0)';
                        (e.target as HTMLElement).style.boxShadow = 'none';
                        (e.target as HTMLElement).style.borderColor = isSelected ? '#FE5858' : '#282B34';
                      }}
                    >
                      {metric.label}
                    </button>
                  );
                })}
              </div>
              
              {/* Bar Chart - Only show when a metric is selected */}
              {selectedHrMetric && (() => {
                // Prepare data for chart
                const chartData = dayTypes.map(dayType => {
                  const data = hrData[dayType];
                  let value = 0;
                  let unit = '';
                  
                  switch(selectedHrMetric) {
                    case 'avgHR':
                      value = data.avgHRMean;
                      unit = ' BPM';
                      break;
                    case 'peakHR':
                      value = data.peakHRMean;
                      unit = ' BPM';
                      break;
                    case 'efficiency':
                      value = data.efficiencyMean;
                      unit = '';
                      break;
                    case 'trainingLoad':
                      value = data.trainingLoadMean;
                      unit = '';
                      break;
                  }
                  
                  return {
                    dayType,
                    value,
                    unit,
                    displayName: getWorkoutTypeDisplayName(dayType)
                  };
                }).sort((a: any, b: any) => b.value - a.value); // Sort by value descending
                
                const maxValue = Math.max(...chartData.map(d => d.value), 1);
                  
                  return (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    minHeight: '300px'
                  }}>
                    {chartData.map((item, index) => (
                      <div key={item.dayType} style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        setSelectedHrDayTypeForCards(item.dayType);
                        setCurrentView('hrDayTypeDetails');
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '0.8';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                      >
                        <div style={{
                          marginBottom: '0.25rem',
                          textAlign: 'left'
                        }}>
                          <span style={{
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            color: '#282B34'
                          }}>
                            {item.displayName}
                          </span>
                        </div>
                        <div style={{
                          width: '100%',
                          height: '2rem',
                          background: '#F8FBFE',
                          borderRadius: '0.5rem',
                          border: selectedHrDayTypeForCards === item.dayType ? '2px solid #FE5858' : '1px solid #282B34',
                          position: 'relative',
                          overflow: 'hidden',
                          transition: 'all 0.2s ease'
                        }}>
                          <div style={{
                            width: `${(item.value / maxValue) * 100}%`,
                            height: '100%',
                            background: '#FE5858',
                            borderRadius: '0.5rem',
                            transition: 'width 0.3s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            paddingRight: '0.5rem'
                          }}>
                            {item.value / maxValue > 0.15 && (
                              <span style={{
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                color: '#F8FBFE',
                                textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
                              }}>
                                {item.value.toFixed(selectedHrMetric === 'avgHR' || selectedHrMetric === 'peakHR' ? 0 : 1)}{item.unit}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 mb-4">Database not connected</div>
          <p className="text-gray-600">Connect to your database to view analytics.</p>
        </div>
      </div>
    );
  }

  // Helper function to calculate coefficient of variation (CV) for interval outputs
  // CV = (std dev / mean) * 100
  const calculateCoefficientOfVariation = (intervals: any[]): number | null => {
    if (!intervals || !Array.isArray(intervals) || intervals.length === 0) return null;
    
    const outputs = intervals.map((i: any) => i.output).filter((o: any) => o !== null && o !== undefined && o > 0);
    if (outputs.length === 0) return null;
    if (outputs.length === 1) return 0; // No variation with single value
    
    const mean = outputs.reduce((sum: number, val: number) => sum + val, 0) / outputs.length;
    if (mean === 0) return null;
    
    const variance = outputs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / outputs.length;
    const stdDev = Math.sqrt(variance);
    const cv = (stdDev / mean) * 100;
    
    return cv;
  };

  // Calculate average work:rest ratio from workout blocks
  // Excludes continuous blocks (restDuration === 0, ratio = 999)
  const calculateWorkoutAvgWorkRestRatio = (workout: any): number | null => {
    if (!workout) return null;
    
    const blocks = [
      workout.block_1_params,
      workout.block_2_params,
      workout.block_3_params,
      workout.block_4_params
    ].filter((block: any) => block && Object.keys(block).length > 0);
    
    if (blocks.length === 0) return null;
    
    const ratios: number[] = [];
    blocks.forEach((block: any) => {
      const workDuration = block.workDuration || 0;
      const restDuration = block.restDuration || 0;
      
      // Skip continuous blocks (restDuration === 0)
      if (restDuration === 0) return;
      
      // Skip if workDuration is 0 or invalid
      if (workDuration === 0 || workDuration === null || workDuration === undefined) return;
      if (restDuration === null || restDuration === undefined) return;
      
      const ratio = workDuration / restDuration;
      ratios.push(ratio);
    });
    
    // If all blocks were continuous, return 999
    if (ratios.length === 0) return 999;
    
    // Average the ratios
    const avgRatio = ratios.reduce((sum: number, r: number) => sum + r, 0) / ratios.length;
    return avgRatio;
  };

  // Helper function to get work:rest ratio from session or workout
  const getWorkToRestRatio = (session: WorkoutSession, workout: any = null): number | null => {
    // First, try to use the session's avg_work_rest_ratio if available
    if (session.avg_work_rest_ratio !== null && session.avg_work_rest_ratio !== undefined) {
      return session.avg_work_rest_ratio;
    }
    
    // Second, try to use the workout's avg_work_rest_ratio if available
    if (workout && workout.avg_work_rest_ratio !== null && workout.avg_work_rest_ratio !== undefined) {
      return workout.avg_work_rest_ratio;
    }
    
    // Fallback to calculating from workout_data if column is not available
    if (!session.workout_data) return null;
    
    // Handle workout_data being a JSON string
    let workoutData = session.workout_data;
    if (typeof workoutData === 'string') {
      try {
        workoutData = JSON.parse(workoutData);
      } catch (e) {
        console.warn('Failed to parse workout_data:', e);
        return null;
      }
    }
    
    const { work_duration, rest_duration } = workoutData;
    
    // Handle continuous workouts (rest_duration === 0)
    if (rest_duration === 0) return 999;
    
    // Check if work_duration exists and is valid
    if (work_duration === null || work_duration === undefined) return null;
    
    // Check if rest_duration exists and is valid (but not 0, which we already handled)
    if (rest_duration === null || rest_duration === undefined) return null;
    
    // If work_duration is 0, return null (no meaningful ratio)
    if (work_duration === 0) return null;
    
    // Calculate ratio
    return work_duration / rest_duration;
  };

  // Helper function to calculate performance ratio
  const getPerformanceRatio = (session: WorkoutSession): number | null => {
    if (!session.target_pace || !session.actual_pace) return null;
    return session.actual_pace / session.target_pace;
  };

  // Helper function to format ratio for display (e.g., 0.20 → "1:5", 1.0 → "1:1", 2.0 → "2:1")
  const formatRatioForDisplay = (ratio: number | string): string => {
    if (ratio === 'Continuous' || ratio === 999) return 'Continuous';
    
    const numRatio = typeof ratio === 'string' ? parseFloat(ratio) : ratio;
    if (numRatio < 1) {
      // Invert: 0.20 → "1:5"
      const inverted = 1 / numRatio;
      // Check if inverted is a whole number
      if (Number.isInteger(inverted)) {
        return `1:${inverted}`;
      } else {
        return `1:${inverted.toFixed(1)}`;
      }
    } else if (numRatio === 1) {
      return '1:1';
    } else {
      // Already > 1: check if it's a whole number
      if (Number.isInteger(numRatio)) {
        return `${numRatio}:1`;
      } else {
        return `${numRatio.toFixed(1)}:1`;
      }
    }
  };

  // Render function for Volume Progression
  const renderVolumeProgression = (): React.ReactElement => {
    // Group sessions by week
    const weeklyData: Record<string, any> = {};
    workoutSessions.forEach((session: WorkoutSession) => {
      if (!session.date) return;
      const date = new Date(session.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = { sessions: [], totalIntervals: 0 };
      }
      weeklyData[weekKey].sessions.push(session);
      const intervals = session.workout_data?.total_intervals || 1;
      weeklyData[weekKey].totalIntervals += intervals;
    });

    const weeks = Object.entries(weeklyData)
      .map(([week, data]) => ({ week, ...data }))
      .sort((a: any, b: any) => a.week.localeCompare(b.week));

    return (
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>📈 Volume Progression</h2>
        </div>

        {weeks.length === 0 ? (
          <div style={{
            background: '#DAE2EA',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            padding: '3rem',
            border: '1px solid #FE5858',
            textAlign: 'center'
          }}>
            <p style={{ color: '#6b7280', fontSize: '1.125rem' }}>No data available for volume progression.</p>
          </div>
        ) : (
          <div style={{
            background: '#DAE2EA',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: '1px solid #FE5858'
          }}>
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#111827' }}>
                Weekly Interval Volume
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1rem'
              }}>
                {weeks.map((week, idx) => {
                  const trend = idx > 0 ? week.totalIntervals - weeks[idx - 1].totalIntervals : 0;
                  const trendColor = trend > 0 ? '#16a34a' : trend < 0 ? '#dc2626' : '#6b7280';
                  
                  return (
                    <div key={week.week} style={{
                      background: 'rgba(255, 255, 255, 0.9)',
                      borderRadius: '0.75rem',
                      padding: '1rem',
                      border: '1px solid rgba(226, 232, 240, 1)'
                    }}>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                        Week of {new Date(week.week).toLocaleDateString()}
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                        {week.totalIntervals} intervals
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {week.sessions.length} sessions
                      </div>
                      {idx > 0 && (
                        <div style={{ fontSize: '0.75rem', color: trendColor, marginTop: '0.25rem' }}>
                          {trend > 0 ? '↗ ' : trend < 0 ? '↘ ' : '→ '}
                          {Math.abs(trend)} intervals
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render function for Structure Analysis
  const renderStructureAnalysis = (): React.ReactElement => {
    // Filter sessions by modality if selected
    const filteredSessions = analyticsModalityFilter 
      ? workoutSessions.filter((s: WorkoutSession) => s.modality === analyticsModalityFilter)
      : workoutSessions;
    
    // Cross-tabulate day_type by work:rest ratio
    const structureMap: Record<string, any> = {};
    filteredSessions.forEach((session: WorkoutSession) => {
      const ratio = getWorkToRestRatio(session);
      if (!ratio || !session.day_type) return;
      
      const ratioKey = ratio === 999 ? 'Continuous' : ratio.toFixed(2);
      const key = `${session.day_type}::${ratioKey}`;
      
      if (!structureMap[key]) {
        structureMap[key] = {
          dayType: session.day_type,
          ratio: ratioKey,
          sessions: []
        };
      }
      structureMap[key].sessions.push(session);
    });

    const structures = Object.values(structureMap)
      .map(s => ({
        ...s,
        count: s.sessions.length,
        avgPerformanceRatio: getPerformanceRatioFromSessions(s.sessions)
      }))
      .sort((a: any, b: any) => {
        if (a.dayType !== b.dayType) return a.dayType.localeCompare(b.dayType);
        if (a.ratio === 'Continuous') return 1;
        if (b.ratio === 'Continuous') return -1;
        return parseFloat(a.ratio) - parseFloat(b.ratio);
      });

    // Helper function to calculate average performance ratio
    function getPerformanceRatioFromSessions(sessions: WorkoutSession[]): number | null {
      const ratios = sessions
        .map((s: WorkoutSession) => getPerformanceRatio(s))
        .filter((r: number | null): r is number => r !== null);
      return ratios.length > 0 
        ? ratios.reduce((a: number, b: number) => a + b, 0) / ratios.length 
        : null;
    }

    return (
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '0 0 1.5rem 0' }}>📊 Structure Analysis</h2>

        {/* Modality Selector */}
        {(() => {
          const modalities = [...new Set(workoutSessions.map(s => s.modality).filter(Boolean))].sort();
          return (
            <div style={{
              background: '#FFFFFF',
              backdropFilter: 'blur(10px)',
              borderRadius: '1rem',
              padding: '1.5rem',
              border: '1px solid #FE5858',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                  Filter by Modality:
                </label>
                <select
                  value={analyticsModalityFilter}
                  onChange={(e) => setAnalyticsModalityFilter(e.target.value)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid rgba(229, 231, 235, 1)',
                    background: 'white',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#111827',
                    cursor: 'pointer',
                    minWidth: '150px'
                  }}
                >
                  <option value="">All Modalities</option>
                  {modalities.map(modality => (
                    <option key={modality} value={modality}>
                      {getModalityDisplayName(modality)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })()}

        {structures.length === 0 ? (
          <div style={{
            background: '#DAE2EA',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            padding: '3rem',
            border: '1px solid #FE5858',
            textAlign: 'center'
          }}>
            <p style={{ color: '#6b7280', fontSize: '1.125rem' }}>No data available for structure analysis.</p>
          </div>
        ) : (
          <div style={{
            background: '#DAE2EA',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: '1px solid #FE5858'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: '600', color: '#374151' }}>Day Type</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: '600', color: '#374151' }}>Work:Rest Ratio</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem', fontWeight: '600', color: '#374151' }}>Sessions</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem', fontWeight: '600', color: '#374151' }}>Avg PR</th>
                    <th style={{ textAlign: 'center', padding: '0.75rem', fontWeight: '600', color: '#374151' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {structures.map((structure, idx) => {
                    const status = !structure.avgPerformanceRatio ? 'No data' :
                      structure.avgPerformanceRatio < 0.85 ? 'Too hard' :
                      structure.avgPerformanceRatio > 1.15 ? 'Too easy' : 'Appropriate';
                    const statusColor = status === 'Appropriate' ? '#16a34a' : 
                                     status === 'Too hard' || status === 'Too easy' ? '#dc2626' : '#6b7280';
                    
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.75rem', color: '#111827' }}>{getWorkoutTypeDisplayName(structure.dayType)}</td>
                        <td style={{ padding: '0.75rem', color: '#6b7280' }}>
                          {structure.ratio === 'Continuous' ? 'Continuous' : formatRatioForDisplay(structure.ratio)}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: '#111827' }}>{structure.count}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: '#111827' }}>
                          {structure.avgPerformanceRatio ? (structure.avgPerformanceRatio * 100).toFixed(1) + '%' : '-'}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <span style={{
                            background: statusColor === '#16a34a' ? 'rgba(34, 197, 94, 0.1)' : 
                                       statusColor === '#dc2626' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                            color: statusColor,
                            padding: '0.25rem 0.75rem',
                            borderRadius: '0.375rem',
                            fontSize: '0.75rem',
                            fontWeight: '600'
                          }}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render function for Completion Rates
  const renderCompletionRates = (): React.ReactElement => {
    // Filter sessions by modality if selected
    const filteredSessions = analyticsModalityFilter 
      ? workoutSessions.filter((s: WorkoutSession) => s.modality === analyticsModalityFilter)
      : workoutSessions;
    
    // Group by workout structure
    const structureGroups: Record<string, any> = {};
    filteredSessions.forEach((session: WorkoutSession) => {
      const ratio = getWorkToRestRatio(session);
      if (!ratio) return;
      
      const ratioKey = ratio === 999 ? 'Continuous' : ratio.toFixed(2);
      const structureKey = `${session.day_type || 'unknown'}::${ratioKey}`;
      
      if (!structureGroups[structureKey]) {
        structureGroups[structureKey] = {
          dayType: session.day_type || 'unknown',
          ratio: ratioKey,
          sessions: []
        };
      }
      structureGroups[structureKey].sessions.push(session);
    });

    const completionStats = Object.values(structureGroups)
      .map((group: any) => {
        const totalWorkouts = group.sessions.length;
        
        // Calculate completion based on intervals_completed vs total_intervals
        const intervalsStats = group.sessions.map((s: any) => ({
          intervals_completed: s.workout_data?.intervals_completed || 0,
          total_intervals: s.workout_data?.total_intervals || 1
        }));
        
        // Fully completed = intervals_completed >= total_intervals
        const fullyCompleted = intervalsStats.filter((s: any) => s.intervals_completed >= s.total_intervals).length;
        const completionRate = totalWorkouts > 0 ? (fullyCompleted / totalWorkouts) * 100 : 0;
        
        const avgIntervalsCompleted = intervalsStats.length > 0
          ? intervalsStats.reduce((sum: number, s: any) => sum + s.intervals_completed, 0) / intervalsStats.length
          : 0;
        
        const avgTotalIntervals = intervalsStats.length > 0
          ? intervalsStats.reduce((sum: number, s: any) => sum + s.total_intervals, 0) / intervalsStats.length
          : 0;
        
        return {
          ...group,
          totalWorkouts,
          fullyCompleted,
          completionRate,
          avgIntervalsCompleted,
          avgTotalIntervals
        };
      })
      .sort((a: any, b: any) => {
        if (a.dayType !== b.dayType) return a.dayType.localeCompare(b.dayType);
        if (a.ratio === 'Continuous') return 1;
        if (b.ratio === 'Continuous') return -1;
        return parseFloat(a.ratio) - parseFloat(b.ratio);
      });

    return (
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>✅ Completion Rates</h2>
        </div>

        {/* Modality Selector */}
        {(() => {
          const modalities = [...new Set(workoutSessions.map(s => s.modality).filter(Boolean))].sort();
          return (
            <div style={{
              background: '#DAE2EA',
              backdropFilter: 'blur(10px)',
              borderRadius: '1rem',
              padding: '1.5rem',
              border: '1px solid #FE5858',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                  Filter by Modality:
                </label>
                <select
                  value={analyticsModalityFilter}
                  onChange={(e) => setAnalyticsModalityFilter(e.target.value)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid rgba(229, 231, 235, 1)',
                    background: 'white',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#111827',
                    cursor: 'pointer',
                    minWidth: '150px'
                  }}
                >
                  <option value="">All Modalities</option>
                  {modalities.map(modality => (
                    <option key={modality} value={modality}>
                      {getModalityDisplayName(modality)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })()}

        {completionStats.length === 0 ? (
          <div style={{
            background: '#DAE2EA',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            padding: '3rem',
            border: '1px solid #FE5858',
            textAlign: 'center'
          }}>
            <p style={{ color: '#6b7280', fontSize: '1.125rem' }}>No data available for completion rates.</p>
          </div>
        ) : (
          <div style={{
            background: '#DAE2EA',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: '1px solid #FE5858'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '1.5rem'
            }}>
              {completionStats.map((stat, idx) => (
                <div key={idx} style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  borderRadius: '1rem',
                  padding: '1.5rem',
                  border: '1px solid #FE5858',
                  boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                }}>
                  <div style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '0.5rem' }}>
                    {getWorkoutTypeDisplayName(stat.dayType)}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                    {stat.ratio === 'Continuous' ? 'Continuous Work' : `${formatRatioForDisplay(stat.ratio)} work:rest`}
                  </div>
                  
                  <div style={{
                    background: stat.completionRate >= 90 ? 'rgba(34, 197, 94, 0.1)' :
                               stat.completionRate >= 70 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    marginBottom: '0.75rem'
                  }}>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                      Completion Rate
                    </div>
                    <div style={{
                      fontSize: '2rem',
                      fontWeight: 'bold',
                      color: stat.completionRate >= 90 ? '#16a34a' :
                             stat.completionRate >= 70 ? '#f59e0b' : '#dc2626'
                    }}>
                      {stat.completionRate.toFixed(0)}%
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      {stat.fullyCompleted} of {stat.totalWorkouts} fully completed
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                      Avg: {stat.avgIntervalsCompleted.toFixed(1)}/{stat.avgTotalIntervals.toFixed(1)} intervals
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render function for HR Day Type Details
  const renderHrDayTypeDetails = (): React.ReactElement => {
    const hrData = getHeartRateAnalyticsData();
    
    if (!selectedHrDayTypeForCards) {
      return (
        <div style={{
          background: '#DAE2EA',
          borderRadius: '1rem',
          padding: '3rem',
          textAlign: 'center',
          border: '1px solid #FE5858'
        }}>
          <p style={{ color: '#6b7280', fontSize: '1rem' }}>No day type selected.</p>
        </div>
      );
    }
    
    const data = hrData[selectedHrDayTypeForCards];
    if (!data) {
      return (
        <div style={{
          background: '#DAE2EA',
          borderRadius: '1rem',
          padding: '3rem',
          textAlign: 'center',
          border: '1px solid #FE5858'
        }}>
          <p style={{ color: '#6b7280', fontSize: '1rem' }}>No data available for this day type.</p>
        </div>
      );
    }
    
    const avgHRColor = data.avgHRTrend > 0 ? '#dc2626' : data.avgHRTrend < 0 ? '#16a34a' : '#6b7280';
    const efficiencyColor = data.efficiencyTrend > 0 ? '#16a34a' : data.efficiencyTrend < 0 ? '#dc2626' : '#6b7280';
    
    return (
      <div>
        <div style={{
          background: '#FFFFFF',
          backdropFilter: 'blur(10px)',
          borderRadius: '1rem',
          padding: '2rem',
          border: '1px solid #FE5858'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem'
          }}>
            <h3 
              onClick={() => {
                setSelectedHrDayType(selectedHrDayTypeForCards);
                setCurrentView('hrSessionDetails');
              }}
              style={{
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: '#282B34',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.color = '#FE5858';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.color = '#282B34';
              }}
            >
              {getWorkoutTypeDisplayName(selectedHrDayTypeForCards)} ({data.sessions.length || 0})
            </h3>
            <button
              onClick={() => {
                setSelectedHrDayTypeForCards(null);
                if (previousViewForHrDetails === 'reviewHistory') {
                  setCurrentView('reviewHistory');
                  setPreviousViewForHrDetails(null);
                } else {
                  setCurrentView('heartRateAnalytics');
                }
              }}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid #282B34',
                background: '#DAE2EA',
                color: '#282B34',
                fontWeight: '600',
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.borderColor = '#FE5858';
                (e.target as HTMLElement).style.background = '#FE5858';
                (e.target as HTMLElement).style.color = '#F8FBFE';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.borderColor = '#282B34';
                (e.target as HTMLElement).style.background = '#DAE2EA';
                (e.target as HTMLElement).style.color = '#282B34';
              }}
            >
              Close
            </button>
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem'
          }}>
            <div style={{
              background: '#DAE2EA',
              padding: '1rem',
              borderRadius: '0.5rem',
              border: '1px solid #FE5858',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.875rem', color: '#282B34', marginBottom: '0.25rem', fontWeight: 'bold' }}>
                Average HR
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#FE5858' }}>
                {data.avgHRMean.toFixed(0)} BPM
              </div>
              <div style={{ fontSize: '0.75rem', color: avgHRColor }}>
                {data.avgHRTrend > 0 ? '↗' : data.avgHRTrend < 0 ? '↘' : '→'} 
                {Math.abs(data.avgHRTrend).toFixed(1)}/session
              </div>
            </div>
            
            <div style={{
              background: '#DAE2EA',
              padding: '1rem',
              borderRadius: '0.5rem',
              border: '1px solid #FE5858',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.875rem', color: '#282B34', marginBottom: '0.25rem', fontWeight: 'bold' }}>
                Peak HR
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#FE5858' }}>
                {data.peakHRMean.toFixed(0)} BPM
              </div>
            </div>
            
            <div style={{
              background: '#DAE2EA',
              padding: '1rem',
              borderRadius: '0.5rem',
              border: '1px solid #FE5858',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.875rem', color: '#282B34', marginBottom: '0.25rem', fontWeight: 'bold' }}>
                HR Efficiency
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#FE5858' }}>
                {data.efficiencyMean.toFixed(1)}
              </div>
              <div style={{ fontSize: '0.75rem', color: efficiencyColor }}>
                {data.efficiencyTrend > 0 ? '↗' : data.efficiencyTrend < 0 ? '↘' : '→'} 
                {Math.abs(data.efficiencyTrend).toFixed(1)}/session
              </div>
              <div style={{ fontSize: '0.625rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                (Pace/Baseline) ÷ Avg HR
              </div>
              <div style={{ fontSize: '0.625rem', color: '#9ca3af', marginTop: '0.125rem' }}>
                Higher = better efficiency
              </div>
            </div>
            
            <div style={{
              background: '#DAE2EA',
              padding: '1rem',
              borderRadius: '0.5rem',
              border: '1px solid #FE5858',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.875rem', color: '#282B34', marginBottom: '0.25rem', fontWeight: 'bold' }}>
                Training Load
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#FE5858' }}>
                {data.trainingLoadMean.toFixed(0)}
              </div>
              <div style={{ fontSize: '0.625rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                (Pace/Baseline) × Avg HR × Minutes
              </div>
              <div style={{ fontSize: '0.625rem', color: '#9ca3af', marginTop: '0.125rem' }}>
                {data.trainingLoadMean === 0 ? 'Requires duration data' : 'Higher = more stress'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render function for HR Session Details
  const renderHrSessionDetails = (): React.ReactElement => {
    const hrData = getHeartRateAnalyticsData();
    const baselines = getBaselinePaces();
    const sessions = hrData[selectedHrDayType]?.sessions || [];
    
    return (
      <div>
        <div style={{
              display: 'flex',
              alignItems: 'center',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
            {getWorkoutTypeDisplayName(selectedHrDayType)} Sessions
          </h2>
        </div>
        
        {sessions.length === 0 ? (
          <div style={{
            background: '#DAE2EA',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            padding: '3rem',
            textAlign: 'center',
            border: '1px solid #FE5858'
          }}>
            <p style={{ color: '#6b7280', fontSize: '1rem' }}>No sessions found for this day type.</p>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            {sessions.map((sess: any, index: number) => {
              const session = sess.session;
              const baseline = baselines[session.modality || 'unknown'];
                  const paceRatio = baseline && baseline > 0 && sess.pace !== null && sess.pace !== undefined ? sess.pace / baseline : 0;
              
              // Get duration
              let durationMinutes = 0;
              if (session.workout_data?.total_work_time) {
                durationMinutes = session.workout_data.total_work_time / 60;
              } else if (session.duration_minutes) {
                durationMinutes = session.duration_minutes;
              } else if (session.duration_seconds) {
                durationMinutes = session.duration_seconds / 60;
              }
              
              return (
                <div key={index} style={{
                  background: '#DAE2EA',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '1rem',
                  padding: '1.5rem',
                  border: '1px solid rgba(255, 255, 255, 0.3)'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '1rem',
                    marginBottom: '1rem'
                  }}>
                    <div style={{
                      background: '#DAE2EA',
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem', fontWeight: '500' }}>
                        Date
                      </div>
                      <div style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#111827' }}>
                        {new Date(session.date).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <div style={{
                      background: '#DAE2EA',
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem', fontWeight: '500' }}>
                        Pace
                      </div>
                      <div style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#111827' }}>
                        {sess.pace.toFixed(1)}
                      </div>
                    </div>
                    
                    <div style={{
                      background: '#DAE2EA',
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem', fontWeight: '500' }}>
                        Intensity
                      </div>
                      <div style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#111827' }}>
                        {(paceRatio * 100).toFixed(0)}%
                      </div>
                    </div>
                    
                    <div style={{
                      background: '#DAE2EA',
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem', fontWeight: '500' }}>
                        Avg HR
                      </div>
                      <div style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#111827' }}>
                        {sess.avgHR} BPM
                      </div>
                    </div>
                    
                    <div style={{
                      background: '#DAE2EA',
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem', fontWeight: '500' }}>
                        Duration
                      </div>
                      <div style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#111827' }}>
                        {durationMinutes.toFixed(1)} min
                      </div>
                    </div>
                    
                    <div style={{
                      background: '#DAE2EA',
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem', fontWeight: '500' }}>
                        Training Load
                      </div>
                      <div style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#2563eb' }}>
                        {sess.trainingLoad.toFixed(0)}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    marginTop: '1rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.3)'
                  }}>
                    <div style={{
                      background: '#DAE2EA',
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid rgba(255, 255, 255, 0.3)'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem', fontWeight: '500' }}>
                        Efficiency
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#059669' }}>
                        {sess.efficiency.toFixed(1)}
                      </div>
                    </div>
                    
                    <div style={{
                      background: '#DAE2EA',
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid rgba(255, 255, 255, 0.3)'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem', fontWeight: '500' }}>
                        Peak HR
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#dc2626' }}>
                        {sess.peakHR} BPM
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Render function for Work:Rest Ratio Performance
  const renderWorkRestRatio = (): React.ReactElement => {
    // Get available modalities
    const modalities = [...new Set(workoutSessions.map(s => s.modality).filter(Boolean))].sort();
    
    // Filter sessions by modality only (no day type filter)
    let filteredSessions = workoutSessions;
    if (analyticsModalityFilter) {
      filteredSessions = filteredSessions.filter((s: WorkoutSession) => s.modality === analyticsModalityFilter);
    }
    
    // Debug: Log session data
    console.log('🔍 Work:Rest Ratio Debug:', {
      totalSessions: filteredSessions.length,
      sessionsWithWorkoutData: filteredSessions.filter((s: WorkoutSession) => s.workout_data).length,
      sampleSession: filteredSessions.find(s => s.workout_data)?.workout_data
    });
    
    // Group sessions by work:rest ratio, filtering out continuous workouts
    const ratioGroups: Record<string, any[]> = {};
    let ratiosFound = 0;
    let ratiosFiltered = 0;
    filteredSessions.forEach((session: WorkoutSession) => {
      // Find the workout for this session if available
      const workout = workouts.find((w: Workout) => w.id === session.workout_id);
      const ratio = getWorkToRestRatio(session, workout);
      
      if (!ratio || ratio === 999) {
        ratiosFiltered++;
        return; // Filter out continuous workouts (999) and invalid ratios
      }
      ratiosFound++;
      const ratioKey = ratio.toFixed(2);
      if (!ratioGroups[ratioKey]) {
        ratioGroups[ratioKey] = [];
      }
      ratioGroups[ratioKey].push(session);
    });
    
    console.log('🔍 Work:Rest Ratio Calculation:', {
      ratiosFound,
      ratiosFiltered,
      ratioGroups: Object.keys(ratioGroups).length,
      ratioKeys: Object.keys(ratioGroups)
    });

    // Calculate stats for each ratio group
    const ratioStats = Object.entries(ratioGroups).map(([ratio, sessions]) => {
      const performanceRatios = sessions
        .map((s: WorkoutSession) => getPerformanceRatio(s))
        .filter((r: number | null): r is number => r !== null);
      
      return {
        ratio: parseFloat(ratio),
        displayRatio: ratio,
        count: sessions.length,
        avgPerformanceRatio: performanceRatios.length > 0 
          ? performanceRatios.reduce((a: number, b: number) => a + b, 0) / performanceRatios.length 
          : null,
        avgActualPace: sessions
          .filter((s: WorkoutSession) => s.actual_pace)
          .reduce((sum, s) => sum + s.actual_pace, 0) / sessions.filter((s: WorkoutSession) => s.actual_pace).length
      };
    }).sort((a: any, b: any) => {
      return b.ratio - a.ratio; // Sort highest to lowest
    });

    return (
      <div>
        {/* Filters */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          marginBottom: '1.5rem'
        }}>
            {/* Modality Filter */}
            <div style={{
              border: '1px solid #282B34',
              borderRadius: '0.75rem',
              background: '#FFFFFF',
              padding: '1rem'
            }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#282B34',
                marginBottom: '0.5rem',
                textAlign: 'center'
              }}>Select Modality</label>
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '1rem',
                flexWrap: 'wrap'
              }}>
          <button 
                  onClick={() => setAnalyticsModalityFilter('')}
            style={{
                    padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
                    border: '2px solid',
                    borderColor: analyticsModalityFilter === '' ? '#FE5858' : '#e5e7eb',
                    background: '#DAE2EA',
                    color: '#282B34',
                    fontWeight: '600',
                    fontSize: '0.875rem',
              cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                    (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                    (e.target as HTMLElement).style.borderColor = '#FE5858';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.transform = 'translateY(0)';
                    (e.target as HTMLElement).style.boxShadow = 'none';
                    (e.target as HTMLElement).style.borderColor = analyticsModalityFilter === '' ? '#FE5858' : '#e5e7eb';
                  }}
                >
                  <span>All Modalities</span>
                </button>
                {modalities.map(modality => {
                  const isSelected = analyticsModalityFilter === modality;
                  return (
                    <button
                      key={modality}
                      onClick={() => setAnalyticsModalityFilter(modality)}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        border: '2px solid',
                        borderColor: isSelected ? '#FE5858' : '#e5e7eb',
                        background: '#DAE2EA',
                        color: '#282B34',
              fontWeight: '600',
              fontSize: '0.875rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                        (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                        (e.target as HTMLElement).style.borderColor = '#FE5858';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.transform = 'translateY(0)';
                        (e.target as HTMLElement).style.boxShadow = 'none';
                        (e.target as HTMLElement).style.borderColor = isSelected ? '#FE5858' : '#e5e7eb';
            }}
          >
                      <span>{getModalityDisplayName(modality)}</span>
          </button>
                  );
                })}
              </div>
        </div>
        </div>

        {ratioStats.length === 0 ? (
          <div style={{
            background: '#DAE2EA',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            padding: '3rem',
            border: '1px solid #FE5858',
            textAlign: 'center'
          }}>
            <p style={{ color: '#6b7280', fontSize: '1.125rem' }}>No data available for work:rest ratio analysis.</p>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            {ratioStats.map((stat, idx) => {
              const maxPace = Math.max(...ratioStats.map(s => s.avgActualPace || 0));
              const barWidth = maxPace > 0 ? ((stat.avgActualPace || 0) / maxPace) * 100 : 0;
              
              return (
                <div key={idx} style={{
                  background: '#DAE2EA',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  border: '1px solid #FE5858'
                }}>
                  <div style={{
                    marginBottom: '0.75rem'
                  }}>
                    <div style={{
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: '#282B34',
                      textAlign: 'left'
                    }}>
                      {formatRatioForDisplay(stat.displayRatio)} Work:Rest ({stat.count})
                    </div>
                  </div>
                  
                  {/* Pace Bar */}
                  {stat.avgActualPace && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'end',
                      height: '3rem',
                      marginBottom: '0.5rem'
                    }}>
                      <div style={{
                        width: `${Math.max(barWidth, 10)}%`,
                        height: '100%',
                        background: 'linear-gradient(180deg, #FE5858 0%, #fe5858dd 100%)',
                        borderRadius: '0.25rem 0.25rem 0 0',
                        transition: 'width 0.3s ease',
                        position: 'relative',
                        minWidth: '2rem'
                      }}>
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          fontSize: '1.25rem',
                          fontWeight: 'bold',
                          color: '#F8FBFE',
                          whiteSpace: 'nowrap'
                        }}>
                          {stat.avgActualPace.toFixed(1)}
                        </div>
                      </div>
                      <div style={{
                        flex: 1,
                        height: '100%',
                        background: 'rgba(229, 231, 235, 0.3)',
                        borderRadius: '0 0.25rem 0.25rem 0'
                      }}></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderVariabilityTrend = (): React.ReactElement => {
    const availableDayTypes = getAvailableDayTypes().filter(dayType => {
      const continuousDayTypes = ['endurance', 'threshold', 'polarized', 'tempo', 'recovery', 'flux', 'flux_stages', 'time_trial'];
      return !continuousDayTypes.includes(dayType);
    });

    // Get all sessions with interval data
    const allSessionsWithIntervals = workoutSessions.filter((session: WorkoutSession) => {
      if (variabilityTrendDayType && session.day_type !== variabilityTrendDayType) return false;
      if (!session.workout_data?.intervals || !Array.isArray(session.workout_data.intervals) || session.workout_data.intervals.length === 0) return false;
      return true;
    });

    // Calculate CV for each session and sort by date
    const variabilityData = allSessionsWithIntervals
      .map((session: WorkoutSession) => {
        const cv = calculateCoefficientOfVariation(session.workout_data.intervals);
        return {
          date: session.date ? new Date(session.date) : new Date(0),
          programDayNumber: session.program_day_number || session.program_day,
          cv: cv,
          dayType: session.day_type
        };
      })
      .filter((d: any) => d.cv !== null)
      .sort((a: any, b: any) => a.date - b.date);

    // Calculate average CV for the selected day type (only if a specific day type is selected)
    const dayTypeAverage = variabilityTrendDayType && variabilityData.length > 0
      ? variabilityData.reduce((sum: number, d: any) => sum + (d.cv || 0), 0) / variabilityData.length
      : null;

    // Calculate averages per day type when "Compare Day Averages" is enabled
    const dayTypeAverages = showDayTypeAverages && !variabilityTrendDayType
      ? availableDayTypes.map((dayType: string) => {
          const dayTypeSessions = variabilityData.filter((d: any) => d.dayType === dayType);
          if (dayTypeSessions.length === 0) return null;
          const avg = dayTypeSessions.reduce((sum: number, d: any) => sum + (d.cv || 0), 0) / dayTypeSessions.length;
          return { dayType, average: avg, count: dayTypeSessions.length };
        }).filter(Boolean).sort((a: any, b: any) => b.average - a.average)
      : null;

    const maxCV = showDayTypeAverages && dayTypeAverages
      ? Math.max(...dayTypeAverages.map((d: any) => d?.average || 0).filter((a: number) => a !== null), 0)
      : Math.max(...variabilityData.map((d: any) => d.cv || 0).filter((cv: number | null) => cv !== null), dayTypeAverage || 0);

    return (
      <div style={{ marginBottom: '1.5rem' }}>
        {/* Filter */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '1rem',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          border: '1px solid #FE5858'
        }}>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#282B34',
            marginBottom: '0.5rem'
          }}>
            Day Type
          </label>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            {/* All Days button */}
            <button
              onClick={() => {
                setVariabilityTrendDayType('');
                setShowDayTypeAverages(false);
              }}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: `1px solid ${!variabilityTrendDayType ? '#FE5858' : '#282B34'}`,
                background: !variabilityTrendDayType ? '#FE5858' : '#F8FBFE',
                color: !variabilityTrendDayType ? '#F8FBFE' : '#282B34',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              All Days
            </button>
            {/* Day Type buttons */}
            {availableDayTypes.map((dayType: string) => {
              const isSelected = variabilityTrendDayType === dayType;
              return (
                <button
                  key={dayType}
                  onClick={() => {
                    setVariabilityTrendDayType(dayType);
                    setShowDayTypeAverages(false);
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    border: `1px solid ${isSelected ? '#FE5858' : '#282B34'}`,
                    background: isSelected ? '#FE5858' : '#F8FBFE',
                    color: isSelected ? '#F8FBFE' : '#282B34',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {getWorkoutTypeDisplayName(dayType)}
                </button>
              );
            })}
          </div>
          
          {/* Compare Day Averages Toggle */}
          {!variabilityTrendDayType && (
            <div style={{ marginTop: '1rem' }}>
              <button
                onClick={() => setShowDayTypeAverages(!showDayTypeAverages)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: `1px solid ${showDayTypeAverages ? '#FE5858' : '#282B34'}`,
                  background: showDayTypeAverages ? '#FE5858' : '#F8FBFE',
                  color: showDayTypeAverages ? '#F8FBFE' : '#282B34',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Compare Day Averages
              </button>
            </div>
          )}
        </div>

        {/* Chart */}
        {variabilityData.length > 0 ? (
          <div style={{
            background: '#F8FBFE',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: '1px solid #282B34',
            boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: '#282B34',
              marginBottom: '1.5rem'
            }}>
              Interval Variation
            </h3>

            {/* Day Type Averages View */}
            {showDayTypeAverages && dayTypeAverages ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                marginTop: '2rem'
              }}>
                {dayTypeAverages?.filter((d: any) => d !== null).map(({ dayType, average, count }: any) => {
                  const barHeight = maxCV > 0 ? (average / maxCV) * 100 : 0;
                  return (
                    <div 
                      key={dayType}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '0.5rem',
                        borderRadius: '0.5rem',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{
                        minWidth: '120px',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: '#282B34',
                        textAlign: 'right'
                      }}>
                        {getWorkoutTypeDisplayName(dayType)}
                      </div>
                      <div style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        position: 'relative'
                      }}>
                        <div style={{
                          width: `${barHeight}%`,
                          height: '2rem',
                          background: '#2563eb',
                          borderRadius: '0.375rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          paddingLeft: '0.5rem',
                          minWidth: barHeight > 0 ? '40px' : '0'
                        }}>
                          {barHeight > 15 && (
                            <span style={{
                              color: '#F8FBFE',
                              fontSize: '0.75rem',
                              fontWeight: '600'
                            }}>
                              {average.toFixed(1)}%
                            </span>
                          )}
                        </div>
                        {barHeight <= 15 && (
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: '#282B34',
                            marginLeft: '0.5rem'
                          }}>
                            {average.toFixed(1)}%
                          </span>
                        )}
                        <span style={{
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          marginLeft: '0.5rem'
                        }}>
                          ({count} sessions)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Individual days view */
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                marginTop: '2rem'
              }}>
                {/* Day Type Average - only show if a specific day type is selected */}
                {dayTypeAverage !== null && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  paddingBottom: '1rem',
                  borderBottom: '2px solid #282B34',
                  marginBottom: '0.5rem'
                }}>
                  <div style={{
                    minWidth: '120px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#282B34'
                  }}>
                    Day Type Average
                  </div>
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    position: 'relative'
                  }}>
                    <div style={{
                      width: `${maxCV > 0 ? (dayTypeAverage / maxCV) * 100 : 0}%`,
                      height: '2rem',
                      background: '#2563eb',
                      borderRadius: '0.375rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      paddingLeft: '0.5rem',
                      minWidth: maxCV > 0 && (dayTypeAverage / maxCV) * 100 > 0 ? '40px' : '0'
                    }}>
                      {maxCV > 0 && (dayTypeAverage / maxCV) * 100 > 15 && (
                        <span style={{
                          color: '#F8FBFE',
                          fontSize: '0.75rem',
                          fontWeight: '600'
                        }}>
                          {dayTypeAverage.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    {(!maxCV || (dayTypeAverage / maxCV) * 100 <= 15) && (
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        color: '#282B34',
                        marginLeft: '0.5rem'
                      }}>
                        {dayTypeAverage.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              )}
              {variabilityData.map((dataPoint: any, index: number) => {
                const barHeight = maxCV > 0 && dataPoint.cv !== null ? (dataPoint.cv / maxCV) * 100 : 0;
                
                return (
                  <div 
                    key={index} 
                    onClick={() => {
                      // Use the day type from the data point, or fall back to the selected filter
                      const dayType = dataPoint.dayType || variabilityTrendDayType;
                      if (dayType && dataPoint.programDayNumber) {
                        // Save the current view as previous before navigating
                        setPreviousView('variabilityTrend');
                        setIntervalResultsDayType(dayType);
                        setIntervalResultsDay(dataPoint.programDayNumber.toString());
                        setCurrentView('intervalResults');
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      cursor: 'pointer',
                      padding: '0.5rem',
                      borderRadius: '0.5rem',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{
                      minWidth: '120px',
                      fontSize: '0.875rem',
                      color: '#282B34'
                    }}>
                      {dataPoint.date.toLocaleDateString()}
                      {dataPoint.programDayNumber && (
                        <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>
                          (Day {dataPoint.programDayNumber})
                        </span>
                      )}
                    </div>
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      position: 'relative'
                    }}>
                      <div style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <div style={{
                          width: `${barHeight}%`,
                          height: '2rem',
                          background: '#FE5858',
                          borderRadius: '0.375rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          paddingLeft: '0.5rem',
                          minWidth: barHeight > 0 ? '40px' : '0'
                        }}>
                          {barHeight > 15 && (
                            <span style={{
                              color: '#F8FBFE',
                              fontSize: '0.75rem',
                              fontWeight: '600'
                            }}>
                              {dataPoint.cv !== null ? dataPoint.cv.toFixed(1) : '0.0'}%
                            </span>
                          )}
                        </div>
                        {barHeight <= 15 && (
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: '#282B34',
                            marginLeft: '0.5rem'
                          }}>
                            {dataPoint.cv.toFixed(1)}%
                          </span>
                        )}
                      </div>
                      {!variabilityTrendDayType && dataPoint.dayType && (
                        <span style={{
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          width: '120px',
                          textAlign: 'right',
                          flexShrink: 0
                        }}>
                          {getWorkoutTypeDisplayName(dataPoint.dayType)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </div>
        ) : (
          <div style={{
            background: '#F8FBFE',
            borderRadius: '1rem',
            padding: '2rem',
            textAlign: 'center',
            border: '1px solid #282B34',
            color: '#6b7280'
          }}>
            No interval data available for variability analysis.
          </div>
        )}
      </div>
    );
  };

  const renderVariabilityComparison = (): React.ReactElement => {
    const availableDayTypes = getAvailableDayTypes().filter(dayType => {
      const continuousDayTypes = ['endurance', 'threshold', 'polarized', 'tempo', 'recovery', 'flux', 'flux_stages', 'time_trial'];
      return !continuousDayTypes.includes(dayType);
    });

    // Get sessions with interval data grouped by day type
    const sessionsByDayType: Record<string, WorkoutSession[]> = {};
    workoutSessions.forEach((session: WorkoutSession) => {
      if (!session.workout_data?.intervals || !Array.isArray(session.workout_data.intervals) || session.workout_data.intervals.length === 0) return;
      const dayType = session.day_type || 'unknown';
      if (!sessionsByDayType[dayType]) {
        sessionsByDayType[dayType] = [];
      }
      sessionsByDayType[dayType].push(session);
    });

    // Calculate average CV for each selected day type
    const comparisonData = variabilityComparisonDayTypes.map((dayType: string) => {
      const sessions = sessionsByDayType[dayType] || [];
      const cvs = sessions
        .map((session: WorkoutSession) => calculateCoefficientOfVariation(session.workout_data.intervals))
        .filter((cv: number | null): cv is number => cv !== null);
      
      const avgCV = cvs.length > 0 
        ? cvs.reduce((sum: number, cv: number) => sum + cv, 0) / cvs.length 
        : null;
      
      return {
        dayType,
        avgCV,
        sessionCount: sessions.length
      };
    }).filter((d: any) => d.avgCV !== null);

    const maxCV = Math.max(...comparisonData.map((d: any) => d.avgCV || 0).filter((cv: number | null) => cv !== null), 0);

    return (
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            margin: 0,
            color: '#282B34'
          }}>
            Interval Variation
          </h2>
        </div>

        {/* Day Type Selection */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '1rem',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          border: '1px solid #FE5858'
        }}>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#282B34',
            marginBottom: '0.5rem'
          }}>
            Select Day Types to Compare (click to toggle)
          </label>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            {availableDayTypes.map((dayType: string) => {
              const isSelected = variabilityComparisonDayTypes.includes(dayType);
              return (
                <button
                  key={dayType}
                  onClick={() => {
                    if (isSelected) {
                      setVariabilityComparisonDayTypes(variabilityComparisonDayTypes.filter((dt: string) => dt !== dayType));
                    } else {
                      setVariabilityComparisonDayTypes([...variabilityComparisonDayTypes, dayType]);
                    }
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    border: `1px solid ${isSelected ? '#FE5858' : '#282B34'}`,
                    background: isSelected ? '#FE5858' : '#F8FBFE',
                    color: isSelected ? '#F8FBFE' : '#282B34',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {getWorkoutTypeDisplayName(dayType)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Comparison Chart */}
        {comparisonData.length > 0 ? (
          <div style={{
            background: '#F8FBFE',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: '1px solid #282B34',
            boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: '#282B34',
              marginBottom: '1rem'
            }}>
              Average Coefficient of Variation by Day Type
            </h3>
            <p style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              marginBottom: '1.5rem'
            }}>
              Lower values indicate more consistent performance across intervals.
            </p>

            {/* Bar Chart */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              marginTop: '2rem'
            }}>
              {comparisonData
                .sort((a: any, b: any) => a.avgCV - b.avgCV)
                .map((data: any, index: number) => {
                  const barWidth = maxCV > 0 && data.avgCV !== null ? (data.avgCV / maxCV) * 100 : 0;
                  
                  return (
                    <div key={data.dayType} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem'
                    }}>
                      <div style={{
                        minWidth: '150px',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: '#282B34'
                      }}>
                        {getWorkoutTypeDisplayName(data.dayType)}
                      </div>
                      <div style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <div style={{
                          width: `${barWidth}%`,
                          height: '2rem',
                          background: '#FE5858',
                          borderRadius: '0.375rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          paddingLeft: '0.5rem',
                          minWidth: barWidth > 0 ? '40px' : '0'
                        }}>
                          {barWidth > 15 && (
                            <span style={{
                              color: '#F8FBFE',
                              fontSize: '0.75rem',
                              fontWeight: '600'
                            }}>
                              {data.avgCV !== null ? data.avgCV.toFixed(1) : '0.0'}%
                            </span>
                          )}
                        </div>
                        {barWidth <= 15 && (
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: '#282B34',
                            marginLeft: '0.5rem'
                          }}>
                            {data.avgCV.toFixed(1)}%
                          </span>
                        )}
                        <span style={{
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          minWidth: '100px',
                          textAlign: 'right'
                        }}>
                          ({data.sessionCount} session{data.sessionCount !== 1 ? 's' : ''})
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : (
          <div style={{
            background: '#F8FBFE',
            borderRadius: '1rem',
            padding: '2rem',
            textAlign: 'center',
            border: '1px solid #282B34',
            color: '#6b7280'
          }}>
            {variabilityComparisonDayTypes.length === 0 
              ? 'Select day types to compare variability.'
              : 'No interval data available for selected day types.'}
          </div>
        )}
      </div>
    );
  };

  const renderIntervalResults = (): React.ReactElement => {
    const availableDayTypes = getAvailableDayTypes().filter(dayType => {
      // Only show day types that can have interval data (exclude continuous)
      const continuousDayTypes = ['endurance', 'threshold', 'polarized', 'tempo', 'recovery', 'flux', 'flux_stages', 'time_trial'];
      return !continuousDayTypes.includes(dayType);
    });

    // Get sessions with interval data for selected day type
    const sessionsWithIntervals = workoutSessions.filter((session: WorkoutSession) => {
      if (intervalResultsDayType && session.day_type !== intervalResultsDayType) return false;
      if (!session.workout_data?.intervals || !Array.isArray(session.workout_data.intervals) || session.workout_data.intervals.length === 0) return false;
      return true;
    });

    // Get unique days for selected day type
    const availableDays = [...new Set(sessionsWithIntervals.map(s => s.program_day_number).filter(Boolean))].sort((a: any, b: any) => a - b);

    // Get selected session
    const selectedSession = sessionsWithIntervals.find(s => 
      s.program_day_number === parseInt(intervalResultsDay) && s.day_type === intervalResultsDayType
    );

    return (
      <div style={{ marginBottom: '1.5rem' }}>
        {/* Filters */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '1rem',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          border: '1px solid #FE5858'
        }}>
          {/* Day Type Filter */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#282B34',
              marginBottom: '0.5rem'
            }}>
              Day Type
            </label>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              {availableDayTypes.map((dayType: string) => {
                const isSelected = intervalResultsDayType === dayType;
                return (
                  <button
                    key={dayType}
                    onClick={() => {
                      setIntervalResultsDayType(dayType);
                      setIntervalResultsDay(''); // Reset day selection
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '0.5rem',
                      border: `1px solid ${isSelected ? '#FE5858' : '#282B34'}`,
                      background: isSelected ? '#FE5858' : '#F8FBFE',
                      color: isSelected ? '#F8FBFE' : '#282B34',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {getWorkoutTypeDisplayName(dayType)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Day Filter */}
          {intervalResultsDayType && availableDays.length > 0 && (
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#282B34',
                marginBottom: '0.5rem'
              }}>
                Day
              </label>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}>
                {availableDays.map(day => {
                  const isSelected = intervalResultsDay === day.toString();
                  return (
                    <button
                      key={day}
                      onClick={() => setIntervalResultsDay(day.toString())}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '0.5rem',
                        border: `1px solid ${isSelected ? '#FE5858' : '#282B34'}`,
                        background: isSelected ? '#FE5858' : '#F8FBFE',
                        color: isSelected ? '#F8FBFE' : '#282B34',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      Day {day}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Chart */}
        {selectedSession && selectedSession.workout_data?.intervals && (
          <div style={{
            background: '#F8FBFE',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: '1px solid #282B34',
            boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: '#282B34',
              marginBottom: '1rem'
            }}>
              {getWorkoutTypeDisplayName(selectedSession.day_type)} - Day {selectedSession.program_day_number}
            </h3>
            <p style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              marginBottom: '1.5rem'
            }}>
              {new Date(selectedSession.date).toLocaleDateString()} • {selectedSession.modality ? getModalityDisplayName(selectedSession.modality) : 'Unknown Modality'}
            </p>

            {/* Bar Chart */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              {selectedSession.workout_data.intervals.map((interval: any, index: number) => {
                const maxOutput = Math.max(...selectedSession.workout_data.intervals.map((i: any) => i.output || 0));
                const barWidth = maxOutput > 0 ? ((interval.output || 0) / maxOutput) * 100 : 0;
                const units = selectedSession.units || '';

                return (
                  <div key={index} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                  }}>
                    <div style={{
                      minWidth: '80px',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: '#282B34'
                    }}>
                      {interval.block ? `B${interval.block}-R${interval.round}` : `Round ${interval.round}`}
                    </div>
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <div style={{
                        width: `${barWidth}%`,
                        height: '2rem',
                        background: '#FE5858',
                        borderRadius: '0.375rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        paddingLeft: '0.5rem',
                        minWidth: barWidth > 0 ? '40px' : '0'
                      }}>
                        {barWidth > 15 && (
                          <span style={{
                            color: '#F8FBFE',
                            fontSize: '0.75rem',
                            fontWeight: '600'
                          }}>
                            {interval.output?.toFixed(1)} {units}
                          </span>
                        )}
                      </div>
                      {barWidth <= 15 && (
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          color: '#282B34',
                          marginLeft: '0.5rem'
                        }}>
                          {interval.output?.toFixed(1)} {units}
                        </span>
                      )}
                      {interval.pace && (
                        <span style={{
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          minWidth: '80px',
                          textAlign: 'right'
                        }}>
                          {interval.pace.toFixed(1)} {units}/min
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!selectedSession && intervalResultsDayType && intervalResultsDay && (
          <div style={{
            background: '#F8FBFE',
            borderRadius: '1rem',
            padding: '2rem',
            textAlign: 'center',
            border: '1px solid #282B34',
            color: '#6b7280'
          }}>
            No interval data available for this selection.
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F8FBFE'
    }}>
      {/* Header */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', position: 'relative' }}>
            {currentView !== 'main' && (
            <button 
                onClick={() => {
                  // Handle navigation based on current view
                  if (currentView === 'intervalResults' && previousView) {
                    setCurrentView(previousView);
                    setPreviousView(null); // Clear previous view after using it
                  } else if (currentView === 'hrDayTypeDetails') {
                    // Go back to previous view (either reviewHistory or heartRateAnalytics)
                    if (previousViewForHrDetails === 'reviewHistory') {
                      setCurrentView('reviewHistory');
                      setPreviousViewForHrDetails(null);
                    } else {
                      setCurrentView('heartRateAnalytics');
                    }
                  } else if (currentView === 'hrSessionDetails') {
                    // Go back to HR Day Type Details if we came from there, otherwise to HR Analytics
                    if (selectedHrDayTypeForCards) {
                      setCurrentView('hrDayTypeDetails');
                    } else {
                      setCurrentView('heartRateAnalytics');
                    }
                  } else {
                    setCurrentView('main');
                  }
                }}
              style={{
                  background: '#FE5858',
                  color: '#F8FBFE',
                  border: '1px solid #282B34',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                  position: 'absolute',
                  left: 0
                }}
              >
                <ArrowLeft size={16} color="#F8FBFE" />
                Back
            </button>
            )}
            <div className="animate-fade-in" style={{ textAlign: 'center', flex: 1 }}>
              <h1 style={{
                fontSize: '1.875rem',
                fontWeight: 'bold',
                color: '#282B34',
                margin: 0
              }}>{getPageTitle()}</h1>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1.5rem' }}>
        {currentView === 'main' && renderMainMenu()}
        {currentView === 'reviewHistory' && renderReviewHistory()}
        {currentView === 'compareDayTypes' && renderCompareDayTypes()}
        {currentView === 'showTimeTrials' && renderShowTimeTrials()}
        {currentView === 'targetVsActual' && renderTargetVsActual()}
        {currentView === 'personalRecords' && renderPersonalRecords()}
        {currentView === 'heartRateAnalytics' && renderHeartRateAnalytics()}
        {currentView === 'hrDayTypeDetails' && renderHrDayTypeDetails()}
        {currentView === 'hrSessionDetails' && renderHrSessionDetails()}
        {currentView === 'workRestRatio' && renderWorkRestRatio()}
        {currentView === 'structureAnalysis' && renderStructureAnalysis()}
        {currentView === 'ratioComparison' && renderCompareDayTypes()}
        {currentView === 'intervalResults' && renderIntervalResults()}
        {currentView === 'variabilityTrend' && renderVariabilityTrend()}
        {currentView === 'variabilityComparison' && renderVariabilityComparison()}
      </div>
    </div>
  );
};

