'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { GeneratedWorkout, UserProfile } from '@/lib/btn/types';
import { getAvailableExercises } from '@/lib/btn/utils';
import Footer from '../components/Footer';

interface SubscriptionStatus {
  hasAccess: boolean
  subscriptionData?: {
    status: string
    plan: string
    current_period_end: string
  }
}

function BTNWorkoutGenerator() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [generatedWorkouts, setGeneratedWorkouts] = useState<GeneratedWorkout[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [savedWorkouts, setSavedWorkouts] = useState<Set<number>>(new Set());
  const [savingWorkouts, setSavingWorkouts] = useState<Set<number>>(new Set());
  const [autoSaving, setAutoSaving] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [barbellFilter, setBarbellFilter] = useState<'any' | 'required' | 'excluded'>('any');
  const [dumbbellFilter, setDumbbellFilter] = useState<'any' | 'required' | 'excluded'>('any');
  const [cardioFilter, setCardioFilter] = useState<'any' | 'rower' | 'bike' | 'ski' | 'none'>('any');
  const [exerciseCount, setExerciseCount] = useState<'any' | '2' | '3'>('any');
  const [workoutFormat, setWorkoutFormat] = useState<'any' | 'for_time' | 'amrap' | 'rounds_for_time'>('any');
  const [includeExercises, setIncludeExercises] = useState<string[]>([]);
  const [excludeExercises, setExcludeExercises] = useState<string[]>([]);
  const [includeSearch, setIncludeSearch] = useState('');
  const [excludeSearch, setExcludeSearch] = useState('');
  const [showIncludeDropdown, setShowIncludeDropdown] = useState(false);
  const [showExcludeDropdown, setShowExcludeDropdown] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [availableExercises, setAvailableExercises] = useState<string[]>([]);

  const timeDomains = [
    '1:00 - 5:00',
    '5:00 - 10:00',
    '10:00 - 15:00',
    '15:00 - 20:00',
    '20:00+'
  ];

  // Fetch user profile
  const fetchUserProfile = async () => {
    try {
      console.log('📊 Fetching user profile...');
      const response = await fetch('/api/btn/user-profile');
      
      if (!response.ok) {
        console.warn('⚠️ Failed to fetch user profile, using defaults');
        setProfileLoading(false);
        return;
      }
      
      const data = await response.json();
      if (data.success && data.profile) {
        setUserProfile(data.profile);
        console.log('✅ User profile loaded:', {
          equipment: data.profile.equipment.length,
          skills: Object.keys(data.profile.skills).length,
          oneRMs: Object.keys(data.profile.oneRMs).length
        });
      }
    } catch (error) {
      console.error('❌ Error fetching user profile:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  // Fetch user profile on mount and when URL has refresh parameter
  useEffect(() => {
    fetchUserProfile();
  }, []);

  // Fetch available exercises for include/exclude dropdowns
  useEffect(() => {
    const loadExercises = async () => {
      try {
        const exercises = await getAvailableExercises();
        setAvailableExercises(exercises);
      } catch (error) {
        console.error('Failed to load exercises:', error);
      }
    };
    loadExercises();
  }, []);

  // Handle profile refresh from URL parameter
  useEffect(() => {
    if (searchParams.get('refreshed') === 'true') {
      console.log('🔄 Profile was updated, refreshing...');
      fetchUserProfile();
      // Clean URL by removing the query parameter
      router.replace('/btn', { scroll: false });
    }
  }, [searchParams, router]);

  const toggleDomain = (domain: string) => {
    setSelectedDomains(prev =>
      prev.includes(domain)
        ? prev.filter(d => d !== domain)
        : [...prev, domain]
    );
  };

  // Check if a time domain is disabled due to format conflict
  const isTimeDomainDisabled = (domain: string) => {
    // AMRAP requires 6+ min, so 1-5 min domain is incompatible
    return workoutFormat === 'amrap' && domain === '1:00 - 5:00';
  };

  // Handle format selection with conflict resolution
  const handleFormatChange = (format: 'any' | 'for_time' | 'amrap' | 'rounds_for_time') => {
    setWorkoutFormat(format);
    // If selecting AMRAP, remove 1-5 min domain from selection
    if (format === 'amrap') {
      setSelectedDomains(prev => prev.filter(d => d !== '1:00 - 5:00'));
    }
  };

  const generateWorkouts = async () => {
    setIsGenerating(true);
    try {
      console.log('🎲 Generating workouts via API...');
      console.log('Selected domains:', selectedDomains.length > 0 ? selectedDomains : 'all (random)');
      console.log('Barbell filter:', barbellFilter);
      console.log('Dumbbell filter:', dumbbellFilter);
      console.log('Cardio filter:', cardioFilter);

      const response = await fetch('/api/btn/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedDomains: selectedDomains.length > 0 ? selectedDomains : undefined,
          barbellFilter,
          dumbbellFilter,
          cardioFilter,
          exerciseCount,
          workoutFormat,
          includeExercises: includeExercises.length > 0 ? includeExercises : undefined,
          excludeExercises: excludeExercises.length > 0 ? excludeExercises : undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate workouts');
      }

      const data = await response.json();
      const workouts = data.workouts as GeneratedWorkout[];

      setGeneratedWorkouts(workouts);
      setSavedWorkouts(new Set());
      console.log(`✅ Generated ${workouts.length} workouts`);

      // Auto-save to database
      setAutoSaving(true);
      try {
        const saveResponse = await fetch('/api/btn/save-workouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workouts })
        });

        if (saveResponse.ok) {
          const saveData = await saveResponse.json();
          console.log(`✅ Auto-saved ${saveData.savedCount} workouts to database`);
          setSavedWorkouts(new Set(workouts.map((_, i) => i)));
        } else {
          const errData = await saveResponse.json();
          console.warn('⚠️ Auto-save failed:', errData.error);
        }
      } catch (saveError) {
        console.warn('⚠️ Auto-save error:', saveError);
      } finally {
        setAutoSaving(false);
      }
    } catch (error) {
      console.error('❌ Generation failed:', error);
      alert('Failed to generate workouts. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveWorkout = async (workout: GeneratedWorkout, index: number) => {
    setSavingWorkouts(prev => new Set(prev).add(index));
    
    try {
      const response = await fetch('/api/btn/save-workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workouts: [workout] })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save workout');
      }

      // Mark as saved
      setSavedWorkouts(prev => new Set(prev).add(index));
    } catch (error: any) {
      console.error('❌ Save failed:', error);
      alert(`Failed to save workout: ${error.message}`);
    } finally {
      setSavingWorkouts(prev => {
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    }
  };

  const discardWorkout = (index: number) => {
    setGeneratedWorkouts(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-5">

        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-2">BTN Workout Generator</h1>
          <p className="text-gray-600">Build a personalized workout library</p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-8 mb-8">
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Select Time Domains:</h3>
            <div className="flex flex-wrap gap-2">
              {timeDomains.map((domain) => {
                const disabled = isTimeDomainDisabled(domain);
                return (
                  <button
                    key={domain}
                    onClick={() => !disabled && toggleDomain(domain)}
                    disabled={disabled}
                    title={disabled ? 'AMRAP workouts require 6+ minutes' : undefined}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      disabled
                        ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                        : selectedDomains.includes(domain)
                        ? 'border-[#FE5858] bg-red-50 text-[#FE5858]'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {domain}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {selectedDomains.length === 0
                ? 'No domains selected - will generate 5 random workouts'
                : selectedDomains.length === 1
                ? `Will generate 5 workouts from the selected domain`
                : selectedDomains.length >= 5
                ? `Will generate 1 workout from each selected domain`
                : `Will generate 5 workouts from the selected domains`
              }
            </p>
          </div>
          
          {/* Dividing line */}
          <div className="my-6 border-t border-gray-300"></div>
          
          {/* Equipment Filter Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Equipment:</h3>

            {/* Barbell */}
            <div className="mb-3">
              <label className="text-sm font-medium text-gray-700 mr-3">Barbell:</label>
              <div className="inline-flex gap-1">
                {(['any', 'required', 'excluded'] as const).map(option => (
                  <button
                    key={option}
                    onClick={() => {
                      setBarbellFilter(option);
                      // Barbell + Dumbbell can't both be required (equipment consistency)
                      if (option === 'required' && dumbbellFilter === 'required') {
                        setDumbbellFilter('any');
                      }
                    }}
                    className={`px-3 py-1 rounded-lg border-2 text-sm font-medium transition-all ${
                      barbellFilter === option
                        ? 'border-[#FE5858] bg-red-50 text-[#FE5858]'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {option === 'any' ? 'Any' : option === 'required' ? 'Required' : 'Excluded'}
                  </button>
                ))}
              </div>
            </div>

            {/* Dumbbell */}
            <div className="mb-3">
              <label className="text-sm font-medium text-gray-700 mr-3">Dumbbell:</label>
              <div className="inline-flex gap-1">
                {(['any', 'required', 'excluded'] as const).map(option => (
                  <button
                    key={option}
                    onClick={() => {
                      setDumbbellFilter(option);
                      // Barbell + Dumbbell can't both be required (equipment consistency)
                      if (option === 'required' && barbellFilter === 'required') {
                        setBarbellFilter('any');
                      }
                    }}
                    className={`px-3 py-1 rounded-lg border-2 text-sm font-medium transition-all ${
                      dumbbellFilter === option
                        ? 'border-[#FE5858] bg-red-50 text-[#FE5858]'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {option === 'any' ? 'Any' : option === 'required' ? 'Required' : 'Excluded'}
                  </button>
                ))}
              </div>
            </div>

            {/* Cardio */}
            <div>
              <label className="text-sm font-medium text-gray-700 mr-3">Cardio:</label>
              <div className="inline-flex gap-1">
                {(['any', 'rower', 'bike', 'ski', 'none'] as const).map(option => (
                  <button
                    key={option}
                    onClick={() => setCardioFilter(option)}
                    className={`px-3 py-1 rounded-lg border-2 text-sm font-medium transition-all ${
                      cardioFilter === option
                        ? 'border-[#FE5858] bg-red-50 text-[#FE5858]'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {option === 'any' ? 'Any' :
                     option === 'rower' ? 'Rower' :
                     option === 'bike' ? 'Bike' :
                     option === 'ski' ? 'Ski' : 'None'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Exercise Count Filter */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Number of Exercises:</h3>
            <div className="flex flex-wrap gap-2">
              {(['any', '2', '3'] as const).map(count => (
                <button
                  key={count}
                  onClick={() => setExerciseCount(count)}
                  className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    exerciseCount === count
                      ? 'border-[#FE5858] bg-red-50 text-[#FE5858]'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {count === 'any' ? 'Any' :
                   count === '2' ? 'Couplet (2)' :
                   'Triplet (3)'}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {exerciseCount === 'any'
                ? 'Workouts may have 2-4 exercises based on time domain'
                : exerciseCount === '2'
                ? 'All workouts will have exactly 2 exercises'
                : 'All workouts will have exactly 3 exercises'
              }
            </p>
          </div>

          {/* Workout Format Filter */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Workout Format:</h3>
            <div className="flex flex-wrap gap-2">
              {(['any', 'for_time', 'amrap', 'rounds_for_time'] as const).map(format => (
                <button
                  key={format}
                  onClick={() => handleFormatChange(format)}
                  className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    workoutFormat === format
                      ? 'border-[#FE5858] bg-red-50 text-[#FE5858]'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {format === 'any' ? 'Any' :
                   format === 'for_time' ? 'For Time' :
                   format === 'amrap' ? 'AMRAP' :
                   'Rounds For Time'}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {workoutFormat === 'any'
                ? 'Workouts may be any format (For Time, AMRAP, or Rounds For Time)'
                : workoutFormat === 'for_time'
                ? 'All workouts will be For Time with rep schemes (21-15-9, etc.)'
                : workoutFormat === 'amrap'
                ? 'All workouts will be AMRAPs (requires 6+ minute time domain)'
                : 'All workouts will be Rounds For Time'
              }
            </p>
          </div>

          {/* Include/Exclude Exercises */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Customize Exercises:</h3>
            <p className="text-xs text-gray-500 mb-3 italic">Custom selections override equipment filters above</p>

            {/* Must Include */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Must Include:</label>
              <div className="relative">
                <input
                  type="text"
                  value={includeSearch}
                  onChange={(e) => {
                    setIncludeSearch(e.target.value);
                    setShowIncludeDropdown(true);
                  }}
                  onFocus={() => setShowIncludeDropdown(true)}
                  onBlur={() => setTimeout(() => setShowIncludeDropdown(false), 200)}
                  placeholder="Search exercises to include..."
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-[#FE5858] focus:outline-none"
                />
                {showIncludeDropdown && includeSearch && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {availableExercises
                      .filter(ex =>
                        ex.toLowerCase().includes(includeSearch.toLowerCase()) &&
                        !includeExercises.includes(ex) &&
                        !excludeExercises.includes(ex)
                      )
                      .slice(0, 10)
                      .map(exercise => (
                        <button
                          key={exercise}
                          onClick={() => {
                            setIncludeExercises(prev => [...prev, exercise]);
                            setIncludeSearch('');
                            setShowIncludeDropdown(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100"
                        >
                          {exercise}
                        </button>
                      ))
                    }
                    {availableExercises.filter(ex =>
                      ex.toLowerCase().includes(includeSearch.toLowerCase()) &&
                      !includeExercises.includes(ex) &&
                      !excludeExercises.includes(ex)
                    ).length === 0 && (
                      <div className="px-4 py-2 text-sm text-gray-500">No matching exercises</div>
                    )}
                  </div>
                )}
              </div>
              {includeExercises.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {includeExercises.map(exercise => (
                    <span
                      key={exercise}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full"
                    >
                      {exercise}
                      <button
                        onClick={() => setIncludeExercises(prev => prev.filter(e => e !== exercise))}
                        className="hover:text-green-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Exclude */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Exclude:</label>
              <div className="relative">
                <input
                  type="text"
                  value={excludeSearch}
                  onChange={(e) => {
                    setExcludeSearch(e.target.value);
                    setShowExcludeDropdown(true);
                  }}
                  onFocus={() => setShowExcludeDropdown(true)}
                  onBlur={() => setTimeout(() => setShowExcludeDropdown(false), 200)}
                  placeholder="Search exercises to exclude..."
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-[#FE5858] focus:outline-none"
                />
                {showExcludeDropdown && excludeSearch && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {availableExercises
                      .filter(ex =>
                        ex.toLowerCase().includes(excludeSearch.toLowerCase()) &&
                        !excludeExercises.includes(ex) &&
                        !includeExercises.includes(ex)
                      )
                      .slice(0, 10)
                      .map(exercise => (
                        <button
                          key={exercise}
                          onClick={() => {
                            setExcludeExercises(prev => [...prev, exercise]);
                            setExcludeSearch('');
                            setShowExcludeDropdown(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100"
                        >
                          {exercise}
                        </button>
                      ))
                    }
                    {availableExercises.filter(ex =>
                      ex.toLowerCase().includes(excludeSearch.toLowerCase()) &&
                      !excludeExercises.includes(ex) &&
                      !includeExercises.includes(ex)
                    ).length === 0 && (
                      <div className="px-4 py-2 text-sm text-gray-500">No matching exercises</div>
                    )}
                  </div>
                )}
              </div>
              {excludeExercises.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {excludeExercises.map(exercise => (
                    <span
                      key={exercise}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 text-sm rounded-full"
                    >
                      {exercise}
                      <button
                        onClick={() => setExcludeExercises(prev => prev.filter(e => e !== exercise))}
                        className="hover:text-red-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            className="w-full py-3 px-6 bg-[#FE5858] text-white rounded-lg text-lg font-semibold hover:bg-[#ff6b6b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={generateWorkouts}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating Workouts...' : 'Generate 5 Workouts'}
          </button>

          {generatedWorkouts.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xl font-bold mb-4">Generated Workouts ({generatedWorkouts.length})</h3>
              <div className="space-y-6">
                {generatedWorkouts.map((workout, index) => (
                  <div key={index} className="border rounded-lg p-6" style={{ backgroundColor: '#F8FBFE' }}>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-lg font-bold">{workout.name}</h4>
                      <div className="flex gap-2">
                        {autoSaving ? (
                          <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: '#DAE2EA', color: '#282B34' }}>
                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Saving...
                          </div>
                        ) : savedWorkouts.has(index) ? (
                          <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: '#FE5858', color: '#FFFFFF' }}>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Saved
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => saveWorkout(workout, index)}
                              disabled={savingWorkouts.has(index)}
                              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{ backgroundColor: '#FE5858', color: '#F8FBFE' }}
                            >
                              {savingWorkouts.has(index) ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => discardWorkout(index)}
                              disabled={savingWorkouts.has(index)}
                              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{ backgroundColor: '#DAE2EA', color: '#282B34' }}
                            >
                              Discard
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-4 mb-4 text-sm text-gray-600">
                      <div>
                        <span className="font-semibold">Time Domain:</span> {workout.timeDomain}
                      </div>
                    </div>
                    
                    <div className="rounded p-4 mb-4 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#282B34' }}>
                      <p className="font-semibold mb-2">
                        {workout.format === 'Rounds For Time' && workout.rounds
                          ? `${workout.rounds} Rounds For Time`
                          : workout.format === 'AMRAP' && workout.amrapTime
                          ? `AMRAP ${workout.amrapTime} minutes`
                          : `${workout.format}${workout.pattern ? `: ${workout.pattern}` : ''}`}
                      </p>
                      {workout.exercises.map((exercise, exIndex) => (
                        <div key={exIndex} className="flex justify-between py-1">
                          <span>
                            {workout.format === 'For Time' && workout.pattern
                              ? exercise.name
                              : `${exercise.reps} ${exercise.name}`}
                          </span>
                          {exercise.weight && <span className="text-[#FE5858] font-medium">{exercise.weight}</span>}
                        </div>
                      ))}
                    </div>
                    
                    {/* Benchmark Scores */}
                    {workout.medianScore && workout.excellentScore && (
                      <div className="mb-4 p-3 border rounded-lg" style={{ backgroundColor: '#FFFFFF' }}>
                        <div className="text-sm font-semibold mb-2 text-center" style={{ color: '#FE5858' }}>Performance Benchmarks</div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-600">50th Percentile (Median):</span>
                            <span className="ml-2 font-semibold" style={{ color: '#FE5858' }}>{workout.medianScore}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">90th Percentile (Excellent):</span>
                            <span className="ml-2 font-semibold" style={{ color: '#FE5858' }}>{workout.excellentScore}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BTNPage() {
  const [loading, setLoading] = useState(true)
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({ hasAccess: false })
  const [checkingOut, setCheckingOut] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    checkAccess()
  }, [])

  const checkAccess = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      setUser(user)

      if (!user) {
        setLoading(false)
        return
      }

      // Check BTN subscription access
      const response = await fetch('/api/btn/check-access')
      const data = await response.json()
      
      setSubscriptionStatus(data)
    } catch (error) {
      console.error('Error checking access:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubscribe = async () => {
    try {
      setCheckingOut(true)
      
      console.log('🔄 Creating checkout session...')
      
      // Create checkout session (works for both logged in and logged out users)
      const response = await fetch('/api/btn/create-checkout', {
        method: 'POST',
      })

      const data = await response.json()
      
      console.log('📦 Checkout response:', data)

      if (data.url) {
        console.log('✅ Redirecting to checkout:', data.url)
        window.location.href = data.url
      } else {
        const errorMsg = data.error || 'Error creating checkout session. Please try again.'
        console.error('❌ Checkout error:', errorMsg, data)
        alert(errorMsg)
        setCheckingOut(false)
      }
    } catch (error) {
      console.error('❌ Error creating checkout:', error)
      alert('Error creating checkout session. Please check the console and try again.')
      setCheckingOut(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FE5858] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // User is not logged in - show them the paywall so they can subscribe
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-6">
            <Link href="/" className="inline-flex items-center text-[#FE5858] hover:text-[#ff6b6b] font-medium transition-colors">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Home
            </Link>
          </div>

          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              BTN: BETTER THAN NOTHING — PERSONALIZED TRAINING, POWERFUL ANALYTICS
            </h1>
            <p className="text-lg md:text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed">
              Confused by endless programs and cookie-cutter templates?
            </p>
            <p className="text-lg md:text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed mt-4">
              BTN gives you personalized training, deep analytics, and a full nutrition log—at a fraction of what most group programs cost.
            </p>
            <p className="text-lg md:text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed mt-4 font-semibold">
              It's strength. It's conditioning. It's data.
            </p>
            <p className="text-lg md:text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed mt-2 font-semibold">
              And it's built entirely around you.
            </p>
          </div>

          {/* How BTN Works Section */}
          <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
              HOW BTN WORKS: SIMPLE, PERSONAL, POWERFUL
            </h2>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">
              When you join, you enter just a few key details—your lifts, skills, and available equipment.
            </p>
            <p className="text-lg text-gray-700 mb-8 leading-relaxed font-semibold">
              BTN's Workout Generator instantly creates personalized workouts based on your exact profile.
            </p>

            <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Build Your Personal Training Library</h3>
            <ul className="space-y-4 max-w-3xl mx-auto mb-8">
              <li className="flex items-start">
                <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-lg text-gray-700">Pick the workouts you like</span>
              </li>
              <li className="flex items-start">
                <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-lg text-gray-700">Save up to 20 at a time</span>
              </li>
              <li className="flex items-start">
                <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-lg text-gray-700">Complete them, then generate more anytime</span>
              </li>
            </ul>

            <p className="text-lg text-gray-700 mb-6 leading-relaxed font-semibold text-center">
              Every workout is perfectly matched to your strength, skill level, and preferences.
            </p>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed text-center">
              No scaling. No substitutions. No guessing.
            </p>

            <div className="bg-gray-50 rounded-lg p-6 max-w-3xl mx-auto">
              <p className="text-lg text-gray-700 mb-4 leading-relaxed">
                Each session includes:
              </p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-lg text-gray-700"><strong>A precise target</strong></span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-lg text-gray-700"><strong>A stretch goal</strong> for athletes who want an extra push</span>
                </li>
              </ul>
              <p className="text-lg text-gray-700 mt-4 leading-relaxed">
                So beginners, intermediates, and advanced athletes all have something to aim for.
              </p>
            </div>
          </div>

          {/* Fitness Matrix Section */}
          <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
              THE FITNESS MATRIX: YOUR PERFORMANCE, DECODED
            </h2>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">
              BTN includes our proprietary Fitness Matrix—the most advanced performance evaluation tool in the industry.
            </p>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">
              Every time you complete and save a BTN workout, the app:
            </p>
            <ul className="space-y-4 max-w-3xl mx-auto mb-8">
              <li className="flex items-start">
                <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-lg text-gray-700">Calculates your percentile score against our global database</span>
              </li>
              <li className="flex items-start">
                <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-lg text-gray-700">Adds your results to the Fitness Matrix at the task level</span>
              </li>
              <li className="flex items-start">
                <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-lg text-gray-700">Expands a detailed, high-definition map of your fitness across every domain</span>
              </li>
            </ul>

            <p className="text-lg text-gray-700 mb-6 leading-relaxed font-semibold text-center">
              You'll see your abilities in a level of detail no other app offers:
            </p>

            <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Analyze Every Angle of Your Fitness</h3>
            <ul className="space-y-4 max-w-3xl mx-auto mb-6">
              <li className="flex items-start">
                <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-lg text-gray-700">Compare your barbell workouts vs. non-barbell workouts</span>
              </li>
              <li className="flex items-start">
                <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-lg text-gray-700">See your performance on any task across all time domains</span>
              </li>
              <li className="flex items-start">
                <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-lg text-gray-700">Filter by equipment, pacing style, time domain, and movement type</span>
              </li>
              <li className="flex items-start">
                <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-lg text-gray-700">Reveal strengths you never noticed—and weaknesses you can immediately address</span>
              </li>
            </ul>
            <p className="text-lg text-gray-700 leading-relaxed font-semibold text-center">
              This is the most objective, quantifiable view of your fitness you've ever had.
            </p>
          </div>

          {/* Turn Insights Section */}
          <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
              TURN INSIGHTS INTO BETTER TRAINING
            </h2>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed text-center">
              The Fitness Matrix doesn't just look cool—it makes you better.
            </p>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">
              Use your data to:
            </p>
            <ul className="space-y-4 max-w-3xl mx-auto mb-6">
              <li className="flex items-start">
                <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-lg text-gray-700">Identify weaknesses with surgical precision</span>
              </li>
              <li className="flex items-start">
                <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-lg text-gray-700">Preserve and enhance your strengths</span>
              </li>
              <li className="flex items-start">
                <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-lg text-gray-700">Choose the next set of generated workouts with confidence</span>
              </li>
              <li className="flex items-start">
                <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-lg text-gray-700">Build a smarter, more targeted training plan without paying for coaching</span>
              </li>
            </ul>
            <p className="text-lg text-gray-700 leading-relaxed font-semibold text-center">
              BTN helps you stop wasting time and start training with purpose.
            </p>
          </div>

          {/* CTA Section */}
          <div className="text-center bg-gradient-to-br from-[#FE5858] to-[#ff6b6b] rounded-xl shadow-lg p-8 md:p-12 text-white">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              BETTER THAN NOTHING? TRY BETTER THAN EVERYTHING.
            </h2>
            <p className="text-lg md:text-xl mb-8 leading-relaxed">
              We call it BTN — Better Than Nothing,
            </p>
            <p className="text-lg md:text-xl mb-8 leading-relaxed">
              but once you experience personalized workouts and the power of the Fitness Matrix…
            </p>
            <p className="text-lg md:text-xl mb-8 leading-relaxed font-semibold">
              you'll realize it's better than almost every program out there.
            </p>
            <button
              onClick={handleSubscribe}
              disabled={checkingOut}
              className="inline-block px-10 py-5 bg-white text-[#FE5858] rounded-lg text-xl font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {checkingOut ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-[#FE5858]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                'Subscribe Now'
              )}
            </button>
            <p className="text-sm text-white/90 mt-4">
              Secure payment powered by Stripe • Create account during checkout
            </p>
          </div>
        </div>
      </div>
    )
  }

  // User has access - show the BTN generator
  if (subscriptionStatus.hasAccess) {
    return <BTNWorkoutGenerator />
  }

  // User does not have access - show paywall
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-[#FE5858] hover:text-[#ff6b6b] font-medium transition-colors">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>
        </div>

        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            BTN: BETTER THAN NOTHING — PERSONALIZED TRAINING, POWERFUL ANALYTICS
          </h1>
          <p className="text-lg md:text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed">
            Confused by endless programs and cookie-cutter templates?
          </p>
          <p className="text-lg md:text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed mt-4">
            BTN gives you personalized training, deep analytics, and a full nutrition log—at a fraction of what most group programs cost.
          </p>
          <p className="text-lg md:text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed mt-4 font-semibold">
            It's strength. It's conditioning. It's data.
          </p>
          <p className="text-lg md:text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed mt-2 font-semibold">
            And it's built entirely around you.
          </p>
        </div>

        {/* How BTN Works Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            HOW BTN WORKS: SIMPLE, PERSONAL, POWERFUL
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            When you join, you enter just a few key details—your lifts, skills, and available equipment.
          </p>
          <p className="text-lg text-gray-700 mb-8 leading-relaxed font-semibold">
            BTN's Workout Generator instantly creates personalized workouts based on your exact profile.
          </p>

          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Build Your Personal Training Library</h3>
          <ul className="space-y-4 max-w-3xl mx-auto mb-8">
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700">Pick the workouts you like</span>
            </li>
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700">Save up to 20 at a time</span>
            </li>
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700">Complete them, then generate more anytime</span>
            </li>
          </ul>

          <p className="text-lg text-gray-700 mb-6 leading-relaxed font-semibold text-center">
            Every workout is perfectly matched to your strength, skill level, and preferences.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed text-center">
            No scaling. No substitutions. No guessing.
          </p>

          <div className="bg-gray-50 rounded-lg p-6 max-w-3xl mx-auto">
            <p className="text-lg text-gray-700 mb-4 leading-relaxed">
              Each session includes:
            </p>
            <ul className="space-y-3">
              <li className="flex items-start">
                <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-lg text-gray-700"><strong>A precise target</strong></span>
              </li>
              <li className="flex items-start">
                <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-lg text-gray-700"><strong>A stretch goal</strong> for athletes who want an extra push</span>
              </li>
            </ul>
            <p className="text-lg text-gray-700 mt-4 leading-relaxed">
              So beginners, intermediates, and advanced athletes all have something to aim for.
            </p>
          </div>
        </div>

        {/* Fitness Matrix Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            THE FITNESS MATRIX: YOUR PERFORMANCE, DECODED
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            BTN includes our proprietary Fitness Matrix—the most advanced performance evaluation tool in the industry.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Every time you complete and save a BTN workout, the app:
          </p>
          <ul className="space-y-4 max-w-3xl mx-auto mb-8">
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700">Calculates your percentile score against our global database</span>
            </li>
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700">Adds your results to the Fitness Matrix at the task level</span>
            </li>
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700">Expands a detailed, high-definition map of your fitness across every domain</span>
            </li>
          </ul>

          <p className="text-lg text-gray-700 mb-6 leading-relaxed font-semibold text-center">
            You'll see your abilities in a level of detail no other app offers:
          </p>

          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Analyze Every Angle of Your Fitness</h3>
          <ul className="space-y-4 max-w-3xl mx-auto mb-6">
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700">Compare your barbell workouts vs. non-barbell workouts</span>
            </li>
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700">See your performance on any task across all time domains</span>
            </li>
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700">Filter by equipment, pacing style, time domain, and movement type</span>
            </li>
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700">Reveal strengths you never noticed—and weaknesses you can immediately address</span>
            </li>
          </ul>
          <p className="text-lg text-gray-700 leading-relaxed font-semibold text-center">
            This is the most objective, quantifiable view of your fitness you've ever had.
          </p>
        </div>

        {/* Turn Insights Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            TURN INSIGHTS INTO BETTER TRAINING
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed text-center">
            The Fitness Matrix doesn't just look cool—it makes you better.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Use your data to:
          </p>
          <ul className="space-y-4 max-w-3xl mx-auto mb-6">
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700">Identify weaknesses with surgical precision</span>
            </li>
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700">Preserve and enhance your strengths</span>
            </li>
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700">Choose the next set of generated workouts with confidence</span>
            </li>
            <li className="flex items-start">
              <svg className="w-6 h-6 text-[#FE5858] mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg text-gray-700">Build a smarter, more targeted training plan without paying for coaching</span>
            </li>
          </ul>
          <p className="text-lg text-gray-700 leading-relaxed font-semibold text-center">
            BTN helps you stop wasting time and start training with purpose.
          </p>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-gradient-to-br from-[#FE5858] to-[#ff6b6b] rounded-xl shadow-lg p-8 md:p-12 text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            BETTER THAN NOTHING? TRY BETTER THAN EVERYTHING.
          </h2>
          <p className="text-lg md:text-xl mb-4 leading-relaxed">
            We call it BTN — Better Than Nothing,
          </p>
          <p className="text-lg md:text-xl mb-4 leading-relaxed">
            but once you experience personalized workouts and the power of the Fitness Matrix…
          </p>
          <p className="text-lg md:text-xl mb-8 leading-relaxed font-semibold">
            you'll realize it's better than almost every program out there.
          </p>
          <button
            onClick={handleSubscribe}
            disabled={checkingOut}
            className="inline-block px-10 py-5 bg-white text-[#FE5858] rounded-lg text-xl font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {checkingOut ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-[#FE5858]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              'Subscribe Now'
            )}
          </button>
          <p className="text-sm text-white/90 mt-4">
            Secure payment powered by Stripe • Create account during checkout
          </p>
        </div>
      </div>

      <Footer variant="minimal" />
    </div>
  )
}
