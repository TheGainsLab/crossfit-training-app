export default function ProgramPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            🎉 Assessment Completed!
          </h1>
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-green-800 mb-2">
              Your Data Has Been Saved Successfully
            </h2>
            <p className="text-green-700">
              Your personalized CrossFit training program will be generated based on your assessment.
            </p>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Next Steps:</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Your assessment data is now in the database</li>
              <li>Program generation will be built next</li>
              <li>You'll receive your personalized 12-week program</li>
              <li>Progress tracking and analytics will be available</li>
            </ul>
          </div>

          <div className="mt-8">
            <a 
              href="/intake" 
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            >
              ← Back to Assessment
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
