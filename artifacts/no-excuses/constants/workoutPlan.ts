export type WorkoutSessionKind = 'gait' | 'isometric' | 'hsr' | 'rest';
export type WorkoutRouteType = 'walk' | 'run' | 'rehab';
export type GaitProtocol = 'A' | 'B' | 'C' | 'D';
export type RehabRoutine = 1 | 2 | 3 | 4;
export type RegimenId = 1 | 2;

export type WorkoutPlanEntry = {
  title: string;
  type: WorkoutRouteType;
  kind: WorkoutSessionKind;
  duration: string;
  focus: string;
  protocolId?: GaitProtocol;
  rehabRoutine?: RehabRoutine;
};

export const WORKOUT_PLAN_VERSION = 3;
export const REGIMEN_LABELS: Record<RegimenId, string> = {
  1: 'Current regimen',
  2: 'Home-Grown Runner',
};

const protocolDetails: Record<GaitProtocol, Omit<WorkoutPlanEntry, 'kind' | 'protocolId' | 'rehabRoutine'>> = {
  A: {
    title: 'Protocol A · Brisk Walk',
    type: 'walk',
    duration: '30 min · 3.0–3.5 mph',
    focus: 'Walk only at a brisk, consistent pace. Maintain upright posture and a purposeful step without shuffling.',
  },
  B: {
    title: 'Protocol B · Ground Run Mechanics',
    type: 'run',
    duration: '30 min · 4 walk / 1 run',
    focus: 'Alternate 4 minutes walking with 1 minute of true ground running. Use a slightly plantarflexed ankle, soft mid-foot contact, and higher step frequency.',
  },
  C: {
    title: 'Protocol C · Progressive Loading',
    type: 'run',
    duration: '40 min · 3 walk / 2 run',
    focus: 'Alternate 3 minutes walking with 2 minutes of ground running at a controlled 3.5–4.5 mph pace. From Week 6, count backward from 100 by 3s during run intervals.',
  },
  D: {
    title: 'Protocol D · High Step Frequency',
    type: 'run',
    duration: '40 min · 2 walk / 3 run',
    focus: 'Alternate 2 minutes walking with 3 minutes of ground running at a controlled 3.5–5.0 mph pace. Prioritize high step frequency and low vertical bounce.',
  },
};

const isometricFocus = (routine: 1 | 2) =>
  routine === 1
    ? 'Isometric foundation: wall sits, single-leg bridge holds, lunge holds, and calf holds. Weeks 2–4 add 5 seconds to the applicable holds.'
    : 'Isometric foundation with light band resistance: wall sits, single-leg bridge holds, lunge holds, and calf holds. Keep the joint quiet and pain-free.';

const hsrFocus = (routine: 3 | 4) =>
  routine === 3
    ? 'Heavy slow resistance: goblet squats, Romanian deadlifts, single-leg deadlifts, and step-ups. Complete exactly 3 sets of 10 with controlled tempo.'
    : 'Heavy slow resistance: goblet squats, Romanian deadlifts, single-leg deadlifts, and step-ups. Complete exactly 3 sets of 10; add verbal fluency such as words beginning with F during the gait work.';

const gaitDays: Record<number, GaitProtocol> = {
  1: 'A', 3: 'A', 5: 'A',
  8: 'A', 10: 'A', 12: 'A',
  15: 'B', 17: 'B', 19: 'B',
  22: 'B', 24: 'B', 26: 'B',
  29: 'C', 31: 'C', 33: 'C', 34: 'C',
  36: 'C', 38: 'C', 40: 'C', 41: 'C',
  43: 'D', 45: 'D', 47: 'D', 48: 'D',
  50: 'D', 52: 'D', 54: 'D', 55: 'D',
};

const rehabDays: Record<number, RehabRoutine> = {
  2: 1, 4: 1, 6: 1,
  9: 1, 11: 1, 13: 1,
  16: 2, 18: 2, 20: 2,
  23: 2, 25: 2, 27: 2,
  30: 3, 32: 3,
  37: 3, 39: 3,
  44: 4, 46: 4,
  51: 4, 53: 4,
};

export const WORKOUT_PLAN: WorkoutPlanEntry[] = Array.from({ length: 56 }, (_, index) => {
  const day = index + 1;
  const week = Math.floor(index / 7) + 1;
  if (day % 7 === 0) {
    return {
      title: 'Complete Rest Day',
      type: 'rehab',
      kind: 'rest',
      duration: 'Recovery day',
      focus: 'Take complete rest. Monitor for pain, swelling, warmth, redness, or symptoms that persist beyond 48 hours.',
    };
  }
  const protocol = gaitDays[day];
  if (protocol) {
    return {
      ...protocolDetails[protocol],
      kind: 'gait',
      protocolId: protocol,
    };
  }
  const routine = rehabDays[day];
  if (routine === 1 || routine === 2) {
    return {
      title: `Isometric Rehab · Routine ${routine}`,
      type: 'rehab',
      kind: 'isometric',
      duration: routine === 1 ? '4 exercises · 3–4 sets' : '4 exercises · light band resistance',
      focus: isometricFocus(routine),
      rehabRoutine: routine,
    };
  }
  if (routine === 3 || routine === 4) {
    return {
    title: `HSR Strength · Routine ${routine}`,
    type: 'rehab',
    kind: 'hsr',
    duration: '4 exercises · 3 × 10',
    focus: hsrFocus(routine),
    rehabRoutine: routine,
    };
  }
  throw new Error(`No rehab routine configured for day ${day}`);
});

const regimenTwoPlan: Record<number, WorkoutPlanEntry> = {
  1: { title: 'Strength · Routine 1', type: 'rehab', kind: 'isometric', duration: '3 × 30 sec · 10 lb DBs', focus: 'Wall sits, single-leg bridge holds, lunge holds, and calf holds. RPE 5.', rehabRoutine: 1 },
  2: { title: 'Walk · Protocol A', type: 'walk', kind: 'gait', duration: '20 min walk', focus: 'Walk at a comfortable pace with smooth ground mechanics.' , protocolId: 'A' },
  3: { title: 'Complete Rest Day', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: 'Gentle stretching or foam rolling, then let the load settle.' },
  4: { title: 'Strength · Routine 1', type: 'rehab', kind: 'isometric', duration: '3 × 30 sec · 10 lb DBs', focus: 'Wall sits, single-leg bridge holds, lunge holds, and calf holds. RPE 5.', rehabRoutine: 1 },
  5: { title: 'Walk · Protocol A', type: 'walk', kind: 'gait', duration: '20 min walk', focus: 'Dual-tasking: talk while walking and keep the posture upright.', protocolId: 'A' },
  6: { title: 'Complete Rest Day', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: 'Complete rest.' },
  7: { title: 'Active · Protocol A', type: 'walk', kind: 'gait', duration: '30 min walk', focus: 'Low-intensity walk with smooth ground mechanics.', protocolId: 'A' },
  8: { title: 'Strength · Routine 1', type: 'rehab', kind: 'isometric', duration: '3 × 45 sec · 15 lb DBs', focus: 'Isometric holds with 15 lb dumbbells. RPE 6.', rehabRoutine: 1 },
  9: { title: 'Walk · Protocol A', type: 'walk', kind: 'gait', duration: '25 min walk', focus: 'Focus on smooth foot strikes.', protocolId: 'A' },
  10: { title: 'Complete Rest Day', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: 'Complete rest.' },
  11: { title: 'Strength · Routine 1', type: 'rehab', kind: 'isometric', duration: '3 × 45 sec · 15 lb DBs', focus: 'Isometric holds with 15 lb dumbbells. RPE 6.', rehabRoutine: 1 },
  12: { title: 'Walk · Protocol A', type: 'walk', kind: 'gait', duration: '25 min walk', focus: 'Dual-tasking practice while maintaining smooth foot strikes.', protocolId: 'A' },
  13: { title: 'Complete Rest Day', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: 'Complete rest.' },
  14: { title: 'Active · Protocol A', type: 'walk', kind: 'gait', duration: '40 min walk', focus: 'Low-intensity walk at RPE 4.', protocolId: 'A' },
  15: { title: 'Strength · Routine 2', type: 'rehab', kind: 'isometric', duration: 'Isometric holds · 15 lb DBs', focus: 'Focus on pelvic levelness during the isometric routine.', rehabRoutine: 2 },
  16: { title: 'Retrain · Protocol B', type: 'walk', kind: 'gait', duration: '20 min walk', focus: 'Introduce the toe-in gait cue. Stop if pain increases and use neutral gait with cadence checks.', protocolId: 'B' },
  17: { title: 'Complete Rest Day', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: 'Complete rest.' },
  18: { title: 'Strength · Routine 2', type: 'rehab', kind: 'isometric', duration: '3 × 45 sec · 15 lb DBs', focus: 'Isometric holds with pelvic levelness. RPE 6.', rehabRoutine: 2 },
  19: { title: 'Retrain · Protocol B', type: 'walk', kind: 'gait', duration: '20 min walk', focus: 'Toe-in focus with a cadence check.', protocolId: 'B' },
  20: { title: 'Complete Rest Day', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: 'Complete rest.' },
  21: { title: 'Active · Protocol A', type: 'walk', kind: 'gait', duration: '40 min walk', focus: 'Use a neutral gait and keep the effort low.', protocolId: 'A' },
  22: { title: 'Strength · Routine 2', type: 'rehab', kind: 'isometric', duration: 'Isometric holds · 20 lb DBs', focus: 'Lunge holds with a focus on stability. RPE 7.', rehabRoutine: 2 },
  23: { title: 'Retrain · Protocol B', type: 'walk', kind: 'gait', duration: '30 min walk', focus: 'Toe-in focus during a controlled walk.', protocolId: 'B' },
  24: { title: 'Complete Rest Day', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: 'Complete rest.' },
  25: { title: 'Strength · Routine 2', type: 'rehab', kind: 'isometric', duration: 'Isometric holds · 20 lb DBs', focus: 'Maximize stability while keeping the joint quiet and pain-free.', rehabRoutine: 2 },
  26: { title: 'Retrain · Protocol B', type: 'walk', kind: 'gait', duration: '30 min walk', focus: 'Dual-tasking and toe-in focus.', protocolId: 'B' },
  27: { title: 'Complete Rest Day', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: 'Complete rest.' },
  28: { title: 'Active · Protocol B', type: 'walk', kind: 'gait', duration: '45 min walk', focus: 'Maintain an automatic, comfortable gait feel.', protocolId: 'B' },
  29: { title: 'Strength · Routine 3', type: 'rehab', kind: 'hsr', duration: '3 × 10 · 20 lb Goblet Squat', focus: 'Control the eccentric descent and keep the knee tracked over the second toe. RPE 6.', rehabRoutine: 3 },
  30: { title: 'Interval · Protocol C', type: 'run', kind: 'gait', duration: '20 min · 1 min walk / 1 min run', focus: 'Initial walk/run intervals at a controlled effort.', protocolId: 'C' },
  31: { title: 'Complete Rest Day', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: 'Complete rest.' },
  32: { title: 'Strength · Routine 3', type: 'rehab', kind: 'hsr', duration: '3 × 10 · 20 lb RDLs', focus: 'Control the descent and keep the spine long.', rehabRoutine: 3 },
  33: { title: 'Interval · Protocol C', type: 'run', kind: 'gait', duration: '20 min · 1 min walk / 1 min run', focus: 'Check cadence during the run intervals.', protocolId: 'C' },
  34: { title: 'Complete Rest Day', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: 'Complete rest.' },
  35: { title: 'Active · Protocol A', type: 'walk', kind: 'gait', duration: '45 min walk', focus: 'Low-intensity walk at RPE 4.', protocolId: 'A' },
  36: { title: 'Strength · Routine 3', type: 'rehab', kind: 'hsr', duration: '3 × 10 · 25 lb Goblet Squat', focus: 'Control the eccentric descent and keep the knee tracked over the second toe. RPE 7.', rehabRoutine: 3 },
  37: { title: 'Interval · Protocol C', type: 'run', kind: 'gait', duration: '24 min · 1:1 ratio', focus: 'Keep the run intervals controlled at RPE 7.', protocolId: 'C' },
  38: { title: 'Complete Rest Day', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: 'Complete rest.' },
  39: { title: 'Strength · Routine 3', type: 'rehab', kind: 'hsr', duration: '3 × 12 · 25 lb RDLs', focus: 'Control the descent and keep the spine long.', rehabRoutine: 3 },
  40: { title: 'Interval · Protocol C', type: 'run', kind: 'gait', duration: '24 min · 1:1 ratio', focus: 'Use the toe-in cue only if needed and keep the cadence steady.', protocolId: 'C' },
  41: { title: 'Complete Rest Day', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: 'Complete rest.' },
  42: { title: 'Active · Protocol A', type: 'walk', kind: 'gait', duration: '50 min walk', focus: 'Low-intensity active recovery walk.', protocolId: 'A' },
  43: { title: 'Strength · Routine 4', type: 'rehab', kind: 'hsr', duration: '3 × 10 · 25 lb Step-ups', focus: 'Keep the hips level and control the step down. RPE 8.', rehabRoutine: 4 },
  44: { title: 'Build · Protocol D', type: 'run', kind: 'gait', duration: '25 min · 1 min walk / 4 min run', focus: 'Progress the run ratio while keeping a high cadence.', protocolId: 'D' },
  45: { title: 'Complete Rest Day', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: 'Complete rest.' },
  46: { title: 'Strength · Routine 4', type: 'rehab', kind: 'hsr', duration: '3 × 10 · 25 lb SLDLs', focus: 'Control the balance and keep the hips level.', rehabRoutine: 4 },
  47: { title: 'Build · Protocol D', type: 'run', kind: 'gait', duration: '25 min · 1 min walk / 4 min run', focus: 'Keep a high cadence throughout the run intervals.', protocolId: 'D' },
  48: { title: 'Complete Rest Day', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: 'Complete rest.' },
  49: { title: 'Active · Protocol A', type: 'walk', kind: 'gait', duration: '60 min walk', focus: 'Low-intensity active recovery walk. RPE 5.', protocolId: 'A' },
  50: { title: 'Strength · Routine 4', type: 'rehab', kind: 'hsr', duration: '3 × 8 · 30 lb DBs', focus: 'Master form with a controlled eccentric descent. RPE 8–9.', rehabRoutine: 4 },
  51: { title: 'Mastery · Protocol D', type: 'run', kind: 'gait', duration: '30 min · 1 min walk / 4 min run', focus: 'Build toward continuous running while maintaining form.', protocolId: 'D' },
  52: { title: 'Complete Rest Day', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: 'Complete rest.' },
  53: { title: 'Strength · Routine 4', type: 'rehab', kind: 'hsr', duration: '3 × 8 · 30 lb DBs', focus: 'Master the form of the dynamic resistance routine.', rehabRoutine: 4 },
  54: { title: 'Mastery · Protocol D', type: 'run', kind: 'gait', duration: '30 min · 1 min walk / 4 min run', focus: 'Use faded feedback and let the movement pattern become automatic.', protocolId: 'D' },
  55: { title: 'Complete Rest Day', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: 'Complete rest.' },
  56: { title: 'Mastery · Protocol D', type: 'run', kind: 'gait', duration: '30 min continuous run if pain-free', focus: 'Run continuously only if pain-free. Stop and return to lower impact if symptoms increase.', protocolId: 'D' },
};

export const REGIMEN_2_PLAN: WorkoutPlanEntry[] = Array.from({ length: 56 }, (_, index) => {
  const day = index + 1;
  const item = regimenTwoPlan[day];
  if (!item) throw new Error(`No regimen 2 entry configured for day ${day}`);
  return item;
});

export function getWorkoutPlan(regimenId: RegimenId): WorkoutPlanEntry[] {
  return regimenId === 2 ? REGIMEN_2_PLAN : WORKOUT_PLAN;
}

export function createInitialWorkouts(regimenId: RegimenId = 1) {
  return getWorkoutPlan(regimenId).map((item, index) => ({
    id: String(index + 1),
    day: index + 1,
    week: Math.floor(index / 7) + 1,
    regimenId,
    ...item,
    scheduled: true,
    completed: false,
  }));
}