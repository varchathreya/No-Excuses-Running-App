import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { Screen, Header, Button, SectionTitle, styles } from '@/components/Screen';
import { useColors } from '@/hooks/useColors';
import { useLocalSearchParams } from 'expo-router';
import { currentPlanWeek, isWorkoutAvailableToday, scheduledWorkoutForToday, type RehabLog, type Workout, useApp, workoutDateLabel, workoutWeekdayName } from '@/context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

type IsometricExercise = {
  mode: 'isometric';
  key: string;
  title: string;
  detail: string;
  cue: string;
  videoUrl: string;
  holdSeconds: number;
  sets: number;
};

type RepExercise = {
  mode: 'reps';
  key: string;
  title: string;
  detail: string;
  cue: string;
  videoUrl: string;
  reps: number;
  sets: number;
};

type RehabExercise = IsometricExercise | RepExercise;
type RepSetState = { completed: boolean; reps: string; weight: string };

const TIMER_SIZE = 150;
const TIMER_STROKE = 5;
const TIMER_RADIUS = (TIMER_SIZE - TIMER_STROKE) / 2;
const TIMER_CIRCUMFERENCE = 2 * Math.PI * TIMER_RADIUS;
const REST_SECONDS = 120;

const REHAB_VIDEO_URLS: Record<string, string> = {
  'wall-sit-hold': 'https://www.youtube.com/watch?v=Dc5QglPQp-0',
  'single-leg-bridge-hold': 'https://www.youtube.com/watch?v=EuzLAQj1gWQ',
  'lunge-hold': 'https://www.youtube.com/watch?v=G5fqHk7zF3M',
  'isometric-calf-hold': 'https://www.youtube.com/watch?v=arLsa_isSOw',
  'goblet-squats': 'https://www.youtube.com/watch?v=nfX7IFK9UNI',
  'romanian-deadlifts': 'https://www.youtube.com/watch?v=yjqRj72AuaE',
  'single-leg-deadlifts': 'https://www.youtube.com/watch?v=Zfr6wizR8rs',
  'step-ups': 'https://www.youtube.com/watch?v=mmeSrU2nu8Q',
};

function routineForWorkout(workout?: Workout): RehabExercise[] {
  if (workout?.kind === 'isometric') {
    const addedHoldTime = workout.week >= 2 ? 5 : 0;
    const bandNote = workout.rehabRoutine === 2 ? ' Use light band resistance if pain-free.' : '';
    return [
      { mode: 'isometric', key: 'wall-sit-hold', title: 'Wall Sit Holds', detail: `3 × ${30 + addedHoldTime} sec`, cue: 'Keep the knees tracking over the second toe and hold a quiet, steady position.', videoUrl: REHAB_VIDEO_URLS['wall-sit-hold'], holdSeconds: 30 + addedHoldTime, sets: 3 },
      { mode: 'isometric', key: 'single-leg-bridge-hold', title: 'Single-Leg Bridge Holds', detail: `3 × ${30 + addedHoldTime} sec`, cue: 'Keep the pelvis level and squeeze the glute without arching the low back.', videoUrl: REHAB_VIDEO_URLS['single-leg-bridge-hold'], holdSeconds: 30 + addedHoldTime, sets: 3 },
      { mode: 'isometric', key: 'lunge-hold', title: 'Lunge Holds', detail: `3 × ${20 + addedHoldTime} sec`, cue: 'Use a stable stance and keep the front knee aligned with the foot.', videoUrl: REHAB_VIDEO_URLS['lunge-hold'], holdSeconds: 20 + addedHoldTime, sets: 3 },
      { mode: 'isometric', key: 'isometric-calf-hold', title: 'Isometric Calf Holds', detail: '4 × 30 sec', cue: `Rise into a controlled calf hold with a neutral ankle.${bandNote}`, videoUrl: REHAB_VIDEO_URLS['isometric-calf-hold'], holdSeconds: 30, sets: 4 },
    ];
  }
  if (workout?.kind === 'hsr') {
    return [
      { mode: 'reps', key: 'goblet-squats', title: 'Goblet Squats', detail: '3 × 10 reps', cue: 'Use a controlled tempo and keep the knee tracking over the second toe.', videoUrl: REHAB_VIDEO_URLS['goblet-squats'], reps: 10, sets: 3 },
      { mode: 'reps', key: 'romanian-deadlifts', title: 'Romanian Deadlifts', detail: '3 × 10 reps', cue: 'Hinge from the hips, keep the spine long, and move slowly through the range.', videoUrl: REHAB_VIDEO_URLS['romanian-deadlifts'], reps: 10, sets: 3 },
      { mode: 'reps', key: 'single-leg-deadlifts', title: 'Single-Leg Deadlifts', detail: '3 × 10 reps', cue: 'Use bodyweight or a light dumbbell and prioritize balance over load.', videoUrl: REHAB_VIDEO_URLS['single-leg-deadlifts'], reps: 10, sets: 3 },
      { mode: 'reps', key: 'step-ups', title: 'Step-Ups', detail: '3 × 10 reps', cue: 'Drive through the whole foot and control the step down.', videoUrl: REHAB_VIDEO_URLS['step-ups'], reps: 10, sets: 3 },
    ];
  }
  return [];
}

function SegmentedProgress({ completed, total, color, borderColor }: { completed: number; total: number; color: string; borderColor: string }) {
  return (
    <View style={local.segmentRow}>
      {Array.from({ length: total }, (_, index) => (
        <View key={index} style={[local.segment, { borderColor }]}>
          <View style={[local.segmentFill, { backgroundColor: index < completed ? color : 'transparent' }]} />
        </View>
      ))}
    </View>
  );
}

function formatRest(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function YouTubeMark({ url, exerciseTitle, disabled = false }: { url: string; exerciseTitle: string; disabled?: boolean }) {
  const openVideo = () => {
    void Linking.openURL(url).catch(() => undefined);
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Watch ${exerciseTitle} instruction on YouTube`}
      disabled={disabled}
      onPress={openVideo}
      hitSlop={6}
      style={({ pressed }) => [local.youtubeButton, { opacity: disabled ? 0.4 : pressed ? 0.68 : 1 }]}
    >
      <View style={local.youtubeMark}>
        <View style={local.youtubeTriangle} />
      </View>
    </Pressable>
  );
}

export default function Rehab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { workoutId } = useLocalSearchParams<{ workoutId?: string }>();
  const { workouts, startDate, completeWorkout, rehabLogs, saveRehabLog } = useApp();
  const scrollRef = useRef<ScrollView>(null);
  const activeWeek = currentPlanWeek(workouts, startDate) ?? 1;
  const todayWorkout = scheduledWorkoutForToday(workouts, startDate);
  const workout = workouts.find((item) => item.id === workoutId) ?? todayWorkout;
  const requestedRestDay = !!workoutId && workout?.kind === 'rest';
  const routine = useMemo(
    () => routineForWorkout(workout),
    [workout?.id, workout?.kind, workout?.week, workout?.rehabRoutine],
  );
  const unavailable = !!workout && !isWorkoutAvailableToday(workout.day, workout.week, activeWeek, startDate);
  const isometricRoutine = routine.filter((item): item is IsometricExercise => item.mode === 'isometric');
  const repRoutine = routine.filter((item): item is RepExercise => item.mode === 'reps');
  const [active, setActive] = useState(0);
  const [isoSeconds, setIsoSeconds] = useState(0);
  const [isoStarted, setIsoStarted] = useState(false);
  const [isoSets, setIsoSets] = useState<Record<string, boolean[]>>({});
  const [repSets, setRepSets] = useState<Record<string, RepSetState[]>>({});
  const [restSeconds, setRestSeconds] = useState(0);
  const [restActive, setRestActive] = useState(false);
  const [loggedExercises, setLoggedExercises] = useState<string[]>([]);
  const [historyExercise, setHistoryExercise] = useState<RepExercise | null>(null);
  const [timerY, setTimerY] = useState(0);

  useEffect(() => {
    setActive(0);
    setIsoSeconds(0);
    setIsoStarted(false);
    setRestSeconds(0);
    setRestActive(false);
    setLoggedExercises([]);
    setHistoryExercise(null);
    setIsoSets(Object.fromEntries(isometricRoutine.map((item) => [item.key, Array(item.sets).fill(false)])));
    setRepSets(Object.fromEntries(repRoutine.map((item) => [item.key, Array.from({ length: item.sets }, () => ({ completed: false, reps: String(item.reps), weight: '' }))])));
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [workout?.id, workout?.kind, workout?.week, workout?.rehabRoutine]);

  useEffect(() => {
    if (!isoStarted || isoSeconds <= 0) return;
    const timer = setInterval(() => setIsoSeconds((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, [isoStarted, isoSeconds]);

  const currentExercise = routine[active];
  const currentIso = currentExercise?.mode === 'isometric' ? currentExercise : undefined;
  const currentRep = currentExercise?.mode === 'reps' ? currentExercise : undefined;
  const currentIsoSets = currentIso ? (isoSets[currentIso.key] ?? Array(currentIso.sets).fill(false)) : [];
  const currentRepSets = currentRep ? (repSets[currentRep.key] ?? []) : [];
  const completedExercises = routine.filter((item) => {
    if (item.mode === 'isometric') return (isoSets[item.key] ?? []).every(Boolean);
    return (repSets[item.key] ?? []).every((set) => set.completed);
  }).length;
  const allComplete = routine.length > 0 && completedExercises === routine.length;
  const timerProgress = currentIso && currentIso.holdSeconds > 0
    ? Math.max(0, Math.min(1, isoSeconds / currentIso.holdSeconds))
    : 0;
  const timerOffset = TIMER_CIRCUMFERENCE * (1 - timerProgress);

  useEffect(() => {
    if (!isoStarted || isoSeconds !== 0 || !currentIso) return;
    setIsoStarted(false);
    setIsoSets((previous) => {
      const next = [...(previous[currentIso.key] ?? Array(currentIso.sets).fill(false))];
      const nextSet = next.findIndex((complete) => !complete);
      if (nextSet >= 0) next[nextSet] = true;
      return { ...previous, [currentIso.key]: next };
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [isoSeconds, isoStarted, currentIso]);

  useEffect(() => {
    if (!restActive || restSeconds <= 0) return;
    const timer = setInterval(() => setRestSeconds((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, [restActive, restSeconds]);

  useEffect(() => {
    if (!restActive || restSeconds !== 0) return;
    setRestActive(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [restActive, restSeconds]);

  const selectExercise = (index: number) => {
    if (unavailable) return;
    setActive(index);
    setIsoStarted(false);
    setIsoSeconds(0);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: timerY, animated: true }));
  };

  const startIsoTimer = () => {
    if (!currentIso || unavailable || currentIsoSets.every(Boolean)) return;
    setIsoSeconds(currentIso.holdSeconds);
    setIsoStarted(true);
  };

  const updateRepSet = (exerciseKey: string, setIndex: number, field: 'reps' | 'weight', value: string) => {
    setRepSets((previous) => ({
      ...previous,
      [exerciseKey]: (previous[exerciseKey] ?? []).map((set, index) => index === setIndex ? { ...set, [field]: value } : set),
    }));
  };

  const completeRepSet = (exercise: RepExercise, setIndex: number) => {
    if (unavailable) return;
    const previous = repSets[exercise.key] ?? [];
    if (previous[setIndex]?.completed) return;
    const next = previous.map((set, index) => index === setIndex ? { ...set, completed: true } : set);
    setRepSets((current) => ({ ...current, [exercise.key]: next }));
    if (setIndex < exercise.sets - 1) {
      setRestSeconds(REST_SECONDS);
      setRestActive(true);
    }
    if (next.every((set) => set.completed) && !loggedExercises.includes(exercise.key)) {
      const log: RehabLog = {
        id: `${workout?.id ?? 'rehab'}-${exercise.key}-${Date.now()}`,
        workoutId: workout?.id ?? 'rehab',
        exerciseKey: exercise.key,
        exerciseTitle: exercise.title,
        sets: next.map((set, index) => ({ set: index + 1, reps: Number(set.reps) || exercise.reps, weight: set.weight.trim() })),
        completedAt: Date.now(),
      };
      saveRehabLog(log);
      setLoggedExercises((current) => [...current, exercise.key]);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const history = historyExercise
    ? rehabLogs.filter((log) => log.exerciseKey === historyExercise.key).slice(0, 10)
    : [];

  if (requestedRestDay) {
    return (
      <Screen>
        <View style={[local.restContent, { paddingBottom: insets.bottom + 24 }]}>
          <Header eyebrow="RECOVERY DAY" title="Full rest" />
          {workout && (
            <View style={[local.preview, { backgroundColor: colors.card }]}>
              <Text style={[local.previewLabel, { color: colors.primary }]}>WEEK {workout.week} · DAY {workout.day}</Text>
              <Text style={[local.previewTitle, { color: colors.foreground }]}>{workout.title}</Text>
              <Text style={[styles.muted, { color: colors.mutedForeground }]}>{workout.focus}</Text>
            </View>
          )}
          <View style={[local.restCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[local.restIcon, { backgroundColor: colors.secondary }]}>
              <Text style={{ color: colors.primary, fontSize: 24 }}>✓</Text>
            </View>
            <Text style={[local.playerTitle, { color: colors.foreground }]}>Let the load settle.</Text>
            <Text style={[styles.muted, { color: colors.mutedForeground }]}>
              Rest is part of the eight-week progression. Check for pain, swelling, warmth, or redness before increasing load.
            </Text>
          </View>
          <Button
            label="Complete rest day"
            icon="check-circle"
            disabled={unavailable}
            onPress={() => {
              if (workout?.id) completeWorkout(workout.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }}
          />
        </View>
      </Screen>
    );
  }

  if (!workout || routine.length === 0) {
    return (
      <Screen>
        <Header eyebrow="REHAB" title="Nothing scheduled" />
        <View style={[local.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="calendar" size={30} color={colors.primary} />
          <Text style={[local.emptyTitle, { color: colors.foreground }]}>Nothing scheduled for today!</Text>
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>
            Rehab exercises appear here on your isometric and HSR days. Gait sessions belong in Run, and complete rest days stay recovery-only.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <ScrollView
        ref={scrollRef}
        style={local.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[local.content, { paddingBottom: insets.bottom + 24 }]}
      >
        <Header eyebrow={workout.kind === 'hsr' ? 'HEAVY SLOW RESISTANCE' : 'ISOMETRIC FOUNDATION'} title="Rehab player" />
        <View style={[local.preview, { backgroundColor: colors.card }]}>
          <Text style={[local.previewLabel, { color: colors.primary }]}>SESSION PREVIEW · {workout.duration}</Text>
          <Text style={[local.previewTitle, { color: colors.foreground }]}>{workout.title}</Text>
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>{workout.focus}</Text>
          {unavailable && (
            <Text style={[styles.muted, { color: colors.mutedForeground, marginTop: 10 }]}>
              Scheduled for {workoutDateLabel(workout.day, startDate) ?? workoutWeekdayName(workout.day, startDate)}. You can review the routine now; controls unlock on its assigned date.
            </Text>
          )}
        </View>
        <View style={[local.progress, { backgroundColor: unavailable ? colors.secondary : colors.card }]}>
          <View style={[local.track, { backgroundColor: colors.border }]}>
            <View style={[local.progressFill, { backgroundColor: colors.accent, width: `${(completedExercises / routine.length) * 100}%` }]} />
          </View>
          <Text style={[styles.muted, { color: colors.mutedForeground, marginTop: 10 }]}>
            {completedExercises} of {routine.length} exercises complete
          </Text>
        </View>
        <SectionTitle>Today's routine</SectionTitle>
        {routine.map((item, index) => {
          const complete = item.mode === 'isometric'
            ? (isoSets[item.key] ?? []).every(Boolean)
            : (repSets[item.key] ?? []).every((set) => set.completed);
          const completedSets = item.mode === 'isometric'
            ? (isoSets[item.key] ?? []).filter(Boolean).length
            : (repSets[item.key] ?? []).filter((set) => set.completed).length;
          const selected = active === index;
          return (
            <View key={item.key} style={[local.exercise, { backgroundColor: unavailable ? colors.secondary : selected ? colors.secondary : colors.card, opacity: unavailable ? 0.48 : 1 }]}>
              <Pressable disabled={unavailable} onPress={() => selectExercise(index)} style={local.exerciseMain}>
                <View style={[local.check, { borderColor: complete ? colors.accent : colors.border, backgroundColor: complete ? colors.accent : 'transparent' }]}>
                  {complete && <Feather name="check" size={15} color={colors.background} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[local.exerciseTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[styles.muted, { color: colors.mutedForeground }]}>{item.detail} · {completedSets} sets done</Text>
                </View>
              </Pressable>
              <View style={local.exerciseActions}>
                <YouTubeMark url={item.videoUrl} exerciseTitle={item.title} disabled={unavailable} />
                {item.mode === 'reps' && (
                  <Pressable accessibilityLabel={`View history for ${item.title}`} onPress={() => setHistoryExercise(item)} style={[local.iconButton, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    <Feather name="bar-chart-2" size={16} color={colors.primary} />
                  </Pressable>
                )}
                <Pressable
                  testID={`Start ${item.title}`}
                  disabled={unavailable || complete}
                  onPress={() => selectExercise(index)}
                  style={({ pressed }) => [local.startButton, { backgroundColor: complete ? colors.secondary : colors.primary, borderColor: complete ? colors.border : colors.primaryForeground, opacity: unavailable || complete ? 0.45 : pressed ? 0.75 : 1 }]}
                >
                  <Text style={[local.startButtonText, { color: complete ? colors.mutedForeground : colors.primaryForeground }]}>{complete ? 'DONE' : 'START'}</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
        <View
          onLayout={(event) => setTimerY(event.nativeEvent.layout.y)}
          style={[local.player, { backgroundColor: unavailable ? colors.secondary : colors.card, opacity: unavailable ? 0.48 : 1 }]}
        >
          {currentIso && (
            <>
               <Text style={[local.playerEyebrow, { color: colors.primary }]}>EXERCISE {active + 1} · ISOMETRIC HOLD</Text>
               <View style={local.playerTitleRow}>
                 <Text style={[local.playerTitle, { color: colors.foreground }]}>{currentIso.title}</Text>
                 <YouTubeMark url={currentIso.videoUrl} exerciseTitle={currentIso.title} disabled={unavailable} />
               </View>
              <Text style={[styles.muted, { color: colors.mutedForeground }]}>{currentIso.cue}</Text>
              <SegmentedProgress completed={currentIsoSets.filter(Boolean).length} total={currentIso.sets} color={colors.accent} borderColor={colors.border} />
              <View style={local.timer}>
                <Svg width={TIMER_SIZE} height={TIMER_SIZE} viewBox={`0 0 ${TIMER_SIZE} ${TIMER_SIZE}`} style={local.timerRing}>
                  <Circle cx={TIMER_SIZE / 2} cy={TIMER_SIZE / 2} r={TIMER_RADIUS} stroke={colors.border} strokeWidth={TIMER_STROKE} fill="none" />
                  <Circle
                    cx={TIMER_SIZE / 2}
                    cy={TIMER_SIZE / 2}
                    r={TIMER_RADIUS}
                    stroke={isoSeconds < currentIso.holdSeconds ? colors.destructive : colors.border}
                    strokeWidth={TIMER_STROKE}
                    strokeLinecap="round"
                    strokeDasharray={`${TIMER_CIRCUMFERENCE} ${TIMER_CIRCUMFERENCE}`}
                    strokeDashoffset={timerOffset}
                    fill="none"
                    transform={`rotate(-90 ${TIMER_SIZE / 2} ${TIMER_SIZE / 2})`}
                  />
                </Svg>
                <View style={local.timerContent}>
                  <Text style={[local.timerText, { color: colors.foreground }]}>00:{isoSeconds.toString().padStart(2, '0')}</Text>
                  <Text style={[styles.muted, { color: colors.mutedForeground }]}>SET {Math.min(currentIsoSets.filter(Boolean).length + 1, currentIso.sets)} OF {currentIso.sets}</Text>
                </View>
              </View>
              <Button
                label={isoStarted ? 'Pause timer' : `Start ${currentIso.holdSeconds} sec timer`}
                icon={isoStarted ? 'pause' : 'play'}
                secondary={isoStarted}
                disabled={unavailable || currentIsoSets.every(Boolean)}
                onPress={() => {
                  if (isoStarted) setIsoStarted(false);
                  else startIsoTimer();
                }}
              />
            </>
          )}
          {currentRep && (
            <>
              <View style={local.repHeader}>
                <View style={{ flex: 1 }}>
                   <Text style={[local.playerEyebrow, { color: colors.primary }]}>EXERCISE {active + 1} · SETS + REPS</Text>
                   <View style={local.playerTitleRow}>
                     <Text style={[local.playerTitle, { color: colors.foreground }]}>{currentRep.title}</Text>
                     <YouTubeMark url={currentRep.videoUrl} exerciseTitle={currentRep.title} disabled={unavailable} />
                   </View>
                </View>
                <Pressable accessibilityLabel={`View history for ${currentRep.title}`} onPress={() => setHistoryExercise(currentRep)} style={[local.historyButton, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Feather name="bar-chart-2" size={18} color={colors.primary} />
                </Pressable>
              </View>
              <Text style={[styles.muted, { color: colors.mutedForeground }]}>{currentRep.cue}</Text>
              <View style={[local.tableHeader, { borderBottomColor: colors.border }]}>
                <Text style={[local.tableHeaderText, { color: colors.mutedForeground, flex: 0.7 }]}>SET</Text>
                <Text style={[local.tableHeaderText, { color: colors.mutedForeground, flex: 1.2 }]}>WEIGHT</Text>
                <Text style={[local.tableHeaderText, { color: colors.mutedForeground, flex: 1 }]}>REPS</Text>
                <Text style={[local.tableHeaderText, { color: colors.mutedForeground, width: 36 }]} />
              </View>
              {currentRepSets.map((set, index) => (
                <View key={index} style={[local.repRow, { backgroundColor: set.completed ? colors.secondary : 'transparent', borderBottomColor: colors.border }]}>
                  <Text style={[local.setNumber, { color: colors.foreground }]}>SET {index + 1}</Text>
                  <TextInput
                    accessibilityLabel={`Weight for set ${index + 1}`}
                    value={set.weight}
                    placeholder="—"
                    placeholderTextColor={colors.mutedForeground}
                    onChangeText={(value) => updateRepSet(currentRep.key, index, 'weight', value)}
                    keyboardType="decimal-pad"
                    style={[local.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                  />
                  <TextInput
                    accessibilityLabel={`Reps for set ${index + 1}`}
                    value={set.reps}
                    onChangeText={(value) => updateRepSet(currentRep.key, index, 'reps', value.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    style={[local.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                  />
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel={`Mark set ${index + 1} complete`}
                    accessibilityState={{ checked: set.completed }}
                    disabled={unavailable || set.completed}
                    onPress={() => completeRepSet(currentRep, index)}
                    style={[local.setCheck, { borderColor: set.completed ? colors.accent : colors.border, backgroundColor: set.completed ? colors.accent : 'transparent', opacity: unavailable ? 0.45 : 1 }]}
                  >
                    <Feather name="check" size={16} color={set.completed ? colors.background : colors.mutedForeground} />
                  </Pressable>
                </View>
              ))}
              {restActive && (
                <View style={[local.restTimer, { backgroundColor: colors.secondary }]}>
                  <View style={local.restTimerTop}>
                    <Text style={[local.restTimerText, { color: colors.foreground }]}>Rest · {formatRest(restSeconds)}</Text>
                    <Pressable onPress={() => { setRestActive(false); setRestSeconds(0); }} style={[local.skipButton, { borderColor: colors.border, backgroundColor: colors.card }]}>
                      <Text style={[local.skipText, { color: colors.foreground }]}>Skip</Text>
                    </Pressable>
                  </View>
                  <View style={[local.restTrack, { backgroundColor: colors.border }]}>
                    <View style={[local.restFill, { backgroundColor: colors.primary, width: `${((REST_SECONDS - restSeconds) / REST_SECONDS) * 100}%` }]} />
                  </View>
                </View>
              )}
            </>
          )}
        </View>
        <Button
          label={allComplete ? 'Complete workout' : 'Complete all exercises first'}
          icon="check-circle"
          disabled={unavailable || !allComplete}
          onPress={() => {
            if (workout.id) completeWorkout(workout.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
        />
      </ScrollView>
      <Modal visible={!!historyExercise} transparent animationType="slide" onRequestClose={() => setHistoryExercise(null)}>
        <View style={local.modalOverlay}>
          <View style={[local.historyCard, { backgroundColor: colors.card }]}>
            <View style={local.historyHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[local.previewLabel, { color: colors.primary }]}>EXERCISE HISTORY</Text>
                <Text style={[local.historyTitle, { color: colors.foreground }]}>{historyExercise?.title}</Text>
              </View>
              <Pressable accessibilityLabel="Close history" onPress={() => setHistoryExercise(null)} style={[local.closeButton, { backgroundColor: colors.secondary }]}>
                <Feather name="x" size={18} color={colors.foreground} />
              </Pressable>
            </View>
            {history.length === 0 ? (
              <Text style={[styles.muted, { color: colors.mutedForeground }]}>Your past iterations of this exercise will show here!</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={[local.historyTableHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[local.tableHeaderText, { color: colors.mutedForeground, flex: 1 }]}>DATE</Text>
                  <Text style={[local.tableHeaderText, { color: colors.mutedForeground, flex: 0.7 }]}>SETS</Text>
                  <Text style={[local.tableHeaderText, { color: colors.mutedForeground, flex: 1 }]}>REPS</Text>
                  <Text style={[local.tableHeaderText, { color: colors.mutedForeground, flex: 1 }]}>WEIGHT</Text>
                </View>
                {history.map((log) => (
                  <View key={log.id} style={[local.historyRow, { borderBottomColor: colors.border }]}>
                    <Text style={[local.historyCell, { color: colors.foreground, flex: 1 }]}>{new Date(log.completedAt).toLocaleDateString()}</Text>
                    <Text style={[local.historyCell, { color: colors.foreground, flex: 0.7 }]}>{log.sets.length}</Text>
                    <Text style={[local.historyCell, { color: colors.foreground, flex: 1 }]}>{log.sets.map((set) => set.reps).join(' / ')}</Text>
                    <Text style={[local.historyCell, { color: colors.foreground, flex: 1 }]}>{log.sets.map((set) => set.weight || '—').join(' / ')}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const local = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1 },
  restContent: {},
  restCard: { borderRadius: 22, borderWidth: 1, padding: 22, marginBottom: 18, gap: 12 },
  restIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { borderRadius: 22, borderWidth: 1, padding: 22, gap: 12 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, lineHeight: 28 },
  preview: { borderRadius: 20, padding: 17, marginBottom: 12 },
  previewLabel: { fontFamily: 'Inter_700Bold', letterSpacing: 1, fontSize: 10 },
  previewTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, marginVertical: 8 },
  progress: { borderRadius: 18, padding: 16, marginBottom: 20 },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5 },
  exercise: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 17, padding: 12, marginBottom: 8 },
  exerciseMain: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  exerciseActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  youtubeButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  youtubeMark: { width: 30, height: 21, borderRadius: 6, backgroundColor: '#FF0000', alignItems: 'center', justifyContent: 'center' },
  youtubeTriangle: { marginLeft: 2, width: 0, height: 0, borderTopWidth: 5.5, borderBottomWidth: 5.5, borderLeftWidth: 9, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#FFFFFF' },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  exerciseTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, marginBottom: 3 },
  startButton: { minWidth: 64, minHeight: 38, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  startButtonText: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.8 },
  iconButton: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  player: { borderRadius: 22, padding: 19, marginTop: 18, marginBottom: 16 },
  playerEyebrow: { fontFamily: 'Inter_700Bold', letterSpacing: 1.3, fontSize: 10 },
  playerTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, marginVertical: 10 },
  playerTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  segmentRow: { flexDirection: 'row', gap: 6, marginTop: 18 },
  segment: { flex: 1, height: 10, borderWidth: 1, borderStyle: 'solid', borderRadius: 4, padding: 2 },
  segmentFill: { flex: 1, borderRadius: 2 },
  timer: { width: TIMER_SIZE, height: TIMER_SIZE, alignSelf: 'center', marginVertical: 20, alignItems: 'center', justifyContent: 'center' },
  timerRing: { position: 'absolute' },
  timerContent: { alignItems: 'center', justifyContent: 'center' },
  timerText: { fontFamily: 'Inter_700Bold', fontSize: 34, letterSpacing: -1 },
  repHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  historyButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tableHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderBottomWidth: 1, marginTop: 16 },
  tableHeaderText: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.8 },
  repRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 62, borderBottomWidth: 1 },
  setNumber: { flex: 0.7, fontFamily: 'Inter_700Bold', fontSize: 11 },
  input: { flex: 1.2, minHeight: 40, borderWidth: 1, borderRadius: 9, paddingHorizontal: 8, textAlign: 'center', fontFamily: 'Inter_500Medium', fontSize: 14 },
  setCheck: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  restTimer: { borderRadius: 14, padding: 12, marginTop: 14, gap: 10 },
  restTimerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  restTimerText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  skipButton: { minWidth: 58, minHeight: 32, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  skipText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  restTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  restFill: { height: '100%', borderRadius: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.58)', justifyContent: 'flex-end' },
  historyCard: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, minHeight: 280, maxHeight: '76%', gap: 16 },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  historyTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, marginTop: 6 },
  closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  historyTableHeader: { flexDirection: 'row', gap: 8, paddingVertical: 10, borderBottomWidth: 1 },
  historyRow: { flexDirection: 'row', gap: 8, paddingVertical: 12, borderBottomWidth: 1 },
  historyCell: { fontFamily: 'Inter_500Medium', fontSize: 11 },
});