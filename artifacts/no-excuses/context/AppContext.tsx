import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';

export type Workout = {
  id: string;
  day: number;
  week: number;
  title: string;
  type: 'walk' | 'run' | 'rehab';
  duration: string;
  focus: string;
  scheduled: boolean;
  completed: boolean;
};
export type RoutePoint = { latitude: number; longitude: number; altitude?: number; accuracy?: number; timestamp: number };
export type Activity = { id: string; startedAt: number; endedAt: number; distanceMeters: number; elapsedSeconds: number; route: RoutePoint[] };

const toolkit = 'Strength toolkit: A-skips, hip circles, walking lunges, single-leg deadlifts, bodyweight squats, clamshells, hip hikes, glute bridges, short-foot doming, toe yoga, calf raises, hip flexor stretch, plantar rolling, calf smashes.';
const plan: Array<{ title: string; type: Workout['type']; duration: string; focus: string }> = [
  { title: 'Paced Walking', type: 'walk', duration: '20 min', focus: 'Quick, light feet; increase natural cadence 5–10%.' },
  { title: 'Strength + Foot Stability', type: 'rehab', duration: '15 min', focus: 'Foot doming and hip stability. ' + toolkit },
  { title: 'Paced Walking', type: 'walk', duration: '20 min', focus: 'Quick, light feet; increase natural cadence 5–10%.' },
  { title: 'Strength + Foot Stability', type: 'rehab', duration: '15 min', focus: toolkit },
  { title: 'Paced Walking', type: 'walk', duration: '20 min', focus: 'Quick, light feet; increase natural cadence 5–10%.' },
  { title: 'Strength + Foot Stability', type: 'rehab', duration: '15 min', focus: toolkit },
  { title: 'Rest + Recovery Check', type: 'rehab', duration: '10 min', focus: 'Use the 24-hour rule. Flat ground only this month.' },
  { title: 'Walk / Jog Intervals', type: 'run', duration: '18 min · 1 jog / 2 walk × 6', focus: 'Train-track feet; maintain a slightly wider stance.' },
  { title: 'Hip Abductor Strength', type: 'rehab', duration: '18 min', focus: 'Clamshells, hip hikes, bridges, and single-leg control.' },
  { title: 'Walk / Jog Intervals', type: 'run', duration: '18 min · 1 jog / 2 walk × 6', focus: 'Train-track feet; maintain a slightly wider stance.' },
  { title: 'Hip Abductor Strength', type: 'rehab', duration: '18 min', focus: toolkit },
  { title: 'Walk / Jog Intervals', type: 'run', duration: '18 min · 1 jog / 2 walk × 6', focus: 'Train-track feet; maintain a slightly wider stance.' },
  { title: 'Hip Abductor Strength', type: 'rehab', duration: '18 min', focus: toolkit },
  { title: 'Rest + Recovery Check', type: 'rehab', duration: '10 min', focus: 'If stiffness persists beyond 24 hours, reduce next intervals by 20%.' },
  { title: 'Walk / Jog Intervals', type: 'run', duration: '20 min · 2 jog / 2 walk × 5', focus: 'Gait automaticity; count backward while keeping form quiet.' },
  { title: 'Step Length Strength', type: 'rehab', duration: '18 min', focus: 'Land softly under your body. Include calf raises and foot control.' },
  { title: 'Walk / Jog Intervals', type: 'run', duration: '20 min · 2 jog / 2 walk × 5', focus: 'Gait automaticity; count backward while keeping form quiet.' },
  { title: 'Step Length Strength', type: 'rehab', duration: '18 min', focus: toolkit },
  { title: 'Walk / Jog Intervals', type: 'run', duration: '20 min · 2 jog / 2 walk × 5', focus: 'Gait automaticity; count backward while keeping form quiet.' },
  { title: 'Step Length Strength', type: 'rehab', duration: '18 min', focus: toolkit },
  { title: 'Rest + Recovery Check', type: 'rehab', duration: '10 min', focus: 'Check for joint pain versus normal muscle fatigue.' },
  { title: 'Easy Jog / Walk', type: 'run', duration: '20 min · 3 jog / 2 walk × 4', focus: 'Minimize vertical bounce; keep your head level and steps quiet.' },
  { title: 'Four Pillars Review', type: 'rehab', duration: '20 min', focus: 'Review cadence, shorter step length, train-track width, and low bounce.' },
  { title: 'Easy Jog / Walk', type: 'run', duration: '20 min · 3 jog / 2 walk × 4', focus: 'Minimize vertical bounce; keep your head level and steps quiet.' },
  { title: 'Four Pillars Review', type: 'rehab', duration: '20 min', focus: toolkit },
  { title: 'Easy Jog / Walk', type: 'run', duration: '20 min · 3 jog / 2 walk × 4', focus: 'Minimize vertical bounce; keep your head level and steps quiet.' },
  { title: 'Four Pillars Review', type: 'rehab', duration: '20 min', focus: toolkit },
  { title: 'Rest + Recovery Check', type: 'rehab', duration: '10 min', focus: 'Celebrate resilient recovery. Keep all sessions flat and level.' },
];
const initialWorkouts: Workout[] = plan.map((item, index) => ({ id: String(index + 1), day: index + 1, week: Math.floor(index / 7) + 1, ...item, scheduled: index < 3, completed: index === 1 }));

type AppState = {
  workouts: Workout[];
  activities: Activity[];
  scheduleAll: () => void;
  toggleSchedule: (id: string) => void;
  completeWorkout: (id: string) => void;
  saveActivity: (activity: Activity) => void;
  completedCount: number;
  totalMiles: number;
};
const AppContext = createContext<AppState | null>(null);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [workouts, setWorkouts] = useState<Workout[]>(initialWorkouts);
  const [activities, setActivities] = useState<Activity[]>([]);
  useEffect(() => { AsyncStorage.getItem('no-excuses-workouts').then((saved) => saved && setWorkouts(JSON.parse(saved))); AsyncStorage.getItem('no-excuses-activities').then((saved) => saved && setActivities(JSON.parse(saved))); }, []);
  useEffect(() => { AsyncStorage.setItem('no-excuses-workouts', JSON.stringify(workouts)); }, [workouts]);
  useEffect(() => { AsyncStorage.setItem('no-excuses-activities', JSON.stringify(activities)); }, [activities]);
  const update = (fn: (items: Workout[]) => Workout[]) => { setWorkouts(fn); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };
  const value = useMemo(() => ({
    workouts, activities,
    scheduleAll: () => update((items) => items.map((item) => ({ ...item, scheduled: true }))),
    toggleSchedule: (id: string) => update((items) => items.map((item) => item.id === id ? { ...item, scheduled: !item.scheduled } : item)),
    completeWorkout: (id: string) => update((items) => items.map((item) => item.id === id ? { ...item, completed: true, scheduled: true } : item)),
    saveActivity: (activity: Activity) => setActivities((items) => [activity, ...items]),
    completedCount: workouts.filter((item) => item.completed).length,
    totalMiles: activities.reduce((sum, activity) => sum + activity.distanceMeters / 1609.34, 0),
  }), [workouts, activities]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export function useApp() { const context = useContext(AppContext); if (!context) throw new Error('useApp must be used inside AppProvider'); return context; }