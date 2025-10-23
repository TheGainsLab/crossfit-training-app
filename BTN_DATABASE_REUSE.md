# BTN Database - Reusing Existing Tables
## Perfect! You Already Have Everything Needed

---

## Existing Database Tables (Premium)

### 1. `program_workouts` Table
**Purpose:** Stores individual exercises from programs

**Columns (from schema):**
- `id` - Primary key
- `program_id` - Links to programs table
- `week` - Week number
- `day` - Day number
- `block` - Block name ('SKILLS', 'TECHNICAL WORK', 'STRENGTH AND POWER', 'ACCESSORIES', 'METCONS')
- `exercise_order` - Order within block
- `exercise_id` - Reference to exercises table
- `exercise_name` - Exercise name
- `sets` - Set count or scheme
- `reps` - Rep count or scheme
- `weight_time` - Weight prescription or time
- `notes` - Exercise notes
- `user_result` - User's actual result
- `user_rpe` - Rate of perceived exertion
- `completed_at` - When completed
- `user_quality` - Quality grade
- `daily_calories` - Calorie estimate
- `intensity_bias` - Intensity adjustment

**Currently Used For:**
Premium users' programmed exercises (Skills, Technical Work, Strength, Accessories, individual MetCon exercises)

---

### 2. `program_metcons` Table
**Purpose:** Stores MetCon workout metadata and performance

**Columns:**
- `id` - Primary key
- `program_id` - Links to programs table
- `program_workout_id` - Links to program_workouts (optional)
- `week` - Week number
- `day` - Day number
- `metcon_id` - Reference to metcons library table
- `user_score` - User's actual score (time or rounds+reps)
- `percentile` - Performance percentile vs. benchmarks
- `performance_tier` - Tier classification
- `excellent_score` - Benchmark excellent score
- `median_score` - Benchmark median
- `std_dev` - Standard deviation
- `completed_at` - When completed

**Currently Used For:**
Premium users' MetCon workouts with performance tracking

---

## Perfect Match for BTN!

### For BTN Workouts, We Can Use BOTH Tables:

#### **Option 1: Use `program_metcons` Table (SIMPLEST)**

**Why it's perfect:**
- ✅ Already designed for complete workouts (not individual exercises)
- ✅ Has `user_score`, `completed_at`, `percentile` fields
- ✅ Can link to metcons library (if workout matches known metcon)
- ✅ Already used for Premium metcons (same type of data!)

**What we'd add:**
```sql
-- Just add a type field
ALTER TABLE program_metcons 
ADD COLUMN workout_type TEXT DEFAULT 'program';

-- Values:
-- 'program' = Premium program metcon
-- 'btn' = BTN generated workout
-- 'custom' = User-created (future)

-- Optional: Add fields BTN needs
ALTER TABLE program_metcons
ADD COLUMN workout_name TEXT,
ADD COLUMN workout_format TEXT, -- 'For Time', 'AMRAP', 'EMOM', etc.
ADD COLUMN time_domain TEXT, -- 'Sprint', 'Short', 'Medium', 'Long', 'Extended'
ADD COLUMN exercises JSONB; -- [{name, reps, weight}]
```

**Benefits:**
- ✅ Minimal changes (just add columns)
- ✅ MetCon-specific (not per-exercise)
- ✅ Performance tracking already built-in
- ✅ Heat map API already queries this table!

---

#### **Option 2: Use `program_workouts` Table**

**Why it could work:**
- ✅ More generic (stores any exercise/workout)
- ✅ Already has result tracking

**Challenges:**
- ❌ Stores individual exercises, not complete workouts
- ❌ Would need to group exercises by workout_name
- ❌ More complex queries

---

## RECOMMENDATION: Use `program_metcons`

**Why:**
1. **It's ALREADY designed for complete MetCon workouts** (exactly what BTN generates!)
2. **Minimal schema changes needed** (just add workout_type + a few BTN-specific fields)
3. **Heat map API already queries this table** - instant analytics!
4. **Performance percentiles already calculated** - reuse for BTN
5. **Same mental model** - Both BTN and Premium MetCons are "workouts"

---

## Exact Schema Changes Needed

```sql
-- Add type column to distinguish BTN from Premium
ALTER TABLE program_metcons 
ADD COLUMN IF NOT EXISTS workout_type TEXT DEFAULT 'program';

-- Add BTN-specific fields
ALTER TABLE program_metcons
ADD COLUMN IF NOT EXISTS workout_name TEXT,
ADD COLUMN IF NOT EXISTS workout_format TEXT,
ADD COLUMN IF NOT EXISTS time_domain TEXT,
ADD COLUMN IF NOT EXISTS exercises JSONB,
ADD COLUMN IF NOT EXISTS rounds INT,
ADD COLUMN IF NOT EXISTS amrap_time INT,
ADD COLUMN IF NOT EXISTS pattern TEXT;

-- Add indexes for BTN queries
CREATE INDEX IF NOT EXISTS idx_program_metcons_workout_type 
ON program_metcons(workout_type);

CREATE INDEX IF NOT EXISTS idx_program_metcons_user_type 
ON program_metcons(user_id, workout_type) 
WHERE workout_type = 'btn';

CREATE INDEX IF NOT EXISTS idx_program_metcons_time_domain 
ON program_metcons(time_domain) 
WHERE time_domain IS NOT NULL;
```

**Note:** Most columns already exist! We mainly need `workout_type` and a few BTN-specific fields.

---

## How BTN Workouts Map to Table

### BTN Generated Workout:
```javascript
{
  name: "Grace",
  format: "For Time",
  timeDomain: "Short",
  exercises: [
    { name: "Clean and Jerk", reps: 30, weight: "135/95" }
  ],
  rounds: null,
  amrapTime: null,
  pattern: null
}
```

### Saved to `program_metcons`:
```sql
INSERT INTO program_metcons (
  user_id,
  workout_type,
  workout_name,
  workout_format,
  time_domain,
  exercises,
  program_id,  -- NULL for BTN (no program)
  week,        -- NULL for BTN (not part of program)
  day,         -- NULL for BTN (not part of program)
  metcon_id,   -- If matches known metcon, otherwise NULL
  user_score,  -- User's result (filled when they log it)
  percentile   -- Calculated if metcon_id exists
) VALUES (
  123,
  'btn',
  'Grace',
  'For Time',
  'Short',
  '[{"name":"Clean and Jerk","reps":30,"weight":"135/95"}]',
  NULL,
  NULL,
  NULL,
  456,  -- IF "Grace" exists in metcons table
  NULL,  -- Not completed yet
  NULL
);
```

---

## Reusing Existing Heat Map API

**Best part:** The heat map API (`/api/analytics/[userId]/exercise-heatmap`) already queries `program_metcons`!

**Current query (simplified):**
```typescript
const { data } = await supabase
  .from('program_metcons')
  .select('metcon_id, percentile, ...')
  .eq('user_id', userId)
  .not('user_score', 'is', null)
```

**For BTN, just add filter:**
```typescript
const { data } = await supabase
  .from('program_metcons')
  .select('*')
  .eq('user_id', userId)
  .eq('workout_type', 'btn')  // ← Just add this!
  .not('user_score', 'is', null)
```

**Result:** Instant heat map for BTN workouts! 🎉

---

## Migration Path

### Step 1: Add Columns (Non-Breaking)
```sql
-- These additions don't break existing data
ALTER TABLE program_metcons 
ADD COLUMN IF NOT EXISTS workout_type TEXT DEFAULT 'program',
ADD COLUMN IF NOT EXISTS workout_name TEXT,
ADD COLUMN IF NOT EXISTS workout_format TEXT,
ADD COLUMN IF NOT EXISTS time_domain TEXT,
ADD COLUMN IF NOT EXISTS exercises JSONB,
ADD COLUMN IF NOT EXISTS rounds INT,
ADD COLUMN IF NOT EXISTS amrap_time INT,
ADD COLUMN IF NOT EXISTS pattern TEXT;
```

### Step 2: Backfill Existing Data (Optional)
```sql
-- Mark all existing metcons as 'program' type
UPDATE program_metcons 
SET workout_type = 'program' 
WHERE workout_type IS NULL;
```

### Step 3: Start Using for BTN
- BTN workouts inserted with `workout_type = 'btn'`
- Premium metcons continue with `workout_type = 'program'`
- Both show up in respective analytics

---

## Benefits of This Approach

### Technical:
- ✅ **One table** - Simpler codebase
- ✅ **Existing indexes** - Fast queries
- ✅ **Existing APIs** - Heat map works immediately
- ✅ **Non-breaking** - Doesn't affect Premium users
- ✅ **Future-proof** - Easy to add more workout types

### User Experience:
- ✅ **Unified history** - If Premium user tries BTN, all workouts in one place
- ✅ **Consistent UI** - Same workout card components
- ✅ **Cross-product insights** - "You do more short time domain workouts"
- ✅ **Upgrade path** - BTN history carries over to Premium

### Business:
- ✅ **Less maintenance** - One table to manage
- ✅ **Better analytics** - Compare BTN vs. Premium engagement
- ✅ **Cross-selling data** - "BTN users who upgrade complete more workouts"

---

## Final Answer

**YES! Use `program_metcons` table with a `workout_type` column.**

**It's perfect because:**
1. Already designed for MetCon workouts (exactly what BTN generates)
2. Has performance tracking built-in
3. Heat map API already uses it
4. Minimal changes needed
5. Premium and BTN users share infrastructure

**Just add:**
- `workout_type` column ('btn' vs. 'program')
- A few BTN-specific fields (workout_name, format, time_domain, exercises JSONB)
- Indexes for BTN queries

**Then BTN workouts flow through the same system as Premium metcons!** 🎯

---

**Want me to implement this approach?** I can start with the database migration and API endpoints. 🚀
