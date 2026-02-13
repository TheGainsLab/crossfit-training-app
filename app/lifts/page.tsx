'use client';

import React, { useMemo, useState } from 'react';
import {
  analyzeStrength,
  THRESHOLDS,
  type AnalyzeOutput,
  type Sex,
  type Unit,
} from '@/lib/strength_assessment/analysis';

export default function LiftsPage() {
  const [sex, setSex] = useState<Sex>('male');
  const [unit, setUnit] = useState<Unit>('lb');
  const [bodyweight, setBodyweight] = useState<number>(0);
  const [backSquat, setBackSquat] = useState<number>(0);
  const [deadlift, setDeadlift] = useState<number>(0);
  const [benchPress, setBenchPress] = useState<number>(0);
  const [showResults, setShowResults] = useState(false);

  const result: AnalyzeOutput | null = useMemo(() => {
    if (!showResults) return null;
    return analyzeStrength({
      sex,
      unit,
      bodyweight: Number(bodyweight) || 0,
      lifts: {
        backSquat: Number(backSquat) || 0,
        deadlift: Number(deadlift) || 0,
        benchPress: Number(benchPress) || 0,
      },
    });
  }, [showResults, sex, unit, bodyweight, backSquat, deadlift, benchPress]);

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    setShowResults(true);
  };

  const handleReset = () => {
    setShowResults(false);
  };

  const onSavePdf = () => {
    window.print();
  };

  const unitLabel = unit === 'kg' ? 'kg' : 'lb';

  return (
    <div className="container" role="main">
      <h1>Strength Assessment</h1>
      <p className="subtitle">
        Enter your bodyweight and 1RMs to see your levels and next targets. No sign-in or data storage.
      </p>

      <form onSubmit={handleAnalyze} className="card">
        <div className="row">
          <label>Sex</label>
          <select value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>

          <label>Units</label>
          <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
            <option value="lb">Pounds (lb)</option>
            <option value="kg">Kilograms (kg)</option>
          </select>
        </div>

        <div className="row">
          <label>Bodyweight ({unitLabel})</label>
          <input
            type="number"
            min={0}
            step="1"
            value={bodyweight}
            onChange={(e) => setBodyweight(Number(e.target.value))}
          />
        </div>

        <div className="grid">
          <div className="col">
            <label>Back Squat 1RM ({unitLabel})</label>
            <input
              type="number"
              min={0}
              step="1"
              value={backSquat}
              onChange={(e) => setBackSquat(Number(e.target.value))}
            />
          </div>
          <div className="col">
            <label>Deadlift 1RM ({unitLabel})</label>
            <input
              type="number"
              min={0}
              step="1"
              value={deadlift}
              onChange={(e) => setDeadlift(Number(e.target.value))}
            />
          </div>
          <div className="col">
            <label>Bench Press 1RM ({unitLabel})</label>
            <input
              type="number"
              min={0}
              step="1"
              value={benchPress}
              onChange={(e) => setBenchPress(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="actions">
          {!showResults ? (
            <button type="submit">Analyze</button>
          ) : (
            <>
              <button type="button" onClick={handleReset}>Edit inputs</button>
              <button type="button" onClick={onSavePdf}>Save as PDF</button>
            </>
          )}
        </div>
      </form>

      {showResults && result && (
        <section className="card results">
          <h2>Results</h2>
          <p className="muted">
            Thresholds are bodyweight ratios. Next target shows the weight for your next level.
          </p>

          <ResultsTable
            result={result}
            bodyweight={Number(bodyweight) || 0}
            unitLabel={unitLabel}
            sex={sex}
          />
        </section>
      )}

      <style jsx>{`
        .container {
          max-width: 900px;
          margin: 24px auto;
          padding: 0 16px;
        }
        h1 {
          margin: 0 0 8px;
        }
        .subtitle {
          margin: 0 0 16px;
          color: #666;
        }
        .card {
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
          background: white;
        }
        .row {
          display: grid;
          grid-template-columns: 120px 1fr 120px 1fr;
          gap: 12px;
          align-items: center;
          margin-bottom: 12px;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        .col {
          display: grid;
          gap: 6px;
        }
        label {
          font-weight: 600;
        }
        input, select, button {
          padding: 8px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
        }
        .actions {
          margin-top: 12px;
          display: flex;
          gap: 8px;
        }
        button {
          cursor: pointer;
          background: #111827;
          color: white;
          border: none;
        }
        button[type="button"] {
          background: #374151;
        }
        .results .muted {
          color: #6b7280;
          margin-top: -6px;
          margin-bottom: 8px;
        }
        @media print {
          .actions, form select, form input, button { display: none !important; }
          .card { border: none; }
          body { color: #000; }
        }
      `}</style>
    </div>
  );
}

function ResultsTable({
  result,
  bodyweight,
  unitLabel,
  sex,
}: {
  result: AnalyzeOutput;
  bodyweight: number;
  unitLabel: string;
  sex: Sex;
}) {
  const thresholds = THRESHOLDS[sex];

  const rows: Array<{
    key: 'backSquat' | 'deadlift' | 'benchPress';
    label: string;
  }> = [
    { key: 'backSquat', label: 'Back Squat' },
    { key: 'deadlift', label: 'Deadlift' },
    { key: 'benchPress', label: 'Bench Press' },
  ];

  return (
    <div className="table">
      <div className="thead">
        <div>Lift</div>
        <div>Ratio</div>
        <div>Level</div>
        <div>Next Target</div>
        <div>Thresholds (ratio)</div>
      </div>
      {rows.map(({ key, label }) => {
        const r = result[key];
        const t = thresholds[key];
        const next = r.nextTarget
          ? `${r.nextTarget.level} • ${r.nextTarget.weight} ${unitLabel}`
          : 'Max level reached';
        const thresholdsText = `B:${t.beginner} I:${t.intermediate} A:${t.advanced} E:${t.elite}`;

        return (
          <div className="trow" key={key}>
            <div>{label}</div>
            <div>{r.ratio.toFixed(2)}× BW</div>
            <div>{r.category}</div>
            <div>{next}</div>
            <div>{thresholdsText}</div>
          </div>
        );
      })}

      <style jsx>{`
        .table {
          display: grid;
          gap: 8px;
        }
        .thead, .trow {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr 1fr 1.3fr 1.6fr;
          gap: 8px;
          align-items: center;
        }
        .thead {
          font-weight: 700;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 6px;
          margin-bottom: 6px;
        }
      `}</style>
    </div>
  );
}
