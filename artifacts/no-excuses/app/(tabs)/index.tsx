import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useGetDailyQuote } from '@workspace/api-client-react';
import { Screen, Header, SectionTitle, styles } from '@/components/Screen';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { router } from 'expo-router';

function localDateKey() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function ordinal(day: number) {
  if (day % 100 >= 11 && day % 100 <= 13) return `${day}th`;
  const suffix = day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th';
  return `${day}${suffix}`;
}

function dateLabel() {
  const today = new Date();
  const weekday = today.toLocaleDateString(undefined, { weekday: 'long' });
  const month = today.toLocaleDateString(undefined, { month: 'long' });
  return `${weekday}, ${month} ${ordinal(today.getDate())}`.toUpperCase();
}

export default function Today() {
  const colors = useColors();
  const { workouts, completedCount, totalMiles, networkAvailable } = useApp();
  const next = workouts.find((w) => w.scheduled && !w.completed);
  const activeWeek = next?.week ?? 8;
  const weekCompleted = workouts.filter((workout) => workout.week === activeWeek && workout.completed).length;
  const progress = Math.min(100, (weekCompleted / 7) * 100);
  const quote = useGetDailyQuote({ date: localDateKey() }, { query: { queryKey: ['/api/quotes/daily', { date: localDateKey() }], enabled: networkAvailable, retry: false } });
  const startNext = () => {
    if (!next) return;
    router.push(next.type === 'rehab' ? `/rehab?workoutId=${next.id}` : `/run?workoutId=${next.id}`);
  };
  return <Screen><Header eyebrow={dateLabel()} title="Today" />
    <View style={[local.quoteBox, { backgroundColor: colors.card }]}><Feather name="message-circle" size={22} color={colors.primary} style={local.quoteIcon} /><Text style={[local.quote, { color: colors.foreground }]}>{quote.data?.quote ?? 'Small steps still move you forward.'}</Text></View>
    <View style={local.statRow}><View style={local.statItem}><Text style={[local.stat, { color: colors.foreground }]}>{weekCompleted}/7</Text><Text style={[local.statLabel, { color: colors.mutedForeground }]}>this week</Text></View><View style={local.statItem}><Text style={[local.stat, { color: colors.foreground }]}>{totalMiles.toFixed(1)}</Text><Text style={[local.statLabel, { color: colors.mutedForeground }]}>miles logged</Text></View><View style={local.statItem}><Text style={[local.stat, { color: colors.foreground }]}>{completedCount}</Text><Text style={[local.statLabel, { color: colors.mutedForeground }]}>total sessions</Text></View></View>
    <SectionTitle>Up next</SectionTitle>
    {next ? <View style={[local.next, { backgroundColor: colors.primary }]}><View style={local.nextCopy}><Text style={local.nextOverline}>WEEK {next.week} · {next.duration}</Text><Text style={local.nextTitle}>{next.title}</Text><Pressable accessibilityRole="button" onPress={startNext} style={({ pressed }) => [local.startButton, { backgroundColor: colors.background, opacity: pressed ? .75 : 1 }]}><Text style={[local.startText, { color: colors.foreground }]}>Start session</Text><Feather name="arrow-right" size={15} color={colors.foreground} /></Pressable></View><Pressable accessibilityRole="button" accessibilityLabel="Start next session" onPress={startNext} style={({ pressed }) => [local.playButton, { backgroundColor: colors.background, opacity: pressed ? .75 : 1 }]}><Feather name="play" size={24} color={colors.foreground} style={local.playIcon} /></Pressable></View> : <View style={[styles.card, { backgroundColor: colors.card }]}><Text style={[styles.muted, { color: colors.mutedForeground }]}>Your plan is complete. Rest is part of the plan.</Text></View>}
    <View style={[local.planCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={local.planHeader}><View><Text style={[local.planTitle, { color: colors.foreground }]}>Week {activeWeek} progress</Text><Text style={[styles.muted, { color: colors.mutedForeground }]}>{7 - weekCompleted} sessions remaining</Text></View><Text style={[local.percent, { color: colors.accent }]}>{Math.round(progress)}%</Text></View>
      <View style={[local.track, { backgroundColor: colors.secondary }]}><View style={[local.fill, { backgroundColor: colors.accent, width: `${progress}%` }]} /></View>
      <Pressable accessibilityRole="button" onPress={() => router.push('/schedule')} style={({ pressed }) => [local.scheduleLink, { borderColor: colors.border, opacity: pressed ? .7 : 1 }]}><Feather name="calendar" size={16} color={colors.foreground} /><Text style={[local.scheduleText, { color: colors.foreground }]}>View full schedule</Text></Pressable>
    </View>
  </Screen>;
}

const local = StyleSheet.create({ quoteBox: { borderRadius: 24, padding: 22, minHeight: 120, flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 18 }, quoteIcon: { marginTop: 4 }, quote: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 24, lineHeight: 30, letterSpacing: -.5 }, statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, marginBottom: 24 }, statItem: { flex: 1 }, stat: { fontFamily: 'Inter_700Bold', fontSize: 22 }, statLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 }, next: { minHeight: 150, borderRadius: 22, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }, nextCopy: { flex: 1, alignItems: 'flex-start' }, nextOverline: { color: '#111315', fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1 }, nextTitle: { color: '#111315', fontFamily: 'Inter_700Bold', fontSize: 24, lineHeight: 29, marginVertical: 10 }, startButton: { minHeight: 38, borderRadius: 11, borderWidth: 1.5, borderColor: '#111315', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 }, startText: { fontFamily: 'Inter_700Bold', fontSize: 12 }, playButton: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: '#111315', alignItems: 'center', justifyContent: 'center' }, playIcon: { transform: [{ translateX: 2 }] }, planCard: { borderRadius: 22, padding: 18, borderWidth: 1, marginBottom: 16 }, planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, planTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 2 }, percent: { fontFamily: 'Inter_700Bold', fontSize: 20 }, track: { height: 9, borderRadius: 6, marginVertical: 16, overflow: 'hidden' }, fill: { height: '100%', borderRadius: 6 }, scheduleLink: { minHeight: 42, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, scheduleText: { fontFamily: 'Inter_700Bold', fontSize: 13 } });