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

  const renderExerciseRow = (exercise: Exercise) => {
    const sets = exercise.sets || '-';
    const reps = exercise.reps || '-';
    const weightTime = exercise.weight_time || '-';
    const rpe = exercise.rpe || '-';
    const quality = exercise.quality_grade || '-';

    return (
      <div key={exercise.id} className="grid grid-cols-6 gap-4 py-3 border-b border-gray-100">
        <div className="font-medium text-gray-900">{exercise.exercise_name}</div>
        <div className="text-center text-gray-700">{sets}</div>
        <div className="text-center text-gray-700">{reps}</div>
        <div className="text-center text-gray-700">{weightTime}</div>
        <div className="text-center text-gray-700">{rpe}</div>
        <div className="text-center font-medium text-gray-900">{quality}</div>
      </div>
    );
  };

  const renderBlockSection = (blockName: string, exercises: Exercise[]) => {
    return (
      <div key={blockName} className="mb-8">
        <h3 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-200">
          {blockName}
        </h3>
        
        {/* Header Row */}
        <div className="grid grid-cols-6 gap-4 py-2 bg-gray-50 rounded-t-lg font-medium text-gray-700">
          <div>Exercise</div>
          <div className="text-center">Sets</div>
          <div className="text-center">Reps</div>
          <div className="text-center">Wt/Time</div>
          <div className="text-center">RPE</div>
          <div className="text-center">Quality</div>
        </div>
        
        {/* Exercise Rows */}
        <div className="bg-white rounded-b-lg border border-gray-200">
          {exercises.map(renderExerciseRow)}
        </div>
      </div>
    );
  };

  const renderMetconSection = () => {
    if (!sessionData?.hasMetcons || !sessionData?.metconData) {
      return null;
    }

    const { metconData, exercises } = sessionData;
    const metconExercises = exercises['METCONS'] || [];

    return (
      <div className="mb-8">
        <h3 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-200">
          METCONS
        </h3>
        
        {/* MetCon Header with Score Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h4 className="text-lg font-semibold text-blue-900">
                {metconData.metcon.workout_id}
              </h4>
              <p className="text-blue-700">{metconData.metcon.format}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 text-sm">
              <div className="bg-white px-3 py-2 rounded border">
                <span className="font-medium">Score:</span> {metconData.user_score}
              </div>
              <div className="bg-white px-3 py-2 rounded border">
                <span className="font-medium">Percentile:</span> {metconData.percentile}%
              </div>
              <div className="bg-white px-3 py-2 rounded border">
                <span className="font-medium">Tier:</span> {metconData.performance_tier}
              </div>
            </div>
          </div>
        </div>

        {/* MetCon Exercise Details */}
        {metconExercises.length > 0 && (
          <>
            <div className="grid grid-cols-6 gap-4 py-2 bg-gray-50 rounded-t-lg font-medium text-gray-700">
              <div>Exercise</div>
              <div className="text-center">Sets</div>
              <div className="text-center">Reps</div>
              <div className="text-center">Wt/Time</div>
              <div className="text-center">RPE</div>
              <div className="text-center">Quality</div>
            </div>
            <div className="bg-white rounded-b-lg border border-gray-200">
              {metconExercises.map(renderExerciseRow)}
            </div>
          </>
        )}
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
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Week {sessionInfo.week} Day {sessionInfo.day}
              </h1>
              <p className="text-gray-600">{formatDate(sessionInfo.date)}</p>
              <p className="text-sm text-gray-500">
                {sessionInfo.totalExercises} exercises across {sessionInfo.blocks.length} training blocks
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard/progress"
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                ← Back to Analytics
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Render MetCons first if they exist */}
          {sessionData.hasMetcons && renderMetconSection()}
          
          {/* Render other training blocks */}
          {Object.entries(exercises)
            .filter(([blockName]) => blockName !== 'METCONS')
            .map(([blockName, blockExercises]) => 
              renderBlockSection(blockName, blockExercises)
            )}
        </div>
      </main>
    </div>
  );
}
