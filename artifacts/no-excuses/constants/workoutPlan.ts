export type WorkoutSessionKind = 'gait' | 'strength' | 'mobility' | 'rest';
export type WorkoutRouteType = 'walk' | 'run' | 'rehab';

export type WorkoutPlanEntry = {
  title: string;
  type: WorkoutRouteType;
  kind: WorkoutSessionKind;
  duration: string;
  focus: string;
};

export const WORKOUT_PLAN_VERSION = 2;

const gaitFocus =
  'Conversational pace on flat ground. Use shorter, quieter steps and a 10% stride-frequency increase.';
const isometricFocus =
  'Isometric foundation: control the knee, stabilize the pelvis, and keep the foot tripod steady.';
const mobilityFocus =
  'Mobility work for the hips, calves, and plantar fascia. Keep the movement easy and pain-free.';
const restFocus =
  'Full rest and a 24-hour symptom check. Normal muscle fatigue is okay; persistent joint pain means reduce the next load.';
const hsrFocus =
  'Heavy slow resistance: controlled goblet squats, Romanian deadlifts, and step-ups for 3 × 8–10 reps.';
const groundRunFocus =
  'Ground running: keep the center of mass quiet, use short frequent steps, and avoid an aerial bounce.';

export const WORKOUT_PLAN: WorkoutPlanEntry[] = [
  { title: 'Walking + Isometrics', type: 'walk', kind: 'strength', duration: '20 min + isometrics', focus: `${gaitFocus} ${isometricFocus}` },
  { title: 'Walking + Mobility', type: 'walk', kind: 'mobility', duration: '20 min + mobility', focus: `${gaitFocus} ${mobilityFocus}` },
  { title: 'Walking + Isometrics', type: 'walk', kind: 'strength', duration: '25 min + isometrics', focus: `${gaitFocus} ${isometricFocus}` },
  { title: 'Full Rest', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: restFocus },
  { title: 'Walking + Isometrics', type: 'walk', kind: 'strength', duration: '20 min + isometrics', focus: `${gaitFocus} ${isometricFocus}` },
  { title: 'Paced Walking', type: 'walk', kind: 'gait', duration: '30 min', focus: gaitFocus },
  { title: 'Full Rest', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: restFocus },

  { title: 'Walking + Isometrics', type: 'walk', kind: 'strength', duration: '25 min + isometrics', focus: `${gaitFocus} ${isometricFocus}` },
  { title: 'Walking + Mobility', type: 'walk', kind: 'mobility', duration: '25 min + mobility', focus: `${gaitFocus} ${mobilityFocus}` },
  { title: 'Walking + Isometrics', type: 'walk', kind: 'strength', duration: '30 min + isometrics', focus: `${gaitFocus} ${isometricFocus}` },
  { title: 'Full Rest', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: restFocus },
  { title: 'Walking + Isometrics', type: 'walk', kind: 'strength', duration: '25 min + isometrics', focus: `${gaitFocus} ${isometricFocus}` },
  { title: 'Paced Walking', type: 'walk', kind: 'gait', duration: '35 min', focus: gaitFocus },
  { title: 'Full Rest', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: restFocus },

  { title: 'Walking + Isometrics', type: 'walk', kind: 'strength', duration: '30 min + isometrics', focus: `${gaitFocus} ${isometricFocus}` },
  { title: 'Walking + Mobility', type: 'walk', kind: 'mobility', duration: '30 min + mobility', focus: `${gaitFocus} ${mobilityFocus}` },
  { title: 'Walking + Isometrics', type: 'walk', kind: 'strength', duration: '30 min + isometrics', focus: `${gaitFocus} ${isometricFocus}` },
  { title: 'Full Rest', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: restFocus },
  { title: 'Walking + Isometrics', type: 'walk', kind: 'strength', duration: '30 min + isometrics', focus: `${gaitFocus} ${isometricFocus}` },
  { title: 'Paced Walking', type: 'walk', kind: 'gait', duration: '40 min', focus: gaitFocus },
  { title: 'Full Rest', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: restFocus },

  { title: 'Walking + Isometrics', type: 'walk', kind: 'strength', duration: '35 min + isometrics', focus: `${gaitFocus} ${isometricFocus}` },
  { title: 'Walking + Mobility', type: 'walk', kind: 'mobility', duration: '35 min + mobility', focus: `${gaitFocus} ${mobilityFocus}` },
  { title: 'Walking + Isometrics', type: 'walk', kind: 'strength', duration: '35 min + isometrics', focus: `${gaitFocus} ${isometricFocus}` },
  { title: 'Full Rest', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: restFocus },
  { title: 'Walking + Isometrics', type: 'walk', kind: 'strength', duration: '35 min + isometrics', focus: `${gaitFocus} ${isometricFocus}` },
  { title: 'Paced Walking', type: 'walk', kind: 'gait', duration: '45 min', focus: gaitFocus },
  { title: 'Full Rest', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: restFocus },

  { title: 'HSR Strength + Walking', type: 'rehab', kind: 'strength', duration: 'HSR 3 × 8–10 + 15 min walk', focus: hsrFocus },
  { title: 'Ground Run Intervals', type: 'run', kind: 'gait', duration: '4 walk / 1 run × 4', focus: groundRunFocus },
  { title: 'HSR Strength + Walking', type: 'rehab', kind: 'strength', duration: 'HSR 3 × 8–10 + 15 min walk', focus: hsrFocus },
  { title: 'Full Rest', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: restFocus },
  { title: 'HSR Strength + Walking', type: 'rehab', kind: 'strength', duration: 'HSR 3 × 8–10 + 15 min walk', focus: hsrFocus },
  { title: 'Ground Run Intervals', type: 'run', kind: 'gait', duration: '4 walk / 1 run × 5', focus: groundRunFocus },
  { title: 'Full Rest', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: restFocus },

  { title: 'HSR Strength + Walking', type: 'rehab', kind: 'strength', duration: 'HSR 3 × 8–10 + 20 min walk', focus: hsrFocus },
  { title: 'Ground Run Intervals', type: 'run', kind: 'gait', duration: '3 walk / 1 run × 5', focus: groundRunFocus },
  { title: 'HSR Strength + Walking', type: 'rehab', kind: 'strength', duration: 'HSR 3 × 8–10 + 20 min walk', focus: hsrFocus },
  { title: 'Full Rest', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: restFocus },
  { title: 'HSR Strength + Walking', type: 'rehab', kind: 'strength', duration: 'HSR 3 × 8–10 + 20 min walk', focus: hsrFocus },
  { title: 'Ground Run Intervals', type: 'run', kind: 'gait', duration: '3 walk / 1 run × 6', focus: groundRunFocus },
  { title: 'Full Rest', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: restFocus },

  { title: 'HSR Strength + Walking', type: 'rehab', kind: 'strength', duration: 'HSR 3 × 8–10 + 25 min walk', focus: hsrFocus },
  { title: 'Ground Run Intervals', type: 'run', kind: 'gait', duration: '2 walk / 1 run × 8', focus: groundRunFocus },
  { title: 'HSR Strength + Walking', type: 'rehab', kind: 'strength', duration: 'HSR 3 × 8–10 + 25 min walk', focus: hsrFocus },
  { title: 'Full Rest', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: restFocus },
  { title: 'HSR Strength + Walking', type: 'rehab', kind: 'strength', duration: 'HSR 3 × 8–10 + 25 min walk', focus: hsrFocus },
  { title: 'Ground Run Intervals', type: 'run', kind: 'gait', duration: '2 walk / 2 run × 6', focus: groundRunFocus },
  { title: 'Full Rest', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: restFocus },

  { title: 'HSR Strength + Walking', type: 'rehab', kind: 'strength', duration: 'HSR 3 × 8–10 + 30 min walk', focus: hsrFocus },
  { title: 'Ground Run Intervals', type: 'run', kind: 'gait', duration: '1 walk / 2 run × 8', focus: groundRunFocus },
  { title: 'HSR Strength + Walking', type: 'rehab', kind: 'strength', duration: 'HSR 3 × 8–10 + 30 min walk', focus: hsrFocus },
  { title: 'Full Rest', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: restFocus },
  { title: 'HSR Strength + Walking', type: 'rehab', kind: 'strength', duration: 'HSR 3 × 8–10 + 30 min walk', focus: hsrFocus },
  { title: 'Continuous Ground Run', type: 'run', kind: 'gait', duration: '15–20 min', focus: groundRunFocus },
  { title: 'Final Rest + Assessment', type: 'rehab', kind: 'rest', duration: 'Recovery day', focus: 'Rest and assess gait comfort, stride frequency, pain response, and confidence before the next training block.' },
];

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