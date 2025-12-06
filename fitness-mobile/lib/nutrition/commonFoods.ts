// Common foods for meal template setup
// These are displayed as quick-pick options during intake

export interface CommonFood {
  label: string
  emoji: string
  searchTerm: string // What to search for in FatSecret API
}

// BREAKFAST FOODS
export const BREAKFAST_PROTEINS: CommonFood[] = [
  { label: 'Eggs', emoji: '🥚', searchTerm: 'eggs scrambled' },
  { label: 'Bacon', emoji: '🥓', searchTerm: 'bacon' },
  { label: 'Sausage', emoji: '🌭', searchTerm: 'breakfast sausage' },
  { label: 'Greek Yogurt', emoji: '🥛', searchTerm: 'greek yogurt plain' },
  { label: 'Cottage Cheese', emoji: '🧀', searchTerm: 'cottage cheese' },
  { label: 'Protein Shake', emoji: '🥤', searchTerm: 'protein shake whey' },
]

export const BREAKFAST_CARBS: CommonFood[] = [
  { label: 'Oatmeal', emoji: '🥣', searchTerm: 'oatmeal' },
  { label: 'Toast', emoji: '🍞', searchTerm: 'bread toast' },
  { label: 'English Muffin', emoji: '🧇', searchTerm: 'english muffin' },
  { label: 'Bagel', emoji: '🥯', searchTerm: 'bagel' },
  { label: 'Pancakes', emoji: '🥞', searchTerm: 'pancakes' },
  { label: 'Cereal', emoji: '🥣', searchTerm: 'cereal' },
]

export const BREAKFAST_FRUITS: CommonFood[] = [
  { label: 'Banana', emoji: '🍌', searchTerm: 'banana' },
  { label: 'Berries', emoji: '🫐', searchTerm: 'blueberries' },
  { label: 'Apple', emoji: '🍎', searchTerm: 'apple' },
]

export const BREAKFAST_FATS: CommonFood[] = [
  { label: 'Avocado', emoji: '🥑', searchTerm: 'avocado' },
  { label: 'Peanut Butter', emoji: '🥜', searchTerm: 'peanut butter' },
  { label: 'Butter', emoji: '🧈', searchTerm: 'butter' },
]

export const BREAKFAST_BEVERAGES: CommonFood[] = [
  { label: 'Coffee', emoji: '☕', searchTerm: 'coffee black' },
  { label: 'Milk', emoji: '🥛', searchTerm: 'milk whole' },
]

// LUNCH FOODS
export const LUNCH_PROTEINS: CommonFood[] = [
  { label: 'Chicken Breast', emoji: '🍗', searchTerm: 'chicken breast grilled' },
  { label: 'Turkey', emoji: '🦃', searchTerm: 'turkey breast' },
  { label: 'Tuna', emoji: '🐟', searchTerm: 'tuna canned' },
  { label: 'Ground Beef', emoji: '🥩', searchTerm: 'ground beef' },
  { label: 'Salmon', emoji: '🐟', searchTerm: 'salmon' },
  { label: 'Deli Meat', emoji: '🥩', searchTerm: 'deli turkey' },
]

export const LUNCH_CARBS: CommonFood[] = [
  { label: 'Rice', emoji: '🍚', searchTerm: 'rice white cooked' },
  { label: 'Pasta', emoji: '🍝', searchTerm: 'pasta' },
  { label: 'Bread/Sandwich', emoji: '🥪', searchTerm: 'bread' },
  { label: 'Quinoa', emoji: '🌾', searchTerm: 'quinoa' },
  { label: 'Potato', emoji: '🥔', searchTerm: 'potato baked' },
  { label: 'Tortilla', emoji: '🌮', searchTerm: 'tortilla flour' },
]

export const LUNCH_VEGETABLES: CommonFood[] = [
  { label: 'Mixed Salad', emoji: '🥗', searchTerm: 'mixed greens salad' },
  { label: 'Broccoli', emoji: '🥦', searchTerm: 'broccoli' },
  { label: 'Spinach', emoji: '🥬', searchTerm: 'spinach' },
  { label: 'Carrots', emoji: '🥕', searchTerm: 'carrots' },
]

export const LUNCH_RESTAURANT: CommonFood[] = [
  { label: 'Chipotle Bowl', emoji: '🌯', searchTerm: 'chipotle burrito bowl' },
  { label: 'Subway Sandwich', emoji: '🥪', searchTerm: 'subway sandwich' },
]

// DINNER FOODS
export const DINNER_PROTEINS: CommonFood[] = [
  { label: 'Chicken Breast', emoji: '🍗', searchTerm: 'chicken breast grilled' },
  { label: 'Steak', emoji: '🥩', searchTerm: 'steak sirloin' },
  { label: 'Salmon', emoji: '🐟', searchTerm: 'salmon' },
  { label: 'Ground Beef', emoji: '🍔', searchTerm: 'ground beef' },
  { label: 'Pork Chops', emoji: '🥩', searchTerm: 'pork chops' },
  { label: 'Shrimp', emoji: '🦐', searchTerm: 'shrimp' },
]

export const DINNER_CARBS: CommonFood[] = [
  { label: 'Rice', emoji: '🍚', searchTerm: 'rice white cooked' },
  { label: 'Sweet Potato', emoji: '🍠', searchTerm: 'sweet potato baked' },
  { label: 'Pasta', emoji: '🍝', searchTerm: 'pasta' },
  { label: 'Potato', emoji: '🥔', searchTerm: 'potato baked' },
]

export const DINNER_VEGETABLES: CommonFood[] = [
  { label: 'Broccoli', emoji: '🥦', searchTerm: 'broccoli' },
  { label: 'Green Beans', emoji: '🫘', searchTerm: 'green beans' },
  { label: 'Asparagus', emoji: '🌿', searchTerm: 'asparagus' },
  { label: 'Brussels Sprouts', emoji: '🥬', searchTerm: 'brussels sprouts' },
  { label: 'Mixed Vegetables', emoji: '🥗', searchTerm: 'mixed vegetables' },
  { label: 'Salad', emoji: '🥗', searchTerm: 'salad' },
]

// SNACKS & OTHER
export const SNACKS_PROTEIN: CommonFood[] = [
  { label: 'Protein Shake', emoji: '🥤', searchTerm: 'protein shake whey' },
  { label: 'Greek Yogurt', emoji: '🥛', searchTerm: 'greek yogurt' },
  { label: 'Cottage Cheese', emoji: '🧀', searchTerm: 'cottage cheese' },
  { label: 'Protein Bar', emoji: '🍫', searchTerm: 'protein bar' },
  { label: 'Beef Jerky', emoji: '🥩', searchTerm: 'beef jerky' },
  { label: 'Hard Boiled Eggs', emoji: '🥚', searchTerm: 'hard boiled egg' },
]

export const SNACKS_FRUITS: CommonFood[] = [
  { label: 'Banana', emoji: '🍌', searchTerm: 'banana' },
  { label: 'Apple', emoji: '🍎', searchTerm: 'apple' },
  { label: 'Orange', emoji: '🍊', searchTerm: 'orange' },
  { label: 'Berries', emoji: '🫐', searchTerm: 'blueberries' },
]

export const SNACKS_NUTS: CommonFood[] = [
  { label: 'Almonds', emoji: '🌰', searchTerm: 'almonds' },
  { label: 'Peanuts', emoji: '🥜', searchTerm: 'peanuts' },
  { label: 'Peanut Butter', emoji: '🥜', searchTerm: 'peanut butter' },
  { label: 'Almond Butter', emoji: '🌰', searchTerm: 'almond butter' },
]

export const SNACKS_OTHER: CommonFood[] = [
  { label: 'Granola Bar', emoji: '🍫', searchTerm: 'granola bar' },
  { label: 'Rice Cakes', emoji: '🍘', searchTerm: 'rice cakes' },
  { label: 'Crackers', emoji: '🍘', searchTerm: 'crackers' },
]

// PRE-WORKOUT FOODS
export const PRE_WORKOUT: CommonFood[] = [
  { label: 'Banana', emoji: '🍌', searchTerm: 'banana' },
  { label: 'Oatmeal', emoji: '🥣', searchTerm: 'oatmeal' },
  { label: 'Toast with PB', emoji: '🍞', searchTerm: 'bread toast' },
  { label: 'Energy Bar', emoji: '🍫', searchTerm: 'energy bar' },
  { label: 'Rice Cakes', emoji: '🍘', searchTerm: 'rice cakes' },
  { label: 'Coffee', emoji: '☕', searchTerm: 'coffee' },
]

// POST-WORKOUT FOODS
export const POST_WORKOUT: CommonFood[] = [
  { label: 'Protein Shake', emoji: '🥤', searchTerm: 'protein shake whey' },
  { label: 'Chocolate Milk', emoji: '🥛', searchTerm: 'chocolate milk' },
  { label: 'Greek Yogurt', emoji: '🥛', searchTerm: 'greek yogurt' },
  { label: 'Protein Bar', emoji: '🍫', searchTerm: 'protein bar' },
  { label: 'Banana', emoji: '🍌', searchTerm: 'banana' },
]

// Helper function to get all foods for a meal type
export function getCommonFoodsByMealType(mealType: string): CommonFood[][] {
  switch (mealType.toLowerCase()) {
    case 'breakfast':
      return [
        BREAKFAST_PROTEINS,
        BREAKFAST_CARBS,
        BREAKFAST_FRUITS,
        BREAKFAST_FATS,
        BREAKFAST_BEVERAGES,
      ]
    case 'lunch':
      return [
        LUNCH_PROTEINS,
        LUNCH_CARBS,
        LUNCH_VEGETABLES,
        LUNCH_RESTAURANT,
      ]
    case 'dinner':
      return [
        DINNER_PROTEINS,
        DINNER_CARBS,
        DINNER_VEGETABLES,
      ]
    case 'snack':
    case 'other':
      return [
        SNACKS_PROTEIN,
        SNACKS_FRUITS,
        SNACKS_NUTS,
        SNACKS_OTHER,
      ]
    case 'pre_workout':
      return [PRE_WORKOUT]
    case 'post_workout':
      return [POST_WORKOUT]
    default:
      return []
  }
}

// Helper function to get category names
export function getCategoryNames(mealType: string): string[] {
  switch (mealType.toLowerCase()) {
    case 'breakfast':
      return ['Proteins', 'Carbs', 'Fruits', 'Fats', 'Beverages']
    case 'lunch':
      return ['Proteins', 'Carbs', 'Vegetables', 'Restaurant']
    case 'dinner':
      return ['Proteins', 'Carbs', 'Vegetables']
    case 'snack':
    case 'other':
      return ['Protein', 'Fruits', 'Nuts & Nut Butters', 'Other']
    case 'pre_workout':
      return ['Pre-Workout']
    case 'post_workout':
      return ['Post-Workout']
    default:
      return []
  }
}

