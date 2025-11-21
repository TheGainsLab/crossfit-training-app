'use client'

import { useState } from 'react'

interface ResultLoggingFormProps {
  workoutId: number
  workoutFormat: string
  onSuccess: () => void
  onCancel: () => void
}

export default function ResultLoggingForm({
  workoutId,
  workoutFormat,
  onSuccess,
  onCancel
}: ResultLoggingFormProps) {
  const [result, setResult] = useState('')
  const [notes, setNotes] = useState('')
  const [avgHeartRate, setAvgHeartRate] = useState('')
  const [maxHeartRate, setMaxHeartRate] = useState('')
  const [saving, setSaving] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [percentile, setPercentile] = useState<number | null>(null)
  const [performanceTier, setPerformanceTier] = useState<string | null>(null)

  const isForTime = workoutFormat.toLowerCase().includes('time')
  const isAMRAP = workoutFormat.toLowerCase().includes('amrap')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!result.trim()) {
      alert('Please enter a result')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/btn/log-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          workoutId,
          userScore: result.trim(),
          notes: notes.trim() || undefined,
          avgHeartRate: avgHeartRate.trim() ? parseInt(avgHeartRate.trim()) : undefined,
          maxHeartRate: maxHeartRate.trim() ? parseInt(maxHeartRate.trim()) : undefined
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setPercentile(data.percentile)
          setPerformanceTier(data.performanceTier)
          setShowResult(true)
          
          // Show result for 3 seconds then call onSuccess
          setTimeout(() => {
            onSuccess()
          }, 3000)
        }
      } else {
        const data = await response.json()
        alert(`Failed to save result: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error saving result:', error)
      alert('Error saving result. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const formatTimeInput = (value: string) => {
    // Auto-format time input (e.g., "845" -> "8:45")
    const digits = value.replace(/\D/g, '')
    if (digits.length <= 2) {
      return digits
    }
    if (digits.length === 3) {
      return `${digits[0]}:${digits.slice(1)}`
    }
    return `${digits.slice(0, -2)}:${digits.slice(-2)}`
  }

  const handleTimeChange = (value: string) => {
    if (isForTime) {
      setResult(formatTimeInput(value))
    } else {
      setResult(value)
    }
  }

  // Validate heart rate input (only numbers, max 220 bpm)
  const handleHeartRateChange = (value: string, setter: (val: string) => void) => {
    const digits = value.replace(/\D/g, '')
    if (digits === '' || parseInt(digits) <= 220) {
      setter(digits)
    }
  }

  // Show success message with percentile
  if (showResult && percentile !== null) {
    return (
      <div className="bg-green-50 rounded-lg p-6 border border-green-200 text-center">
        <div className="text-5xl mb-3">🎉</div>
        <h4 className="font-bold text-2xl text-green-900 mb-2">Result Logged!</h4>
        <div className="text-lg mb-2">
          <span className="font-semibold text-gray-700">Your Score:</span>{' '}
          <span className="font-bold text-green-700">{result}</span>
        </div>
        <div className="text-3xl font-bold text-green-600 mb-1">
          {percentile}th Percentile
        </div>
        <div className="text-lg font-semibold text-green-700">
          {performanceTier}
        </div>
        <p className="text-sm text-gray-600 mt-4">Updating your stats...</p>
      </div>
    )
  }

  return (
    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
      <h4 className="font-semibold text-gray-900 mb-3">✍️ Log Your Result</h4>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Result Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isForTime && 'Time (mm:ss)'}
            {isAMRAP && 'Rounds + Reps (e.g., "5+10" or "5")'}
            {!isForTime && !isAMRAP && 'Result'}
          </label>
          <input
            type="text"
            value={result}
            onChange={(e) => handleTimeChange(e.target.value)}
            placeholder={
              isForTime 
                ? '8:45' 
                : isAMRAP 
                  ? '5+10 or 5' 
                  : 'Enter result'
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FE5858] focus:border-transparent"
            disabled={saving}
          />
          {isForTime && (
            <p className="text-xs text-gray-600 mt-1">
              Enter time like "845" and it will format to "8:45"
            </p>
          )}
          {isAMRAP && (
            <p className="text-xs text-gray-600 mt-1">
              Enter "5+10" for 5 rounds plus 10 reps, or just "5" for 5 complete rounds
            </p>
          )}
        </div>

        {/* Heart Rate Fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Avg HR (optional)
            </label>
            <input
              type="text"
              value={avgHeartRate}
              onChange={(e) => handleHeartRateChange(e.target.value, setAvgHeartRate)}
              placeholder="145"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FE5858] focus:border-transparent"
              disabled={saving}
            />
            <p className="text-xs text-gray-600 mt-1">
              Average heart rate (bpm)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Peak HR (optional)
            </label>
            <input
              type="text"
              value={maxHeartRate}
              onChange={(e) => handleHeartRateChange(e.target.value, setMaxHeartRate)}
              placeholder="175"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FE5858] focus:border-transparent"
              disabled={saving}
            />
            <p className="text-xs text-gray-600 mt-1">
              Peak heart rate (bpm)
            </p>
          </div>
        </div>

        {/* Notes Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How did it feel? Any modifications?"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FE5858] focus:border-transparent resize-none"
            disabled={saving}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !result.trim()}
            className="flex-1 px-4 py-2 text-sm bg-[#FE5858] text-white rounded-lg hover:bg-[#ff6b6b] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : '💾 Save Result'}
          </button>
        </div>
      </form>
    </div>
  )
}
