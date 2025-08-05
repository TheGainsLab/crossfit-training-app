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
  }, [selectedBlock, skillsData, strengthData]);

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
      const [skillsRes, strengthRes] = await Promise.allSettled([
        fetch(`/api/analytics/${userId}/skills-analytics`),
        fetch(`/api/analytics/${userId}/strength-tracker`)
      ]);

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

  const updateAvailableExercises = () => {
    let exercises: string[] = [];

    if (selectedBlock === 'SKILLS' || selectedBlock === 'TECHNICAL WORK') {
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
    } else if (selectedBlock === 'METCONS') {
      // For MetCons, we'll use common MetCon exercises
      exercises = [
        'Double Unders', 'Thrusters', 'Pull-ups', 'Burpees', 'Box Jumps',
        'Wall Balls', 'Rowing', 'Running', 'Kettlebell Swings'
      ];
    } else if (selectedBlock === 'ACCESSORIES') {
      // Common accessory exercises
      exercises = [
        'Ring Rows', 'Weighted Pull Ups', 'Dumbbell Press', 'Lateral Raises'
      ];
    }

    setAvailableExercises(exercises);
    setSelectedExercise(''); // Reset exercise selection
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

    const { exerciseInfo, summary, trends, charts, insights, recommendations } = exerciseData.data;

    // Prepare trend chart data
    const trendChartData = charts?.trendsChart || {
      labels: [],
      datasets: []
    };

    const volumeChartData = charts?.volumeChart || {
      labels: [],
      datasets: []
    };

    return (
      <div className="space-y-6">
        {/* Exercise Summary */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">{exerciseInfo.name}</h2>
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              {exerciseInfo.block}
            </span>
          </div>
          
          <div className="grid md:grid-cols-4 gap-4">
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
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{summary.daysSinceLast}</div>
              <div className="text-sm text-gray-600">Days Since Last</div>
            </div>
          </div>
        </div>

        {/* Charts */}
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

        {/* Trends Analysis */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Progression Analysis</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-3">RPE Trend</h4>
              <div className="flex items-center space-x-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  trends.rpe.direction === 'improving' ? 'bg-green-100 text-green-800' :
                  trends.rpe.direction === 'declining' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {trends.rpe.direction}
                </span>
                <span className="text-gray-600">
                  Current: {trends.rpe.current} | Best: {trends.rpe.best}
                </span>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Quality Trend</h4>
              <div className="flex items-center space-x-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  trends.quality.direction === 'improving' ? 'bg-green-100 text-green-800' :
                  trends.quality.direction === 'declining' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {trends.quality.direction}
                </span>
                <span className="text-gray-600">
                  Current: {trends.quality.current} | Best: {trends.quality.best}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Insights & Recommendations */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🧠 AI Insights</h3>
            <div className="space-y-3">
              {insights.map((insight: string, index: number) => (
                <div key={index} className="flex items-start space-x-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span className="text-sm text-gray-700">{insight}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">💡 Recommendations</h3>
            <div className="space-y-3">
              {recommendations.map((rec: any, index: number) => (
                <div key={index} className="flex items-start space-x-3">
                  <span className="text-lg">{rec.icon}</span>
                  <div>
                    <div className={`text-xs font-medium mb-1 ${
                      rec.priority === 'high' ? 'text-red-600' :
                      rec.priority === 'medium' ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>
                      {rec.priority.toUpperCase()} PRIORITY
                    </div>
                    <div className="text-sm text-gray-700">{rec.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
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
      {/* Header */}
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Selection Controls */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Exercise to Analyze</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Block Selector */}
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

            {/* Exercise Selector */}
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

        {/* Analytics Content */}
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
