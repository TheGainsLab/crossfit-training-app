import React, { useState, useEffect } from 'react';

interface AthleteDetailModalProps {
  athlete: any;
  onClose: () => void;
}

const AthleteDetailModal: React.FC<AthleteDetailModalProps> = ({ athlete, onClose }) => {
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
      // Fetch all analytics using your existing APIs
      const [dashboardRes, skillsRes, strengthRes, metconsRes, recentRes] = await Promise.allSettled([
        fetch(`/api/analytics/${athlete.id}/dashboard`),
        fetch(`/api/analytics/${athlete.id}/skills-analytics`),
        fetch(`/api/analytics/${athlete.id}/strength-tracker`),
        fetch(`/api/analytics/${athlete.id}/exercise-heatmap`),
        fetch(`/api/analytics/${athlete.id}/recent-activity`)
      ]);

      const data: any = {};

      if (dashboardRes.status === 'fulfilled' && dashboardRes.value.ok) {
        data.dashboard = await dashboardRes.value.json();
      }
      if (skillsRes.status === 'fulfilled' && skillsRes.value.ok) {
        data.skills = await skillsRes.value.json();
      }
      if (strengthRes.status === 'fulfilled' && strengthRes.value.ok) {
        data.strength = await strengthRes.value.json();
      }
      if (metconsRes.status === 'fulfilled' && metconsRes.value.ok) {
        data.metcons = await metconsRes.value.json();
      }
      if (recentRes.status === 'fulfilled' && recentRes.value.ok) {
        data.recent = await recentRes.value.json();
      }

      setAnalyticsData(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
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
        </div>
      </div>
    </div>
  );
};

export default AthleteDetailModal;
