'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

// ============================================================================
// Types
// ============================================================================

type WorkoutItem = {
  workout_id: string
  slug: string
  name: string
  event_year: number
  event_level: 'Open' | 'Quarterfinal' | 'Semifinal' | 'Games'
  format: 'AMRAP' | 'For Time' | 'Ladder'
  time_domain: 'sprint' | 'short' | 'medium' | 'long' | 'ultra' | null
  time_range?: string
  equipment: string[]
  display_top_male?: string
  display_p90_male?: string
  display_median_male?: string
  display_top_female?: string
  display_p90_female?: string
  display_median_female?: string
}

// ============================================================================
// Constants
// ============================================================================

const EQUIPMENT_LIST = [
  'Barbell', 'Dumbbells', 'Pullup Bar or Rig', 'Wall Ball', 'Kettlebell',
  'Row Erg', 'Bike Erg', 'Ski Erg', 'Jump Rope', 'Climbing Rope',
  'Plyo Box', 'Axle Bar', 'GHD', 'Rings', 'Sandbag', 'Sled'
]

const LEVELS = ['Open', 'Quarterfinal', 'Semifinal', 'Games']
const FORMATS = ['AMRAP', 'For Time', 'Ladder']
const TIME_RANGES = ['1:00–5:00', '5:00–10:00', '10:00–15:00', '15:00–20:00', '20:00+']
const YEARS = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015]
const PAGE_SIZE = 20

// ============================================================================
// Hooks
// ============================================================================

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

// ============================================================================
// Components
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-gray-400">
        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="border border-gray-200 rounded-xl p-4 bg-white">
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1">
              <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
              <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
            </div>
            <div className="h-4 w-10 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ErrorMessage({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="border border-red-200 bg-red-50 rounded-xl p-6 text-center">
      <div className="text-red-600 font-medium mb-2">Failed to load workouts</div>
      <div className="text-red-500 text-sm mb-4">{message}</div>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-coral text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
      >
        Try Again
      </button>
    </div>
  )
}

function GenderTabs({ value, onChange }: { value: 'male' | 'female'; onChange: (v: 'male' | 'female') => void }) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-white">
      <button
        onClick={() => onChange('male')}
        className={`px-4 py-2 rounded-md font-semibold text-sm transition-all ${
          value === 'male'
            ? 'bg-coral text-white shadow-sm'
            : 'text-charcoal hover:bg-gray-50'
        }`}
      >
        Men
      </button>
      <button
        onClick={() => onChange('female')}
        className={`px-4 py-2 rounded-md font-semibold text-sm transition-all ${
          value === 'female'
            ? 'bg-coral text-white shadow-sm'
            : 'text-charcoal hover:bg-gray-50'
        }`}
      >
        Women
      </button>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <select
      className="border border-gray-200 bg-white p-2.5 rounded-lg text-charcoal focus:outline-none focus:ring-2 focus:ring-coral focus:border-transparent transition-all"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{label}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

function EquipmentToggle({
  name,
  selected,
  onClick,
}: {
  name: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
        selected
          ? 'bg-coral text-white border border-coral shadow-sm'
          : 'bg-white text-charcoal border border-gray-200 hover:border-coral hover:text-coral'
      }`}
    >
      {name}
    </button>
  )
}

function WorkoutCard({
  workout,
  gender,
}: {
  workout: WorkoutItem
  gender: 'male' | 'female'
}) {
  const stats = gender === 'female'
    ? { top: workout.display_top_female, p90: workout.display_p90_female, median: workout.display_median_female }
    : { top: workout.display_top_male, p90: workout.display_p90_male, median: workout.display_median_male }

  // Display time_range if available, otherwise fall back to time_domain
  const timeDisplay = workout.time_range || workout.time_domain

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white hover:border-coral hover:shadow-md transition-all group">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="font-semibold text-charcoal group-hover:text-coral transition-colors">
            {workout.name}
          </div>
          <div className="text-sm text-gray-500">
            {workout.event_year} • {workout.event_level} • {workout.format}
            {timeDisplay && ` • ${timeDisplay}`}
          </div>
          <div className="text-sm text-gray-600">
            <span className="text-coral font-medium">Top</span> {stats.top || '–'}
            <span className="mx-2 text-gray-300">•</span>
            <span className="text-gray-500 font-medium">P90</span> {stats.p90 || '–'}
            <span className="mx-2 text-gray-300">•</span>
            <span className="text-gray-500 font-medium">P50</span> {stats.median || '–'}
          </div>
        </div>
        <a
          href={`/workouts/${encodeURIComponent(workout.slug || '')}`}
          className="text-coral font-semibold hover:underline"
        >
          Info
        </a>
      </div>
    </div>
  )
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function WorkoutsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Initialize state from URL params
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '')
  const [level, setLevel] = useState(searchParams.get('level') || '')
  const [format, setFormat] = useState(searchParams.get('format') || '')
  const [timeRange, setTimeRange] = useState(searchParams.get('timeRange') || '')
  const [year, setYear] = useState(searchParams.get('year') || '')
  const [equipment, setEquipment] = useState<string[]>(
    searchParams.get('equipment')?.split(',').filter(Boolean) || []
  )
  const [gender, setGender] = useState<'male' | 'female'>(
    (searchParams.get('gender') as 'male' | 'female') || 'male'
  )
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest')
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1)

  // Data state
  const [items, setItems] = useState<WorkoutItem[]>([])
  const [count, setCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Debounce search input
  const debouncedSearch = useDebounce(searchInput, 300)

  // Check if any filters are active
  const hasActiveFilters = Boolean(
    debouncedSearch || level || format || timeRange || year || equipment.length
  )

  // Build query string and update URL
  const query = useMemo(() => {
    const usp = new URLSearchParams()
    if (debouncedSearch) usp.set('q', debouncedSearch)
    if (level) usp.set('level', level)
    if (format) usp.set('format', format)
    if (timeRange) usp.set('timeRange', timeRange)
    if (year) usp.set('year', year)
    if (equipment.length) usp.set('equipment', equipment.join(','))
    if (gender) usp.set('gender', gender)
    if (sort) usp.set('sort', sort)
    usp.set('limit', String(PAGE_SIZE))
    usp.set('offset', String((page - 1) * PAGE_SIZE))
    return usp.toString()
  }, [debouncedSearch, level, format, timeRange, year, equipment, gender, sort, page])

  // Sync URL with filter state
  useEffect(() => {
    const usp = new URLSearchParams()
    if (debouncedSearch) usp.set('q', debouncedSearch)
    if (level) usp.set('level', level)
    if (format) usp.set('format', format)
    if (timeRange) usp.set('timeRange', timeRange)
    if (year) usp.set('year', year)
    if (equipment.length) usp.set('equipment', equipment.join(','))
    if (gender && gender !== 'male') usp.set('gender', gender)
    if (sort && sort !== 'newest') usp.set('sort', sort)
    if (page > 1) usp.set('page', String(page))

    const newUrl = usp.toString() ? `?${usp.toString()}` : '/workouts'
    router.replace(newUrl, { scroll: false })
  }, [debouncedSearch, level, format, timeRange, year, equipment, gender, sort, page, router])

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/workouts/search?${query}`)
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }
      const res = await response.json()
      if (res.error) {
        throw new Error(res.error)
      }
      setItems(res.items || [])
      setCount(res.count || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setItems([])
      setCount(0)
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handlers
  const toggleEquipment = (name: string) => {
    setEquipment((prev) => (prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name]))
    setPage(1)
  }

  const clearFilters = () => {
    setSearchInput('')
    setLevel('')
    setFormat('')
    setTimeRange('')
    setYear('')
    setEquipment([])
    setSort('newest')
    setPage(1)
  }

  const handleFilterChange = (setter: (v: string) => void) => (value: string) => {
    setter(value)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <div className="min-h-screen bg-ice-blue">
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-charcoal">Competition Workouts</h1>
          <GenderTabs value={gender} onChange={(v) => { setGender(v); setPage(1) }} />
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4 shadow-sm">
          {/* Search and Primary Filters */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2">
              <input
                className="w-full border border-gray-200 bg-white p-2.5 rounded-lg text-charcoal placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-coral focus:border-transparent transition-all"
                placeholder="Search workouts…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <FilterSelect
              label="Year"
              value={year}
              options={YEARS.map((y) => ({ value: String(y), label: String(y) }))}
              onChange={handleFilterChange(setYear)}
            />
            <FilterSelect
              label="Level"
              value={level}
              options={LEVELS.map((l) => ({ value: l, label: l }))}
              onChange={handleFilterChange(setLevel)}
            />
            <FilterSelect
              label="Format"
              value={format}
              options={FORMATS.map((f) => ({ value: f, label: f }))}
              onChange={handleFilterChange(setFormat)}
            />
          </div>

          {/* Secondary Filters Row */}
          <div className="flex flex-wrap items-center gap-3">
            <FilterSelect
              label="Time Range"
              value={timeRange}
              options={TIME_RANGES.map((t) => ({ value: t, label: t }))}
              onChange={handleFilterChange(setTimeRange)}
            />
            <FilterSelect
              label="Sort"
              value={sort}
              options={[
                { value: 'newest', label: 'Newest' },
                { value: 'popularity', label: 'Popularity' },
                { value: 'name', label: 'Name' },
              ]}
              onChange={handleFilterChange(setSort)}
            />
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-sm font-medium text-coral hover:text-white hover:bg-coral border border-coral rounded-lg transition-all"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Equipment Toggles */}
          <div>
            <div className="text-sm font-medium text-gray-500 mb-2">Equipment</div>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_LIST.map((e) => (
                <EquipmentToggle
                  key={e}
                  name={e}
                  selected={equipment.includes(e)}
                  onClick={() => toggleEquipment(e)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Results Section */}
        {error ? (
          <ErrorMessage message={error} onRetry={fetchData} />
        ) : loading ? (
          <LoadingSkeleton />
        ) : (
          <div className="space-y-3">
            {/* Results Header */}
            <div className="flex items-center justify-between text-sm">
              <div className="text-gray-500">
                <span className="font-semibold text-charcoal">{count}</span> workouts found
              </div>
              <div className="text-gray-500">
                Page <span className="font-semibold text-charcoal">{page}</span> of{' '}
                <span className="font-semibold text-charcoal">{totalPages}</span>
              </div>
            </div>

            {/* Workout Cards */}
            {items.length === 0 ? (
              <div className="border border-gray-200 rounded-xl p-8 bg-white text-center">
                <div className="text-gray-500">No workouts match your filters</div>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="mt-3 text-coral font-medium hover:underline"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              items.map((w) => (
                <WorkoutCard key={w.workout_id} workout={w} gender={gender} />
              ))
            )}

            {/* Pagination Controls */}
            {items.length > 0 && (
              <div className="flex items-center justify-between pt-2">
                <button
                  className="px-4 py-2 border border-gray-200 rounded-lg font-medium text-charcoal hover:border-coral hover:text-coral disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:text-charcoal transition-all"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </button>
                <div className="text-sm text-gray-500">
                  Showing{' '}
                  <span className="font-medium text-charcoal">
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, count)}
                  </span>{' '}
                  of <span className="font-medium text-charcoal">{count}</span>
                </div>
                <button
                  className="px-4 py-2 border border-gray-200 rounded-lg font-medium text-charcoal hover:border-coral hover:text-coral disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:text-charcoal transition-all"
                  onClick={() => setPage((p) => (p * PAGE_SIZE < count ? p + 1 : p))}
                  disabled={page * PAGE_SIZE >= count}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer CTA */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center shadow-sm">
          <div className="text-charcoal font-medium mb-2">
            Want to track your performance on these workouts?
          </div>
          <a
            href="/start"
            className="inline-flex items-center px-5 py-2.5 rounded-lg bg-coral text-white font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            Get Started Free
          </a>
        </div>
      </div>
    </div>
  )
}
