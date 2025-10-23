# BTN Dashboard Integration Plan
## Making BTN a Complete Standalone Product

---

## Philosophy

**BTN should feel like a complete, polished product - NOT a "lite version" of Premium.**

BTN users paid $15/mo for workout generation + tracking. They should get:
- ✅ Clean, focused dashboard
- ✅ Workout history (like Premium's MetCon tab)
- ✅ Heat map showing workout patterns
- ✅ Analytics & trends
- ✅ Profile access
- ❌ No "missing features" errors
- ❌ No broken pages

---

## Current Problems

### What's Broken:
1. **Dashboard shows error:** "No program found. Please complete the intake assessment."
2. **BTN users redirected to wrong places** (signup instead of /btn)
3. **No workout history** (workouts aren't saved to database)
4. **No analytics** (can't see patterns or progress)
5. **Confusing navigation** (see links to features they don't have)

### User Experience Issues:
- BTN users feel like they have a "broken" product
- Unclear what they have access to
- No motivation to log workouts (no tracking)
- Can't see their progress over time

---

## Solution: BTN Dashboard

Create a **BTN-specific dashboard** that shows:
1. Workout history (like Premium's MetCon view)
2. Heat map (time domains × movement patterns)
3. Analytics (completion rate, trends, PRs)
4. Profile summary
5. Quick link to generate more workouts

**NOT** a dumbed-down Premium dashboard - it's a PURPOSE-BUILT dashboard for BTN.

---

## Implementation Plan

### PHASE 1: Database - Save BTN Workouts (Critical)

**Currently:** Workouts are generated client-side, never saved  
**Goal:** Save every generated workout to database

#### Step 1.1: Create Database Table

**Option A: New `btn_workouts` table**
```sql
CREATE TABLE btn_workouts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  workout_name TEXT NOT NULL,
  workout_format TEXT NOT NULL, -- 'For Time', 'AMRAP', 'EMOM', etc.
  time_domain TEXT NOT NULL, -- 'Sprint', 'Short', 'Medium', 'Long', 'Extended'
  exercises JSONB NOT NULL, -- [{name, reps, weight}]
  rounds INT,
  amrap_time INT,
  pattern TEXT, -- '21-15-9', '1-2-3-4', etc.
  
  -- Result tracking
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  result_time TEXT, -- '8:45' or null
  result_rounds INT, -- for AMRAP or null
  result_reps INT, -- for AMRAP or null
  notes TEXT,
  
  -- Metadata
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_btn_workouts_user_id ON btn_workouts(user_id);
CREATE INDEX idx_btn_workouts_generated_at ON btn_workouts(generated_at);
CREATE INDEX idx_btn_workouts_time_domain ON btn_workouts(time_domain);
CREATE INDEX idx_btn_workouts_completed ON btn_workouts(completed);
```

**Option B: Reuse `program_workouts` table with type field**
```sql
ALTER TABLE program_workouts ADD COLUMN workout_type TEXT DEFAULT 'program';
-- 'program' = Premium program workout
-- 'btn' = BTN generated workout
-- 'custom' = User-created workout (future)

CREATE INDEX idx_program_workouts_type ON program_workouts(workout_type);
```

**Recommendation: Option B (reuse table)**
- Simpler codebase (one table for all workouts)
- Easier to show "all workouts" view later
- BTN users who upgrade to Premium have unified history

#### Step 1.2: Create API Route to Save Workouts

**File:** `app/api/btn/save-workouts/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get user's numeric ID
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { workouts } = await request.json()

    // Save all workouts to database
    const workoutRecords = workouts.map((workout: any) => ({
      user_id: userData.id,
      workout_type: 'btn',
      workout_name: workout.name,
      workout_format: workout.format,
      time_domain: workout.timeDomain,
      exercises: workout.exercises,
      rounds: workout.rounds || null,
      amrap_time: workout.amrapTime || null,
      pattern: workout.pattern || null,
      completed: false
    }))

    const { data, error } = await supabase
      .from('program_workouts')
      .insert(workoutRecords)
      .select()

    if (error) {
      console.error('Error saving workouts:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      savedCount: data.length,
      workouts: data 
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

#### Step 1.3: Update BTN Generator to Save Workouts

**File:** `app/btn/page.tsx`

**Modify generateWorkouts function:**
```typescript
const generateWorkouts = async () => {
  setIsGenerating(true);
  try {
    // Generate workouts client-side (existing logic)
    const workouts = generateTestWorkouts();
    setGeneratedWorkouts(workouts);
    
    // Save workouts to database
    const response = await fetch('/api/btn/save-workouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workouts })
    });

    if (!response.ok) {
      console.error('Failed to save workouts to database');
      // Don't block UI - workouts still generated
    } else {
      const data = await response.json();
      console.log(`✅ Saved ${data.savedCount} workouts to database`);
    }
  } catch (error) {
    console.error('Generation failed:', error);
    alert('Failed to generate workouts. Please try again.');
  } finally {
    setIsGenerating(false);
  }
};
```

---

### PHASE 2: BTN Dashboard Page

**Goal:** Create `/dashboard/btn` page (or modify existing dashboard for BTN users)

#### Step 2.1: Detect BTN Users in Dashboard

**File:** `app/dashboard/page.tsx`

**Add BTN detection:**
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

  // If BTN user, show BTN dashboard
  if (userData?.subscription_tier === 'BTN') {
    return <BTNDashboard userId={userData.id} />
  }

  // Otherwise show regular Premium dashboard
  return <PremiumDashboard userId={userData.id} />
}
```

#### Step 2.2: Create BTN Dashboard Component

**File:** `app/dashboard/components/BTNDashboard.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface BTNWorkout {
  id: number
  workout_name: string
  workout_format: string
  time_domain: string
  exercises: any[]
  completed: boolean
  completed_at: string | null
  result_time: string | null
  result_rounds: number | null
  result_reps: number | null
  generated_at: string
}

export default function BTNDashboard({ userId }: { userId: number }) {
  const [workouts, setWorkouts] = useState<BTNWorkout[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'completed' | 'incomplete'>('all')

  useEffect(() => {
    loadWorkouts()
  }, [userId, filter])

  const loadWorkouts = async () => {
    const supabase = createClient()
    
    let query = supabase
      .from('program_workouts')
      .select('*')
      .eq('user_id', userId)
      .eq('workout_type', 'btn')
      .order('generated_at', { ascending: false })

    if (filter === 'completed') {
      query = query.eq('completed', true)
    } else if (filter === 'incomplete') {
      query = query.eq('completed', false)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error loading workouts:', error)
    } else {
      setWorkouts(data || [])
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">BTN Workouts</h1>
              <p className="text-gray-600 mt-1">Your generated workout history</p>
            </div>
            <Link 
              href="/btn"
              className="px-6 py-3 bg-[#FE5858] text-white rounded-lg font-semibold hover:bg-[#ff6b6b]"
            >
              Generate More Workouts
            </Link>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-8">
            <Link 
              href="/dashboard"
              className="py-4 border-b-2 border-[#FE5858] font-medium text-gray-900"
            >
              Workouts
            </Link>
            <Link 
              href="/dashboard/analytics"
              className="py-4 border-b-2 border-transparent font-medium text-gray-500 hover:text-gray-900"
            >
              Analytics
            </Link>
            <Link 
              href="/profile"
              className="py-4 border-b-2 border-transparent font-medium text-gray-500 hover:text-gray-900"
            >
              Profile
            </Link>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'all' 
                ? 'bg-[#FE5858] text-white' 
                : 'bg-white text-gray-700 border'
            }`}
          >
            All ({workouts.length})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'completed' 
                ? 'bg-[#FE5858] text-white' 
                : 'bg-white text-gray-700 border'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setFilter('incomplete')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'incomplete' 
                ? 'bg-[#FE5858] text-white' 
                : 'bg-white text-gray-700 border'
            }`}
          >
            To Do
          </button>
        </div>

        {/* Workout List */}
        {loading ? (
          <div className="text-center py-12">Loading workouts...</div>
        ) : workouts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-600 mb-4">No workouts yet!</p>
            <Link 
              href="/btn"
              className="inline-block px-6 py-3 bg-[#FE5858] text-white rounded-lg font-semibold hover:bg-[#ff6b6b]"
            >
              Generate Your First Workout
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {workouts.map((workout) => (
              <WorkoutCard 
                key={workout.id} 
                workout={workout}
                onUpdate={loadWorkouts}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

#### Step 2.3: Create Workout Card Component

**File:** `app/dashboard/components/WorkoutCard.tsx`

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function WorkoutCard({ workout, onUpdate }: any) {
  const [showDetails, setShowDetails] = useState(false)
  const [logging, setLogging] = useState(false)
  const [result, setResult] = useState('')

  const logResult = async () => {
    setLogging(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('program_workouts')
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
        result_time: workout.workout_format === 'For Time' ? result : null,
        result_rounds: workout.workout_format === 'AMRAP' ? parseInt(result) : null,
        notes: result
      })
      .eq('id', workout.id)

    if (!error) {
      onUpdate()
      setShowDetails(false)
    }
    setLogging(false)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-bold">{workout.workout_name}</h3>
            {workout.completed && (
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                ✓ Completed
              </span>
            )}
          </div>
          
          <div className="flex gap-4 text-sm text-gray-600 mb-4">
            <span><strong>Format:</strong> {workout.workout_format}</span>
            <span><strong>Time Domain:</strong> {workout.time_domain}</span>
            <span><strong>Generated:</strong> {formatDate(workout.generated_at)}</span>
          </div>

          {workout.completed && workout.result_time && (
            <div className="text-sm font-medium text-[#FE5858]">
              Result: {workout.result_time}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
          >
            {showDetails ? 'Hide' : 'View'} Details
          </button>
          {!workout.completed && (
            <button
              onClick={() => setShowDetails(true)}
              className="px-4 py-2 text-sm bg-[#FE5858] text-white rounded-lg hover:bg-[#ff6b6b]"
            >
              Log Result
            </button>
          )}
        </div>
      </div>

      {showDetails && (
        <div className="mt-4 pt-4 border-t">
          <h4 className="font-semibold mb-3">Workout Details:</h4>
          <div className="bg-gray-50 rounded p-4 mb-4">
            {workout.exercises.map((ex: any, idx: number) => (
              <div key={idx} className="py-1">
                {ex.reps} {ex.name}
                {ex.weight && <span className="text-gray-600"> @ {ex.weight}</span>}
              </div>
            ))}
          </div>

          {!workout.completed && (
            <div className="flex gap-3">
              <input
                type="text"
                value={result}
                onChange={(e) => setResult(e.target.value)}
                placeholder={
                  workout.workout_format === 'For Time' 
                    ? 'Time (e.g., 8:45)' 
                    : 'Rounds + Reps (e.g., 5+10)'
                }
                className="flex-1 px-3 py-2 border rounded-lg"
              />
              <button
                onClick={logResult}
                disabled={!result || logging}
                className="px-6 py-2 bg-[#FE5858] text-white rounded-lg hover:bg-[#ff6b6b] disabled:opacity-50"
              >
                {logging ? 'Saving...' : 'Save Result'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

---

### PHASE 3: Heat Map for BTN Workouts

**Goal:** Show visual representation of workout distribution

#### Step 3.1: Create Heat Map Component

**File:** `app/dashboard/components/BTNHeatMap.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function BTNHeatMap({ userId }: { userId: number }) {
  const [heatMapData, setHeatMapData] = useState<any>({})

  useEffect(() => {
    loadHeatMapData()
  }, [userId])

  const loadHeatMapData = async () => {
    const supabase = createClient()
    
    const { data: workouts } = await supabase
      .from('program_workouts')
      .select('time_domain, workout_format')
      .eq('user_id', userId)
      .eq('workout_type', 'btn')

    // Group by time_domain and format
    const grouped: any = {}
    workouts?.forEach((w) => {
      const key = `${w.time_domain}-${w.workout_format}`
      grouped[key] = (grouped[key] || 0) + 1
    })

    setHeatMapData(grouped)
  }

  const timeDomains = ['Sprint', 'Short', 'Medium', 'Long', 'Extended']
  const formats = ['For Time', 'AMRAP', 'EMOM', 'Chipper']

  const getIntensity = (count: number) => {
    if (count === 0) return 'bg-gray-100'
    if (count <= 2) return 'bg-blue-200'
    if (count <= 5) return 'bg-blue-400'
    if (count <= 10) return 'bg-blue-600'
    return 'bg-blue-800'
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-xl font-bold mb-4">Workout Distribution</h3>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left p-2">Format / Time</th>
              {timeDomains.map((td) => (
                <th key={td} className="text-center p-2 text-sm">{td}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {formats.map((format) => (
              <tr key={format}>
                <td className="p-2 font-medium text-sm">{format}</td>
                {timeDomains.map((td) => {
                  const key = `${td}-${format}`
                  const count = heatMapData[key] || 0
                  return (
                    <td key={key} className="p-2">
                      <div
                        className={`h-12 w-12 rounded flex items-center justify-center cursor-pointer hover:opacity-80 ${getIntensity(count)}`}
                        title={`${count} workouts`}
                      >
                        {count > 0 && (
                          <span className="text-sm font-semibold text-white">
                            {count}
                          </span>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-gray-600">
        <span>Less</span>
        <div className="flex gap-1">
          {[0, 1, 3, 6, 11].map((count) => (
            <div
              key={count}
              className={`h-4 w-4 rounded ${getIntensity(count)}`}
            />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  )
}
```

#### Step 3.2: Add to Analytics Page

**File:** `app/dashboard/analytics/page.tsx` (new or modified)

```typescript
import BTNHeatMap from '../components/BTNHeatMap'
import BTNAnalytics from '../components/BTNAnalytics'

export default async function AnalyticsPage() {
  // ... get user and detect BTN

  if (userData?.subscription_tier === 'BTN') {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">BTN Analytics</h1>
        
        <div className="space-y-8">
          <BTNHeatMap userId={userData.id} />
          <BTNAnalytics userId={userData.id} />
        </div>
      </div>
    )
  }

  // ... Premium analytics
}
```

---

### PHASE 4: Analytics Dashboard

**File:** `app/dashboard/components/BTNAnalytics.tsx`

```typescript
'use client'

export default function BTNAnalytics({ userId }: { userId: number }) {
  const [stats, setStats] = useState({
    totalGenerated: 0,
    totalCompleted: 0,
    completionRate: 0,
    byTimeDomain: {},
    recentActivity: []
  })

  // Load stats from database
  useEffect(() => {
    loadAnalytics()
  }, [userId])

  const loadAnalytics = async () => {
    const supabase = createClient()
    
    const { data: workouts } = await supabase
      .from('program_workouts')
      .select('*')
      .eq('user_id', userId)
      .eq('workout_type', 'btn')

    const total = workouts?.length || 0
    const completed = workouts?.filter(w => w.completed).length || 0
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0

    // Group by time domain
    const byTimeDomain: any = {}
    workouts?.forEach(w => {
      byTimeDomain[w.time_domain] = (byTimeDomain[w.time_domain] || 0) + 1
    })

    setStats({
      totalGenerated: total,
      totalCompleted: completed,
      completionRate: rate,
      byTimeDomain,
      recentActivity: workouts?.slice(0, 10) || []
    })
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Total Generated */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-sm text-gray-600 mb-1">Total Workouts Generated</div>
        <div className="text-4xl font-bold text-[#FE5858]">
          {stats.totalGenerated}
        </div>
      </div>

      {/* Total Completed */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-sm text-gray-600 mb-1">Completed</div>
        <div className="text-4xl font-bold text-green-600">
          {stats.totalCompleted}
        </div>
      </div>

      {/* Completion Rate */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-sm text-gray-600 mb-1">Completion Rate</div>
        <div className="text-4xl font-bold text-blue-600">
          {stats.completionRate}%
        </div>
      </div>

      {/* By Time Domain Chart */}
      <div className="md:col-span-3 bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold mb-4">Workouts by Time Domain</h3>
        <div className="space-y-3">
          {Object.entries(stats.byTimeDomain).map(([domain, count]: [string, any]) => (
            <div key={domain}>
              <div className="flex justify-between text-sm mb-1">
                <span>{domain}</span>
                <span>{count} workouts</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-[#FE5858] h-2 rounded-full"
                  style={{ 
                    width: `${(count / stats.totalGenerated) * 100}%` 
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

---

## Navigation for BTN Users

**File:** Update main nav component

```typescript
// BTN users see:
const btnNavigation = [
  { name: 'Workouts', href: '/dashboard', icon: WorkoutIcon },
  { name: 'Analytics', href: '/dashboard/analytics', icon: ChartIcon },
  { name: 'Profile', href: '/profile', icon: UserIcon },
  { name: 'Generator', href: '/btn', icon: ZapIcon, highlight: true },
  { name: 'Upgrade', href: '/upgrade', icon: StarIcon },
]

// Premium users see:
const premiumNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Program', href: '/dashboard/program', icon: CalendarIcon },
  { name: 'Workouts', href: '/dashboard/workouts', icon: WorkoutIcon },
  { name: 'Profile', href: '/profile', icon: UserIcon },
  { name: 'Analytics', href: '/dashboard/analytics', icon: ChartIcon },
]
```

---

## Success Criteria

BTN dashboard is complete when:
- ✅ Generated workouts are saved to database
- ✅ BTN users see their workout history (not "no program" error)
- ✅ Can log results for each workout
- ✅ Heat map shows workout distribution
- ✅ Analytics show completion rate and trends
- ✅ Navigation makes sense for BTN tier
- ✅ Can easily get back to generator
- ✅ No broken/missing features
- ✅ Feels like a complete product

---

## Timeline

**Week 1: Core Functionality**
- Day 1: Database table + save workouts API
- Day 2: Update generator to save workouts
- Day 3: BTN dashboard page + workout list
- Day 4: Workout card with result logging
- Day 5: Test and deploy

**Week 2: Analytics**
- Day 1: Heat map component
- Day 2: Analytics dashboard
- Day 3: Navigation updates
- Day 4: Polish + error states
- Day 5: Test and deploy

**Total: ~10 days**

---

## After This is Done

**THEN** we can add intake personalization (Phase 2 from the other plan):
- Equipment filtering
- Skills filtering
- Weight personalization
- "Roll Your Own" mode

But first, **BTN needs to be a complete, working product**.

---

## Questions

1. **Should BTN users have access to Premium features as "view only"?**
   - Show them what Premium offers (upgrade prompt)
   - Or completely hide Premium features?

2. **Workout limit for BTN?**
   - Unlimited generation?
   - Or cap at X workouts per week?

3. **Can BTN users create custom workouts?**
   - Or only generated ones?

4. **Social features?**
   - Share workouts with friends?
   - Leaderboards?

---

**Want me to start building this? Begin with Phase 1 (save workouts to database)?** 🚀
