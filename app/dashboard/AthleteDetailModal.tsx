import React, { useState, useEffect } from 'react';

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
    // Use the new coach analytics wrapper API
console.log('🔍 Calling URL:', `/api/coach/athlete/${athlete.athlete.id}/analytics`);  
const response = await fetch(`/api/coach/athlete/${athlete.athlete_id}/analytics`);
     
    console.log('🔍 Response Status:', response.status); // Debug line
    console.log('🔍 Response OK:', response.ok); // Debug line
    
    if (response.ok) {
      const data = await response.json();
      console.log('🔍 Full API Response:', data);
      
      if (data.success) {
        setAnalyticsData(data.data.analytics);
        console.log('🔍 Analytics Data Set:', data.data.analytics);
        console.log('✅ Coach analytics loaded successfully');
      } else {
        console.error('❌ Coach analytics API error:', data.error);
      }
    } else {
      // Parse the error response for 400 errors
      const errorData = await response.json();
      console.error('❌ Coach analytics API failed:', response.status, errorData);
    }
  } catch (error) {
    console.error('❌ Error fetching coach analytics:', error);
  } finally {
    setLoading(false);
  }
};


  const fetchCoachNotes = async () => {
    try {

const response = await fetch(`/api/coach/notes?athleteId=${athlete.athlete_id}`);


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
              <h3 className="text-2xl font-bold text-gray-900">{athlete.name}</h3>
              <p className="text-gray-600 capitalize">{athlete.abilityLevel}</p>
              <p className="text-sm text-gray-500">{athlete.email}</p>
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

        {/* Recent Activity */}
        <div className="bg-white rounded-lg border p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Recent Training Activity</h4>
          {recent.length > 0 ? (
            <div className="space-y-3">
              {recent.slice(0, 5).map((session: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium">Week {session.week}, Day {session.day}</div>
                    <div className="text-sm text-gray-600">{session.totalExercises} exercises</div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(session.date).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No recent activity found</p>
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
  
  if (!skillsData?.skills) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <p className="text-gray-500">No skills data available for this athlete</p>
      </div>
    );
  }

  const skills = Object.values(skillsData.skills) as any[];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-6">Skills Development Progress</h4>
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
        <p className="text-gray-500">No strength data available for this athlete</p>
      </div>
    );
  }

  const movements = Object.entries(strengthData.movements);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-6">Strength Progress Analysis</h4>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {movements.map(([name, movement]: [string, any]) => (
            <div key={name} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <h5 className="font-medium text-gray-900 mb-3">{name}</h5>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Sessions:</span>
                  <span className="font-medium">{movement.sessions?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Max Weight:</span>
                  <span className="font-medium text-lg text-blue-600">{movement.maxWeight || 0} lbs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Weight:</span>
                  <span className="font-medium">{movement.currentWeight || 0} lbs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg RPE:</span>
                  <span className={`font-medium ${
                    movement.avgRPE > 8 ? 'text-red-600' :
                    movement.avgRPE > 6 ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {movement.avgRPE?.toFixed(1) || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Volume:</span>
                  <span className="font-medium">{movement.totalVolume?.toLocaleString() || 0}</span>
                </div>
                
                {/* Trend indicator */}
                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                  <span className="text-gray-600">Trend:</span>
                  <span className={`font-medium text-sm px-2 py-1 rounded ${
                    movement.progressionTrend === 'improving' ? 'bg-green-100 text-green-800' :
                    movement.progressionTrend === 'declining' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {movement.progressionTrend === 'improving' ? '↗️ Improving' :
                     movement.progressionTrend === 'declining' ? '↘️ Declining' :
                     '➡️ Stable'}
                  </span>
                </div>
              </div>

              {/* Last session info */}
              {movement.sessions && movement.sessions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                  Last: Week {movement.sessions[movement.sessions.length - 1].week} - {movement.sessions[movement.sessions.length - 1].weight} lbs
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const renderMetConsTab = () => {
  const metconData = analyticsData.metcons?.data;
  
  if (!metconData?.exercises?.length) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <p className="text-gray-500">No MetCon data available for this athlete</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global Performance Summary */}
      <div className="bg-white rounded-lg border p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-6">Conditioning Performance Overview</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-3xl font-bold text-blue-600">{metconData.globalFitnessScore || 0}%</div>
            <div className="text-sm text-blue-700 font-medium">Global Fitness Score</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="text-3xl font-bold text-green-600">{metconData.exercises.length}</div>
            <div className="text-sm text-green-700 font-medium">Exercises Tracked</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="text-3xl font-bold text-purple-600">{metconData.timeDomains?.length || 0}</div>
            <div className="text-sm text-purple-700 font-medium">Time Domains</div>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div className="text-3xl font-bold text-orange-600">{metconData.totalCompletedWorkouts || 0}</div>
            <div className="text-sm text-orange-700 font-medium">Total Workouts</div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h5 className="font-medium text-gray-900 mb-2">Coach Insight</h5>
          <p className="text-sm text-gray-700">
            This athlete's global fitness score of <strong>{metconData.globalFitnessScore}%</strong> is calculated 
            from {metconData.totalCompletedWorkouts} completed workouts across {metconData.exercises.length} different 
            exercises. The full exercise-specific heat map provides detailed conditioning insights.
          </p>
        </div>
      </div>

      {/* Quick Exercise Performance Grid */}
      <div className="bg-white rounded-lg border p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Exercise Performance Snapshot</h4>
        <div className="text-sm text-gray-600 mb-4">
          Top exercises by training frequency and average performance
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {metconData.exerciseAverages?.slice(0, 12).map((exercise: any) => (
            <div key={exercise.exercise_name} className="border rounded-lg p-3 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h6 className="font-medium text-gray-900 truncate">{exercise.exercise_name}</h6>
                  <div className="text-xs text-gray-500">{exercise.total_sessions} sessions</div>
                </div>
                <div className="ml-2 text-right">
                  <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                    exercise.overall_avg_percentile >= 80 ? 'bg-green-100 text-green-800' :
                    exercise.overall_avg_percentile >= 60 ? 'bg-yellow-100 text-yellow-800' :
                    exercise.overall_avg_percentile >= 40 ? 'bg-orange-100 text-orange-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {exercise.overall_avg_percentile}%
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500">
            View the complete exercise heat map in the athlete's personal analytics for detailed conditioning insights across all time domains.
          </p>
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
            Athlete Analytics: {athlete.name}
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
