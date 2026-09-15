export type WorkoutSessionKind = 'gait' | 'isometric' | 'hsr' | 'rest';
export type WorkoutRouteType = 'walk' | 'run' | 'rehab';
export type GaitProtocol = 'A' | 'B' | 'C' | 'D';
export type RehabRoutine = 1 | 2 | 3 | 4;

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

export function createInitialWorkouts() {
  return WORKOUT_PLAN.map((item, index) => ({
    id: String(index + 1),
    day: index + 1,
    week: Math.floor(index / 7) + 1,
    ...item,
    scheduled: true,
    completed: false,
  }));
}