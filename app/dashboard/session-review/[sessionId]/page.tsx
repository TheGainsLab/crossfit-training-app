'use client'

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Exercise {
  id: number;
  exercise_name: string;
  sets: string | null;
  reps: string | null;
  weight_time: string | null;
  rpe: number | null;
  quality_grade: string | null;
  result: string | null;
  logged_at: string;
}

interface SessionData {
  sessionInfo: {
    userId: number;
    programId: number;
    week: number;
    day: number;
    date: string;
    totalExercises: number;
    blocks: string[];
  };
  exercises: Record<string, Exercise[]>;
  metconData?: {
    metcon_id: number;
    user_score: string;
    percentile: string;
    performance_tier: string;
    metcon: {
      workout_id: string;
      format: string;
      tasks: any[];
    };
  };
  hasMetcons: boolean;
}

export default function SessionReviewPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      fetchSessionData();
    }
  }, [sessionId]);

  const fetchSessionData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/session/${sessionId}`);
      const data = await response.json();

      if (data.success) {
        setSessionData(data.data);
      } else {
        setError(data.error || 'Failed to load session data');
      }
    } catch (err) {
      console.error('Error fetching session data:', err);
      setError('Failed to load session data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };


  const getBlockColor = (blockName: string) => {
    const colors: { [key: string]: string } = {
      'SKILLS': 'from-purple-500 to-purple-600',
      'TECHNICAL WORK': 'from-blue-500 to-blue-600',
      'STRENGTH AND POWER': 'from-red-500 to-red-600',
      'ACCESSORIES': 'from-green-500 to-green-600',
      'METCONS': 'from-orange-500 to-orange-600'
    };
    return colors[blockName] || 'from-gray-500 to-gray-600';
  };

  const getPerformanceTierColor = (tier: string) => {
    switch (tier) {
      case 'Advanced': return 'text-green-700 bg-green-100';
      case 'Good': return 'text-blue-700 bg-blue-100';
      case 'Average': return 'text-yellow-700 bg-yellow-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const renderExerciseRow = (exercise: Exercise) => {
    const sets = exercise.sets || '-';
    const reps = exercise.reps || '-';
    const weightTime = exercise.weight_time || (exercise.exercise_name.toLowerCase().includes('push-ups') || 
                                               exercise.exercise_name.toLowerCase().includes('air squats') || 
                                               exercise.exercise_name.toLowerCase().includes('pull-ups') ? 'BW' : '-');
    const rpe = exercise.rpe || '-';
    const quality = exercise.quality_grade || '-';

    return (
      <tr key={exercise.id} className="border-b border-gray-100 hover:bg-gray-50">
        <td className="py-3 px-4 font-medium text-gray-900">{exercise.exercise_name}</td>
        <td className="py-3 px-4 text-center text-gray-700">{sets}</td>
        <td className="py-3 px-4 text-center text-gray-700">{reps}</td>
        <td className="py-3 px-4 text-center text-gray-700">{weightTime}</td>
        <td className="py-3 px-4 text-center text-gray-700">{rpe}</td>
        <td className="py-3 px-4 text-center">
          <span className={`inline-block px-2 py-1 rounded text-sm font-semibold ${
            quality === 'A' ? 'bg-green-100 text-green-800' :
            quality === 'B' ? 'bg-blue-100 text-blue-800' :
            quality === 'C' ? 'bg-yellow-100 text-yellow-800' :
            quality === 'D' ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {quality}
          </span>
        </td>
      </tr>
    );
  };

const renderStandardBlock = (blockName: string, exercises: Exercise[]) => {
    return (
      <div key={blockName} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Block Header - ICONS REMOVED */}
        <div className={`bg-gradient-to-r ${getBlockColor(blockName)} px-6 py-4`}>
          <div className="flex items-center space-x-3">
            <div>
              <h3 className="text-xl font-bold text-white">{blockName}</h3>
              <p className="text-white/80 text-sm">{exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
        
        {/* Exercise Table */}
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="py-3 px-4 text-left font-semibold text-gray-700">Exercise</th>
                  <th className="py-3 px-4 text-center font-semibold text-gray-700">Sets</th>
                  <th className="py-3 px-4 text-center font-semibold text-gray-700">Reps</th>
                  <th className="py-3 px-4 text-center font-semibold text-gray-700">Wt/Time</th>
                  <th className="py-3 px-4 text-center font-semibold text-gray-700">RPE</th>
                  <th className="py-3 px-4 text-center font-semibold text-gray-700">Quality</th>
                </tr>
              </thead>
              <tbody>
                {exercises.map(renderExerciseRow)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderMetconBlock = () => {
    if (!sessionData?.hasMetcons || !sessionData?.metconData) {
      return null;
    }

    const { metconData, exercises } = sessionData;
    const metconExercises = exercises['METCONS'] || [];

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* MetCon Header - ICON REMOVED */}
        <div className={`bg-gradient-to-r ${getBlockColor('METCONS')} px-6 py-4`}>
          <div className="flex items-center space-x-3">
            <div>
              <h3 className="text-xl font-bold text-white">METCONS</h3>
              <p className="text-white/80 text-sm">Conditioning Workout</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Workout Title & Format */}
          <div className="text-center mb-6">
            <h4 className="text-2xl font-bold text-gray-900 mb-2">{metconData.metcon.workout_id}</h4>
            <p className="text-gray-600 text-lg">{metconData.metcon.format}</p>
          </div>

          {/* Score & Performance Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
              <div className="text-sm font-medium text-blue-700 mb-1">Your Score</div>
              <div className="text-2xl font-bold text-blue-900">{metconData.user_score}</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-200">
              <div className="text-sm font-medium text-purple-700 mb-1">Percentile</div>
              <div className="text-2xl font-bold text-purple-900">{metconData.percentile}%</div>
            </div>
            <div className={`rounded-lg p-4 text-center border ${getPerformanceTierColor(metconData.performance_tier)}`}>
              <div className="text-sm font-medium mb-1">Performance</div>
              <div className="text-2xl font-bold">{metconData.performance_tier}</div>
            </div>
          </div>

          {/* Exercise Breakdown */}
          {metconExercises.length > 0 && (
            <div>
              <h5 className="text-lg font-semibold text-gray-900 mb-4">Exercise Breakdown</h5>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="py-3 px-4 text-left font-semibold text-gray-700">Exercise</th>
                      <th className="py-3 px-4 text-center font-semibold text-gray-700">Sets</th>
                      <th className="py-3 px-4 text-center font-semibold text-gray-700">Reps</th>
                      <th className="py-3 px-4 text-center font-semibold text-gray-700">Wt/Time</th>
                      <th className="py-3 px-4 text-center font-semibold text-gray-700">RPE</th>
                      <th className="py-3 px-4 text-center font-semibold text-gray-700">Quality</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metconExercises.map(renderExerciseRow)}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading session details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Session</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link
            href="/dashboard/progress"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Analytics
          </Link>
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return null;
  }

  const { sessionInfo, exercises } = sessionData;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Desktop Header */}
          <div className="hidden sm:flex items-center justify-between py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Week {sessionInfo.week} Day {sessionInfo.day}
              </h1>
              <p className="text-gray-600 mt-1">{formatDate(sessionInfo.date)}</p>
              <p className="text-sm text-gray-500 mt-1">
                {sessionInfo.totalExercises} exercises across {sessionInfo.blocks.length} training blocks
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard/progress"
                className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <span>←</span>
                <span>Back to Analytics</span>
              </Link>
            </div>
          </div>

          {/* Mobile Header */}
          <div className="sm:hidden py-4">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl font-bold text-gray-900">
                Week {sessionInfo.week} Day {sessionInfo.day}
              </h1>
              <Link
                href="/dashboard/progress"
                className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 px-2 py-1 rounded"
              >
                <span>←</span>
                <span className="text-sm">Back</span>
              </Link>
            </div>
            <p className="text-gray-600 text-sm">{formatDate(sessionInfo.date)}</p>
            <p className="text-xs text-gray-500 mt-1">
              {sessionInfo.totalExercises} exercises • {sessionInfo.blocks.length} blocks
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="space-y-6">
          {/* Render MetCons first if they exist */}
          {sessionData.hasMetcons && renderMetconBlock()}
          
          {/* Render other training blocks */}
          {Object.entries(exercises)
            .filter(([blockName]) => blockName !== 'METCONS')
            .sort(([a], [b]) => {
              // Sort blocks in a logical order
              const order = ['SKILLS', 'TECHNICAL WORK', 'STRENGTH AND POWER', 'ACCESSORIES'];
              return order.indexOf(a) - order.indexOf(b);
            })
            .map(([blockName, blockExercises]) => 
              renderStandardBlock(blockName, blockExercises)
            )}
        </div>
      </main>
    </div>
  );
}
