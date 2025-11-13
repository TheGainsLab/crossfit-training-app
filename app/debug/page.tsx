// app/debug/page.tsx
'use client';

import React, { useState, useEffect } from 'react';

const APIDebugger = () => {
  const [testUserId] = useState('47'); // Using your test user
  const [apiResults, setApiResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

const routes = [
  'dashboard',
  'block-analyzer',
  'metcon-analyzer',
  'skills-analytics',
  'strength-tracker',
  'exercise-deep-dive?exercise=Double%20Unders&block=METCONS'  // ✅ Has parameters
];

  const testRoute = async (route: string) => {
    try {
      console.log(`Testing route: ${route}`);
      const response = await fetch(`/api/analytics/${testUserId}/${route}`);
      
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`✅ ${route} success:`, data);
      
      setApiResults(prev => ({
        ...prev,
        [route]: { success: true, data, timestamp: new Date().toISOString() }
      }));
      
    } catch (error: any) {
      console.error(`❌ ${route} failed:`, error);
      setErrors(prev => ({
        ...prev,
        [route]: error.message
      }));
    }
  };

  const testAllRoutes = async () => {
    setLoading(true);
    setApiResults({});
    setErrors({});
    
    // Test routes sequentially to avoid overwhelming the server
    for (const route of routes) {
      await testRoute(route);
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setLoading(false);
  };

  const RouteStatus = ({ route }: { route: string }) => {
    const result = apiResults[route];
    const error = errors[route];
    
    if (loading && !result && !error) {
      return <span className="text-yellow-600">⏳ Testing...</span>;
    }
    
    if (error) {
      return (
        <div className="text-red-600">
          ❌ Error: {error}
        </div>
      );
    }
    
    if (result) {
      return (
        <div className="text-green-600">
          ✅ Success ({Object.keys(result.data?.data || {}).length} properties)
        </div>
      );
    }
    
    return <span className="text-gray-400">Not tested</span>;
  };

  // Test chart data formatting
  const DashboardChartTest = () => {
    const dashboardData = apiResults.dashboard?.data?.data;
    
    if (!dashboardData) {
      return <div className="text-gray-500">No dashboard data to test charts</div>;
    }

    const chartData = dashboardData.charts?.overviewChart;
    
    return (
      <div className="mt-4 p-4 bg-gray-50 rounded">
        <h4 className="font-semibold mb-2">Chart Data Test:</h4>
        {chartData ? (
          <div>
            <p className="text-green-600">✅ Chart data available</p>
            <p>Labels: {chartData.labels?.join(', ')}</p>
            <p>Data points: {chartData.datasets?.[0]?.data?.join(', ')}</p>
          </div>
        ) : (
          <p className="text-red-600">❌ No chart data found</p>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6 flex items-center">
        <span style={{ color: '#282B34' }}>G</span>
        <span style={{ color: '#FE5858' }}>A</span>
        <span style={{ color: '#FE5858' }}>I</span>
        <span style={{ color: '#282B34' }}>N</span>
        <span style={{ color: '#282B34' }}>S</span>
        <span className="ml-2" style={{ color: '#282B34' }}>- API Debug Tool</span>
      </h2>
      
      <div className="mb-6">
        <button 
          onClick={testAllRoutes}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Testing All Routes...' : 'Test All API Routes'}
        </button>
        <p className="text-sm text-gray-600 mt-2">Testing with User ID: {testUserId}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {routes.map(route => (
          <div key={route} className="border p-4 rounded">
            <h3 className="font-semibold mb-2">/{route}</h3>
            <RouteStatus route={route} />
            
            {apiResults[route] && (
              <button 
                onClick={() => testRoute(route)}
                className="mt-2 text-sm bg-gray-200 px-2 py-1 rounded hover:bg-gray-300"
              >
                Retest
              </button>
            )}
          </div>
        ))}
      </div>

      {apiResults.dashboard && (
        <div className="border-t pt-6">
          <h3 className="text-xl font-semibold mb-4">Dashboard Data Preview</h3>
          
          <DashboardChartTest />
          
          <div className="mt-4">
            <h4 className="font-semibold mb-2">Key Metrics:</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {(() => {
                const metrics = apiResults.dashboard.data?.data?.dashboard?.overallMetrics;
                if (!metrics) return <p>No metrics data</p>;
                
                return Object.entries(metrics).map(([key, value]) => (
                  <div key={key} className="bg-gray-100 p-2 rounded">
                    <div className="font-medium">{key}</div>
                    <div className="text-gray-600">{String(value)}</div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {Object.keys(errors).length > 0 && (
        <div className="border-t pt-6">
          <h3 className="text-xl font-semibold mb-4 text-red-600">Errors Found</h3>
          <div className="space-y-2">
            {Object.entries(errors).map(([route, error]) => (
              <div key={route} className="bg-red-50 p-3 rounded">
                <strong>{route}:</strong> {error}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Main debug page component
export default function DebugPage() {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <APIDebugger />
    </div>
  );
}
