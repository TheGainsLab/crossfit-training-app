import React, { useState } from 'react';
import { GeneratedWorkout } from './types';
import { generateTestWorkouts, generateMLEnhancedWorkouts } from './utils';

interface StrengthAnalysis {
  bodyweight: number;
  backSquat: number;
  deadlift: number;
  benchPress: number;
}

interface StrengthThresholds {
  backSquat: { beginner: number; intermediate: number; advanced: number; elite: number };
  deadlift: { beginner: number; intermediate: number; advanced: number; elite: number };
  benchPress: { beginner: number; intermediate: number; advanced: number; elite: number };
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

// Strength thresholds by gender
const MALE_THRESHOLDS: StrengthThresholds = {
  backSquat: { beginner: 1.0, intermediate: 1.4, advanced: 1.8, elite: 2.4 },
  deadlift: { beginner: 1.3, intermediate: 1.6, advanced: 2.2, elite: 2.7 },
  benchPress: { beginner: 0.8, intermediate: 1.1, advanced: 1.4, elite: 1.7 }
};

const FEMALE_THRESHOLDS: StrengthThresholds = {
  backSquat: { beginner: 0.9, intermediate: 1.2, advanced: 1.5, elite: 1.9 },
  deadlift: { beginner: 1.1, intermediate: 1.3, advanced: 1.7, elite: 2.1 },
  benchPress: { beginner: 0.6, intermediate: 0.8, advanced: 1.0, elite: 1.3 }
};

// Function to categorize strength level
function categorizeStrength(ratio: number, thresholds: { beginner: number; intermediate: number; advanced: number; elite: number }): string {
  if (ratio >= thresholds.elite) return 'Elite';
  if (ratio >= thresholds.advanced) return 'Advanced';
  if (ratio >= thresholds.intermediate) return 'Intermediate';
  if (ratio >= thresholds.beginner) return 'Beginner';
  return 'Below Beginner';
}

// Function to get next level target
function getNextLevelTarget(ratio: number, thresholds: { beginner: number; intermediate: number; advanced: number; elite: number }, bodyweight: number): { level: string; weight: number } | null {
  if (ratio >= thresholds.elite) return null; // Already at highest level
  
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

  // Helper function to get next level target ratio
  const getNextLevelRatio = (currentRatio: number, thresholds: { beginner: number; intermediate: number; advanced: number; elite: number }, isMale: boolean) => {
    if (currentRatio < thresholds.beginner) return thresholds.beginner;
    if (currentRatio < thresholds.intermediate) return thresholds.intermediate;
    if (currentRatio < thresholds.advanced) return thresholds.advanced;
    return thresholds.elite;
  };

// Bar Chart Component for Olympic Lift Analysis
interface BarChartProps {
  value: number;
  target: number;
  label: string;
  maxValue?: number;
  weightTarget?: number;
}

function BarChart({ value, target, label, maxValue = 1.0, weightTarget }: BarChartProps) {
  // Calculate progress toward target (0-100%)
  const progressTowardTarget = Math.min((value / target) * 100, 100);
  const isBalanced = value >= target;
  const roundedTarget = Math.round(weightTarget || 0);
  const targetPercentage = Math.round(target * 100);
  
  // Create cleaner label based on the lift type
  const cleanLabel = label.includes('Snatch') ? 'Snatch Target' : 'Clean & Jerk Target';
  
  return (
    <div className="bar-chart">
      <div className="bar-chart-label">
        {cleanLabel}: <span style={{ color: '#FE5858' }}>{roundedTarget} lbs</span> ({targetPercentage}% of Back Squat)
      </div>
      <div className="bar-chart-container">
        <div className="bar-chart-bar olympic-bar">
          <div 
            className="bar-fill olympic-fill"
            style={{ width: `${progressTowardTarget}%` }}
          />
          <div className="bar-target-text">{Math.round(value * (weightTarget || 0) / target)} lbs • {value.toFixed(2)}x</div>
        </div>
        <div className="bar-chart-value" style={{ color: '#FE5858' }}>{target.toFixed(2)}x</div>
      </div>
    </div>
  );
}

function App() {
  const [generatedWorkouts, setGeneratedWorkouts] = useState<GeneratedWorkout[]>([]);
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
  const [showStrengthRatios, setShowStrengthRatios] = useState(false);
  const [showOlympicRatios, setShowOlympicRatios] = useState(false);
  const [showSquatRatios, setShowSquatRatios] = useState(false);
  const [showPressingRatios, setShowPressingRatios] = useState(false);
  const [useMLEnhancement, setUseMLEnhancement] = useState(false);
  const [isGeneratingML, setIsGeneratingML] = useState(false);

  const generateWorkouts = async () => {
    if (useMLEnhancement) {
      setIsGeneratingML(true);
      try {
        const workouts = await generateMLEnhancedWorkouts();
        setGeneratedWorkouts(workouts);
      } catch (error) {
        console.error('ML generation failed, falling back to standard:', error);
        const workouts = generateTestWorkouts();
        setGeneratedWorkouts(workouts);
      } finally {
        setIsGeneratingML(false);
      }
    } else {
      const workouts = generateTestWorkouts();
      setGeneratedWorkouts(workouts);
    }
  };

  const exportWorkouts = () => {
    const workouts = [];
    
    // Generate 100 workouts balanced across time domains (20 per domain)
    // We'll generate 10 sets of 10 workouts (2 per time domain) to ensure balance
    for (let set = 0; set < 10; set++) {
      const workoutSet = generateTestWorkouts(); // This generates 10 workouts (2 per time domain)
      
      // Take all workouts from each set
      workoutSet.forEach((workout, index) => {
        const workoutData = {
          workout_id: workouts.length + 1,
          time_domain: workout.timeDomain,
          estimated_time: workout.duration,
          format: workout.format,
          amrap_time: workout.amrapTime,
          rounds: workout.rounds,
          pattern: workout.pattern,
          movements: workout.exercises.map(exercise => ({
            name: exercise.name,
            reps: exercise.reps,
            weight: exercise.weight,
            total_reps: calculateTotalReps(exercise, workout.format, workout.pattern, workout.rounds)
          }))
        };
        workouts.push(workoutData);
      });
    }
    
    // Create and download JSON file
    const dataStr = JSON.stringify(workouts, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'crossfit_workouts_export.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const calculateTotalReps = (exercise: any, format: string, pattern?: string, rounds?: number): number => {
    if (format === 'For Time' && pattern) {
      const patternReps = pattern.split('-').map(Number);
      return patternReps.reduce((sum, reps) => sum + reps, 0);
    } else if (format === 'Rounds For Time' && rounds) {
      return exercise.reps * rounds;
    } else if (format === 'AMRAP') {
      // For AMRAP, we'll estimate based on duration and exercise rate
      return exercise.reps; // This represents reps per round
    }
    return exercise.reps;
  };

  const handleStrengthAnalysisChange = (field: keyof StrengthAnalysis, value: number) => {
    setStrengthAnalysis(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleOlympicAnalysisChange = (field: keyof OlympicAnalysis, value: number) => {
    setOlympicAnalysis(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSquatAnalysisChange = (field: keyof SquatAnalysis, value: number) => {
    setSquatAnalysis(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePressingAnalysisChange = (field: keyof PressingAnalysis, value: number) => {
    setPressingAnalysis(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Calculate strength ratios
  const calculateStrengthRatios = () => {
    if (strengthAnalysis.bodyweight === 0) return null;
    
    return {
      backSquatRatio: strengthAnalysis.backSquat / strengthAnalysis.bodyweight,
      deadliftRatio: strengthAnalysis.deadlift / strengthAnalysis.bodyweight,
      benchPressRatio: strengthAnalysis.benchPress / strengthAnalysis.bodyweight,
    };
  };

  // Calculate Olympic lift ratios
  const calculateOlympicRatios = () => {
    if (strengthAnalysis.backSquat === 0) return null;
    
    return {
      snatchToBackSquat: olympicAnalysis.snatch / strengthAnalysis.backSquat,
      cleanAndJerkToBackSquat: olympicAnalysis.cleanAndJerk / strengthAnalysis.backSquat,
      cleanAndJerkToSnatch: olympicAnalysis.cleanAndJerk / olympicAnalysis.snatch,
    };
  };

  const handleCalculateStrengthRatios = () => {
    setShowStrengthRatios(true);
  };

  const handleCalculateOlympicRatios = () => {
    setShowOlympicRatios(true);
  };

  const handleCalculateSquatRatios = () => {
    setShowSquatRatios(true);
  };

  // Calculate squat ratios
  const calculateSquatRatios = () => {
    if (strengthAnalysis.backSquat === 0) return null;
    
    return {
      frontSquatToBackSquat: squatAnalysis.frontSquat / strengthAnalysis.backSquat,
      overheadSquatToBackSquat: squatAnalysis.overheadSquat / strengthAnalysis.backSquat,
    };
  };

  const handleCalculatePressingRatios = () => {
    setShowPressingRatios(true);
  };

  // Calculate pressing ratios
  const calculatePressingRatios = () => {
    if (strengthAnalysis.benchPress === 0 || pressingAnalysis.strictPress === 0) return null;
    
    return {
      pushPressToBenchPress: pressingAnalysis.pushPress / strengthAnalysis.benchPress,
      pushPressToStrictPress: pressingAnalysis.pushPress / pressingAnalysis.strictPress,
    };
  };

  // Run all analyses at once
  const runAllAnalyses = () => {
    setShowStrengthRatios(true);
    setShowOlympicRatios(true);
    setShowSquatRatios(true);
    setShowPressingRatios(true);
  };

  // Cache strength calculations to avoid repeated function calls
  const strengthRatios = calculateStrengthRatios();
  const backSquatNextLevel = strengthRatios ? getNextLevelTarget(strengthRatios.backSquatRatio, isMale ? MALE_THRESHOLDS.backSquat : FEMALE_THRESHOLDS.backSquat, strengthAnalysis.bodyweight) : null;
  const deadliftNextLevel = strengthRatios ? getNextLevelTarget(strengthRatios.deadliftRatio, isMale ? MALE_THRESHOLDS.deadlift : FEMALE_THRESHOLDS.deadlift, strengthAnalysis.bodyweight) : null;
  const benchPressNextLevel = strengthRatios ? getNextLevelTarget(strengthRatios.benchPressRatio, isMale ? MALE_THRESHOLDS.benchPress : FEMALE_THRESHOLDS.benchPress, strengthAnalysis.bodyweight) : null;

  return (
    <div className="container">
      <div className="header">
        <h1>CrossFit Workout Performance Predictor</h1>
        <p>Algorithm Test</p>
      </div>

      <div className="card">
        <h2>Strength Assessment Input</h2>
        <p>Enter all your one-rep maxes below, then click "Run All Analyses" to see your complete strength assessment</p>
        
        <div className="form-group">
          <label>Gender</label>
          <div className="gender-toggle">
            <button 
              className={`toggle-btn ${isMale ? 'active' : ''}`}
              onClick={() => setIsMale(true)}
            >
              Male
            </button>
            <button 
              className={`toggle-btn ${!isMale ? 'active' : ''}`}
              onClick={() => setIsMale(false)}
            >
              Female
            </button>
          </div>
        </div>
        
        <div className="strength-analysis-grid">
          <div className="form-group">
            <label>Bodyweight (lbs)</label>
            <input 
              type="number" 
              value={strengthAnalysis.bodyweight || ''} 
              onChange={(e) => handleStrengthAnalysisChange('bodyweight', parseInt(e.target.value) || 0)}
              placeholder="e.g., 180"
            />
          </div>
          
          <div className="form-group">
            <label>Back Squat Max (lbs)</label>
            <input 
              type="number" 
              value={strengthAnalysis.backSquat || ''} 
              onChange={(e) => handleStrengthAnalysisChange('backSquat', parseInt(e.target.value) || 0)}
              placeholder="e.g., 350"
            />
          </div>
          
          <div className="form-group">
            <label>Deadlift Max (lbs)</label>
            <input 
              type="number" 
              value={strengthAnalysis.deadlift || ''} 
              onChange={(e) => handleStrengthAnalysisChange('deadlift', parseInt(e.target.value) || 0)}
              placeholder="e.g., 400"
            />
          </div>
          
          <div className="form-group">
            <label>Bench Press Max (lbs)</label>
            <input 
              type="number" 
              value={strengthAnalysis.benchPress || ''} 
              onChange={(e) => handleStrengthAnalysisChange('benchPress', parseInt(e.target.value) || 0)}
              placeholder="e.g., 250"
            />
          </div>

          <div className="form-group">
            <label>Snatch Max (lbs)</label>
            <input 
              type="number" 
              value={olympicAnalysis.snatch || ''} 
              onChange={(e) => handleOlympicAnalysisChange('snatch', parseInt(e.target.value) || 0)}
              placeholder="e.g., 250"
            />
          </div>
          
          <div className="form-group">
            <label>Clean & Jerk Max (lbs)</label>
            <input 
              type="number" 
              value={olympicAnalysis.cleanAndJerk || ''} 
              onChange={(e) => handleOlympicAnalysisChange('cleanAndJerk', parseInt(e.target.value) || 0)}
              placeholder="e.g., 300"
            />
        </div>
        
          <div className="form-group">
            <label>Front Squat Max (lbs)</label>
            <input 
              type="number" 
              value={squatAnalysis.frontSquat || ''} 
              onChange={(e) => handleSquatAnalysisChange('frontSquat', parseInt(e.target.value) || 0)}
              placeholder="e.g., 300"
            />
          </div>
          
          <div className="form-group">
            <label>Overhead Squat Max (lbs)</label>
            <input 
              type="number" 
              value={squatAnalysis.overheadSquat || ''} 
              onChange={(e) => handleSquatAnalysisChange('overheadSquat', parseInt(e.target.value) || 0)}
              placeholder="e.g., 200"
            />
        </div>
        
          <div className="form-group">
            <label>Strict Press Max (lbs)</label>
            <input 
              type="number" 
              value={pressingAnalysis.strictPress || ''} 
              onChange={(e) => handlePressingAnalysisChange('strictPress', parseInt(e.target.value) || 0)}
              placeholder="e.g., 150"
            />
          </div>
          
          <div className="form-group">
            <label>Push Press Max (lbs)</label>
            <input 
              type="number" 
              value={pressingAnalysis.pushPress || ''} 
              onChange={(e) => handlePressingAnalysisChange('pushPress', parseInt(e.target.value) || 0)}
              placeholder="e.g., 200"
            />
          </div>
        </div>

        <button className="btn" onClick={runAllAnalyses}>
          Run All Analyses
        </button>
      </div>

      <div className="card">
        <h2>Strength Analysis</h2>
        
        {showStrengthRatios && strengthRatios && (
          <div className="analysis-results">
            <div className="bar-charts-container">
              <div className="bar-chart">
                <div className="bar-chart-label">
                  Back Squat Target: <span style={{ color: '#FE5858' }}>{Math.round(strengthAnalysis.bodyweight * (isMale ? MALE_THRESHOLDS.backSquat.intermediate : FEMALE_THRESHOLDS.backSquat.intermediate))} lbs</span> ({isMale ? '1.4x' : '1.2x'} Bodyweight)
                </div>
                <div className="bar-chart-container">
                  <div className="bar-chart-bar olympic-bar">
                    <div 
                      className="bar-fill olympic-fill"
                      style={{ width: `${Math.min(strengthRatios.backSquatRatio / getNextLevelRatio(strengthRatios.backSquatRatio, isMale ? MALE_THRESHOLDS.backSquat : FEMALE_THRESHOLDS.backSquat, isMale) * 100, 100)}%` }}
                    />
                    <div className="bar-target-text">{strengthAnalysis.backSquat} lbs • {strengthRatios.backSquatRatio.toFixed(2)}x</div>
                  </div>
                  <div className="bar-chart-value" style={{ color: '#FE5858' }}>
                    {backSquatNextLevel?.level === 'Intermediate' ? (isMale ? '1.4x' : '1.2x') : 
                     backSquatNextLevel?.level === 'Advanced' ? (isMale ? '1.8x' : '1.5x') : 
                     (isMale ? '2.4x' : '1.9x')}
                  </div>
                </div>
                {backSquatNextLevel && (
                  <div className="next-level-target">
                    <span className="next-level-label">Next Level: {backSquatNextLevel.level}</span>
                    <span className="next-level-weight"> {backSquatNextLevel.weight} lbs</span>
                  </div>
                )}
              </div>
              <div className="bar-chart">
                <div className="bar-chart-label">
                  Deadlift Target: <span style={{ color: '#FE5858' }}>{Math.round(strengthAnalysis.bodyweight * (isMale ? MALE_THRESHOLDS.deadlift.intermediate : FEMALE_THRESHOLDS.deadlift.intermediate))} lbs</span> ({isMale ? '1.6x' : '1.3x'} Bodyweight)
                </div>
                <div className="bar-chart-container">
                  <div className="bar-chart-bar olympic-bar">
                    <div 
                      className="bar-fill olympic-fill"
                      style={{ width: `${Math.min(strengthRatios.deadliftRatio / getNextLevelRatio(strengthRatios.deadliftRatio, isMale ? MALE_THRESHOLDS.deadlift : FEMALE_THRESHOLDS.deadlift, isMale) * 100, 100)}%` }}
                    />
                    <div className="bar-target-text">{strengthAnalysis.deadlift} lbs • {strengthRatios.deadliftRatio.toFixed(2)}x</div>
                  </div>
                  <div className="bar-chart-value" style={{ color: '#FE5858' }}>
                    {deadliftNextLevel?.level === 'Intermediate' ? (isMale ? '1.6x' : '1.3x') : 
                     deadliftNextLevel?.level === 'Advanced' ? (isMale ? '2.2x' : '1.7x') : 
                     (isMale ? '2.7x' : '2.1x')}
                  </div>
                </div>
                {deadliftNextLevel && (
                  <div className="next-level-target">
                    <span className="next-level-label">Next Level: {deadliftNextLevel.level}</span>
                    <span className="next-level-weight"> {deadliftNextLevel.weight} lbs</span>
                  </div>
                )}
              </div>
              <div className="bar-chart">
                <div className="bar-chart-label">
                  Bench Press Target: <span style={{ color: '#FE5858' }}>{Math.round(strengthAnalysis.bodyweight * (isMale ? MALE_THRESHOLDS.benchPress.intermediate : FEMALE_THRESHOLDS.benchPress.intermediate))} lbs</span> ({isMale ? '1.1x' : '0.8x'} Bodyweight)
                </div>
                <div className="bar-chart-container">
                  <div className="bar-chart-bar olympic-bar">
                    <div 
                      className="bar-fill olympic-fill"
                      style={{ width: `${Math.min(strengthRatios.benchPressRatio / getNextLevelRatio(strengthRatios.benchPressRatio, isMale ? MALE_THRESHOLDS.benchPress : FEMALE_THRESHOLDS.benchPress, isMale) * 100, 100)}%` }}
                    />
                    <div className="bar-target-text">{strengthAnalysis.benchPress} lbs • {strengthRatios.benchPressRatio.toFixed(2)}x</div>
                  </div>
                  <div className="bar-chart-value" style={{ color: '#FE5858' }}>
                    {benchPressNextLevel?.level === 'Intermediate' ? (isMale ? '1.1x' : '0.8x') : 
                     benchPressNextLevel?.level === 'Advanced' ? (isMale ? '1.4x' : '1.0x') : 
                     (isMale ? '1.7x' : '1.3x')}
                  </div>
                </div>
                {benchPressNextLevel && (
                  <div className="next-level-target">
                    <span className="next-level-label">Next Level: {benchPressNextLevel.level}</span>
                    <span className="next-level-weight"> {benchPressNextLevel.weight} lbs</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Olympic Lift Analysis</h2>
        
        {showOlympicRatios && calculateOlympicRatios() && (
          <div className="analysis-results">
            <div className="bar-charts-container">
              <BarChart 
                value={calculateOlympicRatios()?.snatchToBackSquat || 0}
                target={0.6}
                label="Snatch/Back Squat"
                maxValue={1.0}
                weightTarget={strengthAnalysis.backSquat * 0.6}
              />
              <BarChart 
                value={calculateOlympicRatios()?.cleanAndJerkToBackSquat || 0}
                target={0.75}
                label="Clean & Jerk/Back Squat"
                maxValue={1.0}
                weightTarget={strengthAnalysis.backSquat * 0.75}
              />
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Squat Analysis</h2>
        
        {showSquatRatios && calculateSquatRatios() && (
          <div className="analysis-results">
            <div className="bar-charts-container">
              <div className="bar-chart">
                <div className="bar-chart-label">
                  Front Squat Target: <span style={{ color: '#FE5858' }}>{Math.round(strengthAnalysis.backSquat * 0.875)} lbs</span> (87.5% of Back Squat)
                </div>
                <div className="bar-chart-container">
                  <div className="bar-chart-bar olympic-bar">
                    <div 
                      className="bar-fill olympic-fill"
                      style={{ width: `${Math.min((calculateSquatRatios()?.frontSquatToBackSquat || 0) / 0.875 * 100, 100)}%` }}
                    />
                    <div className="bar-target-text">{squatAnalysis.frontSquat} lbs • {calculateSquatRatios()?.frontSquatToBackSquat.toFixed(2)}x</div>
                  </div>
                  <div className="bar-chart-value" style={{ color: '#FE5858' }}>0.875x</div>
                </div>
              </div>
              <div className="bar-chart">
                <div className="bar-chart-label">
                  Overhead Squat Target: <span style={{ color: '#FE5858' }}>{Math.round(strengthAnalysis.backSquat * 0.675)} lbs</span> (67.5% of Back Squat)
                </div>
                <div className="bar-chart-container">
                  <div className="bar-chart-bar olympic-bar">
                    <div 
                      className="bar-fill olympic-fill"
                      style={{ width: `${Math.min((calculateSquatRatios()?.overheadSquatToBackSquat || 0) / 0.675 * 100, 100)}%` }}
                    />
                    <div className="bar-target-text">{squatAnalysis.overheadSquat} lbs • {calculateSquatRatios()?.overheadSquatToBackSquat.toFixed(2)}x</div>
                  </div>
                  <div className="bar-chart-value" style={{ color: '#FE5858' }}>0.675x</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Pressing Analysis</h2>
        
        {showPressingRatios && calculatePressingRatios() && strengthRatios && (
          <div className="analysis-results">
            <div className="bar-charts-container">
              <div className="bar-chart">
                <div className="bar-chart-label">
                  Strict Press Target: <span style={{ color: '#FE5858' }}>{Math.round(strengthAnalysis.benchPress * 0.725)} lbs</span> (72.5% of Bench Press)
                </div>
                <div className="bar-chart-container">
                  <div className="bar-chart-bar olympic-bar">
                    <div 
                      className="bar-fill olympic-fill"
                      style={{ width: `${Math.min((pressingAnalysis.strictPress / (strengthAnalysis.benchPress * 0.725)) * 100, 100)}%` }}
                    />
                    <div className="bar-target-text">{pressingAnalysis.strictPress} lbs • {(pressingAnalysis.strictPress / strengthAnalysis.benchPress).toFixed(2)}x</div>
                  </div>
                  <div className="bar-chart-value" style={{ color: '#FE5858' }}>0.725x</div>
                </div>
              </div>
              <div className="bar-chart">
                <div className="bar-chart-label">
                  Push Press Target: <span style={{ color: '#FE5858' }}>{strengthAnalysis.benchPress} lbs</span> (100% of Bench Press)
                </div>
                <div className="bar-chart-container">
                  <div className="bar-chart-bar olympic-bar">
                    <div 
                      className="bar-fill olympic-fill"
                      style={{ width: `${Math.min((pressingAnalysis.pushPress / strengthAnalysis.benchPress) * 100, 100)}%` }}
                    />
                    <div className="bar-target-text">{pressingAnalysis.pushPress} lbs • {(pressingAnalysis.pushPress / strengthAnalysis.benchPress).toFixed(2)}x</div>
                  </div>
                  <div className="bar-chart-value" style={{ color: '#FE5858' }}>1.00x</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Test Workout Generator</h2>
        <p>Generate 10 test workouts (2 per time domain) to identify strengths and weaknesses</p>
        
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={useMLEnhancement}
              onChange={(e) => setUseMLEnhancement(e.target.checked)}
            />
            Use ML-Enhanced Weight Prediction
          </label>
          <p className="form-help">Uses machine learning to predict more accurate weights based on workout characteristics</p>
        </div>
        
        <div className="button-group">
          <button 
            className="btn" 
            onClick={generateWorkouts}
            disabled={isGeneratingML}
          >
            {isGeneratingML ? 'Generating ML Workouts...' : 'Generate Test Workouts'}
          </button>

          <button className="btn btn-secondary" onClick={exportWorkouts}>
            Export 100 Workouts (JSON)
          </button>
        </div>

        {generatedWorkouts.length > 0 && (
          <div className="generated-workouts">
            <h3>Generated Test Workouts (10)</h3>
            {generatedWorkouts.map((workout, index) => (
              <div key={index} className="generated-workout">
                <h4>{workout.name}</h4>
                <div className="workout-meta">
                  <p>Time Domain: {workout.timeDomain}</p>
                  <p>Format: {workout.format === 'Rounds For Time' && workout.rounds 
                    ? `${workout.rounds} Rounds For Time`
                    : workout.format === 'AMRAP' && workout.amrapTime
                    ? `AMRAP ${workout.amrapTime} minutes`
                    : `${workout.format}${workout.pattern ? `: ${workout.pattern}` : ''}`}</p>
                  {workout.format !== 'Rounds For Time' && workout.rounds && <p>Rounds: {workout.rounds}</p>}
                </div>
                <div className="exercises">
                  <p><strong>Exercises:</strong></p>
                  {workout.exercises.map((exercise, exIndex) => (
                    <div key={exIndex} className="exercise">
                      <span>
                        {workout.format === 'For Time' && workout.pattern 
                          ? exercise.name 
                          : `${exercise.reps} ${exercise.name}`}
                      </span>
                      <span>{exercise.weight ? ` ${exercise.weight}` : ''}</span>
                    </div>
                  ))}
                </div>
                <div className="completion-time">
                  <p><strong>Estimated completion time:</strong> {
                    workout.format === 'AMRAP' 
                      ? `${workout.amrapTime} minutes` 
                      : `${Math.floor(workout.duration)}:${Math.floor((workout.duration % 1) * 60).toString().padStart(2, '0')}`
                  }</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
