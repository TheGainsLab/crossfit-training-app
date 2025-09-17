// lib/ai/families.ts
// Deterministic exercise family normalizer shared by API and context builder

export function normalizeExerciseToFamily(name: string): string | null {
  if (!name) return null
  const text = String(name).toLowerCase().trim()

  // Ordered rules (first match wins). Keep this small and deterministic.
  const rules: Array<{ family: string; patterns: RegExp[] }> = [
    { family: 'snatch', patterns: [/\bsnatch(ing)?\b/] },
    { family: 'clean_and_jerk', patterns: [/\bclean\s*(?:&|and)?\s*jerk\b/, /\bc&j\b/] },
    { family: 'clean', patterns: [/\bclean(?!\s*(?:&|and)?\s*jerk)\b/, /\bpower clean\b/, /\bsquat clean\b/] },
    { family: 'jerk', patterns: [/\bjerk\b/, /\bpush jerk\b/, /\bsplit jerk\b/] },
    { family: 'squat', patterns: [/\bback squat\b/, /\bfront squat\b/, /\bsquat\b/] },
    { family: 'overhead_squat', patterns: [/\boverhead squat\b/] },
    { family: 'deadlift', patterns: [/\bdeadlift\b/] },
    { family: 'bench_press', patterns: [/\bbench press\b/] },
    { family: 'press', patterns: [/\bstrict press\b/, /\bshoulder press\b/, /\bpress\b/, /\bpush press\b/] },
    { family: 'pull_up', patterns: [/\bpull[- ]?up(s)?\b/, /\bc2b\b/, /\bchest[- ]?to[- ]?bar\b/, /\bchin[- ]?up\b/] },
    { family: 'muscle_up', patterns: [/\bmuscle[- ]?up(s)?\b/, /\bring muscle[- ]?up\b/, /\bbar muscle[- ]?up\b/] },
    { family: 'burpee', patterns: [/\bburpee(s)?\b/, /\bbar[- ]?facing burpee(s)?\b/] },
    { family: 'double_under', patterns: [/\bdouble[- ]?under(s)?\b/] },
    { family: 'row', patterns: [/\brow(ing)?\b/, /\bconcept2\b/, /\bc2\b/, /\berg\b/] },
    { family: 'bike', patterns: [/\bbike\b/, /\bair bike\b/, /\bassault bike\b/] },
    { family: 'run', patterns: [/\brun(ning)?\b/] },
    { family: 'thruster', patterns: [/\bthruster(s)?\b/] },
  ]

  for (const rule of rules) {
    for (const re of rule.patterns) {
      if (re.test(text)) return rule.family
    }
  }
  return null
}

