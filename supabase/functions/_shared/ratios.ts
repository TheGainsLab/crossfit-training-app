/**
 * Pure ratio calculation logic (no DB fetch).
 * Used by buildUserContextForProgram and calculate-ratios edge function.
 */
export function calculateUserRatios(user: {
  name: string
  gender?: string
  bodyWeight?: number
  oneRMs: number[]
}): Record<string, unknown> {
  const effectiveGender = (user.gender === 'Male' || user.gender === 'Female') ? user.gender : 'Male'

  const ratios: Record<string, number> = {
    snatch_back_squat: user.oneRMs[6] && user.oneRMs[0] ?
      Math.min(parseFloat((user.oneRMs[0] / user.oneRMs[6]).toFixed(3)), 1.0) : 0,
    clean_jerk_back_squat: user.oneRMs[6] && user.oneRMs[2] ?
      Math.min(parseFloat((user.oneRMs[2] / user.oneRMs[6]).toFixed(3)), 1.0) : 0,
    jerk_clean: user.oneRMs[4] && user.oneRMs[5] ?
      Math.min(parseFloat((user.oneRMs[5] / user.oneRMs[4]).toFixed(3)), 1.0) : 0,
    power_snatch_snatch: user.oneRMs[0] && user.oneRMs[1] ?
      Math.min(parseFloat((user.oneRMs[1] / user.oneRMs[0]).toFixed(3)), 1.0) : 0,
    power_clean_clean: user.oneRMs[4] && user.oneRMs[3] ?
      Math.min(parseFloat((user.oneRMs[3] / user.oneRMs[4]).toFixed(3)), 1.0) : 0,
    front_squat_back_squat: user.oneRMs[6] && user.oneRMs[7] ?
      Math.min(parseFloat((user.oneRMs[7] / user.oneRMs[6]).toFixed(3)), 1.0) : 0,
    overhead_squat_back_squat: user.oneRMs[6] && user.oneRMs[8] ?
      Math.min(parseFloat((user.oneRMs[8] / user.oneRMs[6]).toFixed(3)), 1.0) : 0,
    back_squat_body_weight: user.bodyWeight && user.oneRMs[6] ?
      parseFloat((user.oneRMs[6] / user.bodyWeight).toFixed(3)) : 0,
    deadlift_body_weight: user.bodyWeight && user.oneRMs[9] ?
      parseFloat((user.oneRMs[9] / user.bodyWeight).toFixed(3)) : 0,
    bench_press_body_weight: user.bodyWeight && user.oneRMs[10] ?
      parseFloat((user.oneRMs[10] / user.bodyWeight).toFixed(3)) : 0,
    weighted_pullup_body_weight: user.bodyWeight && user.oneRMs[13] ?
      parseFloat((user.oneRMs[13] / user.bodyWeight).toFixed(3)) : 0,
    weighted_pullup_bench_press: user.oneRMs[10] && user.oneRMs[13] ?
      parseFloat((user.oneRMs[13] / user.oneRMs[10]).toFixed(3)) : 0,
    push_press_strict_press: user.oneRMs[12] && user.oneRMs[11] ?
      parseFloat((user.oneRMs[11] / user.oneRMs[12]).toFixed(3)) : 0,
    snatch_clean_jerk: user.oneRMs[2] && user.oneRMs[0] ?
      parseFloat((user.oneRMs[0] / user.oneRMs[2]).toFixed(3)) : 0
  }

  const needsUpperBack = true
  const deadliftBackSquatRatio = user.oneRMs[6] && user.oneRMs[9] ? (user.oneRMs[9] / user.oneRMs[6]) : 0
  const needsLegStrength = deadliftBackSquatRatio >= 1.15
  const needsPosteriorChain = !needsLegStrength
  const needsUpperBodyPressing = (ratios.bench_press_body_weight < 0.9) || (ratios.push_press_strict_press > 1.45)
  const needsUpperBodyPulling = (ratios.weighted_pullup_bench_press < 0.4) || (ratios.weighted_pullup_body_weight < 0.33)
  const needsCore = true

  const snatchFailedRatios = [
    !ratios.snatch_back_squat || ratios.snatch_back_squat < 0.62,
    !ratios.power_snatch_snatch || ratios.power_snatch_snatch > 0.88,
    !ratios.overhead_squat_back_squat || ratios.overhead_squat_back_squat < 0.65
  ].filter(Boolean).length

  const cleanJerkFailedRatios = [
    !ratios.clean_jerk_back_squat || ratios.clean_jerk_back_squat < 0.74,
    !ratios.power_clean_clean || ratios.power_clean_clean > 0.88,
    !ratios.jerk_clean || ratios.jerk_clean < 0.9
  ].filter(Boolean).length

  const snatchTechnicalCount = snatchFailedRatios === 0 ? 1 : snatchFailedRatios === 3 ? 3 : 2
  const cleanJerkTechnicalCount = cleanJerkFailedRatios === 0 ? 1 : cleanJerkFailedRatios === 3 ? 3 : 2

  const backSquatTechnicalFocus = (ratios.overhead_squat_back_squat && ratios.overhead_squat_back_squat >= 0.65) ? 'position' : 'overhead'
  const frontSquatTechnicalFocus = (ratios.front_squat_back_squat && ratios.front_squat_back_squat >= 0.82) ? 'overhead_complex' : 'front_rack'
  const pressTechnicalFocus = (ratios.push_press_strict_press && ratios.push_press_strict_press <= 1.65) ? 'stability_unilateral' : 'strict_strength'

  let backSquatLevel = 'Beginner'
  if (user.bodyWeight && user.oneRMs[6]) {
    if (effectiveGender === 'Male') {
      backSquatLevel = ratios.back_squat_body_weight < 1.25 ? 'Beginner' :
        ratios.back_squat_body_weight >= 1.85 ? 'Advanced' : 'Intermediate'
    } else {
      backSquatLevel = ratios.back_squat_body_weight < 0.75 ? 'Beginner' :
        ratios.back_squat_body_weight >= 1.2 ? 'Advanced' : 'Intermediate'
    }
  }

  let snatchLevel: string = backSquatLevel === 'Beginner' ? 'Beginner' :
    ratios.snatch_back_squat >= 0.62 ? backSquatLevel :
    backSquatLevel === 'Advanced' ? 'Intermediate' : 'Beginner'

  let cleanJerkLevel: string = backSquatLevel === 'Beginner' ? 'Beginner' :
    ratios.clean_jerk_back_squat >= 0.74 ? backSquatLevel :
    backSquatLevel === 'Advanced' ? 'Intermediate' : 'Beginner'

  if (backSquatLevel === 'Beginner' && user.bodyWeight && user.oneRMs[0] && user.oneRMs[2]) {
    const snatchBodyWeightRatio = user.oneRMs[0] / user.bodyWeight
    const cleanJerkBodyWeightRatio = user.oneRMs[2] / user.bodyWeight
    if (effectiveGender === 'Male') {
      if (snatchBodyWeightRatio >= 0.5) snatchLevel = 'Intermediate'
      if (cleanJerkBodyWeightRatio >= 0.6) cleanJerkLevel = 'Intermediate'
    } else {
      if (snatchBodyWeightRatio >= 0.5) snatchLevel = 'Intermediate'
      if (cleanJerkBodyWeightRatio >= 0.6) cleanJerkLevel = 'Intermediate'
    }
  }

  let pressLevel = 'Beginner'
  if (user.bodyWeight && user.oneRMs[10]) {
    const benchBodyWeightRatio = user.oneRMs[10] / user.bodyWeight
    if (effectiveGender === 'Male') {
      pressLevel = benchBodyWeightRatio < 0.9 ? 'Beginner' :
        benchBodyWeightRatio >= 1.4 ? 'Advanced' : 'Intermediate'
    } else {
      pressLevel = benchBodyWeightRatio < 0.7 ? 'Beginner' :
        benchBodyWeightRatio >= 1.0 ? 'Advanced' : 'Intermediate'
    }
  }

  return {
    ...ratios,
    needs_upper_back: needsUpperBack,
    needs_leg_strength: needsLegStrength,
    needs_posterior_chain: needsPosteriorChain,
    needs_upper_body_pressing: needsUpperBodyPressing,
    needs_upper_body_pulling: needsUpperBodyPulling,
    needs_core: needsCore,
    snatch_technical_count: snatchTechnicalCount,
    clean_jerk_technical_count: cleanJerkTechnicalCount,
    back_squat_technical_focus: backSquatTechnicalFocus,
    front_squat_technical_focus: frontSquatTechnicalFocus,
    press_technical_focus: pressTechnicalFocus,
    snatch_level: snatchLevel,
    clean_jerk_level: cleanJerkLevel,
    back_squat_level: backSquatLevel,
    press_level: pressLevel
  }
}
