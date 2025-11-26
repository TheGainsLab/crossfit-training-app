'use client'

import React, { useState } from 'react'
import engineDatabaseService from '@/lib/engine/databaseService'

interface ProgramSelectionProps {
  onComplete: () => void
}

export default function ProgramSelection({ onComplete }: ProgramSelectionProps) {
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSelect = async (programVersion: string) => {
    if (saving) return
    
    setSelectedProgram(programVersion)
    setSaving(true)

    try {
      await engineDatabaseService.saveProgramVersion(programVersion)
      // Call onComplete callback to notify parent that selection is done
      if (onComplete) {
        onComplete()
      }
    } catch (error) {
      console.error('Error saving program version:', error)
      alert('Failed to save program selection. Please try again.')
      setSaving(false)
      setSelectedProgram(null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-br from-indigo-500 to-purple-600">
      <div className="bg-white rounded-2xl p-12 max-w-2xl w-full shadow-2xl">
        <h1 className="text-3xl font-bold mb-4 text-center text-gray-900">
          Choose Your Program
        </h1>
        
        <p className="text-center text-gray-600 mb-8">
          Select the training program that fits your schedule
        </p>

        <div className="flex flex-col gap-6">
          <button
            onClick={() => handleSelect('5-day')}
            disabled={saving}
            className={`p-8 text-xl font-semibold rounded-xl border-2 transition-all ${
              selectedProgram === '5-day'
                ? 'border-blue-600 bg-gradient-to-br from-blue-600 to-blue-700 text-white'
                : 'border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-300'
            } ${saving && selectedProgram !== '5-day' ? 'opacity-50' : ''} ${
              saving ? 'cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            5-Day Program
            <div className="text-sm font-normal mt-2 opacity-90">
              5 days per week
            </div>
          </button>

          <button
            onClick={() => handleSelect('3-day')}
            disabled={saving}
            className={`p-8 text-xl font-semibold rounded-xl border-2 transition-all ${
              selectedProgram === '3-day'
                ? 'border-blue-600 bg-gradient-to-br from-blue-600 to-blue-700 text-white'
                : 'border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-300'
            } ${saving && selectedProgram !== '3-day' ? 'opacity-50' : ''} ${
              saving ? 'cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            3-Day Program
            <div className="text-sm font-normal mt-2 opacity-90">
              3 days per week
            </div>
          </button>
        </div>

        {saving && (
          <p className="text-center mt-6 text-gray-600 text-sm">
            Saving your selection...
          </p>
        )}
      </div>
    </div>
  )
}

