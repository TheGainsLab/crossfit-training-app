# BTN Heat Map Integration Plan
## Reusing Premium Heat Map + Adding New Analytics Views

---

## Strategy

**Reuse existing `MetconHeatmap.tsx` component** for BTN users BUT:
- Adapt data structure for BTN workouts (distribution, not performance)
- Change color meaning: Frequency instead of percentile
- Keep same time domains
- Add new stats views alongside it

---

## Existing Heat Map Structure

### Component:
- **File:** `components/MetconHeatmap.tsx`
- **Used by:** Premium users for exercise performance tracking
- **Shows:** Performance percentiles by exercise × time domain

### Data Structure:
```typescript
interface HeatmapData {
  exercises: string[]  // Exercise names
  timeDomains: string[]  // Time domain labels
  heatmapCells: [{
    exercise_name: string
    time_range: string
    session_count: number
    avg_percentile: number  // Performance metric (for Premium)
  }]
  exerciseAverages: [{
    exercise_name: string
    total_sessions: number
    overall_avg_percentile: number
  }]
  globalFitnessScore: number  // Overall performance
  totalCompletedWorkouts: number
}
```

### Premium Heat Map Appearance:
```
Exercise Performance Heat Map
                5:00-10:00    10:00-15:00    15:00-20:00
Pull-ups        [85% green]   [72% yellow]   [—]
Thrusters       [65% yellow]  [78% green]    [—]
```

---

## BTN Heat Map Adaptation

### What Changes:
1. **Color Meaning:**
   - Premium: Green = good performance (high percentile)
   - BTN: Blue = high frequency (more workouts)

2. **Rows (Y-Axis):**
   - Option A: Workout formats (For Time, AMRAP, EMOM, Chipper)
   - Option B: Primary exercise category (Barbell, Gymnastics, Mono, Mixed)
   - **Recommend: Option A** (simpler, more useful)

3. **Columns (X-Axis):**
   - Keep same: Time domains (Sprint, Short, Medium, Long, Extended)

4. **Cell Content:**
   - Premium: Percentile + session count
   - BTN: Workout count + completion rate

### BTN Heat Map Appearance:
```
Workout Distribution Heat Map
              Sprint        Short         Medium        Long
For Time      [8 workouts]  [12 workouts] [5 workouts]  [2 workouts]
              75% done      80% done      60% done      100% done
AMRAP         [3 workouts]  [10 workouts] [15 workouts] [4 workouts]
              100% done     70% done      65% done      50% done
```

---

## Implementation

### Step 1: Create BTN Heat Map API

**File:** `app/api/btn/heatmap/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
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

    // Fetch BTN workouts
    const { data: workouts, error } = await supabase
      .from('program_workouts')
      .select('workout_format, time_domain, completed')
      .eq('user_id', userData.id)
      .eq('workout_type', 'btn')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform data for MetconHeatmap component
    const formats = ['For Time', 'AMRAP', 'EMOM', 'Chipper']
    const timeDomains = ['Sprint', 'Short', 'Medium', 'Long', 'Extended']

    // Calculate cells
    const heatmapCells = []
    const exerciseAverages = []

    for (const format of formats) {
      let formatTotal = 0
      let formatCompleted = 0

      for (const domain of timeDomains) {
        const cellWorkouts = workouts?.filter(w => 
          w.workout_format === format && w.time_domain === domain
        ) || []

        const count = cellWorkouts.length
        const completedCount = cellWorkouts.filter(w => w.completed).length
        const completionRate = count > 0 ? Math.round((completedCount / count) * 100) : 0

        if (count > 0) {
          heatmapCells.push({
            exercise_name: format,  // Use format as "exercise"
            time_range: domain,
            session_count: count,
            avg_percentile: completionRate,  // Use completion rate as "percentile"
            sort_order: formats.indexOf(format)
          })
        }

        formatTotal += count
        formatCompleted += completedCount
      }

      // Calculate average for this format
      if (formatTotal > 0) {
        exerciseAverages.push({
          exercise_name: format,
          total_sessions: formatTotal,
          overall_avg_percentile: Math.round((formatCompleted / formatTotal) * 100)
        })
      }
    }

    // Calculate global stats
    const totalWorkouts = workouts?.length || 0
    const totalCompleted = workouts?.filter(w => w.completed).length || 0
    const globalCompletionRate = totalWorkouts > 0 
      ? Math.round((totalCompleted / totalWorkouts) * 100) 
      : 0

    const heatmapData = {
      exercises: formats.filter(f => 
        workouts?.some(w => w.workout_format === f)
      ),
      timeDomains: timeDomains,
      heatmapCells: heatmapCells,
      exerciseAverages: exerciseAverages,
      globalFitnessScore: globalCompletionRate,  // Use completion rate as "fitness score"
      totalCompletedWorkouts: totalCompleted
    }

    return NextResponse.json({ 
      success: true, 
      data: heatmapData 
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

---

### Step 2: Create BTN-Specific Heat Map Wrapper

**File:** `components/BTNHeatmap.tsx`

```typescript
'use client'

import MetconHeatmap from './MetconHeatmap'

interface BTNHeatmapProps {
  data: any
}

export default function BTNHeatmap({ data }: BTNHeatmapProps) {
  // Just wrap the existing MetconHeatmap but with BTN-friendly labels
  
  if (!data || !data.exercises || data.exercises.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          📊 Workout Distribution Heat Map
        </h3>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <div className="text-4xl mb-3">💪</div>
          <p className="text-blue-800 font-medium mb-2">No Workouts Yet!</p>
          <p className="text-blue-600">
            Generate and complete workouts to see your distribution patterns!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Legend explaining BTN heat map */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">
          📊 How to Read This Heat Map
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-blue-800">
          <div>
            <strong>Rows:</strong> Workout formats (For Time, AMRAP, etc.)
          </div>
          <div>
            <strong>Columns:</strong> Time domains (Sprint, Short, etc.)
          </div>
          <div>
            <strong>Numbers:</strong> Top = completion rate, Bottom = workout count
          </div>
          <div>
            <strong>Colors:</strong> Green = high completion, Red = low completion
          </div>
        </div>
      </div>

      {/* Reuse existing MetconHeatmap component */}
      <div className="relative">
        <MetconHeatmap data={data} />
        
        {/* Override title */}
        <style jsx global>{`
          .bg-white.rounded-lg.shadow h3:first-child {
            /* Could customize title here if needed */
          }
        `}</style>
      </div>
    </div>
  )
}
```

---

### Step 3: Add New Analytics Views (Your Cool Ones!)

**File:** `components/BTNAnalytics.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface BTNStats {
  totalGenerated: number
  totalCompleted: number
  completionRate: number
  byTimeDomain: { [key: string]: number }
  byFormat: { [key: string]: number }
  completionByTimeDomain: { [key: string]: number }
  recentWorkouts: any[]
}

export default function BTNAnalytics({ userId }: { userId: number }) {
  const [stats, setStats] = useState<BTNStats>({
    totalGenerated: 0,
    totalCompleted: 0,
    completionRate: 0,
    byTimeDomain: {},
    byFormat: {},
    completionByTimeDomain: {},
    recentWorkouts: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [userId])

  const loadStats = async () => {
    const supabase = createClient()
    
    const { data: workouts } = await supabase
      .from('program_workouts')
      .select('*')
      .eq('user_id', userId)
      .eq('workout_type', 'btn')
      .order('generated_at', { ascending: false })

    const total = workouts?.length || 0
    const completed = workouts?.filter(w => w.completed).length || 0
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0

    // Group by time domain
    const byTimeDomain: any = {}
    const completionByTimeDomain: any = {}
    
    workouts?.forEach(w => {
      byTimeDomain[w.time_domain] = (byTimeDomain[w.time_domain] || 0) + 1
      if (w.completed) {
        completionByTimeDomain[w.time_domain] = (completionByTimeDomain[w.time_domain] || 0) + 1
      }
    })

    // Group by format
    const byFormat: any = {}
    workouts?.forEach(w => {
      byFormat[w.workout_format] = (byFormat[w.workout_format] || 0) + 1
    })

    setStats({
      totalGenerated: total,
      totalCompleted: completed,
      completionRate: rate,
      byTimeDomain,
      byFormat,
      completionByTimeDomain,
      recentWorkouts: workouts?.slice(0, 10) || []
    })
    
    setLoading(false)
  }

  if (loading) {
    return <div>Loading stats...</div>
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total Generated */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Total Generated</div>
          <div className="text-4xl font-bold text-[#FE5858]">
            {stats.totalGenerated}
          </div>
          <div className="text-xs text-gray-500 mt-1">All time</div>
        </div>

        {/* Completed */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Completed</div>
          <div className="text-4xl font-bold text-green-600">
            {stats.totalCompleted}
          </div>
          <div className="text-xs text-gray-500 mt-1">Workouts finished</div>
        </div>

        {/* Completion Rate */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Completion Rate</div>
          <div className="text-4xl font-bold text-blue-600">
            {stats.completionRate}%
          </div>
          <div className="text-xs text-gray-500 mt-1">Success rate</div>
        </div>

        {/* To Do */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">To Do</div>
          <div className="text-4xl font-bold text-orange-600">
            {stats.totalGenerated - stats.totalCompleted}
          </div>
          <div className="text-xs text-gray-500 mt-1">Incomplete</div>
        </div>
      </div>

      {/* Time Domain Breakdown */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold mb-4">Workouts by Time Domain</h3>
        <div className="space-y-4">
          {Object.entries(stats.byTimeDomain)
            .sort((a, b) => b[1] - a[1])
            .map(([domain, count]: [string, any]) => {
              const completedCount = stats.completionByTimeDomain[domain] || 0
              const completionRate = Math.round((completedCount / count) * 100)
              
              return (
                <div key={domain}>
                  <div className="flex justify-between text-sm mb-1">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{domain}</span>
                      <span className="text-xs text-gray-500">
                        ({completedCount}/{count} completed • {completionRate}%)
                      </span>
                    </div>
                    <span className="text-gray-600">{count} workouts</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div className="flex h-full">
                      {/* Completed portion */}
                      <div
                        className="bg-green-500 h-full"
                        style={{ 
                          width: `${(completedCount / stats.totalGenerated) * 100}%` 
                        }}
                      />
                      {/* Generated but not completed */}
                      <div
                        className="bg-blue-300 h-full"
                        style={{ 
                          width: `${((count - completedCount) / stats.totalGenerated) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
        <div className="mt-4 flex items-center gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-300 rounded"></div>
            <span>To Do</span>
          </div>
        </div>
      </div>

      {/* Format Breakdown */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold mb-4">Workouts by Format</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(stats.byFormat).map(([format, count]: [string, any]) => (
            <div key={format} className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-[#FE5858]">{count}</div>
              <div className="text-sm text-gray-600 mt-1">{format}</div>
              <div className="text-xs text-gray-500 mt-1">
                {Math.round((count / stats.totalGenerated) * 100)}% of total
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

### Step 4: Integrate into BTN Dashboard

**File:** `app/dashboard/page.tsx` (or new `app/dashboard/btn/page.tsx`)

```typescript
'use client'

import { useState, useEffect } from 'react'
import BTNHeatmap from '@/components/BTNHeatmap'
import BTNAnalytics from '@/components/BTNAnalytics'
import Link from 'next/link'

export default function BTNDashboard() {
  const [heatmapData, setHeatmapData] = useState(null)
  const [userId, setUserId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Load heat map data
      const response = await fetch('/api/btn/heatmap')
      if (response.ok) {
        const data = await response.json()
        setHeatmapData(data.data)
      }

      // Get user ID (simplified - adapt to your auth)
      // const userId = await getUserId()
      // setUserId(userId)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-8">Loading dashboard...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                BTN Analytics
              </h1>
              <p className="text-gray-600 mt-1">
                Your workout patterns and progress
              </p>
            </div>
            <Link 
              href="/btn"
              className="px-6 py-3 bg-[#FE5858] text-white rounded-lg font-semibold hover:bg-[#ff6b6b]"
            >
              Generate Workouts
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Stats Overview */}
          {userId && <BTNAnalytics userId={userId} />}

          {/* Heat Map */}
          <BTNHeatmap data={heatmapData} />

          {/* Upgrade Prompt */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Want More?
                </h3>
                <p className="text-gray-700 mb-1">
                  Upgrade to Premium for:
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>✓ 12-week personalized programs</li>
                  <li>✓ Strength & conditioning analysis</li>
                  <li>✓ Skills progression tracking</li>
                  <li>✓ AI-powered recommendations</li>
                </ul>
              </div>
              <Link
                href="/upgrade"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
              >
                Upgrade Now
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

## Visual Comparison

### Premium Heat Map:
```
🔥 Exercise Performance Heat Map
                    5:00-10:00          10:00-15:00
Pull-ups            85% [green]         72% [yellow]
                    3 sessions          5 sessions
Thrusters           65% [yellow]        78% [green]
                    4 sessions          6 sessions
```
**Meaning:** Green = performing well (high percentile vs. others)

### BTN Heat Map:
```
📊 Workout Distribution Heat Map
                    Sprint              Short
For Time            80% [green]         75% [green]
                    5 workouts          12 workouts
AMRAP               100% [dark green]   70% [yellow]
                    3 workouts          10 workouts
```
**Meaning:** Green = high completion rate, more workouts

---

## Benefits

### For You (Developer):
- ✅ Reuse existing component (less code to maintain)
- ✅ Consistent UI across Premium and BTN
- ✅ Existing API patterns to follow
- ✅ Just adapt data structure

### For BTN Users:
- ✅ See familiar heat map visual
- ✅ Understand their workout patterns at a glance
- ✅ Get new stats views (completion rate, time domains)
- ✅ Feel like they have a complete product

### For Business:
- ✅ BTN users see value in tracking
- ✅ Heat map is preview of Premium features
- ✅ Natural upgrade path when they want more analytics

---

## Timeline

**Day 1:**
- Create `/api/btn/heatmap` endpoint
- Transform BTN workout data into heat map format

**Day 2:**
- Create `BTNHeatmap` wrapper component
- Test with sample data

**Day 3:**
- Create `BTNAnalytics` stats component
- Add stat cards, time domain breakdown, format breakdown

**Day 4:**
- Integrate into dashboard page
- Add navigation, header, upgrade prompt

**Day 5:**
- Polish, test, deploy

**Total: ~5 days**

---

## Next Steps

1. **This week:** Build heat map + analytics for BTN
2. **Next week:** Add workout history list with result logging
3. **Week after:** Add intake personalization (equipment/skills filtering)

---

**Ready to build this? Want me to start with the API endpoint?** 🚀
