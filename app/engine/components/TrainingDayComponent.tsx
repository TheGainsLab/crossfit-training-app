'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Timer,
  Zap,
  History,
  BarChart3,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import engineDatabaseService from '@/lib/engine/databaseService'

interface TrainingDayComponentProps {
  dayNumber: number
  onBack: () => void
  onBackToMonth?: () => void
}

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
}

interface SessionData {
  intervals: Interval[]
  totalOutput: number
  averagePace: number
  averageHeartRate: number | null
  peakHeartRate: number | null
  perceivedExertion: number | null
}

interface Baseline {
  baseline: number
  units: string
  date: string
}

interface PerformanceMetrics {
  rolling_avg_ratio?: number | null
  learned_max_pace?: number | null
}


export default function TrainingDayComponent({ dayNumber, onBack, onBackToMonth }: TrainingDayComponentProps) {
  // Workout data
  const [workout, setWorkout] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);
  
  // Time trial baselines
  const [baselines, setBaselines] = useState<Record<string, any>>({});
  const [selectedModality, setSelectedModality] = useState<string>('');
  const [expandedCategory, setExpandedCategory] = useState<string>(''); // Track which category's sub-menu is shown
  
  // Performance metrics (rolling_avg_ratio, learned_max_pace)
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);
  
  // Rocket Races B inheritance: track if Rocket Races A (from 3 days earlier) was completed
  const [rocketRacesACompleted, setRocketRacesACompleted] = useState<any>(null); // null = unknown, true = completed, false = not completed
  
  // Workout history for this day_type/modality
  const [workoutHistory, setWorkoutHistory] = useState<any[]>([]);
  
  // View state: 'equipment' | 'preview' | 'active'
  const [currentView, setCurrentView] = useState('preview');
  
  // Track if workout details are shown (stage 2 of preview)
  const [showWorkoutDetails, setShowWorkoutDetails] = useState<boolean>(false);
  
  // Collapsible sections state
  const [expandedBreakdown, setExpandedBreakdown] = useState<boolean>(false);
  const [expandedHistory, setExpandedHistory] = useState<boolean>(false);
  const [expandedSummary, setExpandedSummary] = useState<boolean>(false);

  // Workout execution
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [currentInterval, setCurrentInterval] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [currentPhase, setCurrentPhase] = useState('work'); // 'work' or 'rest'
  const [sessionData, setSessionData] = useState<SessionData>({
    intervals: [],
    totalOutput: 0,
    averagePace: 0,
    averageHeartRate: null,
    peakHeartRate: null,
    perceivedExertion: null
  });
  const [isWorkoutSaved, setIsWorkoutSaved] = useState<boolean>(false); // Track if workout has been logged
  const [rpeValue, setRpeValue] = useState<number>(5); // Track RPE slider value for display
  
  // Time Trial specific state (only used when workout?.day_type === 'time_trial')
  // Note: timeTrialTimeRemaining removed - time trials now use timeRemaining like other workouts
  const [timeTrialScore, setTimeTrialScore] = useState<string>('');
  const [timeTrialUnits, setTimeTrialUnits] = useState<string>('');
  const [timeTrialBaseline, setTimeTrialBaseline] = useState<any>(null);
  const [timeTrialIsSubmitting, setTimeTrialIsSubmitting] = useState<boolean>(false);
  const [timeTrialSaveSuccess, setTimeTrialSaveSuccess] = useState<boolean>(false);
  const [timeTrialAverageHeartRate, setTimeTrialAverageHeartRate] = useState<string>('');
  const [timeTrialPeakHeartRate, setTimeTrialPeakHeartRate] = useState<string>('');
  const [timeTrialRpeValue, setTimeTrialRpeValue] = useState<number>(5);
  const [timeTrialUnitPreferences, setTimeTrialUnitPreferences] = useState<Record<string, any>>({});
  const [timeTrialSelectedUnit, setTimeTrialSelectedUnit] = useState<string>('');
  const [timeTrialShowUnitSelection, setTimeTrialShowUnitSelection] = useState<boolean>(false);
  const [timeTrialLoadingPreference, setTimeTrialLoadingPreference] = useState<boolean>(false);
  
  // Database connection state
  const [connected, setConnected] = useState<boolean>(false);
  
  // Burst tracking state (for polarized days)
  const [currentBurstStatus, setCurrentBurstStatus] = useState<any>(null); // { isActive: boolean, nextBurstIn: number (seconds), elapsedTime: number }
  
  // Flux tracking state (for flux days)
  const [currentFluxStatus, setCurrentFluxStatus] = useState<any>(null); // { isActive: boolean, currentIntensity: number, timeRemainingInFlux: number, nextFluxIn: number }
  
  // Timer ref
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  // Refs for accessing current state in timer callback
  const currentPhaseRef = useRef<string>('work');
  const currentIntervalRef = useRef<number>(0);
  const sessionDataRef = useRef<SessionData>({
    intervals: [] as Interval[],
    totalOutput: 0,
    averagePace: 0,
    averageHeartRate: null,
    peakHeartRate: null,
    perceivedExertion: null
  });
  const workoutStartTimeRef = useRef<number | null>(null); // Track when workout started for burst timing
  const fluxStartTimeRef = useRef<number | null>(null); // Track when flux period started (for flux days)
  
  // Available modalities (same as TimeTrialComponent)
  const modalities = [
    { value: 'c2_row_erg', label: 'C2 Rowing Erg', category: 'Rowing' },
    { value: 'rogue_row_erg', label: 'Rogue Rowing Erg', category: 'Rowing' },
    { value: 'c2_bike_erg', label: 'C2 Bike Erg', category: 'Cycling' },
    { value: 'echo_bike', label: 'Echo Bike', category: 'Cycling' },
    { value: 'assault_bike', label: 'Assault Bike', category: 'Cycling' },
    { value: 'airdyne_bike', label: 'AirDyne Bike', category: 'Cycling' },
    { value: 'other_bike', label: 'Other Bike', category: 'Cycling' },
    { value: 'outdoor_bike_ride', label: 'Outdoor Bike Ride', category: 'Cycling' },
    { value: 'c2_ski_erg', label: 'C2 Ski Erg', category: 'Ski' },
    { value: 'assault_runner', label: 'Assault Runner Treadmill', category: 'Treadmill' },
    { value: 'trueform_treadmill', label: 'TrueForm Treadmill', category: 'Treadmill' },
    { value: 'motorized_treadmill', label: 'Motorized Treadmill', category: 'Treadmill' },
    { value: 'outdoor_run', label: 'Outdoor Run', category: 'Running' },
    { value: 'road_run', label: 'Road Run', category: 'Running' },
    { value: 'track_run', label: 'Track Run', category: 'Running' },
    { value: 'trail_run', label: 'Trail Run', category: 'Running' },
    { value: 'trueform', label: 'True Form', category: 'Running' },
    { value: 'assault_runner_run', label: 'Assault Runner', category: 'Running' },
    { value: 'other_treadmill', label: 'Other Treadmill', category: 'Running' }
  ];

  // Available units for time trials
  const scoreUnits = [
    { value: 'cal', label: 'Calories' },
    { value: 'meters', label: 'Meters' },
    { value: 'kilometers', label: 'Kilometers' },
    { value: 'watts', label: 'Watts' },
    { value: 'miles', label: 'Miles' }
  ];

  useEffect(() => {
    if (dayNumber) {
      loadWorkoutData();
    }
  }, [dayNumber]);

  // Set initial view to 'equipment' for time trials (matching TimeTrialComponent behavior)
  useEffect(() => {
    if (workout?.day_type === 'time_trial') {
      setCurrentView('equipment');
    }
  }, [workout?.day_type]);

  // Load baseline when modality changes
  useEffect(() => {
    // Only run if component is actually mounted with a valid dayNumber
    if (!dayNumber || !selectedModality) return;
      loadBaselineForModality();
  }, [dayNumber, selectedModality]);

  // Load unit preference when modality is selected for time trials
  useEffect(() => {
    if (!selectedModality || workout?.day_type !== 'time_trial') return;
    
    const loadPreference = async () => {
      setTimeTrialShowUnitSelection(true);
      
      if (!connected) {
        setTimeTrialSelectedUnit('');
        return;
      }
      
      setTimeTrialLoadingPreference(true);
      try {
        const preference = await engineDatabaseService.loadUnitPreferenceForModality(selectedModality);
        if (preference) {
          setTimeTrialSelectedUnit(preference);
        } else {
          setTimeTrialSelectedUnit('');
        }
      } catch (error) {
        console.error('Error loading unit preference:', error);
        setTimeTrialSelectedUnit('');
      } finally {
        setTimeTrialLoadingPreference(false);
      }
    };
    
    loadPreference();
  }, [selectedModality, connected, workout?.day_type]);

  // Clear stored target paces when modality changes to prevent cross-modality contamination
  useEffect(() => {
    if (!dayNumber) return;
    
    // Clear stored target paces when modality changes
    setSessionData(prev => ({
      ...prev,
      intervals: prev.intervals.map((interval: any) => ({
        ...interval,
        targetPace: null // Clear stored pace when modality changes
      }))
    }));
  }, [selectedModality]);

  // Load performance metrics and workout history when modality and workout are available
  useEffect(() => {
    // Only run if component is actually mounted with a valid dayNumber
    if (!dayNumber) return;
    
    // Check connection directly - same pattern as loadWorkoutData
    const isActuallyConnected = engineDatabaseService.isConnected();
    
    
    if (selectedModality && workout?.day_type && isActuallyConnected) {
      loadPerformanceMetrics();
      loadWorkoutHistory();
    } else {
    }
  }, [dayNumber, selectedModality, workout?.day_type, connected]);

  // Auto-recalculate target paces when baseline or performance metrics change
  useEffect(() => {
    // Only run if component is actually mounted with a valid dayNumber
    if (!dayNumber) return;
    
    if (selectedModality && baselines[selectedModality] && (performanceMetrics !== null || !connected)) {
      recalculateTargetPaces();
    } else if (!selectedModality || !baselines[selectedModality]) {
    }
  }, [dayNumber, selectedModality, baselines, performanceMetrics, connected]);

  // Transition from equipment to preview - now manual via "Next" button
  // User clicks "Next" button manually after reviewing equipment and history
  // Removed automatic transition to give users control
  // useEffect(() => {
  //   if (currentView === 'equipment' && selectedModality && baselines[selectedModality]) {
  //     setCurrentView('preview');
  //   }
  // }, [selectedModality, baselines, currentView]);

  // Check connection status
  useEffect(() => {
    // Only run if component is actually mounted with a valid dayNumber
    if (!dayNumber) return;
    
    const isConnected = engineDatabaseService.isConnected();
    setConnected(isConnected);
    
    // Check connection periodically (engineDatabaseService doesn't have subscribe)
    const checkInterval = setInterval(() => {
      const newConnected = engineDatabaseService.isConnected();
      setConnected(prev => {
        if (prev !== newConnected) {
          return newConnected;
        }
        return prev;
      });
    }, 1000);
    
    return () => clearInterval(checkInterval);
  }, [dayNumber]);

  // Keep refs in sync with state
  useEffect(() => {
    currentPhaseRef.current = currentPhase;
  }, [currentPhase]);

  useEffect(() => {
    currentIntervalRef.current = currentInterval;
  }, [currentInterval]);

  useEffect(() => {
    sessionDataRef.current = sessionData;
  }, [sessionData]);

  // Calculate burst times for polarized workouts (defined early for use in timer)
  const calculateBurstTimes = (burstTiming: string | null, totalDuration: number, burstDuration: number): Array<{ start: number; end: number }> => {
    if (!burstTiming || !totalDuration) return [];
    
    // Parse interval from burstTiming (e.g., "every_5_minutes" -> 5)
    const timingMap: Record<string, number> = {
      'every_5_minutes': 5,
      'every_7_minutes': 7,
      'every_10_minutes': 10,
      'every_15_minutes': 15
    };
    
    const intervalMinutes = timingMap[burstTiming] || 7;
    const intervalSeconds = intervalMinutes * 60;
    
    const burstTimes = [];
    let currentTime = intervalSeconds; // First burst at intervalSeconds
    
    while (currentTime <= totalDuration) {
      burstTimes.push({
        start: currentTime,
        end: Math.min(currentTime + burstDuration, totalDuration)
      });
      currentTime += intervalSeconds;
    }
    
    return burstTimes;
  };

  // Get current burst status for polarized workouts (defined early for use in timer)
  const getBurstStatus = (interval: Interval, elapsedTime: number): any => {
    if (!interval || !interval.burstTiming || !interval.burstDuration) {
      return null;
    }
    
    const totalDuration = interval.duration;
    const burstTimes = calculateBurstTimes(interval.burstTiming, totalDuration, interval.burstDuration);
    
    // Find if currently in a burst
    const activeBurst = burstTimes.find(bt => elapsedTime >= bt.start && elapsedTime < bt.end);
    
    if (activeBurst) {
      return {
        isActive: true,
        timeRemainingInBurst: Math.ceil(activeBurst.end - elapsedTime),
        nextBurstIn: null
      };
    }
    
    // Find next burst
    const nextBurst = burstTimes.find(bt => elapsedTime < bt.start);
    
    if (nextBurst) {
      return {
        isActive: false,
        timeRemainingInBurst: null,
        nextBurstIn: Math.ceil(nextBurst.start - elapsedTime)
      };
    }
    
    // No more bursts remaining
    return {
      isActive: false,
      timeRemainingInBurst: null,
      nextBurstIn: null
    };
  };

  // Calculate flux periods for flux workouts
  const calculateFluxPeriods = (baseDuration: number, fluxDuration: number, totalDuration: number): any[] => {
    if (!baseDuration || !fluxDuration || !totalDuration) return [];
    
    const periods = [];
    let currentTime = 0;
    let periodIndex = 0;
    
    // Pattern: Base -> Flux -> Base -> Flux -> ...
    while (currentTime < totalDuration) {
      const isBase = periodIndex % 2 === 0;
      const periodDuration = isBase ? baseDuration : fluxDuration;
      const periodEnd = Math.min(currentTime + periodDuration, totalDuration);
      
      periods.push({
        start: currentTime,
        end: periodEnd,
        type: isBase ? 'base' : 'flux',
        index: Math.floor(periodIndex / 2) // Flux period index (0, 1, 2, ...)
      });
      
      currentTime = periodEnd;
      periodIndex++;
    }
    
    return periods;
  };

  // Get current flux status for flux workouts
  const getFluxStatus = (interval: Interval, elapsedTime: number): any => {
    if (!interval || !interval.fluxDuration || !interval.baseDuration) {
      return null;
    }
    
    const totalDuration = interval.duration;
    const fluxPeriods = calculateFluxPeriods(interval.baseDuration, interval.fluxDuration, totalDuration);
    
    // Find current period
    const currentPeriod = fluxPeriods.find(p => elapsedTime >= p.start && elapsedTime < p.end);
    
    if (currentPeriod) {
      const timeRemainingInPeriod = Math.ceil(currentPeriod.end - elapsedTime);
      
      if (currentPeriod.type === 'flux') {
        // In flux period - calculate current intensity
        const fluxStartIntensity = interval.fluxStartIntensity || 0.75;
        const fluxIncrement = interval.fluxIncrement || 0.05;
        // Use fixed fluxIntensity if available, otherwise calculate progressively
        const currentIntensity = interval.fluxIntensity !== null && interval.fluxIntensity !== undefined
          ? interval.fluxIntensity
          : fluxStartIntensity + (currentPeriod.index * fluxIncrement);
        
        return {
          isActive: true,
          currentIntensity: currentIntensity,
          timeRemainingInFlux: timeRemainingInPeriod,
          nextFluxIn: null
        };
      } else {
        // In base period - find next flux
        const nextFluxPeriod = fluxPeriods.find(p => p.type === 'flux' && p.start > elapsedTime);
        
        if (nextFluxPeriod) {
          return {
            isActive: false,
            currentIntensity: null,
            timeRemainingInFlux: null,
            nextFluxIn: Math.ceil(nextFluxPeriod.start - elapsedTime)
          };
        }
      }
    }
    
    // No more flux periods remaining
    return {
      isActive: false,
      currentIntensity: null,
      timeRemainingInFlux: null,
      nextFluxIn: null
    };
  };

  // Timer effect for workout intervals
  useEffect(() => {
    if (isActive && timeRemaining > 0) {
      // Initialize workout start time for burst tracking
      if (workoutStartTimeRef.current === null && currentPhase === 'work') {
        workoutStartTimeRef.current = Date.now();
      }
      
      intervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          const newTime = prev - 1;
          
          // Update burst status for polarized days
          const currentInt = sessionDataRef.current.intervals[currentIntervalRef.current];
          if (currentInt && currentInt.burstTiming && workoutStartTimeRef.current) {
            const totalDuration = currentInt.duration;
            const elapsedTime = totalDuration - newTime;
            const burstStatus = getBurstStatus(currentInt, elapsedTime);
            setCurrentBurstStatus(burstStatus);
          }
          
          // Update flux status for flux days
          if (currentInt && currentInt.fluxDuration && currentInt.baseDuration) {
            const totalDuration = currentInt.duration;
            const elapsedTime = totalDuration - newTime;
            const fluxStatus = getFluxStatus(currentInt, elapsedTime);
            setCurrentFluxStatus(fluxStatus);
          }
          
          if (newTime === 0) {
            // Time segment completed - handle phase transition
            handlePhaseCompletion();
          }
          
          return newTime;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, timeRemaining, currentPhase, currentInterval]);

  // Handle completion of work or rest phase
  const handlePhaseCompletion = (): void => {
    // For time trials, just mark as completed when timer reaches 0
    if (workout?.day_type === 'time_trial') {
      setIsActive(false);
      setIsCompleted(true);
      return;
    }
    
    // Use refs to get latest values in timer callback
    const phase = currentPhaseRef.current;
    const intervalIndex = currentIntervalRef.current;
    const data = sessionDataRef.current;
    const currentInt = data.intervals[intervalIndex];
    
    if (phase === 'work') {
      // Work phase completed - switch to rest phase if rest duration exists
      if (currentInt && currentInt.restDuration && currentInt.restDuration > 0) {
        setCurrentPhase('rest');
        setTimeRemaining(currentInt.restDuration);
        // Mark work as completed
        completeWorkPhase();
      } else {
        // No rest period - move to next interval's work phase
        completeCurrentInterval();
      }
    } else {
      // Rest phase completed - move to next interval's work phase
      completeCurrentInterval();
    }
  };

  // Time Trial timer removed - time trials now use the regular timer effect above
  // They are treated as single-interval workouts (like threshold/endurance days)

  // Auto-calculate Time Trial baseline when score and units are entered
  useEffect(() => {
    if (workout?.day_type !== 'time_trial') return;
    
    if (isCompleted && timeTrialScore && timeTrialUnits) {
      const scoreValue = parseFloat(timeTrialScore);
      if (!isNaN(scoreValue) && scoreValue > 0) {
        const unitsPerMinute = scoreValue / 10;
        setTimeTrialBaseline(unitsPerMinute);
      }
    } else if (!isCompleted || !timeTrialScore || !timeTrialUnits) {
      setTimeTrialBaseline(null);
    }
  }, [isCompleted, timeTrialScore, timeTrialUnits, workout?.day_type]);

  const loadWorkoutData = async () => {
    setLoading(true);
    setError(null);
    
    const isActuallyConnected = engineDatabaseService.isConnected();
    
    try {
      if (isActuallyConnected) {
        const workoutData = await engineDatabaseService.loadWorkoutForDay(dayNumber);
        if (workoutData) {
          setWorkout(workoutData);
          initializeWorkout(workoutData);
        } else {
          console.warn('⚠️ No workout found for day:', dayNumber);
          setError('No workout found for this day');
        }
      } else {
        console.warn('⚠️ NOT CONNECTED - using demo data');
        // Demo mode - create sample workout data
        const demoWorkout = createDemoWorkout(dayNumber);
        setWorkout(demoWorkout);
        initializeWorkout(demoWorkout);
      }
    } catch (err) {
      console.error('❌ Error loading workout:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const createDemoWorkout = (dayNum: number): any => {
    const workoutTypes = ['EMOM', 'AMRAP', 'Conditioning'];
    const type = workoutTypes[dayNum % 3];
    
    return {
      id: dayNum,
      day_number: dayNum,
      workout_type: type,
      duration: 15 + (dayNum % 10),
      description: `${type} workout for Day ${dayNum}`,
      created_at: new Date().toISOString()
    };
  };

  const loadBaselineForModality = async () => {
    if (!selectedModality) return;
    
    // Check connection directly - same pattern as loadWorkoutData
    const isActuallyConnected = engineDatabaseService.isConnected();
    if (isActuallyConnected) {
      try {
        const baseline = await engineDatabaseService.loadTimeTrialBaselines(selectedModality);
        if (baseline && baseline.calculated_rpm) {
          setBaselines(prev => ({
            ...prev,
            [selectedModality]: {
              baseline: baseline.calculated_rpm,
              units: baseline.units,
              date: baseline.date
            }
          }));
    } else {
          console.warn('⚠️ Baseline is null or missing calculated_rpm');
      }
    } catch (error) {
        console.error('❌ Failed to load baseline:', error);
      }
      } else {
      console.warn('⚠️ Not connected - cannot load baseline');
    }
  };

  const createDemoBaseline = (modality: string): any => {
    const baselineValues: Record<string, { baseline: number; units: string }> = {
      'c2_row_erg': { baseline: 45.5, units: 'cal' },
      'echo_bike': { baseline: 38.2, units: 'cal' },
      'assault_bike': { baseline: 42.1, units: 'cal' },
      'c2_bike_erg': { baseline: 35.8, units: 'watts' },
      'c2_ski_erg': { baseline: 28.5, units: 'cal' },
      'outdoor_run': { baseline: 6.2, units: 'mph' },
      'motorized_treadmill': { baseline: 6.5, units: 'mph' }
    };
    
    const values = baselineValues[modality] || { baseline: 40.0, units: 'cal' };
    
    return {
      baseline: values.baseline,
      units: values.units,
      date: new Date().toISOString().split('T')[0]
    };
  };

  // Load performance metrics for this day_type and modality
  const loadPerformanceMetrics = async () => {
    // Check connection directly - same pattern as loadWorkoutData
    const isActuallyConnected = engineDatabaseService.isConnected();
    
    
    if (!isActuallyConnected || !selectedModality || !workout?.day_type) {
      return;
    }
    
    try {
      const userId = engineDatabaseService.getUserId();
      if (!userId) {
        console.warn('No user ID available for loading performance metrics');
        return;
      }
      
      // Special handling for Rocket Races B: inherit from Rocket Races A (3 days earlier)
      if (workout.day_type === 'rocket_races_b') {
        // Load program version to ensure we query correctly
        let programVersion = await engineDatabaseService.loadProgramVersion();
        if (!programVersion) {
          programVersion = '5-day';
        }
        
        // Get current program_day_number for Rocket Races B
        // This ensures we're working with the correct day number for the user's program version
        let currentProgramDayNumber = dayNumber;
        if (programVersion === '3-day') {
          const programDayNum = await engineDatabaseService.getProgramDayNumber(dayNumber, programVersion);
          if (programDayNum !== null) {
            currentProgramDayNumber = programDayNum;
          }
        }
        
        // Calculate Rocket Races A program_day_number (3 days earlier in the program)
        const rocketRacesAProgramDayNumber = currentProgramDayNumber - 3;
        
        if (rocketRacesAProgramDayNumber < 1) {
          setRocketRacesACompleted(false);
          setPerformanceMetrics(null);
          return;
        }
        
        
        // Check if Rocket Races A was completed
        const rocketRacesASession = await engineDatabaseService.getWorkoutSessionByDay(
          rocketRacesAProgramDayNumber,
          'rocket_races_a',
          programVersion
        );
        
        if (rocketRacesASession) {
          setRocketRacesACompleted(true);
          
          // Load performance metrics for Rocket Races A (not B)
          const metrics = await engineDatabaseService.getPerformanceMetrics(
            userId,
            'rocket_races_a',
            selectedModality
          );
          
          if (metrics) {
            setPerformanceMetrics(metrics);
          } else {
            // Fallback: use actual_pace from the completed session
            if (rocketRacesASession.actual_pace) {
              setPerformanceMetrics({
                learned_max_pace: rocketRacesASession.actual_pace,
                rolling_avg_ratio: null
              });
            } else {
              setPerformanceMetrics(null);
            }
          }
        } else {
          setRocketRacesACompleted(false);
          setPerformanceMetrics(null);
        }
        
        return; // Exit early for Rocket Races B
      }
      
      // Standard loading for all other day types
      
      const metrics = await engineDatabaseService.getPerformanceMetrics(
        userId,
        workout.day_type,
        selectedModality
      );
      
      if (metrics) {
        setPerformanceMetrics(metrics);
      } else {
        setPerformanceMetrics(null);
      }
    } catch (error) {
      console.error('Error loading performance metrics:', error);
      setPerformanceMetrics(null);
      if (workout?.day_type === 'rocket_races_b') {
        setRocketRacesACompleted(false);
      }
    }
  };

  // Load workout history for this day_type and modality
  const loadWorkoutHistory = async () => {
    // Check connection directly - same pattern as loadWorkoutData
    const isActuallyConnected = engineDatabaseService.isConnected();
    if (!isActuallyConnected || !selectedModality || !workout?.day_type) {
      return;
    }
    
    
    try {
      const userId = engineDatabaseService.getUserId();
      if (!userId) {
        console.warn('No user ID available for loading workout history');
        return;
      }
      
      // For time trials, load from time_trials table and convert to session format
      if (workout.day_type === 'time_trial') {
        const allSessions = await engineDatabaseService.loadCompletedSessions();
        const timeTrials = await engineDatabaseService.loadTimeTrials();
        
        // Convert time trials to session format
        const convertedTrials = (timeTrials || []).map((trial: any) => ({
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
          program_version: trial.program_version
        }));
        
        // Combine sessions and time trials
        const allData = [...(allSessions || []), ...convertedTrials];
        
        // Filter sessions by modality and day_type = 'time_trial'
        const filteredSessions = allData.filter((session: any) => {
          const sessionModality = session.modality;
          const sessionDayType = session.day_type;
          const modalityMatch = sessionModality === selectedModality;
          const dayTypeMatch = sessionDayType === 'time_trial';
          return modalityMatch && dayTypeMatch;
        });
        
        // Sort by date (most recent first)
        const sortedSessions = filteredSessions.sort((a: any, b: any) => {
          const dateA = new Date(a.date || a.created_at || 0);
          const dateB = new Date(b.date || b.created_at || 0);
          return dateB.getTime() - dateA.getTime();
        });
        
        setWorkoutHistory(sortedSessions);
      } else {
        // For regular workouts, use existing logic
      const allSessions = await engineDatabaseService.loadCompletedSessions();
      // Filter sessions by modality and day_type
      const filteredSessions = (allSessions || []).filter((session: any) => {
        const sessionModality = session.modality;
        const sessionDayType = session.day_type;
        const workoutDataDayType = workout.day_type;
        
        const modalityMatch = sessionModality === selectedModality;
        const dayTypeMatch = sessionDayType === workoutDataDayType;
        
        
        return modalityMatch && dayTypeMatch;
      });
      
      // Sort by date (most recent first)
      const sortedSessions = filteredSessions.sort((a: any, b: any) => {
        const dateA = new Date(a.date || a.created_at || 0);
        const dateB = new Date(b.date || b.created_at || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      setWorkoutHistory(sortedSessions);
      }
    } catch (error) {
      console.error('Error loading workout history:', error);
      setWorkoutHistory([]);
    }
  };

  const initializeWorkout = (workoutData: any): void => {
    const intervals = parseWorkoutIntervals(workoutData);
    setSessionData(prev => ({
      ...prev,
      intervals: intervals.map((interval: any) => ({
        ...interval,
        targetPace: null, // Will be calculated after baseline/metrics load
        actualOutput: 0,
        completed: false
      }))
    }));
    
    if (intervals.length > 0) {
      setTimeRemaining(intervals[0].duration);
    }
  };

  // Recalculate target paces for all intervals
  const recalculateTargetPaces = (): void => {
    setSessionData(prev => ({
      ...prev,
      intervals: prev.intervals.map((interval: any) => ({
        ...interval,
        targetPace: calculateTargetPaceWithData(interval)
      }))
    }));
  };

  // Get workout progress percentage for donut chart
  const getWorkoutProgressPercentage = (): number => {
    if (sessionData.intervals.length === 0) return 0;
    const completed = sessionData.intervals.filter((i: any) => i.completed).length;
    return Math.round((completed / sessionData.intervals.length) * 100);
  };

  // Get color for progress donut based on percentage
  const getProgressColor = (percentage: number): string => {
    if (percentage >= 100) return '#3b82f6'; // Blue - complete
    if (percentage >= 75) return '#22c55e';  // Green
    if (percentage >= 50) return '#eab308'; // Yellow
    if (percentage >= 25) return '#f59e0b'; // Orange
    return '#ef4444'; // Red - just starting
  };

  // Helper function to get workout type display name (matches Dashboard)
  const getWorkoutTypeDisplayName = (dayType: string): string => {
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
    return typeMap[dayType] || dayType?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Workout';
  };

  // Helper function to get workout type color (matches Dashboard)
  const getWorkoutTypeColor = (dayType: string): string => {
    // All workout types now use Coral color to match Dashboard
    return '#FE5858';
  };

  // Check if workout type needs inheritance (e.g., rocket_races_b inherits from rocket_races_a)
  const workoutNeedsInheritance = (dayType: string): boolean => {
    return dayType === 'rocket_races_b';
  };

  // Parse workout intervals from all blocks
  const parseWorkoutIntervals = (workoutData: any): Interval[] => {
    if (!workoutData || !workoutData.day_type) {
      return [{
        id: 1,
        type: 'Workout',
        duration: (workoutData?.duration || 20) * 60,
        targetPace: null,
        description: workoutData?.description || 'Workout',
        blockNumber: null,
        roundNumber: null
      }];
    }

    const dayType = workoutData.day_type;
    const intervals = [];
    let intervalId = 1;
    
    // Process all blocks (block_1, block_2, block_3, block_4)
    const blocks = [
      { params: workoutData.block_1_params, number: 1 },
      { params: workoutData.block_2_params, number: 2 },
      { params: workoutData.block_3_params, number: 3 },
      { params: workoutData.block_4_params, number: 4 }
    ].filter((block: any) => block.params && Object.keys(block.params).length > 0);

    blocks.forEach((block, blockIndex) => {
      const blockParams = block.params;
      const blockNumber = block.number;
      
      const workDuration = blockParams.workDuration || 60;
      const restDuration = blockParams.restDuration || 0;
      const rounds = blockParams.rounds || 1;
      const paceRange = blockParams.paceRange || null;
      const paceProgression = blockParams.paceProgression || null;

      // Check if block has valid duration data
      const hasValidDuration = workDuration > 0;

      // Special handling for different day types
      if (dayType === 'endurance' || dayType === 'time_trial') {
        // Single continuous interval
        intervals.push({
          id: intervalId++,
          type: dayType,
          duration: workDuration,
          restDuration: 0,
          targetPace: null,
          description: getWorkoutTypeDisplayName(dayType),
          blockNumber: blockNumber,
          roundNumber: 1,
          paceRange: paceRange,
          isMaxEffort: dayType === 'time_trial' || dayType === 'anaerobic' || blockParams.isMaxEffort
        });
      } else if (dayType === 'towers' || dayType === 'towers_block_1') {
        // Towers: different parsing per block
        const workProgression = blockParams.workProgression || 'consistent';
        const paceProgression = blockParams.paceProgression || null;
        
        if (blockNumber === 1) {
          // Block 1: Continuous work with increasing pace, no rest
          // workProgression: "continuous", rounds: 4, restDuration: 0
          const basePace = paceRange && Array.isArray(paceRange) ? paceRange[0] : 0.75;
          const maxPace = paceRange && Array.isArray(paceRange) ? paceRange[1] : 0.9;
          
          for (let i = 0; i < rounds; i++) {
            // Calculate pace progression if specified
            let currentPaceRange = paceRange;
            if (paceProgression === 'increasing' && rounds > 1) {
              const progress = i / (rounds - 1);
              const currentPaceMultiplier = basePace + (maxPace - basePace) * progress;
              currentPaceRange = [currentPaceMultiplier, currentPaceMultiplier];
            }
            
        intervals.push({
          id: intervalId++,
            type: dayType,
              duration: workDuration,
              restDuration: 0, // Block 1 has no rest
          targetPace: null,
              description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
            blockNumber: blockNumber,
              roundNumber: i + 1,
              paceRange: currentPaceRange,
              paceProgression: paceProgression === 'increasing' ? 'increasing' : null,
              workProgression: workProgression
            });
          }
        } else if (blockNumber === 2) {
          // Block 2: Single continuous interval
          // workProgression: "single", rounds: 1, restDuration: 0
          intervals.push({
            id: intervalId++,
            type: dayType,
            duration: workDuration,
            restDuration: 0,
            targetPace: null,
            description: getWorkoutTypeDisplayName(dayType),
            blockNumber: blockNumber,
            roundNumber: 1,
            paceRange: paceRange,
            paceProgression: null,
            workProgression: workProgression
          });
        } else {
          // Block 3+: Consistent work with rest, increasing pace
          // workProgression: "consistent", rounds: 4, restDuration: 60
          const basePace = paceRange && Array.isArray(paceRange) ? paceRange[0] : 0.8;
          const maxPace = paceRange && Array.isArray(paceRange) ? paceRange[1] : 1.05;
          
          for (let i = 0; i < rounds; i++) {
            // Calculate pace progression if specified
            let currentPaceRange = paceRange;
            if (paceProgression === 'increasing' && rounds > 1) {
              const progress = i / (rounds - 1);
              const currentPaceMultiplier = basePace + (maxPace - basePace) * progress;
              currentPaceRange = [currentPaceMultiplier, currentPaceMultiplier];
            }
            
            intervals.push({
              id: intervalId++,
              type: dayType,
              duration: workDuration,
              restDuration: restDuration,
              targetPace: null,
              description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
              blockNumber: blockNumber,
              roundNumber: i + 1,
              paceRange: currentPaceRange,
              paceProgression: paceProgression === 'increasing' ? 'increasing' : null,
              workProgression: workProgression
            });
          }
        }
      } else if (dayType === 'atomic' || dayType === 'atomic_block_2') {
        // Atomic: short burst intervals - use workDuration and restDuration directly from database
        const workProgression = blockParams.workProgression || 'consistent';
        const paceProgression = blockParams.paceProgression || null;
        
        // Check if paceRange is "max_effort" (string) or numeric array
        const isMaxEffort = paceRange === 'max_effort' || (typeof paceRange === 'string' && paceRange.toLowerCase().includes('max'));
        
        // For pace progression, extract base and max pace if available
        const basePace = paceRange && Array.isArray(paceRange) ? paceRange[0] : null;
        const maxPace = paceRange && Array.isArray(paceRange) ? paceRange[1] : null;
        const hasPaceProgression = paceProgression === 'increasing' && basePace !== null && maxPace !== null;
        
        for (let i = 0; i < rounds; i++) {
          // Calculate pace progression if specified
          let currentPaceRange = paceRange;
          if (hasPaceProgression && rounds > 1 && !isMaxEffort) {
            const progress = i / (rounds - 1);
            const currentPaceMultiplier = basePace + (maxPace - basePace) * progress;
            currentPaceRange = [currentPaceMultiplier, currentPaceMultiplier];
          }
          
          intervals.push({
            id: intervalId++,
            type: dayType,
            duration: workDuration, // Use directly from database
            restDuration: restDuration, // Use directly from database
            targetPace: null,
            description: `${getWorkoutTypeDisplayName(dayType)} - Burst ${i + 1}`,
            blockNumber: blockNumber,
          roundNumber: i + 1,
            paceRange: isMaxEffort ? null : currentPaceRange, // null for max effort, array otherwise
            paceProgression: hasPaceProgression ? 'increasing' : paceProgression,
            isMaxEffort: isMaxEffort // Mark as max effort for pace calculation
          });
        }
      } else if ((dayType === 'infinity' || dayType === 'infinity_block_1' || dayType === 'infinity_block_2') && blockNumber !== 3) {
        // Infinity blocks 1 and 2: progressive pace over rounds
        const basePace = paceRange ? paceRange[0] : 0.85;
        const maxPace = paceRange ? paceRange[1] : 1.0;
        
    for (let i = 0; i < rounds; i++) {
          const progress = rounds > 1 ? i / (rounds - 1) : 0;
          const currentPaceMultiplier = basePace + (maxPace - basePace) * progress;
      
      intervals.push({
        id: intervalId++,
            type: dayType,
            duration: workDuration,
            restDuration: restDuration,
        targetPace: null,
            description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
            blockNumber: blockNumber,
        roundNumber: i + 1,
            paceRange: [currentPaceMultiplier, currentPaceMultiplier],
            paceProgression: 'increasing'
          });
        }
      } else if ((dayType === 'infinity' || dayType === 'infinity_block_1' || dayType === 'infinity_block_2' || dayType === 'infinity_block_3') && blockNumber === 3) {
        // Infinity Block 3: constant pace (no progression)
        // Usually one block with constant pace unlike blocks 1 and 2 which use progressive pace
        for (let i = 0; i < rounds; i++) {
          intervals.push({
            id: intervalId++,
            type: dayType,
            duration: workDuration,
            restDuration: restDuration,
            targetPace: null,
            description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
            blockNumber: blockNumber,
            roundNumber: i + 1,
            paceRange: paceRange, // Constant pace from paceRange
            paceProgression: null // No progression
          });
        }
      } else if (dayType === 'ascending') {
        // Ascending: increasing work duration with optional pace progression
        const workDurationIncrement = blockParams.workDurationIncrement ?? 30;
        const paceIncrement = blockParams.paceIncrement ?? 0;
        
        // Calculate base and max pace if paceRange exists and paceIncrement is specified
        const basePace = paceRange ? paceRange[0] : null;
        const maxPace = paceRange ? paceRange[1] : null;
        const hasPaceProgression = paceIncrement > 0 && basePace !== null && maxPace !== null;
        
        for (let i = 0; i < rounds; i++) {
          // Work duration increases each round
          const currentWorkDuration = workDuration + (workDurationIncrement * i);
          
          // Calculate pace progression if specified
          let currentPaceRange = paceRange;
          if (hasPaceProgression && rounds > 1) {
            const progress = i / (rounds - 1);
            const currentPaceMin = basePace + ((maxPace - basePace) * progress * (1 + paceIncrement));
            const currentPaceMax = Math.min(maxPace, currentPaceMin + paceIncrement);
            currentPaceRange = [currentPaceMin, currentPaceMax];
          }
          
        intervals.push({
          id: intervalId++,
            type: dayType,
            duration: currentWorkDuration,
            restDuration: restDuration,
          targetPace: null,
            description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
            blockNumber: blockNumber,
          roundNumber: i + 1,
            paceRange: currentPaceRange,
            paceProgression: hasPaceProgression ? 'increasing' : paceProgression
          });
        }
      } else if (dayType === 'descending_devour') {
        // Descending devour: constant work, decreasing rest
        const restDurationIncrement = Math.abs(blockParams.restDurationIncrement ?? 10);
        
    for (let i = 0; i < rounds; i++) {
      intervals.push({
        id: intervalId++,
            type: dayType,
            duration: workDuration,
            restDuration: Math.max(0, restDuration - (restDurationIncrement * i)),
        targetPace: null,
            description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
            blockNumber: blockNumber,
        roundNumber: i + 1,
            paceRange: paceRange
          });
        }
      } else if (dayType === 'devour') {
        // Devour: increasing work duration, decreasing rest duration (unless restDurationIncrement is 0 or restProgression is "consistent")
        // This "devours" the rest time as work gets harder
        const workDurationIncrement = blockParams.workDurationIncrement ?? 15;
        const restDurationIncrement = blockParams.restDurationIncrement ?? 0;
        const restProgression = blockParams.restProgression ?? 'decreasing';
        const paceIncrement = blockParams.paceIncrement ?? 0;
        
        // Calculate base and max pace if paceRange exists and paceIncrement is specified
        const basePace = paceRange ? paceRange[0] : null;
        const maxPace = paceRange ? paceRange[1] : null;
        const hasPaceProgression = paceIncrement > 0 && basePace !== null && maxPace !== null;
        
        // Determine if rest should decrease (only if restDurationIncrement > 0 and restProgression is not "consistent")
        const shouldDecreaseRest = restDurationIncrement > 0 && restProgression !== 'consistent';
        
        for (let i = 0; i < rounds; i++) {
          // Work duration increases each round
          const currentWorkDuration = workDuration + (workDurationIncrement * i);
          
          // Rest duration: decrease only if configured, otherwise keep constant
          const currentRestDuration = shouldDecreaseRest 
            ? Math.max(0, restDuration - (Math.abs(restDurationIncrement) * i))
            : restDuration;
          
          // Calculate pace progression if specified
          let currentPaceRange = paceRange;
          if (hasPaceProgression && rounds > 1) {
            const progress = i / (rounds - 1);
            const currentPaceMin = basePace + ((maxPace - basePace) * progress * (1 + paceIncrement));
            const currentPaceMax = Math.min(maxPace, currentPaceMin + paceIncrement);
            currentPaceRange = [currentPaceMin, currentPaceMax];
          }
          
          intervals.push({
            id: intervalId++,
            type: dayType,
            duration: currentWorkDuration,
            restDuration: currentRestDuration,
            targetPace: null,
            description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
            blockNumber: blockNumber,
            roundNumber: i + 1,
            paceRange: currentPaceRange,
            paceProgression: hasPaceProgression ? 'increasing' : paceProgression
          });
        }
      } else if (dayType === 'ascending_devour') {
        // Ascending devour: more aggressive version - work increases more, rest decreases more (unless restDurationIncrement is 0 or restProgression is "consistent")
        // Typically uses larger increments than standard devour
        const workDurationIncrement = blockParams.workDurationIncrement ?? 20;
        const restDurationIncrement = blockParams.restDurationIncrement ?? 0;
        const restProgression = blockParams.restProgression ?? 'decreasing';
        const paceIncrement = blockParams.paceIncrement ?? 0;
        
        // Calculate base and max pace if paceRange exists and paceIncrement is specified
        const basePace = paceRange ? paceRange[0] : null;
        const maxPace = paceRange ? paceRange[1] : null;
        const hasPaceProgression = paceIncrement > 0 && basePace !== null && maxPace !== null;
        
        // Determine if rest should decrease (only if restDurationIncrement > 0 and restProgression is not "consistent")
        const shouldDecreaseRest = restDurationIncrement > 0 && restProgression !== 'consistent';
        
        for (let i = 0; i < rounds; i++) {
          // Work duration increases more aggressively each round
          const currentWorkDuration = workDuration + (workDurationIncrement * i);
          
          // Rest duration: decrease only if configured, otherwise keep constant
          const currentRestDuration = shouldDecreaseRest 
            ? Math.max(0, restDuration - (Math.abs(restDurationIncrement) * i))
            : restDuration;
          
          // Calculate pace progression if specified
          let currentPaceRange = paceRange;
          if (hasPaceProgression && rounds > 1) {
            const progress = i / (rounds - 1);
            // More aggressive pace progression for ascending devour
            const paceMultiplier = 1 + (paceIncrement * 1.5); // 1.5x more aggressive than standard devour
            const currentPaceMin = basePace + ((maxPace - basePace) * progress * paceMultiplier);
            const currentPaceMax = Math.min(maxPace, currentPaceMin + (paceIncrement * 1.5));
            currentPaceRange = [currentPaceMin, currentPaceMax];
          }
          
          intervals.push({
            id: intervalId++,
            type: dayType,
            duration: currentWorkDuration,
            restDuration: currentRestDuration,
            targetPace: null,
            description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
            blockNumber: blockNumber,
            roundNumber: i + 1,
            paceRange: currentPaceRange,
            paceProgression: hasPaceProgression ? 'increasing' : paceProgression
          });
        }
      } else if (dayType === 'polarized') {
        // Polarized: continuous work with periodic bursts
        // Store burst info on the interval so it can be displayed
        const basePace = blockParams.basePace || [0.7, 0.7];
        const burstTiming = blockParams.burstTiming || 'every_7_minutes';
        const burstDuration = blockParams.burstDuration || 7;
        const burstIntensity = blockParams.burstIntensity || 'max_effort';
        
        // Create a single continuous interval for the entire work duration
        // Burst information is stored on the interval for display purposes
        intervals.push({
          id: intervalId++,
          type: dayType,
          duration: workDuration,
          restDuration: 0,
          targetPace: null,
          description: getWorkoutTypeDisplayName(dayType),
          blockNumber: blockNumber,
          roundNumber: 1,
          paceRange: basePace,
          // Store burst info for display
          burstTiming: burstTiming,
          burstDuration: burstDuration,
          burstIntensity: burstIntensity,
          basePace: basePace,
          workProgression: 'continuous_with_bursts'
        });
      } else if (dayType === 'flux' || dayType === 'flux_stages') {
        // Flux: alternating base pace and flux periods
        // Store flux info on the interval so it can be displayed
        const baseDuration = blockParams.baseDuration || 300; // Default 5 minutes
        const fluxDuration = blockParams.fluxDuration || 60; // Default 1 minute
        const fluxStartIntensity = blockParams.fluxStartIntensity || 0.75;
        const fluxIncrement = blockParams.fluxIncrement || 0.05;
        const basePace = paceRange || [0.7, 0.7]; // Base pace for base periods
        
        // Create a single continuous interval for the entire work duration
        // Flux information is stored on the interval for display purposes
        intervals.push({
          id: intervalId++,
          type: dayType,
          duration: workDuration,
          restDuration: 0,
          targetPace: null,
          description: getWorkoutTypeDisplayName(dayType),
          blockNumber: blockNumber,
          roundNumber: 1,
          paceRange: basePace,
          // Store flux info for display
          baseDuration: baseDuration,
          fluxDuration: fluxDuration,
          fluxStartIntensity: fluxStartIntensity,
          fluxIncrement: fluxIncrement,
          fluxIntensity: blockParams.fluxIntensity || null, // Fixed flux intensity (if provided)
          workProgression: blockParams.workProgression || 'alternating_paces'
        });
      } else if (dayType === 'afterburner') {
        // Afterburner: each block has different parsing logic
        if (blockNumber === 1) {
          // Block 1: Max effort intervals with rest
          // paceRange is "max_effort" (string), not an array
          for (let i = 0; i < rounds; i++) {
            intervals.push({
              id: intervalId++,
              type: dayType,
              duration: workDuration,
              restDuration: restDuration,
              targetPace: null,
              description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
              blockNumber: blockNumber,
              roundNumber: i + 1,
              paceRange: null, // Max effort blocks don't have numeric paceRange
              paceProgression: null,
              isMaxEffort: true // Mark as max effort for pace calculation
            });
          }
        } else if (blockNumber === 2) {
          // Block 2: Single continuous interval (no rest, no intervals)
          // rounds === 1, restDuration === 0, workProgression === "single"
          intervals.push({
            id: intervalId++,
            type: dayType,
            duration: workDuration,
            restDuration: 0,
            targetPace: null,
            description: getWorkoutTypeDisplayName(dayType),
            blockNumber: blockNumber,
            roundNumber: 1,
            paceRange: paceRange, // Use the numeric paceRange from blockParams
            paceProgression: null,
            workProgression: blockParams.workProgression || 'single'
          });
        } else if (blockNumber === 3) {
          // Block 3: Intervals with progressive pace
          // paceProgression === "increasing", multiple rounds
          const basePace = paceRange && Array.isArray(paceRange) ? paceRange[0] : 0.99;
          const maxPace = paceRange && Array.isArray(paceRange) ? paceRange[1] : 1.14;
          
          for (let i = 0; i < rounds; i++) {
            const progress = rounds > 1 ? i / (rounds - 1) : 0;
            const currentPaceMultiplier = basePace + (maxPace - basePace) * progress;
            
            intervals.push({
              id: intervalId++,
              type: dayType,
              duration: workDuration,
              restDuration: restDuration,
              targetPace: null,
              description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
              blockNumber: blockNumber,
              roundNumber: i + 1,
              paceRange: [currentPaceMultiplier, currentPaceMultiplier],
              paceProgression: 'increasing',
              workProgression: blockParams.workProgression || 'consistent'
            });
          }
        } else {
          // Additional blocks (4+) - use standard interval parsing
          for (let i = 0; i < rounds; i++) {
            intervals.push({
              id: intervalId++,
              type: dayType,
              duration: workDuration,
              restDuration: restDuration,
              targetPace: null,
              description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
              blockNumber: blockNumber,
              roundNumber: i + 1,
              paceRange: paceRange,
              paceProgression: paceProgression,
              workProgression: blockParams.workProgression || 'consistent'
            });
          }
        }
      } else if (dayType === 'synthesis') {
        // Synthesis: repeating pattern - blocks 1 & 3 are max effort, blocks 2 & 4 are continuous
        if (blockNumber === 1 || blockNumber === 3) {
          // Blocks 1 & 3: Max effort intervals with rest
          // paceRange is "max_effort" (string), not an array
          for (let i = 0; i < rounds; i++) {
            intervals.push({
              id: intervalId++,
              type: dayType,
              duration: workDuration,
              restDuration: restDuration,
              targetPace: null,
              description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
              blockNumber: blockNumber,
              roundNumber: i + 1,
              paceRange: null, // Max effort blocks don't have numeric paceRange
              paceProgression: null,
              isMaxEffort: true // Mark as max effort for pace calculation
            });
          }
        } else if (blockNumber === 2 || blockNumber === 4) {
          // Blocks 2 & 4: Single continuous interval (no rest, no intervals)
          // rounds === 1, restDuration === 0, workProgression === "consistent"
          intervals.push({
            id: intervalId++,
            type: dayType,
            duration: workDuration,
            restDuration: 0,
            targetPace: null,
            description: getWorkoutTypeDisplayName(dayType),
            blockNumber: blockNumber,
            roundNumber: 1,
            paceRange: paceRange, // Use the numeric paceRange from blockParams
            paceProgression: null,
            workProgression: blockParams.workProgression || 'consistent'
          });
        } else {
          // Additional blocks (5+) - use standard interval parsing
          for (let i = 0; i < rounds; i++) {
            intervals.push({
              id: intervalId++,
              type: dayType,
              duration: workDuration,
              restDuration: restDuration,
              targetPace: null,
              description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
              blockNumber: blockNumber,
              roundNumber: i + 1,
              paceRange: paceRange,
              paceProgression: paceProgression,
              workProgression: blockParams.workProgression || 'consistent'
            });
          }
        }
      } else {
        // Standard interval workout
        for (let i = 0; i < rounds; i++) {
          intervals.push({
            id: intervalId++,
            type: dayType,
            duration: workDuration,
            restDuration: restDuration,
            targetPace: null,
            description: `${getWorkoutTypeDisplayName(dayType)} - Round ${i + 1}`,
            blockNumber: blockNumber,
            roundNumber: i + 1,
            paceRange: paceRange,
            paceProgression: paceProgression,
            isMaxEffort: blockParams.isMaxEffort || false
            });
          }
        }
    });
        
    // If no intervals were created, create a default one
    if (intervals.length === 0) {
          intervals.push({
        id: 1,
        type: dayType,
        duration: workoutData.total_work_time || 1200, // Use total_work_time if available, else 20 min default
            targetPace: null,
        description: getWorkoutTypeDisplayName(dayType),
        blockNumber: null,
        roundNumber: null
      });
    }
    
    return intervals;
  };

  // Calculate target pace using baseline and performance metrics
  // For flux days, this accepts an optional fluxIntensity parameter to calculate flux period pace
  const calculateTargetPaceWithData = (interval: Interval, fluxIntensity: number | null = null): any => {
    if (!selectedModality || !baselines[selectedModality]) {
      return null;
    }
    
    const baseline = baselines[selectedModality].baseline;
    const units = baselines[selectedModality].units;
    const dayType = workout?.day_type;

    // Special handling for Rocket Races B: check if Rocket Races A was completed
    if (dayType === 'rocket_races_b') {
      if (rocketRacesACompleted === false) {
        // Rocket Races A not completed - show message
        return {
          needsRocketRacesA: true,
          message: 'Complete Rocket Races A',
          units: units,
          baseline: baseline
        };
      } else if (rocketRacesACompleted === true && performanceMetrics?.learned_max_pace) {
        // Rocket Races A completed - use inherited pace
        const calculatedIntensity = baseline > 0 
          ? Math.round((performanceMetrics.learned_max_pace / baseline) * 100)
          : 100;
        
        return {
          pace: performanceMetrics.learned_max_pace,
          units: units,
          intensity: calculatedIntensity,
          baseline: baseline,
          source: 'inherited_from_rocket_races_a'
        };
      } else if (rocketRacesACompleted === true) {
        // Rocket Races A completed but no metrics yet
        return {
          needsRocketRacesA: true,
          message: 'Complete Rocket Races A',
          units: units,
          baseline: baseline
        };
      }
      // If rocketRacesACompleted is null, we're still loading - return null
      return null;
    }

    // For max effort days (time_trial, anaerobic, rocket races A), use learned_max_pace if available
    const isMaxEffortDay = dayType === 'time_trial' || 
                          dayType === 'anaerobic' || 
                          dayType === 'rocket_races_a' || 
                          interval.isMaxEffort;

    if (isMaxEffortDay && performanceMetrics?.learned_max_pace) {
      // Use learned max pace for max effort days
      // Calculate intensity percentage compared to baseline (e.g., if learned_max_pace is 25 cal/min and baseline is 20 cal/min, that's 125% of baseline)
      const calculatedIntensity = baseline > 0 
        ? Math.round((performanceMetrics.learned_max_pace / baseline) * 100)
        : 100;
      
      return {
        pace: performanceMetrics.learned_max_pace,
        units: units,
        intensity: calculatedIntensity,
            baseline: baseline,
        source: 'learned_max'
      };
    }

    // For max effort days without learned_max_pace, return max effort marker (no pace)
    if (isMaxEffortDay) {
      return {
        isMaxEffort: true,
        units: units,
        intensity: 100,
        baseline: baseline,
        source: 'max_effort_no_pace'
      };
    }

    // For non-max-effort days, check if paceRange is valid
    if (!interval.paceRange || !Array.isArray(interval.paceRange) || interval.paceRange.length < 2) {
      console.warn('Invalid paceRange for interval:', interval);
      return null;
    }

    // Use paceRange from the interval data
    // Use the midpoint of the range
    let intensityMultiplier = (interval.paceRange[0] + interval.paceRange[1]) / 2;

    // For flux days: if fluxIntensity is provided, multiply base intensity by flux intensity
    // This allows calculating different paces for base vs flux periods
    if (fluxIntensity !== null && typeof fluxIntensity === 'number' && fluxIntensity > 0) {
      intensityMultiplier *= fluxIntensity;
    }

    // Apply performance metrics adjustment - direct multiplication
    let metricsWereApplied = false;
    if (performanceMetrics?.rolling_avg_ratio) {
      intensityMultiplier *= performanceMetrics.rolling_avg_ratio;
      metricsWereApplied = true;
    }

    return {
      pace: baseline * intensityMultiplier,
      units: units,
      intensity: Math.round(intensityMultiplier * 100),
            baseline: baseline,
      source: metricsWereApplied ? 'metrics_adjusted' : 'baseline_only',
      isFluxPace: fluxIntensity !== null // Mark if this is a flux period pace
    };
  };

  // Mark work phase as completed (but stay on same interval for rest)
  const completeWorkPhase = (): void => {
    const intervalIndex = currentIntervalRef.current;
    setSessionData(prev => {
      const updatedIntervals = [...prev.intervals];
      if (updatedIntervals[intervalIndex]) {
        updatedIntervals[intervalIndex].workCompleted = true;
      }
      return {
        ...prev,
        intervals: updatedIntervals
      };
    });
  };

  // Move to next interval's work phase (called after rest completes or if no rest)
  const completeCurrentInterval = (): void => {
    const intervalIndex = currentIntervalRef.current;
    setSessionData(prev => {
      const updatedIntervals = [...prev.intervals];
      if (updatedIntervals[intervalIndex]) {
        updatedIntervals[intervalIndex].completed = true;
      }
      
      // Move to next interval's work phase
      const nextInterval = intervalIndex + 1;
      if (nextInterval < updatedIntervals.length) {
        setCurrentInterval(nextInterval);
        setCurrentPhase('work'); // Reset to work phase
        setTimeRemaining(updatedIntervals[nextInterval].duration);
      } else {
        // All intervals completed - wait for user to enter results
        setIsActive(false);
        setIsCompleted(true);
        // Don't auto-save - wait for user to submit results via form
      }
      
      return {
        ...prev,
        intervals: updatedIntervals
      };
    });
  };

  const startWorkout = (): void => {
    if (!selectedModality) {
      window.alert('Please select a modality before starting');
      return;
    }
    
    // Transition to active view (baseline not required)
    setCurrentView('active');
    
    // Don't start the timer yet - user clicks "Start Workout" button to start
    setIsPaused(false);
    
    // Reset burst and flux tracking
    workoutStartTimeRef.current = null;
    fluxStartTimeRef.current = null;
    setCurrentBurstStatus(null);
    setCurrentFluxStatus(null);
    
    // Initialize timer with first interval's work phase
    if (sessionData.intervals.length > 0) {
      setTimeRemaining(sessionData.intervals[0].duration);
      setCurrentInterval(0);
      setCurrentPhase('work');
      
      // Initialize burst status if polarized
      const firstInterval = sessionData.intervals[0];
      if (firstInterval && firstInterval.burstTiming) {
        const burstStatus = getBurstStatus(firstInterval, 0);
        setCurrentBurstStatus(burstStatus);
      }
      
      // Initialize flux status if flux
      if (firstInterval && firstInterval.fluxDuration) {
        const fluxStatus = getFluxStatus(firstInterval, 0);
        setCurrentFluxStatus(fluxStatus);
      }
    }
  };

  const pauseWorkout = (): void => {
    setIsActive(false);
    setIsPaused(true);
  };

  const resumeWorkout = () => {
    setIsActive(true);
    setIsPaused(false);
    // Resume burst and flux tracking
    if (workoutStartTimeRef.current === null && sessionData.intervals.length > 0) {
      const currentInt = sessionData.intervals[currentInterval];
      const totalDuration = currentInt.duration;
      const elapsedTime = totalDuration - timeRemaining;
      
      if (currentInt && currentInt.burstTiming) {
        workoutStartTimeRef.current = Date.now() - (elapsedTime * 1000);
        const burstStatus = getBurstStatus(currentInt, elapsedTime);
        setCurrentBurstStatus(burstStatus);
      }
      
      if (currentInt && currentInt.fluxDuration) {
        const fluxStatus = getFluxStatus(currentInt, elapsedTime);
        setCurrentFluxStatus(fluxStatus);
      }
    }
  };

  const completeWorkout = () => {
    setIsActive(false);
    setIsCompleted(true);
    // Don't auto-save - wait for user to submit results via form
  };

  const resetWorkout = () => {
    setIsActive(false);
    setIsPaused(false);
    setIsCompleted(false);
    setIsWorkoutSaved(false);
    setRpeValue(5); // Reset RPE slider to default
    setCurrentInterval(0);
    setCurrentPhase('work');
    workoutStartTimeRef.current = null;
    fluxStartTimeRef.current = null;
    setCurrentBurstStatus(null);
    setCurrentFluxStatus(null);
    setSessionData(prev => ({
      ...prev,
      intervals: prev.intervals.map((interval: any) => ({
        ...interval,
        actualOutput: 0,
        completed: false,
        workCompleted: false
      })),
      totalOutput: 0,
      averagePace: 0,
      averageHeartRate: null,
      peakHeartRate: null,
      perceivedExertion: null
    }));
    
    if (sessionData.intervals.length > 0) {
      setTimeRemaining(sessionData.intervals[0].duration);
    }
  };

  // Time Trial helper functions (only used when workout?.day_type === 'time_trial')
  const startTimeTrial = () => {
    if (!selectedModality) {
      alert('Please select a modality before starting');
      return;
    }
    
    // Initialize time trial as a single 600-second interval (like threshold/endurance days)
    setSessionData(prev => ({
      ...prev,
      intervals: [{
        id: 1,
        type: 'Time Trial',
        duration: 600,
        targetPace: null,
        actualOutput: 0,
        completed: false,
        workCompleted: false
      }],
      totalOutput: 0,
      averagePace: 0,
      averageHeartRate: null,
      peakHeartRate: null,
      perceivedExertion: null
    }));
    
    setTimeRemaining(600);
    setCurrentInterval(0);
    setCurrentPhase('work');
    setCurrentView('active');
    setIsPaused(false);
    // Don't start the timer yet - user clicks "Start Workout" button to start
  };

  const resetTimeTrial = () => {
    setIsActive(false);
    setIsPaused(false);
    setIsCompleted(false);
    setTimeRemaining(600);
    setTimeTrialScore('');
    setTimeTrialUnits('');
    setTimeTrialBaseline(null);
    setTimeTrialAverageHeartRate('');
    setTimeTrialPeakHeartRate('');
    setTimeTrialRpeValue(5);
    setTimeTrialSaveSuccess(false);
    
    // Reset sessionData
    setSessionData(prev => ({
      ...prev,
      intervals: [{
        id: 1,
        type: 'Time Trial',
        duration: 600,
        targetPace: null,
        actualOutput: 0,
        completed: false,
        workCompleted: false
      }],
      totalOutput: 0,
      averagePace: 0,
      averageHeartRate: null,
      peakHeartRate: null,
      perceivedExertion: null
    }));
  };


  const submitTimeTrial = async () => {
    let preferredUnit = timeTrialUnitPreferences[selectedModality];
    
    if (!preferredUnit && selectedModality && connected) {
      try {
        preferredUnit = await engineDatabaseService.loadUnitPreferenceForModality(selectedModality);
        if (preferredUnit) {
          setTimeTrialUnitPreferences(prev => ({
            ...prev,
            [selectedModality]: preferredUnit
          }));
        }
      } catch (error) {
        console.error('Error loading unit preference:', error);
      }
    }
    
    if (!selectedModality || !preferredUnit || !timeTrialScore || !connected) {
      alert('Please complete all fields and connect to database');
      return;
    }

    setTimeTrialIsSubmitting(true);
    setTimeTrialSaveSuccess(false);
    
    try {
      let workoutId = null;
      if (dayNumber) {
        const workoutData = await engineDatabaseService.loadWorkoutForDay(dayNumber);
        if (workoutData && workoutData.id) {
          workoutId = workoutData.id;
        }
      }

      let avgHR = null;
      if (timeTrialAverageHeartRate) {
        const parsed = parseFloat(timeTrialAverageHeartRate);
        if (!isNaN(parsed) && parsed > 0) {
          avgHR = parsed;
        }
      }

      let peakHR = null;
      if (timeTrialPeakHeartRate) {
        const parsed = parseFloat(timeTrialPeakHeartRate);
        if (!isNaN(parsed) && parsed > 0) {
          peakHR = parsed;
        }
      }

      let perceivedExertion = null;
      if (timeTrialRpeValue) {
        const parsed = typeof timeTrialRpeValue === 'string' ? parseInt(timeTrialRpeValue) : timeTrialRpeValue;
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
          perceivedExertion = parsed;
        }
      }

      const scoreValue = parseFloat(timeTrialScore);
      const calculatedBaseline = scoreValue / 10;

      const timeTrialData = {
        modality: selectedModality,
        date: new Date().toISOString().split('T')[0],
        total_output: scoreValue,
        units: preferredUnit,
        calculated_rpm: calculatedBaseline,
        duration_seconds: 600,
        is_current: true,
        average_heart_rate: avgHR,
        peak_heart_rate: peakHR,
        perceived_exertion: perceivedExertion,
        workout_id: workoutId
      };

      await engineDatabaseService.saveTimeTrial(timeTrialData);
      
      // Also create a workout session record to mark this day as completed
      if (dayNumber && workoutId) {
        try {
          // Load program version if not already available
          let programVersion = await engineDatabaseService.loadProgramVersion();
          if (!programVersion) {
            programVersion = '5-day';
          }
          
          // Get program_day_number (same logic as saveWorkoutSession)
          let programDayNumber = null;
          if (programVersion === '5-day') {
            programDayNumber = dayNumber;
          } else if (programVersion === '3-day') {
            programDayNumber = await engineDatabaseService.getProgramDayNumber(
              dayNumber,
              programVersion
            );
          }
          if (programDayNumber === null) {
            programDayNumber = dayNumber;
          }
          
          // Load workout to get day_type if not already loaded
          let dayType = 'time_trial';
          let workoutDataForSession = workout;
          if (!workoutDataForSession || !workoutDataForSession.day_type) {
            workoutDataForSession = await engineDatabaseService.loadWorkoutForDay(dayNumber);
            if (workoutDataForSession && workoutDataForSession.day_type) {
              dayType = workoutDataForSession.day_type;
            }
          } else {
            dayType = workoutDataForSession.day_type;
          }
          
          // Create workout session record for time trial
          const sessionData = {
            program_day: dayNumber,
            program_version: programVersion,
            program_day_number: programDayNumber,
            workout_id: workoutId,
            day_type: dayType,
            date: new Date().toISOString().split('T')[0],
            completed: true,
            total_output: scoreValue,
            actual_pace: calculatedBaseline, // scoreValue / 10
            target_pace: null, // Time trials don't have target pace
            performance_ratio: null, // Time trials don't have performance ratio
            modality: selectedModality,
            units: preferredUnit,
            average_heart_rate: avgHR,
            peak_heart_rate: peakHR,
            perceived_exertion: perceivedExertion,
            workout_data: {
              time_trial: true,
              total_output: scoreValue,
              duration_seconds: 600
            }
          };
          
          await engineDatabaseService.saveWorkoutSession(sessionData);
        } catch (sessionError) {
          console.error('⚠️ Error creating workout session for time trial:', sessionError);
          // Don't fail the entire time trial save if session creation fails
        }
      }
      
      setTimeTrialScore(scoreValue.toString());
      setTimeTrialAverageHeartRate(avgHR ? avgHR.toString() : '');
      setTimeTrialPeakHeartRate(peakHR ? peakHR.toString() : '');
      setTimeTrialRpeValue(perceivedExertion || 5);
      
      setTimeTrialSaveSuccess(true);
      loadBaselineForModality();
      loadWorkoutHistory();
    } catch (error) {
      console.error('Error saving time trial:', error);
      alert('Failed to save time trial. Please try again.');
    } finally {
      setTimeTrialIsSubmitting(false);
    }
  };

  const saveWorkoutSession = async (formValues: any = null) => {
    if (!connected) {
      console.warn('❌ Cannot save: not connected');
      return;
    }
    
    if (!selectedModality || !baselines[selectedModality]) {
      console.warn('❌ Cannot save: no modality selected or baseline missing', { selectedModality, hasBaseline: !!baselines[selectedModality] });
      return;
    }

    // Use form values if provided (from immediate form submission), otherwise use state
    const totalOutput = formValues?.totalOutput ?? sessionData.totalOutput;
    const averagePace = formValues?.averagePace ?? sessionData.averagePace;
    const averageHeartRate = formValues?.averageHeartRate !== undefined ? formValues.averageHeartRate : sessionData.averageHeartRate;
    const peakHeartRate = formValues?.peakHeartRate !== undefined ? formValues.peakHeartRate : sessionData.peakHeartRate;
    const perceivedExertion = formValues?.perceivedExertion ?? sessionData.perceivedExertion;

    if (totalOutput === 0) {
      console.warn('Cannot save: total output is 0');
      return;
    }
    
    try {
      // Load user's program_version
      let programVersion = await engineDatabaseService.loadProgramVersion();
      
      // Default to '5-day' if null (backward compatibility)
      if (!programVersion) {
        programVersion = '5-day';
      }
      
      // Get program_day_number for this source day_number
      let programDayNumber = null;
      if (programVersion === '5-day') {
        programDayNumber = dayNumber;
      } else if (programVersion === '3-day') {
        programDayNumber = await engineDatabaseService.getProgramDayNumber(
          dayNumber,
          programVersion
        );
      }
      
      if (programDayNumber === null) {
        programDayNumber = dayNumber;
      }

      // Calculate performance ratio if we have target pace
      let performanceRatio = null;
      
      // For flux days, calculate weighted average based on base/flux periods
      // For other days, use simple average of interval paces
      let avgTargetPace = null;
      let totalWeightedPace = 0;
      let totalDuration = 0;
      let hasValidPace = false;
      
      sessionData.intervals.forEach(interval => {
        // For flux days, calculate weighted average based on base/flux periods
        if (interval.fluxDuration && interval.baseDuration) {
          const baseDuration = interval.baseDuration;
          const fluxDuration = interval.fluxDuration;
          const fluxStartIntensity = interval.fluxStartIntensity || 0.75;
          const fluxIncrement = interval.fluxIncrement || 0.05;
          
          // Calculate base pace
          const basePaceData = calculateTargetPaceWithData(interval, null);
          if (!basePaceData || typeof basePaceData.pace !== 'number' || isNaN(basePaceData.pace) || basePaceData.pace <= 0) {
            return; // Skip this interval if base pace is invalid
          }
          
          // Calculate flux periods
          const fluxPeriods = calculateFluxPeriods(baseDuration, fluxDuration, interval.duration);
          
          fluxPeriods.forEach(period => {
            const periodDuration = period.end - period.start;
            
            if (period.type === 'flux') {
              // Calculate flux intensity for this flux period
              // Use fixed fluxIntensity if available, otherwise calculate progressively
              const fluxIntensity = interval.fluxIntensity !== null && interval.fluxIntensity !== undefined
                ? interval.fluxIntensity
                : fluxStartIntensity + (period.index * fluxIncrement);
              const fluxPaceData = calculateTargetPaceWithData(interval, fluxIntensity);
              
              if (fluxPaceData && typeof fluxPaceData.pace === 'number' && !isNaN(fluxPaceData.pace) && fluxPaceData.pace > 0) {
                totalWeightedPace += fluxPaceData.pace * periodDuration;
                totalDuration += periodDuration;
                hasValidPace = true;
              }
            } else {
              // Base period - use base pace
              totalWeightedPace += basePaceData.pace * periodDuration;
              totalDuration += periodDuration;
              hasValidPace = true;
            }
          });
        } else {
          // Standard interval - calculate normally
          const targetPace = interval.targetPace || calculateTargetPaceWithData(interval);
          
          // Only include intervals with valid numeric pace values
          if (targetPace && typeof targetPace.pace === 'number' && !isNaN(targetPace.pace) && targetPace.pace > 0) {
            const intervalDuration = interval.duration;
            totalWeightedPace += targetPace.pace * intervalDuration;
            totalDuration += intervalDuration;
            hasValidPace = true;
          }
        }
      });
      
      // Calculate weighted average
      if (hasValidPace && totalDuration > 0) {
        avgTargetPace = totalWeightedPace / totalDuration;
      }
      
      
      
      if (avgTargetPace !== null && avgTargetPace > 0 && averagePace > 0) {
        performanceRatio = averagePace / avgTargetPace;
      } else {
        console.warn('⚠️ Performance Ratio NOT Calculated:', {
          reason: avgTargetPace === null ? 'no valid target paces found (all intervals may have null targetPace, invalid paceRange, or max effort markers without pace)' : !(avgTargetPace > 0) ? 'avgTargetPace <= 0' : 'averagePace <= 0',
          avgTargetPace,
          averagePace,
          hasValidPace: hasValidPace,
          totalDuration: totalDuration,
          totalIntervals: sessionData.intervals.length
        });
      }
      
      // Calculate total work time for training load calculations
      const totalWorkTime = getTotalWorkDuration();
      
      // Calculate work:rest ratio from intervals for analytics
      let totalWorkDuration = 0;
      let totalRestDuration = 0;
      sessionData.intervals.forEach(interval => {
        if (interval.completed) {
          totalWorkDuration += interval.duration || 0;
          totalRestDuration += interval.restDuration || 0;
        }
      });

      // Calculate avg_work_rest_ratio from completed intervals (excluding continuous)
      let avgWorkRestRatio = null;
      const validRatios: number[] = [];

      sessionData.intervals.forEach(interval => {
        if (interval.completed && (interval.restDuration ?? 0) > 0 && interval.duration > 0) {
          const ratio = interval.duration / (interval.restDuration ?? 0);
          validRatios.push(ratio);
        }
      });

      if (validRatios.length > 0) {
        avgWorkRestRatio = validRatios.reduce((sum, r) => sum + r, 0) / validRatios.length;
      } else {
        // All intervals were continuous (no rest)
        avgWorkRestRatio = 999;
      }

      // Build interval data array if all intervals have outputs
      let intervalDataArray = null;
      if (shouldShowIntervalInputs()) {
        const intervalsWithOutput = sessionData.intervals.filter((i: any) => i.actualOutput !== null && i.actualOutput !== undefined);
        const intervalsWithoutOutput = sessionData.intervals.filter((i: any) => i.actualOutput === null || i.actualOutput === undefined);

        // All-or-nothing validation: if any interval has output, all must have output
        if (intervalsWithOutput.length > 0 && intervalsWithoutOutput.length > 0) {
          // Partial data - don't save interval data
          console.warn('⚠️ Partial interval data detected - saving workout without interval breakdown');
          intervalDataArray = null;
        } else if (intervalsWithOutput.length === sessionData.intervals.length) {
          // All intervals have output - build the array
          intervalDataArray = sessionData.intervals.map((interval: any) => {
            const output = interval.actualOutput || 0;
            const durationMinutes = (interval.duration || 0) / 60;
            const calculatedPace = durationMinutes > 0 ? output / durationMinutes : 0;
            
            // Get target pace for this interval
            let targetPaceValue = null;
            if (interval.targetPace && typeof interval.targetPace === 'object' && interval.targetPace.pace) {
              targetPaceValue = interval.targetPace.pace;
            } else {
              const targetPaceData = calculateTargetPaceWithData(interval);
              if (targetPaceData && targetPaceData.pace) {
                targetPaceValue = targetPaceData.pace;
              }
            }

            return {
              round: interval.roundNumber || interval.id,
              block: interval.blockNumber || null,
              output: output,
              pace: calculatedPace,
              target_pace: targetPaceValue,
              duration: interval.duration || 0
            };
          });
        }
      }
      
      const workoutDataObj: any = {
        intervals_completed: sessionData.intervals.filter((i: any) => i.completed).length,
        total_intervals: sessionData.intervals.length,
        total_work_time: totalWorkTime,
        work_duration: totalWorkDuration,
        rest_duration: totalRestDuration
      };

      // Only include intervals array if all intervals have data
      if (intervalDataArray && intervalDataArray.length > 0) {
        workoutDataObj.intervals = intervalDataArray;
      }
      
      const sessionDataToSave = {
        program_day: dayNumber,
        program_version: programVersion,
        program_day_number: programDayNumber,
        workout_id: workout?.id,
        day_type: workout?.day_type,
        date: new Date().toISOString().split('T')[0],
        completed: true,
        total_output: totalOutput,
        actual_pace: averagePace,
        target_pace: avgTargetPace || null,
        performance_ratio: performanceRatio,
        modality: selectedModality,
        units: baselines[selectedModality]?.units || null,
        average_heart_rate: averageHeartRate,
        peak_heart_rate: peakHeartRate,
        perceived_exertion: perceivedExertion,
        workout_data: workoutDataObj,
        avg_work_rest_ratio: avgWorkRestRatio
      };


      await engineDatabaseService.saveWorkoutSession(sessionDataToSave);
      
      // Update performance metrics after saving
      const isMaxEffort = workout?.day_type === 'time_trial' || 
                         workout?.day_type === 'anaerobic' || 
                         workout?.day_type === 'rocket_races_a' || 
                         workout?.day_type === 'rocket_races_b';
      
      // For max effort days, update using actualPace (doesn't need performanceRatio)
      // For other days, only update if we have performanceRatio
      if (workout?.day_type && selectedModality && (isMaxEffort || performanceRatio)) {
        
        const userId = engineDatabaseService.getUserId();
        if (!userId) {
          console.warn('⚠️ Cannot update performance metrics: no user ID');
          return;
        }
        
        await engineDatabaseService.updatePerformanceMetrics(
          userId,
          workout.day_type,
          selectedModality,
          performanceRatio || 0,
          averagePace,
          isMaxEffort
        );
        
      } else {
        console.warn('⚠️ Performance metrics NOT updated:', {
          reason: !workout?.day_type ? 'no day_type' : !selectedModality ? 'no modality' : isMaxEffort ? 'max effort but no actualPace' : 'no performanceRatio',
          performanceRatio,
          day_type: workout?.day_type,
          modality: selectedModality,
          isMaxEffort,
          actualPace: averagePace
        });
      }
      
      // Mark workout as saved
      setIsWorkoutSaved(true);
      
    } catch (error) {
      console.error('Error saving workout session:', error);
      window.alert('Error saving workout session. Please try again.');
    }
  };

  // Handle result submission from the inline form
  const handleResultSubmit = async (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const totalOutputInput = formData.get('totalOutput') as string | null;
    const averageHRInput = formData.get('averageHeartRate') as string | null;
    const peakHRInput = formData.get('peakHeartRate') as string | null;
    const perceivedExertionInput = formData.get('perceivedExertion') as string | null;
    
    if (!totalOutputInput) {
      window.alert('Please enter a total output value');
      return;
    }

    const totalOutput = parseFloat(totalOutputInput || '0');
    
    if (isNaN(totalOutput) || totalOutput < 0) {
      window.alert('Please enter a valid positive number for total output');
      return;
    }

    // Parse heart rate values (optional)
    let averageHeartRate = null;
    if (averageHRInput) {
      const parsed = parseFloat(averageHRInput);
      if (!isNaN(parsed) && parsed > 0) {
        averageHeartRate = parsed;
      }
    }

    let peakHeartRate = null;
    if (peakHRInput) {
      const parsed = parseFloat(peakHRInput);
      if (!isNaN(parsed) && parsed > 0) {
        peakHeartRate = parsed;
      }
    }

    // Parse perceived exertion (optional, 1-10)
    let perceivedExertion = null;
    if (perceivedExertionInput) {
      const parsed = parseInt(perceivedExertionInput);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
        perceivedExertion = parsed;
      }
    }

    // Calculate average pace and update session data
    const totalDuration = sessionData.intervals.reduce((sum, interval) => sum + interval.duration, 0);
    const totalDurationInMinutes = totalDuration / 60;
    const averagePace = totalDurationInMinutes > 0 ? totalOutput / totalDurationInMinutes : 0;

    // Update session data with the entered values (for display)
    setSessionData(prev => ({
      ...prev,
      totalOutput: totalOutput,
      averagePace: averagePace,
      averageHeartRate: averageHeartRate,
      peakHeartRate: peakHeartRate,
      perceivedExertion: perceivedExertion
    }));

    // Save immediately with the values we just calculated (don't wait for state to update)
    await saveWorkoutSession({
      totalOutput: totalOutput,
      averagePace: averagePace,
      averageHeartRate: averageHeartRate,
      peakHeartRate: peakHeartRate,
      perceivedExertion: perceivedExertion
    });
  };

  // Skip to end - mirror natural completion (for testing)
  const skipToEnd = () => {
    // Set timer to 0 and mark as completed - works for all workout types
    setTimeRemaining(0);
    setIsActive(false);
    setIsCompleted(true);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString()}:${String(secs).padStart(2, '0')}`;
  };

  // Format burst timing for display (e.g., "every_7_minutes" -> "Every 7 minutes")
  const formatBurstTiming = (burstTiming: string | null): string | null => {
    if (!burstTiming) return null;
    const timingMap: Record<string, string> = {
      'every_5_minutes': 'Every 5 minutes',
      'every_7_minutes': 'Every 7 minutes',
      'every_10_minutes': 'Every 10 minutes',
      'every_15_minutes': 'Every 15 minutes'
    };
    return timingMap[burstTiming] || burstTiming.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDuration = (totalSeconds: number): string => {
    if (!totalSeconds) return '0 min';
    const minutes = Math.floor(totalSeconds / 60);
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
  };

  const getCurrentInterval = () => {
    return sessionData.intervals[currentInterval] || null;
  };

  const getCurrentTargetPace = () => {
    const interval = getCurrentInterval();
    if (!interval) return null;
    
    // Always check if baseline exists for current modality before using stored pace
    if (!selectedModality || !baselines[selectedModality]) {
      return null; // No baseline for this modality - return null
    }
    
    // For flux days, calculate current pace based on flux status
    if (interval.fluxDuration && currentFluxStatus) {
      if (currentFluxStatus.isActive) {
        // In flux period - use flux intensity
        return calculateTargetPaceWithData(interval, currentFluxStatus.currentIntensity);
      } else {
        // In base period - use base pace (no flux intensity multiplier)
        return calculateTargetPaceWithData(interval, null);
      }
    }
    
    // For non-flux intervals, always recalculate (don't use stored value if modality changed)
    return calculateTargetPaceWithData(interval);
  };

  // Check if interval inputs should be shown (only for day types with rest segments)
  const shouldShowIntervalInputs = () => {
    if (!workout?.day_type || !sessionData.intervals || sessionData.intervals.length === 0) {
      return false;
    }

    // Exclude continuous day types
    const continuousDayTypes = ['endurance', 'threshold', 'polarized', 'tempo', 'recovery', 'flux', 'flux_stages', 'time_trial'];
    if (continuousDayTypes.includes(workout.day_type)) {
      return false;
    }

    // Must have multiple intervals
    if (sessionData.intervals.length === 1) {
      return false;
    }

    // Must have at least one interval with rest duration > 0
    const hasRestSegments = sessionData.intervals.some(interval => (interval.restDuration ?? 0) > 0);
    if (!hasRestSegments) {
      return false;
    }

    return true;
  };

  // Handle interval output input change
  const handleIntervalOutputChange = (intervalId: number, value: any) => {
    const numValue = parseFloat(value);
    const outputValue = isNaN(numValue) || numValue < 0 ? null : numValue;

    setSessionData(prev => {
      const updatedIntervals = prev.intervals.map((interval: any) => {
        if (interval.id === intervalId) {
          return {
            ...interval,
            actualOutput: outputValue
          };
        }
        return interval;
      });

      return {
        ...prev,
        intervals: updatedIntervals
      };
    });
  };

  // Calculate total goal for entire work day (sum of all interval targets)
  const getTotalWorkoutGoal = () => {
    if (!selectedModality || !baselines[selectedModality]) {
      return null;
    }

    // For anaerobic days, check if user has history
    if (workout?.day_type === 'anaerobic') {
      // Check if user has completed any anaerobic sessions for this modality
      const hasAnaerobicHistory = workoutHistory && workoutHistory.length > 0;
      
      if (!hasAnaerobicHistory) {
        // Return special indicator for "Max Effort"
        return {
          isMaxEffort: true
        };
      }
    }

    // For Rocket Races A (max effort day), always show "Max Effort"
    if (workout?.day_type === 'rocket_races_a') {
      return {
        isMaxEffort: true
      };
    }

    // Calculate target pace for each interval and sum the total work
    let totalGoal = 0;
    let hasValidTargets = false;

    sessionData.intervals.forEach(interval => {
      // For flux days, calculate weighted average based on base/flux periods
      if (interval.fluxDuration && interval.baseDuration) {
        const baseDuration = interval.baseDuration;
        const fluxDuration = interval.fluxDuration;
        const fluxStartIntensity = interval.fluxStartIntensity || 0.75;
        const fluxIncrement = interval.fluxIncrement || 0.05;
        
        // Calculate base pace
        const basePaceData = calculateTargetPaceWithData(interval, null);
        if (!basePaceData || typeof basePaceData.pace !== 'number' || isNaN(basePaceData.pace) || basePaceData.pace <= 0) {
          return; // Skip this interval if base pace is invalid
        }
        
        // Calculate flux periods
        const fluxPeriods = calculateFluxPeriods(baseDuration, fluxDuration, interval.duration);
        let intervalGoal = 0;
        
        fluxPeriods.forEach(period => {
          const periodDurationInMinutes = (period.end - period.start) / 60;
          
          if (period.type === 'flux') {
            // Calculate flux intensity for this flux period
            // Use fixed fluxIntensity if available, otherwise calculate progressively
            const fluxIntensity = interval.fluxIntensity !== null && interval.fluxIntensity !== undefined
              ? interval.fluxIntensity
              : fluxStartIntensity + (period.index * fluxIncrement);
            const fluxPaceData = calculateTargetPaceWithData(interval, fluxIntensity);
            
            if (fluxPaceData && typeof fluxPaceData.pace === 'number' && !isNaN(fluxPaceData.pace) && fluxPaceData.pace > 0) {
              intervalGoal += periodDurationInMinutes * fluxPaceData.pace;
            }
          } else {
            // Base period - use base pace
            intervalGoal += periodDurationInMinutes * basePaceData.pace;
          }
        });
        
        if (intervalGoal > 0) {
          totalGoal += intervalGoal;
          hasValidTargets = true;
        }
      } else {
        // Standard interval - calculate normally
        const targetPace = interval.targetPace || calculateTargetPaceWithData(interval);
        
        // Only include intervals with valid numeric pace values
        if (targetPace && typeof targetPace.pace === 'number' && !isNaN(targetPace.pace) && targetPace.pace > 0) {
          const durationInMinutes = interval.duration / 60;
          const intervalGoal = durationInMinutes * targetPace.pace;
          totalGoal += intervalGoal;
          hasValidTargets = true;
        }
      }
    });

    if (!hasValidTargets) {
      return null;
    }

    return {
      totalGoal: totalGoal,
      units: baselines[selectedModality].units
    };
  };

  // Calculate total work duration only (excludes rest)
  const getTotalWorkDuration = () => {
    if (workout?.total_work_time) {
      return workout.total_work_time;
    }
    
    return sessionData.intervals.reduce((sum, interval) => sum + interval.duration, 0);
  };

  // Get simple workout summary (no equipment needed)
  const getSimpleWorkoutSummary = () => {
    if (!sessionData.intervals || sessionData.intervals.length === 0) {
      return null;
    }
    
    // Group intervals by block
    const blocks: Record<number, Interval[]> = {};
    sessionData.intervals.forEach(interval => {
      const blockNum = interval.blockNumber || 1;
      if (!blocks[blockNum]) {
        blocks[blockNum] = [];
      }
      blocks[blockNum].push(interval);
    });
    
    const blockNumbers = Object.keys(blocks).map(Number).sort((a: any, b: any) => a - b);
    const totalRounds = sessionData.intervals.length;
    
    // If there's only one block, return simple summary
    if (blockNumbers.length === 1) {
      const firstInterval = sessionData.intervals[0];
      return {
        totalRounds,
        workDuration: firstInterval.duration,
        restDuration: firstInterval.restDuration || 0,
        hasMultipleBlocks: false
      };
    }
    
    // Multiple blocks - return block-by-block summary
    const blockSummaries = blockNumbers.map((blockNum: any) => {
      const blockIntervals = blocks[blockNum];
      // Get the work/rest duration from the first interval in the block
      // (assuming all intervals in a block have the same duration)
      const firstInterval = blockIntervals[0];
      return {
        blockNumber: blockNum,
        roundCount: blockIntervals.length,
        workDuration: firstInterval.duration,
        restDuration: firstInterval.restDuration || 0
      };
    });
    
    return {
      totalRounds,
      hasMultipleBlocks: true,
      blocks: blockSummaries
    };
  };

  // Get workout breakdown for preview screen
  const getWorkoutBreakdown = () => {
    if (!sessionData.intervals || sessionData.intervals.length === 0) {
      return null;
    }

    // Group intervals by block
    const blocks: Record<number, Interval[]> = {};
    sessionData.intervals.forEach(interval => {
      const blockNum = interval.blockNumber || 1;
      if (!blocks[blockNum]) {
        blocks[blockNum] = [];
      }
      blocks[blockNum].push(interval);
    });

    const blockNumbers = Object.keys(blocks).map(Number).sort((a: any, b: any) => a - b);
    const totalRounds = sessionData.intervals.length;

    return {
      totalRounds,
      totalBlocks: blockNumbers.length,
      blocks: blockNumbers.map((blockNum: any) => ({
        blockNumber: blockNum,
        rounds: blocks[blockNum],
        roundCount: blocks[blockNum].length
      }))
    };
  };

  // Calculate current interval goal for display in timer circle
  const getCurrentIntervalGoal = () => {
    // Only show goal during work phases
    if (currentPhase !== 'work') {
      return null;
    }
    
    const interval = getCurrentInterval();
    if (!interval) return null;
    
    // For burst periods: show "Max Effort"
    if (currentBurstStatus?.isActive) {
      return { text: 'Max Effort', isMaxEffort: true };
    }
    
    // For flux intervals: calculate goal for current segment (base or flux)
    if (interval.fluxDuration && interval.baseDuration) {
      // Calculate elapsed time in current interval
      const totalDuration = interval.duration || 0;
      const remaining = timeRemaining;
      const elapsedTime = totalDuration - remaining;
      
      // Determine which segment we're in
      const fluxPeriods = calculateFluxPeriods(interval.baseDuration, interval.fluxDuration, interval.duration);
      const currentPeriod = fluxPeriods.find(p => elapsedTime >= p.start && elapsedTime < p.end);
      
      if (currentPeriod) {
        const fluxStartIntensity = interval.fluxStartIntensity || 0.75;
        const fluxIncrement = interval.fluxIncrement || 0.05;
        
        if (currentPeriod.type === 'flux') {
          // In flux period - calculate goal for this specific flux segment
          // Use fixed fluxIntensity if available, otherwise calculate progressively
          const fluxIntensity = interval.fluxIntensity !== null && interval.fluxIntensity !== undefined
            ? interval.fluxIntensity
            : fluxStartIntensity + (currentPeriod.index * fluxIncrement);
          const fluxPaceData = calculateTargetPaceWithData(interval, fluxIntensity);
          
          if (fluxPaceData && typeof fluxPaceData.pace === 'number' && !isNaN(fluxPaceData.pace) && fluxPaceData.pace > 0) {
            const segmentDurationMinutes = (currentPeriod.end - currentPeriod.start) / 60;
            const segmentGoal = segmentDurationMinutes * fluxPaceData.pace;
            
            if (!isNaN(segmentGoal) && isFinite(segmentGoal)) {
              return { 
                text: `${Math.round(segmentGoal)} ${fluxPaceData.units}`, 
                isFlux: true,
                intensity: Math.round(fluxIntensity * 100)
              };
            }
          }
        } else {
          // In base period - calculate goal for this specific base segment
          const basePaceData = calculateTargetPaceWithData(interval, null);
          
          if (basePaceData && typeof basePaceData.pace === 'number' && !isNaN(basePaceData.pace) && basePaceData.pace > 0) {
            const segmentDurationMinutes = (currentPeriod.end - currentPeriod.start) / 60;
            const segmentGoal = segmentDurationMinutes * basePaceData.pace;
            
            if (!isNaN(segmentGoal) && isFinite(segmentGoal)) {
              return { 
                text: `${Math.round(segmentGoal)} ${basePaceData.units}`, 
                isFlux: false,
                isBase: true
              };
            }
          }
        }
      }
    }
    
    // For normal intervals: calculate total goal for the interval
    const targetPace = getCurrentTargetPace();
    if (!targetPace) return null;
    
    // Rocket Races B needs Rocket Races A: show message
    if (targetPace.needsRocketRacesA) {
      return { text: targetPace.message, needsRocketRacesA: true };
    }
    
    // Max effort without pace: show "Max Effort"
    if (targetPace.isMaxEffort && !targetPace.pace) {
      return { text: 'Max Effort', isMaxEffort: true };
    }
    
    // Calculate goal for the entire work interval
    if (targetPace.pace && typeof targetPace.pace === 'number' && !isNaN(targetPace.pace) && targetPace.pace > 0) {
      const durationInMinutes = interval.duration / 60;
      const totalGoal = durationInMinutes * targetPace.pace;
      
      if (!isNaN(totalGoal) && isFinite(totalGoal)) {
        return { 
          text: `${Math.round(totalGoal)} ${targetPace.units}`,
          isMaxEffort: false 
        };
      }
    }
    
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading workout...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Workout</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={onBack}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-lg border-b">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            {/* Left side - Back button */}
            <div>
              {onBackToMonth && (
                <button
                  onClick={onBackToMonth}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    background: '#FE5858',
                    border: '1px solid #FE5858',
                    borderRadius: '0.5rem',
                    color: '#F8FBFE',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e: any) => {
                    e.target.style.background = '#e64747';
                    e.target.style.borderColor = '#e64747';
                  }}
                  onMouseLeave={(e: any) => {
                    e.target.style.background = '#FE5858';
                    e.target.style.borderColor = '#FE5858';
                  }}
                >
                  <ArrowLeft size={18} />
                  Back to Month
                </button>
              )}
            </div>
            
            {/* Center - Day number and workout type tag stacked vertically */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
              flex: 1
            }}>
              <h1 className="text-3xl font-bold text-gray-900" style={{ margin: 0, textAlign: 'center' }}>
                Day {dayNumber}
              </h1>
            {workout?.day_type && (
              <div
                style={{
                  display: 'inline-block',
                  padding: '0.5rem 1rem',
                  background: getWorkoutTypeColor(workout.day_type),
                  borderRadius: '0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: '700',
                  color: 'white',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
              >
                {getWorkoutTypeDisplayName(workout.day_type)}
              </div>
            )}
            </div>
            
            {/* Right side - empty spacer to balance the layout */}
            <div style={{ width: onBackToMonth ? 'auto' : '0' }}></div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Time Trial UI - rendered when workout is a time trial */}
        {workout?.day_type === 'time_trial' ? (
          <div style={{ minHeight: '100vh', background: '#FFFFFF' }}>
            <div style={{ maxWidth: '1152px', margin: '0 auto', padding: '1.5rem 1.5rem 2rem' }}>
              {/* Time Trial Equipment Selection View */}
              {currentView === 'equipment' && (
                <div style={{ maxWidth: '672px', margin: '0 auto' }}>
                  <div style={{ marginTop: '1rem', marginBottom: '2rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#282B34', marginBottom: '0.5rem' }}>
                      10:00
                    </div>
                    <div style={{ fontSize: '1rem', color: '#6b7280' }}>
                      Maximum Effort
                    </div>
                  </div>
                  
                  <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '1rem' }}>
                      Select Modality
                    </h3>
                    
                    {/* Equipment Category Buttons - reuse same structure as regular workouts */}
                    <div style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                      {['Rowing', 'Cycling', 'Ski', 'Running'].map((category: any) => {
                        const categoryModalities = modalities.filter((m: any) => m.category === category);
                        const isSelected = selectedModality && modalities.find(m => m.value === selectedModality)?.category === category;
                        const isExpanded = expandedCategory === category;
                        const labelMap: Record<string, string> = { 'Rowing': 'Row', 'Cycling': 'Cycle', 'Ski': 'Ski', 'Running': 'Run' };
                        
                        return (
                          <button
                            key={category}
                            onClick={() => {
                              // Toggle category expansion and clear selection if deselecting
                              if (expandedCategory === category) {
                                setExpandedCategory('');
                                setSelectedModality('');
                              } else {
                                setExpandedCategory(category);
                                // Don't auto-select - user must click specific equipment
                              }
                            }}
                            disabled={isActive || isCompleted}
                            style={{
                              padding: '0.75rem',
                              borderRadius: '0.5rem',
                              border: '2px solid',
                              borderColor: (isSelected || isExpanded) ? '#FE5858' : '#e5e7eb',
                              background: '#DAE2EA',
                              color: '#282B34',
                              fontWeight: '600',
                              fontSize: '0.875rem',
                              cursor: (isActive || isCompleted) ? 'not-allowed' : 'pointer',
                              opacity: (isActive || isCompleted) ? 0.5 : 1,
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.5rem',
                              flex: '1 1 0',
                              minWidth: '0'
                            }}
                          >
                            {labelMap[category]}
                            {isSelected && <CheckCircle style={{ width: '1rem', height: '1rem', color: '#FE5858' }} />}
                          </button>
                        );
                      })}
                    </div>
                    
                    {/* Equipment Sub-menu */}
                    {(expandedCategory || selectedModality) && (
                      <div style={{ background: '#F8FBFE', borderRadius: '0.5rem', padding: '0.75rem', border: '1px solid #282B34', marginBottom: '1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
                          {modalities.filter((m: any) => m.category === (expandedCategory || modalities.find(mod => mod.value === selectedModality)?.category)).map((modality: any) => (
                            <button
                              key={modality.value}
                              onClick={() => {
                                setSelectedModality(modality.value);
                                setExpandedCategory(''); // Clear expanded category when equipment is selected
                              }}
                              disabled={isActive || isCompleted}
                              style={{
                                padding: '0.75rem',
                                borderRadius: '0.375rem',
                                border: '1px solid',
                                borderColor: selectedModality === modality.value ? '#FE5858' : '#d1d5db',
                                background: '#DAE2EA',
                                color: '#282B34',
                                fontWeight: '600',
                                fontSize: '0.875rem',
                                cursor: (isActive || isCompleted) ? 'not-allowed' : 'pointer',
                                opacity: (isActive || isCompleted) ? 0.5 : 1,
                                transition: 'all 0.2s ease',
                                textAlign: 'left'
                              }}
                            >
                              {modality.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Unit Selection - Show when modality selected */}
                    {(() => {
                      return null;
                    })()}
                    {selectedModality && (
                      <div style={{
                        background: '#F8FBFE',
                        borderRadius: '0.5rem',
                        padding: '1.5rem',
                        border: '1px solid #282B34',
                        marginTop: '1rem',
                        marginBottom: '1rem'
                      }}>
                        <h3 style={{
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: '#282B34',
                          marginBottom: '1rem',
                          textAlign: 'center'
                        }}>
                          Select Units
                        </h3>
                        
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                          gap: '0.75rem'
                        }}>
                          {(() => {
                            return null;
                          })()}
                          {scoreUnits && Array.isArray(scoreUnits) && scoreUnits.length > 0 ? (
                            scoreUnits.map((unit: any) => {
                              return (
                                <button
                                  key={unit.value}
                                  onClick={() => {
                                    setTimeTrialSelectedUnit(unit.value);
                                    // Save preference
                                    if (connected) {
                                      engineDatabaseService.saveUnitPreferenceForModality(selectedModality, unit.value).catch(err => {
                                        console.error('Error saving unit preference:', err);
                                      });
                                    }
                                  }}
                                  disabled={timeTrialLoadingPreference}
                                  style={{
                                    padding: '0.75rem 1rem',
                                    borderRadius: '0.375rem',
                                    border: '2px solid',
                                    borderColor: timeTrialSelectedUnit === unit.value ? '#FE5858' : '#d1d5db',
                                    background: timeTrialSelectedUnit === unit.value ? '#FE5858' : '#DAE2EA',
                                    color: timeTrialSelectedUnit === unit.value ? '#F8FBFE' : '#282B34',
                                    fontWeight: '600',
                                    fontSize: '0.875rem',
                                    cursor: timeTrialLoadingPreference ? 'not-allowed' : 'pointer',
                                    opacity: timeTrialLoadingPreference ? 0.5 : 1,
                                    transition: 'all 0.2s ease',
                                    textAlign: 'center'
                                  }}
                                  onMouseEnter={(e: any) => {
                                    if (!timeTrialLoadingPreference && timeTrialSelectedUnit !== unit.value) {
                                      e.target.style.borderColor = '#FE5858';
                                      e.target.style.transform = 'translateY(-1px)';
                                    }
                                  }}
                                  onMouseLeave={(e: any) => {
                                    if (!timeTrialLoadingPreference && timeTrialSelectedUnit !== unit.value) {
                                      e.target.style.borderColor = '#d1d5db';
                                      e.target.style.transform = 'translateY(0)';
                                    }
                                  }}
                                >
                                  {unit.label}
                                </button>
                              );
                            })
                          ) : (
                            <div style={{ color: '#282B34', textAlign: 'center', padding: '1rem' }}>
                              {scoreUnits ? 'No units available' : 'Loading units...'}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Next Button - show when modality AND unit selected */}
                    {selectedModality && timeTrialSelectedUnit && (
                      <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                        <button
                          onClick={() => setCurrentView('preview')}
                          style={{
                            padding: '0.75rem 2rem',
                            fontSize: '1rem',
                            fontWeight: '600',
                            color: '#ffffff',
                            background: '#FE5858',
                            border: 'none',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}
                        >
                          Next
                          <ArrowRight style={{ width: '1.25rem', height: '1.25rem' }} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Time Trial Preview View */}
              {currentView === 'preview' && workout?.day_type === 'time_trial' && selectedModality && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{
                    background: 'white',
                    borderRadius: '0.75rem',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    padding: '1.5rem',
                    border: '1px solid #e5e7eb'
                  }}>
                    {/* Equipment Section Header */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      padding: '0.5rem 1rem',
                      background: '#DAE2EA',
                      borderRadius: '0.5rem',
                      marginBottom: '1.5rem'
                    }}>
                      <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Equipment:</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#282B34' }}>
                        {modalities.find(m => m.value === selectedModality)?.label || 'Not selected'}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedModality('');
                          setCurrentView('equipment');
                        }}
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem',
                          color: '#FE5858',
                          background: 'transparent',
                          border: '1px solid #FE5858',
                          borderRadius: '0.25rem',
                          cursor: 'pointer'
                        }}
                      >
                        Change
                      </button>
                    </div>

                    {/* Training Summary Section */}
                    {baselines[selectedModality] && (
                      <div style={{
                        background: '#DAE2EA',
                        borderRadius: '1rem',
                        boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        padding: '1.5rem',
                        border: '1px solid #282B34',
                        marginBottom: '1.5rem'
                      }}>
                        {/* Collapsible Header */}
                        <button
                          onClick={() => setExpandedSummary(!expandedSummary)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            padding: '0.75rem',
                            background: '#F8FBFE',
                            border: '1px solid #FE5858',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            marginBottom: '0.75rem',
                            transition: 'all 0.2s ease',
                            position: 'relative'
                          }}
                          onMouseEnter={(e: any) => {
                            e.target.style.background = '#cbd5e1';
                          }}
                          onMouseLeave={(e: any) => {
                            e.target.style.background = '#F8FBFE';
                          }}
                        >
                          <span style={{ fontSize: '1rem', color: '#282B34', fontWeight: '700' }}>
                            Training Summary
                          </span>
                          <div style={{ position: 'absolute', right: '0.75rem' }}>
                            {expandedSummary ? (
                              <ChevronUp size={20} color="#282B34" />
                            ) : (
                              <ChevronDown size={20} color="#282B34" />
                            )}
                          </div>
                        </button>
                        
                        {expandedSummary && (
                          <div>
                            {/* Work Duration */}
                            <div style={{
                              background: 'white',
                              borderRadius: '0.5rem',
                              padding: '0.75rem',
                              border: '1px solid #FE5858',
                              marginBottom: '0.75rem'
                            }}>
                              <div style={{
                                fontSize: '0.75rem',
                                color: '#282B34',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginBottom: '0.25rem',
                                fontWeight: '500'
                              }}>Work Duration</div>
                              <div style={{
                                fontSize: '1.5rem',
                                fontWeight: 'bold',
                                color: '#282B34'
                              }}>
                                10:00
                              </div>
                            </div>
                            {/* Target Pace */}
                            {baselines[selectedModality]?.baseline && (
                              <div style={{
                                background: 'white',
                                borderRadius: '0.5rem',
                                padding: '0.75rem',
                                border: '1px solid #FE5858'
                              }}>
                                <div style={{
                                  fontSize: '0.75rem',
                                  color: '#282B34',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em',
                                  marginBottom: '0.25rem',
                                  fontWeight: '500'
                                }}>Target Pace</div>
                                <div style={{
                                  fontSize: '1.5rem',
                                  fontWeight: 'bold',
                                  color: '#282B34'
                                }}>
                                  {Math.round(baselines[selectedModality].baseline)} {baselines[selectedModality].units || 'units'}/min
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Time Trial History Section */}
                    {selectedModality && (
                      <div style={{
                        background: '#DAE2EA',
                        borderRadius: '1rem',
                        boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        padding: '1.5rem',
                        border: '1px solid #282B34',
                        position: 'relative',
                        marginBottom: '1.5rem'
                      }}>
                        {/* Collapsible Header */}
                        <button
                          onClick={() => setExpandedHistory(!expandedHistory)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            padding: '0.75rem',
                            background: '#F8FBFE',
                            border: '1px solid #FE5858',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            marginBottom: '0.75rem',
                            transition: 'all 0.2s ease',
                            position: 'relative'
                          }}
                          onMouseEnter={(e: any) => {
                            e.target.style.background = '#cbd5e1';
                          }}
                          onMouseLeave={(e: any) => {
                            e.target.style.background = '#F8FBFE';
                          }}
                        >
                          <span style={{ fontSize: '1rem', color: '#282B34', fontWeight: '700' }}>
                            Time Trial History
                          </span>
                          <div style={{ position: 'absolute', right: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {workoutHistory.length > 0 && (
                              <div style={{
                                background: '#FE5858',
                                color: '#F8FBFE',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '9999px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: '1.5rem'
                              }}>
                                {workoutHistory.length}
                              </div>
                            )}
                            {expandedHistory ? (
                              <ChevronUp size={20} color="#282B34" />
                            ) : (
                              <ChevronDown size={20} color="#282B34" />
                            )}
                          </div>
                        </button>
                        
                        {expandedHistory && (
                          <div>
                            {workoutHistory.length > 0 ? (
                              <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.75rem',
                                maxHeight: '16rem',
                                overflowY: 'auto'
                              }}>
                                {workoutHistory.slice(0, 5).map((session, index) => (
                                  <div 
                                    key={session.id || index} 
                                    style={{
                                      padding: '1rem',
                                      background: '#F8FBFE',
                                      borderRadius: '0.75rem',
                                      border: '1px solid #e5e7eb',
                                      transition: 'all 0.2s ease'
                                    }}
                                  >
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: '0.75rem',
                                      flexWrap: 'wrap'
                                    }}>
                                      <span style={{
                                        fontSize: '0.875rem',
                                        fontWeight: '600',
                                        color: '#111827',
                                        flex: '0 0 auto'
                                      }}>
                                        {session.date ? new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown Date'}
                                      </span>
                                      <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        flex: '1 1 auto',
                                        justifyContent: 'flex-end'
                                      }}>
                                        {session.actual_pace && (
                                          <span style={{
                                            fontSize: '0.875rem',
                                            fontWeight: 'bold',
                                            color: '#282B34',
                                            background: '#F8FBFE',
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '0.5rem',
                                            border: '1px solid #FE5858'
                                          }}>
                                            {session.actual_pace.toFixed(1)} {baselines[selectedModality]?.units || 'units'}/min
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{
                                textAlign: 'center',
                                padding: '2rem 0',
                                color: '#6b7280'
                              }}>
                                <History size={48} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                                <p style={{ fontSize: '0.875rem' }}>No previous sessions for this workout type</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Workout Breakdown Section */}
                    {selectedModality && (
                      <div style={{
                        background: '#DAE2EA',
                        borderRadius: '1rem',
                        boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        padding: '1.5rem',
                        border: '1px solid #282B34',
                        marginBottom: '1.5rem'
                      }}>
                        {/* Collapsible Header */}
                        <button
                          onClick={() => setExpandedBreakdown(!expandedBreakdown)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            padding: '0.75rem',
                            background: '#F8FBFE',
                            border: '1px solid #FE5858',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            marginBottom: '0.75rem',
                            transition: 'all 0.2s ease',
                            position: 'relative'
                          }}
                          onMouseEnter={(e: any) => {
                            e.target.style.background = '#cbd5e1';
                          }}
                          onMouseLeave={(e: any) => {
                            e.target.style.background = '#F8FBFE';
                          }}
                        >
                          <span style={{ fontSize: '1rem', color: '#282B34', fontWeight: '700' }}>
                            Workout Breakdown
                          </span>
                          <div style={{ position: 'absolute', right: '0.75rem' }}>
                            {expandedBreakdown ? (
                              <ChevronUp size={20} color="#282B34" />
                            ) : (
                              <ChevronDown size={20} color="#282B34" />
                            )}
                          </div>
                        </button>
                        
                        {expandedBreakdown && (
                          <div>
                            <div style={{
                              padding: '1rem',
                              background: '#F8FBFE',
                              borderRadius: '0.75rem',
                              border: '1px solid #e5e7eb',
                              transition: 'all 0.2s ease'
                            }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.75rem',
                                flexWrap: 'wrap'
                              }}>
                                <span style={{
                                  fontSize: '0.875rem',
                                  fontWeight: '600',
                                  color: '#111827',
                                  flex: '0 0 auto'
                                }}>
                                  Duration
                                </span>
                                <span style={{ fontSize: '0.875rem', color: '#6b7280', flex: '0 0 auto' }}>
                                  10:00
                                </span>
                              </div>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.75rem',
                                flexWrap: 'wrap',
                                marginTop: '0.75rem'
                              }}>
                                <span style={{
                                  fontSize: '0.875rem',
                                  fontWeight: '600',
                                  color: '#111827',
                                  flex: '0 0 auto'
                                }}>
                                  Effort Level
                                </span>
                                <div style={{
                                  fontSize: '0.875rem',
                                  fontWeight: 'bold',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '0.25rem',
                                  background: '#FE5858',
                                  color: '#F8FBFE'
                                }}>
                                  Maximum Effort
                                </div>
                              </div>
                              {baselines[selectedModality]?.baseline && (
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '0.75rem',
                                  flexWrap: 'wrap',
                                  marginTop: '0.75rem'
                                }}>
                                  <span style={{
                                    fontSize: '0.875rem',
                                    fontWeight: '600',
                                    color: '#111827',
                                    flex: '0 0 auto'
                                  }}>
                                    Target Pace
                                  </span>
                                  <span style={{
                                    fontSize: '0.875rem',
                                    fontWeight: 'bold',
                                    color: '#282B34',
                                    background: '#F8FBFE',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '0.5rem',
                                    border: '1px solid #FE5858'
                                  }}>
                                    {Math.round(baselines[selectedModality].baseline)} {baselines[selectedModality].units}/min
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Next Button */}
                    <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: '1.5rem' }}>
                      <button
                        onClick={() => setCurrentView('active')}
                        disabled={!selectedModality}
                        style={{
                          background: '#FE5858',
                          color: 'white',
                          padding: '0.75rem 2rem',
                          borderRadius: '0.5rem',
                          border: 'none',
                          fontWeight: '600',
                          fontSize: '0.875rem',
                          cursor: !selectedModality ? 'not-allowed' : 'pointer',
                          opacity: !selectedModality ? 0.5 : 1,
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                      >
                        Next
                        <ArrowRight style={{ width: '1.25rem', height: '1.25rem' }} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Time Trial Active View - 10-minute timer */}
              {currentView === 'active' && workout?.day_type === 'time_trial' && !isCompleted && (
                <div className="space-y-6" style={{ marginTop: '1rem' }}>
                  {/* Workout Controls */}
                  <div style={{
                    background: 'white',
                    borderRadius: '0.75rem',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    padding: '1.5rem',
                    border: '1px solid #282B34',
                    marginTop: '1.5rem',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {!isActive && !isCompleted && !isPaused && (
                        <button onClick={resumeWorkout} disabled={!selectedModality} style={{ width: '100%', background: 'linear-gradient(135deg, #16a34a 0%, #059669 100%)', color: 'white', padding: '1rem 1.5rem', borderRadius: '0.75rem', border: 'none', fontWeight: '600', fontSize: '0.875rem', cursor: !selectedModality ? 'not-allowed' : 'pointer', opacity: !selectedModality ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', transition: 'all 0.2s ease' }}
                          onMouseEnter={(e: any) => {
                            if (selectedModality) {
                              e.target.style.background = 'linear-gradient(135deg, #15803d 0%, #047857 100%)';
                              e.target.style.transform = 'translateY(-2px)';
                              e.target.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                            }
                          }}
                          onMouseLeave={(e: any) => {
                            if (selectedModality) {
                              e.target.style.background = 'linear-gradient(135deg, #16a34a 0%, #059669 100%)';
                              e.target.style.transform = 'translateY(0)';
                              e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                            }
                          }}
                        >
                          <Play style={{ width: '1.25rem', height: '1.25rem' }} />
                          Start Workout
                        </button>
                      )}
                      {isActive && !isCompleted && (
                        <button onClick={pauseWorkout} style={{ width: '100%', background: '#DAE2EA', color: '#282B34', padding: '1rem 1.5rem', borderRadius: '0.75rem', border: 'none', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', transition: 'all 0.2s ease' }}
                          onMouseEnter={(e: any) => {
                            e.target.style.background = '#cbd5e1';
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                          }}
                          onMouseLeave={(e: any) => {
                            e.target.style.background = '#DAE2EA';
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                          }}
                        >
                          <Pause style={{ width: '1.25rem', height: '1.25rem', color: '#282B34' }} />
                          Pause
                        </button>
                      )}
                      {isPaused && !isCompleted && (
                        <button onClick={resumeWorkout} style={{ width: '100%', background: 'linear-gradient(135deg, #16a34a 0%, #059669 100%)', color: 'white', padding: '1rem 1.5rem', borderRadius: '0.75rem', border: 'none', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', transition: 'all 0.2s ease' }}
                          onMouseEnter={(e: any) => {
                            e.target.style.background = 'linear-gradient(135deg, #15803d 0%, #047857 100%)';
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                          }}
                          onMouseLeave={(e: any) => {
                            e.target.style.background = 'linear-gradient(135deg, #16a34a 0%, #059669 100%)';
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                          }}
                        >
                          <Play style={{ width: '1.25rem', height: '1.25rem' }} />
                          Resume
                        </button>
                      )}

                      {/* Skip to End button - only show when workout is active (for testing) */}
                      {(isActive || isPaused) && (
                        <button
                          onClick={skipToEnd}
                          style={{
                            width: '100%',
                            background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)',
                            color: 'white',
                            padding: '1rem 1.5rem',
                            borderRadius: '0.75rem',
                            border: 'none',
                            fontWeight: '600',
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e: any) => {
                            e.target.style.background = 'linear-gradient(135deg, #7e22ce 0%, #db2777 100%)';
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                          }}
                          onMouseLeave={(e: any) => {
                            e.target.style.background = 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)';
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                          }}
                          title="Skip to end and enter results manually (for testing)"
                        >
                          <Zap style={{ width: '1.25rem', height: '1.25rem' }} />
                          Skip to End (Test)
                        </button>
                      )}
                      
                      <button onClick={resetTimeTrial} style={{ width: '100%', background: '#282B34', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '0.75rem', border: 'none', fontWeight: '500', fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', transition: 'all 0.2s ease' }}
                        onMouseEnter={(e: any) => {
                          e.target.style.background = '#1a1d23';
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                        }}
                        onMouseLeave={(e: any) => {
                          e.target.style.background = '#282B34';
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                        }}
                      >
                        <RotateCcw style={{ width: '1.25rem', height: '1.25rem' }} />
                        Reset
                      </button>
                    </div>
                  </div>
                  
                  {/* Timer Display */}
                  <div className="text-center mb-6">
                    <div className="relative w-48 h-48 mx-auto mb-4">
                      <svg className="w-48 h-48" viewBox="0 0 192 192" style={{ display: 'block', position: 'relative', zIndex: 1 }}>
                        <g transform="rotate(-90 96 96)">
                          <circle cx="96" cy="96" r="88" stroke="#e5e7eb" strokeWidth="8" fill="none" />
                          {(() => {
                            const progress = ((600 - timeRemaining) / 600) * 100;
                            const circumference = 2 * Math.PI * 88;
                            const offset = circumference - (progress / 100) * circumference;
                            const strokeColor = isCompleted ? '#10b981' : '#FE5858';
                            return (
                              <circle cx="96" cy="96" r="88" stroke={strokeColor} strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: 'all 1s ease-out' }} />
                            );
                          })()}
                        </g>
                        <text x="96" y="65" textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="600" fill="#282B34">Time Trial</text>
                        <text x="96" y="96" textAnchor="middle" dominantBaseline="middle" fontSize="48" fontWeight="bold" fill="#111827">
                          {(() => {
                            const mins = Math.floor(timeRemaining / 60);
                            const secs = timeRemaining % 60;
                            return `${mins.toString()}:${secs.toString().padStart(2, '0')}`;
                          })()}
                        </text>
                        <text x="96" y="128" textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="600" fill={isCompleted ? '#10b981' : isActive ? '#FE5858' : '#6b7280'} style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {isCompleted ? 'Completed' : isActive ? 'Work' : isPaused ? 'Paused' : 'Ready'}
                        </text>
                      </svg>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Time Trial Completed View - Show results entry when completed */}
              {currentView === 'active' && workout?.day_type === 'time_trial' && isCompleted && (
                <div className="space-y-6" style={{ marginTop: '1rem' }}>
                  {/* Results Entry - show when completed */}
                  {!timeTrialSaveSuccess && (
                    <div style={{ marginTop: '2rem' }}>
                      <div style={{ background: '#DAE2EA', borderRadius: '0.75rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', padding: '1.5rem', border: '1px solid #282B34', marginBottom: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827', marginBottom: '1.5rem' }}>Workout Results</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem', margin: '0 auto 1.5rem auto', maxWidth: '100%', width: '100%' }}>
                          <div style={{ minWidth: 0 }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#111827', marginBottom: '0.375rem', textAlign: 'center' }}>Score</label>
                            <input type="number" value={timeTrialScore} onChange={(e: any) => setTimeTrialScore(e.target.value)} step="0.1" min="0" style={{ width: '100%', padding: '0.625rem 0.75rem', border: '1px solid #282B34', borderRadius: '0.5rem', fontSize: '0.9375rem', fontWeight: '500', background: 'white', textAlign: 'center', boxSizing: 'border-box' }} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#111827', marginBottom: '0.375rem', textAlign: 'center' }}>Avg HR</label>
                            <input type="number" value={timeTrialAverageHeartRate} onChange={(e: any) => setTimeTrialAverageHeartRate(e.target.value)} step="1" min="0" max="220" style={{ width: '100%', padding: '0.625rem 0.75rem', border: '1px solid #282B34', borderRadius: '0.5rem', fontSize: '0.9375rem', fontWeight: '500', background: 'white', textAlign: 'center', boxSizing: 'border-box' }} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#111827', marginBottom: '0.375rem', textAlign: 'center' }}>Peak HR</label>
                            <input type="number" value={timeTrialPeakHeartRate} onChange={(e: any) => setTimeTrialPeakHeartRate(e.target.value)} step="1" min="0" max="220" style={{ width: '100%', padding: '0.625rem 0.75rem', border: '1px solid #282B34', borderRadius: '0.5rem', fontSize: '0.9375rem', fontWeight: '500', background: 'white', textAlign: 'center', boxSizing: 'border-box' }} />
                          </div>
                        </div>
                        
                        {/* RPE Slider - Larger and Easier to Use */}
                        <div style={{ marginBottom: '1.5rem' }}>
                          <label htmlFor="timeTrialPerceivedExertion" style={{
                            display: 'block',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            color: '#111827',
                            marginBottom: '1rem'
                          }}>
                            Rate of Perceived Exertion (RPE): <span style={{ fontWeight: '700', color: '#FE5858', fontSize: '1rem' }}>{timeTrialRpeValue}</span>/10
                          </label>
                          <div style={{ padding: '0.5rem 0', position: 'relative' }}>
                            {/* Track line background */}
                            <div style={{
                              position: 'absolute',
                              top: '50%',
                              left: '0',
                              right: '0',
                              height: '8px',
                              backgroundColor: '#FE5858',
                              borderRadius: '9999px',
                              transform: 'translateY(-50%)',
                              zIndex: 0
                            }} />
                            <input
                              type="range"
                              id="timeTrialPerceivedExertion"
                              name="timeTrialPerceivedExertion"
                              min="1"
                              max="10"
                              step="1"
                              value={timeTrialRpeValue}
                              onChange={(e: any) => {
                                setTimeTrialRpeValue(parseInt(e.target.value));
                              }}
                              style={{
                                width: '100%',
                                height: '20px',
                                WebkitAppearance: 'none',
                                appearance: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                outline: 'none',
                                position: 'relative',
                                zIndex: 1
                              }}
                            />
                          </div>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.75rem',
                            color: '#282B34',
                            fontWeight: 'bold',
                            marginTop: '0.75rem',
                            padding: '0 0.25rem'
                          }}>
                            <span>1 - Very Easy</span>
                            <span>5 - Moderate</span>
                            <span>10 - Max Effort</span>
                          </div>
                          <style>{`
                            input[type="range"]#timeTrialPerceivedExertion {
                              -webkit-appearance: none;
                              appearance: none;
                              background: transparent;
                              cursor: pointer;
                            }
                            input[type="range"]#timeTrialPerceivedExertion::-webkit-slider-track {
                              width: 100%;
                              height: 8px;
                              background: #FE5858;
                              border-radius: 9999px;
                              border: none;
                              margin-top: 0px;
                            }
                            input[type="range"]#timeTrialPerceivedExertion::-moz-range-track {
                              width: 100%;
                              height: 8px;
                              background: #FE5858;
                              border-radius: 9999px;
                              border: none;
                            }
                            input[type="range"]#timeTrialPerceivedExertion::-webkit-slider-thumb {
                              -webkit-appearance: none;
                              appearance: none;
                              width: 32px;
                              height: 32px;
                              border-radius: 50%;
                              background: linear-gradient(135deg, #f87171 0%, #FE5858 100%);
                              border: 4px solid white;
                              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), 0 0 0 2px rgba(254, 88, 88, 0.2);
                              cursor: pointer;
                              transition: all 0.2s;
                              margin-top: -12px;
                            }
                            input[type="range"]#timeTrialPerceivedExertion::-webkit-slider-thumb:hover {
                              transform: scale(1.15);
                              box-shadow: 0 4px 12px rgba(254, 88, 88, 0.5), 0 0 0 4px rgba(254, 88, 88, 0.2);
                            }
                            input[type="range"]#timeTrialPerceivedExertion::-webkit-slider-thumb:active {
                              transform: scale(1.05);
                            }
                            input[type="range"]#timeTrialPerceivedExertion::-moz-range-thumb {
                              width: 32px;
                              height: 32px;
                              border-radius: 50%;
                              background: linear-gradient(135deg, #f87171 0%, #FE5858 100%);
                              border: 4px solid white;
                              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), 0 0 0 2px rgba(254, 88, 88, 0.2);
                              cursor: pointer;
                              transition: all 0.2s;
                            }
                            input[type="range"]#timeTrialPerceivedExertion::-moz-range-thumb:hover {
                              transform: scale(1.15);
                              box-shadow: 0 4px 12px rgba(254, 88, 88, 0.5), 0 0 0 4px rgba(254, 88, 88, 0.2);
                            }
                            input[type="range"]#timeTrialPerceivedExertion::-moz-range-thumb:active {
                              transform: scale(1.05);
                            }
                          `}</style>
                        </div>
                        
                        <button onClick={submitTimeTrial} disabled={timeTrialIsSubmitting || !connected || !timeTrialScore || !selectedModality} style={{ width: '100%', background: '#FE5858', color: '#F8FBFE', padding: '1rem 1.5rem', borderRadius: '0.75rem', border: 'none', fontWeight: '600', fontSize: '0.875rem', cursor: (timeTrialIsSubmitting || !connected || !timeTrialScore || !selectedModality) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: (timeTrialIsSubmitting || !connected || !timeTrialScore || !selectedModality) ? 0.5 : 1 }}>
                          <CheckCircle style={{ width: '1.25rem', height: '1.25rem' }} />
                          {timeTrialIsSubmitting ? 'Saving...' : 'Save Results'}
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Workout Summary Card - show when saved */}
                  {timeTrialSaveSuccess && timeTrialScore && (
                    <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                      {/* Workout Summary Card */}
                      <div style={{
                        background: '#DAE2EA',
                        borderRadius: '0.75rem',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                        padding: '1.5rem',
                        border: '1px solid #282B34',
                        marginBottom: '1.5rem'
                      }}>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1rem'
                        }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            color: '#282B34'
                          }}>
                            <span>Total output:</span>
                            <span style={{ fontWeight: '700', color: '#282B34' }}>{parseFloat(timeTrialScore).toFixed(2)} {selectedModality && baselines[selectedModality] ? baselines[selectedModality].units : ''}</span>
                          </div>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            color: '#282B34'
                          }}>
                            <span>Average pace:</span>
                            <span style={{ fontWeight: '700', color: '#282B34' }}>{(parseFloat(timeTrialScore) / 10).toFixed(2)} {selectedModality && baselines[selectedModality] ? baselines[selectedModality].units + '/min' : ''}</span>
                          </div>
                          {timeTrialAverageHeartRate && (
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '0.875rem',
                              fontWeight: '600',
                              color: '#282B34'
                            }}>
                              <span>Average HR:</span>
                              <span style={{ fontWeight: '700', color: '#282B34' }}>{timeTrialAverageHeartRate} bpm</span>
                            </div>
                          )}
                          {timeTrialPeakHeartRate && (
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '0.875rem',
                              fontWeight: '600',
                              color: '#282B34'
                            }}>
                              <span>Peak HR:</span>
                              <span style={{ fontWeight: '700', color: '#282B34' }}>{timeTrialPeakHeartRate} bpm</span>
                            </div>
                          )}
                          {timeTrialRpeValue && (
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '0.875rem',
                              fontWeight: '600',
                              color: '#282B34'
                            }}>
                              <span>RPE:</span>
                              <span style={{ fontWeight: '700', color: '#282B34' }}>{timeTrialRpeValue}/10</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Success Message */}
                  {timeTrialSaveSuccess && (
                    <div style={{ background: '#DAE2EA', border: '1px solid #282B34', borderRadius: '0.75rem', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                      <CheckCircle style={{ width: '1.25rem', height: '1.25rem', color: '#FE5858', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#282B34' }}>Workout logged successfully!</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Regular Workout UI */
          <>
        {/* Equipment Selection View */}
        {currentView === 'equipment' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Select Equipment
              </h2>
              
              {/* Equipment Category Buttons */}
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '0.5rem',
                marginBottom: '1rem',
                flexWrap: 'wrap'
              }}>
                {['Rowing', 'Cycling', 'Ski', 'Running'].map((category: any) => {
                  const categoryModalities = modalities.filter((m: any) => m.category === category);
                  const isSelected = selectedModality && modalities.find(m => m.value === selectedModality)?.category === category;
                  const isExpanded = expandedCategory === category;
                  
                  // Map category names to shorter display labels
                  const labelMap: Record<string, string> = {
                    'Rowing': 'Row',
                    'Cycling': 'Cycle',
                    'Ski': 'Ski',
                    'Running': 'Run'
                  };
                  
                  return (
                    <button
                      key={category}
                      onClick={() => {
                        // Toggle category expansion and clear selection if deselecting
                        if (expandedCategory === category) {
                          setExpandedCategory('');
                          setSelectedModality('');
                        } else {
                          setExpandedCategory(category);
                          // Don't auto-select - user must click specific equipment
                        }
                      }}
                      disabled={isActive || isCompleted}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        border: '2px solid',
                        borderColor: (isSelected || isExpanded) ? '#FE5858' : '#e5e7eb',
                        background: '#DAE2EA',
                        color: '#282B34',
                        fontWeight: '600',
                        fontSize: '0.875rem',
                        cursor: (isActive || isCompleted) ? 'not-allowed' : 'pointer',
                        opacity: (isActive || isCompleted) ? 0.5 : 1,
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        flex: '1 1 0',
                        minWidth: '0'
                      }}
                      onMouseEnter={(e: any) => {
                        if (!isActive && !isCompleted) {
                          e.target.style.transform = 'translateY(-1px)';
                          e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                        }
                      }}
                      onMouseLeave={(e: any) => {
                        if (!isActive && !isCompleted) {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = 'none';
                        }
                      }}
                    >
                      {labelMap[category]}
                      {isSelected && <CheckCircle style={{ width: '1rem', height: '1rem', color: '#FE5858' }} />}
                    </button>
                  );
                })}
              </div>
              
              {/* Equipment Sub-menu */}
              {(expandedCategory || selectedModality) && (
                <div style={{
                  background: '#F8FBFE',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  border: '1px solid #282B34',
                  marginBottom: '1rem'
                }}>
                  <h3 style={{
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#282B34',
                    marginBottom: '0.75rem'
                  }}>
                    {(expandedCategory || modalities.find(m => m.value === selectedModality)?.category)} Equipment
                  </h3>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '0.5rem'
                  }}>
                    {modalities
                      .filter((m: any) => m.category === (expandedCategory || modalities.find(mod => mod.value === selectedModality)?.category))
                      .map((modality: any) => (
                        <button
                          key={modality.value}
                          onClick={() => {
                            setSelectedModality(modality.value);
                            setExpandedCategory(''); // Clear expanded category when equipment is selected
                          }}
                          disabled={isActive || isCompleted}
                          style={{
                            padding: '0.75rem',
                            borderRadius: '0.375rem',
                            border: '1px solid',
                            borderColor: selectedModality === modality.value ? '#FE5858' : '#d1d5db',
                            background: '#DAE2EA',
                            color: '#282B34',
                            fontWeight: '600',
                            fontSize: '0.875rem',
                            cursor: (isActive || isCompleted) ? 'not-allowed' : 'pointer',
                            opacity: (isActive || isCompleted) ? 0.5 : 1,
                            transition: 'all 0.2s ease',
                            textAlign: 'left'
                          }}
                          onMouseEnter={(e: any) => {
                            if (!isActive && !isCompleted && selectedModality !== modality.value) {
                              e.target.style.background = '#cbd5e1';
                            }
                          }}
                          onMouseLeave={(e: any) => {
                            if (!isActive && !isCompleted && selectedModality !== modality.value) {
                              e.target.style.background = '#DAE2EA';
                            }
                          }}
                        >
                          {modality.label}
                        </button>
                      ))}
                  </div>
                </div>
              )}
              
              {/* Warning message when no baseline exists for selected modality */}
              {(() => {
                return null;
              })()}
              {selectedModality && workout?.day_type !== 'time_trial' && !baselines[selectedModality] && (
                <div style={{
                  background: '#DAE2EA',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  border: '1px solid #FE5858',
                  marginTop: '1rem',
                  marginBottom: '1rem'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: '#282B34',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}>
                    <AlertCircle style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0, color: '#FE5858' }} />
                    <span>
                      You have not completed a time trial for <strong>{modalities.find(m => m.value === selectedModality)?.label || selectedModality}</strong>, so some analytics will not be available. To use all Analytics features, complete a Time Trial with <strong>{modalities.find(m => m.value === selectedModality)?.label || selectedModality}</strong>.
                    </span>
                  </div>
                </div>
              )}
              
              {/* Previous Sessions - Show after equipment is selected */}
              {selectedModality && baselines[selectedModality] && (
                <div className="mt-6">
                  <div style={{
                    background: '#F8FBFE',
                    borderRadius: '1rem',
                    boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                    padding: '1.5rem',
                    border: '1px solid #282B34',
                    position: 'relative'
                  }}>
                    {/* Session Counter - Upper Right */}
                    {workoutHistory.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '1.5rem',
                        right: '1.5rem',
                        background: '#FE5858',
                        color: '#F8FBFE',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '9999px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '1.5rem'
                      }}>
                        {workoutHistory.length}
                      </div>
                    )}
                    
                    <h2 style={{
                      fontSize: '1.125rem',
                      fontWeight: '600',
                      color: '#111827',
                      marginBottom: '1rem'
                    }}>
                      {workout?.day_type ? `${getWorkoutTypeDisplayName(workout.day_type)} History` : 'Previous Sessions'}
                    </h2>
                    
                    {workoutHistory.length > 0 ? (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        maxHeight: '16rem',
                        overflowY: 'auto'
                      }}>
                        {workoutHistory.slice(0, 5).map((session, index) => (
                          <div 
                            key={session.id || index} 
                            style={{
                              padding: '1rem',
                              background: '#DAE2EA',
                              borderRadius: '0.75rem',
                              border: '1px solid #e5e7eb',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.75rem',
                              flexWrap: 'wrap'
                            }}>
                              <span style={{
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                color: '#111827',
                                flex: '0 0 auto'
                              }}>
                                {session.date ? new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown Date'}
                              </span>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                flex: '1 1 auto',
                                justifyContent: 'flex-end'
                              }}>
                            {session.performance_ratio && (
                                <div style={{
                                  fontSize: '0.875rem',
                                  fontWeight: 'bold',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '0.25rem',
                                  background: '#FE5858',
                                  color: '#F8FBFE'
                                }}>
                                  {(session.performance_ratio * 100).toFixed(1)}%
                              </div>
                            )}
                              {session.actual_pace && (
                                <span style={{
                                  fontSize: '0.875rem',
                                  fontWeight: 'bold',
                                  color: '#282B34',
                                  background: '#F8FBFE',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '0.5rem'
                                }}>
                                  {session.actual_pace.toFixed(1)} {baselines[selectedModality]?.units || 'units'}/min
                                </span>
                              )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{
                        textAlign: 'center',
                        padding: '2rem 0',
                        color: '#6b7280'
                      }}>
                        <History size={48} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                        <p style={{ fontSize: '0.875rem' }}>No previous sessions for this workout type</p>
                      </div>
                    )}

                    {/* Performance Summary */}
                    {selectedModality && baselines[selectedModality] && performanceMetrics?.rolling_avg_ratio && (() => {
                      // Calculate average actual_pace from workout history
                      const sessionsWithPace = workoutHistory.filter((s: any) => s.actual_pace !== null && s.actual_pace !== undefined);
                      const avgPace = sessionsWithPace.length > 0 
                        ? sessionsWithPace.reduce((sum, s) => sum + s.actual_pace, 0) / sessionsWithPace.length 
                        : null;
                      
                      return (
                        <div 
                          style={{
                            marginTop: '1rem',
                            padding: '1rem',
                            background: '#DAE2EA',
                            borderRadius: '0.75rem',
                            border: '2px solid #FE5858',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            flexWrap: 'wrap'
                          }}>
                            <span style={{
                              fontSize: '0.875rem',
                              fontWeight: '600',
                              color: '#111827',
                              flex: '0 0 auto'
                            }}>
                              {workout?.day_type ? `${getWorkoutTypeDisplayName(workout.day_type)} Summary` : 'Summary'}
                            </span>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              flex: '1 1 auto',
                              justifyContent: 'flex-end'
                            }}>
                              <div style={{
                                fontSize: '0.875rem',
                                fontWeight: 'bold',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '0.25rem',
                                background: '#FE5858',
                                color: '#F8FBFE'
                              }}>
                                {(performanceMetrics.rolling_avg_ratio * 100).toFixed(1)}%
                              </div>
                              {avgPace && (
                                <span style={{
                                  fontSize: '0.875rem',
                                  fontWeight: 'bold',
                                  color: '#282B34',
                                  background: '#F8FBFE',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '0.5rem'
                                }}>
                                  {avgPace.toFixed(1)} {baselines[selectedModality]?.units || 'units'}/min
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
              
              {/* Next Button - Proceed to Preview */}
              {selectedModality && (
                <div style={{
                  marginTop: '1.5rem',
                  display: 'flex',
                  justifyContent: 'center'
                }}>
                  <button
                    onClick={() => setCurrentView('preview')}
                    disabled={isActive || isCompleted}
                    style={{
                      padding: '0.75rem 2rem',
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: '#ffffff',
                      background: '#FE5858',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: (isActive || isCompleted) ? 'not-allowed' : 'pointer',
                      opacity: (isActive || isCompleted) ? 0.5 : 1,
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                    onMouseEnter={(e: any) => {
                      if (!isActive && !isCompleted) {
                        e.target.style.background = '#dc2626';
                        e.target.style.transform = 'translateY(-1px)';
                        e.target.style.boxShadow = '0 4px 12px rgba(254, 88, 88, 0.4)';
                      }
                    }}
                    onMouseLeave={(e: any) => {
                      if (!isActive && !isCompleted) {
                        e.target.style.background = '#FE5858';
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = 'none';
                      }
                    }}
                  >
                    Next
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Workout Preview View */}
        {currentView === 'preview' && (
          <div className="space-y-6" style={{ marginTop: '1rem' }}>
            {/* Stage 1: Equipment Selection - Only show when details are not shown */}
            {!showWorkoutDetails && (
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                {/* Simple Summary - Show in Stage 1 */}
                {(() => {
                  const summary = getSimpleWorkoutSummary();
                  if (!summary) return null;
                  
                  // Check if this is a polarized day with bursts
                  const isPolarized = workout?.day_type === 'polarized';
                  const hasBursts = isPolarized && sessionData.intervals.length > 0 && sessionData.intervals[0].burstTiming;
                  const burstInfo = hasBursts ? {
                    timing: sessionData.intervals[0].burstTiming,
                    duration: sessionData.intervals[0].burstDuration || 7
                  } : null;
                  
                  // Multiple blocks - show block-by-block summary
                  if (summary.hasMultipleBlocks && summary.blocks) {
                    return (
                      <div style={{ marginTop: '1rem', marginBottom: '2rem' }}>
                        <div style={{
                          fontSize: '1.125rem',
                          fontWeight: '600',
                          color: '#282B34',
                          marginBottom: '1rem'
                        }}>
                          {summary.totalRounds} {summary.totalRounds === 1 ? 'Round' : 'Rounds'} across {summary.blocks.length} {summary.blocks.length === 1 ? 'Block' : 'Blocks'}
                        </div>
                        {summary.blocks.map((block, index) => (
                          <div key={block.blockNumber} style={{
                            marginBottom: index < summary.blocks.length - 1 ? '1rem' : '0',
                            paddingBottom: index < summary.blocks.length - 1 ? '1rem' : '0',
                            borderBottom: index < summary.blocks.length - 1 ? '1px solid #e5e7eb' : 'none'
                          }}>
                            <div style={{
                              fontSize: '1rem',
                              fontWeight: '600',
                              color: '#282B34',
                              marginBottom: '0.25rem'
                            }}>
                              Block {block.blockNumber}: {block.roundCount} {block.roundCount === 1 ? 'Round' : 'Rounds'}
                            </div>
                            <div style={{
                              fontSize: '0.9375rem',
                              color: '#6b7280'
                            }}>
                              Work {formatTime(block.workDuration)}
                              {block.restDuration > 0 && `  Rest ${formatTime(block.restDuration)}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  
                  // Single block - show simple summary
                  return (
                    <div style={{ marginTop: '1rem', marginBottom: '2rem' }}>
                      <div style={{
                        fontSize: '1.125rem',
                        fontWeight: '600',
                        color: '#282B34',
                        marginBottom: '0.5rem'
                      }}>
                        {summary.totalRounds} {summary.totalRounds === 1 ? 'Round' : 'Rounds'}
                      </div>
                      <div style={{
                        fontSize: '1rem',
                        color: '#6b7280'
                      }}>
                        Work {formatTime(summary.workDuration ?? 0)}
                         {(summary.restDuration ?? 0) > 0 && `  Rest ${formatTime(summary.restDuration ?? 0)}`}
                        {burstInfo && (
                          <span>
                            {' • '}
                            Bursts {formatBurstTiming(burstInfo.timing ?? null)} ({burstInfo.duration}s)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
                
                {/* Burst Information for Polarized Days */}
                {workout?.day_type === 'polarized' && sessionData.intervals.length > 0 && sessionData.intervals[0].burstTiming && (() => {
                  const interval = sessionData.intervals[0];
                  const totalDuration = interval.duration || 0;
                  const burstTiming = interval.burstTiming ?? null;
                  const burstDuration = interval.burstDuration || 7;
                  const burstTimes = calculateBurstTimes(burstTiming, totalDuration, burstDuration);
                  
                  return (
                    <div style={{
                      background: 'white',
                      borderRadius: '0.5rem',
                      padding: '1rem',
                      border: '1px solid #e5e7eb',
                      marginBottom: '2rem'
                    }}>
                      <h3 style={{
                        fontWeight: '600',
                        color: '#282B34',
                        marginBottom: '0.5rem',
                        fontSize: '1.125rem'
                      }}>
                        Burst Information
                      </h3>
                      
                      {/* Timeline Bar */}
                      <div style={{
                        position: 'relative',
                        width: '100%',
                        minHeight: '4.5rem',
                        marginBottom: '0',
                        paddingTop: '1.5rem',
                        paddingBottom: '0.5rem',
                        overflow: 'visible'
                      }}>
                        {/* Base workout duration bar */}
                        <div style={{
                          position: 'absolute',
                          left: 0,
                          top: '1.5rem',
                          width: '100%',
                          height: '3rem',
                          background: '#FE5858',
                          borderRadius: '0.5rem'
                        }} />
                        
                        {/* Burst markers */}
                        {burstTimes.map((burst, index) => {
                          const startPercent = (burst.start / totalDuration) * 100;
                          const durationPercent = (burstDuration / totalDuration) * 100;
                          
                          return (
                            <div key={index}>
                              {/* Burst marker */}
                              <div
                  style={{
                                  position: 'absolute',
                                  left: `${startPercent}%`,
                                  top: '1.5rem',
                                  width: `${Math.max(durationPercent, 2)}%`,
                                  height: '3rem',
                                  background: '#F8FBFE',
                                  borderRadius: '0.5rem',
                                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                                }}
                              />
                              {/* Burst time label */}
                              <div
                                style={{
                                  position: 'absolute',
                                  left: `${startPercent}%`,
                                  top: '0',
                                  transform: 'translateX(-50%)',
                                  fontSize: '0.625rem',
                                  color: '#282B34',
                                  fontWeight: '600',
                                  whiteSpace: 'nowrap'
                  }}
                >
                                {formatTime(burst.start)}
                              </div>
                            </div>
                          );
                        })}
              </div>

                      {/* Text Info Below Graphic */}
                      <div style={{
                        marginTop: '0.5rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid #e5e7eb',
                        textAlign: 'center'
                      }}>
              <div>
                          <div style={{
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: '0.25rem',
                            fontWeight: '500'
                          }}>Burst Intensity</div>
                          <div style={{
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            color: '#282B34'
                          }}>
                            {(interval as any).burstIntensity === 'max_effort' ? 'Max Effort' : 
                             (interval as any).burstIntensity === 'moderate_burst' ? 'Moderate Burst' :
                             (interval as any).burstIntensity || 'Max Effort'}
              </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                
                {/* Flux Information for Flux Days */}
                {(workout?.day_type === 'flux' || workout?.day_type === 'flux_stages') && sessionData.intervals.length > 0 && sessionData.intervals[0].fluxDuration && (() => {
                  const interval = sessionData.intervals[0];
                  const totalDuration = interval.duration || 0;
                  const baseDuration = interval.baseDuration || 300;
                  const fluxDuration = interval.fluxDuration || 60;
                  const fluxPeriods = calculateFluxPeriods(baseDuration, fluxDuration, totalDuration);

                return (
                    <div style={{
                      background: 'white',
                      borderRadius: '0.5rem',
                      padding: '1rem',
                      border: '1px solid #e5e7eb',
                      marginBottom: '2rem',
                      marginTop: '2rem'
                    }}>
                      <h3 style={{
                        fontWeight: '600',
                        color: '#282B34',
                        marginBottom: '0.5rem',
                        fontSize: '1.125rem'
                      }}>
                        Flux Information
                      </h3>
                      
                      {/* Timeline Bar */}
                      <div style={{
                        position: 'relative',
                        width: '100%',
                        minHeight: '6rem',
                        marginBottom: '0.5rem',
                        paddingTop: '1.5rem',
                        paddingBottom: '1.5rem',
                        overflow: 'visible'
                      }}>
                        {/* Base workout duration bar */}
                        <div style={{
                          position: 'absolute',
                          left: 0,
                          top: '1.5rem',
                          width: '100%',
                          height: '3rem',
                          background: '#FE5858',
                          borderRadius: '0.5rem'
                        }} />
                        
                        {/* Flux markers */}
                        {fluxPeriods.filter((p: any) => p.type === 'flux').map((fluxPeriod, index) => {
                          const startPercent = (fluxPeriod.start / totalDuration) * 100;
                          const durationPercent = ((fluxPeriod.end - fluxPeriod.start) / totalDuration) * 100;
                          const fluxStartIntensity = interval.fluxStartIntensity || 0.75;
                          const fluxIncrement = interval.fluxIncrement || 0.05;
                          // Calculate actual intensity for this flux period
                          // Use fixed fluxIntensity if available, otherwise calculate progressively
                          const actualIntensity = interval.fluxIntensity !== null && interval.fluxIntensity !== undefined
                            ? interval.fluxIntensity
                            : fluxStartIntensity + (fluxPeriod.index * fluxIncrement);
                          const intensityPercent = (actualIntensity * 100).toFixed(0);
                            
                            return (
                            <div key={index}>
                              {/* Flux marker */}
                              <div
                                style={{
                                  position: 'absolute',
                                  left: `${startPercent}%`,
                                  top: '1.5rem',
                                  width: `${Math.max(durationPercent, 2)}%`,
                                  height: '3rem',
                                  background: '#F8FBFE',
                                  borderRadius: '0.5rem',
                                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                                }}
                              />
                              {/* Flux time label */}
                              <div
                                style={{
                                  position: 'absolute',
                                  left: `${startPercent}%`,
                                  top: '0',
                                  transform: 'translateX(-50%)',
                                  fontSize: '0.625rem',
                                  color: '#282B34',
                                  fontWeight: '600',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {formatTime(fluxPeriod.start)}
                              </div>
                              {/* Flux intensity label */}
                              <div
                                style={{
                                  position: 'absolute',
                                  left: `${startPercent}%`,
                                  top: '4.5rem',
                                  transform: 'translateX(-50%)',
                                  fontSize: '0.625rem',
                                  color: '#282B34',
                                  fontWeight: '600',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {intensityPercent}%
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                
                {/* Equipment Selection */}
                <div style={{ marginTop: '2rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '1rem' }}>
                  Select Modality
                </h3>
                
                {/* Equipment Category Buttons */}
                                <div style={{
                                  display: 'flex',
                  flexDirection: 'row',
                  gap: '0.5rem',
                  marginBottom: '1rem',
                                  flexWrap: 'wrap'
                                }}>
                  {['Rowing', 'Cycling', 'Ski', 'Running'].map((category: any) => {
                    const categoryModalities = modalities.filter((m: any) => m.category === category);
                    const isSelected = selectedModality && modalities.find(m => m.value === selectedModality)?.category === category;
                    const isExpanded = expandedCategory === category;
                    
                    // Map category names to shorter display labels
                    const labelMap: Record<string, string> = {
                      'Rowing': 'Row',
                      'Cycling': 'Cycle',
                      'Ski': 'Ski',
                      'Running': 'Run'
                    };
                    
                    return (
                      <button
                        key={category}
                        onClick={() => {
                          // Toggle category expansion and clear selection if deselecting
                          if (expandedCategory === category) {
                            setExpandedCategory('');
                            setSelectedModality('');
                            setShowWorkoutDetails(false); // Reset details view
                          } else {
                            setExpandedCategory(category);
                            // Don't auto-select - user must click specific equipment
                          }
                        }}
                        disabled={isActive || isCompleted}
                        style={{
                          padding: '0.75rem',
                          borderRadius: '0.5rem',
                          border: '2px solid',
                          borderColor: (isSelected || isExpanded) ? '#FE5858' : '#e5e7eb',
                          background: '#DAE2EA',
                          color: '#282B34',
                                    fontWeight: '600',
                          fontSize: '0.875rem',
                          cursor: (isActive || isCompleted) ? 'not-allowed' : 'pointer',
                          opacity: (isActive || isCompleted) ? 0.5 : 1,
                          transition: 'all 0.2s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                          justifyContent: 'center',
                                    gap: '0.5rem',
                          flex: '1 1 0',
                          minWidth: '0'
                        }}
                        onMouseEnter={(e: any) => {
                          if (!isActive && !isCompleted) {
                            e.target.style.transform = 'translateY(-1px)';
                            e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                          }
                        }}
                        onMouseLeave={(e: any) => {
                          if (!isActive && !isCompleted) {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = 'none';
                          }
                        }}
                      >
                        {labelMap[category]}
                        {isSelected && <CheckCircle style={{ width: '1rem', height: '1rem', color: '#FE5858' }} />}
                      </button>
                    );
                  })}
                </div>
                
                {/* Equipment Sub-menu - Shows when category is expanded or equipment is selected */}
                {(expandedCategory || selectedModality) && (
                  <div style={{
                    background: '#F8FBFE',
                    borderRadius: '0.5rem',
                    padding: '0.75rem',
                    border: '1px solid #282B34',
                    marginBottom: '1rem'
                  }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '0.5rem'
                    }}>
                      {modalities
                        .filter((m: any) => m.category === (expandedCategory || modalities.find(mod => mod.value === selectedModality)?.category))
                        .map((modality: any) => (
                          <button
                            key={modality.value}
                            onClick={() => {
                              setSelectedModality(modality.value);
                              setExpandedCategory(''); // Clear expanded category when equipment is selected
                              setShowWorkoutDetails(false); // Reset details view when changing equipment
                            }}
                            disabled={isActive || isCompleted}
                            style={{
                              padding: '0.75rem',
                              borderRadius: '0.375rem',
                              border: '1px solid',
                              borderColor: selectedModality === modality.value ? '#FE5858' : '#d1d5db',
                              background: '#DAE2EA',
                              color: '#282B34',
                              fontWeight: '600',
                              fontSize: '0.875rem',
                              cursor: (isActive || isCompleted) ? 'not-allowed' : 'pointer',
                              opacity: (isActive || isCompleted) ? 0.5 : 1,
                              transition: 'all 0.2s ease',
                              textAlign: 'left'
                            }}
                            onMouseEnter={(e: any) => {
                              if (!isActive && !isCompleted && selectedModality !== modality.value) {
                                e.target.style.background = '#cbd5e1';
                              }
                            }}
                            onMouseLeave={(e: any) => {
                              if (!isActive && !isCompleted && selectedModality !== modality.value) {
                                e.target.style.background = '#DAE2EA';
                              }
                            }}
                          >
                            {modality.label}
                          </button>
                        ))}
                    </div>
                                      </div>
                                    )}
              
              {/* Warning message when no baseline exists for selected modality */}
              {(() => {
                return null;
              })()}
              {selectedModality && workout?.day_type !== 'time_trial' && !baselines[selectedModality] && (
                <div style={{
                  background: '#DAE2EA',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  border: '1px solid #FE5858',
                  marginTop: '1rem',
                  marginBottom: '1rem'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: '#282B34',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}>
                    <AlertCircle style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0, color: '#FE5858' }} />
                    <span>
                      You have not completed a time trial for <strong>{modalities.find(m => m.value === selectedModality)?.label || selectedModality}</strong>, so some analytics will not be available. To use all Analytics features, complete a Time Trial with <strong>{modalities.find(m => m.value === selectedModality)?.label || selectedModality}</strong>.
                    </span>
                  </div>
                </div>
              )}
              </div>
            </div>
            )}

            {/* Stage 2: Detailed Workout Breakdown - Separate screen when user clicked Next */}
            {showWorkoutDetails && selectedModality && baselines[selectedModality] && (
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                {/* Equipment Section Header */}
                                      <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  padding: '0.5rem 1rem',
                  background: '#DAE2EA',
                  borderRadius: '0.5rem',
                  marginBottom: '1rem'
                }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Equipment:</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#282B34' }}>
                    {modalities.find(m => m.value === selectedModality)?.label || 'Not selected'}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedModality('');
                      setShowWorkoutDetails(false); // Reset details view when changing equipment
                    }}
                    style={{
                                        padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      color: '#FE5858',
                      background: 'transparent',
                      border: '1px solid #FE5858',
                                        borderRadius: '0.25rem',
                      cursor: 'pointer'
                                      }}
                  >
                    Change
                  </button>
            </div>

                {/* Training Summary Section - Only show when equipment is selected AND in stage 2 (details shown) */}
                {selectedModality && showWorkoutDetails && sessionData.intervals && sessionData.intervals.length > 0 && (
              <div style={{
                background: '#DAE2EA',
                borderRadius: '1rem',
                boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                padding: '1.5rem',
                    border: '1px solid #282B34',
                marginBottom: '1.5rem'
              }}>
                    {/* Collapsible Header */}
                    <button
                      onClick={() => setExpandedSummary(!expandedSummary)}
                      style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                        width: '100%',
                        padding: '0.75rem',
                        background: '#F8FBFE',
                        border: '1px solid #FE5858',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        marginBottom: '0.75rem',
                        transition: 'all 0.2s ease',
                        position: 'relative'
                      }}
                      onMouseEnter={(e: any) => {
                        e.target.style.background = '#cbd5e1';
                      }}
                      onMouseLeave={(e: any) => {
                        e.target.style.background = '#F8FBFE';
                      }}
                    >
                      <span style={{ fontSize: '1rem', color: '#282B34', fontWeight: '700' }}>
                  Training Summary
                      </span>
                      <div style={{ position: 'absolute', right: '0.75rem' }}>
                        {expandedSummary ? (
                          <ChevronUp size={20} color="#282B34" />
                        ) : (
                          <ChevronDown size={20} color="#282B34" />
                        )}
                      </div>
                    </button>
                    
                    {expandedSummary && (
                      <div>
                
                {/* Side-by-side: Work Duration and Total Work Goal */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem',
                  marginBottom: '0.75rem'
                }}>
                  {/* Work Duration */}
                  <div style={{
                    background: 'white',
                    borderRadius: '0.5rem',
                    padding: '0.75rem',
                    border: '1px solid #FE5858'
                  }}>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#282B34',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '0.25rem',
                      fontWeight: '500'
                    }}>Work Duration</div>
                    <div style={{
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      color: '#282B34'
                    }}>
                      {formatTime(getTotalWorkDuration())}
                    </div>
                  </div>

                  {/* Total Work Goal */}
                      {getTotalWorkoutGoal() && getTotalWorkoutGoal()?.isMaxEffort ? (
                    <div style={{
                      background: 'white',
                      borderRadius: '0.5rem',
                      padding: '0.75rem',
                      border: '1px solid #FE5858'
                    }}>
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#282B34',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: '0.25rem',
                        fontWeight: '500'
                      }}>Total Work Goal</div>
                      <div style={{
                        fontSize: '1.5rem',
                        fontWeight: 'bold',
                        color: '#282B34'
                      }}>
                            Max Effort
                          </div>
                        </div>
                      ) : getTotalWorkoutGoal() && (
                        <div style={{
                          background: 'white',
                          borderRadius: '0.5rem',
                          padding: '0.75rem',
                          border: '1px solid #FE5858'
                        }}>
                          <div style={{
                            fontSize: '0.75rem',
                            color: '#282B34',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: '0.25rem',
                            fontWeight: '500'
                          }}>Total Work Goal</div>
                          <div style={{
                            fontSize: '1.5rem',
                            fontWeight: 'bold',
                            color: '#282B34'
                          }}>
                            {Math.ceil(getTotalWorkoutGoal()?.totalGoal ?? 0)} <span style={{ fontSize: '1rem', fontWeight: '500' }}>{getTotalWorkoutGoal()?.units}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Baseline vs Target Comparison */}
                {getCurrentTargetPace() && 
                 !getCurrentTargetPace().needsRocketRacesA && 
                 getCurrentTargetPace().pace && 
                 selectedModality && 
                 baselines[selectedModality] && (
                  <div style={{
                    background: 'white',
                    borderRadius: '0.5rem',
                    padding: '0.75rem',
                    border: '1px solid #FE5858'
                  }}>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#282B34',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '0.75rem',
                      fontWeight: '500'
                    }}>Intensity Comparison</div>
                    
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}>
                      {(() => {
                        const baselineIntensity = 100;
                        const targetIntensity = getCurrentTargetPace().intensity || 100;
                        const maxScale = Math.max(baselineIntensity, targetIntensity) * 1.2;
                        const baselineWidth = (baselineIntensity / maxScale) * 100;
                        const targetWidth = (targetIntensity / maxScale) * 100;
                        
                        return (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#282B34', width: '6rem', flexShrink: 0 }}>Time Trial</span>
                              <div style={{ flex: 1, position: 'relative', background: '#e5e7eb', borderRadius: '9999px', height: '2rem' }}>
                                <div style={{
                                  width: `${baselineWidth}%`,
                                  background: 'linear-gradient(to right, #6b7280, #4b5563)',
                                  borderRadius: '9999px',
                                  height: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  paddingLeft: '0.75rem',
                                  paddingRight: '0.75rem'
                                }}>
                                  <span style={{ color: 'white', fontSize: '0.75rem', fontWeight: '600' }}>
                                        {Math.round(baselines[selectedModality].baseline)} {getCurrentTargetPace().units}/min
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#282B34', width: '6rem', flexShrink: 0 }}>Today's Target</span>
                              <div style={{ flex: 1, position: 'relative', background: '#e5e7eb', borderRadius: '9999px', height: '2rem' }}>
                                <div style={{
                                  width: `${targetWidth}%`,
                                  background: 'linear-gradient(to right, #FE5858, #e64747)',
                                  borderRadius: '9999px',
                                  height: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  paddingLeft: '0.75rem',
                                  paddingRight: '0.75rem'
                                }}>
                                  <span style={{ color: 'white', fontSize: '0.75rem', fontWeight: '600' }}>
                                        {Math.round(getCurrentTargetPace().pace)} {getCurrentTargetPace().units}/min
                                  </span>
                                  <span style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.625rem', fontWeight: '500' }}>
                                    {getCurrentTargetPace().intensity}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
                      </div>
                    )}
              </div>
            )}

                {/* Previous Sessions - Show after equipment is selected */}
                {selectedModality && baselines[selectedModality] && (
                  <div className="mt-6">
              <div style={{
                      background: '#DAE2EA',
                borderRadius: '1rem',
                boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                padding: '1.5rem',
                      border: '1px solid #282B34',
                      position: 'relative',
                      marginBottom: '2.5rem'
                    }}>
                      {/* Collapsible Header */}
                      <button
                        onClick={() => setExpandedHistory(!expandedHistory)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '100%',
                          padding: '0.75rem',
                          background: '#F8FBFE',
                          border: '1px solid #FE5858',
                          borderRadius: '0.5rem',
                          cursor: 'pointer',
                  marginBottom: '0.75rem',
                          transition: 'all 0.2s ease',
                          position: 'relative'
                        }}
                        onMouseEnter={(e: any) => {
                          e.target.style.background = '#cbd5e1';
                        }}
                        onMouseLeave={(e: any) => {
                          e.target.style.background = '#F8FBFE';
                        }}
                      >
                        <span style={{ fontSize: '1rem', color: '#282B34', fontWeight: '700' }}>
                          {workout?.day_type ? `${getWorkoutTypeDisplayName(workout.day_type)} History` : 'Previous Sessions'}
                        </span>
                        <div style={{ position: 'absolute', right: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {workoutHistory.length > 0 && (
                            <div style={{
                              background: '#FE5858',
                              color: '#F8FBFE',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '9999px',
                  display: 'flex',
                  alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: '1.5rem'
                }}>
                              {workoutHistory.length}
                            </div>
                          )}
                          {expandedHistory ? (
                            <ChevronUp size={20} color="#282B34" />
                          ) : (
                            <ChevronDown size={20} color="#282B34" />
                          )}
                        </div>
                      </button>
                
                      {expandedHistory && (
                        <div>
                      {workoutHistory.length > 0 ? (
                <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem',
                          maxHeight: '16rem',
                          overflowY: 'auto'
                        }}>
                          {workoutHistory.slice(0, 5).map((session, index) => (
                            <div 
                              key={session.id || index} 
                              style={{
                                padding: '1rem',
                                background: '#F8FBFE',
                                borderRadius: '0.75rem',
                                border: '1px solid #e5e7eb',
                                transition: 'all 0.2s ease'
                              }}
                            >
                  <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.75rem',
                                flexWrap: 'wrap'
                              }}>
                                <span style={{
                                  fontSize: '0.875rem',
                                  fontWeight: '600',
                                  color: '#111827',
                                  flex: '0 0 auto'
                                }}>
                                  {session.date ? new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown Date'}
                                </span>
                  <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  flex: '1 1 auto',
                                  justifyContent: 'flex-end'
                  }}>
                            {session.performance_ratio && (
                  <div style={{
                                  fontSize: '0.875rem',
                    fontWeight: 'bold',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '0.25rem',
                                  background: '#FE5858',
                                  color: '#F8FBFE'
                  }}>
                                  {(session.performance_ratio * 100).toFixed(1)}%
                  </div>
                            )}
                              {session.actual_pace && (
                                <span style={{
                                  fontSize: '0.875rem',
                    fontWeight: 'bold',
                                  color: '#282B34',
                                  background: '#F8FBFE',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '0.5rem',
                                  border: '1px solid #FE5858'
                  }}>
                                  {session.actual_pace.toFixed(1)} {baselines[selectedModality]?.units || 'units'}/min
                                </span>
                              )}
                  </div>
                </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{
                        textAlign: 'center',
                        padding: '2rem 0',
                        color: '#6b7280'
                      }}>
                        <History size={48} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                        <p style={{ fontSize: '0.875rem' }}>No previous sessions for this workout type</p>
              </div>
            )}

                    {/* Performance Summary */}
                    {selectedModality && baselines[selectedModality] && performanceMetrics?.rolling_avg_ratio && (() => {
                      // Calculate average actual_pace from workout history
                      const sessionsWithPace = workoutHistory.filter((s: any) => s.actual_pace !== null && s.actual_pace !== undefined);
                      const avgPace = sessionsWithPace.length > 0 
                        ? sessionsWithPace.reduce((sum, s) => sum + s.actual_pace, 0) / sessionsWithPace.length 
                        : null;
                      
                      return (
                        <div 
                          style={{
                            marginTop: '1rem',
                            padding: '1rem',
                            background: '#DAE2EA',
                            borderRadius: '0.75rem',
                            border: '2px solid #FE5858',
                            transition: 'all 0.2s ease'
                          }}
                        >
              <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            flexWrap: 'wrap'
              }}>
                            <span style={{
                              fontSize: '0.875rem',
                  fontWeight: '600',
                              color: '#111827',
                              flex: '0 0 auto'
                            }}>
                              {workout?.day_type ? `${getWorkoutTypeDisplayName(workout.day_type)} Summary` : 'Summary'}
                            </span>
                            <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                              flex: '1 1 auto',
                              justifyContent: 'flex-end'
                }}>
                <div style={{
                                fontSize: '0.875rem',
                                fontWeight: 'bold',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '0.25rem',
                                background: '#FE5858',
                                color: '#F8FBFE'
                              }}>
                                {(performanceMetrics.rolling_avg_ratio * 100).toFixed(1)}%
                              </div>
                              {avgPace && (
                                <span style={{
                                  fontSize: '0.875rem',
                    fontWeight: 'bold',
                                  color: '#282B34',
                                  background: '#F8FBFE',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '0.5rem'
                  }}>
                                  {avgPace.toFixed(1)} {baselines[selectedModality]?.units || 'units'}/min
                                </span>
                              )}
                  </div>
                          </div>
                        </div>
                      );
                    })()}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Detailed Workout Breakdown */}
                {(() => {
                  const breakdown = getWorkoutBreakdown();
                  if (!breakdown) return null;

                  return (
                  <div style={{
                      background: '#DAE2EA',
                      borderRadius: '1rem',
                      boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                      padding: '1.5rem',
                      border: '1px solid #282B34',
                      marginBottom: '1.5rem'
                    }}>
                      <div>
                        {/* Collapsible Header */}
                        <button
                          onClick={() => setExpandedBreakdown(!expandedBreakdown)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            padding: '0.75rem',
                            background: '#F8FBFE',
                            border: '1px solid #FE5858',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            marginBottom: '0.75rem',
                            transition: 'all 0.2s ease',
                            position: 'relative'
                          }}
                          onMouseEnter={(e: any) => {
                            e.target.style.background = '#cbd5e1';
                          }}
                          onMouseLeave={(e: any) => {
                            e.target.style.background = '#F8FBFE';
                          }}
                        >
                          <span style={{ fontSize: '1rem', color: '#282B34', fontWeight: '700' }}>
                            Workout Breakdown
                          </span>
                          <div style={{ position: 'absolute', right: '0.75rem' }}>
                            {expandedBreakdown ? (
                              <ChevronUp size={20} color="#282B34" />
                            ) : (
                              <ChevronDown size={20} color="#282B34" />
                            )}
                  </div>
                        </button>
                        
                        {expandedBreakdown && (
                          <div>
                          {breakdown.blocks.map((block: any) => (
                            <div key={block.blockNumber} style={{ marginBottom: '1.5rem' }}>
                              {/* Block Header */}
                              <div style={{ fontSize: '0.875rem', color: '#282B34', fontWeight: '700', marginBottom: '0.5rem' }}>
                                Block {block.blockNumber}:
                              </div>
                          {/* Block Rounds */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {block.rounds.map((interval: Interval, idx: number) => {
                              const targetPace = interval.targetPace || calculateTargetPaceWithData(interval);
                              const intensity = targetPace?.intensity || (targetPace?.isMaxEffort ? 100 : null);
                              const pace = targetPace?.pace;
                              const units = targetPace?.units || baselines[selectedModality]?.units;
                              
                              // Calculate total work target: duration (in minutes) * target pace
                              const durationMinutes = interval.duration / 60;
                              const totalWorkTarget = pace && durationMinutes ? (durationMinutes * pace) : null;
                              
                              return (
                                <div
                                  key={interval.id || idx}
                                  style={{
                                    padding: '1rem',
                                    background: '#F8FBFE',
                                    borderRadius: '0.75rem',
                                    border: '1px solid #e5e7eb',
                                    transition: 'all 0.2s ease'
                                  }}
                                >
                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '0.75rem',
                                    flexWrap: 'wrap'
                                  }}>
                                    <span style={{
                                      fontSize: '0.875rem',
                                      fontWeight: '600',
                                      color: '#111827',
                                      flex: '0 0 auto'
                                    }}>
                                      Round {interval.roundNumber || idx + 1}
                                    </span>
                                    <span style={{ fontSize: '0.875rem', color: '#6b7280', flex: '0 0 auto' }}>
                                      {formatTime(interval.duration ?? 0)}
                                      {(interval.restDuration ?? 0) > 0 && ` + ${formatTime(interval.restDuration ?? 0)} rest`}
                                    </span>
                  <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.5rem',
                                      flex: '1 1 auto',
                                      justifyContent: 'flex-end'
                                    }}>
                                      {totalWorkTarget && (
                                        <span style={{
                                          fontSize: '0.875rem',
                    fontWeight: 'bold',
                                          color: '#282B34',
                                          background: '#F8FBFE',
                                          padding: '0.25rem 0.5rem',
                                          borderRadius: '0.5rem',
                                          border: '1px solid #FE5858'
                  }}>
                                          {totalWorkTarget.toFixed(0)} {units || 'units'}
                                        </span>
                                      )}
                                      {intensity && (
                  <div style={{
                                          fontSize: '0.875rem',
                    fontWeight: 'bold',
                                          padding: '0.25rem 0.5rem',
                                          borderRadius: '0.25rem',
                                          background: '#FE5858',
                                          color: '#F8FBFE'
                  }}>
                                          {intensity}%
                  </div>
                                      )}
                                      {targetPace && (targetPace.source === 'metrics_adjusted' || targetPace.source === 'learned_max') && (
                                        <span style={{
                                          background: '#9333ea',
                                          color: 'white',
                                          padding: '0.25rem 0.5rem',
                                          borderRadius: '0.25rem',
                                          fontSize: '0.875rem',
                                          fontWeight: 'bold'
                                        }}
                                        title="AI-Adjusted Pace"
                                        >
                                          AI
                                        </span>
                                      )}
                </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                        </div>
                      )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Stage 2: Simplified Workout Breakdown - When no baseline exists */}
            {showWorkoutDetails && selectedModality && !baselines[selectedModality] && (
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                {/* Equipment Section Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  padding: '0.5rem 1rem',
                  background: '#DAE2EA',
                  borderRadius: '0.5rem',
                  marginBottom: '1rem'
                }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Equipment:</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#282B34' }}>
                    {modalities.find(m => m.value === selectedModality)?.label || 'Not selected'}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedModality('');
                      setShowWorkoutDetails(false); // Reset details view when changing equipment
                    }}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      color: '#FE5858',
                      background: 'transparent',
                      border: '1px solid #FE5858',
                      borderRadius: '0.25rem',
                      cursor: 'pointer'
                    }}
                  >
                    Change
                  </button>
                </div>

                {/* Work Duration */}
                {sessionData.intervals && sessionData.intervals.length > 0 && (
                  <div style={{
                    background: '#DAE2EA',
                    borderRadius: '0.5rem',
                    padding: '0.75rem',
                    border: '1px solid #FE5858',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#282B34',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '0.25rem',
                      fontWeight: '500'
                    }}>Work Duration</div>
                    <div style={{
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      color: '#282B34'
                    }}>
                      {formatTime(getTotalWorkDuration())}
                    </div>
                  </div>
                )}

                {/* Basic Workout Breakdown */}
                {(() => {
                  const breakdown = getWorkoutBreakdown();
                  if (!breakdown) return null;

                  return (
                    <div style={{
                      background: '#DAE2EA',
                      borderRadius: '1rem',
                      boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                      padding: '1.5rem',
                      border: '1px solid #282B34',
                      marginBottom: '1.5rem'
                    }}>
                      <div>
                        {/* Collapsible Header */}
                        <button
                          onClick={() => setExpandedBreakdown(!expandedBreakdown)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            padding: '0.75rem',
                            background: '#F8FBFE',
                            border: '1px solid #FE5858',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            marginBottom: '0.75rem',
                            transition: 'all 0.2s ease',
                            position: 'relative'
                          }}
                          onMouseEnter={(e: any) => {
                            e.target.style.background = '#cbd5e1';
                          }}
                          onMouseLeave={(e: any) => {
                            e.target.style.background = '#F8FBFE';
                          }}
                        >
                          <span style={{ fontSize: '1rem', color: '#282B34', fontWeight: '700' }}>
                            Workout Breakdown
                          </span>
                          <div style={{ position: 'absolute', right: '0.75rem' }}>
                            {expandedBreakdown ? (
                              <ChevronUp size={20} color="#282B34" />
                            ) : (
                              <ChevronDown size={20} color="#282B34" />
                            )}
                          </div>
                        </button>
                        
                        {expandedBreakdown && (
                          <div>
                            {breakdown.blocks.map((block: any) => (
                              <div key={block.blockNumber} style={{ marginBottom: '1.5rem' }}>
                                {/* Block Header */}
                                <div style={{ fontSize: '0.875rem', color: '#282B34', fontWeight: '700', marginBottom: '0.5rem' }}>
                                  Block {block.blockNumber}:
                                </div>
                                {/* Block Rounds */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                  {block.rounds.map((interval: Interval, idx: number) => {
                                    return (
                                      <div
                                        key={interval.id || idx}
                                        style={{
                                          padding: '1rem',
                                          background: '#F8FBFE',
                                          borderRadius: '0.75rem',
                                          border: '1px solid #e5e7eb',
                                          transition: 'all 0.2s ease'
                                        }}
                                      >
                                        <div style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          gap: '0.75rem',
                                          flexWrap: 'wrap'
                                        }}>
                                          <span style={{
                                            fontSize: '0.875rem',
                                            fontWeight: '600',
                                            color: '#111827',
                                            flex: '0 0 auto'
                                          }}>
                                            Round {interval.roundNumber || idx + 1}
                                          </span>
                                          <span style={{ fontSize: '0.875rem', color: '#282B34', flex: '0 0 auto' }}>
                                            {formatTime(interval.duration ?? 0)}
                                            {(interval.restDuration ?? 0) > 0 && ` + ${formatTime(interval.restDuration ?? 0)} rest`}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Next Button - Stage 1: Show when equipment selection is visible */}
            {!showWorkoutDetails && (
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: '1.5rem' }}>
              <button
                  onClick={() => {
                    if (selectedModality) {
                      // Stage 1 -> Stage 2: Show workout details (even without baseline)
                      setShowWorkoutDetails(true);
                    }
                  }}
                  disabled={!selectedModality}
                style={{
                  background: '#FE5858',
                  color: 'white',
                    padding: '0.75rem 2rem',
                    borderRadius: '0.5rem',
                  border: 'none',
                  fontWeight: '600',
                    fontSize: '0.875rem',
                    cursor: !selectedModality ? 'not-allowed' : 'pointer',
                    opacity: !selectedModality ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                    gap: '0.5rem',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e: any) => {
                    if (selectedModality) {
                  e.target.style.background = '#dc2626';
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                    }
                }}
                onMouseLeave={(e: any) => {
                    if (selectedModality) {
                  e.target.style.background = '#FE5858';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                    }
                }}
              >
                  <ArrowRight style={{ width: '1rem', height: '1rem' }} />
                  Next
              </button>
              </div>
            )}

            {/* Start Workout Button - Stage 2: Show when workout details are visible */}
            {showWorkoutDetails && (
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: '1.5rem' }}>
              <button
                  onClick={() => {
                    // Stage 2 -> Stage 3: Start workout
                    startWorkout();
                  }}
                disabled={!selectedModality}
                style={{
                    background: '#FE5858',
                  color: 'white',
                    padding: '0.75rem 2rem',
                    borderRadius: '0.5rem',
                  border: 'none',
                  fontWeight: '600',
                    fontSize: '0.875rem',
                  cursor: !selectedModality ? 'not-allowed' : 'pointer',
                  opacity: !selectedModality ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                    gap: '0.5rem',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e: any) => {
                  if (selectedModality) {
                      e.target.style.background = '#dc2626';
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                  }
                }}
                onMouseLeave={(e: any) => {
                  if (selectedModality) {
                      e.target.style.background = '#FE5858';
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                  }
                }}
              >
                  <Play style={{ width: '1rem', height: '1rem' }} />
                  Start Workout
              </button>
            </div>
            )}
          </div>
        )}

        {/* Active Workout View */}
        {currentView === 'active' && !isCompleted && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Side - Workout Controls */}
          <div className="space-y-6">
            {/* Workout Controls */}
            <div style={{
              background: 'white',
              borderRadius: '0.75rem',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              padding: '1.5rem',
              border: '1px solid #282B34',
              marginTop: '1.5rem',
              marginBottom: '1.5rem'
              }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {!isActive && !isCompleted && !isPaused && (
                  <button
                    onClick={resumeWorkout}
                    disabled={!selectedModality}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #16a34a 0%, #059669 100%)',
                      color: 'white',
                      padding: '1rem 1.5rem',
                      borderRadius: '0.75rem',
                      border: 'none',
                      fontWeight: '600',
                      fontSize: '0.875rem',
                      cursor: !selectedModality ? 'not-allowed' : 'pointer',
                      opacity: !selectedModality ? 0.5 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e: any) => {
                      if (selectedModality) {
                        e.target.style.background = 'linear-gradient(135deg, #15803d 0%, #047857 100%)';
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                      }
                    }}
                    onMouseLeave={(e: any) => {
                      if (selectedModality && baselines[selectedModality]) {
                        e.target.style.background = 'linear-gradient(135deg, #16a34a 0%, #059669 100%)';
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                      }
                    }}
                  >
                    <Play style={{ width: '1.25rem', height: '1.25rem' }} />
                    Start Workout
                  </button>
                )}
                
                {isActive && (
                  <button
                    onClick={pauseWorkout}
                    style={{
                      width: '100%',
                      background: '#DAE2EA',
                      color: '#282B34',
                      padding: '1rem 1.5rem',
                      borderRadius: '0.75rem',
                      border: 'none',
                      fontWeight: '600',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e: any) => {
                      e.target.style.background = '#cbd5e1';
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                    }}
                    onMouseLeave={(e: any) => {
                      e.target.style.background = '#DAE2EA';
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                    }}
                  >
                    <Pause style={{ width: '1.25rem', height: '1.25rem', color: '#282B34' }} />
                    Pause
                  </button>
                )}
                
                {isPaused && (
                  <button
                    onClick={resumeWorkout}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #16a34a 0%, #059669 100%)',
                      color: 'white',
                      padding: '1rem 1.5rem',
                      borderRadius: '0.75rem',
                      border: 'none',
                      fontWeight: '600',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e: any) => {
                      e.target.style.background = 'linear-gradient(135deg, #15803d 0%, #047857 100%)';
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                    }}
                    onMouseLeave={(e: any) => {
                      e.target.style.background = 'linear-gradient(135deg, #16a34a 0%, #059669 100%)';
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                    }}
                  >
                    <Play style={{ width: '1.25rem', height: '1.25rem' }} />
                    Resume
                  </button>
                )}

                {/* Skip to End button - only show when workout is active (for testing) */}
                {(isActive || isPaused) && (
                  <button
                    onClick={skipToEnd}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)',
                      color: 'white',
                      padding: '1rem 1.5rem',
                      borderRadius: '0.75rem',
                      border: 'none',
                      fontWeight: '600',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e: any) => {
                      e.target.style.background = 'linear-gradient(135deg, #7e22ce 0%, #db2777 100%)';
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                    }}
                    onMouseLeave={(e: any) => {
                      e.target.style.background = 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)';
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                    }}
                    title="Skip to end and enter results manually (for testing)"
                  >
                    <Zap style={{ width: '1.25rem', height: '1.25rem' }} />
                    Skip to End (Test)
                  </button>
                )}
                
                <button
                  onClick={resetWorkout}
                  style={{
                    width: '100%',
                    background: '#282B34',
                    color: 'white',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '0.75rem',
                    border: 'none',
                    fontWeight: '500',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e: any) => {
                    e.target.style.background = '#1a1d23';
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                  }}
                  onMouseLeave={(e: any) => {
                    e.target.style.background = '#282B34';
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                  }}
                >
                  <RotateCcw style={{ width: '1.25rem', height: '1.25rem' }} />
                  Reset
                </button>
              </div>
            </div>

            {/* Flux Information for Flux Days */}
            {(workout?.day_type === 'flux' || workout?.day_type === 'flux_stages') && sessionData.intervals.length > 0 && sessionData.intervals[0].fluxDuration && (() => {
              const interval = sessionData.intervals[0];
              const totalDuration = interval.duration || 0;
              const baseDuration = interval.baseDuration || 300;
              const fluxDuration = interval.fluxDuration || 60;
              const fluxPeriods = calculateFluxPeriods(baseDuration, fluxDuration, totalDuration);
              
              return (
                <div style={{
                  background: 'white',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  border: '1px solid #e5e7eb',
                  marginBottom: '2rem'
              }}>
                <h3 style={{
                  fontWeight: '600',
                    color: '#282B34',
                    marginBottom: '0.5rem',
                  fontSize: '1.125rem'
                }}>
                  Flux Information
                </h3>
                
                  {/* Timeline Bar */}
                <div style={{
                    position: 'relative',
                    width: '100%',
                    minHeight: '6rem',
                    marginBottom: '0.5rem',
                    paddingTop: '1.5rem',
                    paddingBottom: '1.5rem',
                    overflow: 'visible'
                }}>
                    {/* Base workout duration bar */}
                  <div style={{
                      position: 'absolute',
                      left: 0,
                      top: '1.5rem',
                      width: '100%',
                      height: '3rem',
                      background: '#FE5858',
                      borderRadius: '0.5rem'
                    }} />
                    
                    {/* Flux markers */}
                    {fluxPeriods.filter((p: any) => p.type === 'flux').map((fluxPeriod, index) => {
                      const startPercent = (fluxPeriod.start / totalDuration) * 100;
                      const durationPercent = ((fluxPeriod.end - fluxPeriod.start) / totalDuration) * 100;
                      const fluxStartIntensity = interval.fluxStartIntensity || 0.75;
                      const fluxIncrement = interval.fluxIncrement || 0.05;
                      // Calculate actual intensity for this flux period
                      // Use fixed fluxIntensity if available, otherwise calculate progressively
                      const actualIntensity = interval.fluxIntensity !== null && interval.fluxIntensity !== undefined
                        ? interval.fluxIntensity
                        : fluxStartIntensity + (fluxPeriod.index * fluxIncrement);
                      const intensityPercent = (actualIntensity * 100).toFixed(0);
                      
                      return (
                        <div key={index}>
                          {/* Flux marker */}
                          <div
                            style={{
                              position: 'absolute',
                              left: `${startPercent}%`,
                              top: '1.5rem',
                              width: `${Math.max(durationPercent, 2)}%`,
                              height: '3rem',
                              background: '#F8FBFE',
                              borderRadius: '0.5rem',
                              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                            }}
                          />
                          {/* Flux time label */}
                          <div
                            style={{
                              position: 'absolute',
                              left: `${startPercent}%`,
                              top: '0',
                              transform: 'translateX(-50%)',
                              fontSize: '0.625rem',
                              color: '#282B34',
                              fontWeight: '600',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {formatTime(fluxPeriod.start)}
                  </div>
                          {/* Flux intensity label */}
                          <div
                            style={{
                              position: 'absolute',
                              left: `${startPercent}%`,
                              top: '4.5rem',
                              transform: 'translateX(-50%)',
                              fontSize: '0.625rem',
                              color: '#282B34',
                              fontWeight: '600',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {intensityPercent}%
                  </div>
                </div>
                      );
                    })}
              </div>
                </div>
              );
            })()}
          </div>

          {/* Right Side - Workout Display */}
          <div className="space-y-6">
            {/* Current Interval */}
            {getCurrentInterval() && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg p-6 border-2 border-blue-300" style={{
                borderColor: currentBurstStatus?.isActive ? '#dc2626' : (currentFluxStatus?.isActive ? '#0891b2' : undefined),
                background: currentBurstStatus?.isActive 
                  ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)' 
                  : (currentFluxStatus?.isActive
                    ? 'linear-gradient(135deg, #cffafe 0%, #a5f3fc 100%)'
                    : undefined)
              }}>
                {/* Burst active indicator */}
                {currentBurstStatus?.isActive && (
                  <div style={{
                    background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                    color: 'white',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.5rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    fontWeight: '700',
                    fontSize: '0.875rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                  }}>
                    <Zap style={{ width: '1.25rem', height: '1.25rem' }} />
                    Burst Active - Max Effort!
                  </div>
                )}
                
                {/* Flux active indicator */}
                {currentFluxStatus?.isActive && (
                  <div style={{
                    background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
                    color: 'white',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.5rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    fontWeight: '700',
                    fontSize: '0.875rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    boxShadow: '0 4px 12px rgba(8, 145, 178, 0.4)',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                  }}>
                    <Zap style={{ width: '1.25rem', height: '1.25rem' }} />
                    Flux Active - {(currentFluxStatus.currentIntensity * 100).toFixed(0)}% Intensity!
                  </div>
                )}
                
                {/* Progress Donut */}
                <div className="text-center mb-6">
                  <div className="relative w-48 h-48 mx-auto mb-4" style={{ overflow: 'visible' }}>
                    <svg 
                      className="w-48 h-48" 
                      viewBox="0 0 192 192"
                      style={{ 
                        display: 'block',
                        position: 'relative',
                        zIndex: 1
                      }}
                    >
                      {/* Group for circles only - rotated so progress fills from top */}
                      <g transform="rotate(-90 96 96)">
                        {/* Background circle */}
                        <circle
                          cx="96"
                          cy="96"
                          r="88"
                          stroke="#e5e7eb"
                          strokeWidth="8"
                          fill="none"
                        />
                        {/* Progress circle - fills based on current phase (work or rest) */}
                        {(() => {
                          const currentInt = getCurrentInterval();
                          let progress = 0;
                          let totalDuration = 0;
                          
                          if (currentInt) {
                            if (currentPhase === 'work') {
                              // Work phase: progress based on work duration
                              totalDuration = currentInt.duration || 0;
                              const remaining = timeRemaining;
                              const elapsed = totalDuration - remaining;
                              progress = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0;
                            } else {
                              // Rest phase: progress based on rest duration
                              totalDuration = currentInt.restDuration || 0;
                              const remaining = timeRemaining;
                              const elapsed = totalDuration - remaining;
                              progress = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0;
                            }
                          }
                          
                          const circumference = 2 * Math.PI * 88;
                          const offset = circumference - (progress / 100) * circumference;
                          
                          // Check if in burst for polarized days or flux for flux days
                          const isBurstActive = currentBurstStatus?.isActive || false;
                          const isFluxActive = currentFluxStatus?.isActive || false;
                          
                          // Use red/orange for burst, cyan for flux, coral for work, dark gray for rest
                          let strokeColor, shadowColor;
                          if (isBurstActive) {
                            strokeColor = '#dc2626'; // Red for burst
                            shadowColor = 'rgba(220, 38, 38, 0.5)';
                          } else if (isFluxActive) {
                            strokeColor = '#0891b2'; // Cyan for flux
                            shadowColor = 'rgba(8, 145, 178, 0.5)';
                          } else if (currentPhase === 'work') {
                            strokeColor = '#FE5858'; // Coral for work
                            shadowColor = 'rgba(254, 88, 88, 0.3)';
                          } else {
                            strokeColor = '#282B34'; // Dark gray for rest
                            shadowColor = 'rgba(40, 43, 52, 0.3)';
                          }
                          
                          return (
                            <circle
                              cx="96"
                              cy="96"
                              r="88"
                              stroke={strokeColor}
                              strokeWidth="8"
                              fill="none"
                              strokeLinecap="round"
                              strokeDasharray={circumference}
                              strokeDashoffset={offset}
                              className="transition-all duration-1000 ease-out"
                              style={{
                                filter: `drop-shadow(0 2px 4px ${shadowColor})`
                              }}
                            />
                          );
                        })()}
                      </g>
                      
                      {/* Round number - above timer (day type removed, shown at top of page) */}
                      {(() => {
                        const interval = getCurrentInterval();
                        const roundNum = interval?.roundNumber || (sessionData.intervals.findIndex(i => i.id === interval?.id) + 1);
                        const hasRound = roundNum !== null && roundNum !== undefined;
                        const roundText = hasRound ? `Round ${roundNum}` : '';
                        
                        // Only show if there's a round number
                        if (!hasRound) return null;
                        
                        // Calculate dynamic font size based on text length
                        const maxWidth = 140;
                        const baseFontSize = 11;
                        const calculatedSize = Math.floor(maxWidth / (roundText.length * 0.65));
                        const fontSize = Math.max(8, Math.min(baseFontSize, calculatedSize));
                        
                        return (
                          <text
                            x="96"
                            y="50"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={fontSize}
                            fontWeight="600"
                            fill="#FE5858"
                            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                          >
                            {roundText}
                          </text>
                        );
                      })()}
                      
                      {/* Timer text - centered on diameter */}
                      <text
                        x="96"
                        y="96"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="52"
                        fontWeight="bold"
                        fill="#282B34"
                        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                      >
                        {formatTime(timeRemaining)}
                      </text>
                      
                      {/* Interval Goal - below timer with better spacing */}
                      {(() => {
                        const goal = getCurrentIntervalGoal();
                        if (!goal) return null;
                        
                        // Format the goal text: add "Goal: " prefix and change "cal" to "cals"
                        let displayText = goal.text;
                        if (goal.text && !goal.isMaxEffort && !goal.needsRocketRacesA) {
                          // Add "Goal: " prefix and ensure "cals" instead of "cal"
                          displayText = `Goal: ${goal.text.replace(/\bcal\b/g, 'cals')}`;
                        } else if (goal.isMaxEffort) {
                          displayText = `Goal: ${goal.text}`;
                        } else {
                          displayText = goal.text;
                        }
                        
                        return (
                      <text
                        x="96"
                            y="128"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={goal.needsRocketRacesA ? "12" : "14"}
                            fontWeight="600"
                            fill="#282B34"
                            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                          >
                            {displayText}
                          </text>
                        );
                      })()}
                      
                      {/* Phase indicator (Work/Rest/Burst/Flux) - below goal */}
                      <text
                        x="96"
                        y="160"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="12"
                        fontWeight="600"
                        fill="#FE5858"
                        style={{ fontFamily: 'system-ui, -apple-system, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        {currentBurstStatus?.isActive ? 'Burst!' : (currentFluxStatus?.isActive ? 'Flux!' : (currentPhase === 'work' ? 'Work' : 'Rest'))}
                      </text>
                      
                      {/* Burst countdown - below phase indicator for polarized days */}
                      {getCurrentInterval()?.burstTiming && currentBurstStatus && (
                        <text
                          x="96"
                          y="175"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize="9"
                          fontWeight="600"
                          fill={currentBurstStatus.isActive ? '#dc2626' : '#282B34'}
                          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                        >
                          {currentBurstStatus.isActive 
                            ? `Burst: ${formatTime(currentBurstStatus.timeRemainingInBurst)}`
                            : currentBurstStatus.nextBurstIn 
                              ? `Next burst: ${formatTime(currentBurstStatus.nextBurstIn)}`
                              : ''}
                        </text>
                      )}
                      
                      {/* Flux countdown - below phase indicator for flux days */}
                      {getCurrentInterval()?.fluxDuration && currentFluxStatus && (
                        <text
                          x="96"
                          y={getCurrentInterval()?.burstTiming ? "182" : "175"}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize="9"
                          fontWeight="600"
                          fill={currentFluxStatus.isActive ? '#0891b2' : '#282B34'}
                          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                        >
                          {currentFluxStatus.isActive 
                            ? `Flux: ${formatTime(currentFluxStatus.timeRemainingInFlux)} @ ${(currentFluxStatus.currentIntensity * 100).toFixed(0)}%`
                            : currentFluxStatus.nextFluxIn 
                              ? `Next flux: ${formatTime(currentFluxStatus.nextFluxIn)}`
                              : ''}
                        </text>
                      )}
                    </svg>
                      </div>
                    </div>
              </div>
            )}

            {/* Workout Progress */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Workout Progress
              </h2>
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {sessionData.intervals.map((interval, index) => {
                  const isCurrent = index === currentInterval && isActive;
                  const isCompleted = interval.completed;
                  const target = interval.targetPace || calculateTargetPaceWithData(interval);
                  
                  // Check if this is the start of a new block
                  const prevInterval = index > 0 ? sessionData.intervals[index - 1] : null;
                  const isNewBlock = prevInterval && 
                    interval.blockNumber && 
                    prevInterval.blockNumber && 
                    interval.blockNumber !== prevInterval.blockNumber;
                  
                  // Calculate bar width based on duration (normalize to max duration)
                  const maxDuration = Math.max(...sessionData.intervals.map((i: any) => i.duration));
                  const barWidth = maxDuration > 0 ? (interval.duration / maxDuration) * 100 : 0;
                  
                  // Determine bar color based on status
                  const barColor = isCurrent 
                    ? '#FE5858' 
                    : isCompleted 
                    ? '#DAE2EA' 
                    : '#282B34';
                        
                        return (
                    <React.Fragment key={interval.id}>
                      {/* Block separator */}
                      {isNewBlock && (
                        <div style={{
                          height: '1px',
                          background: '#282B34',
                          margin: '0.75rem 0',
                          width: '100%'
                        }} />
                      )}
                      <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '0.75rem',
                        background: isCurrent 
                            ? 'transparent' 
                          : isCompleted 
                            ? 'transparent' 
                          : 'rgba(255, 255, 255, 0.5)',
                        borderRadius: '0.5rem',
                        border: isCurrent 
                            ? '1px solid #FE5858' 
                          : isCompleted 
                            ? '1px solid #282B34' 
                          : '1px solid rgba(255, 255, 255, 0.3)'
                      }}
                    >
                      {/* Left label - Round number */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        width: '8rem',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: isCurrent ? '#FE5858' : isCompleted ? '#DAE2EA' : '#282B34'
                      }}>
                                  <span>
                          {interval.blockNumber ? `Block ${interval.blockNumber} - ` : ''}Round {interval.roundNumber || interval.id}
                                  </span>
                            </div>
                            
                      {/* Bar chart */}
                      {interval.fluxDuration && interval.baseDuration ? (
                        // Flux intervals: render separate bars for each segment (base and flux alternating)
                        (() => {
                          const fluxPeriods = calculateFluxPeriods(interval.baseDuration, interval.fluxDuration, interval.duration);
                          const maxDuration = Math.max(...sessionData.intervals.map((i: any) => i.duration));
                          const totalWidth = maxDuration > 0 ? (interval.duration / maxDuration) * 100 : 0;
                          
                          // Calculate elapsed time for current interval
                          const totalDuration = interval.duration || 0;
                          // Calculate elapsed time: if this is the current interval and we're in work phase, calculate elapsed
                          // Otherwise, if completed, elapsed = total duration; if not started, elapsed = 0
                          let elapsedTime = 0;
                          if (isCurrent && isActive && currentPhase === 'work') {
                            // In the current interval, work phase - timeRemaining is remaining in this work interval
                            elapsedTime = totalDuration - timeRemaining;
                          } else if (isCompleted) {
                            // Interval completed - full duration elapsed
                            elapsedTime = totalDuration;
                          }
                          
                          return (
                            <div style={{
                              flex: 1,
                              display: 'flex',
                              gap: '2px',
                              height: '2rem',
                              alignItems: 'center',
                              background: '#e5e7eb',
                              borderRadius: '9999px',
                              padding: '2px',
                              overflow: 'hidden',
                              position: 'relative'
                            }}>
                              {fluxPeriods.map((period, periodIdx) => {
                                const segmentDuration = period.end - period.start;
                                const segmentWidth = (segmentDuration / interval.duration) * totalWidth;
                                const isBase = period.type === 'base';
                                
                                // Check if this is the current segment being worked on
                                const isCurrentSegment = isCurrent && elapsedTime >= period.start && elapsedTime < period.end;
                                
                                // Calculate progress within this segment
                                let segmentProgress = 0;
                                if (isCurrentSegment && elapsedTime >= period.start) {
                                  const elapsedInSegment = elapsedTime - period.start;
                                  segmentProgress = Math.min((elapsedInSegment / segmentDuration) * 100, 100);
                                } else if (elapsedTime > period.end) {
                                  segmentProgress = 100; // Segment completed
                                }
                                
                                // Calculate goal for this segment
                                const fluxStartIntensity = interval.fluxStartIntensity || 0.75;
                                const fluxIncrement = interval.fluxIncrement || 0.05;
                                let segmentGoal = null;
                                let segmentPace = null;
                                let segmentUnits = null;
                                
                                if (isBase) {
                                  const basePaceData = calculateTargetPaceWithData(interval, null);
                                  if (basePaceData && basePaceData.pace) {
                                    segmentPace = basePaceData.pace;
                                    segmentUnits = basePaceData.units;
                                    const segmentDurationMinutes = segmentDuration / 60;
                                    segmentGoal = segmentDurationMinutes * basePaceData.pace;
                                  }
                                } else {
                                  // Use fixed fluxIntensity if available, otherwise calculate progressively
                                  const fluxIntensity = interval.fluxIntensity !== null && interval.fluxIntensity !== undefined
                                    ? interval.fluxIntensity
                                    : fluxStartIntensity + (period.index * fluxIncrement);
                                  const fluxPaceData = calculateTargetPaceWithData(interval, fluxIntensity);
                                  if (fluxPaceData && fluxPaceData.pace) {
                                    segmentPace = fluxPaceData.pace;
                                    segmentUnits = fluxPaceData.units;
                                    const segmentDurationMinutes = segmentDuration / 60;
                                    segmentGoal = segmentDurationMinutes * fluxPaceData.pace;
                                  }
                                }
                                
                                // Determine segment bar color
                                const segmentBarColor = isBase
                                  ? '#FE5858'  // Coral for base segments
                                  : '#F8FBFE'; // Light background for flux segments
                                
                                return (
                                  <div
                                    key={`segment-${periodIdx}`}
                                    style={{
                                      flex: `0 0 ${segmentWidth}%`,
                                      height: '100%',
                                      background: segmentBarColor,
                                      borderRadius: periodIdx === 0 
                                        ? '9999px 0 0 9999px' 
                                        : periodIdx === fluxPeriods.length - 1 
                                        ? '0 9999px 9999px 0' 
                                        : '0',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      position: 'relative',
                                      overflow: 'hidden',
                                      minWidth: 'fit-content',
                                      transition: 'all 0.3s ease'
                                    }}
                                    title={isBase 
                                      ? `Base ${Math.floor(periodIdx / 2) + 1}: ${formatTime(segmentDuration)}${segmentGoal ? `, Goal: ${segmentGoal.toFixed(1)} ${segmentUnits || ''}` : ''}`
                                      : `Flux ${period.index + 1} @ ${Math.round((interval.fluxIntensity !== null && interval.fluxIntensity !== undefined ? interval.fluxIntensity : fluxStartIntensity + (period.index * fluxIncrement)) * 100)}%: ${formatTime(segmentDuration)}${segmentGoal ? `, Goal: ${segmentGoal.toFixed(1)} ${segmentUnits || ''}` : ''}`
                                    }
                                  >
                                    {/* Progress indicator within segment */}
                                    {isCurrentSegment && segmentProgress > 0 && (
                                      <div
                                        style={{
                                          position: 'absolute',
                                          left: 0,
                                          top: 0,
                                          bottom: 0,
                                          width: `${segmentProgress}%`,
                                          background: 'rgba(255, 255, 255, 0.3)',
                                          borderRadius: 'inherit'
                                        }}
                                      />
                                    )}
                                    
                                    {/* Segment label */}
                                    <span style={{
                                      color: isBase ? 'white' : '#282B34',  // White for coral base, dark for light flux
                                      fontSize: segmentWidth < 8 ? '0.625rem' : '0.75rem',
                                      fontWeight: '600',
                                      padding: '0 0.25rem',
                                      whiteSpace: 'nowrap',
                                      zIndex: 1,
                                      textShadow: isBase ? '0 1px 2px rgba(0, 0, 0, 0.3)' : 'none'  // Only shadow on coral base
                                    }}>
                                      {segmentWidth >= 8 && !isBase ? (
                                        `${Math.round((interval.fluxIntensity !== null && interval.fluxIntensity !== undefined ? interval.fluxIntensity : fluxStartIntensity + (period.index * fluxIncrement)) * 100)}%`
                                      ) : ''}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()
                      ) : (
                        // Non-flux intervals: render standard single bar
                      <div style={{
                        flex: 1,
                        background: '#e5e7eb',
                        borderRadius: '9999px',
                        height: '2rem',
                        position: 'relative',
                          overflow: 'visible'
                        }}>
                          {/* Background bar for burst markers */}
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            borderRadius: '9999px',
                            background: '#e5e7eb'
                          }} />
                          
                          {/* Burst markers for polarized intervals */}
                          {interval.burstTiming && (() => {
                            const burstTimes = calculateBurstTimes(interval.burstTiming, interval.duration, interval.burstDuration || 7);
                            const maxDuration = Math.max(...sessionData.intervals.map((i: any) => i.duration));
                            const normalizedWidth = maxDuration > 0 ? (interval.duration / maxDuration) : 0;
                            
                            return burstTimes.map((burst, idx) => {
                              const markerPosition = (burst.start / interval.duration) * normalizedWidth * 100;
                              return (
                                <div
                                  key={`burst-marker-${idx}`}
                                  style={{
                                    position: 'absolute',
                                    left: `${Math.min(markerPosition, 100)}%`,
                                    top: '-0.25rem',
                                    width: '3px',
                                    height: 'calc(100% + 0.5rem)',
                                    background: '#FE5858',
                                    borderRadius: '2px',
                                    zIndex: 2,
                                    boxShadow: '0 0 4px rgba(254, 88, 88, 0.5)'
                                  }}
                                  title={`Burst at ${formatTime(burst.start)}`}
                                />
                              );
                            });
                          })()}
                          
                          {/* Progress bar */}
                        <div 
                          style={{
                            background: barColor,
                            height: '100%',
                            borderRadius: '9999px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingLeft: '0.75rem',
                            paddingRight: '0.75rem',
                            transition: 'width 0.5s ease',
                            width: `${Math.min(barWidth, 100)}%`,
                              minWidth: 'fit-content',
                              position: 'relative',
                              zIndex: 1
                          }}
                        >
                          <span style={{
                            color: isCurrent ? '#F8FBFE' : isCompleted ? '#282B34' : '#F8FBFE',
                            fontSize: '0.75rem',
                            fontWeight: '600'
                          }}>
                            {formatTime(interval.duration ?? 0)}
                            {(interval.restDuration ?? 0) > 0 && ` + ${formatTime(interval.restDuration ?? 0)} rest`}
                          </span>
                        </div>
                          </div>
                      )}
                      
                      {/* Right labels - Interval input or Target pace details */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        width: '8rem',
                        justifyContent: 'flex-end',
                        fontSize: '0.75rem'
                      }}>
                        {shouldShowIntervalInputs() ? (
                          // Show interval input box
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.1"
                            min="0"
                            value={interval.actualOutput ?? ''}
                            onChange={(e: any) => handleIntervalOutputChange(interval.id, e.target.value)}
                            disabled={!isCurrent && !isCompleted}
                            placeholder="—"
                            style={{
                              width: '4rem',
                              height: '2rem',
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              textAlign: 'center',
                              border: isCurrent || isCompleted 
                                ? '1px solid #282B34' 
                                : '1px solid #d1d5db',
                              borderRadius: '0.375rem',
                              backgroundColor: isCurrent || isCompleted ? '#ffffff' : '#f3f4f6',
                              color: isCurrent ? '#282B34' : isCompleted ? '#282B34' : '#9ca3af',
                              cursor: (isCurrent || isCompleted) ? 'text' : 'not-allowed'
                            }}
                          />
                        ) : target ? (
                          target.needsRocketRacesA ? (
                            // Show "Complete Rocket Races A" for Rocket Races B when A not completed
                            <span style={{
                              color: '#dc2626',
                              fontWeight: '600',
                              fontSize: '0.625rem',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em'
                            }}>
                              {target.message}
                            </span>
                          ) : target.isMaxEffort && !target.pace ? (
                            // Show "Max Effort" for anaerobic days without learned pace
                            <span style={{
                              color: '#dc2626',
                              fontWeight: '600',
                              fontSize: '0.75rem',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em'
                            }}>
                              Max Effort
                            </span>
                          ) : (
                          <>
                            <span style={{
                              color: isCurrent ? '#282B34' : '#6b7280',
                              fontWeight: '500'
                            }}>
                              {target.intensity}%
                                        </span>
                            {target.source === 'metrics_adjusted' && (
                              <span style={{
                                background: '#9333ea',
                                color: 'white',
                                padding: '0.125rem 0.375rem',
                                borderRadius: '0.25rem',
                                fontSize: '0.625rem',
                                fontWeight: '600'
                              }}>
                                AI
                                        </span>
                            )}
                          </>
                          )
                        ) : selectedModality && !baselines[selectedModality] ? (
                          <span style={{
                            color: '#dc2626',
                            fontStyle: 'italic',
                            fontSize: '0.625rem',
                            fontWeight: '500'
                          }} title="Complete a time trial for this equipment to establish a baseline">
                            No Baseline
                                          </span>
                        ) : !selectedModality ? (
                          <span style={{
                            color: '#9ca3af',
                            fontStyle: 'italic',
                            fontSize: '0.625rem'
                          }}>
                            Select Equipment
                                          </span>
                        ) : (
                          <span style={{
                            color: '#9ca3af',
                            fontStyle: 'italic',
                            fontSize: '0.625rem'
                          }}>
                            Loading...
                                          </span>
                                        )}
                                      </div>
                                  </div>
                    </React.Fragment>
                                );
                              })}
                            </div>
                          </div>
          </div>
        </div>
      </div>
        )}

        {/* Completed Workout View - Show results entry when workout is completed */}
        {isCompleted && (
          <div className="max-w-6xl mx-auto px-6 py-8">
                {/* Show input form if results not yet entered */}
                {sessionData.totalOutput === 0 && selectedModality && baselines[selectedModality] && !isWorkoutSaved && (
                  <form onSubmit={handleResultSubmit} className="mb-6" style={{ marginTop: '1.5rem' }}>
                    <div style={{
                      background: '#DAE2EA',
                      borderRadius: '0.75rem',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                      padding: '1.5rem',
                      border: '1px solid #282B34'
                    }}>
                      <h2 style={{
                        fontSize: '1.125rem',
                        fontWeight: '600',
                        color: '#111827',
                        marginBottom: '1.5rem'
                      }}>
                        Workout Results
                      </h2>

                      {/* Total Output */}
                      {/* Score and Heart Rate Fields - All on One Line */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '120px 120px 120px',
                        gap: '2rem',
                        margin: '0 auto 1.5rem auto'
                      }}>
                        {/* Score Field */}
                        <div>
                        <label htmlFor="totalOutput" style={{
                          display: 'block',
                            fontSize: '0.75rem',
                          fontWeight: '600',
                          color: '#111827',
                            marginBottom: '0.375rem',
                            textAlign: 'center'
                        }}>
                            Score
                        </label>
                        <input
                          type="number"
                          id="totalOutput"
                          name="totalOutput"
                          step="0.1"
                          min="0"
                          required
                          autoFocus
                          style={{
                            width: '100%',
                              padding: '0.625rem 0.75rem',
                              border: '1px solid #282B34',
                            borderRadius: '0.5rem',
                              fontSize: '0.9375rem',
                            fontWeight: '500',
                            background: 'white',
                            transition: 'all 0.2s',
                              outline: 'none',
                              textAlign: 'center'
                          }}
                          className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          onFocus={(e: any) => {
                            e.target.style.borderColor = '#3b82f6';
                            e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                          }}
                          onBlur={(e: any) => {
                              e.target.style.borderColor = '#282B34';
                            e.target.style.boxShadow = 'none';
                          }}
                        />
                      </div>

                        {/* Avg HR Field */}
                        <div>
                          <label htmlFor="averageHeartRate" style={{
                            display: 'block',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: '#111827',
                            marginBottom: '0.375rem',
                            textAlign: 'center'
                          }}>
                            Avg HR
                          </label>
                          <input
                            type="number"
                            id="averageHeartRate"
                            name="averageHeartRate"
                            step="1"
                            min="0"
                            max="220"
                            style={{
                              width: '100%',
                              padding: '0.625rem 0.75rem',
                              border: '1px solid #282B34',
                              borderRadius: '0.5rem',
                              fontSize: '0.9375rem',
                              fontWeight: '500',
                              background: 'white',
                              transition: 'all 0.2s',
                              outline: 'none',
                              WebkitAppearance: 'none',
                              MozAppearance: 'textfield',
                              textAlign: 'center'
                            }}
                            className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            onFocus={(e: any) => {
                              e.target.style.borderColor = '#3b82f6';
                              e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                            }}
                            onBlur={(e: any) => {
                              e.target.style.borderColor = '#282B34';
                              e.target.style.boxShadow = 'none';
                            }}
                          />
                        </div>

                        {/* Peak HR Field */}
                        <div>
                          <label htmlFor="peakHeartRate" style={{
                            display: 'block',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: '#111827',
                            marginBottom: '0.375rem',
                            textAlign: 'center'
                          }}>
                            Peak HR
                          </label>
                          <input
                            type="number"
                            id="peakHeartRate"
                            name="peakHeartRate"
                            step="1"
                            min="0"
                            max="220"
                            style={{
                              width: '100%',
                              padding: '0.625rem 0.75rem',
                              border: '1px solid #282B34',
                              borderRadius: '0.5rem',
                              fontSize: '0.9375rem',
                              fontWeight: '500',
                              background: 'white',
                              transition: 'all 0.2s',
                              outline: 'none',
                              WebkitAppearance: 'none',
                              MozAppearance: 'textfield',
                              textAlign: 'center'
                            }}
                            className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            onFocus={(e: any) => {
                              e.target.style.borderColor = '#3b82f6';
                              e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                            }}
                            onBlur={(e: any) => {
                              e.target.style.borderColor = '#282B34';
                              e.target.style.boxShadow = 'none';
                            }}
                          />
                        </div>
                      </div>

                      <style>{`
                        input[type="number"]::-webkit-inner-spin-button,
                        input[type="number"]::-webkit-outer-spin-button {
                          -webkit-appearance: none;
                          margin: 0;
                        }
                      `}</style>

                      {/* Interval Inputs - Only show for day types with rest segments */}
                      {shouldShowIntervalInputs() && (
                        <div style={{ marginBottom: '0' }}>
                          <label style={{
                            display: 'block',
                            fontSize: '1.125rem',
                            fontWeight: '600',
                            color: '#111827',
                            marginBottom: '1rem'
                          }}>
                            Interval Scores (optional)
                          </label>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 120px)',
                            gap: '0.75rem',
                            padding: '1rem',
                            background: 'transparent',
                            borderRadius: '0.5rem',
                            border: 'none'
                          }}>
                            {sessionData.intervals.map((interval, index) => (
                              <div key={interval.id} style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.25rem'
                              }}>
                                <label style={{
                                  fontSize: '0.75rem',
                                  fontWeight: '500',
                                  color: '#6b7280'
                                }}>
                                  {interval.blockNumber ? `B${interval.blockNumber}-R${interval.roundNumber || index + 1}` : `Round ${interval.roundNumber || index + 1}`}
                                </label>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="0.1"
                                  min="0"
                                  value={interval.actualOutput ?? ''}
                                  onChange={(e: any) => handleIntervalOutputChange(interval.id, e.target.value)}
                                  placeholder="—"
                                  style={{
                                    width: '100%',
                                    padding: '0.625rem 0.75rem',
                                    fontSize: '0.9375rem',
                                    fontWeight: '500',
                                    textAlign: 'center',
                                    border: '1px solid #282B34',
                                    borderRadius: '0.5rem',
                                    backgroundColor: '#ffffff',
                                    color: '#111827',
                                    boxSizing: 'border-box'
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                          <p style={{
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            marginTop: '0.5rem',
                            fontStyle: 'italic'
                          }}>
                            Enter scores for all intervals or leave all blank. Partial entries will not be saved.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* RPE Card */}
                    <div style={{
                      background: '#DAE2EA',
                      borderRadius: '0.75rem',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                      padding: '1.5rem',
                      marginTop: '1.5rem',
                      border: '1px solid #282B34',
                      borderBottom: '1px solid #282B34'
                    }}>
                      {/* RPE Slider - Larger and Easier to Use */}
                      <div style={{ marginBottom: '1.5rem' }}>
                        <label htmlFor="perceivedExertion" style={{
                          display: 'block',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: '#111827',
                          marginBottom: '1rem'
                        }}>
                          Rate of Perceived Exertion (RPE): <span style={{ fontWeight: '700', color: '#FE5858', fontSize: '1rem' }}>{rpeValue}</span>/10
                        </label>
                        <div style={{ padding: '0.5rem 0', position: 'relative' }}>
                          {/* Track line background */}
                          <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '0',
                            right: '0',
                            height: '8px',
                            backgroundColor: '#FE5858',
                            borderRadius: '9999px',
                            transform: 'translateY(-50%)',
                            zIndex: 0
                          }} />
                          <input
                            type="range"
                            id="perceivedExertion"
                            name="perceivedExertion"
                            min="1"
                            max="10"
                            step="1"
                            value={rpeValue}
                            onChange={(e: any) => {
                              setRpeValue(parseInt(e.target.value));
                            }}
                            style={{
                              width: '100%',
                              height: '20px',
                              WebkitAppearance: 'none',
                              appearance: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              outline: 'none',
                              position: 'relative',
                              zIndex: 1
                            }}
                          />
                        </div>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.75rem',
                          color: '#282B34',
                          fontWeight: 'bold',
                          marginTop: '0.75rem',
                          padding: '0 0.25rem'
                        }}>
                          <span>1 - Very Easy</span>
                          <span>5 - Moderate</span>
                          <span>10 - Max Effort</span>
                        </div>
                        <style>{`
                          input[type="range"] {
                            -webkit-appearance: none;
                            appearance: none;
                            background: transparent;
                            cursor: pointer;
                          }
                          input[type="range"]::-webkit-slider-track {
                            width: 100%;
                            height: 8px;
                            background: #FE5858;
                            border-radius: 9999px;
                            border: none;
                            margin-top: 0px;
                          }
                          input[type="range"]::-moz-range-track {
                            width: 100%;
                            height: 8px;
                            background: #FE5858;
                            border-radius: 9999px;
                            border: none;
                          }
                          input[type="range"]::-webkit-slider-thumb {
                            -webkit-appearance: none;
                            appearance: none;
                            width: 32px;
                            height: 32px;
                            border-radius: 50%;
                            background: linear-gradient(135deg, #f87171 0%, #FE5858 100%);
                            border: 4px solid white;
                            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), 0 0 0 2px rgba(254, 88, 88, 0.2);
                            cursor: pointer;
                            transition: all 0.2s;
                            margin-top: -12px;
                          }
                          input[type="range"]::-webkit-slider-thumb:hover {
                            transform: scale(1.15);
                            box-shadow: 0 4px 12px rgba(254, 88, 88, 0.5), 0 0 0 4px rgba(254, 88, 88, 0.2);
                          }
                          input[type="range"]::-webkit-slider-thumb:active {
                            transform: scale(1.05);
                          }
                          input[type="range"]::-moz-range-thumb {
                            width: 32px;
                            height: 32px;
                            border-radius: 50%;
                            background: linear-gradient(135deg, #f87171 0%, #FE5858 100%);
                            border: 4px solid white;
                            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), 0 0 0 2px rgba(254, 88, 88, 0.2);
                            cursor: pointer;
                            transition: all 0.2s;
                          }
                          input[type="range"]::-moz-range-thumb:hover {
                            transform: scale(1.15);
                            box-shadow: 0 4px 12px rgba(254, 88, 88, 0.5), 0 0 0 4px rgba(254, 88, 88, 0.2);
                          }
                          input[type="range"]::-moz-range-thumb:active {
                            transform: scale(1.05);
                          }
                        `}</style>
                      </div>
                      </div>

                      {/* Submit Button */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
                      <button
                        type="submit"
                        style={{
                          display: 'inline-flex',
                          background: '#FE5858',
                          color: '#F8FBFE',
                          padding: '0.5rem 1rem',
                          borderRadius: '0.75rem',
                          border: '1px solid #282B34',
                          fontWeight: 'bold',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e: any) => {
                          e.target.style.background = '#e04a4a';
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 6px 8px rgba(0, 0, 0, 0.15)';
                        }}
                        onMouseLeave={(e: any) => {
                          e.target.style.background = '#FE5858';
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                        }}
                      >
                        <CheckCircle style={{ width: '1.25rem', height: '1.25rem', color: '#F8FBFE' }} />
                        Save Results
                      </button>
                    </div>
                  </form>
                )}

                {/* Show saved results and logged status */}
                {sessionData.totalOutput > 0 && (
                  <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                    {/* Workout Summary Card */}
                    <div style={{
                      background: '#DAE2EA',
                      borderRadius: '0.75rem',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                      padding: '1.5rem',
                      border: '1px solid #282B34',
                      marginBottom: '1.5rem'
                    }}>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: '#282B34'
                        }}>
                          <span>Total output:</span>
                          <span style={{ fontWeight: '700', color: '#282B34' }}>{sessionData.totalOutput.toFixed(2)} {selectedModality && baselines[selectedModality] ? baselines[selectedModality].units : ''}</span>
                        </div>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: '#282B34'
                        }}>
                          <span>Average pace:</span>
                          <span style={{ fontWeight: '700', color: '#282B34' }}>{sessionData.averagePace.toFixed(2)} {selectedModality && baselines[selectedModality] ? baselines[selectedModality].units + '/min' : ''}</span>
                        </div>
                        {sessionData.averageHeartRate && (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            color: '#282B34'
                          }}>
                            <span>Average HR:</span>
                            <span style={{ fontWeight: '700', color: '#282B34' }}>{sessionData.averageHeartRate} bpm</span>
                          </div>
                        )}
                        {sessionData.peakHeartRate && (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            color: '#282B34'
                          }}>
                            <span>Peak HR:</span>
                            <span style={{ fontWeight: '700', color: '#282B34' }}>{sessionData.peakHeartRate} bpm</span>
                          </div>
                        )}
                        {sessionData.perceivedExertion && (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            color: '#282B34'
                          }}>
                            <span>RPE:</span>
                            <span style={{ fontWeight: '700', color: '#282B34' }}>{sessionData.perceivedExertion}/10</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {isWorkoutSaved && connected && (
                      <div style={{
                        background: '#DAE2EA',
                        border: '1px solid #282B34',
                        borderRadius: '0.75rem',
                        padding: '1rem 1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        marginBottom: '1.5rem'
                      }}>
                        <CheckCircle style={{ width: '1.25rem', height: '1.25rem', color: '#FE5858', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#282B34' }}>Workout logged successfully!</span>
                      </div>
                    )}
                  </div>
                )}

            {/* Return to Dashboard Button - Only show after workout is saved */}
            {isWorkoutSaved && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
                <button
                  onClick={onBack}
                  style={{
                    display: 'inline-block',
                    background: '#FE5858',
                    color: '#F8FBFE',
                    padding: '0.5rem 1rem',
                    borderRadius: '0.75rem',
                    border: '1px solid #282B34',
                    fontWeight: 'bold',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e: any) => {
                    e.target.style.background = '#e04a4a';
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 8px rgba(0, 0, 0, 0.15)';
                  }}
                  onMouseLeave={(e: any) => {
                    e.target.style.background = '#FE5858';
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                  }}
                >
                  Return to Dashboard
                </button>
          </div>
        )}
      </div>
        )}
          </>
        )}

      {/* Database Connection */}
      {!connected && (
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl shadow-lg">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Demo Mode - Connect for Real Data
            </h3>
            <p className="text-sm text-blue-700">
              Please connect to your database from the Dashboard to load real workout data and time trial baselines.
            </p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};


