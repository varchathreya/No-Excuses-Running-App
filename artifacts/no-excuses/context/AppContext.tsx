import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState as RNAppState, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { createInitialWorkouts, type GaitProtocol, type RehabRoutine, type WorkoutSessionKind } from '@/constants/workoutPlan';

export type Workout = {
  id: string;
  day: number;
  week: number;
  title: string;
  type: 'walk' | 'run' | 'rehab';
  kind: WorkoutSessionKind;
  duration: string;
  focus: string;
  protocolId?: GaitProtocol;
  rehabRoutine?: RehabRoutine;
  scheduled: boolean;
  completed: boolean;
  alarmSet?: boolean;
};
export type RoutePoint = { latitude: number; longitude: number; altitude?: number; accuracy?: number; timestamp: number };
export type Activity = { id: string; startedAt: number; endedAt: number; distanceMeters: number; elapsedSeconds: number; route: RoutePoint[]; workoutId?: string };
export type RehabSetLog = { set: number; reps: number; weight: string };
export type RehabLog = {
  id: string;
  workoutId: string;
  exerciseKey: string;
  exerciseTitle: string;
  sets: RehabSetLog[];
  completedAt: number;
};
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export function workoutWeekdayIndex(day: number) { return (day - 1) % 7; }
export function activeWorkoutWeek(workouts: Workout[]) {
  return workouts.find((item) => item.scheduled && !item.completed)?.week ?? 8;
}
export function isWorkoutAvailableToday(day: number, week?: number, activeWeek?: number) {
  return workoutWeekdayIndex(day) === ((new Date().getDay() + 6) % 7)
    && (week === undefined || activeWeek === undefined || week === activeWeek);
}

const initialWorkouts: Workout[] = createInitialWorkouts();

function hydrateWorkouts(saved: string | null): Workout[] {
  if (!saved) return initialWorkouts;
  try {
    const previous = JSON.parse(saved) as Array<Partial<Workout> & { id?: string }>;
    const previousById = new Map(previous.map((item) => [item.id, item]));
    return initialWorkouts.map((item) => {
      const old = previousById.get(item.id);
      return {
        ...item,
        completed: old?.completed ?? item.completed,
        scheduled: old?.scheduled ?? item.scheduled,
        alarmSet: old?.alarmSet,
      };
    });
  } catch {
    return initialWorkouts;
  }
}

type AppState = {
  workouts: Workout[];
  activities: Activity[];
  rehabLogs: RehabLog[];
  scheduleAll: () => void;
  toggleSchedule: (id: string) => void;
  completeWorkout: (id: string) => void;
  setAlarmChecked: (id: string, checked: boolean) => void;
  saveActivity: (activity: Activity) => void;
  saveRehabLog: (log: RehabLog) => void;
  offlineMode: boolean;
  isOnline: boolean;
  networkAvailable: boolean;
  setOfflineMode: (enabled: boolean) => void;
  completedCount: number;
  totalMiles: number;
};
const AppContext = createContext<AppState | null>(null);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [workouts, setWorkouts] = useState<Workout[]>(initialWorkouts);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [rehabLogs, setRehabLogs] = useState<RehabLog[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [offlineMode, setOfflineModeState] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('no-excuses-workouts'),
      AsyncStorage.getItem('no-excuses-activities'),
      AsyncStorage.getItem('no-excuses-rehab-logs'),
    ]).then(([savedWorkouts, savedActivities, savedRehabLogs]) => {
      setWorkouts(hydrateWorkouts(savedWorkouts));
      if (savedActivities) {
        try {
          setActivities(JSON.parse(savedActivities));
        } catch {
          setActivities([]);
        }
      }
      if (savedRehabLogs) {
        try {
          setRehabLogs(JSON.parse(savedRehabLogs));
        } catch {
          setRehabLogs([]);
        }
      }
      setHydrated(true);
    });
  }, []);
  useEffect(() => {
    AsyncStorage.getItem('no-excuses-offline-mode').then((saved) => saved && setOfflineModeState(saved === 'true'));
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    void AsyncStorage.setItem('no-excuses-workouts', JSON.stringify(workouts));
  }, [hydrated, workouts]);
  useEffect(() => {
    if (!hydrated) return;
    void AsyncStorage.setItem('no-excuses-activities', JSON.stringify(activities));
  }, [activities, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    void AsyncStorage.setItem('no-excuses-rehab-logs', JSON.stringify(rehabLogs));
  }, [hydrated, rehabLogs]);
  const setOfflineMode = useCallback((enabled: boolean) => {
    setOfflineModeState(enabled);
    void AsyncStorage.setItem('no-excuses-offline-mode', String(enabled));
  }, []);
  const checkConnectivity = useCallback(async () => {
    if (offlineMode) {
      setIsOnline(false);
      return;
    }
    if (Platform.OS === 'web') {
      setIsOnline(typeof navigator === 'undefined' || navigator.onLine !== false);
      return;
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`https://clients3.google.com/generate_204?ts=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      setIsOnline(response.ok || response.status === 204);
    } catch {
      setIsOnline(false);
    }
  }, [offlineMode]);
  useEffect(() => {
    void checkConnectivity();
    const interval = setInterval(() => void checkConnectivity(), 15000);
    const subscription = RNAppState.addEventListener('change', (state) => {
      if (state === 'active') void checkConnectivity();
    });
    const webOnline = Platform.OS === 'web' && typeof window !== 'undefined'
      ? () => setIsOnline(true)
      : undefined;
    const webOffline = Platform.OS === 'web' && typeof window !== 'undefined'
      ? () => setIsOnline(false)
      : undefined;
    if (webOnline && webOffline) {
      window.addEventListener('online', webOnline);
      window.addEventListener('offline', webOffline);
    }
    return () => {
      clearInterval(interval);
      subscription.remove();
      if (webOnline && webOffline) {
        window.removeEventListener('online', webOnline);
        window.removeEventListener('offline', webOffline);
      }
    };
  }, [checkConnectivity]);
  const update = (fn: (items: Workout[]) => Workout[]) => { setWorkouts(fn); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };
  const value = useMemo(() => ({
    workouts, activities, rehabLogs,
    scheduleAll: () => update((items) => items.map((item) => ({ ...item, scheduled: true }))),
    toggleSchedule: (id: string) => update((items) => items.map((item) => item.id === id ? { ...item, scheduled: !item.scheduled } : item)),
    completeWorkout: (id: string) => update((items) => items.map((item) => item.id === id ? { ...item, completed: true, scheduled: true } : item)),
    setAlarmChecked: (id: string, checked: boolean) => update((items) => items.map((item) => item.id === id ? { ...item, alarmSet: checked } : item)),
    saveActivity: (activity: Activity) => setActivities((items) => [activity, ...items]),
    saveRehabLog: (log: RehabLog) => setRehabLogs((items) => [log, ...items]),
    offlineMode,
    isOnline,
    networkAvailable: !offlineMode && isOnline,
    setOfflineMode,
    completedCount: workouts.filter((item) => item.completed).length,
    totalMiles: activities.reduce((sum, activity) => sum + activity.distanceMeters / 1609.34, 0),
  }), [workouts, activities, rehabLogs, offlineMode, isOnline, setOfflineMode]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export function useApp() { const context = useContext(AppContext); if (!context) throw new Error('useApp must be used inside AppProvider'); return context; }