// Engine database service for React Native using mobile Supabase client
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
        return null
      }
      
      return null
    } catch (error) {
      console.error('Error loading current_program:', error)
      return null
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
      
      return (data || []).map((session: any) => ({
        ...session,
        program_version: session.program_version || '5-day'
      }))
    } catch (error) {
      console.error('Error loading completed sessions:', error)
      return []
    }
  }

  // Load time trial baselines from workout_sessions (single source of truth)
  async loadTimeTrialBaselines(modality: string, units?: string) {
    if (!this.userId || !this.supabase) return null

    try {
      console.log('🔍 Loading baseline for:', { userId: this.userId, modality, units })

      // Get most recent COMPLETED time trial from workout_sessions (single source of truth)
      let query = this.supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', this.userId)
        .eq('modality', modality)
        .eq('day_type', 'time_trial')
        .eq('completed', true)

      if (units) {
        query = query.eq('units', units)
      }

      const { data, error } = await query
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('❌ Error querying baseline:', error)
        return null
      }

      if (data) {
        console.log('✅ Baseline found from workout_sessions:', {
          id: data.id,
          modality,
          units: data.units,
          calculated_rpm: data.calculated_rpm,
          date: data.date,
          created_at: data.created_at
        })
        return data
      }

      console.log('⚠️ No baseline found for:', { modality, units })
      return null
    } catch (error) {
      console.error('Error loading time trial baselines:', error)
      return null
    }
  }

  // Load all time trials for analytics
  async loadTimeTrials() {
    if (!this.userId || !this.supabase) return []
    
    try {
      // Query workout_sessions for time trials (not time_trials table)
      const { data, error } = await this.supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', this.userId)
        .eq('day_type', 'time_trial')
        .eq('completed', true)
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
    
    try {
      await this.supabase
        .from('time_trials')
        .update({ is_current: false })
        .eq('user_id', this.userId)
        .eq('modality', timeTrialData.modality)
      
      const { error } = await this.supabase
        .from('time_trials')
        .insert({
          ...timeTrialData,
          user_id: this.userId
        })
      
      if (error) throw error
      
      return true
    } catch (error) {
      console.error('Error saving time trial:', error)
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
      const existing = await this.loadUnitPreferenceForModality(modality)
      
      if (existing) {
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

  // Load last selected modality
  async loadLastSelectedModality(): Promise<string | null> {
    if (!this.userId || !this.supabase) return null
    
    try {
      const { data, error } = await this.supabase
        .from('user_modality_preferences')
        .select('modality')
        .eq('user_id', this.userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (error) {
        if (error.code === 'PGRST116') {
          return null
        }
        console.error('Error loading last selected modality:', error)
        return null
      }
      
      return (data as any)?.modality || null
    } catch (error) {
      console.error('Error loading last selected modality:', error)
      return null
    }
  }

  // Save last selected modality (updates the updated_at timestamp of the preference)
  async saveLastSelectedModality(modality: string) {
    if (!this.userId || !this.supabase) {
      return
    }
    
    try {
      // Check if preference exists
      const existing = await this.loadUnitPreferenceForModality(modality)
      
      if (existing) {
        // Update the timestamp to mark it as last selected
        const { error } = await (this.supabase as any)
          .from('user_modality_preferences')
          .update({
            updated_at: new Date().toISOString()
          })
          .eq('user_id', this.userId)
          .eq('modality', modality)
        
        if (error) {
          console.error('Error saving last selected modality:', error)
        }
      } else {
        // Create a new preference entry (without unit preference)
        const { error } = await (this.supabase as any)
          .from('user_modality_preferences')
          .insert({
            user_id: this.userId,
            modality: modality,
            primary_unit: 'calories',  // Default placeholder, user can change later
            secondary_unit: null,
            updated_at: new Date().toISOString()
          })
        
        if (error) {
          console.error('Error saving last selected modality:', error)
        }
      }
    } catch (error) {
      console.error('Error saving last selected modality:', error)
    }
  }

  // Save workout session
  async saveWorkoutSession(sessionData: any) {
    if (!this.userId || !this.supabase) {
      throw new Error('Not connected')
    }
    
    try {
      const { error } = await this.supabase
        .from('workout_sessions')
        .insert({
          ...sessionData,
          user_id: this.userId
        })
      
      if (error) throw error
      
      return true
    } catch (error) {
      console.error('Error saving workout session:', error)
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
        .maybeSingle()
      
      if (error) {
        throw error
      }
      
      return data
    } catch (error) {
      console.error('Error getting performance metrics:', error)
      return null
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
        completedDays: completedSessions.map((session: any) => 
          session.program_day_number || session.program_day || session.day_number || session.workout_day
        )
      }
    } catch (error) {
      console.error('Error in loadUserProgress:', error)
      throw error
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

  // Get workouts for program version
  async getWorkoutsForProgram(programVersion: string) {
    if (!this.supabase) return []
    
    if (programVersion === '5-day') {
      // 5-day program: return all workouts
      return await this.loadWorkouts()
    }
    
    // For 3-day program, we need to filter workouts
    // For now, return all workouts and let the component handle filtering
    // This can be enhanced later with program mapping if needed
    const allWorkouts = await this.loadWorkouts()
    
    // For 3-day, we'd typically filter based on program mapping
    // For simplicity, return all workouts and filter by program_type in the component
    return allWorkouts
  }
}

// Create singleton instance
const engineDatabaseService = new EngineDatabaseService()

export default engineDatabaseService

