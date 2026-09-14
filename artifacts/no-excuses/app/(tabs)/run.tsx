import React, { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Screen, Header, Button, Pill, SectionTitle, styles } from '@/components/Screen';
import { Activity, isWorkoutAvailableToday, RoutePoint, useApp, WEEKDAYS, Workout, workoutWeekdayIndex } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import NativeRouteMap from '@/components/NativeRouteMap';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { BrandedModal } from '@/components/BrandedModal';

const EARTH_RADIUS = 6371000;
const PACE_WINDOW_MS = 12000;
const TARGET_PACE_SECONDS_PER_KM = 840;

function distance(a: RoutePoint, b: RoutePoint) {
  const p = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * p;
  const dLon = (b.longitude - a.longitude) * p;
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(a.latitude * p) * Math.cos(b.latitude * p) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function routeDistance(route: RoutePoint[]) {
  return route.slice(1).reduce((total, point, index) => total + distance(route[index], point), 0);
}

function paceLabel(secondsPerKm: number | null) {
  if (!secondsPerKm || !Number.isFinite(secondsPerKm)) return '—';
  return `${Math.floor(secondsPerKm / 60)}:${String(Math.floor(secondsPerKm % 60)).padStart(2, '0')}`;
}

function timeLabel(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function Run() {
  const colors = useColors();
  const router = useRouter();
  const { workoutId } = useLocalSearchParams<{ workoutId?: string }>();
  const { workouts, saveActivity, activities, completeWorkout } = useApp();
  const requestedWorkout = workouts.find((item) => item.id === workoutId);
  const wrongDay = !!requestedWorkout && !isWorkoutAvailableToday(requestedWorkout.day);
  const activeWeek = workouts.find((item) => item.scheduled && !item.completed)?.week;
  const requestedWorkoutToday = requestedWorkout
    && requestedWorkout.scheduled
    && !requestedWorkout.completed
    && requestedWorkout.type !== 'rehab'
    && isWorkoutAvailableToday(requestedWorkout.day)
    ? requestedWorkout
    : undefined;
  const todayWorkout = requestedWorkoutToday ?? workouts.find((item) =>
    item.week === activeWeek
    && item.scheduled
    && !item.completed
    && item.type !== 'rehab'
    && isWorkoutAvailableToday(item.day));

  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [moving, setMoving] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [meters, setMeters] = useState(0);
  const [livePace, setLivePace] = useState<number | null>(null);
  const [linkedWorkoutId, setLinkedWorkoutId] = useState<string | undefined>();
  const [completedActivity, setCompletedActivity] = useState<Activity | null>(null);
  const [starting, setStarting] = useState(false);
  const [showWrongDay, setShowWrongDay] = useState(wrongDay);
  const [ignoreRequestedWorkout, setIgnoreRequestedWorkout] = useState(false);
  const [showStartChoice, setShowStartChoice] = useState(false);
  const watch = useRef<Location.LocationSubscription | null>(null);
  const startedAt = useRef(0);
  const pointsRef = useRef<RoutePoint[]>([]);
  const metersRef = useRef(0);
  const runningRef = useRef(false);
  const startingRef = useRef(false);
  const paceSamples = useRef<number[]>([]);
  const smoothedPace = useRef<number | null>(null);

  useEffect(() => {
    setShowWrongDay(wrongDay);
    setIgnoreRequestedWorkout(false);
  }, [workoutId, wrongDay]);

  useEffect(() => () => {
    watch.current?.remove();
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const updateLivePace = (rawSpeed: number) => {
    if (rawSpeed < 0.5 || rawSpeed > 12) {
      setMoving(false);
      setLivePace(null);
      return;
    }
    const rawPace = 1000 / rawSpeed;
    paceSamples.current = [...paceSamples.current.slice(-4), rawPace];
    const sorted = [...paceSamples.current].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    smoothedPace.current = smoothedPace.current === null
      ? median
      : smoothedPace.current * 0.58 + median * 0.42;
    setMoving(true);
    setLivePace(smoothedPace.current);
  };

  const handleLocation = (location: Location.LocationObject) => {
    if (!runningRef.current) return;
    const next: RoutePoint = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitude: location.coords.altitude ?? undefined,
      accuracy: location.coords.accuracy ?? undefined,
      timestamp: location.timestamp,
    };

    const current = pointsRef.current;
    const previous = current[current.length - 1];
    if (!previous || next.timestamp <= previous.timestamp || (next.accuracy ?? 999) > 25) return;

    const delta = distance(previous, next);
    const elapsed = (next.timestamp - previous.timestamp) / 1000;
    const segmentSpeed = elapsed > 0 ? delta / elapsed : 0;
    if (segmentSpeed > 12) return;

    const recent = [...current.filter((point) => point.timestamp >= next.timestamp - PACE_WINDOW_MS), next];
    const recentSeconds = (next.timestamp - recent[0].timestamp) / 1000;
    const windowSpeed = recentSeconds > 0 ? routeDistance(recent) / recentSeconds : 0;
    const deviceSpeed = location.coords.speed ?? 0;
    const validDeviceSpeed = deviceSpeed >= 0.5 && deviceSpeed <= 12 ? deviceSpeed : 0;
    const responsiveSpeed = windowSpeed > 0 && validDeviceSpeed > 0
      ? windowSpeed * 0.7 + validDeviceSpeed * 0.3
      : windowSpeed || validDeviceSpeed || segmentSpeed;
    updateLivePace(responsiveSpeed);

    if (delta < 1.2 || segmentSpeed < 0.35) return;
    const updatedPoints = [...current, next];
    pointsRef.current = updatedPoints;
    metersRef.current += delta;
    setPoints(updatedPoints);
    setMeters(metersRef.current);
  };

  const subscribeToLocation = async () => {
    const subscription = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 2 },
      handleLocation,
    );
    if (runningRef.current) {
      watch.current?.remove();
      watch.current = subscription;
    } else {
      subscription.remove();
    }
  };

  const startTracking = async (linkedWorkout?: Workout) => {
    if (startingRef.current || runningRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setShowStartChoice(false);
    try {
      const result = await Location.requestForegroundPermissionsAsync();
      if (result.status !== 'granted') {
        Alert.alert('Location needed', 'Allow location access to record your route and calculate distance.');
        return;
      }
      const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const first: RoutePoint = {
        latitude: initial.coords.latitude,
        longitude: initial.coords.longitude,
        altitude: initial.coords.altitude ?? undefined,
        accuracy: initial.coords.accuracy ?? undefined,
        timestamp: initial.timestamp,
      };
      pointsRef.current = [first];
      metersRef.current = 0;
      setPoints([first]);
      setMeters(0);
      setSeconds(0);
      setMoving(false);
      setLivePace(null);
      setPaused(false);
      setCompletedActivity(null);
      setLinkedWorkoutId(linkedWorkout?.id);
      paceSamples.current = [];
      smoothedPace.current = null;
      startedAt.current = Date.now();
      runningRef.current = true;
      setRunning(true);
      await subscribeToLocation();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      runningRef.current = false;
      setRunning(false);
      Alert.alert('GPS unavailable', 'No Excuses could not get a reliable location. Check Location Services and try again outdoors.');
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  const pauseTracking = () => {
    if (!runningRef.current) return;
    runningRef.current = false;
    watch.current?.remove();
    watch.current = null;
    setRunning(false);
    setPaused(true);
    setMoving(false);
    setLivePace(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const resumeTracking = async () => {
    if (startingRef.current || runningRef.current || !paused) return;
    startingRef.current = true;
    setStarting(true);
    try {
      runningRef.current = true;
      setRunning(true);
      setPaused(false);
      setMoving(false);
      setLivePace(null);
      paceSamples.current = [];
      smoothedPace.current = null;
      await subscribeToLocation();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      runningRef.current = false;
      setRunning(false);
      setPaused(true);
      Alert.alert('GPS unavailable', 'No Excuses could not resume location tracking. Check Location Services and try again outdoors.');
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  const requestStart = () => {
    if (todayWorkout) {
      setShowStartChoice(true);
      return;
    }
    startTracking(undefined);
  };

  const finish = () => {
    runningRef.current = false;
    watch.current?.remove();
    watch.current = null;
    setRunning(false);
    setPaused(false);
    setMoving(false);
    setLivePace(null);
    const route = [...pointsRef.current];
    const distanceMeters = metersRef.current;
    const elapsedSeconds = Math.max(1, seconds);
    const activity: Activity = {
      id: `${Date.now()}`,
      startedAt: startedAt.current,
      endedAt: Date.now(),
      distanceMeters,
      elapsedSeconds,
      route,
      workoutId: linkedWorkoutId,
    };
    saveActivity(activity);
    if (linkedWorkoutId) completeWorkout(linkedWorkoutId);
    setCompletedActivity(activity);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const reset = () => {
    setCompletedActivity(null);
    setPaused(false);
    pointsRef.current = [];
    metersRef.current = 0;
    setPoints([]);
    setMeters(0);
    setSeconds(0);
    setLinkedWorkoutId(undefined);
  };

  const last = activities[0];
  const displayedActivity = completedActivity;
  const displayedRoute = running ? points : displayedActivity?.route ?? last?.route ?? [];
  const displayedMeters = displayedActivity?.distanceMeters ?? meters;
  const displayedSeconds = displayedActivity?.elapsedSeconds ?? seconds;
  const averagePace = displayedMeters > 0 && displayedSeconds > 0
    ? displayedSeconds / (displayedMeters / 1000)
    : null;
  const region = displayedRoute[0] ? {
    latitude: displayedRoute[0].latitude,
    longitude: displayedRoute[0].longitude,
    latitudeDelta: .01,
    longitudeDelta: .01,
  } : undefined;
  const paceStatus = running && !!linkedWorkoutId && moving && livePace !== null
    ? livePace <= TARGET_PACE_SECONDS_PER_KM
      ? { onTrack: true, label: 'Pace is great!' }
      : { onTrack: false, label: 'Please speed up to keep pace for this run' }
    : null;
  const previewWorkout = ignoreRequestedWorkout ? undefined : requestedWorkout;

  return (
    <Screen>
      <Header
        eyebrow={running ? 'RECORDING · LIVE GPS' : paused ? 'RUN PAUSED' : completedActivity ? 'RUN SAVED' : 'OUTDOOR SESSION'}
        title={completedActivity ? 'Completed run' : 'Run tracking'}
        action={<Pill color={running || completedActivity ? colors.accent : colors.secondary}>{running ? 'GPS LIVE' : paused ? 'PAUSED' : completedActivity ? 'SAVED' : 'GPS READY'}</Pill>}
      />

      {previewWorkout && !completedActivity && (
        <View style={[local.sessionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[local.eyebrow, { color: colors.primary }]}>PLANNED SESSION · {previewWorkout.duration}</Text>
          <Text style={[local.sessionTitle, { color: colors.foreground }]}>{previewWorkout.title}</Text>
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>{previewWorkout.focus}</Text>
        </View>
      )}

      {completedActivity ? (
        <View style={[local.completedCard, { backgroundColor: colors.card }]}>
          <View style={local.completedHeader}>
            <View>
              <Text style={[local.eyebrow, { color: colors.accent }]}>ACTIVITY COMPLETE</Text>
              <Text style={[local.completedTitle, { color: colors.foreground }]}>{linkedWorkoutId ? 'Scheduled session' : 'Unscheduled run'}</Text>
            </View>
            <View style={[local.savedIcon, { backgroundColor: colors.accent }]}><Feather name="check" size={22} color={colors.accentForeground} /></View>
          </View>
          <View style={local.summaryGrid}>
            <View style={local.summaryRow}><Metric label="DISTANCE" value={`${(displayedMeters / 1000).toFixed(2)} km`} /><Metric label="TIME" value={timeLabel(displayedSeconds)} /></View>
            <View style={local.summaryRow}><Metric label="AVG PACE" value={`${paceLabel(averagePace)} /km`} /><Metric label="GPS POINTS" value={String(completedActivity.route.length)} /></View>
          </View>
        </View>
      ) : (
        <View style={[local.trackingCard, { backgroundColor: colors.card }]}>
          <View style={local.primaryMetric}>
            <Text style={[local.metricLabel, { color: colors.mutedForeground }]}>DISTANCE</Text>
            <Text style={[local.distance, { color: colors.foreground }]}>{(meters / 1000).toFixed(2)} <Text style={local.unit}>KM</Text></Text>
          </View>
          <View style={[local.liveMetrics, !linkedWorkoutId && local.liveMetricsSolo, { borderTopColor: colors.border }]}>
            <Metric label="TIME" value={timeLabel(seconds)} />
            {linkedWorkoutId && <Metric label="LIVE PACE / KM" value={running ? paceLabel(livePace) : '—'} />}
          </View>
        </View>
      )}

      {paceStatus && (
        <View style={[local.paceStatus, { backgroundColor: paceStatus.onTrack ? colors.accent : colors.destructive }]}>
          <Feather name={paceStatus.onTrack ? 'check-circle' : 'alert-circle'} size={24} color={paceStatus.onTrack ? colors.accentForeground : colors.destructiveForeground} />
          <Text style={[local.paceStatusText, { color: paceStatus.onTrack ? colors.accentForeground : colors.destructiveForeground }]}>{paceStatus.label}</Text>
        </View>
      )}

      {region ? (
        <NativeRouteMap route={displayedRoute} region={region} strokeColor={colors.primary} startColor={colors.accent} endColor={colors.primary} />
      ) : (
        <View style={[local.emptyMap, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="map" size={24} color={colors.mutedForeground} />
          <Text style={[local.mapLabel, { color: colors.mutedForeground }]}>{Platform.OS === 'web' ? 'Live route map appears on Android' : 'Your live route will appear here'}</Text>
        </View>
      )}

      {!completedActivity && (
        <>
          <SectionTitle>{running ? 'Live tracking' : paused ? 'Run paused' : last?.route.length ? 'Most recent route preview' : 'Ready when you are'}</SectionTitle>
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>
            {running
              ? 'Pace uses the most recent GPS window, filters inaccurate points, and smooths short spikes without averaging the entire run.'
              : paused
                ? 'Run paused. Resume when you are ready, or save the route below.'
              : 'Start at any time. If today has a planned outdoor session, you can link the run to it or keep the activity unscheduled.'}
          </Text>
        </>
      )}

      <View style={local.controls}>
        {running ? (
          <>
            <Button label="Pause run" icon="pause" secondary onPress={pauseTracking} />
            <Button label="Finish and save route" icon="square" onPress={finish} />
          </>
        ) : paused ? (
          <>
            <Button label={starting ? 'Resuming GPS…' : 'Resume run'} icon="play" disabled={starting} onPress={resumeTracking} />
            <Button label="Finish and save route" icon="square" secondary onPress={finish} />
          </>
        ) : completedActivity ? (
          <>
            <Button label="View this run in history" icon="list" onPress={() => router.push(`/runs/${completedActivity.id}?map=1`)} />
            <Button label="Start another run" icon="navigation" secondary onPress={reset} />
          </>
        ) : (
          <>
            <Button label={starting ? 'Getting GPS ready…' : 'Start outdoor session'} icon="navigation" disabled={starting} onPress={requestStart} />
            {activities.length > 0 && <Button label="View past runs" icon="list" secondary onPress={() => router.push('/runs')} />}
          </>
        )}
      </View>

      <BrandedModal
        visible={showWrongDay}
        title={`Please wait until ${WEEKDAYS[workoutWeekdayIndex(requestedWorkout?.day ?? 1)]}`}
        message="This planned session can only be completed on its scheduled day. You can still record an unscheduled run now."
        onRequestClose={() => { setShowWrongDay(false); setIgnoreRequestedWorkout(true); }}
        primaryLabel="Okay"
        onPrimaryPress={() => { setShowWrongDay(false); setIgnoreRequestedWorkout(true); }}
      />

      <Modal transparent animationType="fade" visible={showStartChoice} onRequestClose={() => setShowStartChoice(false)}>
        <View style={local.modalBackdrop}>
          <View style={[local.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[local.eyebrow, { color: colors.primary }]}>TODAY'S PLAN</Text>
            <Text style={[local.modalTitle, { color: colors.foreground }]}>Start today’s scheduled run?</Text>
            {todayWorkout && <View style={[local.choiceDetails, { backgroundColor: colors.secondary }]}><Text style={[local.choiceTitle, { color: colors.foreground }]}>{todayWorkout.title}</Text><Text style={[styles.muted, { color: colors.mutedForeground }]}>{todayWorkout.duration}</Text><Text style={[styles.muted, { color: colors.mutedForeground }]}>{todayWorkout.focus}</Text></View>}
            <Button label="Start scheduled run" icon="calendar" onPress={() => startTracking(todayWorkout)} />
            <Button label="Record as unscheduled" icon="navigation" secondary onPress={() => startTracking(undefined)} />
            <Pressable accessibilityRole="button" onPress={() => setShowStartChoice(false)} style={local.cancel}><Text style={[local.cancelText, { color: colors.mutedForeground }]}>Cancel</Text></Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return <View style={local.metric}><Text style={[local.metricLabel, { color: colors.mutedForeground }]}>{label}</Text><Text style={[local.metricValue, { color: colors.foreground }]}>{value}</Text></View>;
}

const local = StyleSheet.create({
  sessionCard: { borderRadius: 20, borderWidth: 1, padding: 17, marginBottom: 14 },
  eyebrow: { fontFamily: 'Inter_700Bold', letterSpacing: 1, fontSize: 10 },
  sessionTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, marginVertical: 8 },
  trackingCard: { borderRadius: 24, padding: 20, marginBottom: 14 },
  primaryMetric: { alignItems: 'center', paddingVertical: 8 },
  distance: { fontFamily: 'Inter_700Bold', fontSize: 54, letterSpacing: -2, marginTop: 5 },
  unit: { fontSize: 17, letterSpacing: 0 },
  liveMetrics: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 18, marginTop: 8 },
  liveMetricsSolo: { justifyContent: 'flex-start' },
  metric: { flex: 1 },
  metricLabel: { fontFamily: 'Inter_700Bold', letterSpacing: 1, fontSize: 10 },
  metricValue: { fontFamily: 'Inter_700Bold', fontSize: 20, marginTop: 5 },
  completedCard: { borderRadius: 24, padding: 20, marginBottom: 14 },
  completedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  completedTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, marginTop: 6 },
  savedIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  summaryGrid: { gap: 22 },
  summaryRow: { flexDirection: 'row', gap: 16 },
  paceStatus: { minHeight: 92, borderRadius: 20, padding: 18, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 13 },
  paceStatusText: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 18, lineHeight: 24 },
  emptyMap: { height: 190, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 18 },
  mapLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: .5 },
  controls: { paddingTop: 18, gap: 10, paddingBottom: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.72)', justifyContent: 'center', padding: 24 },
  modalCard: { borderRadius: 24, borderWidth: 1, padding: 22, gap: 14 },
  modalIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 23, lineHeight: 29 },
  choiceDetails: { borderRadius: 16, padding: 15, gap: 5 },
  choiceTitle: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  cancel: { minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
});