'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { createClient } from '@/lib/supabase/client'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

// Program Navigation Widget Component
interface NavigationProps {
  currentWeek: number;
  currentDay: number;
  programId: number;
  onNavigate: (week: number, day: number) => void;
  updatedDays?: Array<{ week: number; day: number }>
}

const ProgramNavigationWidget: React.FC<NavigationProps> = ({ 
  currentWeek, 
  currentDay, 
  programId, 
  onNavigate,
  updatedDays = []
}) => {
  const [metconOpen, setMetconOpen] = useState(false)
  const [metconRows, setMetconRows] = useState<any[]>([])
  const [loadingMetcons, setLoadingMetcons] = useState(false)

  useEffect(() => {
    if (!metconOpen) return
    ;(async () => {
      try {
        setLoadingMetcons(true)
        const sb = createClient()
        const { data: { session } } = await sb.auth.getSession()
        const token = session?.access_token
        const res = await fetch('/api/analytics/metcons?mode=plan', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        })
        const j = await res.json()
        if (j?.success && Array.isArray(j.plan)) {
          setMetconRows(j.plan)
        } else {
          setMetconRows([])
        }
      } catch {
        setMetconRows([])
      } finally {
        setLoadingMetcons(false)
      }
    })()
  }, [metconOpen])

  const metconChart = useMemo(() => {
    // Build exact days 1..20 from exact plan rows (week, day)
    const days = Array.from({ length: 20 }, (_, i) => `Day ${20 - i}`)
    const bins = ['1:00–5:00','5:00–10:00','10:00–15:00','15:00–20:00','20:00+']
    const counts = bins.map(() => Array(20).fill(0))
    ;(metconRows || []).forEach((r: any) => {
      const tr = String(r.time_range || '')
      const w = Number(r.week || 0)
      const d = Number(r.day || 0)
      if (w < 1 || w > 4 || d < 1 || d > 5) return
      const absoluteDay = (4 - w) * 5 + d // week1->days16-20 ... week4->days1-5
      const dayIdx = 20 - absoluteDay
      const idx = bins.findIndex(b => tr.includes(b))
      if (idx >= 0 && dayIdx >= 0 && dayIdx < 20) counts[idx][dayIdx] += 1
    })
    const colors = ['#93C5FD','#60A5FA','#3B82F6','#2563EB','#1D4ED8']
    return {
      data: {
        labels: days,
        datasets: bins.map((b, i) => ({
          label: b,
          data: counts[i],
          backgroundColor: colors[i],
          borderWidth: 0,
          barThickness: 10,
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y' as const,
        plugins: {
          legend: { display: true, position: 'bottom' as const },
          title: { display: false }
        },
        scales: {
          x: { stacked: true, ticks: { display: false }, grid: { display: false } },
          y: { stacked: true, grid: { display: false } }
        }
      }
    }
  }, [metconRows])
  // Helper functions for navigation
  const getPreviousDay = () => {
    if (currentDay === 1) {
      if (currentWeek === 1) return null; // No previous day
      return { week: currentWeek - 1, day: 5 };
    }
    return { week: currentWeek, day: currentDay - 1 };
  };

  const getNextDay = () => {
    if (currentDay === 5) {
      if (currentWeek === 13) return null; // End of program
      return { week: currentWeek + 1, day: 1 };
    }
    return { week: currentWeek, day: currentDay + 1 };
  };

  const formatWeekLabel = (week: number) => {
    return week === 13 ? "Test Week" : `Week ${week}`;
  };

  const previousDay = getPreviousDay();
  const nextDay = getNextDay();
  const isProgramComplete = currentWeek === 13 && currentDay === 5;

  if (isProgramComplete) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="text-center py-6">
          <div className="text-4xl mb-2">🎉</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Program Complete!</h3>
          <p className="text-gray-600 mb-4">
            You've completed all 65 workouts. Ready for your next challenge?
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              href="/dashboard/progress"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              📊 Review Progress
            </Link>
            <Link
              href="/intake"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              🚀 New Program
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      {/* Navigation Controls - Desktop */}
      <div className="hidden sm:flex items-center justify-between mb-4">
        {/* Previous Workout */}
        <button
          onClick={() => previousDay && onNavigate(previousDay.week, previousDay.day)}
          disabled={!previousDay}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
            previousDay 
              ? 'text-blue-600 hover:bg-blue-50 border border-blue-200' 
              : 'text-gray-400 cursor-not-allowed border border-gray-200'
          }`}
        >
          <span>⬅️</span>
          <div className="text-left">
            <div className="text-sm font-medium">Previous</div>
            {previousDay && (
              <div className="text-xs text-gray-500">
                {formatWeekLabel(previousDay.week)}, Day {previousDay.day}
              </div>
            )}
          </div>
        </button>

        {/* Today's Workout */}
        <div className="text-center">
          <Link
            prefetch
            href={`/dashboard/workout/${programId}/week/${currentWeek}/day/${currentDay}`}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Today's Workout
          </Link>
          <div className="text-xs text-gray-500 mt-1">
            {formatWeekLabel(currentWeek)}, Day {currentDay}
          </div>
        </div>

        {/* Next Workout */}
        <button
          onClick={() => nextDay && onNavigate(nextDay.week, nextDay.day)}
          disabled={!nextDay}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
            nextDay 
              ? 'text-blue-600 hover:bg-blue-50 border border-blue-200' 
              : 'text-gray-400 cursor-not-allowed border border-gray-200'
          }`}
        >
          <div className="text-right">
            <div className="text-sm font-medium">Next</div>
            {nextDay && (
              <div className="text-xs text-gray-500">
                {formatWeekLabel(nextDay.week)}, Day {nextDay.day}
                {updatedDays.some(d => d.week === nextDay.week && d.day === nextDay.day) && (
                  <span className="ml-2 inline-block px-2 py-0.5 text-[10px] rounded-full bg-green-100 text-green-700 border border-green-200">Updated</span>
                )}
              </div>
            )}
          </div>
          <span>➡️</span>
        </button>
      </div>

      {/* Navigation Controls - Mobile */}
      <div className="sm:hidden space-y-4">
        {/* Primary Action Button */}
        <div className="text-center">
          <Link
            prefetch
            href={`/dashboard/workout/${programId}/week/${currentWeek}/day/${currentDay}`}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors text-lg w-full justify-center"
          >
            Today's Workout
          </Link>
          <div className="text-sm text-gray-500 mt-2">
            {formatWeekLabel(currentWeek)}, Day {currentDay}
          </div>
        </div>

        {/* Previous/Next Navigation */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => previousDay && onNavigate(previousDay.week, previousDay.day)}
            disabled={!previousDay}
            className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
              previousDay 
                ? 'text-blue-600 hover:bg-blue-50 border border-blue-200' 
                : 'text-gray-400 cursor-not-allowed border border-gray-200'
            }`}
          >
            <span>⬅️</span>
            <span className="font-medium">Previous</span>
          </button>

          <button
            onClick={() => nextDay && onNavigate(nextDay.week, nextDay.day)}
            disabled={!nextDay}
            className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
              nextDay 
                ? 'text-blue-600 hover:bg-blue-50 border border-blue-200' 
                : 'text-gray-400 cursor-not-allowed border border-gray-200'
            }`}
          >
            <span className="font-medium">Next</span>
            <span>➡️</span>
          </button>
        </div>
      </div>

      {/* Links Row */}
      <div className="mt-4 flex items-center justify-center gap-6 text-center">
        <Link
          href="/dashboard/program"
          className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center space-x-1 transition-colors"
        >
          <span>📋</span>
          <span>Program Navigator</span>
        </Link>
        <Link
          href={`/dashboard/preview/week/${currentWeek + (currentDay >= 5 ? 1 : 0)}`}
          className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center space-x-1 transition-colors"
        >
          <span>🔎</span>
          <span>Week Preview</span>
        </Link>
        <button
          onClick={() => setMetconOpen(true)}
          className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center space-x-1 transition-colors"
          aria-haspopup="dialog"
          aria-expanded={metconOpen}
        >
          <span>🔥</span>
          <span>MetCon Preview</span>
        </button>
      </div>
      {/* Modal mount */}
      <MetconPreviewModal open={metconOpen} onClose={() => setMetconOpen(false)} chart={metconChart} />
    </div>
  );
};

export default ProgramNavigationWidget;

// Lightweight modal for mobile
export function MetconPreviewModal({ open, onClose, chart }: { open: boolean; onClose: () => void; chart: { data: any; options: any } }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-xl sm:rounded-xl shadow-lg p-4 max-h-[85vh] overflow-auto mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-gray-900">MetCon Preview</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <p className="text-xs text-gray-600 mb-3">Time domains across days 20 → 1 for the current program month.</p>
        <div className="h-[420px] sm:h-[480px]">
          <Bar data={chart.data} options={chart.options} />
        </div>
      </div>
    </div>
  )
}
