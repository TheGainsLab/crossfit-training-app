'use client';

import React from 'react';
import Link from 'next/link';
import Footer from '../../components/Footer';

export default function TaxonomyPage() {
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
            The Year of the Engine: Framework Taxonomy
          </h1>
          <p className="text-2xl md:text-3xl font-semibold text-gray-800 mb-8 leading-tight">
            25 Conditioning Structures—Each With a Purpose
          </p>
          <div className="max-w-4xl mx-auto text-left">
            <p className="text-lg text-gray-700 mb-4 leading-relaxed">
              Most conditioning programs rotate randomly between "hard," "medium," and "easy" days.
            </p>
            <p className="text-lg text-gray-700 mb-4 leading-relaxed">
              The Year of the Engine is different.
            </p>
            <p className="text-lg text-gray-700 mb-4 leading-relaxed">
              It's built on 25 distinct conditioning frameworks—each designed to stress a specific aspect of your engine. Every structure has a defined purpose, a measurable adaptation, and an independent adaptive target.
            </p>
            <p className="text-lg text-gray-700 font-semibold">
              This isn't variety for variety's sake. It's precision.
            </p>
          </div>
        </div>

        {/* Why 25 Structures */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Why 25 Structures?
          </h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Because conditioning isn't one thing.
          </p>
          <p className="text-lg text-gray-700 mb-4 leading-relaxed">
            Your engine has multiple systems:
          </p>
          <ul className="space-y-3 mb-6 ml-6">
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700"><strong>Aerobic capacity</strong> (how much oxygen you can use)</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700"><strong>Threshold tolerance</strong> (how long you can sustain high output)</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700"><strong>Anaerobic power</strong> (how much force you can produce without oxygen)</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700"><strong>Repeatability</strong> (how quickly you recover between efforts)</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700"><strong>Pacing control</strong> (how well you manage output under changing demands)</span>
            </li>
            <li className="flex items-start">
              <span className="text-lg text-gray-700 mr-2">•</span>
              <span className="text-lg text-gray-700"><strong>Density tolerance</strong> (how much work you can sustain with incomplete recovery)</span>
            </li>
          </ul>
          <p className="text-lg text-gray-700 mb-4 leading-relaxed">
            Each system adapts at a different rate. Each requires a different stimulus.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed font-semibold">
            The 25 frameworks in The Year of the Engine cover the full spectrum—so your conditioning develops comprehensively instead of accidentally.
          </p>
        </div>

        {/* Three Categories */}
        <div className="bg-gradient-to-br from-[#FE5858] to-[#ff6b6b] rounded-xl shadow-lg p-8 md:p-12 mb-12 text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">The Three Categories</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <h3 className="text-2xl font-bold mb-4">Development Sessions</h3>
              <p className="text-lg leading-relaxed">
                These sessions build your engine. They create adaptations—mitochondrial density, stroke volume, glycolytic power, clearance efficiency. Most of your training should be development work.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <h3 className="text-2xl font-bold mb-4">Expression Sessions</h3>
              <p className="text-lg leading-relaxed">
                These sessions test what you've built. They simulate competition demands—long MetCons, late-workout power expression, full-system integration. They don't create primary adaptations; they verify preparedness.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <h3 className="text-2xl font-bold mb-4">Diagnostic Sessions</h3>
              <p className="text-lg leading-relaxed">
                Time trials. They establish your baseline performance and recalibrate the system periodically. Not a training stimulus—purely measurement.
              </p>
            </div>
          </div>
        </div>

        {/* Development Sessions */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 text-center">
            Development Sessions (Build Your Engine)
          </h2>

          {/* Time Trial */}
          <div className="mb-10 pb-10 border-b border-gray-200">
            <h3 className="text-2xl font-bold text-[#FE5858] mb-4">Time Trial</h3>
            <div className="space-y-3">
              <p className="text-lg text-gray-700"><strong>Structure:</strong> Single continuous maximal effort (typically 10 minutes)</p>
              <p className="text-lg text-gray-700"><strong>Primary Stimulus:</strong> Measurement of current aerobic performance</p>
              <p className="text-lg text-gray-700"><strong>Primary Adaptations:</strong> None (diagnostic only)</p>
              <p className="text-lg text-gray-700"><strong>System Role:</strong> Establishes and periodically recalibrates your reference performance. All other targets are derived from your time trial result.</p>
            </div>
          </div>

          {/* Endurance */}
          <div className="mb-10 pb-10 border-b border-gray-200">
            <h3 className="text-2xl font-bold text-[#FE5858] mb-4">Endurance</h3>
            <div className="space-y-3">
              <p className="text-lg text-gray-700"><strong>Structure:</strong> Continuous Zone 2 work (20–90+ minutes), fixed low intensity (~70%)</p>
              <p className="text-lg text-gray-700"><strong>Primary Stimulus:</strong> Sustained oxidative metabolism</p>
              <p className="text-lg text-gray-700"><strong>Primary Adaptations:</strong></p>
              <ul className="ml-8 space-y-2">
                <li className="text-lg text-gray-700">• Mitochondrial biogenesis</li>
                <li className="text-lg text-gray-700">• Capillary density</li>
                <li className="text-lg text-gray-700">• Increased oxidative enzyme activity</li>
              </ul>
              <p className="text-lg text-gray-700"><strong>Secondary Adaptations:</strong> Fat oxidation efficiency, stroke volume support, autonomic balance</p>
              <p className="text-lg text-gray-700"><strong>System Role:</strong> Aerobic foundation that supports all other training</p>
            </div>
          </div>

          {/* Polarized */}
          <div className="mb-10 pb-10 border-b border-gray-200">
            <h3 className="text-2xl font-bold text-[#FE5858] mb-4">Polarized</h3>
            <div className="space-y-3">
              <p className="text-lg text-gray-700"><strong>Structure:</strong> Continuous Zone 2 with very short max-effort bursts (~7 seconds) every several minutes</p>
              <p className="text-lg text-gray-700"><strong>Primary Stimulus:</strong> Oxidative work with brief phosphagen perturbations</p>
              <p className="text-lg text-gray-700"><strong>Primary Adaptations:</strong></p>
              <ul className="ml-8 space-y-2">
                <li className="text-lg text-gray-700">• Aerobic base maintenance</li>
                <li className="text-lg text-gray-700">• Faster oxygen uptake kinetics</li>
              </ul>
              <p className="text-lg text-gray-700"><strong>Secondary Adaptations:</strong> PCr resynthesis efficiency, neural sharpness, fast-fiber aerobic contribution</p>
              <p className="text-lg text-gray-700"><strong>System Role:</strong> Preserves responsiveness during high-volume aerobic phases</p>
            </div>
          </div>

          {/* Max Aerobic Power (MAP) */}
          <div className="mb-10 pb-10 border-b border-gray-200">
            <h3 className="text-2xl font-bold text-[#FE5858] mb-4">Max Aerobic Power (MAP)</h3>
            <div className="space-y-3">
              <p className="text-lg text-gray-700"><strong>Structure:</strong> Long severe intervals (e.g., 4×4 minutes), equal work-to-rest ratio, pace derived from time trial</p>
              <p className="text-lg text-gray-700"><strong>Primary Stimulus:</strong> Sustained near-maximal oxygen uptake</p>
              <p className="text-lg text-gray-700"><strong>Primary Adaptations:</strong></p>
              <ul className="ml-8 space-y-2">
                <li className="text-lg text-gray-700">• Increased VO₂max</li>
                <li className="text-lg text-gray-700">• Increased maximal stroke volume</li>
                <li className="text-lg text-gray-700">• Improved oxygen extraction</li>
              </ul>
              <p className="text-lg text-gray-700"><strong>Secondary Adaptations:</strong> Severe-domain pacing skill, aerobic power repeatability</p>
              <p className="text-lg text-gray-700"><strong>System Role:</strong> Raises the aerobic ceiling that all other work draws from</p>
            </div>
          </div>

          {/* Interval */}
          <div className="mb-10 pb-10 border-b border-gray-200">
            <h3 className="text-2xl font-bold text-[#FE5858] mb-4">Interval</h3>
            <div className="space-y-3">
              <p className="text-lg text-gray-700"><strong>Structure:</strong> Moderate-length severe intervals (e.g., 2–3 minutes), moderate rest, repeatable intensity</p>
              <p className="text-lg text-gray-700"><strong>Primary Stimulus:</strong> High aerobic power without maximal strain</p>
              <p className="text-lg text-gray-700"><strong>Primary Adaptations:</strong></p>
              <ul className="ml-8 space-y-2">
                <li className="text-lg text-gray-700">• Aerobic power development</li>
                <li className="text-lg text-gray-700">• Sustained high VO₂ tolerance</li>
              </ul>
              <p className="text-lg text-gray-700"><strong>Secondary Adaptations:</strong> Lactate clearance at high output, improved recovery between efforts</p>
              <p className="text-lg text-gray-700"><strong>System Role:</strong> Bread-and-butter aerobic power work</p>
            </div>
          </div>

          {/* Threshold */}
          <div className="mb-10 pb-10 border-b border-gray-200">
            <h3 className="text-2xl font-bold text-[#FE5858] mb-4">Threshold</h3>
            <div className="space-y-3">
              <p className="text-lg text-gray-700"><strong>Structure:</strong> Sustained efforts at lactate threshold intensity</p>
              <p className="text-lg text-gray-700"><strong>Primary Stimulus:</strong> Threshold power maintenance</p>
              <p className="text-lg text-gray-700"><strong>Primary Adaptations:</strong></p>
              <ul className="ml-8 space-y-2">
                <li className="text-lg text-gray-700">• Increased lactate threshold</li>
                <li className="text-lg text-gray-700">• Improved clearance efficiency</li>
              </ul>
              <p className="text-lg text-gray-700"><strong>System Role:</strong> Builds the bridge between aerobic base and high-intensity work</p>
            </div>
          </div>

          {/* Anaerobic */}
          <div className="mb-10 pb-10 border-b border-gray-200">
            <h3 className="text-2xl font-bold text-[#FE5858] mb-4">Anaerobic</h3>
            <div className="space-y-3">
              <p className="text-lg text-gray-700"><strong>Structure:</strong> Short maximal efforts (~30 seconds), long rest (~2–3 minutes), low total volume</p>
              <p className="text-lg text-gray-700"><strong>Primary Stimulus:</strong> Fast glycolytic ATP production</p>
              <p className="text-lg text-gray-700"><strong>Primary Adaptations:</strong></p>
              <ul className="ml-8 space-y-2">
                <li className="text-lg text-gray-700">• Glycolytic power</li>
                <li className="text-lg text-gray-700">• Increased anaerobic enzyme activity</li>
              </ul>
              <p className="text-lg text-gray-700"><strong>Secondary Adaptations:</strong> High-threshold motor unit recruitment, lactate tolerance, neuromuscular coordination</p>
              <p className="text-lg text-gray-700"><strong>System Role:</strong> Raises anaerobic ceiling; used sparingly</p>
            </div>
          </div>

          {/* Flux */}
          <div className="mb-10 pb-10 border-b border-gray-200">
            <h3 className="text-2xl font-bold text-[#FE5858] mb-4">Flux</h3>
            <div className="space-y-3">
              <p className="text-lg text-gray-700"><strong>Structure:</strong> Zone 2 base with short, controlled pace increases (~60 seconds), continuous execution</p>
              <p className="text-lg text-gray-700"><strong>Primary Stimulus:</strong> Mild, repeatable glycolytic engagement</p>
              <p className="text-lg text-gray-700"><strong>Primary Adaptations:</strong></p>
              <ul className="ml-8 space-y-2">
                <li className="text-lg text-gray-700">• Lactate clearance efficiency</li>
                <li className="text-lg text-gray-700">• Metabolic flexibility</li>
              </ul>
              <p className="text-lg text-gray-700"><strong>Secondary Adaptations:</strong> Improved steady-state resilience, faster return to oxidative dominance</p>
              <p className="text-lg text-gray-700"><strong>System Role:</strong> Bridges base → threshold without breakdown</p>
            </div>
          </div>

          {/* Flux Stages */}
          <div className="mb-10 pb-10 border-b border-gray-200">
            <h3 className="text-2xl font-bold text-[#FE5858] mb-4">Flux Stages</h3>
            <div className="space-y-3">
              <p className="text-lg text-gray-700"><strong>Structure:</strong> Continuous aerobic work with repeated flux surges that progressively increase in intensity</p>
              <p className="text-lg text-gray-700"><strong>Primary Stimulus:</strong> Increasing glycolytic load without full recovery</p>
              <p className="text-lg text-gray-700"><strong>Primary Adaptations:</strong></p>
              <ul className="ml-8 space-y-2">
                <li className="text-lg text-gray-700">• Threshold durability</li>
                <li className="text-lg text-gray-700">• Clearance under rising metabolic stress</li>
              </ul>
              <p className="text-lg text-gray-700"><strong>Secondary Adaptations:</strong> Resistance to HR drift, psychological tolerance of sustained discomfort</p>
              <p className="text-lg text-gray-700"><strong>System Role:</strong> Threshold-bridge and late-base progression tool</p>
            </div>
          </div>

          {/* Ascending */}
          <div className="mb-10 pb-10 border-b border-gray-200">
            <h3 className="text-2xl font-bold text-[#FE5858] mb-4">Ascending</h3>
            <div className="space-y-3">
              <p className="text-lg text-gray-700"><strong>Structure:</strong> Repeated intervals with fixed duration, intensity increases each round</p>
              <p className="text-lg text-gray-700"><strong>Primary Stimulus:</strong> Escalating aerobic → glycolytic demand</p>
              <p className="text-lg text-gray-700"><strong>Primary Adaptations:</strong></p>
              <ul className="ml-8 space-y-2">
                <li className="text-lg text-gray-700">• Aerobic–glycolytic transition control</li>
                <li className="text-lg text-gray-700">• Tolerance of rising metabolic stress</li>
              </ul>
              <p className="text-lg text-gray-700"><strong>Secondary Adaptations:</strong> Pacing intelligence, reduced early overpacing tendencies</p>
              <p className="text-lg text-gray-700"><strong>System Role:</strong> Transitional robustness builder</p>
            </div>
          </div>

          {/* Hybrid Aerobic */}
          <div className="mb-10 pb-10 border-b border-gray-200">
            <h3 className="text-2xl font-bold text-[#FE5858] mb-4">Hybrid Aerobic</h3>
            <div className="space-y-3">
              <p className="text-lg text-gray-700"><strong>Structure:</strong> Paired or clustered aerobic-power intervals, short rests, incomplete recovery</p>
              <p className="text-lg text-gray-700"><strong>Primary Stimulus:</strong> Sustained severe-domain work under density</p>
              <p className="text-lg text-gray-700"><strong>Primary Adaptations:</strong></p>
              <ul className="ml-8 space-y-2">
                <li className="text-lg text-gray-700">• Aerobic power durability</li>
                <li className="text-lg text-gray-700">• Incomplete-recovery tolerance</li>
              </ul>
              <p className="text-lg text-gray-700"><strong>Secondary Adaptations:</strong> Lactate clearance under density, psychological tolerance of continuous strain</p>
              <p className="text-lg text-gray-700"><strong>System Role:</strong> Core CrossFit / HYROX conditioning builder</p>
            </div>
          </div>

          {/* Hybrid Anaerobic */}
          <div className="mb-10 pb-10 border-b border-gray-200">
            <h3 className="text-2xl font-bold text-[#FE5858] mb-4">Hybrid Anaerobic</h3>
            <div className="space-y-3">
              <p className="text-lg text-gray-700"><strong>Structure:</strong> Anaerobic repeats (~60 seconds and/or ~15 seconds), incomplete recovery, often paired formats</p>
              <p className="text-lg text-gray-700"><strong>Primary Stimulus:</strong> Glycolytic power under fatigue</p>
              <p className="text-lg text-gray-700"><strong>Primary Adaptations:</strong></p>
              <ul className="ml-8 space-y-2">
                <li className="text-lg text-gray-700">• Anaerobic repeatability</li>
                <li className="text-lg text-gray-700">• Glycolytic tolerance</li>
              </ul>
              <p className="text-lg text-gray-700"><strong>Secondary Adaptations:</strong> Fast-fiber fatigue resistance, neuromuscular resilience</p>
              <p className="text-lg text-gray-700"><strong>System Role:</strong> Sharp, high-cost anaerobic development</p>
            </div>
          </div>

          {/* Devour */}
          <div className="mb-10 pb-10 border-b border-gray-200">
            <h3 className="text-2xl font-bold text-[#FE5858] mb-4">Devour</h3>
            <div className="space-y-3">
              <p className="text-lg text-gray-700"><strong>Structure:</strong> Fixed pace, increasing work duration each round, variants include ascending or descending rest</p>
              <p className="text-lg text-gray-700"><strong>Primary Stimulus:</strong> Accumulated aerobic fatigue</p>
              <p className="text-lg text-gray-700"><strong>Primary Adaptations:</strong></p>
              <ul className="ml-8 space-y-2">
                <li className="text-lg text-gray-700">• Aerobic durability</li>
                <li className="text-lg text-gray-700">• Resistance to fatigue accumulation</li>
              </ul>
              <p className="text-lg text-gray-700"><strong>Secondary Adaptations:</strong> Threshold staying power, cardiac drift resistance</p>
              <p className="text-lg text-gray-700"><strong>System Role:</strong> Quiet, high-payoff durability builder</p>
            </div>
          </div>

          {/* Ascending Devour */}
          <div className="mb-10 pb-10 border-b border-gray-200">
            <h3 className="text-2xl font-bold text-[#FE5858] mb-4">Ascending Devour</h3>
            <div className="space-y-3">
              <p className="text-lg text-gray-700"><strong>Structure:</strong> Pace and duration both increase each round</p>
              <p className="text-lg text-gray-700"><strong>Primary Stimulus:</strong> Compound aerobic–threshold stress</p>
              <p className="text-lg text-gray-700"><strong>Primary Adaptations:</strong> Integrated aerobic–threshold robustness</p>
              <p className="text-lg text-gray-700"><strong>Secondary Adaptations:</strong> Late-workout composure, improved pacing judgment</p>
              <p className="text-lg text-gray-700"><strong>System Role:</strong> Advanced durability progression</p>
            </div>
          </div>

          {/* Descending Devour */}
          <div className="mb-10 pb-10 border-b border-gray-200">
            <h3 className="text-2xl font-bold text-[#FE5858] mb-4">Descending Devour</h3>
            <div className="space-y-3">
              <p className="text-lg text-gray-700"><strong>Structure:</strong> Fixed pace and duration, rest decreases each round</p>
              <p className="text-lg text-gray-700"><strong>Primary Stimulus:</strong> Clearance under shrinking recovery</p>
              <p className="text-lg text-gray-700"><strong>Primary Adaptations:</strong></p>
              <ul className="ml-8 space-y-2">
                <li className="text-lg text-gray-700">• Aerobic density tolerance</li>
                <li className="text-lg text-gray-700">• Clearance efficiency</li>
              </ul>
              <p className="text-lg text-gray-700"><strong>Secondary Adaptations:</strong> Improved VO₂ maintenance between efforts</p>
              <p className="text-lg text-gray-700"><strong>System Role:</strong> Density-focused durability work</p>
            </div>
          </div>

          {/* Atomic */}
          <div className="mb-10 pb-10 border-b border-gray-200">
            <h3 className="text-2xl font-bold text-[#FE5858] mb-4">Atomic</h3>
            <div className="space-y-3">
              <p className="text-lg text-gray-700"><strong>Structure:</strong> Very short maximal efforts with long relative rest, followed by aerobic power work</p>
              <p className="text-lg text-gray-700"><strong>Primary Stimulus:</strong> Phosphagen priming → aerobic expression</p>
              <p className="text-lg text-gray-700"><strong>Primary Adaptations:</strong></p>
              <ul className="ml-8 space-y-2">
                <li className="text-lg text-gray-700">• Faster VO₂ kinetics</li>
                <li className="text-lg text-gray-700">• Improved aerobic power efficiency</li>
              </ul>
              <p className="text-lg text-gray-700"><strong>Secondary Adaptations:</strong> Neural readiness, cleaner early-interval output</p>
              <p className="text-lg text-gray-700"><strong>System Role:</strong> High-ROI aerobic builder with low recovery cost</p>
            </div>
          </div>

          {/* Rocket Races */}
          <div className="mb-10">
            <h3 className="text-2xl font-bold text-[#FE5858] mb-4">Rocket Races A / Rocket Races B</h3>
            <div className="space-y-3">
              <p className="text-lg text-gray-700"><strong>Structure:</strong> Variable pacing structures that test output consistency as demands change</p>
              <p className="text-lg text-gray-700"><strong>Primary Stimulus:</strong> Pacing control under variable demands</p>
              <p className="text-lg text-gray-700"><strong>Primary Adaptations:</strong> Output consistency, adaptive pacing skill</p>
              <p className="text-lg text-gray-700"><strong>System Role:</strong> Pacing intelligence under unpredictable load</p>
            </div>
          </div>
        </div>

        {/* Expression Sessions */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
            Expression Sessions (Test What You've Built)
          </h2>
          <p className="text-lg text-gray-700 mb-10 text-center max-w-4xl mx-auto leading-relaxed">
            Expression sessions don't create primary adaptations. They verify preparedness—testing whether the development work has translated into competition-ready capacity.
          </p>

          {/* Infinity */}
          <div className="mb-10 pb-10 border-b border-gray-200">
            <h3 className="text-2xl font-bold text-[#FE5858] mb-4">Infinity (MetCon Simulator)</h3>
            <div className="space-y-3">
              <p className="text-lg text-gray-700"><strong>Structure:</strong> Long escalating density, multiple phases, no clear reset</p>
              <p className="text-lg text-gray-700"><strong>Primary Stimulus:</strong> Prolonged aerobic–glycolytic erosion</p>
              <p className="text-lg text-gray-700"><strong>Primary Adaptations:</strong> None primary (expression-focused)</p>
              <p className="text-lg text-gray-700"><strong>Secondary Adaptations:</strong></p>
              <ul className="ml-8 space-y-2">
                <li className="text-lg text-gray-700">• Pacing discipline</li>
                <li className="text-lg text-gray-700">• Psychological endurance</li>
                <li className="text-lg text-gray-700">• Late-stage durability</li>
              </ul>
              <p className="text-lg text-gray-700"><strong>System Role:</strong> MetCon simulation and psychological rehearsal</p>
            </div>
          </div>

          {/* Towers */}
          <div className="mb-10 pb-10 border-b border-gray-200">
            <h3 className="text-2xl font-bold text-[#FE5858] mb-4">Towers</h3>
            <div className="space-y-3">
              <p className="text-lg text-gray-700"><strong>Structure:</strong> Progressive aerobic ramp, long steady segment, short-rest aerobic power finish</p>
              <p className="text-lg text-gray-700"><strong>Primary Stimulus:</strong> Layered aerobic fatigue → power expression</p>
              <p className="text-lg text-gray-700"><strong>Primary Adaptations:</strong> Aerobic durability → aerobic power under fatigue</p>
              <p className="text-lg text-gray-700"><strong>Secondary Adaptations:</strong> Transition handling, late-session output resilience</p>
              <p className="text-lg text-gray-700"><strong>System Role:</strong> CrossFit-specific durability builder</p>
            </div>
          </div>

          {/* Afterburner */}
          <div className="mb-10 pb-10 border-b border-gray-200">
            <h3 className="text-2xl font-bold text-[#FE5858] mb-4">Afterburner (MetCon Simulator)</h3>
            <div className="space-y-3">
              <p className="text-lg text-gray-700"><strong>Structure:</strong> Anaerobic bursts, aerobic clearing, rising-density aerobic power finish</p>
              <p className="text-lg text-gray-700"><strong>Primary Stimulus:</strong> Late-stage power expression under fatigue</p>
              <p className="text-lg text-gray-700"><strong>Primary Adaptations:</strong> None primary (expression-focused)</p>
              <p className="text-lg text-gray-700"><strong>Secondary Adaptations:</strong></p>
              <ul className="ml-8 space-y-2">
                <li className="text-lg text-gray-700">• Clearance under residual glycolysis</li>
                <li className="text-lg text-gray-700">• Psychological resilience</li>
              </ul>
              <p className="text-lg text-gray-700"><strong>System Role:</strong> "Who has energy left?" simulator</p>
            </div>
          </div>

          {/* Synthesis */}
          <div className="mb-10">
            <h3 className="text-2xl font-bold text-[#FE5858] mb-4">Synthesis (Capstone Simulator)</h3>
            <div className="space-y-3">
              <p className="text-lg text-gray-700"><strong>Structure:</strong> Anaerobic → aerobic → anaerobic → aerobic; no system gets full recovery</p>
              <p className="text-lg text-gray-700"><strong>Primary Stimulus:</strong> Full-system integration</p>
              <p className="text-lg text-gray-700"><strong>Primary Adaptations:</strong> None (verification, not development)</p>
              <p className="text-lg text-gray-700"><strong>Secondary Adaptations:</strong></p>
              <ul className="ml-8 space-y-2">
                <li className="text-lg text-gray-700">• Coordination of all energy systems</li>
                <li className="text-lg text-gray-700">• Competition confidence</li>
              </ul>
              <p className="text-lg text-gray-700"><strong>System Role:</strong> Final audit of conditioning completeness</p>
            </div>
          </div>
        </div>

        {/* How Frameworks Work Together */}
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 text-center">
            How the Frameworks Work Together
          </h2>

          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-bold text-[#FE5858] mb-4">Phase 1: Build the Base</h3>
              <p className="text-lg text-gray-700 leading-relaxed">
                Start with <strong>Endurance</strong>, <strong>Polarized</strong>, and <strong>Flux</strong> sessions. These build aerobic capacity, mitochondrial density, and metabolic flexibility—the foundation everything else depends on.
              </p>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-[#FE5858] mb-4">Phase 2: Raise the Ceiling</h3>
              <p className="text-lg text-gray-700 leading-relaxed">
                Add <strong>Max Aerobic Power</strong>, <strong>Interval</strong>, and <strong>Threshold</strong> sessions. These increase your VO₂max and lactate threshold—raising the upper limit of what your aerobic system can handle.
              </p>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-[#FE5858] mb-4">Phase 3: Develop Density and Power</h3>
              <p className="text-lg text-gray-700 leading-relaxed">
                Introduce <strong>Hybrid Aerobic</strong>, <strong>Devour</strong> variants, and <strong>Anaerobic</strong> sessions. These train repeatability, density tolerance, and glycolytic power.
              </p>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-[#FE5858] mb-4">Phase 4: Test Integration</h3>
              <p className="text-lg text-gray-700 leading-relaxed">
                Use <strong>Expression</strong> sessions (<strong>Infinity</strong>, <strong>Towers</strong>, <strong>Afterburner</strong>, <strong>Synthesis</strong>) to verify that your development work translates into competition-ready conditioning.
              </p>
            </div>
          </div>
        </div>

        {/* Independent Adaptation */}
        <div className="bg-gradient-to-br from-[#FE5858] to-[#ff6b6b] rounded-xl shadow-lg p-8 md:p-12 mb-12 text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center">Independent Adaptation</h2>
          <p className="text-lg mb-6 leading-relaxed max-w-4xl mx-auto">
            Every framework has its own adaptive target.
          </p>
          <p className="text-lg mb-6 leading-relaxed max-w-4xl mx-auto">
            When you exceed your Max Aerobic Power target, that target increases. When you struggle with Anaerobic sessions, that target adjusts down. Progress in one domain doesn't artificially inflate expectations in another.
          </p>
          <p className="text-lg font-semibold leading-relaxed max-w-4xl mx-auto text-center">
            This is how the system stays precise—and why your conditioning develops comprehensively instead of accidentally.
          </p>
        </div>

        {/* CTA */}
        <div className="text-center bg-white rounded-xl shadow-lg p-8 md:p-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            Ready to train your engine with intent?
          </h2>
          <Link 
            href="/engine"
            className="inline-block px-8 py-4 bg-[#FE5858] text-white rounded-lg text-lg font-semibold hover:bg-[#ff6b6b] transition-colors shadow-lg"
          >
            Start Your 3-Day Free Trial →
          </Link>
          <div className="mt-8">
            <Link 
              href="/"
              className="inline-flex items-center text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
              ← Back to Homepage
            </Link>
          </div>
        </div>
      </div>

      <Footer variant="minimal" />
    </div>
  );
}
