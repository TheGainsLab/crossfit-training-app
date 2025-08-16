'use client'

import React from 'react'
import Link from 'next/link'

// Program Navigation Widget Component
interface NavigationProps {
  currentWeek: number;
  currentDay: number;
  programId: number;
  onNavigate: (week: number, day: number) => void;
}

const ProgramNavigationWidget: React.FC<NavigationProps> = ({ 
  currentWeek, 
  currentDay, 
  programId, 
  onNavigate 
}) => {
  // Helper functions for navigation
  const getPreviousDay = () => {
    if (currentDay === 1) {
      if (currentWeek === 1) return null; // No previous day
      return { week: currentWeek - 1, day: 5 };
    }
    return { week: currentWeek, day: currentDay - 1 };
  };

  const getNextDay = () => {
    if (currentDay === 5) {
      if (currentWeek === 13) return null; // End of program
      return { week: currentWeek + 1, day: 1 };
    }
    return { week: currentWeek, day: currentDay + 1 };
  };

  const formatWeekLabel = (week: number) => {
    return week === 13 ? "Test Week" : `Week ${week}`;
  };

  const previousDay = getPreviousDay();
  const nextDay = getNextDay();
  const isProgramComplete = currentWeek === 13 && currentDay === 5;

  if (isProgramComplete) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="text-center py-6">
          <div className="text-4xl mb-2">🎉</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Program Complete!</h3>
          <p className="text-gray-600 mb-4">
            You've completed all 65 workouts. Ready for your next challenge?
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              href="/dashboard/progress"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              📊 Review Progress
            </Link>
            <Link
              href="/intake"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              🚀 New Program
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      {/* Navigation Controls - Desktop */}
      <div className="hidden sm:flex items-center justify-between mb-4">
        {/* Previous Workout */}
        <button
          onClick={() => previousDay && onNavigate(previousDay.week, previousDay.day)}
          disabled={!previousDay}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
            previousDay 
              ? 'text-blue-600 hover:bg-blue-50 border border-blue-200' 
              : 'text-gray-400 cursor-not-allowed border border-gray-200'
          }`}
        >
          <span>⬅️</span>
          <div className="text-left">
            <div className="text-sm font-medium">Previous</div>
            {previousDay && (
              <div className="text-xs text-gray-500">
                {formatWeekLabel(previousDay.week)}, Day {previousDay.day}
              </div>
            )}
          </div>
        </button>

        {/* Today's Workout */}
        <div className="text-center">
          <Link
            href={`/dashboard/workout/${programId}/week/${currentWeek}/day/${currentDay}`}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            <span className="mr-2">🎯</span>
            Today's Workout
          </Link>
          <div className="text-xs text-gray-500 mt-1">
            {formatWeekLabel(currentWeek)}, Day {currentDay}
          </div>
        </div>

        {/* Next Workout */}
        <button
          onClick={() => nextDay && onNavigate(nextDay.week, nextDay.day)}
          disabled={!nextDay}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
            nextDay 
              ? 'text-blue-600 hover:bg-blue-50 border border-blue-200' 
              : 'text-gray-400 cursor-not-allowed border border-gray-200'
          }`}
        >
          <div className="text-right">
            <div className="text-sm font-medium">Next</div>
            {nextDay && (
              <div className="text-xs text-gray-500">
                {formatWeekLabel(nextDay.week)}, Day {nextDay.day}
              </div>
            )}
          </div>
          <span>➡️</span>
        </button>
      </div>

      {/* Navigation Controls - Mobile */}
      <div className="sm:hidden space-y-4">
        {/* Primary Action Button */}
        <div className="text-center">
          <Link
            href={`/dashboard/workout/${programId}/week/${currentWeek}/day/${currentDay}`}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors text-lg w-full justify-center"
          >
            <span className="mr-2">🎯</span>
            Today's Workout
          </Link>
          <div className="text-sm text-gray-500 mt-2">
            {formatWeekLabel(currentWeek)}, Day {currentDay}
          </div>
        </div>

        {/* Previous/Next Navigation */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => previousDay && onNavigate(previousDay.week, previousDay.day)}
            disabled={!previousDay}
            className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
              previousDay 
                ? 'text-blue-600 hover:bg-blue-50 border border-blue-200' 
                : 'text-gray-400 cursor-not-allowed border border-gray-200'
            }`}
          >
            <span>⬅️</span>
            <span className="font-medium">Previous</span>
          </button>

          <button
            onClick={() => nextDay && onNavigate(nextDay.week, nextDay.day)}
            disabled={!nextDay}
            className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
              nextDay 
                ? 'text-blue-600 hover:bg-blue-50 border border-blue-200' 
                : 'text-gray-400 cursor-not-allowed border border-gray-200'
            }`}
          >
            <span className="font-medium">Next</span>
            <span>➡️</span>
          </button>
        </div>
      </div>

      {/* Browse Full Program Link - Compact */}
      <div className="mt-4 text-center">
        <Link
          href="/dashboard/program"
          className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center space-x-1 transition-colors"
        >
          <span>📋</span>
          <span>Browse Full Program</span>
        </Link>
      </div>
    </div>
  );
};

export default ProgramNavigationWidget;
