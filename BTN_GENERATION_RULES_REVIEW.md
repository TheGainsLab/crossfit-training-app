# BTN Workout Generation Rules - Review & Cleanup

## 📊 Current Generation Logic Overview

**File:** `lib/btn/utils.ts` (~728 lines)

---

## 🎯 Core Generation Flow

### 1. **Main Generation Function** (Line 96)
```typescript
generateTestWorkouts()
```

**What it does:**
- Generates **10 workouts** (2 per time domain)
- **5 time domains:**
  - Sprint: 1-5 min (target: 3 min)
  - Short: 5-10 min (target: 7 min)  
  - Medium: 10-15 min (target: 12 min)
  - Long: 15-20 min (target: 17 min)
  - Extended: 20+ min (target: 25 min)

- **3 workout formats:** For Time, AMRAP, Rounds For Time
- Format chosen randomly for each workout

---

## 🏋️ Exercise Selection Rules

### **Exercise Difficulty Tiers** (Lines 5-10)

```
High Skill: Snatch, Ring Muscle Ups, HSPUs, Rope Climbs, Bar Muscle Ups
High Volume: Double Unders, Wall Balls  
Moderate: Deadlifts, Burpees, Pull-ups, C2B, T2B, OHS, Thrusters, Cleans
Low Skill: Box Jumps, DB Snatches, DB Thrusters, Calories, KB Swings
```

**Purpose:** Determines which rep patterns are allowed

---

### **Pattern Restrictions** (Lines 13-29)

**High Skill exercises only allow:**
- `21-15-9`, `15-12-9`, `12-9-6`

**High Volume exercises only allow:**
- Above + `10-8-6-4-2`, `15-12-9-6-3`

**Low Skill exercises allow:**
- All patterns including: `27-21-15-9`, `33-27-21-15-9`, `50-40-30-20-10`, `40-30-20-10`

**Special restrictions:**
- Rope Climbs: Only `10-8-6-4-2` pattern (capped at 5 rounds max)
- Legless Rope Climbs: NO patterns allowed
- Wall Balls/DUs: Allow high-volume patterns like 50-40-30-20-10
- Cardio (Row/Bike/Ski): Allow high-volume patterns

---

### **Equipment Consistency** (Lines 536-562)

**Rules:**
1. ✅ **Only 1 barbell exercise per workout** (same weight for all)
2. ❌ **No mixing barbell + dumbbell** (choose one)
3. ❌ **No mixing barbell + kettlebell** (choose one)
4. ❌ **No mixing dumbbell + kettlebell** (dumbbells win)

**Example:** If workout has Thrusters (barbell), it can't also have DB Snatches

---

### **Forbidden Exercise Pairs** (Lines 564-596)

**Can't combine:**
- Pull-ups + C2B (too similar)
- Pull-ups + T2B (both pulling movements)
- Pull-ups + Ring Muscle Ups (overlap)
- HSPUs + Push-ups (too similar)
- Burpee Box Jumps + Box Jumps (redundant)
- Rope Climbs + anything pulling-related
- GHD Sit-ups + T2B (both midline)
- Row + Bike, Row + Ski, Bike + Ski (only 1 cardio machine)

---

### **4-Exercise Workouts Must Include Cardio** (Lines 297-315)

If workout has 4 movements and NO cardio, it will:
1. Remove 1 exercise
2. Replace with Row/Bike/Ski (if compatible)

---

## 📏 Rep Calculation Rules

### **Exercise Rates** (Lines 32-68) - Reps Per Minute

```
Fast (60 RPM): Double Unders
Standard (15-20 RPM): Most gymnastics, box work
Moderate (12-15 RPM): Most barbell, burpees
Slow (5-7 RPM): Rope climbs, muscle-ups
```

### **AMRAP Rep Calculation** (Lines 396-502)

**Formula:**
```
Total Target Reps = Exercise Rate × AMRAP Time × 0.3
Estimated Rounds = Time / Factor (varies by duration)
Reps Per Round = Total Target Reps / Estimated Rounds
```

**Then rounds to nearest "clean" number:**
- Barbell: 3, 5, 6, 10, 12, 15, 18, 20, 25, 30
- Double Unders: 15, 20, 25, 30, 35, 40, 50, 60, 75, 100
- Wall Balls: 10, 12, 15, 18, 20, 24, 25, 30, 35, 40, 50, 60, 75
- Calories: 10, 12, 15, 18, 21, 24, 25, 30, 35, 40, 50, 60, 75, 100
- Rope Climbs: 2, 3, 5
- Legless Rope Climbs: 1, 2, 3

### **Rep Clustering** (Lines 598-633)

**For AMRAP/Rounds For Time:**
If 2+ exercises have reps within 2 of each other → make them the same

**Example:**
- Pull-ups: 12
- Thrusters: 13
- Wall Balls: 25

**After clustering:**
- Pull-ups: 12
- Thrusters: 12 (clustered with pull-ups)
- Wall Balls: 25 (too far apart, stays same)

---

## ⚖️ Weight Assignment (Lines 701-727)

### **Dumbbells:**
- Fixed: `50/35` (male/female)

### **Barbell by Exercise Type:**

**Heavy (Deadlifts, Back Squat, Front Squat):**
- Options: 135/95, 185/135, 225/155, 275/185, 315/205
- Chosen randomly

**Cleans & Jerks:**
- Options: 75/55, 95/65, 115/75, 135/95, 165/115, 185/135, 225/155, 275/185, 315/205
- Chosen randomly

**Snatches:**
- Options: 75/55, 95/65, 115/75, 135/95, 165/115, 185/135, 225/155
- Lighter than cleans (as expected)

**Thrusters & OHS:**
- Options: 75/55, 95/65, 115/75, 135/95, 165/115, 185/135, 225/155
- Same as snatches

**Same weight used for all barbell movements in a workout**

---

## 🎲 Randomness & Variety

### **Random Elements:**
1. ✅ Workout format (For Time vs AMRAP vs Rounds For Time)
2. ✅ Exercise selection (shuffled from filtered database)
3. ✅ Rep pattern (For Time workouts)
4. ✅ Round count (2-8 rounds for Rounds For Time)
5. ✅ AMRAP duration (varies by time domain)
6. ✅ Barbell weights (random from appropriate range)

### **Deterministic Elements:**
1. 🔒 Always 10 workouts
2. 🔒 Always 2 per time domain
3. 🔒 Rep schemes follow strict rules
4. 🔒 Equipment consistency enforced
5. 🔒 Forbidden pairs blocked

---

## 🐛 Potential Issues & Cleanup Opportunities

### **1. Code Duplication**
**Problem:** Rep calculation logic repeated 3 times (lines 396-526)
- Once for AMRAP
- Once for Rounds For Time  
- Once for For Time

**Fix:** Extract to reusable functions by format

---

### **2. Hard-Coded Rep Options**
**Problem:** Every exercise has its own hard-coded array (lines 354-371)

```typescript
const barbellRepOptions = [3, 5, 6, 10, 12, 15, 18, 20, 25, 30];
const doubleUndersRepOptions = [15, 20, 25, 30, 35, 40, 50, 60, 75, 100];
const wallBallsRepOptions = [10, 12, 15, 18, 20, 24, 25, 30, 35, 36, 40, 50, 60, 75];
// ... 12 more of these
```

**Fix:** Create data structure mapping exercise types to rep options

---

### **3. Exercise Classification Scattered**
**Problem:** Exercise checks done with long if/else chains (lines 373-394)

```typescript
const isBarbellExerciseForReps = ['Snatch', 'Deadlifts', ...].includes(exerciseName);
const isDoubleUnders = exerciseName === 'Double Unders';
const isWallBalls = exerciseName === 'Wall Balls';
// ... 18 more boolean checks
```

**Fix:** Create exercise metadata map with properties

---

### **4. Magic Numbers**
**Problem:** Hard-coded values without explanation
- `0.3` factor in rep calculation (line 397)
- Division factors: `1.5`, `1.8`, `2.0`, `2.2` (lines 400-407)
- Rep difference threshold: `2` for clustering (line 614)

**Fix:** Extract to named constants with comments

---

### **5. Pattern Logic Complexity**
**Problem:** Pattern selection and validation spread across multiple functions

**Fix:** Centralize pattern logic into single module

---

### **6. No Exercise Tags/Categories**
**Problem:** Can't easily filter by:
- Pulling vs pushing
- Upper body vs lower body
- Gymnastics vs weightlifting vs monostructural

**Fix:** Add exercise taxonomy/tags

---

### **7. Weight Generation Too Random**
**Problem:** 
- No consideration of other exercises in workout
- Could get 315# deadlifts + 225# thrusters (impossible)
- No scaling based on time domain

**Fix:** Weight should consider:
- Time domain (longer = lighter)
- Other exercises in workout
- Rep counts

---

## 💡 Proposed Cleanup Priorities

### **Priority 1: Data Structure Refactor** (High Impact, Low Risk)
Create exercise metadata map:
```typescript
interface ExerciseMetadata {
  name: string;
  category: 'barbell' | 'dumbbell' | 'bodyweight' | 'gymnastics' | 'cardio';
  difficulty: 'highSkill' | 'highVolume' | 'moderate' | 'lowSkill';
  repsPerMinute: number;
  repOptions: number[];
  equipment: string[];
  muscleGroups: ('push' | 'pull' | 'legs' | 'core')[];
  forbiddenPairs: string[];
  allowedPatterns?: string[];
}
```

**Benefits:**
- Single source of truth
- Easy to add new exercises
- Clear exercise properties
- Enables advanced filtering

---

### **Priority 2: Extract Constants** (Low Effort, High Clarity)
```typescript
// Workout generation constants
const WORKOUTS_PER_TIME_DOMAIN = 2;
const TOTAL_WORKOUTS = 10;
const MAX_WORKOUT_DURATION = 25; // minutes

// Rep calculation constants
const AMRAP_REP_FACTOR = 0.3; // Percentage of max reps achievable
const CLUSTERING_THRESHOLD = 2; // Reps difference to cluster

// Time estimation factors by duration
const ESTIMATED_ROUND_FACTORS = {
  sprint: 1.5,   // < 5 min
  short: 1.8,    // 5-10 min
  medium: 2.0,   // 10-15 min
  long: 2.2      // 15-20 min
};
```

---

### **Priority 3: Modularize Functions** (Medium Effort, High Maintainability)

**Current:** One 728-line file  
**Proposed:**

```
lib/btn/
  ├── types.ts (already exists)
  ├── data.ts (already exists - exercise database)
  ├── constants.ts (NEW - all magic numbers)
  ├── exerciseMetadata.ts (NEW - structured exercise data)
  ├── repCalculation.ts (NEW - all rep logic)
  ├── exerciseSelection.ts (NEW - filtering & pairing)
  ├── weightGeneration.ts (NEW - weight assignment)
  ├── workoutFormatting.ts (NEW - format-specific logic)
  └── generator.ts (RENAME from utils.ts - main orchestrator)
```

**Benefits:**
- Easier to test individual pieces
- Clearer responsibilities
- Easier to add features
- Better for personalization later

---

### **Priority 4: Add Validation** (Low Effort, Prevents Bugs)

```typescript
function validateWorkout(workout: GeneratedWorkout): boolean {
  // Check no forbidden pairs
  // Check equipment consistency
  // Check rep counts are reasonable
  // Check patterns match exercise difficulty
  // Check duration makes sense
  return true;
}
```

---

## 🎯 Quick Wins (Can Do Now)

### **1. Extract Constants** (30 minutes)
Move all magic numbers to top of file with clear names

### **2. Add Comments** (30 minutes)
Document WHY rules exist (not just what they do)

### **3. Fix Inconsistencies** (15 minutes)
- `Clean and Jerks` vs `Clean & Jerks` (used inconsistently)
- Some exercises in database but not in metadata
- Some special cases not documented

### **4. Remove Dead Code** (15 minutes)
- `PerformancePrediction` interface defined but never used
- Some helper functions might be unused

---

## ❓ Questions for You

Before I start refactoring, what's your preference?

1. **What's your main pain point with current generation?**
   - Too random/unpredictable?
   - Hard to modify rules?
   - Can't easily add new exercises?
   - Something else?

2. **What do you want to change/add?**
   - Better weight scaling?
   - More workout variety?
   - Better exercise combinations?
   - Specific patterns you don't like?

3. **Refactoring scope - choose one:**
   - **Option A:** Quick cleanup (constants + comments) - 1-2 hours
   - **Option B:** Moderate refactor (data structures) - 4-6 hours  
   - **Option C:** Full modularization (separate files) - 1-2 days

4. **Specific rules to review:**
   - Any exercise pairings that don't make sense?
   - Rep schemes feel off?
   - Weights too random?
   - Patterns too restrictive/permissive?

---

**Let me know what you'd like to focus on and I can start the cleanup!** 🚀
