export interface FoodSource {
  display: string
  fatsecret: string
  emoji: string
  aliases?: string[] // Common typos/variations
}

export const POPULAR_RESTAURANTS: FoodSource[] = [
  { display: 'Chipotle', fatsecret: 'Chipotle Mexican Grill', emoji: '🌯', aliases: ['chipotle mexican grill'] },
  { display: 'Panera Bread', fatsecret: 'Panera Bread', emoji: '🥖', aliases: ['panera'] },
  { display: 'Starbucks', fatsecret: 'Starbucks', emoji: '☕' },
  { display: 'McDonald\'s', fatsecret: 'McDonald\'s', emoji: '🍔', aliases: ['mcdonalds', 'mcdonald', 'mcds'] },
  { display: 'Subway', fatsecret: 'Subway', emoji: '🥪' },
  { display: 'Chick-fil-A', fatsecret: 'Chick-fil-A', emoji: '🐔', aliases: ['chickfila', 'chick fil a'] },
  { display: 'Taco Bell', fatsecret: 'Taco Bell', emoji: '🌮', aliases: ['tacobell'] },
  { display: 'Wendy\'s', fatsecret: 'Wendy\'s', emoji: '🍟', aliases: ['wendys', 'wendy'] },
  { display: 'Burger King', fatsecret: 'Burger King', emoji: '👑', aliases: ['burgerking', 'bk'] },
  { display: 'Five Guys', fatsecret: 'Five Guys', emoji: '🍔', aliases: ['5 guys', 'fiveguys'] },
  { display: 'In-N-Out Burger', fatsecret: 'In-N-Out Burger', emoji: '🍔', aliases: ['in n out', 'innout'] },
  { display: 'Shake Shack', fatsecret: 'Shake Shack', emoji: '🍔', aliases: ['shakeshack'] },
  { display: 'Chili\'s', fatsecret: 'Chili\'s', emoji: '🌶️', aliases: ['chilis', 'chili'] },
  { display: 'Applebee\'s', fatsecret: 'Applebee\'s', emoji: '🍎', aliases: ['applebees', 'applebee'] },
  { display: 'Olive Garden', fatsecret: 'Olive Garden', emoji: '🍝', aliases: ['olivegarden'] },
  { display: 'Red Lobster', fatsecret: 'Red Lobster', emoji: '🦞', aliases: ['redlobster'] },
  { display: 'Buffalo Wild Wings', fatsecret: 'Buffalo Wild Wings', emoji: '🍗', aliases: ['bww', 'bdubs', 'buffalo wild'] },
  { display: 'Panda Express', fatsecret: 'Panda Express', emoji: '🐼', aliases: ['pandaexpress', 'panda'] },
  { display: 'KFC', fatsecret: 'KFC', emoji: '🍗', aliases: ['kentucky fried chicken'] },
  { display: 'Popeyes', fatsecret: 'Popeyes', emoji: '🍗', aliases: ['popeye'] },
  { display: 'Domino\'s Pizza', fatsecret: 'Domino\'s Pizza', emoji: '🍕', aliases: ['dominos', 'domino'] },
  { display: 'Pizza Hut', fatsecret: 'Pizza Hut', emoji: '🍕', aliases: ['pizzahut'] },
  { display: 'Papa John\'s', fatsecret: 'Papa John\'s', emoji: '🍕', aliases: ['papa johns', 'papajohns'] },
  { display: 'Arby\'s', fatsecret: 'Arby\'s', emoji: '🥪', aliases: ['arbys', 'arby'] },
  { display: 'Jimmy John\'s', fatsecret: 'Jimmy John\'s', emoji: '🥪', aliases: ['jimmy johns', 'jimmyjohns'] },
  { display: 'Sonic Drive-In', fatsecret: 'Sonic Drive-In', emoji: '🍔', aliases: ['sonic'] },
  { display: 'Dairy Queen', fatsecret: 'Dairy Queen', emoji: '🍦', aliases: ['dq', 'dairyqueen'] },
  { display: 'Dunkin\'', fatsecret: 'Dunkin\' Donuts', emoji: '🍩', aliases: ['dunkin donuts', 'dunkin', 'dd'] },
  { display: 'Krispy Kreme', fatsecret: 'Krispy Kreme', emoji: '🍩', aliases: ['krispykreme'] },
  { display: 'Qdoba', fatsecret: 'Qdoba Mexican Grill', emoji: '🌯', aliases: ['qdoba mexican'] },
]

export const POPULAR_BRANDS: FoodSource[] = [
  { display: 'Kirkland Signature', fatsecret: 'Kirkland Signature', emoji: '🏪', aliases: ['kirkland', 'costco'] },
  { display: 'Great Value', fatsecret: 'Great Value', emoji: '🏪', aliases: ['walmart'] },
  { display: 'Trader Joe\'s', fatsecret: 'Trader Joe\'s', emoji: '🛒', aliases: ['trader joes', 'traderjoes', 'tj'] },
  { display: '365 Everyday Value', fatsecret: '365 Everyday Value', emoji: '🥬', aliases: ['365', 'whole foods'] },
  { display: 'Tyson', fatsecret: 'Tyson', emoji: '🍗' },
  { display: 'Perdue', fatsecret: 'Perdue', emoji: '🐔' },
  { display: 'Foster Farms', fatsecret: 'Foster Farms', emoji: '🐔', aliases: ['fosterfarms'] },
  { display: 'Oscar Mayer', fatsecret: 'Oscar Mayer', emoji: '🌭', aliases: ['oscarmayer'] },
  { display: 'Kraft', fatsecret: 'Kraft', emoji: '🧀' },
  { display: 'Kellogg\'s', fatsecret: 'Kellogg\'s', emoji: '🥣', aliases: ['kelloggs', 'kellogg'] },
  { display: 'General Mills', fatsecret: 'General Mills', emoji: '🥣', aliases: ['generalmills'] },
  { display: 'Post', fatsecret: 'Post', emoji: '🥣' },
  { display: 'Quaker', fatsecret: 'Quaker', emoji: '🌾' },
  { display: 'Nature Valley', fatsecret: 'Nature Valley', emoji: '🌿', aliases: ['naturevalley'] },
  { display: 'KIND', fatsecret: 'KIND', emoji: '🥜', aliases: ['kind bars'] },
  { display: 'Clif Bar', fatsecret: 'Clif Bar', emoji: '🏔️', aliases: ['clifbar', 'clif'] },
  { display: 'Quest Nutrition', fatsecret: 'Quest Nutrition', emoji: '💪', aliases: ['quest'] },
  { display: 'Premier Protein', fatsecret: 'Premier Protein', emoji: '💪', aliases: ['premierprotein'] },
  { display: 'Muscle Milk', fatsecret: 'Muscle Milk', emoji: '💪', aliases: ['musclemilk'] },
  { display: 'Chobani', fatsecret: 'Chobani', emoji: '🥛' },
  { display: 'Fage', fatsecret: 'Fage', emoji: '🥛' },
  { display: 'Dannon', fatsecret: 'Dannon', emoji: '🥛' },
  { display: 'Yoplait', fatsecret: 'Yoplait', emoji: '🥛' },
  { display: 'Ben & Jerry\'s', fatsecret: 'Ben & Jerry\'s', emoji: '🍦', aliases: ['ben and jerrys', 'ben jerrys'] },
  { display: 'Häagen-Dazs', fatsecret: 'Häagen-Dazs', emoji: '🍦', aliases: ['haagen dazs', 'haagen-dazs'] },
  { display: 'Breyers', fatsecret: 'Breyers', emoji: '🍦' },
  { display: 'Blue Bell', fatsecret: 'Blue Bell', emoji: '🍦', aliases: ['bluebell'] },
  { display: 'Annie\'s', fatsecret: 'Annie\'s', emoji: '🥘', aliases: ['annies'] },
  { display: 'Amy\'s', fatsecret: 'Amy\'s Kitchen', emoji: '🥘', aliases: ['amys', 'amys kitchen'] },
  { display: 'Stouffer\'s', fatsecret: 'Stouffer\'s', emoji: '🥘', aliases: ['stouffers'] },
]

// Normalize user input to correct FatSecret brand name
export function normalizeRestaurantName(input: string): string | null {
  const normalized = input.toLowerCase().trim()
  
  // Check exact matches first
  for (const restaurant of POPULAR_RESTAURANTS) {
    if (restaurant.display.toLowerCase() === normalized) {
      return restaurant.fatsecret
    }
    if (restaurant.fatsecret.toLowerCase() === normalized) {
      return restaurant.fatsecret
    }
    // Check aliases
    if (restaurant.aliases?.some(alias => alias === normalized)) {
      return restaurant.fatsecret
    }
  }
  
  return null // No match found
}

export function normalizeBrandName(input: string): string | null {
  const normalized = input.toLowerCase().trim()
  
  // Check exact matches first
  for (const brand of POPULAR_BRANDS) {
    if (brand.display.toLowerCase() === normalized) {
      return brand.fatsecret
    }
    if (brand.fatsecret.toLowerCase() === normalized) {
      return brand.fatsecret
    }
    // Check aliases
    if (brand.aliases?.some(alias => alias === normalized)) {
      return brand.fatsecret
    }
  }
  
  return null // No match found
}

// Search/filter function
export function searchFoodSources(query: string, sources: FoodSource[]): FoodSource[] {
  const normalized = query.toLowerCase().trim()
  
  if (!normalized) return sources
  
  return sources.filter(source => {
    // Match display name
    if (source.display.toLowerCase().includes(normalized)) return true
    // Match FatSecret name
    if (source.fatsecret.toLowerCase().includes(normalized)) return true
    // Match aliases
    if (source.aliases?.some(alias => alias.includes(normalized))) return true
    return false
  })
}






