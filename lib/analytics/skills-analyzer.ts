// /lib/analytics/skills-analyzer.ts
import { calculateTrend } from './data-processors'

export interface SkillsAnalysisData {
  skills: { [skillName: string]: SkillData }
  skillsByGrade: SkillsByGrade
  weeklyProgression: WeeklySkillsData[]
  consistencyMetrics: ConsistencyMetrics
}

export interface SkillData {
  name: string
  block: 'SKILLS' | 'TECHNICAL WORK'
  sessions: SkillSession[]
  totalReps: number
  avgRPE: number
  avgQuality: number
  qualityGrade: 'A' | 'B' | 'C' | 'D'
  progressionTrend: 'improving' | 'declining' | 'stable'
  lastPerformed: string
  daysSinceLast: number
  weeksActive: number
  consistency: number // 0-100% based on regular practice
}

export interface SkillSession {
  week: number
  date: string
  sets: number
  reps: number
  rpe: number
  quality: number
  result: string
  notes?: string
}

export interface SkillsByGrade {
  A: SkillData[]
  B: SkillData[]
  C: SkillData[]
  D: SkillData[]
}

export interface WeeklySkillsData {
  week: number
  skillsCompleted: number
  technicalCompleted: number
  avgSkillsRPE: number
  avgTechnicalRPE: number
  avgSkillsQuality: number
  avgTechnicalQuality: number
  newSkillsIntroduced: number
}

export interface ConsistencyMetrics {
  totalSkillsPracticed: number
  regularlyPracticedSkills: number // Practiced in last 2 weeks
  averageSessionsPerSkill: number
  mostConsistentSkill: string
  leastConsistentSkill: string
  overallConsistencyRate: number
}

/**
 * Process skills and technical work performance data
 */
export function processSkillsData(
  performanceData: any[],
  weeklySummaries: any[],
  skillTypeFilter: string = 'all'
): SkillsAnalysisData | null {
  try {
    console.log(`🎯 Processing ${performanceData.length} skills sessions`)
    
    if (!performanceData || performanceData.length === 0) {
      return null
    }

    // Group data by skill
    const skills: { [key: string]: SkillData } = {}
    
    performanceData.forEach(session => {
      const skillName = standardizeSkillName(session.exercise_name)
      const block = session.block as 'SKILLS' | 'TECHNICAL WORK'
      
      // Apply skill type filter
      if (skillTypeFilter !== 'all') {
        const filterBlock = skillTypeFilter.toUpperCase()
        if (block !== filterBlock) {
          return
        }
      }

      if (!skills[skillName]) {
        skills[skillName] = {
          name: skillName,
          block,
          sessions: [],
          totalReps: 0,
          avgRPE: 0,
          avgQuality: 0,
          qualityGrade: 'D',
          progressionTrend: 'stable',
          lastPerformed: '',
          daysSinceLast: 0,
          weeksActive: 0,
          consistency: 0
        }
      }

      const sets = parseInt(session.sets) || 1
      const reps = parseInt(session.reps) || 1
      const sessionReps = sets * reps

      const skillSession: SkillSession = {
        week: session.week,
        date: session.logged_at,
        sets,
        reps,
        rpe: parseFloat(session.rpe) || 0,
        quality: parseFloat(session.quality_grade) || 0,
        result: session.result || '',
        notes: session.notes
      }

      skills[skillName].sessions.push(skillSession)
      skills[skillName].totalReps += sessionReps
      skills[skillName].lastPerformed = session.logged_at
    })

    // Calculate skill statistics
    Object.keys(skills).forEach(skillName => {
      const skill = skills[skillName]
      const sessions = skill.sessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      
      if (sessions.length > 0) {
        // Calculate averages
        skill.avgRPE = sessions.reduce((sum, s) => sum + s.rpe, 0) / sessions.length
        skill.avgQuality = sessions.reduce((sum, s) => sum + s.quality, 0) / sessions.length
        skill.qualityGrade = convertQualityToGrade(skill.avgQuality)
        skill.weeksActive = new Set(sessions.map(s => s.week)).size
        
        // Calculate progression trend
        const qualityScores = sessions.map(s => s.quality).filter(q => q > 0)
        skill.progressionTrend = qualityScores.length > 1 ? calculateTrend(qualityScores) : 'stable'
        
        // Calculate days since last practice
        const lastDate = new Date(skill.lastPerformed)
        const today = new Date()
        skill.daysSinceLast = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
        
        // Calculate consistency (based on regular practice over time)
        skill.consistency = calculateSkillConsistency(sessions)
      }
    })

    // Group skills by grade
    const skillsByGrade = groupSkillsByGrade(skills)

    // Calculate weekly progression
    const weeklyProgression = calculateWeeklySkillsProgression(weeklySummaries)

    // Calculate consistency metrics
    const consistencyMetrics = calculateConsistencyMetrics(skills)

    console.log(`✅ Processed ${Object.keys(skills).length} skills across ${weeklyProgression.length} weeks`)

    return {
      skills,
      skillsByGrade,
      weeklyProgression,
      consistencyMetrics
    }

  } catch (error) {
    console.error(`❌ Error processing skills data: ${error.message}`)
    return null
  }
}

/**
 * Standardize skill names for consistency
 */
function standardizeSkillName(exerciseName: string): string {
  const skillMap: { [key: string]: string } = {
    // Ring skills
    'ring muscle ups': 'Ring Muscle Ups',
    'ring muscle up': 'Ring Muscle Ups',
    'rmu': 'Ring Muscle Ups',
    'ring dips': 'Ring Dips',
    'ring push ups': 'Ring Push Ups',
    
    // Pull-up variations
    'pull-ups': 'Pull-ups',
    'pullups': 'Pull-ups',
    'pull ups': 'Pull-ups',
    'strict pull-ups': 'Strict Pull-ups',
    'strict pullups': 'Strict Pull-ups',
    'kipping pull-ups': 'Kipping Pull-ups',
    'kipping pullups': 'Kipping Pull-ups',
    'chest to bar': 'Chest to Bar',
    'c2b': 'Chest to Bar',
    
    // Handstand skills
    'handstand push-ups': 'Handstand Push-ups',
    'handstand push ups': 'Handstand Push-ups',
    'hspu': 'Handstand Push-ups',
    'handstand hold': 'Handstand Hold',
    'wall facing handstand push-ups': 'Wall Facing HSPU',
    'wall facing hspu': 'Wall Facing HSPU',
    
    // Core skills
    'toes to bar': 'Toes to Bar',
    't2b': 'Toes to Bar',
    'toes-to-bar': 'Toes to Bar',
    'knees to elbows': 'Knees to Elbows',
    'k2e': 'Knees to Elbows',
    
    // Rope skills
    'rope climbs': 'Rope Climbs',
    'rope climb': 'Rope Climbs',
    'legless rope climbs': 'Legless Rope Climbs',
    'legless rope climb': 'Legless Rope Climbs',
    
    // Double unders
    'double unders': 'Double Unders',
    'double under': 'Double Unders',
    'du': 'Double Unders',
    'dubs': 'Double Unders',
    
    // Pistol squats
    'pistol squats': 'Pistol Squats',
    'pistol squat': 'Pistol Squats',
    'single leg squats': 'Pistol Squats',
    
    // Box jumps
    'box jumps': 'Box Jumps',
    'box jump': 'Box Jumps',
    'box jump overs': 'Box Jump Overs',
    'bjo': 'Box Jump Overs'
  }

  const exerciseLower = exerciseName.toLowerCase().trim()
  return skillMap[exerciseLower] || exerciseName
}

/**
 * Convert numeric quality to letter grade
 */
function convertQualityToGrade(quality: number): 'A' | 'B' | 'C' | 'D' {
  if (quality >= 3.5) return 'A'
  if (quality >= 2.5) return 'B'
  if (quality >= 1.5) return 'C'
  return 'D'
}

/**
 * Calculate skill consistency based on practice frequency
 */
function calculateSkillConsistency(sessions: SkillSession[]): number {
  if (sessions.length === 0) return 0
  
  // Get unique weeks practiced
  const weeksSet = new Set(sessions.map(s => s.week))
  const weeksArray = Array.from(weeksSet).sort((a, b) => a - b)
  
  if (weeksArray.length <= 1) return sessions.length > 0 ? 50 : 0
  
  // Calculate consistency as % of weeks with practice
  const totalWeekSpan = weeksArray[weeksArray.length - 1] - weeksArray[0] + 1
  const practiceWeeks = weeksSet.size
  
  const baseConsistency = (practiceWeeks / totalWeekSpan) * 100
  
  // Bonus for recent practice (last 2 weeks)
  const recentSessions = sessions.filter(s => {
    const sessionDate = new Date(s.date)
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    return sessionDate >= twoWeeksAgo
  })
  
  const recentBonus = recentSessions.length > 0 ? 10 : -20
  
  return Math.max(0, Math.min(100, Math.round(baseConsistency + recentBonus)))
}

/**
 * Group skills by quality grade for display
 */
function groupSkillsByGrade(skills: { [key: string]: SkillData }): SkillsByGrade {
  const skillsByGrade: SkillsByGrade = {
    A: [],
    B: [],
    C: [],
    D: []
  }

  Object.values(skills).forEach(skill => {
    skillsByGrade[skill.qualityGrade].push(skill)
  })

  // Sort each grade by total reps (most practiced first)
  Object.keys(skillsByGrade).forEach(grade => {
    skillsByGrade[grade as keyof SkillsByGrade].sort((a, b) => b.totalReps - a.totalReps)
  })

  return skillsByGrade
}

/**
 * Calculate weekly skills progression from summaries
 */
function calculateWeeklySkillsProgression(weeklySummaries: any[]): WeeklySkillsData[] {
  return weeklySummaries.map(summary => ({
    week: summary.week,
    skillsCompleted: summary.skills_completed || 0,
    technicalCompleted: summary.technical_completed || 0,
    avgSkillsRPE: summary.skills_avg_rpe || 0,
    avgTechnicalRPE: summary.technical_avg_rpe || 0,
    avgSkillsQuality: summary.skills_avg_quality || 0,
    avgTechnicalQuality: summary.technical_avg_quality || 0,
    newSkillsIntroduced: 0 // Would need additional logic to detect new skills
  })).sort((a, b) => a.week - b.week)
}

/**
 * Calculate overall consistency metrics
 */
function calculateConsistencyMetrics(skills: { [key: string]: SkillData }): ConsistencyMetrics {
  const skillsList = Object.values(skills)
  
  if (skillsList.length === 0) {
    return {
      totalSkillsPracticed: 0,
      regularlyPracticedSkills: 0,
      averageSessionsPerSkill: 0,
      mostConsistentSkill: '',
      leastConsistentSkill: '',
      overallConsistencyRate: 0
    }
  }

  // Count regularly practiced skills (practiced in last 2 weeks)
  const regularSkills = skillsList.filter(skill => skill.daysSinceLast <= 14)
  
  // Calculate average sessions per skill
  const totalSessions = skillsList.reduce((sum, skill) => sum + skill.sessions.length, 0)
  const avgSessionsPerSkill = totalSessions / skillsList.length
  
  // Find most and least consistent skills
  const sortedByConsistency = skillsList.sort((a, b) => b.consistency - a.consistency)
  const mostConsistent = sortedByConsistency[0]?.name || ''
  const leastConsistent = sortedByConsistency[sortedByConsistency.length - 1]?.name || ''
  
  // Calculate overall consistency rate
  const overallConsistency = skillsList.reduce((sum, skill) => sum + skill.consistency, 0) / skillsList.length

  return {
    totalSkillsPracticed: skillsList.length,
    regularlyPracticedSkills: regularSkills.length,
    averageSessionsPerSkill: Math.round(avgSessionsPerSkill * 10) / 10,
    mostConsistentSkill: mostConsistent,
    leastConsistentSkill: leastConsistent,
    overallConsistencyRate: Math.round(overallConsistency)
  }
}

/**
 * Get skill progression data for charting
 */
export function getSkillProgressionData(skill: SkillData) {
  const sessions = skill.sessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  
  return {
    weeks: sessions.map(s => s.week),
    rpe: sessions.map(s => s.rpe),
    quality: sessions.map(s => s.quality),
    volume: sessions.map(s => s.sets * s.reps),
    dates: sessions.map(s => s.date)
  }
}

/**
 * Calculate skill mastery percentage
 */
export function calculateSkillMastery(skills: { [key: string]: SkillData }): number {
  const skillsList = Object.values(skills)
  if (skillsList.length === 0) return 0
  
  const masteredSkills = skillsList.filter(skill => skill.qualityGrade === 'A').length
  return Math.round((masteredSkills / skillsList.length) * 100)
}

/**
 * Get skills needing attention (not practiced recently or low quality)
 */
export function getSkillsNeedingAttention(
  skills: { [key: string]: SkillData }
): SkillData[] {
  return Object.values(skills)
    .filter(skill => 
      skill.daysSinceLast > 14 || // Not practiced in 2+ weeks
      skill.qualityGrade === 'D' || // Poor quality
      skill.consistency < 30 // Low consistency
    )
    .sort((a, b) => b.daysSinceLast - a.daysSinceLast)
}

/**
 * Get skills ready for progression (high quality, consistent practice)
 */
export function getSkillsReadyForProgression(
  skills: { [key: string]: SkillData }
): SkillData[] {
  return Object.values(skills)
    .filter(skill => 
      skill.qualityGrade === 'A' && // High quality
      skill.avgRPE <= 6.5 && // Not too difficult
      skill.consistency >= 70 && // Consistent practice
      skill.daysSinceLast <= 7 // Recently practiced
    )
    .sort((a, b) => b.consistency - a.consistency)
}
