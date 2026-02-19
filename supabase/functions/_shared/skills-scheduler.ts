/**
 * Skills block scheduler: resolves chains, scores skills, and greedily fills
 * 40 slots (2 skills/day × 5 days × 4 weeks) with prevalence-weighted priorities.
 *
 * Constraints:
 * - No duplicate skill on same day
 * - No skill on consecutive days
 * - Max 2 appearances per skill per week
 */

const SLOTS_PER_DAY = 2
const MAX_PER_SKILL_PER_WEEK = 2

export type SkillGrid = Record<string, [number, number]>

interface SkillDef {
  skill_index: number
  prevalence_weight: number
  progression_from_skill_index: number | null
}

/** Proficiency gap: Don't have it=4, Beginner=3, Intermediate=2, Advanced=1 */
function proficiencyGap(level: string): number {
  if (!level || level === "Don't have it") return 4
  if (level === 'Beginner') return 3
  if (level === 'Intermediate') return 2
  if (level === 'Advanced') return 1
  return 4
}

function isAdvanced(level: string): boolean {
  return level === 'Advanced'
}

/** Build chains: each chain is [base, ..., most advanced] */
function buildChains(defs: SkillDef[]): number[][] {
  const byIndex = new Map(defs.map((d) => [d.skill_index, d]))
  const chains: number[][] = []

  // Find leaves: skills that no one progresses FROM (nothing has progression_from = this)
  const progressionFromSet = new Set(
    defs.map((d) => d.progression_from_skill_index).filter((x): x is number => x != null)
  )
  const leaves = defs
    .filter((d) => !progressionFromSet.has(d.skill_index))
    .filter((d) => d.progression_from_skill_index != null) // has a progression, so is non-base
  // Actually leaves are: skills that HAVE progression_from (they point back) and no one points TO them
  // "No one points to" = no other skill has progression_from_skill_index === this skill
  const whoPointsTo = new Map<number, number>()
  defs.forEach((d) => {
    if (d.progression_from_skill_index != null) {
      whoPointsTo.set(d.skill_index, d.progression_from_skill_index)
    }
  })
  const pointedTo = new Set(whoPointsTo.values())
  const chainHeads = defs.filter((d) => whoPointsTo.has(d.skill_index) && !pointedTo.has(d.skill_index))

  for (const head of chainHeads) {
    const chain: number[] = []
    let curr: number | undefined = head.skill_index
    while (curr != null) {
      chain.push(curr)
      const def = byIndex.get(curr)
      curr = def?.progression_from_skill_index ?? undefined
    }
    if (chain.length > 0) {
      chain.reverse() // base first, then advanced
      chains.push(chain)
    }
  }

  return chains
}

/** Find active skill for a chain: first (from most advanced) that user does not have at Advanced */
function findActiveInChain(chain: number[], skills: string[]): number | null {
  for (let i = chain.length - 1; i >= 0; i--) {
    const idx = chain[i]
    const level = skills[idx] ?? "Don't have it"
    if (!isAdvanced(level)) return idx
  }
  return null
}

/** Resolve all chains and base skills into the pool of schedulable skill indices */
function resolvePool(
  defs: SkillDef[],
  skills: string[],
  chains: number[][]
): Set<number> {
  const pool = new Set<number>()

  // Base skills: any skill user has (or could work on) - all 26
  for (let i = 0; i < 26; i++) {
    pool.add(i)
  }

  // Replace chain skills with only the active one per chain
  const inChain = new Set<number>()
  chains.forEach((c) => c.forEach((idx) => inChain.add(idx)))

  for (const chain of chains) {
    const active = findActiveInChain(chain, skills)
    if (active != null) {
      pool.add(active)
      // Remove other chain members from pool (we only schedule the active one)
      chain.forEach((idx) => {
        if (idx !== active) pool.delete(idx)
      })
    } else {
      chain.forEach((idx) => pool.delete(idx))
    }
  }

  return pool
}

/** Score a skill: proficiency gap × prevalence weight */
function scoreSkill(
  skillIndex: number,
  skills: string[],
  prevalenceWeight: number
): number {
  const gap = proficiencyGap(skills[skillIndex] ?? "Don't have it")
  return gap * prevalenceWeight
}

export async function runSkillsScheduler(
  supabase: any,
  user: { skills: string[]; preferences?: { trainingDaysPerWeek?: number } },
  weeksToGenerate: number[] = [1, 2, 3, 4]
): Promise<SkillGrid> {
  const { data: defs, error } = await supabase
    .from('skill_definitions')
    .select('skill_index, prevalence_weight, progression_from_skill_index')
    .order('skill_index')

  if (error) {
    console.error('Skills scheduler: failed to fetch skill_definitions:', error)
    return {}
  }

  const skillDefs: SkillDef[] = (defs || []).map((d: any) => ({
    skill_index: d.skill_index,
    prevalence_weight: parseFloat(d.prevalence_weight) || 0.5,
    progression_from_skill_index: d.progression_from_skill_index ?? null,
  }))

  const prevalenceByIndex = new Map(skillDefs.map((d) => [d.skill_index, d.prevalence_weight]))

  const chains = buildChains(skillDefs)
  const pool = resolvePool(skillDefs, user.skills || [], chains)

  const daysPerWeek = Math.max(3, Math.min(6, Number(user.preferences?.trainingDaysPerWeek ?? 5)))
  const skillGrid: SkillGrid = {}
  const weeklyCount: Record<string, number> = {}

  const slotOrder: { week: number; day: number; slot: number }[] = []
  for (const w of weeksToGenerate) {
    for (let d = 1; d <= daysPerWeek; d++) {
      for (let s = 0; s < SLOTS_PER_DAY; s++) {
        slotOrder.push({ week: w, day: d, slot: s })
      }
    }
  }

  for (const { week, day, slot } of slotOrder) {
    const key = `W${week}D${day}`
    if (!skillGrid[key]) skillGrid[key] = [0, 0]

    const usedToday = new Set<number>()
    if (slot === 1) {
      usedToday.add(skillGrid[key][0])
    }

    const firstWeek = Math.min(...weeksToGenerate)
    const prevDay = day === 1 ? (week === firstWeek ? null : { week: week - 1, day: daysPerWeek }) : { week, day: day - 1 }
    const prevKey = prevDay ? `W${prevDay.week}D${prevDay.day}` : null
    const usedPrevDay = prevKey && skillGrid[prevKey] ? new Set(skillGrid[prevKey]) : new Set<number>()

    const weekKey = `W${week}`

    const candidates = Array.from(pool).filter((idx) => {
      if (usedToday.has(idx)) return false
      if (usedPrevDay.has(idx)) return false
      const count = weeklyCount[`${weekKey}-${idx}`] ?? 0
      if (count >= MAX_PER_SKILL_PER_WEEK) return false
      return true
    })

    if (candidates.length === 0) {
      const fallback = Array.from(pool).filter((idx) => !usedToday.has(idx))
      const best = fallback.length > 0 ? fallback[0] : 0
      skillGrid[key][slot] = best
      weeklyCount[`${weekKey}-${best}`] = (weeklyCount[`${weekKey}-${best}`] ?? 0) + 1
      continue
    }

    candidates.sort((a, b) => {
      const scoreA = scoreSkill(a, user.skills || [], prevalenceByIndex.get(a) ?? 0.5)
      const scoreB = scoreSkill(b, user.skills || [], prevalenceByIndex.get(b) ?? 0.5)
      if (scoreB !== scoreA) return scoreB - scoreA
      return (prevalenceByIndex.get(b) ?? 0) - (prevalenceByIndex.get(a) ?? 0)
    })

    const chosen = candidates[0]
    skillGrid[key][slot] = chosen
    weeklyCount[`${weekKey}-${chosen}`] = (weeklyCount[`${weekKey}-${chosen}`] ?? 0) + 1
  }

  return skillGrid
}
