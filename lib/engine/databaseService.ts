// Engine database service using Next.js Supabase client
import { createClient } from '@/lib/supabase/client'

class EngineDatabaseService {
  private supabase: ReturnType<typeof createClient> | null = null
  private userId: string | null = null

  constructor() {
    // Initialize Supabase client
    this.supabase = createClient()
  }

  // Initialize with user ID from auth
  async initialize() {
    if (!this.supabase) {
      this.supabase = createClient()
    }
    
    const { data: { user } } = await this.supabase.auth.getUser()
    if (user) {
      // Get user ID from users table using auth_id
      const { data: userData } = await this.supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()
      
      if (userData) {
        this.userId = userData.id.toString()
      }
    }
    
    return !!this.userId
  }

  // Check if connected (has user ID)
  isConnected(): boolean {
    return !!this.userId
  }

  // Get user ID (for components that need it)
  getUserId(): string | null {
    return this.userId
  }

  // Load user data
  async loadUserData() {
    if (!this.userId || !this.supabase) return null
    
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', this.userId)
        .single()
      
      if (error) {
        console.error('Error loading user data:', error)
        return null
      }
      
      return data
    } catch (error) {
      console.error('Error loading user data:', error)
      return null
    }
  }

  // Save user program (current_program)
  async saveProgramVersion(programVersion: string) {
    if (!this.userId || !this.supabase) {
      throw new Error('Not connected')
    }
    
    try {
      const { error } = await this.supabase
        .from('users')
        .update({ current_program: programVersion })
        .eq('id', this.userId)
      
      if (error) throw error
      
      console.log('✅ Program saved successfully:', programVersion)
      return true
    } catch (error) {
      console.error('❌ Error saving program:', error)
      throw error
    }
  }

  // Load user program (current_program)
  async loadProgramVersion(): Promise<string | null> {
    if (!this.userId || !this.supabase) {
      console.warn('loadProgramVersion: userId not set')
      return null
    }
    
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('current_program')
        .eq('id', this.userId)
        .single()
      
      if (error) {
        console.error('Error loading program version:', error)
        return null
      }
      
      if (data?.current_program) {
        const value = data.current_program
        if (value === '5-day' || value === '3-day') {
          return value
        }
        // Invalid value, treat as no selection
        return null
      }
      
      return null
    } catch (error) {
      console.error('Error loading current_program:', error)
      return null
    }
  }

  // Get program mapping for a specific program type
  async getProgramMapping(programType: string, userId: string | null = null) {
    if (!this.supabase) return { mappings: [], sourceToProgram: new Map(), programToSource: new Map() }
    
    try {
      let query = this.supabase
        .from('program_mapping')
        .select('*')
        .eq('program_type', programType)
        .order('program_day_number', { ascending: true })
      
      if (userId) {
        query = query.eq('user_id', userId)
      } else {
        query = query.is('user_id', null)
      }
      
      const { data, error } = await query
      
      if (error) {
        console.error('Error loading program mapping:', error)
        return { mappings: [], sourceToProgram: new Map(), programToSource: new Map() }
      }
      
      // Create maps for quick lookups
      const sourceToProgram = new Map<number, number>()
      const programToSource = new Map<number, number>()
      
      data?.forEach((mapping: any) => {
        sourceToProgram.set(mapping.source_day_number, mapping.program_day_number)
        programToSource.set(mapping.program_day_number, mapping.source_day_number)
      })
      
      return {
        mappings: data || [],
        sourceToProgram,
        programToSource
      }
    } catch (error) {
      console.error('Error loading program mapping:', error)
      return { mappings: [], sourceToProgram: new Map(), programToSource: new Map() }
    }
  }

  // Get workouts filtered by program version
  async getWorkoutsForProgram(programVersion: string, userId: string | null = null) {
    if (!this.supabase) return []
    
    if (programVersion === '5-day') {
      // 5-day program: return all workouts
      return await this.loadWorkouts()
    }
    
    // Other programs: get mapping and filter workouts
    const mapping = await this.getProgramMapping(programVersion, userId)
    
    if (mapping.mappings.length === 0) {
      console.warn(`No mapping found for program: ${programVersion}`)
      return []
    }
    
    // Get all workouts first
    const allWorkouts = await this.loadWorkouts()
    
    // Filter to only include mapped source days
    const sourceDaySet = new Set(mapping.mappings.map((m: any) => m.source_day_number))
    const filteredWorkouts = allWorkouts
      .filter((workout: any) => sourceDaySet.has(workout.day_number))
      .map((workout: any) => ({
        ...workout,
        program_day_number: mapping.sourceToProgram.get(workout.day_number)
      }))
      .sort((a: any, b: any) => (a.program_day_number || 0) - (b.program_day_number || 0))
    
    return filteredWorkouts
  }

  // Get program_day_number for a given source_day_number and program_version
  async getProgramDayNumber(sourceDayNumber: number, programVersion: string, userId: string | null = null): Promise<number | null> {
    if (programVersion === '5-day') {
      return sourceDayNumber
    }
    
    try {
      const mapping = await this.getProgramMapping(programVersion, userId)
      const programDayNumber = mapping.sourceToProgram.get(sourceDayNumber)
      
      if (programDayNumber === undefined) {
        console.warn(`No program_day_number found for source_day_number ${sourceDayNumber} in program ${programVersion}`)
        return null
      }
      
      return programDayNumber
    } catch (error) {
      console.error('Error getting program_day_number:', error)
      return null
    }
  }

  // Load workouts
  async loadWorkouts() {
    if (!this.supabase) return []
    
    try {
      const { data, error } = await this.supabase
        .from('workouts')
        .select('*')
        .order('day_number', { ascending: true })
      
      if (error) {
        console.error('Error loading workouts:', error)
        return []
      }
      
      return data || []
    } catch (error) {
      console.error('Error loading workouts:', error)
      return []
    }
  }

  // Load workout for specific day
  async loadWorkoutForDay(dayNumber: number) {
    if (!this.supabase) return null
    
    try {
      const { data, error } = await this.supabase
        .from('workouts')
        .select('*')
        .eq('day_number', dayNumber)
        .single()
      
      if (error) {
        console.error('Error loading workout for day:', error)
        return null
      }
      
      return data
    } catch (error) {
      console.error('Error loading workout for day:', error)
      return null
    }
  }

  // Load completed sessions
  async loadCompletedSessions() {
    if (!this.userId || !this.supabase) return []
    
    try {
      const { data, error } = await this.supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', this.userId)
        .eq('completed', true)
        .order('date', { ascending: false })
      
      if (error) {
        console.error('Error loading completed sessions:', error)
        return []
      }
      
      // Normalize NULL program_version to '5-day' for legacy compatibility
      return (data || []).map((session: any) => ({
        ...session,
        program_version: session.program_version || '5-day'
      }))
    } catch (error) {
      console.error('Error loading completed sessions:', error)
      return []
    }
  }

  // Get workout session for a specific day number and day type
  async getWorkoutSessionByDay(programDayNumber: number, dayType: string, programVersion: string | null = null) {
    if (!this.userId || !this.supabase) return null
    
    try {
      let query = this.supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', this.userId)
        .eq('day_type', dayType)
        .eq('completed', true)
        .or(`program_day_number.eq.${programDayNumber},program_day.eq.${programDayNumber}`)
        .order('date', { ascending: false })
        .limit(1)
      
      const { data, error } = await query
      
      if (error) {
        console.error('Error getting workout session by day:', error)
        return null
      }
      
      if (data && data.length > 0) {
        const session = data[0]
        // Filter by program_version if provided
        if (programVersion) {
          const sessionProgramVersion = session.program_version || '5-day'
          if (sessionProgramVersion !== programVersion) {
            return null
          }
        }
        return session
      }
      
      return null
    } catch (error) {
      console.error('Error getting workout session by day:', error)
      return null
    }
  }

  // Load time trial baselines
  async loadTimeTrialBaselines(modality: string) {
    if (!this.userId || !this.supabase) return null
    
    try {
      // First try to get the current baseline
      const { data: currentData, error: currentError } = await this.supabase
        .from('time_trials')
        .select('*')
        .eq('user_id', this.userId)
        .eq('modality', modality)
        .eq('is_current', true)
        .limit(1)
        .single()
      
      if (!currentError && currentData) {
        return currentData
      }
      
      // Fallback: get most recent by date
      const { data: recentData, error: recentError } = await this.supabase
        .from('time_trials')
        .select('*')
        .eq('user_id', this.userId)
        .eq('modality', modality)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (!recentError && recentData) {
        return recentData
      }
      
      return null
    } catch (error) {
      console.error('Error loading time trial baselines:', error)
      return null
    }
  }

  // Load previous baselines for modality
  async loadPreviousBaselines(modality: string, limit: number = 5) {
    if (!this.userId || !this.supabase) return []
    
    try {
      const { data, error } = await this.supabase
        .from('time_trials')
        .select('*')
        .eq('user_id', this.userId)
        .eq('modality', modality)
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (error) {
        console.error('Error loading previous baselines:', error)
        return []
      }
      
      return data || []
    } catch (error) {
      console.error('Error loading previous baselines:', error)
      return []
    }
  }

  // Load all time trials for analytics
  async loadTimeTrials() {
    if (!this.userId || !this.supabase) return []
    
    try {
      const { data, error } = await this.supabase
        .from('time_trials')
        .select('*')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error loading time trials:', error)
        return []
      }
      
      return data || []
    } catch (error) {
      console.error('Error loading time trials:', error)
      return []
    }
  }

  // Save time trial
  async saveTimeTrial(timeTrialData: any) {
    if (!this.userId || !this.supabase) {
      throw new Error('Not connected')
    }
    
    console.log('🔍 Attempting to save time trial:', timeTrialData)
    
    try {
      // First, set all existing time trials for this modality to is_current = false
      await this.supabase
        .from('time_trials')
        .update({ is_current: false })
        .eq('user_id', this.userId)
        .eq('modality', timeTrialData.modality)
      
      // Then insert the new time trial
      const { error } = await this.supabase
        .from('time_trials')
        .insert({
          ...timeTrialData,
          user_id: this.userId
        })
      
      if (error) throw error
      
      console.log('✅ Time trial saved successfully')
      return true
    } catch (error) {
      console.error('❌ Error saving time trial:', error)
      throw error
    }
  }

  // Load unit preference for a specific modality
  async loadUnitPreferenceForModality(modality: string) {
    if (!this.userId || !this.supabase) return null
    
    try {
      const { data, error } = await this.supabase
        .from('user_modality_preferences')
        .select('primary_unit')
        .eq('user_id', this.userId)
        .eq('modality', modality)
        .limit(1)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No preference found
          return null
        }
        console.error('Error loading unit preference:', error)
        return null
      }
      
      return data?.primary_unit || null
    } catch (error) {
      console.error('Error loading unit preference:', error)
      return null
    }
  }

  // Save unit preference for a modality
  async saveUnitPreferenceForModality(modality: string, primaryUnit: string, secondaryUnit: string | null = null) {
    if (!this.userId || !this.supabase) {
      throw new Error('Not connected')
    }
    
    try {
      // Check if preference already exists
      const existing = await this.loadUnitPreferenceForModality(modality)
      
      if (existing) {
        // Update existing preference
        const { error } = await this.supabase
          .from('user_modality_preferences')
          .update({
            primary_unit: primaryUnit,
            secondary_unit: secondaryUnit,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', this.userId)
          .eq('modality', modality)
        
        if (error) throw error
      } else {
        // Insert new preference
        const { error } = await this.supabase
          .from('user_modality_preferences')
          .insert({
            user_id: this.userId,
            modality: modality,
            primary_unit: primaryUnit,
            secondary_unit: secondaryUnit
          })
        
        if (error) throw error
      }
      
      return true
    } catch (error) {
      console.error('Error saving unit preference:', error)
      throw error
    }
  }

  // Load all unit preferences for a user
  async loadAllUnitPreferences() {
    if (!this.userId || !this.supabase) return {}
    
    try {
      const { data, error } = await this.supabase
        .from('user_modality_preferences')
        .select('modality, primary_unit')
        .eq('user_id', this.userId)
      
      if (error) {
        console.error('Error loading all unit preferences:', error)
        return {}
      }
      
      // Convert to object: { modality: primary_unit }
      const preferences: Record<string, string> = {}
      data?.forEach((pref: any) => {
        preferences[pref.modality] = pref.primary_unit
      })
      
      return preferences
    } catch (error) {
      console.error('Error loading all unit preferences:', error)
      return {}
    }
  }

  // Save workout session
  async saveWorkoutSession(sessionData: any) {
    if (!this.userId || !this.supabase) {
      throw new Error('Not connected')
    }
    
    try {
      console.log('💾 databaseService.saveWorkoutSession called with:', {
        total_output: sessionData.total_output,
        actual_pace: sessionData.actual_pace,
        target_pace: sessionData.target_pace,
        performance_ratio: sessionData.performance_ratio,
        day_type: sessionData.day_type
      })
      
      const { error } = await this.supabase
        .from('workout_sessions')
        .insert({
          ...sessionData,
          user_id: this.userId
        })
      
      if (error) throw error
      
      console.log('✅ databaseService.saveWorkoutSession success')
      return true
    } catch (error) {
      console.error('❌ Error in databaseService.saveWorkoutSession:', error)
      throw error
    }
  }

  // Update performance metrics (calls PostgreSQL function)
  async updatePerformanceMetrics(
    userId: string,
    dayType: string,
    modality: string,
    performanceRatio: number,
    actualPace: number,
    isMaxEffort: boolean
  ) {
    if (!this.supabase) {
      throw new Error('Not connected')
    }
    
    try {
      console.log('🔄 databaseService.updatePerformanceMetrics called with:', {
        userId,
        dayType,
        modality,
        performanceRatio,
        actualPace,
        isMaxEffort
      })
      
      const { error } = await this.supabase.rpc('update_engine_performance_metrics', {
        p_user_id: userId,
        p_day_type: dayType,
        p_modality: modality,
        p_performance_ratio: performanceRatio,
        p_actual_pace: actualPace
      })
      
      if (error) throw error
      
      console.log('✅ databaseService.updatePerformanceMetrics success')
      return true
    } catch (error) {
      console.error('❌ Error calling update_engine_performance_metrics:', error)
      throw error
    }
  }

  // Get rolling performance metrics for a user/day_type/modality
  async getPerformanceMetrics(userId: string, dayType: string, modality: string) {
    if (!this.supabase) return null
    
    try {
      const { data, error } = await this.supabase
        .from('user_performance_metrics')
        .select('*')
        .eq('user_id', userId)
        .eq('day_type', dayType)
        .eq('modality', modality)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No metrics found
          return null
        }
        throw error
      }
      
      return data
    } catch (error) {
      console.error('Error getting performance metrics:', error)
      return null
    }
  }

  // Load user progress (combined user data and completed sessions)
  async loadUserProgress() {
    try {
      const [userData, completedSessions] = await Promise.all([
        this.loadUserData(),
        this.loadCompletedSessions()
      ])

      return {
        user: userData,
        completedSessions: completedSessions,
        completedDays: completedSessions.map((session: any) => session.day_number || session.workout_day)
      }
    } catch (error) {
      console.error('Error in loadUserProgress:', error)
      throw error
    }
  }

  // Load unlocked workout days based on user's subscription
  async loadUnlockedWorkoutDays() {
    const userData = await this.loadUserData()
    if (!userData) {
      console.log('No user data, loading first month only')
      const { data } = await this.supabase!
        .from('workouts')
        .select('*')
        .lte('day_number', 20)
        .order('day_number', { ascending: true })
      return data || []
    }

    console.log('Loading unlocked workout days for user:', userData)

    // Check if user has access to all months (use correct field name from database)
    if (userData.engine_months_unlocked >= 36) {
      console.log('User has access to all months, loading all workouts')
      return await this.loadWorkouts()
    }

    let maxUnlockedDay = 0

    // For inactive/trial users, only allow first month (days 1-20)
    if (userData.subscription_status === 'INACTIVE' || userData.subscription_status === 'trial') {
      maxUnlockedDay = 20
    }
    // For active users, allow based on current day progression
    else if (userData.subscription_status === 'ACTIVE' || userData.subscription_status === 'active') {
      maxUnlockedDay = (userData.engine_current_day || 0) + 20 // Current day plus buffer
    }

    console.log('Max unlocked day:', maxUnlockedDay)
    
    // Load workouts for unlocked days
    const { data } = await this.supabase!
      .from('workouts')
      .select('*')
      .lte('day_number', maxUnlockedDay)
      .order('day_number', { ascending: true })
    
    return data || []
  }

  // Load day types for analytics
  async loadDayTypes() {
    if (!this.supabase) return []
    
    try {
      const { data, error } = await this.supabase
        .from('day_types')
        .select('*')
        .order('phase_requirement', { ascending: true })
        .order('name', { ascending: true })
      
      if (error) {
        console.error('Error loading day types:', error)
        return []
      }
      
      return data || []
    } catch (error) {
      console.error('Error loading day types:', error)
      return []
    }
  }

  // Load day types with detailed analysis
  async loadDayTypesAnalysis() {
    if (!this.supabase) return []
    
    try {
      const { data, error } = await this.supabase
        .from('day_types')
        .select(`
          id,
          name,
          phase_requirement,
          block_count,
          set_rest_seconds,
          block_1_params,
          block_2_params,
          block_3_params,
          block_4_params,
          max_duration_minutes,
          is_support_day,
          created_at,
          updated_at
        `)
        .order('phase_requirement', { ascending: true })
        .order('name', { ascending: true })
      
      if (error) {
        console.error('Error loading day types analysis:', error)
        return []
      }
      
      return data || []
    } catch (error) {
      console.error('Error loading day types analysis:', error)
      return []
    }
  }

  // Get day type patterns for ML feature extraction
  async getDayTypePatterns() {
    try {
      const dayTypes = await this.loadDayTypesAnalysis()
      
      const patterns = dayTypes.map((dayType: any) => {
        // Extract common patterns from block parameters
        const extractBlockPatterns = (blockParams: any) => {
          if (!blockParams) return null
          
          return {
            rounds: blockParams.rounds || null,
            workDuration: blockParams.workDuration || null,
            restDuration: blockParams.restDuration || null,
            paceRange: blockParams.paceRange || null,
            workProgression: blockParams.workProgression || null,
            restProgression: blockParams.restProgression || null,
            paceProgression: blockParams.paceProgression || null,
            burstTiming: blockParams.burstTiming || null,
            baseDuration: blockParams.baseDuration || null,
            fluxDuration: blockParams.fluxDuration || null,
            fluxStartIntensity: blockParams.fluxStartIntensity || null,
            fluxIncrement: blockParams.fluxIncrement || null,
            workDurationOptions: blockParams.workDurationOptions || null,
            restDurationOptions: blockParams.restDurationOptions || null
          }
        }

        return {
          id: dayType.id,
          name: dayType.name,
          phase_requirement: dayType.phase_requirement,
          block_count: dayType.block_count,
          max_duration_minutes: dayType.max_duration_minutes,
          is_support_day: dayType.is_support_day,
          set_rest_seconds: dayType.set_rest_seconds,
          block_1_patterns: extractBlockPatterns(dayType.block_1_params),
          block_2_patterns: extractBlockPatterns(dayType.block_2_params),
          block_3_patterns: extractBlockPatterns(dayType.block_3_params),
          block_4_patterns: extractBlockPatterns(dayType.block_4_params),
          // ML-friendly features
          ml_features: {
            total_blocks: dayType.block_count,
            has_multiple_blocks: dayType.block_count > 1,
            has_set_rest: !!dayType.set_rest_seconds,
            is_support_day: dayType.is_support_day,
            max_duration_category: dayType.max_duration_minutes <= 15 ? 'short' : 
                                 dayType.max_duration_minutes <= 30 ? 'medium' : 'long',
            phase_category: dayType.phase_requirement <= 3 ? 'early' :
                           dayType.phase_requirement <= 6 ? 'mid' :
                           dayType.phase_requirement <= 9 ? 'late' : 'advanced'
          }
        }
      })

      return patterns
    } catch (error) {
      console.error('Error extracting day type patterns:', error)
      return []
    }
  }
}

// Create singleton instance
const engineDatabaseService = new EngineDatabaseService()

export default engineDatabaseService

