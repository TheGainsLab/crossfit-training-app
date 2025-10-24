# BTN Rep Factor Fix - Summary

## 🐛 Problem Identified

**Issue:** Workouts were generating unrealistically low rep counts, especially for sprint domain (1-5 min).

**Root Cause:** Double application of pacing/fatigue reduction:
1. Exercise rates (e.g., 60 DUs/min) were ALREADY realistic sustainable rates from actual workout data
2. Code was THEN applying a 0.3 (30%) reduction factor again
3. Result: 60 × 0.3 = 18 DUs/min effective rate (way too low!)

**Example Before Fix:**
```
4 Rounds For Time (Sprint domain, ~3 min target)
3 Toes to Bar + 15 Double Unders
Total: 12 T2B + 60 DUs (way too light for a sprint!)
```

---

## ✅ Solution Implemented

### **Fix 1: Domain-Specific Rep Factors**

Changed from:
```typescript
const totalTargetReps = Math.floor(baseRate * targetDuration * 0.3);
```

To:
```typescript
let repFactor;
if (targetDuration <= 5) {
  repFactor = 1.0;   // Sprint: Full sustainable rate (all-out effort)
} else if (targetDuration <= 10) {
  repFactor = 0.85;  // Short: 85% (some pacing needed)
} else if (targetDuration <= 15) {
  repFactor = 0.75;  // Medium: 75% (steady pace)
} else if (targetDuration <= 20) {
  repFactor = 0.65;  // Long: 65% (conservative pacing)
} else {
  repFactor = 0.55;  // Extended: 55% (grind pace)
}
const totalTargetReps = Math.floor(baseRate * targetDuration * repFactor);
```

**Rationale:**
- Sprint workouts (1-5 min) = all-out effort, use full sustainable rate
- Longer workouts require more pacing/conservation
- Rates are already realistic, so we only need minor adjustments for longer durations

---

### **Fix 2: Domain-Specific Round Counts**

Changed from:
```typescript
rounds = Math.floor(Math.random() * 7) + 2;  // 2-8 rounds for all domains
```

To:
```typescript
if (domain.range === '1:00 - 5:00') {
  rounds = Math.floor(Math.random() * 3) + 1;  // 1-3 rounds
} else if (domain.range === '5:00 - 10:00') {
  rounds = Math.floor(Math.random() * 3) + 3;  // 3-5 rounds
} else if (domain.range === '10:00 - 15:00') {
  rounds = Math.floor(Math.random() * 3) + 5;  // 5-7 rounds
} else if (domain.range === '15:00 - 20:00') {
  rounds = Math.floor(Math.random() * 4) + 6;  // 6-9 rounds
} else {
  rounds = Math.floor(Math.random() * 5) + 8;  // 8-12 rounds
}
```

**Rationale:**
- Sprint workouts should be 1-3 rounds (think "Fran", "Grace", "Isabel")
- Longer workouts can support more rounds with lower reps per round
- Prevents 8-round sprints with tiny rep counts

---

## 📊 Expected Results

### **Sprint Domain (1-5 min) Examples:**

**Before Fix:**
```
4 Rounds For Time
3 Toes to Bar
15 Double Unders
Total: 12 T2B + 60 DUs (~2 min)
```

**After Fix:**
```
3 Rounds For Time
12 Toes to Bar
50 Double Unders
Total: 36 T2B + 150 DUs (~4 min) ✅
```

---

**Before Fix:**
```
8 Rounds For Time  
3 Power Cleans @ 115/75
3 Ski Calories
Total: 24 Cleans + 24 Cals (~2 min)
```

**After Fix:**
```
2 Rounds For Time
15 Power Cleans @ 115/75
18 Ski Calories
Total: 30 Cleans + 36 Cals (~4 min) ✅
```

---

### **Comparison to Classic Workouts:**

**"Fran" (Sprint):**
- Actual: 21-15-9 Thrusters + Pull-ups = 45 each = 90 total reps
- Expected after fix: Similar volume (60-100 total reps)

**"Cindy" (Short AMRAP):**
- Actual: 5-PU, 10-Pushups, 15-Squats per round × ~15-20 rounds in 20 min
- Expected after fix: Similar rep density

---

## 📈 Target Rep Volumes by Domain

| Domain | Duration | Rep Factor | Rounds | Expected Total Reps |
|--------|----------|------------|--------|---------------------|
| Sprint | 1-5 min | 1.0 | 1-3 | 60-150 |
| Short | 5-10 min | 0.85 | 3-5 | 150-300 |
| Medium | 10-15 min | 0.75 | 5-7 | 300-500 |
| Long | 15-20 min | 0.65 | 6-9 | 500-700 |
| Extended | 20+ min | 0.55 | 8-12 | 700-1000 |

---

## 🧪 Testing

To verify the fix works:
1. Generate 10 new workouts
2. Check sprint domain workouts (1-5 min)
3. Verify they have:
   - ✅ 1-3 rounds (not 8)
   - ✅ 60-150 total reps
   - ✅ Realistic rep counts per exercise (10-50 range for most movements)

---

## 📝 Files Modified

- `lib/btn/utils.ts`
  - Line ~351: Added domain-specific rep factor calculation
  - Line ~396, ~504: Replaced `0.3` with `repFactor`
  - Line ~134-151: Added domain-specific round count logic

---

## 🎯 Impact

**Fixes:**
- ✅ Sprint workouts now have realistic volume
- ✅ Round counts scale appropriately by duration
- ✅ Rep counts match classic CrossFit workout patterns
- ✅ All domains benefit from proper pacing factors

**No Breaking Changes:**
- ✅ Same data structures
- ✅ Same function signatures
- ✅ Only internal calculation logic changed
- ✅ Existing saved workouts unaffected

---

## 💡 Future Improvements

After this fix, consider:
1. Add validation to reject workouts below minimum total reps
2. Add exercise-specific multipliers (e.g., high-skill = slightly lower reps)
3. Consider equipment weight in rep calculations (135# thrusters ≠ 225# thrusters)
4. Add workout naming based on classic formats ("Fran-style", "Grace-style", etc.)

---

**Fix Implemented:** 2025-10-24  
**Tested:** Pending user verification  
**Status:** ✅ Ready for testing
