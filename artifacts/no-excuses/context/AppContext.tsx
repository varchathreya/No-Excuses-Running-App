import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState as RNAppState, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { createInitialWorkouts, type GaitProtocol, type RegimenId, type RehabRoutine, type WorkoutSessionKind } from '@/constants/workoutPlan';

export type Workout = {
  id: string;
  day: number;
  week: number;
  title: string;
  type: 'walk' | 'run' | 'rehab';
  kind: WorkoutSessionKind;
  regimenId: RegimenId;
  duration: string;
  minimumDurationSeconds?: number;
  focus: string;
  protocolId?: GaitProtocol;
  rehabRoutine?: RehabRoutine;
  scheduled: boolean;
  completed: boolean;
  alarmSet?: boolean;
};
export type RoutePoint = { latitude: number; longitude: number; altitude?: number; accuracy?: number; timestamp: number };
export type Activity = { id: string; startedAt: number; endedAt: number; distanceMeters: number; elapsedSeconds: number; route: RoutePoint[]; workoutId?: string; regimenId?: RegimenId };
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
export function dateKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function dateFromKey(value: string | null | undefined) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}
export function workoutDate(day: number, startDate?: string | null) {
  const start = dateFromKey(startDate);
  if (!start) return null;
  const date = new Date(start);
  date.setDate(date.getDate() + day - 1);
  return date;
}
export function workoutWeekdayIndex(day: number, startDate?: string | null) {
  const date = workoutDate(day, startDate);
  if (date) return (date.getDay() + 6) % 7;
  return (day - 1) % 7;
}
export function workoutWeekdayName(day: number, startDate?: string | null) {
  return WEEKDAYS[workoutWeekdayIndex(day, startDate)];
}
export function workoutDateLabel(day: number, startDate?: string | null) {
  const date = workoutDate(day, startDate);
  return date
    ? date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;
}
export function planDayForDate(date: Date, startDate?: string | null) {
  const start = dateFromKey(startDate);
  if (!start) return null;
  const startOfStart = new Date(start);
  startOfStart.setHours(0, 0, 0, 0);
  const startOfDate = new Date(date);
  startOfDate.setHours(0, 0, 0, 0);
  const offset = Math.round((startOfDate.getTime() - startOfStart.getTime()) / 86400000);
  return offset >= 0 && offset < 56 ? offset + 1 : null;
}
export function planWeekForDate(date: Date, startDate?: string | null) {
  const day = planDayForDate(date, startDate);
  return day ? Math.floor((day - 1) / 7) + 1 : null;
}
export function activeWorkoutWeek(workouts: Workout[]) {
  return workouts.find((item) => item.scheduled && !item.completed)?.week ?? 8;
}
export function currentPlanWeek(workouts: Workout[], startDate?: string | null) {
  return startDate ? planWeekForDate(new Date(), startDate) : activeWorkoutWeek(workouts);
}
export function scheduledWorkoutForToday(workouts: Workout[], startDate?: string | null) {
  if (startDate) {
    const planDay = planDayForDate(new Date(), startDate);
    return planDay ? workouts.find((item) => item.day === planDay) : undefined;
  }
  const weekday = (new Date().getDay() + 6) % 7;
  const week = activeWorkoutWeek(workouts);
  return workouts.find((item) => item.week === week && workoutWeekdayIndex(item.day) === weekday);
}
export function isWorkoutAvailableToday(day: number, week?: number, activeWeek?: number, startDate?: string | null) {
  const plannedDate = workoutDate(day, startDate);
  if (plannedDate) {
    // Once a custom start date is selected, the calendar date is the source
    // of truth. The plan no longer has to begin on a Monday, and its week
    // number is already encoded by the day offset from that start date.
    return dateKeyFromDate(plannedDate) === dateKeyFromDate(new Date());
  }

  // Preserve the original Monday-based behavior until a start date is set.
  return workoutWeekdayIndex(day) === ((new Date().getDay() + 6) % 7)
    && (week === undefined || activeWeek === undefined || week === activeWeek);
}

type SavedWorkout = Partial<Workout> & { id?: string };
type WorkoutsByRegimen = Partial<Record<RegimenId, Workout[]>>;

function hydrateWorkouts(saved: SavedWorkout[] | null, regimenId: RegimenId): Workout[] {
  const initialWorkouts = createInitialWorkouts(regimenId);
  if (!saved) return initialWorkouts;
  const previousById = new Map(saved.map((item) => [item.id, item]));
  return initialWorkouts.map((item) => {
    const old = previousById.get(item.id);
    return {
      ...item,
      completed: old?.completed ?? item.completed,
      scheduled: old?.scheduled ?? item.scheduled,
      alarmSet: old?.alarmSet,
    };
  });
}
function parseSavedWorkouts(value: string | null): SavedWorkout[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as SavedWorkout[] : null;
  } catch {
    return null;
  }
}

type AppState = {
  workouts: Workout[];
  regimenId: RegimenId;
  startDate: string | null;
  hydrated: boolean;
  setRegimen: (regimenId: RegimenId) => void;
  setStartDate: (startDate: string | null) => void;
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
  const [workouts, setWorkouts] = useState<Workout[]>(() => createInitialWorkouts(1));
  const [workoutsByRegimen, setWorkoutsByRegimen] = useState<WorkoutsByRegimen>({});
  const [regimenId, setRegimenIdState] = useState<RegimenId>(1);
  const [startDate, setStartDateState] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [rehabLogs, setRehabLogs] = useState<RehabLog[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [offlineMode, setOfflineModeState] = useState(false);
  const [isOnline, setIsOnline] = useState(Platform.OS === 'web' ? typeof navigator === 'undefined' || navigator.onLine !== false : false);
  const hasLocalEditsRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    let releasedOnFallback = false;
    const fallbackTimer = setTimeout(() => {
      if (cancelled) return;
      releasedOnFallback = true;
      setHydrated(true);
    }, 1500);

    Promise.all([
      AsyncStorage.getItem('no-excuses-workouts'),
      AsyncStorage.getItem('no-excuses-workouts-by-regimen'),
      AsyncStorage.getItem('no-excuses-activities'),
      AsyncStorage.getItem('no-excuses-rehab-logs'),
      AsyncStorage.getItem('no-excuses-regimen'),
      AsyncStorage.getItem('no-excuses-start-date'),
      AsyncStorage.getItem('no-excuses-offline-mode'),
    ]).then(([savedWorkouts, savedWorkoutsByRegimen, savedActivities, savedRehabLogs, savedRegimen, savedStartDate, savedOfflineMode]) => {
      if (cancelled) return;
      clearTimeout(fallbackTimer);

      // If the UI was already released and the user edited the default state,
      // do not overwrite those edits with a late storage response.
      if (releasedOnFallback && hasLocalEditsRef.current) {
        setStorageReady(true);
        return;
      }

      const storedRegimen: RegimenId = savedRegimen === '2' ? 2 : 1;
      let parsedByRegimen: WorkoutsByRegimen = {};
      if (savedWorkoutsByRegimen) {
        try {
          const parsed = JSON.parse(savedWorkoutsByRegimen) as Record<string, SavedWorkout[]>;
          parsedByRegimen = {
            1: Array.isArray(parsed['1']) ? hydrateWorkouts(parsed['1'], 1) : undefined,
            2: Array.isArray(parsed['2']) ? hydrateWorkouts(parsed['2'], 2) : undefined,
          };
        } catch {
          parsedByRegimen = {};
        }
      }
      if (!parsedByRegimen[1]) {
        const legacyWorkouts = parseSavedWorkouts(savedWorkouts);
        if (legacyWorkouts) parsedByRegimen[1] = hydrateWorkouts(legacyWorkouts, 1);
      }
      const currentSaved = parsedByRegimen[storedRegimen];
      setWorkoutsByRegimen(parsedByRegimen);
      setRegimenIdState(storedRegimen);
      setWorkouts(currentSaved ?? createInitialWorkouts(storedRegimen));
      setStartDateState(savedStartDate && dateFromKey(savedStartDate) ? savedStartDate : null);
      setOfflineModeState(savedOfflineMode === 'true');
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
      setStorageReady(true);
    }).catch(() => {
      if (cancelled) return;
      clearTimeout(fallbackTimer);
      setHydrated(true);
    });

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
    };
  }, []);
  useEffect(() => {
    if (!hydrated || !storageReady) return;
    void AsyncStorage.setItem('no-excuses-workouts', JSON.stringify(workouts));
  }, [hydrated, storageReady, workouts]);
  useEffect(() => {
    if (!hydrated || !storageReady) return;
    const merged = { ...workoutsByRegimen, [regimenId]: workouts };
    void AsyncStorage.setItem('no-excuses-workouts-by-regimen', JSON.stringify(merged));
  }, [hydrated, regimenId, storageReady, workouts, workoutsByRegimen]);
  useEffect(() => {
    if (!hydrated || !storageReady) return;
    void AsyncStorage.setItem('no-excuses-activities', JSON.stringify(activities));
  }, [activities, hydrated, storageReady]);
  useEffect(() => {
    if (!hydrated || !storageReady) return;
    void AsyncStorage.setItem('no-excuses-rehab-logs', JSON.stringify(rehabLogs));
  }, [hydrated, rehabLogs, storageReady]);
  const setOfflineMode = useCallback((enabled: boolean) => {
    hasLocalEditsRef.current = true;
    setOfflineModeState(enabled);
    void AsyncStorage.setItem('no-excuses-offline-mode', String(enabled));
  }, []);
  const setStartDate = useCallback((nextStartDate: string | null) => {
    hasLocalEditsRef.current = true;
    setStartDateState(nextStartDate);
    void AsyncStorage.setItem('no-excuses-start-date', nextStartDate ?? '');
  }, []);
  const setRegimen = useCallback((nextRegimen: RegimenId) => {
    if (nextRegimen === regimenId) return;
    hasLocalEditsRef.current = true;
    setWorkoutsByRegimen((previous) => ({ ...previous, [regimenId]: workouts }));
    setWorkouts(workoutsByRegimen[nextRegimen] ?? createInitialWorkouts(nextRegimen));
    setRegimenIdState(nextRegimen);
    void AsyncStorage.setItem('no-excuses-regimen', String(nextRegimen));
  }, [regimenId, workouts, workoutsByRegimen]);
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
       const timeout = setTimeout(() => controller.abort(), 2500);
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
  const update = (fn: (items: Workout[]) => Workout[]) => { hasLocalEditsRef.current = true; setWorkouts(fn); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };
  const value = useMemo(() => ({
    workouts, activities, rehabLogs, regimenId, startDate, hydrated, setRegimen, setStartDate,
    scheduleAll: () => update((items) => items.map((item) => ({ ...item, scheduled: true }))),
    toggleSchedule: (id: string) => update((items) => items.map((item) => item.id === id ? { ...item, scheduled: !item.scheduled } : item)),
    completeWorkout: (id: string) => update((items) => items.map((item) => item.id === id ? { ...item, completed: true, scheduled: true } : item)),
    setAlarmChecked: (id: string, checked: boolean) => update((items) => items.map((item) => item.id === id ? { ...item, alarmSet: checked } : item)),
    saveActivity: (activity: Activity) => { hasLocalEditsRef.current = true; setActivities((items) => [activity, ...items]); },
    saveRehabLog: (log: RehabLog) => { hasLocalEditsRef.current = true; setRehabLogs((items) => [log, ...items]); },
    offlineMode,
    isOnline,
    networkAvailable: !offlineMode && isOnline,
    setOfflineMode,
    completedCount: workouts.filter((item) => item.completed).length,
    totalMiles: activities.reduce((sum, activity) => sum + activity.distanceMeters / 1609.34, 0),
  }), [workouts, activities, rehabLogs, regimenId, startDate, hydrated, setRegimen, setStartDate, offlineMode, isOnline, setOfflineMode]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export function useApp() { const context = useContext(AppContext); if (!context) throw new Error('useApp must be used inside AppProvider'); return context; }