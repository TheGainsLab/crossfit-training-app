import { Workout } from './types';

export const exerciseDatabase = [
  'Double Unders', 'Wall Balls', 'Snatch', 'Rowing Calories', 'Chest to Bar Pull-ups',
  'Pull-ups', 'Alternating Dumbbell Snatches', 'Handstand Push-ups', 'Deadlifts',
  'Overhead Squats', 'Thrusters', 'Dumbbell Thrusters', 'Burpees', 'Toes to Bar',
  'Power Cleans', 'Burpee Box Jump Overs', 'Box Jumps', 'Box Jump Overs',
  'Clean and Jerks', 'Dumbbell Clean and Jerk', 'Ring Muscle Ups',
  'Rope Climbs', 'Legless Rope Climbs', 'GHD Sit-ups', 'Kettlebell Swings', 'Kettlebell Snatches',
  'Bike Calories', 'Ski Calories', 'Squat Cleans', 'Squat Snatch', 'Power Snatch', 'Bar Muscle Ups', 'Dumbbell Box Step-Ups', 'Push-ups', 'Strict Pull-ups'
];

export const exerciseEquipment: { [key: string]: string[] } = {
  'Double Unders': ['Jump Rope'],
  'Wall Balls': ['Wall Ball', 'Wall Space'],
  'Snatch': ['Barbell'],
  'Rowing Calories': ['Rowing Machine'],
  'Chest to Bar Pull-ups': ['Pullup Bar or Rig'],
  'Pull-ups': ['Pullup Bar or Rig'],
  'Alternating Dumbbell Snatches': ['Dumbbells'],
  'Handstand Push-ups': ['Wall Space'],
  'Deadlifts': ['Barbell', 'Squat Rack'],
  'Overhead Squats': ['Barbell', 'Squat Rack'],
  'Thrusters': ['Barbell'],
  'Dumbbell Thrusters': ['Dumbbells'],
  'Burpees': [],
  'Toes to Bar': ['Pullup Bar or Rig'],
  'Power Cleans': ['Barbell'],
  'Burpee Box Jump Overs': ['Plyo Box'],
  'Box Jumps': ['Plyo Box'],
  'Box Jump Overs': ['Plyo Box'],
  'Clean and Jerks': ['Barbell'],
  'Dumbbell Clean and Jerk': ['Dumbbells'],
  'Ring Muscle Ups': ['High Rings'],
  'Rope Climbs': ['Climbing Rope'],
  'Legless Rope Climbs': ['Climbing Rope'],
  'GHD Sit-ups': ['GHD'],
  'Kettlebell Swings': ['Kettlebells'],
  'Kettlebell Snatches': ['Kettlebells'],
  'Bike Calories': ['Bike Erg'],
  'Ski Calories': ['Ski Erg'],
  'Squat Cleans': ['Barbell'],
  'Squat Snatch': ['Barbell'],
  'Power Snatch': ['Barbell'],
  'Bar Muscle Ups': ['Pullup Bar or Rig'],
  'Dumbbell Box Step-Ups': ['Dumbbells', 'Plyo Box'],
  'Push-ups': [],
  'Strict Pull-ups': ['Pullup Bar or Rig', 'Low or Adjustable Rings']
};
