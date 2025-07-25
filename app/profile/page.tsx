{/* Enhanced Programming Focus Areas */}
<div className="bg-white rounded-lg shadow p-6">
  <h2 className="text-xl font-bold text-gray-900 mb-4">Programming Focus Areas</h2>
  
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {/* Accessory Needs with Explanations */}
    <div>
      <h3 className="font-semibold text-gray-800 mb-4">Accessory Needs</h3>
      <div className="space-y-3">
        {/* Upper Body Pulling */}
        <div className={`p-3 rounded-lg ${profile.accessory_needs.needs_upper_body_pulling ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
          <div className="flex items-start">
            <span className={`w-4 h-4 rounded-full mt-0.5 mr-3 flex-shrink-0 ${profile.accessory_needs.needs_upper_body_pulling ? 'bg-red-500' : 'bg-green-500'}`}></span>
            <div className="flex-1">
              <div className="font-medium text-gray-900">Upper Body Pulling</div>
              {profile.accessory_needs.needs_upper_body_pulling ? (
                <div className="text-sm text-gray-600 mt-1">
                  <span className="font-medium">Why:</span> Your Snatch ({Math.round((profile.one_rms.snatch / profile.one_rms.back_squat) * 100)}%) 
                  or C&J ({Math.round((profile.one_rms.clean_and_jerk / profile.one_rms.back_squat) * 100)}%) 
                  to Back Squat ratio is low. Stronger pulling will help you get the bar higher.
                </div>
              ) : (
                <div className="text-sm text-gray-600 mt-1">✓ Well developed</div>
              )}
            </div>
          </div>
        </div>

        {/* Upper Body Pressing */}
        <div className={`p-3 rounded-lg ${profile.accessory_needs.needs_upper_body_pressing ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
          <div className="flex items-start">
            <span className={`w-4 h-4 rounded-full mt-0.5 mr-3 flex-shrink-0 ${profile.accessory_needs.needs_upper_body_pressing ? 'bg-red-500' : 'bg-green-500'}`}></span>
            <div className="flex-1">
              <div className="font-medium text-gray-900">Upper Body Pressing</div>
              {profile.accessory_needs.needs_upper_body_pressing ? (
                <div className="text-sm text-gray-600 mt-1">
                  <span className="font-medium">Why:</span> Your Bench Press to Body Weight ratio 
                  ({(profile.one_rms.bench_press / profile.user_summary.body_weight).toFixed(1)}x) is below optimal. 
                  Target: {profile.user_summary.gender === 'Male' ? '1.5x' : '1.0x'} bodyweight.
                </div>
              ) : (
                <div className="text-sm text-gray-600 mt-1">✓ Sufficient strength</div>
              )}
            </div>
          </div>
        </div>

        {/* Core */}
        <div className={`p-3 rounded-lg ${profile.accessory_needs.needs_core ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
          <div className="flex items-start">
            <span className={`w-4 h-4 rounded-full mt-0.5 mr-3 flex-shrink-0 ${profile.accessory_needs.needs_core ? 'bg-red-500' : 'bg-green-500'}`}></span>
            <div className="flex-1">
              <div className="font-medium text-gray-900">Core</div>
              {profile.accessory_needs.needs_core ? (
                <div className="text-sm text-gray-600 mt-1">
                  <span className="font-medium">Why:</span> Your Front Squat ({Math.round((profile.one_rms.front_squat / profile.one_rms.back_squat) * 100)}%) 
                  or OHS ratios indicate core stability needs work. Target: FS = 85-90% of BS.
                </div>
              ) : (
                <div className="text-sm text-gray-600 mt-1">✓ Strong foundation</div>
              )}
            </div>
          </div>
        </div>

        {/* Upper Back */}
        <div className={`p-3 rounded-lg ${profile.accessory_needs.needs_upper_back ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
          <div className="flex items-start">
            <span className={`w-4 h-4 rounded-full mt-0.5 mr-3 flex-shrink-0 ${profile.accessory_needs.needs_upper_back ? 'bg-red-500' : 'bg-green-500'}`}></span>
            <div className="flex-1">
              <div className="font-medium text-gray-900">Upper Back</div>
              {profile.accessory_needs.needs_upper_back ? (
                <div className="text-sm text-gray-600 mt-1">
                  <span className="font-medium">Why:</span> Low Front Squat or Overhead Squat performance suggests 
                  upper back strength/mobility limitations.
                </div>
              ) : (
                <div className="text-sm text-gray-600 mt-1">✓ Well developed</div>
              )}
            </div>
          </div>
        </div>

        {/* Leg Strength */}
        <div className={`p-3 rounded-lg ${profile.accessory_needs.needs_leg_strength ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
          <div className="flex items-start">
            <span className={`w-4 h-4 rounded-full mt-0.5 mr-3 flex-shrink-0 ${profile.accessory_needs.needs_leg_strength ? 'bg-red-500' : 'bg-green-500'}`}></span>
            <div className="flex-1">
              <div className="font-medium text-gray-900">Leg Strength</div>
              {profile.accessory_needs.needs_leg_strength ? (
                <div className="text-sm text-gray-600 mt-1">
                  <span className="font-medium">Why:</span> Your Push Press to Strict Press ratio suggests 
                  insufficient leg drive. You should push press 30-40% more than strict press.
                </div>
              ) : (
                <div className="text-sm text-gray-600 mt-1">✓ Sufficient for current level</div>
              )}
            </div>
          </div>
        </div>

        {/* Posterior Chain */}
        <div className={`p-3 rounded-lg ${profile.accessory_needs.needs_posterior_chain ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
          <div className="flex items-start">
            <span className={`w-4 h-4 rounded-full mt-0.5 mr-3 flex-shrink-0 ${profile.accessory_needs.needs_posterior_chain ? 'bg-red-500' : 'bg-green-500'}`}></span>
            <div className="flex-1">
              <div className="font-medium text-gray-900">Posterior Chain</div>
              {profile.accessory_needs.needs_posterior_chain ? (
                <div className="text-sm text-gray-600 mt-1">
                  <span className="font-medium">Why:</span> Your Deadlift to Body Weight ratio 
                  ({(profile.one_rms.deadlift / profile.user_summary.body_weight).toFixed(1)}x) needs improvement. 
                  Target: {profile.user_summary.gender === 'Male' ? '2.5x' : '2.0x'} bodyweight.
                </div>
              ) : (
                <div className="text-sm text-gray-600 mt-1">✓ Balanced development</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Technical Focus */}
    <div>
      <h3 className="font-semibold text-gray-800 mb-4">Technical Focus</h3>
      <div className="space-y-3 text-gray-700">
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="font-medium">Snatch: {profile.technical_focus.snatch_technical_count} exercises/day</div>
          <div className="text-sm text-gray-600 mt-1">
            Based on your {profile.lift_levels.snatch_level} snatch level
          </div>
        </div>
        
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="font-medium">Clean & Jerk: {profile.technical_focus.clean_jerk_technical_count} exercises/day</div>
          <div className="text-sm text-gray-600 mt-1">
            Based on your {profile.lift_levels.clean_jerk_level} C&J level
          </div>
        </div>
        
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="font-medium">Back Squat Focus: {profile.technical_focus.back_squat_focus}</div>
          <div className="text-sm text-gray-600 mt-1">
            Programming emphasis based on your squat ratios
          </div>
        </div>
        
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="font-medium">Front Squat Focus: {profile.technical_focus.front_squat_focus}</div>
          <div className="text-sm text-gray-600 mt-1">
            {profile.technical_focus.front_squat_focus === 'overhead_complex' ? 
              'Combining with overhead work to improve positions' : 
              'Targeted work for your needs'}
          </div>
        </div>
        
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="font-medium">Press Focus: {profile.technical_focus.press_focus}</div>
          <div className="text-sm text-gray-600 mt-1">
            {profile.technical_focus.press_focus === 'stability_unilateral' ? 
              'Single-arm work to address imbalances' : 
              'Focused on your specific needs'}
          </div>
        </div>
      </div>
    </div>
  </div>

  {/* Summary Box */}
  <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
    <p className="text-sm text-blue-900">
      <span className="font-semibold">How we use this:</span> Your program automatically includes extra work 
      in the red areas while maintaining your strengths in the green areas. This ensures balanced development 
      and addresses your specific weaknesses.
    </p>
  </div>
</div>
