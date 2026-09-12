import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Screen, Header, Button, SectionTitle, styles } from '@/components/Screen';
import { useColors } from '@/hooks/useColors';
import { useLocalSearchParams } from 'expo-router';
import { isWorkoutAvailableToday, useApp, WEEKDAYS, workoutWeekdayIndex } from '@/context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandedModal } from '@/components/BrandedModal';
import Svg, { Circle } from 'react-native-svg';

const exercises = [
  { title: 'Soleus Wall Sit Hold', detail: '3 × 45 sec', duration: 45 },
  { title: 'Single-Leg Isometric Calf Hold', detail: '3 × 45 sec', duration: 45 },
  { title: 'Spanish Squat Isometric Hold', detail: '3 × 30 sec', duration: 30 },
];

const TIMER_SIZE = 150;
const TIMER_STROKE = 5;
const TIMER_RADIUS = (TIMER_SIZE - TIMER_STROKE) / 2;
const TIMER_CIRCUMFERENCE = 2 * Math.PI * TIMER_RADIUS;

export default function Rehab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { workoutId } = useLocalSearchParams<{ workoutId?: string }>();
  const { workouts, completeWorkout } = useApp();
  const scrollRef = useRef<ScrollView>(null);
  const [active, setActive] = useState(0);
  const [seconds, setSeconds] = useState(exercises[0].duration);
  const [started, setStarted] = useState(false);
  const [sets, setSets] = useState<number[]>([0, 0, 0]);
  const [timerY, setTimerY] = useState(0);
  const [showUnavailable, setShowUnavailable] = useState(true);
  const workout = workouts.find((item) => item.id === workoutId);
  const unavailable = !!workout && !isWorkoutAvailableToday(workout.day);
  const completedExercises = sets.filter((count) => count >= 3).length;
  const allComplete = completedExercises === exercises.length;
  const current = exercises[active];
  const timerProgress = current.duration > 0 ? Math.max(0, Math.min(1, seconds / current.duration)) : 0;
  const timerOffset = TIMER_CIRCUMFERENCE * (1 - timerProgress);

  useEffect(() => {
    setActive(0);
    setSeconds(exercises[0].duration);
    setStarted(false);
    setSets([0, 0, 0]);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [workoutId]);

  useEffect(() => {
    if (!started || seconds === 0) return;
    const timer = setInterval(() => setSeconds((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, [started, seconds]);

  useEffect(() => {
    if (!started || seconds !== 0) return;
    setStarted(false);
    setSets((values) => {
      const next = [...values];
      next[active] = Math.min(3, next[active] + 1);
      return next;
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [seconds, started, active]);

  const selectExercise = (index: number) => {
    if (unavailable) return;
    setActive(index);
    setStarted(false);
    setSeconds(exercises[index].duration);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: timerY, animated: true }));
  };

  return (
    <Screen scroll={false}>
      <ScrollView
        ref={scrollRef}
        style={local.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[local.content, { paddingBottom: insets.bottom + 24 }]}
      >
        <Header eyebrow="JOINT PREP" title="Rehab player" />
        {workout && (
          <View style={[local.preview, { backgroundColor: colors.card }]}>
            <Text style={[local.previewLabel, { color: colors.primary }]}>SESSION PREVIEW · {workout.duration}</Text>
            <Text style={[local.previewTitle, { color: colors.foreground }]}>{workout.title}</Text>
            <Text style={[styles.muted, { color: colors.mutedForeground }]}>{workout.focus}</Text>
          </View>
        )}
         <BrandedModal
           visible={unavailable && showUnavailable}
           title={`Please wait until ${WEEKDAYS[workoutWeekdayIndex(workout?.day ?? 1)]}`}
           message="This planned session can only be completed on its scheduled day. You can still review the routine now, but the timer stays locked until then."
           onRequestClose={() => setShowUnavailable(false)}
           primaryLabel="Okay"
           onPrimaryPress={() => setShowUnavailable(false)}
         />
        <View style={[local.progress, { backgroundColor: unavailable ? colors.secondary : colors.card }]}>
          <View style={[local.track, { backgroundColor: colors.border }]}>
            <View style={[local.progressFill, { backgroundColor: colors.accent, width: `${(completedExercises / 3) * 100}%` }]} />
          </View>
          <Text style={[styles.muted, { color: colors.mutedForeground, marginTop: 10 }]}>
            {completedExercises} of 3 exercises complete
          </Text>
        </View>
        <SectionTitle>Today's routine</SectionTitle>
        {exercises.map((item, index) => {
          const complete = sets[index] >= 3;
          const selected = active === index;
          return (
            <Pressable
              key={item.title}
              disabled={unavailable}
              onPress={() => selectExercise(index)}
              style={({ pressed }) => [
                local.exercise,
                { backgroundColor: unavailable ? colors.secondary : selected ? colors.secondary : colors.card, opacity: unavailable ? 0.48 : pressed ? 0.78 : 1 },
              ]}
            >
              <View style={[local.check, { borderColor: complete ? colors.accent : colors.border, backgroundColor: complete ? colors.accent : 'transparent' }]}>
                {complete && <Text style={{ color: colors.background, fontFamily: 'Inter_700Bold' }}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[local.exerciseTitle, { color: colors.foreground }]}>{item.title}</Text>
                <Text style={[styles.muted, { color: colors.mutedForeground }]}>{item.detail} · {sets[index]} sets done</Text>
              </View>
              <Pressable
                testID={`Start ${item.title}`}
                disabled={unavailable || complete}
                onPress={() => selectExercise(index)}
                style={({ pressed }) => [local.startButton, { backgroundColor: complete ? colors.secondary : colors.primary, borderColor: complete ? colors.border : colors.primaryForeground, opacity: unavailable || complete ? 0.45 : pressed ? 0.75 : 1 }]}
              >
                <Text style={[local.startButtonText, { color: complete ? colors.mutedForeground : colors.primaryForeground }]}>{complete ? 'DONE' : 'START'}</Text>
              </Pressable>
            </Pressable>
          );
        })}
        <View
          onLayout={(event) => setTimerY(event.nativeEvent.layout.y)}
          style={[local.player, { backgroundColor: unavailable ? colors.secondary : colors.card, opacity: unavailable ? 0.48 : 1 }]}
        >
          <Text style={[local.playerEyebrow, { color: colors.primary }]}>EXERCISE {active + 1} · ISOMETRIC</Text>
          <Text style={[local.playerTitle, { color: colors.foreground }]}>{current.title}</Text>
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>Place the ball of your foot on a step. Drive your heel up and hold a neutral ankle position.</Text>
          <View style={local.timer}>
            <Svg width={TIMER_SIZE} height={TIMER_SIZE} viewBox={`0 0 ${TIMER_SIZE} ${TIMER_SIZE}`} style={local.timerRing}>
              <Circle
                cx={TIMER_SIZE / 2}
                cy={TIMER_SIZE / 2}
                r={TIMER_RADIUS}
                stroke={colors.border}
                strokeWidth={TIMER_STROKE}
                fill="none"
              />
              <Circle
                cx={TIMER_SIZE / 2}
                cy={TIMER_SIZE / 2}
                r={TIMER_RADIUS}
                stroke={seconds < current.duration ? colors.destructive : colors.border}
                strokeWidth={TIMER_STROKE}
                strokeLinecap="round"
                strokeDasharray={`${TIMER_CIRCUMFERENCE} ${TIMER_CIRCUMFERENCE}`}
                strokeDashoffset={timerOffset}
                fill="none"
                transform={`rotate(-90 ${TIMER_SIZE / 2} ${TIMER_SIZE / 2})`}
              />
            </Svg>
            <View style={local.timerContent}>
              <Text style={[local.timerText, { color: colors.foreground }]}>00:{seconds.toString().padStart(2, '0')}</Text>
              <Text style={[styles.muted, { color: colors.mutedForeground }]}>SET {Math.min(sets[active] + 1, 3)} OF 3</Text>
            </View>
          </View>
          <Button
            label={started ? 'Pause timer' : `Start ${current.duration} sec timer`}
            icon={started ? 'pause' : 'play'}
            secondary={started}
            disabled={unavailable || sets[active] >= 3}
            onPress={() => {
              if (seconds === 0) setSeconds(current.duration);
              setStarted((value) => !value);
            }}
          />
        </View>
        <Button
          label={allComplete ? 'Complete workout' : 'Complete all exercises first'}
          icon="check-circle"
          disabled={unavailable || !allComplete}
          onPress={() => {
            if (workoutId) completeWorkout(workoutId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
        />
      </ScrollView>
    </Screen>
  );
}

const local = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1 },
  preview: { borderRadius: 20, padding: 17, marginBottom: 12 },
  previewLabel: { fontFamily: 'Inter_700Bold', letterSpacing: 1, fontSize: 10 },
  previewTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, marginVertical: 8 },
  unavailable: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 12, marginBottom: 12 },
  unavailableTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, lineHeight: 20 },
  progress: { borderRadius: 18, padding: 16, marginBottom: 20 },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5 },
  exercise: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 17, padding: 14, marginBottom: 8 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  exerciseTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, marginBottom: 3 },
  startButton: { minWidth: 64, minHeight: 38, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  startButtonText: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.8 },
  player: { borderRadius: 22, padding: 19, marginTop: 18, marginBottom: 16 },
  playerEyebrow: { fontFamily: 'Inter_700Bold', letterSpacing: 1.3, fontSize: 10 },
  playerTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, marginVertical: 10 },
  timer: { width: TIMER_SIZE, height: TIMER_SIZE, alignSelf: 'center', marginVertical: 20, alignItems: 'center', justifyContent: 'center' },
  timerRing: { position: 'absolute' },
  timerContent: { alignItems: 'center', justifyContent: 'center' },
  timerText: { fontFamily: 'Inter_700Bold', fontSize: 34, letterSpacing: -1 },
});