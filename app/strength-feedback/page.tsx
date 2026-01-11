"use client"

import React, { useMemo, useState } from "react"

type LiftKeys =
  | "snatch"
  | "cleanJerk"
  | "backSquat"
  | "frontSquat"
  | "overheadSquat"
  | "deadlift"
  | "benchPress"
  | "strictPress"
  | "pushPress"
  | "weightedPullup"

type Lifts = Record<LiftKeys, number | "">

function calculateEpley1RM(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps <= 0) return 0
  return Math.round(weight * (1 + reps / 30))
}

function toNumber(value: number | string): number {
  const n = typeof value === "number" ? value : parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

function formatWeight(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—"
  return `${Math.round(n)}`
}

const liftLabels: Record<LiftKeys, string> = {
  snatch: "Snatch",
  cleanJerk: "Clean & Jerk",
  backSquat: "Back Squat",
  frontSquat: "Front Squat",
  overheadSquat: "Overhead Squat",
  deadlift: "Deadlift",
  benchPress: "Bench Press",
  strictPress: "Strict Press",
  pushPress: "Push Press",
  weightedPullup: "Weighted Pull-up",
}

interface RatioDef {
  id: string
  label: string
  numerator: "bodyweight" | LiftKeys
  denominator: "bodyweight" | LiftKeys
  target: number // expressed as proportion (e.g., 0.85 for 85%)
}

const ratioDefs: RatioDef[] = [
  { id: "fsq_bsq", label: "Front Squat / Back Squat", numerator: "frontSquat", denominator: "backSquat", target: 0.85 },
  { id: "cj_bsq", label: "Clean & Jerk / Back Squat", numerator: "cleanJerk", denominator: "backSquat", target: 0.74 },
  { id: "sn_bsq", label: "Snatch / Back Squat", numerator: "snatch", denominator: "backSquat", target: 0.62 },
  { id: "sn_cj", label: "Snatch / Clean & Jerk", numerator: "snatch", denominator: "cleanJerk", target: 0.8 },
  { id: "dl_bsq", label: "Deadlift / Back Squat", numerator: "deadlift", denominator: "backSquat", target: 1.2 },
  { id: "bench_bw", label: "Bench Press / Bodyweight", numerator: "benchPress", denominator: "bodyweight", target: 0.9 },
  { id: "dl_bw", label: "Deadlift / Bodyweight", numerator: "deadlift", denominator: "bodyweight", target: 2.0 },
  { id: "pp_sp", label: "Push Press / Strict Press", numerator: "pushPress", denominator: "strictPress", target: 1.2 },
  { id: "oHS_bsq", label: "Overhead Squat / Back Squat", numerator: "overheadSquat", denominator: "backSquat", target: 0.65 },
  { id: "wp_bp", label: "Weighted Pull-up / Bench Press", numerator: "weightedPullup", denominator: "benchPress", target: 0.4 },
]

export default function StrengthFeedbackPage(): JSX.Element {
  const [bodyweight, setBodyweight] = useState<number | "">("")
  const [lifts, setLifts] = useState<Lifts>({
    snatch: "",
    cleanJerk: "",
    backSquat: "",
    frontSquat: "",
    overheadSquat: "",
    deadlift: "",
    benchPress: "",
    strictPress: "",
    pushPress: "",
    weightedPullup: "",
  })

  const [estWeight, setEstWeight] = useState<string>("")
  const [estReps, setEstReps] = useState<string>("")
  const [estTarget, setEstTarget] = useState<LiftKeys>("backSquat")

  const est1RM = useMemo(() => {
    const w = parseFloat(estWeight)
    const r = parseFloat(estReps)
    return calculateEpley1RM(Number.isFinite(w) ? w : 0, Number.isFinite(r) ? r : 0)
  }, [estWeight, estReps])

  const ratios = useMemo(() => {
    const bw = toNumber(bodyweight)
    const numericLifts: Record<LiftKeys, number> = {
      snatch: toNumber(lifts.snatch),
      cleanJerk: toNumber(lifts.cleanJerk),
      backSquat: toNumber(lifts.backSquat),
      frontSquat: toNumber(lifts.frontSquat),
      overheadSquat: toNumber(lifts.overheadSquat),
      deadlift: toNumber(lifts.deadlift),
      benchPress: toNumber(lifts.benchPress),
      strictPress: toNumber(lifts.strictPress),
      pushPress: toNumber(lifts.pushPress),
      weightedPullup: toNumber(lifts.weightedPullup),
    }

    return ratioDefs.map((def) => {
      const numerator = def.numerator === "bodyweight" ? bw : numericLifts[def.numerator]
      const denominator = def.denominator === "bodyweight" ? bw : numericLifts[def.denominator]
      const okInputs = numerator > 0 && denominator > 0
      const value = okInputs ? numerator / denominator : 0
      const pct = okInputs ? Math.round(value * 100) : 0
      const meets = okInputs && value >= def.target
      const targetPct = Math.round(def.target * 100)
      const message = okInputs
        ? meets
          ? `✅ On target: ${pct}% (target ${targetPct}%+)`
          : `❌ Below target: ${pct}% (target ${targetPct}%+)`
        : "— Enter values to evaluate"

      return { id: def.id, label: def.label, value, pct, target: def.target, targetPct, meets, message }
    })
  }, [bodyweight, lifts])

  const achieved = ratios.filter((r) => r.meets).length
  const level = achieved >= 7 ? "Balanced/Strong" : achieved >= 4 ? "Developing" : "Needs Work"

  function updateLift(key: LiftKeys, value: string) {
    setLifts((prev) => ({ ...prev, [key]: value === "" ? "" : parseFloat(value) }))
  }

  function applyEstimate() {
    if (!est1RM) return
    setLifts((prev) => ({ ...prev, [estTarget]: est1RM }))
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Strength Calculator & Feedback</h1>
      <p className="text-gray-600 mt-2">Client-side tool to estimate 1RMs, check key ratios, and get quick guidance. No data is saved.</p>

      {/* Estimator */}
      <section className="mt-6 bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold text-gray-900">1RM Estimator (Epley)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-3">
          <div>
            <label className="block text-sm text-gray-700">Weight</label>
            <input value={estWeight} onChange={(e) => setEstWeight(e.target.value)} type="number" min={0} className="w-full mt-1 px-3 py-2 border rounded" placeholder="e.g., 225" />
          </div>
          <div>
            <label className="block text-sm text-gray-700">Reps</label>
            <input value={estReps} onChange={(e) => setEstReps(e.target.value)} type="number" min={0} className="w-full mt-1 px-3 py-2 border rounded" placeholder="e.g., 5" />
          </div>
          <div>
            <label className="block text-sm text-gray-700">Lift</label>
            <select value={estTarget} onChange={(e) => setEstTarget(e.target.value as LiftKeys)} className="w-full mt-1 px-3 py-2 border rounded">
              {(Object.keys(liftLabels) as LiftKeys[]).map((k) => (
                <option key={k} value={k}>{liftLabels[k]}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button onClick={applyEstimate} disabled={!est1RM} className="px-4 py-2 rounded bg-blue-600 text-white font-semibold disabled:opacity-50">Apply {est1RM ? `(${formatWeight(est1RM)})` : ""}</button>
          </div>
        </div>
      </section>

      {/* Inputs */}
      <section className="mt-6 bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold text-gray-900">Enter 1RMs (any subset)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <div>
            <label className="block text-sm text-gray-700">Bodyweight</label>
            <input value={bodyweight} onChange={(e) => setBodyweight(e.target.value === "" ? "" : parseFloat(e.target.value))} type="number" min={0} className="w-full mt-1 px-3 py-2 border rounded" placeholder="e.g., 180" />
          </div>
          {(Object.keys(liftLabels) as LiftKeys[]).map((k) => (
            <div key={k}>
              <label className="block text-sm text-gray-700">{liftLabels[k]}</label>
              <input
                value={lifts[k]}
                onChange={(e) => updateLift(k, e.target.value)}
                type="number"
                min={0}
                className="w-full mt-1 px-3 py-2 border rounded"
                placeholder="1RM"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Summary */}
      <section className="mt-6 bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold text-gray-900">Summary</h2>
        <div className="mt-2 text-gray-800">
          <div><span className="font-semibold">Targets met:</span> {achieved} / {ratios.length}</div>
          <div><span className="font-semibold">Overall status:</span> {level}</div>
        </div>
      </section>

      {/* Ratios */}
      <section className="mt-6 bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold text-gray-900">Key Ratios</h2>
        <div className="mt-3 space-y-3">
          {ratios.map((r) => (
            <div key={r.id} className="border rounded p-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="font-medium text-gray-900">{r.label}</div>
                <div className={r.meets ? "text-green-700" : "text-red-700"}>{r.message}</div>
              </div>
              <div className="mt-2">
                <div className="h-2 bg-gray-200 rounded">
                  {/* progress: cap at 150% for display */}
                  <div className={`h-2 rounded ${r.meets ? "bg-green-500" : "bg-coral"}`} style={{ width: `${Math.min(150, r.pct)}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>0%</span>
                  <span>Target {r.targetPct}%</span>
                  <span>150%+</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="text-xs text-gray-500 mt-6">Tips: Use the estimator if you don’t have a recent 1RM. Ratios are unit-agnostic. This tool does not store or send data.</p>
    </div>
  )
}
