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
  const { workouts, completedCount } = useApp();
  const next = workouts.find((w) => w.scheduled && !w.completed);
  const quote = useGetDailyQuote({ date: localDateKey() });
  return <Screen><Header eyebrow={dateLabel()} title="Today" />
    <View style={[local.quoteBox, { backgroundColor: colors.card }]}><Feather name="message-circle" size={22} color={colors.primary} /><Text style={[local.quote, { color: colors.foreground }]}>{quote.data?.quote ?? 'Small steps still move you forward.'}</Text></View>
    <View style={local.statRow}><View><Text style={[local.stat, { color: colors.foreground }]}>{completedCount}/7</Text><Text style={[styles.muted, { color: colors.mutedForeground }]}>sessions done</Text></View><View><Text style={[local.stat, { color: colors.foreground }]}>{next ? '06:00' : '—'}</Text><Text style={[styles.muted, { color: colors.mutedForeground }]}>next start</Text></View></View>
    <SectionTitle>Up next</SectionTitle>
    {next ? <Pressable onPress={() => router.push(next.type === 'rehab' ? `/rehab?workoutId=${next.id}` : `/run?workoutId=${next.id}`)} style={({ pressed }) => [local.next, { backgroundColor: colors.primary, opacity: pressed ? .82 : 1 }]}><View><Text style={local.nextOverline}>{next.day} · {next.duration}</Text><Text style={local.nextTitle}>{next.title}</Text><Text style={local.nextAction}>Start session <Feather name="arrow-right" size={14} color={colors.primaryForeground} /></Text></View><Feather name="play-circle" size={44} color={colors.primaryForeground} /></Pressable> : <View style={[styles.card, { backgroundColor: colors.card }]}><Text style={[styles.muted, { color: colors.mutedForeground }]}>Your plan is complete. Rest is part of the plan.</Text></View>}
  </Screen>;
}

const local = StyleSheet.create({ quoteBox: { borderRadius: 24, padding: 22, minHeight: 150, justifyContent: 'center', gap: 16, marginBottom: 18 }, quote: { fontFamily: 'Inter_700Bold', fontSize: 25, lineHeight: 31, letterSpacing: -.5 }, statRow: { flexDirection: 'row', gap: 54, paddingVertical: 6, marginBottom: 24 }, stat: { fontFamily: 'Inter_700Bold', fontSize: 23 }, next: { minHeight: 130, borderRadius: 22, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }, nextOverline: { color: '#111315', fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1 }, nextTitle: { color: '#111315', fontFamily: 'Inter_700Bold', fontSize: 20, marginVertical: 10 }, nextAction: { color: '#111315', fontFamily: 'Inter_600SemiBold', fontSize: 13 } });