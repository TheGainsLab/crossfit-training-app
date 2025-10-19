'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface StrengthAnalysis {
  bodyweight: number;
  backSquat: number;
  deadlift: number;
  benchPress: number;
}

interface StrengthThresholds {
  beginner: number;
  intermediate: number;
  advanced: number;
  elite: number;
}

interface ThresholdsSet {
  backSquat: StrengthThresholds;
  deadlift: StrengthThresholds;
  benchPress: StrengthThresholds;
}

interface OlympicAnalysis {
  snatch: number;
  cleanAndJerk: number;
}

interface SquatAnalysis {
  frontSquat: number;
  overheadSquat: number;
}

interface PressingAnalysis {
  strictPress: number;
  pushPress: number;
}

const MALE_THRESHOLDS: ThresholdsSet = {
  backSquat: { beginner: 1.0, intermediate: 1.4, advanced: 1.8, elite: 2.4 },
  deadlift: { beginner: 1.3, intermediate: 1.6, advanced: 2.2, elite: 2.7 },
  benchPress: { beginner: 0.8, intermediate: 1.1, advanced: 1.4, elite: 1.7 }
};

const FEMALE_THRESHOLDS: ThresholdsSet = {
  backSquat: { beginner: 0.9, intermediate: 1.2, advanced: 1.5, elite: 1.9 },
  deadlift: { beginner: 1.1, intermediate: 1.3, advanced: 1.7, elite: 2.1 },
  benchPress: { beginner: 0.6, intermediate: 0.8, advanced: 1.0, elite: 1.3 }
};

function getNextLevelTarget(ratio: number, thresholds: StrengthThresholds, bodyweight: number): { level: string; weight: number } | null {
  if (ratio >= thresholds.elite) return null;
  
  let nextThreshold: number;
  let nextLevel: string;
  
  if (ratio < thresholds.beginner) {
    nextThreshold = thresholds.beginner;
    nextLevel = 'Beginner';
  } else if (ratio < thresholds.intermediate) {
    nextThreshold = thresholds.intermediate;
    nextLevel = 'Intermediate';
  } else if (ratio < thresholds.advanced) {
    nextThreshold = thresholds.advanced;
    nextLevel = 'Advanced';
  } else {
    nextThreshold = thresholds.elite;
    nextLevel = 'Elite';
  }
  
  const targetWeight = Math.round(nextThreshold * bodyweight);
  return { level: nextLevel, weight: targetWeight };
}

const getNextLevelRatio = (currentRatio: number, thresholds: StrengthThresholds) => {
  if (currentRatio < thresholds.beginner) return thresholds.beginner;
  if (currentRatio < thresholds.intermediate) return thresholds.intermediate;
  if (currentRatio < thresholds.advanced) return thresholds.advanced;
  return thresholds.elite;
};

interface BarChartProps {
  value: number;
  target: number;
  label: string;
  weightTarget?: number;
}

function BarChart({ value, target, label, weightTarget }: BarChartProps) {
  const progressTowardTarget = Math.min((value / target) * 100, 100);
  const roundedTarget = Math.round(weightTarget || 0);
  const targetPercentage = Math.round(target * 100);
  
  const cleanLabel = label.includes('Snatch') ? 'Snatch Target' : 'Clean & Jerk Target';
  
  return (
    <div className="mb-5">
      <div className="mb-2 text-sm">
        {cleanLabel}: <span className="text-[#FE5858] font-bold">{roundedTarget} lbs</span> ({targetPercentage}% of Back Squat)
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-10 bg-gray-100 rounded-lg relative overflow-hidden">
          <div 
            className="h-full bg-green-500 transition-all duration-300 rounded-lg"
            style={{ width: `${progressTowardTarget}%` }}
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-bold text-gray-800">
            {Math.round(value * (weightTarget || 0) / target)} lbs • {value.toFixed(2)}x
          </div>
        </div>
        <div className="text-sm font-bold text-[#FE5858] min-w-[60px] text-right">
          {target.toFixed(2)}x
        </div>
      </div>
    </div>
  );
}

export default function LiftsPage() {
  const [isMale, setIsMale] = useState(true);
  const [strengthAnalysis, setStrengthAnalysis] = useState<StrengthAnalysis>({
    bodyweight: 0,
    backSquat: 0,
    deadlift: 0,
    benchPress: 0,
  });
  const [olympicAnalysis, setOlympicAnalysis] = useState<OlympicAnalysis>({
    snatch: 0,
    cleanAndJerk: 0,
  });
  const [squatAnalysis, setSquatAnalysis] = useState<SquatAnalysis>({
    frontSquat: 0,
    overheadSquat: 0,
  });
  const [pressingAnalysis, setPressingAnalysis] = useState<PressingAnalysis>({
    strictPress: 0,
    pushPress: 0,
  });
  const [showAnalysis, setShowAnalysis] = useState(false);

  const handleStrengthAnalysisChange = (field: keyof StrengthAnalysis, value: number) => {
    setStrengthAnalysis(prev => ({ ...prev, [field]: value }));
  };

  const handleOlympicAnalysisChange = (field: keyof OlympicAnalysis, value: number) => {
    setOlympicAnalysis(prev => ({ ...prev, [field]: value }));
  };

  const handleSquatAnalysisChange = (field: keyof SquatAnalysis, value: number) => {
    setSquatAnalysis(prev => ({ ...prev, [field]: value }));
  };

  const handlePressingAnalysisChange = (field: keyof PressingAnalysis, value: number) => {
    setPressingAnalysis(prev => ({ ...prev, [field]: value }));
  };

  const calculateStrengthRatios = () => {
    if (strengthAnalysis.bodyweight === 0) return null;
    return {
      backSquatRatio: strengthAnalysis.backSquat / strengthAnalysis.bodyweight,
      deadliftRatio: strengthAnalysis.deadlift / strengthAnalysis.bodyweight,
      benchPressRatio: strengthAnalysis.benchPress / strengthAnalysis.bodyweight,
    };
  };

  const calculateOlympicRatios = () => {
    if (strengthAnalysis.backSquat === 0) return null;
    return {
      snatchToBackSquat: olympicAnalysis.snatch / strengthAnalysis.backSquat,
      cleanAndJerkToBackSquat: olympicAnalysis.cleanAndJerk / strengthAnalysis.backSquat,
    };
  };

  const calculateSquatRatios = () => {
    if (strengthAnalysis.backSquat === 0) return null;
    return {
      frontSquatToBackSquat: squatAnalysis.frontSquat / strengthAnalysis.backSquat,
      overheadSquatToBackSquat: squatAnalysis.overheadSquat / strengthAnalysis.backSquat,
    };
  };

  const calculatePressingRatios = () => {
    if (strengthAnalysis.benchPress === 0 || pressingAnalysis.strictPress === 0) return null;
    return {
      pushPressToBenchPress: pressingAnalysis.pushPress / strengthAnalysis.benchPress,
    };
  };

  const runAllAnalyses = () => {
    setShowAnalysis(true);
  };

  const strengthRatios = calculateStrengthRatios();
  const thresholds = isMale ? MALE_THRESHOLDS : FEMALE_THRESHOLDS;
  const backSquatNextLevel = strengthRatios ? getNextLevelTarget(strengthRatios.backSquatRatio, thresholds.backSquat, strengthAnalysis.bodyweight) : null;
  const deadliftNextLevel = strengthRatios ? getNextLevelTarget(strengthRatios.deadliftRatio, thresholds.deadlift, strengthAnalysis.bodyweight) : null;
  const benchPressNextLevel = strengthRatios ? getNextLevelTarget(strengthRatios.benchPressRatio, thresholds.benchPress, strengthAnalysis.bodyweight) : null;

  return (
    <div className="max-w-7xl mx-auto p-5 font-sans">
      <div className="mb-6">
        <Link href="/" className="inline-flex items-center text-[#FE5858] hover:text-[#ff6b6b] font-medium transition-colors">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>
      </div>

      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold mb-2">CrossFit Strength Analyzer</h1>
        <p className="text-gray-600">Assess your strength levels and identify areas for improvement</p>
      </div>

      <div className="bg-white p-8 rounded-xl shadow-md mb-8">
        <h2 className="text-2xl font-bold mb-4">Strength Assessment Input</h2>
        <p className="text-gray-600 mb-6">Enter all your one-rep maxes below, then click &quot;Run All Analyses&quot; to see your complete strength assessment</p>
        
        <div className="mb-6">
          <label className="block mb-2 font-medium">Gender</label>
          <div className="flex gap-3">
            <button 
              className={`px-6 py-2.5 border-2 border-[#FE5858] rounded-lg font-medium transition-all ${
                isMale ? 'bg-[#FE5858] text-white' : 'bg-white text-[#FE5858]'
              }`}
              onClick={() => setIsMale(true)}
            >
              Male
            </button>
            <button 
              className={`px-6 py-2.5 border-2 border-[#FE5858] rounded-lg font-medium transition-all ${
                !isMale ? 'bg-[#FE5858] text-white' : 'bg-white text-[#FE5858]'
              }`}
              onClick={() => setIsMale(false)}
            >
              Female
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
          <div>
            <label className="block mb-2 font-medium">Bodyweight (lbs)</label>
            <input 
              type="number" 
              value={strengthAnalysis.bodyweight || ''} 
              onChange={(e) => handleStrengthAnalysisChange('bodyweight', parseInt(e.target.value) || 0)}
              placeholder="e.g., 180"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#FE5858] focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block mb-2 font-medium">Back Squat Max (lbs)</label>
            <input 
              type="number" 
              value={strengthAnalysis.backSquat || ''} 
              onChange={(e) => handleStrengthAnalysisChange('backSquat', parseInt(e.target.value) || 0)}
              placeholder="e.g., 350"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#FE5858] focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block mb-2 font-medium">Deadlift Max (lbs)</label>
            <input 
              type="number" 
              value={strengthAnalysis.deadlift || ''} 
              onChange={(e) => handleStrengthAnalysisChange('deadlift', parseInt(e.target.value) || 0)}
              placeholder="e.g., 400"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#FE5858] focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block mb-2 font-medium">Bench Press Max (lbs)</label>
            <input 
              type="number" 
              value={strengthAnalysis.benchPress || ''} 
              onChange={(e) => handleStrengthAnalysisChange('benchPress', parseInt(e.target.value) || 0)}
              placeholder="e.g., 250"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#FE5858] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block mb-2 font-medium">Snatch Max (lbs)</label>
            <input 
              type="number" 
              value={olympicAnalysis.snatch || ''} 
              onChange={(e) => handleOlympicAnalysisChange('snatch', parseInt(e.target.value) || 0)}
              placeholder="e.g., 250"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#FE5858] focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block mb-2 font-medium">Clean & Jerk Max (lbs)</label>
            <input 
              type="number" 
              value={olympicAnalysis.cleanAndJerk || ''} 
              onChange={(e) => handleOlympicAnalysisChange('cleanAndJerk', parseInt(e.target.value) || 0)}
              placeholder="e.g., 300"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#FE5858] focus:border-transparent"
            />
          </div>
        
          <div>
            <label className="block mb-2 font-medium">Front Squat Max (lbs)</label>
            <input 
              type="number" 
              value={squatAnalysis.frontSquat || ''} 
              onChange={(e) => handleSquatAnalysisChange('frontSquat', parseInt(e.target.value) || 0)}
              placeholder="e.g., 300"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#FE5858] focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block mb-2 font-medium">Overhead Squat Max (lbs)</label>
            <input 
              type="number" 
              value={squatAnalysis.overheadSquat || ''} 
              onChange={(e) => handleSquatAnalysisChange('overheadSquat', parseInt(e.target.value) || 0)}
              placeholder="e.g., 200"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#FE5858] focus:border-transparent"
            />
          </div>
        
          <div>
            <label className="block mb-2 font-medium">Strict Press Max (lbs)</label>
            <input 
              type="number" 
              value={pressingAnalysis.strictPress || ''} 
              onChange={(e) => handlePressingAnalysisChange('strictPress', parseInt(e.target.value) || 0)}
              placeholder="e.g., 150"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#FE5858] focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block mb-2 font-medium">Push Press Max (lbs)</label>
            <input 
              type="number" 
              value={pressingAnalysis.pushPress || ''} 
              onChange={(e) => handlePressingAnalysisChange('pushPress', parseInt(e.target.value) || 0)}
              placeholder="e.g., 200"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#FE5858] focus:border-transparent"
            />
          </div>
        </div>

        <button 
          onClick={runAllAnalyses}
          className="w-full py-3.5 bg-[#FE5858] text-white border-none rounded-lg text-base font-semibold cursor-pointer transition-colors hover:bg-[#ff6b6b]"
        >
          Run All Analyses
        </button>
      </div>

      {showAnalysis && strengthRatios && (
        <>
          <div className="bg-white p-8 rounded-xl shadow-md mb-8">
            <h2 className="text-2xl font-bold mb-6">Strength Analysis</h2>
            
            <div>
              <div className="mb-5">
                <div className="mb-2 text-sm">
                  Back Squat Target: <span className="text-[#FE5858] font-bold">{Math.round(strengthAnalysis.bodyweight * thresholds.backSquat.intermediate)} lbs</span> ({isMale ? '1.4x' : '1.2x'} Bodyweight)
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-10 bg-gray-100 rounded-lg relative overflow-hidden">
                    <div 
                      className="h-full bg-green-500 transition-all duration-300 rounded-lg"
                      style={{ 
                        width: `${Math.min(strengthRatios.backSquatRatio / getNextLevelRatio(strengthRatios.backSquatRatio, thresholds.backSquat) * 100, 100)}%`
                      }}
                    />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-bold text-gray-800">
                      {strengthAnalysis.backSquat} lbs • {strengthRatios.backSquatRatio.toFixed(2)}x
                    </div>
                  </div>
                  <div className="text-sm font-bold text-[#FE5858] min-w-[60px] text-right">
                    {backSquatNextLevel?.level === 'Intermediate' ? (isMale ? '1.4x' : '1.2x') : 
                     backSquatNextLevel?.level === 'Advanced' ? (isMale ? '1.8x' : '1.5x') : 
                     (isMale ? '2.4x' : '1.9x')}
                  </div>
                </div>
                {backSquatNextLevel && (
                  <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">Next Level: {backSquatNextLevel.level}</span>
                    <span className="text-[#FE5858] font-bold"> {backSquatNextLevel.weight} lbs</span>
                  </div>
                )}
              </div>

              <div className="mb-5">
                <div className="mb-2 text-sm">
                  Deadlift Target: <span className="text-[#FE5858] font-bold">{Math.round(strengthAnalysis.bodyweight * thresholds.deadlift.intermediate)} lbs</span> ({isMale ? '1.6x' : '1.3x'} Bodyweight)
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-10 bg-gray-100 rounded-lg relative overflow-hidden">
                    <div 
                      className="h-full bg-green-500 transition-all duration-300 rounded-lg"
                      style={{ 
                        width: `${Math.min(strengthRatios.deadliftRatio / getNextLevelRatio(strengthRatios.deadliftRatio, thresholds.deadlift) * 100, 100)}%`
                      }}
                    />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-bold text-gray-800">
                      {strengthAnalysis.deadlift} lbs • {strengthRatios.deadliftRatio.toFixed(2)}x
                    </div>
                  </div>
                  <div className="text-sm font-bold text-[#FE5858] min-w-[60px] text-right">
                    {deadliftNextLevel?.level === 'Intermediate' ? (isMale ? '1.6x' : '1.3x') : 
                     deadliftNextLevel?.level === 'Advanced' ? (isMale ? '2.2x' : '1.7x') : 
                     (isMale ? '2.7x' : '2.1x')}
                  </div>
                </div>
                {deadliftNextLevel && (
                  <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">Next Level: {deadliftNextLevel.level}</span>
                    <span className="text-[#FE5858] font-bold"> {deadliftNextLevel.weight} lbs</span>
                  </div>
                )}
              </div>

              <div className="mb-5">
                <div className="mb-2 text-sm">
                  Bench Press Target: <span className="text-[#FE5858] font-bold">{Math.round(strengthAnalysis.bodyweight * thresholds.benchPress.intermediate)} lbs</span> ({isMale ? '1.1x' : '0.8x'} Bodyweight)
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-10 bg-gray-100 rounded-lg relative overflow-hidden">
                    <div 
                      className="h-full bg-green-500 transition-all duration-300 rounded-lg"
                      style={{ 
                        width: `${Math.min(strengthRatios.benchPressRatio / getNextLevelRatio(strengthRatios.benchPressRatio, thresholds.benchPress) * 100, 100)}%`
                      }}
                    />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-bold text-gray-800">
                      {strengthAnalysis.benchPress} lbs • {strengthRatios.benchPressRatio.toFixed(2)}x
                    </div>
                  </div>
                  <div className="text-sm font-bold text-[#FE5858] min-w-[60px] text-right">
                    {benchPressNextLevel?.level === 'Intermediate' ? (isMale ? '1.1x' : '0.8x') : 
                     benchPressNextLevel?.level === 'Advanced' ? (isMale ? '1.4x' : '1.0x') : 
                     (isMale ? '1.7x' : '1.3x')}
                  </div>
                </div>
                {benchPressNextLevel && (
                  <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">Next Level: {benchPressNextLevel.level}</span>
                    <span className="text-[#FE5858] font-bold"> {benchPressNextLevel.weight} lbs</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {calculateOlympicRatios() && (
            <div className="bg-white p-8 rounded-xl shadow-md mb-8">
              <h2 className="text-2xl font-bold mb-6">Olympic Lift Analysis</h2>
              <BarChart 
                value={calculateOlympicRatios()?.snatchToBackSquat || 0}
                target={0.6}
                label="Snatch/Back Squat"
                weightTarget={strengthAnalysis.backSquat * 0.6}
              />
              <BarChart 
                value={calculateOlympicRatios()?.cleanAndJerkToBackSquat || 0}
                target={0.75}
                label="Clean & Jerk/Back Squat"
                weightTarget={strengthAnalysis.backSquat * 0.75}
              />
            </div>
          )}

          {calculateSquatRatios() && (
            <div className="bg-white p-8 rounded-xl shadow-md mb-8">
              <h2 className="text-2xl font-bold mb-6">Squat Analysis</h2>
              
              <div className="mb-5">
                <div className="mb-2 text-sm">
                  Front Squat Target: <span className="text-[#FE5858] font-bold">{Math.round(strengthAnalysis.backSquat * 0.875)} lbs</span> (87.5% of Back Squat)
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-10 bg-gray-100 rounded-lg relative overflow-hidden">
                    <div 
                      className="h-full bg-green-500 transition-all duration-300 rounded-lg"
                      style={{ 
                        width: `${Math.min((calculateSquatRatios()?.frontSquatToBackSquat || 0) / 0.875 * 100, 100)}%`
                      }}
                    />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-bold text-gray-800">
                      {squatAnalysis.frontSquat} lbs • {calculateSquatRatios()?.frontSquatToBackSquat.toFixed(2)}x
                    </div>
                  </div>
                  <div className="text-sm font-bold text-[#FE5858] min-w-[60px] text-right">0.875x</div>
                </div>
              </div>

              <div className="mb-5">
                <div className="mb-2 text-sm">
                  Overhead Squat Target: <span className="text-[#FE5858] font-bold">{Math.round(strengthAnalysis.backSquat * 0.675)} lbs</span> (67.5% of Back Squat)
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-10 bg-gray-100 rounded-lg relative overflow-hidden">
                    <div 
                      className="h-full bg-green-500 transition-all duration-300 rounded-lg"
                      style={{ 
                        width: `${Math.min((calculateSquatRatios()?.overheadSquatToBackSquat || 0) / 0.675 * 100, 100)}%`
                      }}
                    />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-bold text-gray-800">
                      {squatAnalysis.overheadSquat} lbs • {calculateSquatRatios()?.overheadSquatToBackSquat.toFixed(2)}x
                    </div>
                  </div>
                  <div className="text-sm font-bold text-[#FE5858] min-w-[60px] text-right">0.675x</div>
                </div>
              </div>
            </div>
          )}

          {calculatePressingRatios() && (
            <div className="bg-white p-8 rounded-xl shadow-md">
              <h2 className="text-2xl font-bold mb-6">Pressing Analysis</h2>
              
              <div className="mb-5">
                <div className="mb-2 text-sm">
                  Strict Press Target: <span className="text-[#FE5858] font-bold">{Math.round(strengthAnalysis.benchPress * 0.725)} lbs</span> (72.5% of Bench Press)
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-10 bg-gray-100 rounded-lg relative overflow-hidden">
                    <div 
                      className="h-full bg-green-500 transition-all duration-300 rounded-lg"
                      style={{ 
                        width: `${Math.min((pressingAnalysis.strictPress / (strengthAnalysis.benchPress * 0.725)) * 100, 100)}%`
                      }}
                    />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-bold text-gray-800">
                      {pressingAnalysis.strictPress} lbs • {(pressingAnalysis.strictPress / strengthAnalysis.benchPress).toFixed(2)}x
                    </div>
                  </div>
                  <div className="text-sm font-bold text-[#FE5858] min-w-[60px] text-right">0.725x</div>
                </div>
              </div>

              <div className="mb-5">
                <div className="mb-2 text-sm">
                  Push Press Target: <span className="text-[#FE5858] font-bold">{strengthAnalysis.benchPress} lbs</span> (100% of Bench Press)
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-10 bg-gray-100 rounded-lg relative overflow-hidden">
                    <div 
                      className="h-full bg-green-500 transition-all duration-300 rounded-lg"
                      style={{ 
                        width: `${Math.min((pressingAnalysis.pushPress / strengthAnalysis.benchPress) * 100, 100)}%`
                      }}
                    />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-bold text-gray-800">
                      {pressingAnalysis.pushPress} lbs • {(pressingAnalysis.pushPress / strengthAnalysis.benchPress).toFixed(2)}x
                    </div>
                  </div>
                  <div className="text-sm font-bold text-[#FE5858] min-w-[60px] text-right">1.00x</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
