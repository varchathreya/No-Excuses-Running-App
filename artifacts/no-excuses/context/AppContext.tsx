import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';

export type Workout = { id: string; day: string; title: string; type: 'walk' | 'run' | 'rehab'; duration: string; scheduled: boolean; completed: boolean };
const initialWorkouts: Workout[] = [
  { id: '1', day: 'MON', title: 'Paced Walk & Iso Prep', type: 'walk', duration: '25 min', scheduled: true, completed: false },
  { id: '2', day: 'TUE', title: 'Tendon Rehabilitation', type: 'rehab', duration: '18 min', scheduled: true, completed: true },
  { id: '3', day: 'WED', title: 'Walk / Jog Intervals', type: 'run', duration: '30 min', scheduled: false, completed: false },
  { id: '4', day: 'THU', title: 'Joint Prep Routine', type: 'rehab', duration: '15 min', scheduled: false, completed: false },
  { id: '5', day: 'FRI', title: 'Paced Walk & Iso Prep', type: 'walk', duration: '25 min', scheduled: false, completed: false },
  { id: '6', day: 'SAT', title: 'Easy Walk / Jog', type: 'run', duration: '35 min', scheduled: false, completed: false },
  { id: '7', day: 'SUN', title: 'Rest + Mobility', type: 'rehab', duration: '12 min', scheduled: false, completed: false },
];

type AppState = { workouts: Workout[]; scheduleAll: () => void; toggleSchedule: (id: string) => void; completeWorkout: (id: string) => void; completedCount: number; totalMiles: number };
const AppContext = createContext<AppState | null>(null);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [workouts, setWorkouts] = useState<Workout[]>(initialWorkouts);
  useEffect(() => { AsyncStorage.getItem('no-excuses-workouts').then((saved) => saved && setWorkouts(JSON.parse(saved))); }, []);
  useEffect(() => { AsyncStorage.setItem('no-excuses-workouts', JSON.stringify(workouts)); }, [workouts]);
  const update = (fn: (items: Workout[]) => Workout[]) => { setWorkouts(fn); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };
  const value = useMemo(() => ({
    workouts,
    scheduleAll: () => update((items) => items.map((item) => ({ ...item, scheduled: true }))),
    toggleSchedule: (id: string) => update((items) => items.map((item) => item.id === id ? { ...item, scheduled: !item.scheduled } : item)),
    completeWorkout: (id: string) => update((items) => items.map((item) => item.id === id ? { ...item, completed: true, scheduled: true } : item)),
    completedCount: workouts.filter((item) => item.completed).length,
    totalMiles: 4.8 + workouts.filter((item) => item.completed && item.type === 'run').length * 1.7,
  }), [workouts]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export function useApp() { const context = useContext(AppContext); if (!context) throw new Error('useApp must be used inside AppProvider'); return context; }