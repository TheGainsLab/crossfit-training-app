# BTN Immediate Priorities
## Get BTN Working Properly, Then Add Tracking

---

## Current State (What Works)

✅ **BTN subscription flow:**
- User visits `/btn` → Subscribes ($14.99/mo)
- Redirects to `/intake?session_id=xxx`
- Completes 5-section intake
- Profile generated (for future personalization)

✅ **BTN generator:**
- Creates password → Gets to `/btn`
- Sees workout generator
- Clicks "Generate 10 Workouts"
- Gets 10 realistic CrossFit workouts (2 per time domain)
- Workouts display on screen

✅ **What's functional:**
- Stripe checkout
- Intake data collection
- Profile generation
- Workout generation algorithm
- Basic UI

---

## Current Problems (What's Broken)

### 🔴 CRITICAL BUG 1: Redirect After Intake
**Problem:** New users completing intake are sent to signin page instead of `/btn`

**Expected Flow:**
```
Complete intake → Create password → Redirect to /btn ✅
```

**Actual Flow:**
```
Complete intake → Create password → Redirect to /auth/signin ❌
```

**Why It Happens:**
Auto-signin is failing (line 710-722 in `app/intake/page.tsx`)

**Fix Options:**
1. Debug why auto-signin fails (email confirmation required?)
2. Create account without immediate signin, send to signin page (current behavior - maybe this is OK?)
3. Use session-based auth instead of password-based

**Decision Needed:**
- Is it OK to send users to signin page after creating account?
- Or must they be auto-signed-in and redirected?

---

### 🔴 CRITICAL BUG 2: Dashboard Error for BTN Users
**Problem:** If BTN user visits `/dashboard`, they see error

**Error Message:**
```
⚠️ Error Loading Dashboard
No program found. Please complete the intake assessment.
[Complete Assessment]
```

**Why It Happens:**
Dashboard checks for `program` in database, BTN users don't have programs

**Fix:**
Detect BTN users and either:
- **Option A:** Redirect to `/btn` (they shouldn't be on dashboard)
- **Option B:** Show BTN-specific dashboard (workout history)
- **Option C:** Show friendly message: "BTN users use the workout generator"

**Recommendation: Option A** (redirect to `/btn`)

---

### 🟡 ISSUE 3: No Workout Persistence
**Problem:** Generated workouts aren't saved to database

**Impact:**
- Can't see workout history
- Can't log results
- Can't track progress
- Have to regenerate same workouts if they refresh page

**What Needs to Happen:**
When user clicks "Generate 10 Workouts":
1. Generate workouts (already works)
2. Save to database ← NEW
3. Display workouts (already works)
4. Allow result logging ← NEW

---

## Phase 1: Fix Critical Bugs (1-2 Days)

### Day 1 Morning: Fix Dashboard Error

**File:** `app/dashboard/page.tsx`

**Add BTN detection at top:**
```typescript
export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/signin')
  }

  // Get user's subscription tier
  const { data: userData } = await supabase
    .from('users')
    .select('id, subscription_tier')
    .eq('auth_id', user.id)
    .single()

  // BTN users should use the generator, not dashboard
  if (userData?.subscription_tier === 'BTN') {
    redirect('/btn')
  }

  // Rest of dashboard code for Premium/Applied Power users...
}
```

**Result:** BTN users visiting `/dashboard` are redirected to `/btn`

---

### Day 1 Afternoon: Debug/Fix Redirect After Intake

**Step 1: Test what error occurs during auto-signin**

Add logging to see what's failing:
```typescript
// In app/intake/page.tsx line ~710
const { error: signInError } = await supabase.auth.signInWithPassword({
  email: formData.email,
  password: formData.password
})

if (signInError) {
  console.error('❌ Auto-signin failed:', signInError)
  console.error('Error code:', signInError.code)
  console.error('Error message:', signInError.message)
  // ... rest of error handling
}
```

**Step 2: Check Supabase settings**
- Is email confirmation enabled?
- Are there password requirements blocking it?

**Step 3: Fix based on findings**

**Option A: Email confirmation is enabled**
```typescript
// Change success message
setSubmitMessage('✅ Account created! Check your email to verify, then sign in.')
// Still redirect to signin
router.push('/auth/signin')
```

**Option B: Email confirmation is disabled, another issue**
```typescript
// Add delay before signin attempt
await new Promise(resolve => setTimeout(resolve, 1000))

const { error: signInError } = await supabase.auth.signInWithPassword({
  email: formData.email,
  password: formData.password
})
```

**Option C: Skip auto-signin entirely (simplest)**
```typescript
// Always send to signin page
setSubmitMessage('✅ Account created! Please sign in to access your workouts.')
router.push('/auth/signin')
```

**Recommendation: Test first, then decide. If auto-signin is complex, Option C is fine.**

---

## Phase 2: Add Workout Persistence + History (3-4 Days)

### Prerequisites:
- Decide on database table approach
- Create API endpoints
- Update generator to save workouts
- Build workout history view

---

### Day 2: Database Setup + API

#### Step 2.1: Database Schema

**Option A: Reuse `program_workouts` table (RECOMMENDED)**

Add column to existing table:
```sql
ALTER TABLE program_workouts 
ADD COLUMN IF NOT EXISTS workout_type TEXT DEFAULT 'program';

-- Values: 'program', 'btn', 'custom'
-- program = Premium/Applied Power program workout
-- btn = BTN generated workout
-- custom = User-created (future)

CREATE INDEX IF NOT EXISTS idx_program_workouts_type 
ON program_workouts(workout_type);

CREATE INDEX IF NOT EXISTS idx_program_workouts_user_type 
ON program_workouts(user_id, workout_type);
```

**Verify existing columns support BTN data:**
```sql
-- Check current schema
\d program_workouts

-- Should have these columns:
-- id, user_id, program_id, week, day, 
-- block_name, workout_name, workout_format,
-- exercises (JSONB), rounds, amrap_time, 
-- completed, result, notes, created_at
```

**Benefits:**
- ✅ No new table needed
- ✅ Unified workout history (when Premium users try BTN)
- ✅ Existing indexes and relations work
- ✅ Future-proof for cross-product features

---

#### Step 2.2: Create API Endpoint - Save Workouts

**File:** `app/api/btn/save-workouts/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface BTNWorkout {
  name: string
  format: string
  timeDomain: string
  exercises: any[]
  rounds?: number
  amrapTime?: number
  pattern?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' }, 
        { status: 401 }
      )
    }

    // Get user's numeric ID
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (!userData) {
      return NextResponse.json(
        { error: 'User not found' }, 
        { status: 404 }
      )
    }

    const { workouts } = await request.json()

    if (!workouts || !Array.isArray(workouts)) {
      return NextResponse.json(
        { error: 'Invalid workouts data' }, 
        { status: 400 }
      )
    }

    console.log(`💾 Saving ${workouts.length} BTN workouts for user ${userData.id}`)

    // Transform BTN workouts to database format
    const workoutRecords = workouts.map((workout: BTNWorkout) => ({
      user_id: userData.id,
      workout_type: 'btn',
      workout_name: workout.name,
      workout_format: workout.format,
      time_domain: workout.timeDomain, // Add this column if needed
      exercises: workout.exercises,
      rounds: workout.rounds || null,
      amrap_time: workout.amrapTime || null,
      pattern: workout.pattern || null,
      completed: false,
      result: null,
      notes: null
    }))

    const { data, error } = await supabase
      .from('program_workouts')
      .insert(workoutRecords)
      .select()

    if (error) {
      console.error('❌ Error saving workouts:', error)
      return NextResponse.json(
        { error: error.message }, 
        { status: 500 }
      )
    }

    console.log(`✅ Saved ${data.length} BTN workouts`)

    return NextResponse.json({ 
      success: true, 
      savedCount: data.length,
      workouts: data 
    })
  } catch (error: any) {
    console.error('❌ Exception saving workouts:', error)
    return NextResponse.json(
      { error: error.message }, 
      { status: 500 }
    )
  }
}
```

---

### Day 3: Update Generator to Save Workouts

**File:** `app/btn/page.tsx`

**Modify `generateWorkouts` function:**

```typescript
const generateWorkouts = async () => {
  setIsGenerating(true);
  try {
    // 1. Generate workouts (existing logic)
    console.log('🎲 Generating workouts...')
    const workouts = generateTestWorkouts();
    
    // 2. Display workouts immediately
    setGeneratedWorkouts(workouts);
    console.log(`✅ Generated ${workouts.length} workouts`)
    
    // 3. Save to database in background
    console.log('💾 Saving workouts to database...')
    const response = await fetch('/api/btn/save-workouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workouts })
    });

    if (!response.ok) {
      const errorData = await response.json()
      console.error('⚠️ Failed to save workouts:', errorData)
      // Show warning but don't block UI
      alert('Workouts generated but not saved to history. You can still use them!')
    } else {
      const data = await response.json()
      console.log(`✅ Saved ${data.savedCount} workouts to database`)
      
      // Optional: Show success toast
      // toast.success(`Workouts saved! View in history.`)
    }
  } catch (error) {
    console.error('❌ Generation failed:', error);
    alert('Failed to generate workouts. Please try again.');
  } finally {
    setIsGenerating(false);
  }
};
```

---

### Day 4: Build Workout History View

**File:** `app/btn/page.tsx` (or new component)

**Add "View History" tab:**

```typescript
function BTNWorkoutGenerator() {
  const [generatedWorkouts, setGeneratedWorkouts] = useState<GeneratedWorkout[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showHistory, setShowHistory] = useState(false); // NEW
  const [workoutHistory, setWorkoutHistory] = useState<any[]>([]); // NEW

  // Load history
  const loadHistory = async () => {
    const response = await fetch('/api/btn/workouts')
    if (response.ok) {
      const data = await response.json()
      setWorkoutHistory(data.workouts)
    }
  }

  useEffect(() => {
    if (showHistory) {
      loadHistory()
    }
  }, [showHistory])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-5">
        {/* Header with tabs */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={() => setShowHistory(false)}
            className={`px-6 py-3 rounded-lg font-semibold ${
              !showHistory 
                ? 'bg-[#FE5858] text-white' 
                : 'bg-white text-gray-700 border'
            }`}
          >
            Generator
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className={`px-6 py-3 rounded-lg font-semibold ${
              showHistory 
                ? 'bg-[#FE5858] text-white' 
                : 'bg-white text-gray-700 border'
            }`}
          >
            History ({workoutHistory.length})
          </button>
        </div>

        {/* Generator View */}
        {!showHistory && (
          <div>
            {/* Existing generator UI */}
            <button onClick={generateWorkouts}>
              Generate 10 Workouts
            </button>
            {/* Generated workouts display */}
          </div>
        )}

        {/* History View */}
        {showHistory && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Workout History</h2>
            {workoutHistory.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center">
                <p className="text-gray-600 mb-4">No workouts yet!</p>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="px-6 py-3 bg-[#FE5858] text-white rounded-lg"
                >
                  Generate Your First Workouts
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {workoutHistory.map((workout) => (
                  <WorkoutHistoryCard 
                    key={workout.id} 
                    workout={workout}
                    onUpdate={loadHistory}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

---

### Day 5: Add Result Logging

**Create simple workout card with logging:**

```typescript
function WorkoutHistoryCard({ workout, onUpdate }: any) {
  const [logging, setLogging] = useState(false)
  const [result, setResult] = useState('')

  const logResult = async () => {
    setLogging(true)
    
    const response = await fetch(`/api/btn/workouts/${workout.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        completed: true,
        result: result
      })
    })

    if (response.ok) {
      onUpdate()
    }
    setLogging(false)
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-bold">{workout.workout_name}</h3>
          <div className="text-sm text-gray-600 mt-1">
            {workout.workout_format} • {workout.time_domain}
          </div>
          {workout.completed && (
            <div className="text-green-600 font-medium mt-2">
              ✓ Completed: {workout.result}
            </div>
          )}
        </div>
        
        {!workout.completed && (
          <div className="flex gap-2">
            <input
              type="text"
              value={result}
              onChange={(e) => setResult(e.target.value)}
              placeholder="Time or rounds"
              className="px-3 py-2 border rounded"
            />
            <button
              onClick={logResult}
              disabled={!result || logging}
              className="px-4 py-2 bg-[#FE5858] text-white rounded hover:bg-[#ff6b6b] disabled:opacity-50"
            >
              Log
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

---

## Timeline Summary

### Week 1: Core Fixes + Persistence
- **Day 1:** Fix dashboard redirect + intake redirect bugs
- **Day 2:** Database setup + save workouts API
- **Day 3:** Update generator to save workouts
- **Day 4:** Build workout history view
- **Day 5:** Add result logging + polish

### Deliverables After Week 1:
✅ No more dashboard errors for BTN users
✅ Workouts save to database automatically
✅ Users can view workout history
✅ Users can log results
✅ BTN feels like a complete product

---

## After This is Done

**THEN we can add:**
- Heat map + analytics (Week 2)
- Intake personalization (Week 3)
- Advanced features (Week 4+)

But first: **Get the core flow working and add basic tracking.**

---

## Questions to Answer

1. **Is it OK for users to go to signin page after creating account?**
   - Or must they be auto-signed-in?

2. **Should we add `time_domain` column to `program_workouts`?**
   - Or store it in exercises JSONB?
   - Or create new table?

3. **How much workout history to show by default?**
   - Last 50 workouts?
   - Last 30 days?
   - All time?

4. **Can users delete workouts?**
   - Or only mark complete/incomplete?

---

**Ready to start?** I can begin with fixing the dashboard redirect right now. 🚀
