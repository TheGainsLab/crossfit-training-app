'use client'

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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
  Legend,
  RadialLinearScale,
  ArcElement
} from 'chart.js';
import { Line, Bar, Radar, Doughnut } from 'react-chartjs-2';

// Quality grade conversion utilities
function convertQualityToGradeDetailed(numericQuality: number): string {
  if (numericQuality >= 3.7) return 'A'
  if (numericQuality >= 3.3) return 'A-'
  if (numericQuality >= 2.7) return 'B+'
  if (numericQuality >= 2.3) return 'B'
  if (numericQuality >= 1.7) return 'B-'
  if (numericQuality >= 1.3) return 'C+'
  if (numericQuality >= 1.0) return 'C'
  return 'D'
}

function getTrendIcon(trend: string): string {
  switch (trend) {
    case 'improving': return '↗️'
    case 'declining': return '↘️'
    default: return '➡️'
  }
}

function formatLastActive(weeksActive: number): string {
  if (weeksActive === 0) return 'No activity'
  if (weeksActive === 1) return 'This week'
  return `${weeksActive} weeks active`
}

// ADD THE HEAT MAP COMPONENT HERE (right after imports)
const MetConExerciseHeatMap: React.FC<{ data: any }> = ({ data }) => {
  // Get all unique time domains and exercises
  const timeDomains = ['1:00-5:00', '5:00-10:00', '10:00-15:00', '15:00-20:00', '20:00-30:00', '30:00+'];
  const exercises = Object.keys(data.exercises || {});

  // Function to get color based on percentile
  const getHeatMapColor = (percentile: number | null) => {
    if (percentile === null) return 'bg-gray-100 text-gray-400';
    
    if (percentile >= 80) return 'bg-green-600 text-white';
    if (percentile >= 70) return 'bg-green-500 text-white';
    if (percentile >= 60) return 'bg-green-400 text-white';
    if (percentile >= 50) return 'bg-yellow-400 text-black';
    if (percentile >= 40) return 'bg-orange-400 text-white';
    if (percentile >= 30) return 'bg-orange-500 text-white';
    return 'bg-red-500 text-white';
  };

  // Function to get percentile for exercise in time domain
const getPercentile = (exercise: string, timeDomain: string): number | null => {
  const exerciseData = data.exercises[exercise];
  if (!exerciseData) return null;
  
  // Check exact match first
  if (exerciseData[timeDomain]) {
    return exerciseData[timeDomain].avgPercentile;
  }
  
  // Check for similar time domain formats with proper typing
  const normalizedDomain = timeDomain.replace(/:/g, ':').replace(/–/g, '-');
  for (const [key, value] of Object.entries(exerciseData)) {
    const normalizedKey = key.replace(/:/g, ':').replace(/–/g, '-');
    if (normalizedKey === normalizedDomain) {
      return (value as any).avgPercentile;  // ← Fixed with type assertion
    }
  }
  
  return null;
};

const getSessionCount = (exercise: string, timeDomain: string): number => {
  const exerciseData = data.exercises[exercise];
  if (!exerciseData) return 0;
  
  for (const [key, value] of Object.entries(exerciseData)) {
    const normalizedKey = key.replace(/:/g, ':').replace(/–/g, '-');
    const normalizedDomain = timeDomain.replace(/:/g, ':').replace(/–/g, '-');
    if (normalizedKey === normalizedDomain) {
      return (value as any).count;  // ← Fixed with type assertion
    }
  }
  
  return 0;
};


  if (exercises.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🔥 Exercise Performance Heat Map</h3>
        <p className="text-gray-600">Complete more MetCon workouts to see exercise-specific performance data!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        🔥 Exercise Performance Heat Map
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        Performance percentiles for each exercise across different time domains
      </p>
      
      {/* Heat Map Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left p-3 font-medium text-gray-900">Exercise</th>
              {timeDomains.map(domain => (
                <th key={domain} className="text-center p-3 font-medium text-gray-900 min-w-[100px]">
                  {domain}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {exercises.map(exercise => (
              <tr key={exercise} className="border-t">
                <td className="p-3 font-medium text-gray-900 bg-gray-50">
                  {exercise}
                </td>
                {timeDomains.map(domain => {
                  const percentile = getPercentile(exercise, domain);
                  const sessions = getSessionCount(exercise, domain);
                  const colorClass = getHeatMapColor(percentile);
                  
                  return (
                    <td key={domain} className="p-1">
                      <div className={`
                        ${colorClass} 
                        rounded p-3 text-center font-semibold transition-all hover:scale-105 cursor-pointer
                        ${percentile ? 'shadow-sm' : ''}
                      `}>
                        {percentile ? (
                          <div>
                            <div className="text-lg">{percentile}%</div>
                            {sessions > 0 && (
                              <div className="text-xs opacity-75">{sessions} sessions</div>
                            )}
                          </div>
                        ) : (
                          <div className="text-lg">—</div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700">Performance:</span>
          <div className="flex items-center space-x-2">
            <div className="bg-red-500 w-4 h-4 rounded"></div>
            <span className="text-xs text-gray-600">Poor</span>
            <div className="bg-orange-400 w-4 h-4 rounded"></div>
            <span className="text-xs text-gray-600">Below Avg</span>
            <div className="bg-yellow-400 w-4 h-4 rounded"></div>
            <span className="text-xs text-gray-600">Average</span>
            <div className="bg-green-400 w-4 h-4 rounded"></div>
            <span className="text-xs text-gray-600">Good</span>
            <div className="bg-green-600 w-4 h-4 rounded"></div>
            <span className="text-xs text-gray-600">Excellent</span>
          </div>
        </div>
      </div>
    </div>
  );
};



// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function AnalyticsProgressPage() {
  const [user, setUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Analytics data states
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [blockData, setBlockData] = useState<any>(null);
  const [skillsData, setSkillsData] = useState<any>(null);
  const [strengthData, setStrengthData] = useState<any>(null);
  const [metconData, setMetconData] = useState<any>(null);

  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'blocks' | 'skills' | 'strength' | 'metcons'>('overview');

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (userId) {
      fetchAllAnalytics();
    }
  }, [userId]);

  const loadUser = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError('Not authenticated');
        return;
      }
      setUser(user);

      // Get user ID from users table
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

  const fetchAllAnalytics = async () => {
    if (!userId) return;
    
    setAnalyticsLoading(true);
    try {
      console.log('📊 Fetching all analytics for user:', userId);
      
      // Fetch all analytics in parallel
      const [dashboardRes, blockRes, skillsRes, strengthRes, metconRes] = await Promise.allSettled([
        fetch(`/api/analytics/${userId}/dashboard`),
        fetch(`/api/analytics/${userId}/block-analyzer`),
        fetch(`/api/analytics/${userId}/skills-analytics`),
        fetch(`/api/analytics/${userId}/strength-tracker`),
        fetch(`/api/analytics/${userId}/metcon-analyzer`)
      ]);

      // Process Dashboard Data
      if (dashboardRes.status === 'fulfilled' && dashboardRes.value.ok) {
        const data = await dashboardRes.value.json();
        setDashboardData(data);
        console.log('✅ Dashboard data loaded');
      }

      // Process Block Analytics
      if (blockRes.status === 'fulfilled' && blockRes.value.ok) {
        const data = await blockRes.value.json();
        setBlockData(data);
        console.log('✅ Block analytics loaded');
      }

      // Process Skills Analytics  
      if (skillsRes.status === 'fulfilled' && skillsRes.value.ok) {
        const data = await skillsRes.value.json();
        setSkillsData(data);
        console.log('✅ Skills analytics loaded');
      }

      // Process Strength Analytics
      if (strengthRes.status === 'fulfilled' && strengthRes.value.ok) {
        const data = await strengthRes.value.json();
        setStrengthData(data);
        console.log('✅ Strength analytics loaded');
      }

      // Process MetCon Analytics
      if (metconRes.status === 'fulfilled' && metconRes.value.ok) {
        const data = await metconRes.value.json();
        setMetconData(data);
        console.log('✅ MetCon analytics loaded');
      }

    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError('Failed to load analytics data');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Overview Summary Component
  const OverviewSummary = () => {
    if (!dashboardData?.data?.dashboard) {
      return <div>Loading overview data...</div>;
    }

    const { overallMetrics } = dashboardData.data.dashboard;

    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Exercises</p>
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
              <p className="text-sm text-gray-600">Training Consistency</p>
              <p className="text-3xl font-bold text-gray-900">{overallMetrics.consistencyScore}%</p>
            </div>
            <div className="text-purple-600">🎯</div>
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

  // Enhanced Tab Navigation with Prominent Styling
  const TabNavigation = () => (
    <div className="bg-white shadow-lg rounded-xl border border-gray-200 mb-8 p-4">
      <nav className="flex flex-wrap gap-3" role="tablist" aria-label="Analytics Navigation">
        {[
          { id: 'overview', name: 'Overview', icon: '📊' },
          { id: 'blocks', name: 'Training Blocks', icon: '🎯' },
          { id: 'skills', name: 'Skills Progress', icon: '🤸' },
          { id: 'strength', name: 'Strength Analysis', icon: '💪' },
          { id: 'metcons', name: 'Conditioning', icon: '🔥' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`${tab.id}-panel`}
            className={`flex items-center space-x-3 px-6 py-4 rounded-lg font-semibold text-base transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg scale-105 ring-2 ring-blue-500 ring-offset-2'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100 hover:text-gray-900 hover:shadow-md border border-gray-200'
            }`}
          >
            <span className="text-xl">{tab.icon}</span>
            <span className="font-medium">{tab.name}</span>
          </button>
        ))}
      </nav>
    </div>
  );

const BlockAnalyticsView = () => {
  if (!blockData?.data) {
    return <div className="bg-white rounded-lg shadow p-6">Loading block analytics...</div>;
  }

  // Get block summaries from the updated block analyzer
  const blockSummaries = blockData.data.blockSummaries || [];
  
  if (blockSummaries.length === 0) {
    return (
      <div id="blocks-panel" role="tabpanel" aria-labelledby="blocks-tab" className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Training Block Analysis</h3>
        <p className="text-gray-600">No training block data available yet. Complete more exercises to see detailed analytics!</p>
      </div>
    );
  }

  // Calculate totals
  const totalExercises = blockSummaries.reduce((sum: number, block: any) => sum + block.exercisesCompleted, 0);
  const activeBlocks = blockSummaries.filter((block: any) => block.exercisesCompleted > 0).length;

  // Prepare pie chart data
  const pieChartData = {
    labels: blockSummaries.map((block: any) => block.blockName),
    datasets: [{
      data: blockSummaries.map((block: any) => block.exercisesCompleted),
      backgroundColor: [
        '#3B82F6', // Blue - Skills
        '#EF4444', // Red - Technical  
        '#F59E0B', // Orange - Strength
        '#10B981', // Green - Accessories
        '#8B5CF6'  // Purple - MetCons
      ],
      borderColor: [
        '#1D4ED8',
        '#DC2626', 
        '#D97706',
        '#059669',
        '#7C3AED'
      ],
      borderWidth: 2,
      hoverBorderWidth: 3
    }]
  };

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 20,
          usePointStyle: true,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.parsed;
            const block = blockSummaries[context.dataIndex];
            const percentage = block?.percentageOfTotal || 0;
            return `${label}: ${value} exercises (${percentage}%)`;
          }
        }
      }
    }
  };

  // Prepare RPE comparison bar chart
  const rpeChartData = {
    labels: blockSummaries.filter((block: any) => block.avgRPE !== null).map((block: any) => block.blockName),
    datasets: [{
      label: 'Average RPE',
      data: blockSummaries.filter((block: any) => block.avgRPE !== null).map((block: any) => block.avgRPE),
      backgroundColor: 'rgba(59, 130, 246, 0.6)',
      borderColor: 'rgba(59, 130, 246, 1)',
      borderWidth: 1
    }]
  };

  const rpeChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Average RPE by Training Block'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 10,
        title: {
          display: true,
          text: 'RPE (1-10)'
        }
      }
    }
  };

  // Find most active block
  const mostActiveBlock = blockSummaries.reduce((max: any, block: any) => 
    block.exercisesCompleted > max.exercisesCompleted ? block : max
  );

  return (
    <div id="blocks-panel" role="tabpanel" aria-labelledby="blocks-tab" className="space-y-8">
      {/* Summary Stats */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Training Volume Overview</h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{totalExercises}</div>
            <div className="text-sm text-gray-600">Total Exercises</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{activeBlocks}</div>
            <div className="text-sm text-gray-600">Active Blocks</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">
              {blockSummaries.reduce((sum: number, block: any) => sum + block.weeksActive, 0)}
            </div>
            <div className="text-sm text-gray-600">Total Week-Blocks</div>
          </div>
        </div>
      </div>

      {/* Exercise Distribution and RPE Analysis */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Pie Chart - Exercise Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Exercise Distribution</h3>
          <div className="h-80">
            <Doughnut data={pieChartData} options={pieChartOptions} />
          </div>
        </div>

        {/* RPE Comparison */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Effort Levels by Block</h3>
          <div className="h-80">
            <Bar data={rpeChartData} options={rpeChartOptions} />
          </div>
        </div>
      </div>

      {/* Detailed Block Breakdown */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Block Performance Details</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {blockSummaries.map((block: any) => (
            <div key={block.blockName} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">{block.blockName}</h4>
                <div className="text-2xl font-bold text-blue-600">{block.exercisesCompleted}</div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Volume:</span>
                  <span className="font-medium">{block.percentageOfTotal}% of total</span>
                </div>
                
                {block.avgRPE && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg RPE:</span>
                    <span className="font-medium">{block.avgRPE}/10 {getTrendIcon(block.rpeTrend)}</span>
                  </div>
                )}
                
                {block.avgQuality && !block.qualityGrade.includes('%ile') && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Quality:</span>
                    <span className="font-medium">{block.qualityGrade} {getTrendIcon(block.qualityTrend)}</span>
                  </div>
                )}

                {block.qualityGrade.includes('%ile') && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Performance:</span>
                    <span className="font-medium">{block.qualityGrade} {getTrendIcon(block.qualityTrend)}</span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Activity:</span>
                  <span className="font-medium">{formatLastActive(block.weeksActive)}</span>
                </div>
              </div>

              {/* Quality Grade Badge */}
              {block.qualityGrade !== 'N/A' && !block.qualityGrade.includes('%ile') && (
                <div className="mt-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    block.qualityGrade.startsWith('A') ? 'bg-green-100 text-green-800' :
                    block.qualityGrade.startsWith('B') ? 'bg-blue-100 text-blue-800' :
                    block.qualityGrade.startsWith('C') ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    Quality: {block.qualityGrade}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Key Insights - Factual Only */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Training Patterns</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Most Active Block</h4>
            <p className="text-gray-700">
              <strong>{mostActiveBlock.blockName}</strong> with {mostActiveBlock.exercisesCompleted} exercises 
              ({mostActiveBlock.percentageOfTotal}% of total volume)
            </p>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Quality Distribution</h4>
            <div className="space-y-1">
              {blockSummaries
                .filter((block: any) => block.qualityGrade !== 'N/A')
                .map((block: any) => (
                  <div key={block.blockName} className="flex justify-between text-sm">
                    <span>{block.blockName}:</span>
                    <span className="font-medium">{block.qualityGrade}</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Skills Analytics Component - CORRECTED DATA PATH
const SkillsAnalyticsView = () => {
  if (!skillsData?.data) {
    return <div className="bg-white rounded-lg shadow p-6">Loading skills analytics...</div>;
  }

  const skillsAnalysis = skillsData.data.skillsAnalysis;
  
  if (!skillsAnalysis?.skills) {
    return (
      <div id="skills-panel" role="tabpanel" aria-labelledby="skills-tab" className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Skills Development</h3>
        <p className="text-gray-600">No skills movement data available yet. Complete more skills exercises to see detailed analytics!</p>
      </div>
    );
  }

  // Create chart data from skills movements - FIXED: using .skills instead of .movements
  const movementNames = Object.keys(skillsAnalysis.skills);
  const movementData = movementNames.map(name => {
    const movement = skillsAnalysis.skills[name];
    const sessions = movement.sessions || [];
    return {
      name,
      sessionCount: sessions.length,
      avgRPE: movement.avgRPE || 0,
      avgQuality: movement.avgQuality || 0,
      totalReps: movement.totalReps || 0,
      lastSession: sessions.length > 0 ? sessions[sessions.length - 1] : null,
      qualityGrade: movement.qualityGrade || 'D'
    };
  });

  const skillsChartData = {
    labels: movementData.map(m => m.name),
    datasets: [
      {
        label: 'Total Reps',
        data: movementData.map(m => m.totalReps),
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }
    ]
  };

  const rpeChartData = {
    labels: movementData.map(m => m.name),
    datasets: [
      {
        label: 'Average RPE',
        data: movementData.map(m => m.avgRPE),
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1
      }
    ]
  };

  return (
    <div id="skills-panel" role="tabpanel" aria-labelledby="skills-tab" className="space-y-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Skills Development Progress</h3>
        
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Total Reps Completed</h4>
            <div className="h-64">
              <Bar data={skillsChartData} options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  title: { display: true, text: 'Reps per Movement' }
                },
                scales: {
                  y: { beginAtZero: true }
                }
              }} />
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Average RPE</h4>
            <div className="h-64">
              <Bar data={rpeChartData} options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  title: { display: true, text: 'Effort Level by Movement' }
                },
                scales: {
                  y: { beginAtZero: true, max: 10 }
                }
              }} />
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {movementData.map((movement, index) => (
            <div key={movement.name} className="p-4 border rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">{movement.name}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Sessions:</span>
                  <span className="font-medium">{movement.sessionCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Reps:</span>
                  <span className="font-medium">{movement.totalReps}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg RPE:</span>
                  <span className="font-medium">{movement.avgRPE}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Quality Grade:</span>
                  <span className="font-medium">{movement.qualityGrade}</span>
                </div>
                {movement.lastSession && (
                  <div className="text-xs text-gray-500 mt-2">
                    Last: Week {movement.lastSession.week}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Strength Analytics Component - CORRECTED (this one was mostly right)
const StrengthAnalyticsView = () => {
  if (!strengthData?.data) {
    return <div className="bg-white rounded-lg shadow p-6">Loading strength analytics...</div>;
  }

  const strengthAnalysis = strengthData.data.strengthAnalysis;
  
  if (!strengthAnalysis?.movements) {
    return (
      <div id="strength-panel" role="tabpanel" aria-labelledby="strength-tab" className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Strength Analysis</h3>
        <p className="text-gray-600">No strength movement data available yet. Complete more strength exercises to see detailed analytics!</p>
      </div>
    );
  }

  // Create chart data from strength movements
  const movementNames = Object.keys(strengthAnalysis.movements);
  const movementData = movementNames.map(name => {
    const movement = strengthAnalysis.movements[name];
    return {
      name,
      sessionCount: movement.sessions?.length || 0,
      maxWeight: movement.maxWeight || 0,
      currentWeight: movement.currentWeight || 0,
      totalVolume: movement.totalVolume || 0,
      avgRPE: movement.avgRPE || 0,
      lastSession: movement.sessions && movement.sessions.length > 0 ? movement.sessions[movement.sessions.length - 1] : null
    };
  });

  const weightProgressData = {
    labels: movementData.map(m => m.name),
    datasets: [
      {
        label: 'Max Weight (lbs)',
        data: movementData.map(m => m.maxWeight),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }
    ]
  };

  const volumeData = {
    labels: movementData.map(m => m.name),
    datasets: [
      {
        label: 'Total Volume',
        data: movementData.map(m => m.totalVolume),
        backgroundColor: 'rgba(153, 102, 255, 0.6)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1
      }
    ]
  };

  return (
    <div id="strength-panel" role="tabpanel" aria-labelledby="strength-tab" className="space-y-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Strength Progress Analysis</h3>
        
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Max Weight Progression</h4>
            <div className="h-64">
              <Bar data={weightProgressData} options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  title: { display: true, text: 'Peak Loads by Movement' }
                },
                scales: {
                  y: { beginAtZero: true }
                }
              }} />
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Training Volume</h4>
            <div className="h-64">
              <Bar data={volumeData} options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  title: { display: true, text: 'Total Volume by Movement' }
                },
                scales: {
                  y: { beginAtZero: true }
                }
              }} />
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {movementData.map((movement, index) => (
            <div key={movement.name} className="p-4 border rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">{movement.name}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Sessions:</span>
                  <span className="font-medium">{movement.sessionCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Max Weight:</span>
                  <span className="font-medium">{movement.maxWeight} lbs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg RPE:</span>
                  <span className="font-medium">{movement.avgRPE}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Volume:</span>
                  <span className="font-medium">{movement.totalVolume.toLocaleString()}</span>
                </div>
                {movement.lastSession && (
                  <div className="text-xs text-gray-500 mt-2">
                    Last: Week {movement.lastSession.week} - {movement.lastSession.weight} lbs
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};


// MetCon Analytics Component  
const MetConAnalyticsView = () => {
  if (!metconData?.data) {
    return <div className="bg-white rounded-lg shadow p-6">Loading MetCon analytics...</div>;
  }

  const { timeDomainAnalysis } = metconData.data;

  // Create time domain chart
  const timeDomainChartData = {
    labels: Object.keys(timeDomainAnalysis.timeDomains),
    datasets: [
      {
        label: 'Average Percentile',
        data: Object.values(timeDomainAnalysis.timeDomains).map((domain: any) => domain.avgPercentile),
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1
      }
    ]
  };

  return (
    <div id="metcons-panel" role="tabpanel" aria-labelledby="metcons-tab" className="space-y-8">
      {/* ADD THE HEAT MAP HERE - FIRST */}
      <MetConExerciseHeatMap data={timeDomainAnalysis} />
      
      {/* Keep your existing chart below */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Conditioning Performance</h3>
        <div className="h-64 mb-6">
          <Bar data={timeDomainChartData} options={{
            responsive: true,
            plugins: {
              legend: {
                display: false
              },
              title: {
                display: true,
                text: 'Performance by Time Domain'
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                max: 100
              }
            }
          }} />
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Time Domain Performance</h4>
            <div className="space-y-2">
              {Object.entries(timeDomainAnalysis.timeDomains).map(([timeRange, data]: [string, any]) => (
                <div key={timeRange} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium">{timeRange}</span>
                  <span className="text-sm text-gray-600">{data.avgPercentile}% avg</span>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Summary</h4>
            <div className="space-y-2 text-sm">
              <p><strong>Total Workouts:</strong> {metconData.data.summary.totalWorkouts}</p>
              <p><strong>Time Domains:</strong> {metconData.data.summary.timeDomainsCovered}</p>
              <p><strong>Average Percentile:</strong> {metconData.data.summary.averagePercentile}%</p>
              <p><strong>Strongest Domain:</strong> {metconData.data.summary.strongestDomain}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

  // Loading and error states
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
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
          <Link
            href="/dashboard"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </Link>
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
        <h1 className="text-2xl font-bold text-gray-900">Performance Analytics</h1>
        <p className="text-gray-600">Comprehensive training insights and progress tracking</p>
      </div>
      <div className="flex items-center space-x-4">
        <Link
          href="/dashboard/exercise-deep-dive"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Exercise Deep Dive →
        </Link>
        <Link
          href="/dashboard"
          className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  </div>
</header>



      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Overview Summary - Single Instance */}
        <OverviewSummary />

        {/* Enhanced Tab Navigation */}
        <TabNavigation />

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {analyticsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
              <p className="text-gray-600">Loading analytics data...</p>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Performance Overview</h3>
                  <p className="text-gray-600">
                    Your performance metrics are displayed in the summary cards above. Use the navigation tabs to explore detailed analytics for specific training areas.
                  </p>
                  <div className="mt-6 grid md:grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">Quick Tips</h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Track your progress across all training blocks</li>
                        <li>• Monitor consistency and effort levels</li>
                        <li>• Identify strengths and areas for focus</li>
                      </ul>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h4 className="font-medium text-green-900 mb-2">Navigation</h4>
                      <ul className="text-sm text-green-800 space-y-1">
                        <li>• <strong>Training Blocks:</strong> Overall block performance</li>
                        <li>• <strong>Skills/Strength:</strong> Movement-specific data</li>
                        <li>• <strong>Conditioning:</strong> MetCon analysis & heat maps</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'blocks' && <BlockAnalyticsView />}
              {activeTab === 'skills' && <SkillsAnalyticsView />}
              {activeTab === 'strength' && <StrengthAnalyticsView />}
              {activeTab === 'metcons' && <MetConAnalyticsView />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
