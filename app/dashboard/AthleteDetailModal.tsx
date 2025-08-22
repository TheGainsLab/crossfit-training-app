import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';

// Register Chart.js components  
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface AthleteDetailModalProps {
  athlete: any;
  onClose: () => void;
}

const AthleteDetailModal: React.FC<AthleteDetailModalProps> = ({ athlete, onClose }) => {
  console.log('🔍 FULL athlete object:', JSON.stringify(athlete, null, 2));

  const [activeTab, setActiveTab] = useState<'overview' | 'skills' | 'strength' | 'metcons' | 'notes'>('overview');
  const [loading, setLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>({});
  const [coachNotes, setCoachNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    if (athlete) {
      fetchAthleteAnalytics();
      fetchCoachNotes();
    }
  }, [athlete]);

  const fetchAthleteAnalytics = async () => {
    setLoading(true);
    try {
      console.log('🔍 Fetching analytics for athlete ID:', athlete.athlete.id);

      // Call all 5 permission-enabled analytics endpoints in parallel
      const [dashboardRes, recentRes, skillsRes, strengthRes, heatmapRes] = await Promise.allSettled([
        fetch(`/api/analytics/${athlete.athlete.id}/dashboard`),
        fetch(`/api/analytics/${athlete.athlete.id}/recent-activity`),
        fetch(`/api/analytics/${athlete.athlete.id}/skills-analytics`),
        fetch(`/api/analytics/${athlete.athlete.id}/strength-tracker`),
        fetch(`/api/analytics/${athlete.athlete.id}/exercise-heatmap`)
      ]);

      const newAnalyticsData: any = {};

      // Process Dashboard Data
      if (dashboardRes.status === 'fulfilled' && dashboardRes.value.ok) {
        const data = await dashboardRes.value.json();
        console.log('✅ Dashboard data loaded:', data.success);
        if (data.success) {
          newAnalyticsData.dashboard = data;
        }
      } else {
        console.error('❌ Dashboard API failed');
      }

      // Process Recent Activity Data
      if (recentRes.status === 'fulfilled' && recentRes.value.ok) {
        const data = await recentRes.value.json();
        console.log('✅ Recent activity data loaded:', data.success);
        if (data.success) {
          newAnalyticsData.recent = data;
        }
      } else {
        console.error('❌ Recent activity API failed');
      }

      // Process Skills Data
      if (skillsRes.status === 'fulfilled' && skillsRes.value.ok) {
        const data = await skillsRes.value.json();
        console.log('✅ Skills data loaded:', data.success);
        if (data.success) {
          newAnalyticsData.skills = data;
        }
      } else {
        console.error('❌ Skills API failed');
      }

      // Process Strength Data
      if (strengthRes.status === 'fulfilled' && strengthRes.value.ok) {
        const data = await strengthRes.value.json();
        console.log('✅ Strength data loaded:', data.success);
        if (data.success) {
          newAnalyticsData.strength = data;
        }
      } else {
        console.error('❌ Strength API failed');
      }

      // Process Heatmap/MetCons Data
      if (heatmapRes.status === 'fulfilled' && heatmapRes.value.ok) {
        const data = await heatmapRes.value.json();
        console.log('✅ Heatmap/MetCons data loaded:', data.success);
        if (data.success) {
          newAnalyticsData.metcons = data;
        }
      } else {
        console.error('❌ Heatmap API failed');
      }

      setAnalyticsData(newAnalyticsData);
      console.log('🔍 Final analytics data structure:', newAnalyticsData);

    } catch (error) {
      console.error('❌ Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCoachNotes = async () => {
    try {
      const response = await fetch(`/api/coach/notes?athleteId=${athlete.athlete.id}`);

      if (response.ok) {
        const data = await response.json();
        setCoachNotes(data.notes || []);
      }
    } catch (error) {
      console.error('Error fetching coach notes:', error);
      setCoachNotes([]);
    }
  };

  const addCoachNote = async () => {
    if (!newNote.trim()) return;
    
    setAddingNote(true);
    try {
      const response = await fetch('/api/coach/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athleteId: athlete.athlete.id,
          content: newNote.trim(),
          noteType: 'general'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCoachNotes(prev => [data.note, ...prev]);
        setNewNote('');
      }
    } catch (error) {
      console.error('Error adding coach note:', error);
    } finally {
      setAddingNote(false);
    }
  };

  const getHealthStatusDisplay = (status: string) => {
    const statusConfig = {
      good: { icon: '✅', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
      warning: { icon: '⚠️', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
      needs_attention: { icon: '🚨', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' }
    };
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.good;
  };

  // Helper functions for Recent Activity (copied from athlete page)
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

  const getBlockIcon = (blockName: string) => {
    const icons: { [key: string]: string } = {
      'SKILLS': '🤸',
      'TECHNICAL WORK': '⚙️',
      'STRENGTH AND POWER': '💪',
      'ACCESSORIES': '🎯',
      'METCONS': '🔥'
    };
    return icons[blockName] || '📊';
  };

  const healthDisplay = getHealthStatusDisplay(athlete.recentActivity.healthStatus);

  const renderOverviewTab = () => {
    const dashboard = analyticsData.dashboard?.data?.dashboard;
    const recent = analyticsData.recent?.data?.recentSessions || [];

    return (
      <div className="space-y-6">
        {/* Athlete Header */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">{athlete.athlete.name}</h3>
              <p className="text-gray-600 capitalize">{athlete.athlete.abilityLevel}</p>
              <p className="text-sm text-gray-500">{athlete.athlete.email}</p>
            </div>
            <div className={`px-4 py-2 rounded-full ${healthDisplay.bg} ${healthDisplay.border} border`}>
              <span className={`font-medium ${healthDisplay.color}`}>
                {healthDisplay.icon} {athlete.recentActivity.healthStatus.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border">
            <div className="text-2xl font-bold text-blue-600">{athlete.recentActivity.sessionsLast14Days}</div>
            <div className="text-sm text-gray-600">Sessions (14d)</div>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <div className="text-2xl font-bold text-green-600">
              {athlete.recentActivity.daysSinceLastSession === null ? '—' : `${athlete.recentActivity.daysSinceLastSession}d`}
            </div>
            <div className="text-sm text-gray-600">Since Last</div>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <div className="text-2xl font-bold text-purple-600">
              {dashboard?.overallMetrics?.averageRPE?.toFixed(1) || '—'}
            </div>
            <div className="text-sm text-gray-600">Avg RPE</div>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <div className="text-2xl font-bold text-orange-600">
              {dashboard?.overallMetrics?.totalExercises || '—'}
            </div>
            <div className="text-sm text-gray-600">Total Exercises</div>
          </div>
        </div>

        {/* Recent Activity - NOW WITH COMPLETE FUNCTIONAL PARITY */}
        <div className="bg-white rounded-lg border p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Recent Training Activity</h4>
          {recent.length > 0 ? (
            <div className="space-y-4">
              {recent.slice(0, 5).map((session: any, index: number) => (
                <Link 
                  key={session.sessionId || index}
                  href={`/dashboard/session-review/${athlete.athlete.id}-${session.programId}-${session.week}-${session.day}`}
                  className="block border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-200 hover:border-blue-300 cursor-pointer"
                >
                  {/* Date and Session Info */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="text-lg font-semibold text-gray-900">
                        {formatDate(session.date)}
                      </div>
                      <div className="text-sm text-gray-500">
                        Week {session.week}, Day {session.day}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-blue-600">
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
                        <span className="mr-1">{getBlockIcon(block.blockName)}</span>
                        {block.blockName}
                        {block.exerciseCount > 0 && (
                          <span className="ml-1 text-blue-600">({block.exerciseCount})</span>
                        )}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-400 text-4xl mb-2">📊</div>
              <p className="text-gray-500">No recent activity found</p>
              <p className="text-sm text-gray-400 mt-1">This athlete hasn't logged any workouts recently</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderNotesTab = () => {
    return (
      <div className="space-y-6">
        {/* Add New Note */}
        <div className="bg-white rounded-lg border p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Add Coach Note</h4>
          <div className="space-y-4">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note about this athlete's progress, technique, goals, etc..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={4}
            />
            <button
              onClick={addCoachNote}
              disabled={!newNote.trim() || addingNote}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addingNote ? 'Adding...' : 'Add Note'}
            </button>
          </div>
        </div>

        {/* Coach Notes History */}
        <div className="bg-white rounded-lg border p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Coach Notes History</h4>
          {coachNotes.length > 0 ? (
            <div className="space-y-4">
              {coachNotes.map((note) => (
                <div key={note.id} className="border-l-4 border-blue-500 pl-4 py-2">
                  <p className="text-gray-800">{note.content}</p>
                  <div className="text-sm text-gray-500 mt-1">
                    {new Date(note.created_at).toLocaleDateString()} at {new Date(note.created_at).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No notes yet. Add your first coaching note above.</p>
          )}
        </div>
      </div>
    );
  };

const renderSkillsTab = () => {
  const skillsData = analyticsData.skills?.data?.skillsAnalysis;
  const skillsSummary = analyticsData.skills?.data?.summary;
  const skillsCharts = analyticsData.skills?.data?.charts;
  
  if (!skillsData?.skills) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="text-center py-8">
          <div className="text-gray-400 text-4xl mb-2">🤸</div>
          <p className="text-gray-500">No skills data available for this athlete</p>
          <p className="text-sm text-gray-400 mt-1">Skills analytics will appear once the athlete logs skill exercises</p>
        </div>
      </div>
    );
  }

  const skills = Object.values(skillsData.skills) as any[];

  return (
    <div className="space-y-6">
      {/* Skills Development Overview */}
      {skillsSummary && (
        <div className="bg-white rounded-lg border p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-6">Skills Development Overview</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-3xl font-bold text-blue-600">{skillsSummary.totalSkills || 0}</div>
              <div className="text-sm text-blue-700 font-medium">Skills Practiced</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-3xl font-bold text-green-600">{skillsSummary.masteredSkills || 0}</div>
              <div className="text-sm text-green-700 font-medium">Grade A Skills</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="text-3xl font-bold text-purple-600">{skillsSummary.totalReps || 0}</div>
              <div className="text-sm text-purple-700 font-medium">Total Reps</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="text-3xl font-bold text-orange-600">{skillsSummary.averageRPE?.toFixed(1) || '0.0'}</div>
              <div className="text-sm text-orange-700 font-medium">Average RPE</div>
            </div>
          </div>
        </div>
      )}

      {/* Skills Progress Charts */}
      {skillsData && (
        <div className="bg-white rounded-lg border p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-6">Skills Progress Charts</h4>
          
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Total Reps Completed</h4>
              <div className="h-64">
                <Bar data={{
                  labels: skills.map((skill: any) => skill.name),
                  datasets: [
                    {
                      label: 'Total Reps',
                      data: skills.map((skill: any) => skill.totalReps || 0),
                      backgroundColor: 'rgba(54, 162, 235, 0.6)',
                      borderColor: 'rgba(54, 162, 235, 1)',
                      borderWidth: 1
                    }
                  ]
                }} options={{
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
                <Bar data={{
                  labels: skills.map((skill: any) => skill.name),
                  datasets: [
                    {
                      label: 'Average RPE',
                      data: skills.map((skill: any) => skill.avgRPE || 0),
                      backgroundColor: 'rgba(255, 99, 132, 0.6)',
                      borderColor: 'rgba(255, 99, 132, 1)',
                      borderWidth: 1
                    }
                  ]
                }} options={{
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
      )}

      {/* Individual Skills Progress */}
      <div className="bg-white rounded-lg border p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-6">Individual Skills Progress</h4>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((skill: any) => (
            <div key={skill.name} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <h5 className="font-medium text-gray-900">{skill.name}</h5>
                <div className="flex flex-wrap gap-1">
                  {/* Rep Badge */}
                  {skill.totalReps >= 1000 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      🏆 Master
                    </span>
                  )}
                  {skill.totalReps >= 500 && skill.totalReps < 1000 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      💎 Diamond
                    </span>
                  )}
                  {skill.totalReps >= 250 && skill.totalReps < 500 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      🥇 Gold
                    </span>
                  )}
                  {skill.totalReps >= 100 && skill.totalReps < 250 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      🥈 Silver
                    </span>
                  )}
                  {skill.totalReps >= 50 && skill.totalReps < 100 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                      🥉 Bronze
                    </span>
                  )}
                  
                  {/* Practice Status */}
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    skill.daysSinceLast <= 3 ? 'bg-green-100 text-green-800' :
                    skill.daysSinceLast <= 7 ? 'bg-yellow-100 text-yellow-800' :
                    skill.daysSinceLast <= 14 ? 'bg-orange-100 text-orange-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {skill.daysSinceLast}d ago
                  </span>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Sessions:</span>
                  <span className="font-medium">{skill.sessions?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Reps:</span>
                  <span className="font-medium">{skill.totalReps || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Quality Grade:</span>
                  <span className={`font-medium px-2 py-1 rounded text-xs ${
                    skill.qualityGrade === 'A' ? 'bg-green-100 text-green-800' :
                    skill.qualityGrade === 'B' ? 'bg-blue-100 text-blue-800' :
                    skill.qualityGrade === 'C' ? 'bg-yellow-100 text-yellow-800' :
                    skill.qualityGrade === 'D' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {skill.qualityGrade || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg RPE:</span>
                  <span className="font-medium">{skill.avgRPE?.toFixed(1) || 'N/A'}</span>
                </div>
              </div>

              {/* Progress toward next milestone */}
              {(() => {
                const milestones = [50, 100, 250, 500, 1000];
                const nextMilestone = milestones.find(m => m > skill.totalReps);
                const badgeNames = { 50: 'Bronze', 100: 'Silver', 250: 'Gold', 500: 'Diamond', 1000: 'Master' };
                
                if (nextMilestone) {
                  const remaining = nextMilestone - skill.totalReps;
                  const progress = (skill.totalReps / nextMilestone) * 100;
                  return (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="text-xs text-gray-600 mb-1">
                        {remaining} more reps for {badgeNames[nextMilestone as keyof typeof badgeNames]}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(10, progress)}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const renderStrengthTab = () => {
  const strengthData = analyticsData.strength?.data?.strengthAnalysis;
  
  if (!strengthData?.movements) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="text-center py-8">
          <div className="text-gray-400 text-4xl mb-2">💪</div>
          <p className="text-gray-500">No strength data available for this athlete</p>
          <p className="text-sm text-gray-400 mt-1">Strength analytics will appear once the athlete logs strength exercises</p>
        </div>
      </div>
    );
  }

  // Create chart data from strength movements - EXACT COPY FROM ATHLETE PAGE
  const movementNames = Object.keys(strengthData.movements);
  const movementData = movementNames.map(name => {
    const movement = strengthData.movements[name];
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
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-6">Strength Progress Analysis</h4>
        
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


// Add this MetConExerciseHeatMap component before the renderMetConsTab function
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
      <div className="bg-white rounded-lg border p-6">
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
    <div className="bg-white rounded-lg border p-6">
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
            This athlete's overall fitness score is <strong>{globalFitnessScore}%</strong> based on {exercises.length} exercises 
            across {timeDomains.length} time domains from {data.totalCompletedWorkouts} completed workouts. 
            Scores are weighted by training frequency to reflect their actual fitness level.
          </p>
        </div>
      )}
    </div>
  );
};

// Updated MetCons Tab Function
const renderMetConsTab = () => {
  const metconData = analyticsData.metcons?.data;
  
  if (!metconData?.exercises?.length) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="text-center py-8">
          <div className="text-gray-400 text-4xl mb-2">🔥</div>
          <p className="text-gray-500">No MetCon data available for this athlete</p>
          <p className="text-sm text-gray-400 mt-1">Conditioning analytics will appear once the athlete logs MetCon exercises</p>
        </div>
      </div>
    );
  }

  // Create time domain chart from heatmap data - COPY FROM ATHLETE PAGE
  const timeDomainChartData = {
    labels: metconData?.timeDomains || [],
    datasets: [
      {
        label: 'Average Percentile',
        data: (metconData?.timeDomains || []).map((domain: string) => {
          // Calculate average for this time domain from heatmap cells
          const domainCells = metconData?.heatmapCells?.filter((cell: any) => cell.time_range === domain) || [];
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

  return (
    <div className="space-y-6">
      {/* Heat Map - EXACT COPY FROM ATHLETE PAGE */}
      <MetConExerciseHeatMap data={metconData} />
       
      {/* Chart Section - EXACT COPY FROM ATHLETE PAGE */}
      <div className="bg-white rounded-lg border p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Conditioning Performance</h4>
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
              {(metconData?.timeDomains || []).map((timeRange: string) => {
                // Calculate average for this time domain
                const domainCells = metconData?.heatmapCells?.filter((cell: any) => cell.time_range === timeRange) || [];
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
            <div className="space-y-2 text-sm">
              <p><strong>Total Workouts:</strong> {metconData.totalCompletedWorkouts || 0}</p>
              <p><strong>Time Domains:</strong> {metconData.timeDomains?.length || 0}</p>
              <p><strong>Average Percentile:</strong> {metconData.globalFitnessScore || 0}%</p>
              <p><strong>Exercises Tracked:</strong> {metconData.exercises?.length || 0}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

if (loading && Object.keys(analyticsData).length === 0) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
          <p className="text-gray-600">Loading athlete analytics...</p>
        </div>
      </div>
    </div>
  );
}

return (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg w-full max-w-6xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <h2 className="text-2xl font-bold text-gray-900">
          Athlete Analytics: {athlete.athlete.name}
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
        >
          ×
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b bg-gray-50 px-6">
        {[
          { id: 'overview', name: 'Overview', icon: '📊' },
          { id: 'skills', name: 'Skills', icon: '🤸' },
          { id: 'strength', name: 'Strength', icon: '💪' },
          { id: 'metcons', name: 'MetCons', icon: '🔥' },
          { id: 'notes', name: 'Coach Notes', icon: '📝' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center space-x-2 px-6 py-4 font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.name}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'notes' && renderNotesTab()}         
        {activeTab === 'skills' && renderSkillsTab()}
        {activeTab === 'strength' && renderStrengthTab()}
        {activeTab === 'metcons' && renderMetConsTab()}
      </div>
    </div>
  </div>
);
};

export default AthleteDetailModal;
