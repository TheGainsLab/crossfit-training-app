'use client';

import React from 'react';
import Link from 'next/link';
import Footer from '../../components/Footer';

export default function HRAnalyticsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-6">
          <Link href="/engine" className="inline-flex items-center text-[#FE5858] hover:text-[#ff6b6b] font-medium transition-colors">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Engine
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
            Heart Rate Analytics
          </h1>
          <p className="text-2xl md:text-3xl font-semibold text-gray-800 mb-8 leading-tight">
            Your Heart Rate Tells a Story—If You Know How to Read It
          </p>
          <div className="max-w-4xl mx-auto text-left">
            <p className="text-lg text-gray-700 mb-4 leading-relaxed">
              Most conditioning apps show you average heart rate and call it a day.
            </p>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed font-semibold">
              The Year of the Engine goes deeper.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              For athletes wearing heart rate monitors, the system tracks cardiovascular efficiency, training load, and HR trends across every stimulus type—so you can see not just what you're doing, but how your body is responding.
            </p>
          </div>
        </div>

        {/* What Heart Rate Analytics Reveal */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 text-center">
            What Heart Rate Analytics Reveal
          </h2>

          {/* HR Efficiency by Day Type */}
          <div className="mb-12">
            <h3 className="text-2xl font-bold text-[#FE5858] mb-6">
              HR Efficiency by Day Type
            </h3>
            <p className="text-lg text-gray-700 mb-8 leading-relaxed">
              See which conditioning structures demand the most from your cardiovascular system—and whether you're getting more efficient at handling them.
            </p>

            {/* IMAGE PLACEHOLDER */}
            <div className="bg-gray-100 rounded-lg p-8 mb-6">
              <p className="text-gray-400 italic text-sm text-center">
                📱 IMAGE: HR Efficiency by Day Type chart<br/>
                Caption: Anaerobic sessions show the highest HR efficiency (235)—high output without sustained elevated heart rate. Endurance-focused sessions like Towers (130) require prolonged cardiovascular demand for lower instantaneous output.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <h4 className="text-xl font-bold text-gray-900 mb-4">Why this matters:</h4>
              <p className="text-lg text-gray-700 leading-relaxed">
                HR efficiency shows you the cost of different conditioning demands. If your HR efficiency improves over time on a specific day type, you're producing the same output with less cardiovascular stress—a direct measure of adaptation.
              </p>
            </div>
          </div>

          {/* Training Load Management */}
          <div className="mb-12 pb-12 border-b border-gray-200">
            <h3 className="text-2xl font-bold text-[#FE5858] mb-6">
              Training Load Management
            </h3>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">
              Track cumulative cardiovascular stress over time to avoid overtraining and optimize recovery.
            </p>
            <p className="text-lg text-gray-700 mb-4 leading-relaxed">
              Available metrics:
            </p>
            <ul className="space-y-3 mb-8 ml-6">
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700"><strong>Avg HR:</strong> Your average heart rate across all sessions</span>
              </li>
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700"><strong>Avg Peak HR:</strong> The average of your peak heart rates across sessions</span>
              </li>
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700"><strong>Max Peak HR:</strong> Your highest recorded heart rate</span>
              </li>
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700"><strong>Training Load:</strong> Cumulative cardiovascular demand over time</span>
              </li>
            </ul>

            <div className="bg-gray-50 rounded-lg p-6">
              <h4 className="text-xl font-bold text-gray-900 mb-4">Why this matters:</h4>
              <p className="text-lg text-gray-700 leading-relaxed">
                Training load helps you balance intensity and recovery. If load is climbing without performance gains, you're accumulating fatigue without adaptation—a signal to pull back.
              </p>
            </div>
          </div>

          {/* Cardiovascular Response Across Energy Systems */}
          <div className="mb-12">
            <h3 className="text-2xl font-bold text-[#FE5858] mb-6">
              Cardiovascular Response Across Energy Systems
            </h3>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">
              Different day types stress your cardiovascular system differently:
            </p>
            <ul className="space-y-4 mb-8 ml-6">
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700"><strong>Anaerobic sessions</strong> (short, maximal efforts) → High instantaneous HR, but low sustained demand</span>
              </li>
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700"><strong>Max Aerobic Power sessions</strong> (4-minute intervals) → Sustained near-maximal HR with incomplete recovery</span>
              </li>
              <li className="flex items-start">
                <span className="text-lg text-gray-700 mr-2">•</span>
                <span className="text-lg text-gray-700"><strong>Endurance sessions</strong> (long, steady work) → Moderate HR sustained over long durations</span>
              </li>
            </ul>
            <p className="text-lg text-gray-700 mb-8 leading-relaxed">
              The system tracks all of it—so you can see how your heart responds to different conditioning stimuli.
            </p>

            {/* IMAGE PLACEHOLDER */}
            <div className="bg-gray-100 rounded-lg p-8">
              <p className="text-gray-400 italic text-sm text-center">
                📱 IMAGE: Modality and metric selection screen<br/>
                Caption: Choose which metrics to analyze—sessions, average HR, peak HR, max peak HR, HR efficiency, or training load. Filter by modality to see how your cardiovascular response differs across equipment.
              </p>
            </div>
          </div>

          {/* Longitudinal HR Trends */}
          <div>
            <h3 className="text-2xl font-bold text-[#FE5858] mb-4">
              Longitudinal HR Trends <span className="text-gray-500 text-lg font-normal">(coming soon)</span>
            </h3>
            <p className="text-lg text-gray-700 leading-relaxed">
              Watch your HR efficiency improve as your engine adapts—producing the same output with less cardiovascular cost over time.
            </p>
          </div>
        </div>

        {/* Who This Is For */}
        <div className="bg-gradient-to-br from-[#FE5858] to-[#ff6b6b] rounded-xl shadow-lg p-8 md:p-12 mb-12 text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center">Who This Is For</h2>
          <p className="text-lg mb-6 text-center max-w-3xl mx-auto leading-relaxed">
            Heart rate analytics are designed for athletes who:
          </p>
          <ul className="space-y-4 max-w-3xl mx-auto text-lg">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Wear chest straps or optical HR monitors during conditioning sessions</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Want to understand cardiovascular adaptation, not just performance outputs</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Need to manage training load and avoid overreaching</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Train for sports with high cardiovascular demands (CrossFit, HYROX, endurance racing)</span>
            </li>
          </ul>
        </div>

        {/* How It Works */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 text-center">
            How It Works
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="text-4xl font-bold text-[#FE5858] mb-3">1</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Connect Your Monitor</h3>
              <p className="text-lg text-gray-700">Connect your HR monitor to the app during conditioning sessions</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="text-4xl font-bold text-[#FE5858] mb-3">2</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Complete Workouts</h3>
              <p className="text-lg text-gray-700">Complete your workouts as prescribed</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="text-4xl font-bold text-[#FE5858] mb-3">3</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Review Analytics</h3>
              <p className="text-lg text-gray-700">Review your HR analytics after each session and over time</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="text-4xl font-bold text-[#FE5858] mb-3">4</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">See Adaptation</h3>
              <p className="text-lg text-gray-700">See how your cardiovascular system responds to different day types</p>
            </div>
          </div>
          <p className="text-lg text-gray-700 mt-8 text-center max-w-3xl mx-auto leading-relaxed">
            Your heart rate data integrates seamlessly with your performance tracking—so you get the full picture of how your engine is developing.
          </p>
        </div>

        {/* FAQ Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 text-center">
            Frequently Asked Questions
          </h2>

          <div className="space-y-8 max-w-4xl mx-auto">
            {/* FAQ 1 */}
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Do I need a heart rate monitor to use The Year of the Engine?
              </h3>
              <p className="text-lg text-gray-700 leading-relaxed">
                No. The system tracks performance based on output (calories, meters, pace, etc.). Heart rate monitoring is optional but unlocks additional analytics for athletes who want cardiovascular efficiency insights.
              </p>
            </div>

            {/* FAQ 2 */}
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                What HR monitors are compatible?
              </h3>
              <p className="text-lg text-gray-700 leading-relaxed">
                Any Bluetooth or ANT+ heart rate monitor that pairs with your phone or fitness device will work. Chest straps (like Polar H10 or Garmin HRM-Pro) are more accurate than optical wrist-based monitors.
              </p>
            </div>

            {/* FAQ 3 */}
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Will my HR data affect my targets?
              </h3>
              <p className="text-lg text-gray-700 leading-relaxed">
                No. Targets are adjusted based on your output performance (pace, calories, etc.), not heart rate. HR data is purely diagnostic—it helps you understand how you're achieving your performance, not whether you hit the target.
              </p>
            </div>

            {/* FAQ 4 */}
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                What if I don't wear a HR monitor for every session?
              </h3>
              <p className="text-lg text-gray-700 leading-relaxed">
                That's fine. HR analytics are calculated only for sessions where HR data is available. Your performance tracking and adaptive targets work independently of heart rate monitoring.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center bg-white rounded-xl shadow-lg p-8 md:p-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            See How Your Engine Really Works
          </h2>
          <p className="text-lg text-gray-700 mb-8 max-w-3xl mx-auto leading-relaxed">
            Heart rate analytics are included in every Year of the Engine subscription. Connect a monitor and start tracking.
          </p>
          <Link 
            href="/engine"
            className="inline-block px-8 py-4 bg-[#FE5858] text-white rounded-lg text-lg font-semibold hover:bg-[#ff6b6b] transition-colors shadow-lg"
          >
            Start Your Free Trial
          </Link>
        </div>
      </div>

      <Footer variant="minimal" />
    </div>
  );
}
