/**
 * Detects equipment types from exercise arrays
 * Used for filtering workouts by equipment category
 */
export function detectEquipment(exercises: any[]): string[] {
  const equipment: string[] = []
  const exerciseNames = exercises.map(e => (e.name || e.exercise || '').toLowerCase())
  
  // Barbell detection
  const barbellExercises = [
    'clean', 'snatch', 'deadlift', 'squat', 'press', 'jerk', 
    'thruster', 'front squat', 'back squat', 'overhead squat',
    'power clean', 'power snatch', 'hang clean', 'hang snatch',
    'push press', 'push jerk', 'split jerk', 'squat clean',
    'squat snatch', 'sumo deadlift', 'romanian deadlift'
  ]
  if (exerciseNames.some(name => barbellExercises.some(bb => name.includes(bb)))) {
    equipment.push('barbell')
  }
  
  // Gymnastics detection
  const gymnasticsExercises = [
    'pull-up', 'pullup', 'pull up', 'muscle-up', 'muscleup', 'muscle up',
    'handstand', 'toes to bar', 't2b', 'toes-to-bar', 'ring', 'rope climb',
    'rope climb', 'rope-climb', 'bar muscle-up', 'ring muscle-up',
    'handstand push-up', 'hspu', 'handstand pushup', 'dip', 'l-sit'
  ]
  if (exerciseNames.some(name => gymnasticsExercises.some(g => name.includes(g)))) {
    equipment.push('gymnastics')
  }
  
  // Bodyweight only if no equipment detected
  if (equipment.length === 0) {
    equipment.push('bodyweight')
  }
  
  return equipment
}

/**
 * Check if workout has specific equipment type
 */
export function hasEquipment(exercises: any[], equipmentType: string): boolean {
  const equipment = detectEquipment(exercises)
  return equipment.includes(equipmentType)
}

