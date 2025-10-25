# BTN Remaining Fixes - What Still Needs Work
## Based on Original "Crap List"

**Updated:** 2025-10-24 after duration fixes deployed

---

## ✅ **FIXED (Deployed)**

1. ✅ **AMRAP time randomly differs from target** → Now uses actualDuration
2. ✅ **Passing wrong duration to generation** → Now passes actualDuration everywhere
3. ✅ **Reassigning time domain after generation** → Now keeps original domain
4. ✅ **Placeholder durations** → Now picks actual from range (5-10 = random 5,6,7,8,9,10)

---

## ❌ **STILL NEEDS FIXING**

### **CRAP #3: Arbitrary Round Estimation Formulas** 🔴

**Location:** Wherever rounds are estimated in AMRAP calculations

**Current Code:**
```typescript
let estimatedRounds: number;
if (actualDuration <= 5) {
  estimatedRounds = Math.max(Math.floor(actualDuration / 1.5), 2);
} else if (actualDuration <= 10) {
  estimatedRounds = Math.max(Math.floor(actualDuration / 1.8), 3);
} else if (actualDuration <= 15) {
  estimatedRounds = Math.max(Math.floor(actualDuration / 2.0), 4);
} else {
  estimatedRounds = Math.max(Math.floor(actualDuration / 2.2), 5);
}
```

**The Problem:**
- Magic numbers: 1.5, 1.8, 2.0, 2.2
- No justification for these divisors
- Why does round time increase with workout duration?
- Doesn't account for exercise difficulty

**Example:**
```
7 minutes ÷ 1.8 = 3.89 → 3 rounds
Expected round time: 2.33 minutes

Why 1.8? Why not 1.5 or 2.0? No one knows!
```

**Better Approach:**
```typescript
// Base round time on actual exercise rates
const avgRatePerExercise = exercises.reduce((sum, ex) => 
  sum + exerciseRates[ex.name], 0) / exercises.length;

const repsPerRound = totalTargetReps / estimatedRounds;
const timePerRound = repsPerRound / avgRatePerExercise;
const estimatedRounds = Math.ceil(actualDuration / timePerRound);
```

**Priority:** 🟡 Medium (works, but arbitrary)

---

### **CRAP #4: Duration Calculation for Rounds For Time** 🔴🔴🔴

**Location:** `calculateWorkoutDuration()` function

**Current Code:**
```typescript
const totalRepsPerRound = exercises.reduce((sum, ex) => sum + ex.reps, 0);
// = 26 + 20 + 26 = 72 reps per round

let limitingRate = Infinity;
exercises.forEach(exercise => {
  const rate = exerciseRates[exercise.name] || 10.0;
  if (rate < limitingRate) {
    limitingRate = rate;
  }
});
// limitingRate = 15 (slowest exercise)

const totalReps = totalRepsPerRound * rounds;
// = 72 * 4 = 288 total reps

return totalReps / limitingRate;
// = 288 / 15 = 19.2 minutes
```

**The Problem:**
- **ASSUMES ALL EXERCISES DONE AT LIMITING RATE**
- Completely wrong math!

**Example:**
```
Pull-ups: 26 reps @ 18 RPM = 1.44 minutes
Thrusters: 20 reps @ 15 RPM = 1.33 minutes
Rowing: 26 reps @ 18 RPM = 1.44 minutes

Real time per round: 4.21 minutes
Algorithm says: 72 / 15 = 4.8 minutes per round

Error: 14% overestimate
4 rounds: Should be 16.8 min, says 19.2 min
```

**The Fix:**
```typescript
function calculateWorkoutDuration(exercises, format, rounds) {
  let timePerRound = 0;
  
  exercises.forEach(exercise => {
    const rate = exerciseRates[exercise.name] || 10.0;
    timePerRound += (exercise.reps / rate);  // Sum individual times
  });
  
  if (format === 'Rounds For Time' && rounds) {
    return timePerRound * rounds;
  }
  
  return timePerRound;
}
```

**Priority:** 🔴🔴🔴 HIGH (Wrong math, inaccurate estimates)

---

### **CRAP #6: Rep Options Capped Too Low** 🔴

**Location:** Rep option arrays

**Current Code:**
```typescript
const pullupsRepOptions = [3, 5, 6, 9, 10, 12, 15, 18, 20, 24, 25, 30];
// Max = 30

const barbellRepOptions = [3, 5, 6, 10, 12, 15, 18, 20, 25, 30];
// Max = 30
```

**The Problem:**
- Caps at 30 reps for most exercises
- High-volume workouts get artificially limited

**Example:**
```
AMRAP 20 min, 3 rounds expected
Pull-ups: 18 * 20 * 0.65 / 3 = 78 reps per round
Nearest option: 30 (max in list!)
Lost: 48 reps (62% reduction!)
```

**Another Example:**
```
Calculated: 35 pull-ups
Capped to: 30 pull-ups
Lost: 5 reps (14% reduction)
```

**The Fix:**
```typescript
const pullupsRepOptions = [
  3, 5, 6, 9, 10, 12, 15, 18, 20, 24, 25, 30,
  35, 40, 45, 50, 60, 75, 100  // ← Add high-volume options
];

const barbellRepOptions = [
  3, 5, 6, 10, 12, 15, 18, 20, 25, 30,
  35, 40, 45, 50  // ← Add higher options (barbell is harder)
];
```

**Priority:** 🔴 HIGH (Artificially limits workout volume)

---

### **CRAP #7: Limited Snap Logic for Rounds For Time** 🔴

**Location:** `calculateRepsForTimeDomain()` - Rounds For Time branch

**Current Code:**
```typescript
} else if (format === 'Rounds For Time' && rounds) {
  const repsPerRound = Math.floor(totalTargetReps / rounds);
  
  if (isBarbellExerciseForReps) {
    return barbellRepOptions.reduce(...);  // ✅ Snaps
  } else if (isDoubleUnders) {
    return doubleUndersRepOptions.reduce(...);  // ✅ Snaps
  } else if (isWallBalls) {
    return wallBallsRepOptions.reduce(...);  // ✅ Snaps
  }
  
  return Math.max(repsPerRound, 1);  // ❌ Raw value for everything else!
}
```

**The Problem:**
- Only 3 exercise types get clean rep numbers
- Pull-ups, T2B, Box Jumps, etc. get raw values (26, 17, 23)
- Inconsistent formatting

**Example:**
```
Thrusters: 18.7 → 20 (clean) ✅
Pull-ups: 26.3 → 26 (raw, weird) ❌
Box Jumps: 17.2 → 17 (raw, weird) ❌
```

**The Fix:**
```typescript
} else if (format === 'Rounds For Time' && rounds) {
  const repsPerRound = Math.floor(totalTargetReps / rounds);
  
  // Use rep options for ALL exercises, not just 3 types
  const repOptions = getRepOptionsForExercise(exerciseName);
  return repOptions.reduce((prev, curr) => 
    Math.abs(curr - repsPerRound) < Math.abs(prev - repsPerRound) ? curr : prev
  );
}
```

**Priority:** 🔴 HIGH (Inconsistent UX, looks unprofessional)

---

### **CRAP #8: Picking Rounds Before Knowing Exercises** 🔴

**Location:** Round selection logic

**Current Code:**
```typescript
// Pick rounds FIRST
if (domain.range === '5:00 - 10:00') {
  rounds = Math.floor(Math.random() * 2) + 2;  // 2-3 rounds
}

// Then pick exercises LATER
const exercises = generateExercisesForTimeDomain(...);
```

**The Problem:**
- Picks rounds BEFORE selecting exercises
- Can't account for exercise complexity
- 3 rounds of Ring Muscle Ups ≠ 3 rounds of Box Jumps!

**Example:**
```
Randomly pick: 4 rounds
Then generate: Ring Muscle Ups + Rope Climbs (high skill)
Result: 4 rounds is way too many for this combo!
```

**The Fix:**
```typescript
// Pick exercises FIRST
const exercises = selectExercises(...);

// THEN calculate appropriate rounds based on difficulty
const avgDifficulty = getAverageDifficulty(exercises);
const baseRounds = actualDuration / avgDifficulty;
const rounds = roundToCleanNumber(baseRounds);
```

**Priority:** 🟡 Medium (works but not optimal)

---

## 🟡 **QUESTIONABLE (Could Improve)**

### **Q1: Always Using `Math.floor()` for Rounding**

**Current:**
```typescript
const totalTargetReps = Math.floor(baseRate * actualDuration * repFactor);
const repsPerRound = Math.floor(totalTargetReps / estimatedRounds);
```

**Problem:** Always rounds down, cumulative errors

**Example:**
```
Exercise 1: 35.8 → 35 (lost 0.8)
Exercise 2: 18.6 → 18 (lost 0.6)
Exercise 3: 27.9 → 27 (lost 0.9)
Total lost: 2.3 reps per round
Over 5 rounds: 11.5 reps lost!
```

**Better:**
```typescript
const totalTargetReps = Math.round(baseRate * actualDuration * repFactor);
const repsPerRound = Math.round(totalTargetReps / estimatedRounds);
```

**Priority:** 🟡 Low (minor impact)

---

### **Q2: Clustering Threshold = 2**

**Current:**
```typescript
const repDiff = Math.abs(exerciseReps[i].reps - exerciseReps[j].reps);
if (repDiff <= 2) {  // ← Why 2?
  cluster.push(exerciseReps[j]);
}
```

**Problem:** Arbitrary threshold

**Better:**
```typescript
// Cluster if within 10% of each other
const average = exerciseReps.reduce((sum, ex) => sum + ex.reps, 0) / exerciseReps.length;
const threshold = Math.floor(average * 0.1);
if (repDiff <= threshold) {
  cluster.push(...);
}
```

**Priority:** 🟡 Low (works fine)

---

## 📊 **Priority Summary**

| Issue | Priority | Impact | Lines to Change |
|-------|----------|--------|-----------------|
| **Duration calculation (limiting rate)** | 🔴🔴🔴 CRITICAL | 14% error | ~20 lines |
| **Rep options capped at 30** | 🔴 HIGH | 14-62% volume loss | ~10 lines (add values) |
| **Limited snap logic (Rounds)** | 🔴 HIGH | Inconsistent UX | ~30 lines |
| **Arbitrary round estimation** | 🟡 MEDIUM | Works but unjustified | ~30 lines |
| **Rounds before exercises** | 🟡 MEDIUM | Not optimal | ~50 lines (restructure) |
| **Floor rounding** | 🟡 LOW | Minor cumulative error | ~5 lines |
| **Clustering threshold** | 🟡 LOW | Works fine | ~10 lines |

---

## 🎯 **Recommended Fix Order**

### **Phase 1: Critical Math Fixes (Do First)**
1. ✅ Fix duration calculation (sum per-exercise times)
2. ✅ Expand rep option lists (add 35, 40, 45, 50+)
3. ✅ Apply snap logic to ALL exercises

**Impact:** Fixes wrong calculations, improves volume accuracy, consistent UX

---

### **Phase 2: Logic Improvements (Do Next)**
4. ✅ Better round estimation (use actual exercise rates)
5. ✅ Pick rounds after exercises (account for difficulty)

**Impact:** More optimal workouts, better rep schemes

---

### **Phase 3: Refinements (Optional)**
6. ✅ Use Math.round() instead of floor
7. ✅ Percentage-based clustering threshold

**Impact:** Minor improvements, polish

---

## 💡 **Quick Wins (Easiest to Fix)**

### **1. Expand Rep Options (5 minutes)**
Just add numbers to arrays:
```typescript
const pullupsRepOptions = [3, 5, 6, 9, 10, 12, 15, 18, 20, 24, 25, 30, 35, 40, 45, 50, 60, 75, 100];
```

### **2. Fix Duration Calculation (15 minutes)**
Replace limiting rate with sum:
```typescript
let timePerRound = 0;
exercises.forEach(ex => timePerRound += (ex.reps / exerciseRates[ex.name]));
return timePerRound * (rounds || 1);
```

### **3. Apply Snap to All Exercises (20 minutes)**
Extract rep options logic to function, call for all exercises.

---

## 🚫 **What NOT to Fix (Working Well)**

These are from the "Good Logic" list - don't touch:
- ✅ Domain-specific rep factors (0.55-1.0)
- ✅ Exercise rates database (18 RPM, etc.)
- ✅ Core formula: `baseRate * duration * repFactor`
- ✅ Equipment consistency filtering
- ✅ Forbidden pairs filtering
- ✅ Clustering similar reps (concept is good)

---

## ❓ **Want Me To Fix?**

I can tackle these in order:

**Option A: Fix all critical issues (1-3)**
- Duration calculation
- Expand rep options  
- Apply snap to all exercises
- ~30 minutes of work

**Option B: Just the quick wins**
- Expand rep options (5 min)
- Fix duration calc (15 min)
- ~20 minutes total

**Option C: All of Phase 1 + Phase 2**
- Everything except refinements
- ~2-3 hours of work
- Significantly improves generation quality

Which would you like me to tackle? 🚀
