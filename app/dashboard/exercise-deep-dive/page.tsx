// Fixed version of the ComparisonCard and ExerciseComparison components

const ExerciseComparison = () => {
  const [comparisonExercise, setComparisonExercise] = useState<string>('');
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [loadingComparison, setLoadingComparison] = useState(false);

  // Filter available exercises (remove the currently selected one)
  const availableForComparison = availableExercises.filter(exercise => exercise !== selectedExercise);

  const fetchComparisonData = async (exercise: string) => {
    if (!userId || !exercise || !selectedBlock) return;
    
    setLoadingComparison(true);
    try {
      const response = await fetch(
        `/api/analytics/${userId}/exercise-deep-dive?exercise=${encodeURIComponent(exercise)}&block=${encodeURIComponent(selectedBlock)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setComparisonData(data);
      } else {
        setComparisonData(null);
      }
    } catch (error) {
      console.error('Error fetching comparison data:', error);
      setComparisonData(null);
    } finally {
      setLoadingComparison(false);
    }
  };

  const handleComparisonSelect = (exercise: string) => {
    setComparisonExercise(exercise);
    if (exercise) {
      fetchComparisonData(exercise);
    } else {
      setComparisonData(null);
    }
  };

  // Move ComparisonCard component definition outside or make it a separate component
  const ComparisonCard = ({ title, data, isComparison = false }: { title: string, data: any, isComparison?: boolean }) => {
    console.log('ComparisonCard data:', title, data);
    
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${isComparison ? 'border-l-4 border-green-500' : 'border-l-4 border-blue-500'}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          {isComparison ? '🔄' : '📊'} {title}
        </h3>
             
        {data ? (
          <div className="space-y-4">
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded">
                <div className="text-xl font-bold text-gray-900">{data.exerciseInfo?.timesPerformed || 0}</div>
                <div className="text-xs text-gray-600">Sessions</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded">
                <div className="text-xl font-bold text-gray-900">{data.volume?.totalReps || 0}</div>
                <div className="text-xs text-gray-600">Total Reps</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded">
                <div className="text-xl font-bold text-gray-900">{data.summary?.avgRPE || 0}</div>
                <div className="text-xs text-gray-600">Avg RPE</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded">
                <div className="text-xl font-bold text-gray-900">{data.summary?.avgQualityGrade || 'N/A'}</div>
                <div className="text-xs text-gray-600">Quality</div>
              </div>
            </div>

            {/* Trend Indicators */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">RPE Trend:</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  data.trends?.rpe?.direction === 'improving' ? 'bg-green-100 text-green-800' :
                  data.trends?.rpe?.direction === 'declining' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {data.trends?.rpe?.direction || 'stable'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Quality Trend:</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  data.trends?.quality?.direction === 'improving' ? 'bg-green-100 text-green-800' :
                  data.trends?.quality?.direction === 'declining' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {data.trends?.quality?.direction || 'stable'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Days Since Last:</span>
                <span className="text-sm font-medium text-gray-900">{data.summary?.daysSinceLast || 'N/A'}</span>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-500 mb-2">Recent Activity</div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Last 4 weeks:</span>
                <span className="text-sm font-medium">{data.timing?.recentSessions || 0} sessions</span>                  
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            {isComparison ? 'Select an exercise to compare' : 'No data available'}
          </div>
        )}
      </div>
    );
  }; // Fixed: Added proper closing brace

  // This return belongs to ExerciseComparison component
  return (
    <div className="bg-gray-50 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">⚖️ Exercise Comparison</h3>
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-600">Compare with:</span>
          <select
            value={comparisonExercise}
            onChange={(e) => handleComparisonSelect(e.target.value)}
            disabled={availableForComparison.length === 0}
            className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="">Choose exercise...</option>
            {availableForComparison.map(exercise => (
              <option key={exercise} value={exercise}>
                {exercise}
              </option>
            ))}
          </select>
        </div>
      </div>

      {availableForComparison.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No other exercises available in this block for comparison.</p>
          <p className="text-sm mt-1">Try a different training block with multiple exercises.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Current Exercise */}
          <ComparisonCard 
            title={selectedExercise} 
            data={exerciseData?.data} 
          />

          {/* Comparison Exercise */}
          {loadingComparison ? (
            <div className="bg-white rounded-lg shadow p-6 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mr-2"></div>
              <span className="text-gray-600">Loading comparison...</span>
            </div>
          ) : (
            <ComparisonCard 
              title={comparisonExercise || 'Select Exercise'} 
              data={comparisonData?.data} 
              isComparison={true}
            />
          )}
        </div>
      )}
    </div>
  );
};
