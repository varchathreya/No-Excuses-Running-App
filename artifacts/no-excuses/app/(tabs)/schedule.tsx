import React, { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useGetCalendarPreview } from '@workspace/api-client-react';
import { Screen, Header, Button, Pill, SectionTitle, styles } from '@/components/Screen';
import { useApp, Workout } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function calendarDateFor(item: Workout) {
  const now = new Date();
  const monday = new Date(now);
  const day = now.getDay() || 7;
  monday.setDate(now.getDate() - day + 1 + (item.week - 1) * 7 + ((item.day - 1) % 7));
  monday.setHours(6, 0, 0, 0);
  const end = new Date(monday.getTime() + 30 * 60000);
  return { start: monday, end };
}

function openCalendar(item: Workout) {
  const { start, end } = calendarDateFor(item);
  const format = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const details = `${item.focus}\n\nNo Excuses · Week ${item.week} · ${weekdays[(item.day - 1) % 7]}`;
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`No Excuses: ${item.title}`)}&dates=${format(start)}/${format(end)}&details=${encodeURIComponent(details)}`;
  Linking.openURL(url).catch(() => Alert.alert('Google Calendar unavailable', 'Install Google Calendar or open this link in your mobile browser.'));
}

function WorkoutRow({ item }: { item: Workout }) {
  const colors = useColors();
  const router = useRouter();
  const weekday = weekdays[(item.day - 1) % 7];
  const start = () => router.push(item.type === 'rehab' ? `/rehab?workoutId=${item.id}` : `/run?workoutId=${item.id}`);
  return (
    <View style={[local.row, { backgroundColor: colors.card }]}>
      <View style={[local.day, { backgroundColor: item.completed ? colors.accent : colors.secondary }]}>
        <Text style={{ color: item.completed ? colors.background : colors.mutedForeground, fontFamily: 'Inter_700Bold', fontSize: 10 }}>{weekday.slice(0, 3).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={local.titleLine}><Text style={[local.rowTitle, { color: colors.foreground }]}>{item.title}</Text>{item.completed && <Pill color={colors.accent}>DONE</Pill>}</View>
        <Text style={[styles.muted, { color: colors.primary }]}>{weekday} · {item.duration}</Text>
        <Text style={[styles.muted, { color: colors.mutedForeground }]}>Week {item.week}</Text>
      </View>
      <View style={local.actions}>
        <Pressable testID={`book-${item.id}`} onPress={() => openCalendar(item)} style={[local.smallButton, { borderColor: colors.border }]}><Feather name="calendar" size={14} color={colors.foreground} /><Text style={[local.smallText, { color: colors.foreground }]}>Book</Text></Pressable>
        <Pressable testID={`start-${item.id}`} onPress={start} style={[local.smallButton, { backgroundColor: colors.accent }]}><Feather name="play" size={14} color={colors.background} /><Text style={[local.smallText, { color: colors.background }]}>Start</Text></Pressable>
      </View>
    </View>
  );
}

export default function Schedule() {
  const colors = useColors();
  const { workouts } = useApp();
  const [week, setWeek] = useState(1);
  const calendar = useGetCalendarPreview({ days: 7 });
  const visible = useMemo(() => workouts.filter((item) => item.week === week), [workouts, week]);
  return <Screen><Header eyebrow="YOUR MONTH" title="Schedule" action={<Feather name="bell" size={22} color={colors.foreground} />} />
    <View style={[local.notice, { backgroundColor: colors.card }]}><Feather name="calendar" size={20} color={colors.primary} /><View style={{ flex: 1 }}><Text style={[local.noticeTitle, { color: colors.foreground }]}>{calendar.data?.connected ? calendar.data.calendarName : 'Google Calendar'}</Text><Text style={[styles.muted, { color: colors.mutedForeground }]}>{calendar.isLoading ? 'Loading your next 7 days…' : `${calendar.data?.events.length ?? 0} events visible in the preview`}</Text></View><Button label="Open" secondary onPress={() => Linking.openURL('https://calendar.google.com')} /></View>
    <Text style={[styles.muted, { color: colors.mutedForeground, marginBottom: 16 }]}>Book opens Google Calendar’s event editor so you can choose the final date and time. Start launches the correct tracker and keeps completed sessions visible here.</Text>
    <View style={local.weekTabs}>{[1, 2, 3, 4].map((value) => <Button key={value} label={`Week ${value}`} secondary={week !== value} onPress={() => setWeek(value)} />)}</View>
    <SectionTitle>Week {week} plan · {visible.length} sessions</SectionTitle>
    {visible.map((item) => <WorkoutRow key={item.id} item={item} />)}
  </Screen>;
}

const local = StyleSheet.create({
  notice: { flexDirection: 'row', gap: 12, padding: 15, borderRadius: 18, marginBottom: 12, alignItems: 'center' },
  noticeTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, marginBottom: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 17, marginBottom: 8 },
  day: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, flex: 1 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  actions: { gap: 5 },
  smallButton: { minWidth: 68, minHeight: 34, borderRadius: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 7 },
  smallText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  weekTabs: { flexDirection: 'row', gap: 6, marginBottom: 18 },
});