'use client'

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function ExerciseDeepDivePage() {
  const [user, setUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection states
  const [selectedBlock, setSelectedBlock] = useState<string>('');
  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [availableExercises, setAvailableExercises] = useState<string[]>([]);

  // Data states
  const [exerciseData, setExerciseData] = useState<any>(null);
  const [skillsData, setSkillsData] = useState<any>(null);
  const [strengthData, setStrengthData] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const blocks = [
    { id: 'SKILLS', name: 'Skills', icon: '🤸' },
    { id: 'TECHNICAL WORK', name: 'Technical Work', icon: '🔧' },
    { id: 'STRENGTH AND POWER', name: 'Strength & Power', icon: '💪' },
    { id: 'ACCESSORIES', name: 'Accessories', icon: '🔨' },
    { id: 'METCONS', name: 'MetCons', icon: '🔥' }
  ];

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (userId) {
      fetchAnalyticsData();
    }
  }, [userId]);

  useEffect(() => {
    if (selectedBlock) {
      updateAvailableExercises();
    }
  }, [selectedBlock, skillsData, strengthData, userId]);

  useEffect(() => {
    if (selectedExercise && selectedBlock && userId) {
      fetchExerciseDeepDive();
    }
  }, [selectedExercise, selectedBlock, userId]);

  const loadUser = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError('Not authenticated');
        return;
      }
      setUser(user);

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single();

      if (userError || !userData) {
        setError('User not found');
        return;
      }
      
      setUserId(userData.id);
    } catch (err) {
      console.error('Error loading user:', err);
      setError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalyticsData = async () => {
    if (!userId) return;
    
    try {
      const [dashboardRes, skillsRes, strengthRes] = await Promise.allSettled([
        fetch(`/api/analytics/${userId}/dashboard`),
        fetch(`/api/analytics/${userId}/skills-analytics`),
        fetch(`/api/analytics/${userId}/strength-tracker`)
      ]);

      if (dashboardRes.status === 'fulfilled' && dashboardRes.value.ok) {
        const data = await dashboardRes.value.json();
        setDashboardData(data);
      }

      if (skillsRes.status === 'fulfilled' && skillsRes.value.ok) {
        const data = await skillsRes.value.json();
        setSkillsData(data);
      }

      if (strengthRes.status === 'fulfilled' && strengthRes.value.ok) {
        const data = await strengthRes.value.json();
        setStrengthData(data);
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    }
  };

  const OverviewSummary = () => {
    if (!dashboardData?.data?.dashboard) {
      return (
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      );
    }

    const { overallMetrics } = dashboardData.data.dashboard;

    return (
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed Tasks</p>
              <p className="text-3xl font-bold text-gray-900">{overallMetrics.totalExercises}</p>
            </div>
            <div className="text-blue-600">📊</div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Average RPE</p>
              <p className="text-3xl font-bold text-gray-900">{overallMetrics.averageRPE}</p>
            </div>
            <div className="text-green-600">💪</div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Training Days</p>
              <p className="text-3xl font-bold text-gray-900">{overallMetrics.totalTrainingDays}</p>
            </div>
            <div className="text-orange-600">⭐</div>
          </div>
        </div>
      </div>
    );
  };

  const updateAvailableExercises = async () => {
    if (!userId || !selectedBlock) return;
    
    let exercises: string[] = [];

    if (selectedBlock === 'SKILLS') {
      if (skillsData?.data?.skillsAnalysis?.skills) {
        exercises = Object.keys(skillsData.data.skillsAnalysis.skills)
          .filter(exerciseName => {
            const exercise = skillsData.data.skillsAnalysis.skills[exerciseName];
            return exercise.block === selectedBlock;
          });
      }
    } else if (selectedBlock === 'STRENGTH AND POWER') {
      if (strengthData?.data?.strengthAnalysis?.movements) {
        exercises = Object.keys(strengthData.data.strengthAnalysis.movements);
      }
    } else {
      try {
        const supabase = createClient();
        const { data: performanceData, error } = await supabase
          .from('performance_logs')
          .select('exercise_name')
          .eq('user_id', userId)
          .eq('block', selectedBlock);

        if (!error && performanceData) {
          const uniqueExercises = [...new Set(performanceData.map(row => row.exercise_name))];
          exercises = uniqueExercises.filter(name => name);
        }
      } catch (error) {
        console.error('Error fetching exercises for block:', selectedBlock, error);
        exercises = [];
      }
    }

    setAvailableExercises(exercises);
    setSelectedExercise('');
  };

  const fetchExerciseDeepDive = async () => {
    if (!userId || !selectedExercise || !selectedBlock) return;
    
    setAnalyticsLoading(true);
    try {
      const response = await fetch(
        `/api/analytics/${userId}/exercise-deep-dive?exercise=${encodeURIComponent(selectedExercise)}&block=${encodeURIComponent(selectedBlock)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setExerciseData(data);
      } else {
        setExerciseData(null);
        console.error('Failed to fetch exercise data');
      }
    } catch (error) {
      console.error('Error fetching exercise deep dive:', error);
      setExerciseData(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const ExerciseAnalytics = () => {
    if (!exerciseData?.data) {
      return (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500">Select a block and exercise to see detailed analytics</p>
        </div>
      );
    }

    const { exerciseInfo, summary, trends, charts } = exerciseData.data;

    const trendChartData = charts?.trendsChart || {
      labels: [],
      datasets: []
    };

    const volumeChartData = charts?.volumeChart || {
      labels: [],
      datasets: []
    };

    const ExerciseComparison = () => {
      const [comparisonExercise, setComparisonExercise] = useState<string>('');
      const [comparisonData, setComparisonData] = useState<any>(null);
      const [loadingComparison, setLoadingComparison] = useState(false);

      const availableForComparison = availableExercises.filter(exercise => exercise !== selectedExercise);

      const fetchComparisonData = async (exercise: string) => {
        if (!userId || !exercise || !selectedBlock) return;
        
        setLoadingComparison(true);
        try {
          const response = await fetch(
            `/api/analytics/${userId}/exercise-deep-dive?exercise=${encodeURIComponent(exercise)}&block=${encodeURIComponent(selectedBlock)}`
          );
          
          if (response.ok) {
            const data = await response.json();
            setComparisonData(data);
          } else {
            setComparisonData(null);
          }
        } catch (error) {
          console.error('Error fetching comparison data:', error);
          setComparisonData(null);
        } finally {
          setLoadingComparison(false);
        }
      };

      const handleComparisonSelect = (exercise: string) => {
        setComparisonExercise(exercise);
        if (exercise) {
          fetchComparisonData(exercise);
        } else {
          setComparisonData(null);
        }
      };

      return (
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">⚖️ Exercise Comparison</h3>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-600">Compare with:</span>
              <select
                value={comparisonExercise}
                onChange={(e) => handleComparisonSelect(e.target.value)}
                disabled={availableForComparison.length === 0}
                className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="">Choose exercise...</option>
                {availableForComparison.map(exercise => (
                  <option key={exercise} value={exercise}>
                    {exercise}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {availableForComparison.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No other exercises available in this block for comparison.</p>
              <p className="text-sm mt-1">Try a different training block with multiple exercises.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6">
              {loadingComparison ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mr-2"></div>
                  <span className="text-gray-600">Loading comparison...</span>
                </div>
              ) : (
                <div>
                  {/* Exercise Names Header */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-2">
                        <span className="text-blue-600 mr-2">📊</span>
                        <h3 className="text-lg font-semibold text-gray-900 truncate">{selectedExercise}</h3>
                      </div>
                      <div className="w-full h-1 bg-blue-500 rounded"></div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-2">
                        <span className="text-green-600 mr-2">🔄</span>
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {comparisonExercise || 'Select Exercise'}
                        </h3>
                      </div>
                      <div className="w-full h-1 bg-green-500 rounded"></div>
                    </div>
                  </div>

                  {exerciseData?.data && (comparisonData?.data || !comparisonExercise) ? (
                    <div className="space-y-4">
                      {/* Sessions Comparison */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <div className="text-sm text-gray-600 text-center mb-3 font-medium">Sessions</div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-3 bg-blue-50 rounded">
                            <div className="text-2xl font-bold text-gray-900">
                              {exerciseData.data.exerciseInfo?.timesPerformed || 0}
                            </div>
                          </div>
                          <div className="text-center p-3 bg-green-50 rounded">
                            <div className="text-2xl font-bold text-gray-900">
                              {comparisonData?.data?.exerciseInfo?.timesPerformed || (comparisonExercise ? '...' : '-')}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Total Reps Comparison */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <div className="text-sm text-gray-600 text-center mb-3 font-medium">Total Reps</div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-3 bg-blue-50 rounded">
                            <div className="text-2xl font-bold text-gray-900">
                              {exerciseData.data.volume?.totalReps || 0}
                            </div>
                          </div>
                          <div className="text-center p-3 bg-green-50 rounded">
                            <div className="text-2xl font-bold text-gray-900">
                              {comparisonData?.data?.volume?.totalReps || (comparisonExercise ? '...' : '-')}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Avg RPE Comparison */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <div className="text-sm text-gray-600 text-center mb-3 font-medium">Average RPE</div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-3 bg-blue-50 rounded">
                            <div className="text-2xl font-bold text-gray-900">
                              {exerciseData.data.summary?.avgRPE || 0}
                            </div>
                          </div>
                          <div className="text-center p-3 bg-green-50 rounded">
                            <div className="text-2xl font-bold text-gray-900">
                              {comparisonData?.data?.summary?.avgRPE || (comparisonExercise ? '...' : '-')}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Quality Comparison */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <div className="text-sm text-gray-600 text-center mb-3 font-medium">Quality Grade</div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-3 bg-blue-50 rounded">
                            <div className="text-2xl font-bold text-gray-900">
                              {exerciseData.data.summary?.avgQualityGrade || 'N/A'}
                            </div>
                          </div>
                          <div className="text-center p-3 bg-green-50 rounded">
                            <div className="text-2xl font-bold text-gray-900">
                              {comparisonData?.data?.summary?.avgQualityGrade || (comparisonExercise ? '...' : '-')}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Recent Activity Comparison */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <div className="text-sm text-gray-600 text-center mb-3 font-medium">Last 4 Weeks</div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-3 bg-blue-50 rounded">
                            <div className="text-xl font-bold text-gray-900">
                              {exerciseData.data.timing?.recentSessions || 0}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">sessions</div>
                          </div>
                          <div className="text-center p-3 bg-green-50 rounded">
                            <div className="text-xl font-bold text-gray-900">
                              {comparisonData?.data?.timing?.recentSessions || (comparisonExercise ? '...' : '-')}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              {comparisonData?.data ? 'sessions' : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      Select an exercise to compare with {selectedExercise}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">{exerciseInfo.name}</h2>
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              {exerciseInfo.block}
            </span>
          </div>
          
          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{exerciseInfo.timesPerformed}</div>
              <div className="text-sm text-gray-600">Sessions</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{summary.avgRPE}</div>
              <div className="text-sm text-gray-600">Avg RPE</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{summary.avgQualityGrade}</div>
              <div className="text-sm text-gray-600">Quality Grade</div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">RPE & Quality Trends</h3>
            <div className="h-64">
              <Line data={trendChartData} options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top' },
                  title: { display: true, text: 'Progress Over Time' }
                },
                scales: {
                  y: { beginAtZero: true, max: 10 },
                  y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    max: 4,
                    grid: { drawOnChartArea: false }
                  }
                }
              }} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Volume Progression</h3>
            <div className="h-64">
              <Bar data={volumeChartData} options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  title: { display: true, text: 'Training Volume' }
                },
                scales: {
                  y: { beginAtZero: true }
                }
              }} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance vs Personal Best</h3>
          <div className="text-gray-700">
            <span className="font-medium">RPE:</span> {trends.rpe.current} (best {trends.rpe.best}) | 
            <span className="font-medium ml-4">Quality:</span> {
              ['', 'D', 'C', 'B', 'A'][trends.quality.current] || 'N/A'
            } (best {
              ['', 'D', 'C', 'B', 'A'][trends.quality.best] || 'N/A'
            })
          </div>
        </div>

        <ExerciseComparison />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading exercise analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Analytics</h2>
          <p className="text-gray-600 mb-4">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Exercise Deep Dive</h1>
              <p className="text-gray-600">Detailed analytics for individual exercises</p>
            </div>
            <a
              href="/dashboard/progress"
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              ← Back to Analytics
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <OverviewSummary />

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Exercise to Analyze</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Training Block
              </label>
              <select
                value={selectedBlock}
                onChange={(e) => setSelectedBlock(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Choose a training block...</option>
                {blocks.map(block => (
                  <option key={block.id} value={block.id}>
                    {block.icon} {block.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Exercise
              </label>
              <select
                value={selectedExercise}
                onChange={(e) => setSelectedExercise(e.target.value)}
                disabled={!selectedBlock || availableExercises.length === 0}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">
                  {!selectedBlock ? 'Select a block first...' : 
                   availableExercises.length === 0 ? 'No exercises available...' :
                   'Choose an exercise...'}
                </option>
                {availableExercises.map(exercise => (
                  <option key={exercise} value={exercise}>
                    {exercise}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedBlock && selectedExercise && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <span className="text-blue-600">📊</span>
                <span className="text-blue-800 font-medium">
                  Analyzing: {selectedExercise} in {blocks.find(b => b.id === selectedBlock)?.name}
                </span>
              </div>
            </div>
          )}
        </div>

        {analyticsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
            <p className="text-gray-600">Loading exercise analytics...</p>
          </div>
        ) : (
          <ExerciseAnalytics />
        )}
      </main>
    </div>
  );
}
