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

// Add this component definition to your analytics page
const RecentActivityOverview: React.FC<{ userId: number | null }> = ({ userId }) => {
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchRecentActivity();
    }
  }, [userId]);

  const fetchRecentActivity = async () => {
    if (!userId) return;
    
    setActivityLoading(true);
    try {
      // You'll need to create this API endpoint
      const response = await fetch(`/api/analytics/${userId}/recent-activity`);
      const data = await response.json();
      
      if (data.success) {
        setRecentActivity(data.data.recentSessions || []);
      }
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      setRecentActivity([]);
    } finally {
      setActivityLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Yesterday';
    if (diffDays === 2) return '2 days ago';
    if (diffDays <= 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };


  if (activityLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
<h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Training Activity</h3>        
        <div className="space-y-4">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (recentActivity.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
<h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Training Activity</h3>       
 <p className="text-gray-600">No recent training sessions found. Complete some exercises to see your activity here!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      
<h3 className="text-lg font-semibold text-charcoal mb-6">Recent Training Activity</h3>
      <div className="space-y-4">
        {recentActivity.slice(0, 5).map((session, index) => (
          

<Link 
  key={session.sessionId || index}
  href={`/dashboard/session-review/${userId}-${session.programId}-${session.week}-${session.day}`}
  className="block border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-200 hover:border-blue-300 cursor-pointer"
>


            {/* Date and Session Info */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
<div className="text-lg font-semibold text-charcoal">
  {formatDate(session.date)}
</div>
                <div className="text-sm text-gray-500">
                  Week {session.week}, Day {session.day}
                </div>
              </div>
              <div className="text-right">
               
<div className="text-sm font-medium text-coral">
  {session.totalExercises} exercises
</div>
              </div>
            </div>

            {/* Training Blocks */}
            <div className="flex flex-wrap gap-2">
              {session.blocks && session.blocks.map((block: any) => (
               
<span 
  key={block.blockName}
  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
>
  {block.blockName}
  
{block.exerciseCount > 0 && (
  <span className="ml-1 text-coral">({block.exerciseCount})</span>
)}
</span>

              ))}
            </div>

         
          </Link>
        ))}
      </div>

      {/* Show more link if there are more sessions */}
      {recentActivity.length > 5 && (
        <div className="mt-6 text-center">
          <button 
            onClick={() => {/* Implement show more */}}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Show more sessions
          </button>
        </div>
      )}
    </div>
  );
};


// Updated MetConExerciseHeatMap component that receives data as props
const MetConExerciseHeatMap: React.FC<{ data: any }> = ({ data }) => {
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
    if (!data?.heatmapCells) return null;
    
    const cell = data.heatmapCells.find((cell: any) => 
      cell.exercise_name === exercise && cell.time_range === timeDomain
    );
    
    return cell ? cell.avg_percentile : null;
  };

  const getSessionCount = (exercise: string, timeDomain: string): number => {
    if (!data?.heatmapCells) return 0;
    
    const cell = data.heatmapCells.find((cell: any) => 
      cell.exercise_name === exercise && cell.time_range === timeDomain
    );
    
    return cell ? cell.session_count : 0;
  };

  // Calculate exercise averages
  const calculateExerciseAverage = (exercise: string): number | null => {
    if (!data?.exerciseAverages) return null;
    
    const exerciseAvg = data.exerciseAverages.find((avg: any) => 
      avg.exercise_name === exercise
    );
    
    return exerciseAvg ? exerciseAvg.overall_avg_percentile : null;
  };

  // Calculate time domain averages
  const calculateTimeDomainAverage = (timeDomain: string): number | null => {
    if (!data?.heatmapCells) return null;
    
    const domainCells = data.heatmapCells.filter((cell: any) => 
      cell.time_range === timeDomain
    );
    
    if (domainCells.length === 0) return null;
    
    let totalWeightedScore = 0;
    let totalSessions = 0;
    
    domainCells.forEach((cell: any) => {
      totalWeightedScore += cell.avg_percentile * cell.session_count;
      totalSessions += cell.session_count;
    });
    
    return totalSessions > 0 ? Math.round(totalWeightedScore / totalSessions) : null;
  };

  // No data state
  if (!data || !data.exercises || data.exercises.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🔥 Exercise Performance Heat Map</h3>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <div className="text-4xl mb-3">💪</div>
          <p className="text-blue-800 font-medium mb-2">No MetCon Data Yet</p>
          <p className="text-blue-600">Complete more MetCon workouts to see exercise-specific performance data!</p>
        </div>
      </div>
    );
  }

  const { exercises, timeDomains, globalFitnessScore } = data;

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
              {timeDomains.map((domain: string) => (
                <th key={domain} className="text-center p-3 font-medium text-gray-900 min-w-[100px]">
                  {domain}
                </th>
              ))}
              <th className="text-center p-3 font-bold text-gray-900 min-w-[100px] bg-blue-50 border-l-2 border-blue-200">
                Exercise Avg
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Individual Exercise Rows */}
            {exercises.map((exercise: string) => (
              <tr key={exercise} className="border-t">
                <td className="p-3 font-medium text-gray-900 bg-gray-50">
                  {exercise}
                </td>
                {timeDomains.map((domain: string) => {
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
                {/* Exercise Average Cell */}
                <td className="p-1 border-l-2 border-blue-200 bg-blue-50">
                  {(() => {
                    const avgPercentile = calculateExerciseAverage(exercise);
                    const colorClass = getHeatMapColor(avgPercentile);
                    const exerciseData = data.exerciseAverages.find((avg: any) => avg.exercise_name === exercise);
                    const totalSessions = exerciseData?.total_sessions || 0;
                    
                    return (
                      <div className={`
                        ${colorClass}
                        rounded p-3 text-center font-bold transition-all hover:scale-105 cursor-pointer
                        shadow-md border-2 border-white
                        ${avgPercentile ? 'ring-1 ring-blue-300' : ''}
                      `} style={{ minHeight: '60px' }}>
                        {avgPercentile ? (
                          <div>
                            <div className="text-lg font-bold">Avg: {avgPercentile}%</div>
                            <div className="text-xs opacity-75 font-medium">{totalSessions} total</div>
                          </div>
                        ) : (
                          <div className="text-lg font-bold">—</div>
                        )}
                      </div>
                    );
                  })()}
                </td>
              </tr>
            ))}
            
            {/* Time Domain Averages Row */}
            <tr className="border-t-2 border-blue-200 bg-blue-50">
              <td className="p-3 font-bold text-gray-900 bg-blue-100 border-r-2 border-blue-200">
                Time Domain Avg
              </td>
              {timeDomains.map((domain: string) => {
                const avgPercentile = calculateTimeDomainAverage(domain);
                const colorClass = getHeatMapColor(avgPercentile);
                
                return (
                  <td key={domain} className="p-1">
                    <div className={`
                      ${colorClass}
                      rounded p-3 text-center font-bold transition-all hover:scale-105 cursor-pointer
                      shadow-md border-2 border-white
                      ${avgPercentile ? 'ring-1 ring-blue-300' : ''}
                    `} style={{ minHeight: '60px' }}>
                      {avgPercentile ? (
                        <div>
                          <div className="text-lg font-bold">Avg: {avgPercentile}%</div>
                          <div className="text-xs opacity-75 font-medium">Domain</div>
                        </div>
                      ) : (
                        <div className="text-lg font-bold">—</div>
                      )}
                    </div>
                  </td>
                );
              })}
              
              {/* Global Fitness Score Cell */}
              <td className="p-1 border-l-2 border-blue-200 bg-blue-100">
                {(() => {
                  const colorClass = getHeatMapColor(globalFitnessScore);
                  return (
                    <div className={`
                      ${colorClass}
                      rounded p-3 text-center font-bold transition-all hover:scale-105 cursor-pointer
                      shadow-lg border-4 border-white
                      ${globalFitnessScore ? 'ring-2 ring-blue-400' : ''}
                    `} style={{ minHeight: '60px' }}>
                      {globalFitnessScore ? (
                        <div>
                          <div className="text-xl font-bold">{globalFitnessScore}%</div>
                          <div className="text-xs opacity-75 font-bold">FITNESS</div>
                        </div>
                      ) : (
                        <div className="text-xl font-bold">—</div>
                      )}
                    </div>
                  );
                })()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Enhanced Legend */}
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
        <div className="text-sm text-gray-500">
          <span className="font-medium">Bold cells</span> show weighted averages
        </div>
      </div>

      {/* Summary Insights */}
      {globalFitnessScore && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Fitness Summary</h4>
          <p className="text-sm text-gray-700">
            Your overall fitness score is <strong>{globalFitnessScore}%</strong> based on {exercises.length} exercises 
            across {timeDomains.length} time domains from {data.totalCompletedWorkouts} completed workouts. 
            Scores are weighted by training frequency to reflect your actual fitness level.
          </p>
        </div>
      )}
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


const PredictiveInsightsView = () => {
  if (!predictiveData?.data) {
    return <div className="bg-white rounded-lg shadow p-6">Loading predictive insights...</div>;
  }

  const { predictions } = predictiveData.data;

  return (
    <div id="insights-panel" role="tabpanel" aria-labelledby="insights-tab" className="space-y-8">
      {/* Plateau Predictions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Plateau Predictions</h3>
        {predictions.plateauPredictions?.map((prediction, index) => (
          <div key={index} className="border-l-4 border-yellow-400 bg-yellow-50 p-4 mb-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>{prediction.exercise}</strong> - {prediction.timeframe}
                </p>
                <p className="text-xs text-yellow-600 mt-1">{prediction.reasoning}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Fatigue Warnings */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Fatigue Warnings</h3>
        {predictions.fatigueWarnings?.map((warning, index) => (
          <div key={index} className="border-l-4 border-red-400 bg-red-50 p-4 mb-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  <strong>{warning.riskLevel.toUpperCase()} RISK</strong>
                </p>
                <p className="text-xs text-red-600 mt-1">{warning.recommendation}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Progression Opportunities */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Progression Opportunities</h3>
        {predictions.progressionOpportunities?.map((opportunity, index) => (
          <div key={index} className="border-l-4 border-green-400 bg-green-50 p-4 mb-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-green-700">
                  <strong>{opportunity.area}</strong> - {opportunity.nextStep}
                </p>
                <p className="text-xs text-green-600 mt-1">{opportunity.timeline}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};



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
const [predictiveData, setPredictiveData] = useState<any>(null);

  const [analyticsLoading, setAnalyticsLoading] = useState(false);
const [activeTab, setActiveTab] = useState<'overview' | 'skills' | 'strength' | 'metcons'>('overview');

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
const [dashboardRes, blockRes, skillsRes, strengthRes, metconRes, predictiveRes] = await Promise.allSettled([
  fetch(`/api/analytics/${userId}/dashboard`),
  fetch(`/api/analytics/${userId}/block-analyzer`),
  fetch(`/api/analytics/${userId}/skills-analytics`),
  fetch(`/api/analytics/${userId}/strength-tracker`),
  fetch(`/api/analytics/${userId}/metcon-analyzer`),
  fetch(`/api/analytics/${userId}/predictive-insights`)
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


  // Enhanced Tab Navigation with Prominent Styling

const TabNavigation = () => (
  <div className="bg-white shadow-lg rounded-xl border border-gray-200 mb-8 p-4">
    <nav className="flex flex-wrap gap-3" role="tablist" aria-label="Analytics Navigation">
      
{[
  { id: 'overview', name: 'Overview' },
  { id: 'skills', name: 'Skills' },
  { id: 'strength', name: 'Strength' },
  { id: 'metcons', name: 'MetCons' },
  { id: 'insights', name: 'Insights' }
].map((tab) => (
        
<button
          key={tab.id}
          onClick={() => setActiveTab(tab.id as any)}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`${tab.id}-panel`}

className={`px-6 py-4 rounded-lg font-semibold text-base transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-coral focus:ring-offset-2 ${
  activeTab === tab.id
    ? 'bg-coral text-white shadow-lg scale-105 ring-2 ring-coral ring-offset-2'
    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 hover:text-gray-900 hover:shadow-md border border-gray-200'
}`}
>
  <span className="font-medium">{tab.name}</span>       
 </button>
      ))}
      
      {/* Exercise Deep Dive Button - NOW MATCHES OTHER INACTIVE TABS */}
     
<Link
  href="/dashboard/exercise-deep-dive"
  className="px-6 py-4 rounded-lg font-semibold text-base transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 bg-gray-50 text-gray-700 hover:bg-gray-100 hover:text-gray-900 hover:shadow-md border border-gray-200"
>
  <span className="font-medium">Exercise Deep Dive</span>
      </Link>
    </nav>
  </div>
);


// Enhanced Skill Card Component
const EnhancedSkillCard: React.FC<{ skill: any }> = ({ skill }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Badge calculation functions
  const getRepBadge = (totalReps: number) => {
    if (totalReps >= 1000) return { emoji: '🏆', text: 'Master', color: 'bg-purple-100 text-purple-800' };
    if (totalReps >= 500) return { emoji: '💎', text: 'Diamond', color: 'bg-blue-100 text-blue-800' };
    if (totalReps >= 250) return { emoji: '🥇', text: 'Gold', color: 'bg-yellow-100 text-yellow-800' };
    if (totalReps >= 100) return { emoji: '🥈', text: 'Silver', color: 'bg-gray-100 text-gray-800' };
    if (totalReps >= 50) return { emoji: '🥉', text: 'Bronze', color: 'bg-orange-100 text-orange-800' };
    return null;
  };

  const getPracticeBadge = (daysSince: number) => {
    if (daysSince <= 3) return { emoji: '🟢', text: 'Active', color: 'bg-green-100 text-green-800' };
    if (daysSince <= 7) return { emoji: '🟡', text: 'Recent', color: 'bg-yellow-100 text-yellow-800' };
    if (daysSince <= 14) return { emoji: '🟠', text: 'Stale', color: 'bg-orange-100 text-orange-800' };
    return { emoji: '🔴', text: 'Neglected', color: 'bg-red-100 text-red-800' };
  };

  const getNextMilestone = (totalReps: number) => {
    const milestones = [50, 100, 250, 500, 1000];
    const nextMilestone = milestones.find(m => m > totalReps);
    if (!nextMilestone) return null;
    
    const remaining = nextMilestone - totalReps;
    const badgeNames = { 50: 'Bronze 🥉', 100: 'Silver 🥈', 250: 'Gold 🥇', 500: 'Diamond 💎', 1000: 'Master 🏆' };
    return {
      remaining,
      badge: badgeNames[nextMilestone as keyof typeof badgeNames]
    };
  };

  // Get special badges
  const getSpecialBadges = () => {
    const badges = [];
    const thisWeek = Math.max(...skill.sessions.map((s: any) => s.week));
    const thisWeekSessions = skill.sessions.filter((s: any) => s.week === thisWeek);
    if (thisWeekSessions.length >= 3) {
      badges.push({ emoji: '🔥', text: 'Hot Streak', color: 'bg-red-100 text-red-800' });
    }
    return badges;
  };

  const repBadge = getRepBadge(skill.totalReps);
  const practiceBadge = getPracticeBadge(skill.daysSinceLast);
  const specialBadges = getSpecialBadges();
  const nextMilestone = getNextMilestone(skill.totalReps);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-200">
      {/* Header with skill name and level */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-gray-900 text-lg">{skill.name}</h4>
          {skill.intakeLevel && (
            <span className="text-sm text-gray-500 italic">{skill.intakeLevel}</span>
          )}
        </div>
        
        {/* Badges */}
        <div className="flex flex-wrap gap-1 justify-end">
          {repBadge && (
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${repBadge.color}`}>
              {repBadge.emoji} {repBadge.text}
            </span>
          )}
          {specialBadges.map((badge: any, index: number) => (
            <span key={index} className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
              {badge.emoji} {badge.text}
            </span>
          ))}

{/* Removed practice badge - less stressful for athletes */}       
 </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div className="flex justify-between">
          <span className="text-gray-600">Sessions:</span>
          <span className="font-medium">{skill.sessions.length}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Total Reps:</span>
          <span className="font-medium">{skill.totalReps}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Avg RPE:</span>
          <span className="font-medium">{skill.avgRPE?.toFixed(1) || 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Quality Grade:</span>
          <span className="font-medium">{skill.qualityGrade}</span>
        </div>
      </div>

      {/* Next Milestone */}
      {nextMilestone && (
        <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-800 font-medium">
              {nextMilestone.remaining} more reps for {nextMilestone.badge}
            </span>
            <div className="w-16 bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${Math.max(10, (skill.totalReps / (skill.totalReps + nextMilestone.remaining)) * 100)}%` 
                }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Expand/Collapse Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-center text-blue-600 hover:text-blue-700 text-sm font-medium py-2 border-t border-gray-200 transition-colors"
      >
        {isExpanded ? '↑ Hide training history' : '↓ View training history'}
      </button>

      {/* Expanded Training History */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
          <h5 className="font-medium text-gray-900">Training History</h5>
          
          {skill.sessions.length > 0 ? (
            <div className="space-y-2">
              {skill.sessions
                .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 5)
                .map((session: any, index: number) => (
                  <div key={index} className="bg-gray-50 rounded p-3">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm font-medium">
                        Week {session.week} • {formatDate(session.date)}
                      </span>
                      <span className="text-xs text-gray-500">
                        RPE {session.rpe} • Quality {session.quality}/4
                      </span>
                    </div>
                    <div className="text-sm text-gray-700">
                      {session.sets} sets × {session.reps} reps = {session.sets * session.reps} total
                    </div>
                    {session.notes && (
                      <div className="text-xs text-gray-600 mt-1 italic">
                        "{session.notes}"
                      </div>
                    )}
                  </div>
                ))}
              
              {skill.sessions.length > 5 && (
                <div className="text-center text-sm text-gray-500">
                  ... and {skill.sessions.length - 5} more sessions
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">No training sessions recorded yet.</p>
          )}

          {/* Quick Stats in Expanded View */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
            <div>
              <span className="text-xs text-gray-500 block">Volume Trend</span>
              <div className="flex items-center space-x-1 mt-1">
                {skill.sessions.slice(-4).map((session: any, i: number) => (
                  <div 
                    key={i}
                    className="bg-blue-200 rounded"
                    style={{ 
                      height: `${Math.max(4, (session.sets * session.reps / Math.max(...skill.sessions.map((s: any) => s.sets * s.reps))) * 20)}px`,
                      width: '8px'
                    }}
                  ></div>
                ))}
              </div>
            </div>
           
<div>
 <span className="text-xs text-gray-500 block">Total Sessions</span>
  <span className="text-sm font-medium">{skill.sessions.length}</span>
</div>
          </div>
        </div>
      )}
    </div>
  );
};

// Skills Analytics Component - Updated with chart totals
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

  // Convert skills object to array for mapping
  const skillsArray = Object.values(skillsAnalysis.skills);

  // Create chart data from skills movements
  const movementData = skillsArray.map((skill: any) => ({
    name: skill.name,
    sessionCount: skill.sessions?.length || 0,
    avgRPE: skill.avgRPE || 0,
    avgQuality: skill.avgQuality || 0,
    totalReps: skill.totalReps || 0,
    qualityGrade: skill.qualityGrade || 'D'
  }));

  // Calculate totals for chart titles
  const totalReps = skillsArray.reduce((sum: number, skill: any) => sum + (skill.totalReps || 0), 0);
  const avgRPE = skillsArray.reduce((sum: number, skill: any) => sum + (skill.avgRPE || 0), 0) / skillsArray.length;

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

  // Calculate summary stats (only the non-redundant ones)
  const totalSkills = skillsArray.length;
  const masteredSkills = skillsArray.filter((skill: any) => skill.qualityGrade === 'A').length;

  return (
    <div id="skills-panel" role="tabpanel" aria-labelledby="skills-tab" className="space-y-8">
      {/* Summary Stats - UPDATED: Only unique metrics */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Skills Development Overview</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{totalSkills}</div>
            <div className="text-sm text-gray-600">Skills Practiced</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{masteredSkills}</div>
            <div className="text-sm text-gray-600">Grade A Skills</div>
          </div>
        </div>
      </div>

      {/* Charts - UPDATED: With totals in titles */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Skills Progress Charts</h3>
        
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-3">
              Total Reps Completed <span className="text-2xl font-bold text-purple-600 ml-2">{totalReps.toLocaleString()}</span>
            </h4>
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
            <h4 className="font-medium text-gray-900 mb-3">
              Average RPE <span className="text-2xl font-bold text-orange-600 ml-2">{avgRPE.toFixed(1)}</span>
            </h4>
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
      </div>

      {/* Enhanced Skill Cards */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Individual Skills Progress</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {skillsArray.map((skill: any, index: number) => (
            <EnhancedSkillCard key={skill.name || index} skill={skill} />
          ))}
        </div>
      </div>
    </div>
  );
};

// Strength Analytics Component - Updated with side-by-side bars
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
      averageWeight: movement.averageWeight || movement.currentWeight || 0, // Use averageWeight if available, fallback to currentWeight
      totalVolume: movement.totalVolume || 0,
      avgRPE: movement.avgRPE || 0,
      lastSession: movement.sessions && movement.sessions.length > 0 ? movement.sessions[movement.sessions.length - 1] : null
    };
  });

  // UPDATED: Side-by-side bar chart with max and average weights
  const weightProgressData = {
    labels: movementData.map(m => m.name),
    datasets: [
      {
        label: 'Max Weight',
        data: movementData.map(m => m.maxWeight),
        backgroundColor: 'rgba(75, 192, 192, 0.8)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      },
      {
        label: 'Average Weight',
        data: movementData.map(m => m.averageWeight),
        backgroundColor: 'rgba(255, 159, 64, 0.8)',
        borderColor: 'rgba(255, 159, 64, 1)',
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
          {/* UPDATED: Removed redundant header, added side-by-side bars */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Peak Loads by Movement</h4>
            <div className="h-64">
              <Bar data={weightProgressData} options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { 
                    display: true,
                    position: 'top',
                    labels: {
                      usePointStyle: true,
                      padding: 20
                    }
                  },
                  title: { display: false }
                },
                scales: {
                  y: { 
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: 'Weight (lbs)'
                    }
                  },
                  x: {
                    title: {
                      display: true,
                      text: 'Movements'
                    }
                  }
                }
              }} />
            </div>
          </div>
          
          {/* UPDATED: Removed redundant header */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Total Volume by Movement</h4>
            <div className="h-64">
              <Bar data={volumeData} options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  title: { display: false }
                },
                scales: {
                  y: { 
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: 'Volume (lbs)'
                    }
                  },
                  x: {
                    title: {
                      display: true,
                      text: 'Movements'
                    }
                  }
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
                  <span className="font-medium text-teal-600">{movement.maxWeight} lbs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg Weight:</span>
                  <span className="font-medium text-orange-600">{movement.averageWeight} lbs</span>
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

// MetCon Analytics Component - ALL ISSUES FIXED
const MetConAnalyticsView = () => {
  const [heatmapData, setHeatmapData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      fetchHeatmapData();
    }
  }, [userId]);

  const fetchHeatmapData = async () => {
    if (!userId) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/analytics/${userId}/exercise-heatmap`);
      const data = await response.json();
      
      if (data.success) {
        setHeatmapData(data.data);
      } else {
        setError(data.error || 'Failed to load heat map data');
      }
    } catch (error) {
      console.error('Error fetching heat map data:', error);
      setError('Failed to load heat map data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="bg-white rounded-lg shadow p-6">Loading MetCon analytics...</div>;
  }

  if (error) {
    return <div className="bg-white rounded-lg shadow p-6">Error: {error}</div>;
  }

  if (!heatmapData) {
    return <div className="bg-white rounded-lg shadow p-6">No data available</div>;
  }

  // Create time domain chart from heatmap data
  const timeDomainChartData = {
    labels: heatmapData?.timeDomains || [],
    datasets: [
      {
        label: 'Average Percentile',
        data: (heatmapData?.timeDomains || []).map((domain: string) => {
          // Calculate average for this time domain from heatmap cells
          const domainCells = heatmapData?.heatmapCells?.filter((cell: any) => cell.time_range === domain) || [];
          if (domainCells.length === 0) return 0;
          
          let totalWeighted = 0;
          let totalSessions = 0;
          domainCells.forEach((cell: any) => {
            totalWeighted += cell.avg_percentile * cell.session_count;
            totalSessions += cell.session_count;
          });
          
          return totalSessions > 0 ? Math.round(totalWeighted / totalSessions) : 0;
        }),
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1
      }
    ]
  };

  // Calculate summary data from heatmap data
  const calculateSummaryData = () => {
    if (!heatmapData) return null;

    const totalWorkouts = heatmapData.totalCompletedWorkouts || 0;
    const timeDomainsCovered = heatmapData.timeDomains?.length || 0;
    const averagePercentile = heatmapData.globalFitnessScore || 0;
    
    // Find strongest domain
    let strongestDomain = 'None';
    let highestAvg = 0;
    
    if (heatmapData.timeDomains) {
      heatmapData.timeDomains.forEach((domain: string) => {
        const domainCells = heatmapData.heatmapCells?.filter((cell: any) => cell.time_range === domain) || [];
        if (domainCells.length === 0) return;
        
        let totalWeighted = 0;
        let totalSessions = 0;
        domainCells.forEach((cell: any) => {
          totalWeighted += cell.avg_percentile * cell.session_count;
          totalSessions += cell.session_count;
        });
        
        const avg = totalSessions > 0 ? Math.round(totalWeighted / totalSessions) : 0;
        if (avg > highestAvg) {
          highestAvg = avg;
          strongestDomain = domain;
        }
      });
    }

    return {
      totalWorkouts,
      timeDomainsCovered,
      averagePercentile,
      strongestDomain
    };
  };

  const summaryData = calculateSummaryData();

  return (
    <div id="metcons-panel" role="tabpanel" aria-labelledby="metcons-tab" className="space-y-8">
      {/* Heat Map */}
      <MetConExerciseHeatMap data={heatmapData} />
       
      {/* Chart Section */}
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
              {(heatmapData?.timeDomains || []).map((timeRange: string) => {
                // Calculate average for this time domain
                const domainCells = heatmapData?.heatmapCells?.filter((cell: any) => cell.time_range === timeRange) || [];
                let avgPercentile = 0;
                
                if (domainCells.length > 0) {
                  let totalWeighted = 0;
                  let totalSessions = 0;
                  domainCells.forEach((cell: any) => {
                    totalWeighted += cell.avg_percentile * cell.session_count;
                    totalSessions += cell.session_count;
                  });
                  avgPercentile = totalSessions > 0 ? Math.round(totalWeighted / totalSessions) : 0;
                }

                return (
                  <div key={timeRange} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-sm font-medium">{timeRange}</span>
                    <span className="text-sm text-gray-600">{avgPercentile}% avg</span>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Summary</h4>
            {summaryData && (
              <div className="space-y-2 text-sm">
                <p><strong>Total Workouts:</strong> {summaryData.totalWorkouts}</p>
                <p><strong>Time Domains:</strong> {summaryData.timeDomainsCovered}</p>
                <p><strong>Average Percentile:</strong> {summaryData.averagePercentile}%</p>
                <p><strong>Strongest Domain:</strong> {summaryData.strongestDomain}</p>
              </div>
            )}
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
<h1 className="text-2xl font-bold text-charcoal">Performance Analytics</h1>       
 <p className="text-gray-600">Comprehensive training insights and progress tracking</p>
      </div>
      <div className="flex items-center space-x-4">
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

{/* Overview cards moved to dashboard */}
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
{activeTab === 'overview' && <RecentActivityOverview userId={userId} />}              
{activeTab === 'skills' && <SkillsAnalyticsView />}
{activeTab === 'insights' && <PredictiveInsightsView />}
              {activeTab === 'strength' && <StrengthAnalyticsView />}
              {activeTab === 'metcons' && <MetConAnalyticsView />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

