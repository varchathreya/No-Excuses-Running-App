import React, { useMemo, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { useCreateWorkoutCalendarEvents, useGetCalendarPreview } from '@workspace/api-client-react';
import { Screen, Header, Button, Pill, SectionTitle, styles } from '@/components/Screen';
import { useApp, Workout } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';

function WorkoutRow({ item }: { item: Workout }) {
  const colors = useColors(); const { toggleSchedule } = useApp();
  const alarm = () => {
    const uri = `intent:#Intent;action=android.intent.action.SET_ALARM;S.android.intent.extra.alarm.MESSAGE=No%20Excuses%20Day%20${item.day};i.android.intent.extra.alarm.HOUR=6;i.android.intent.extra.alarm.MINUTES=0;end`;
    Linking.openURL(uri).catch(() => Alert.alert('Alarm app unavailable', 'Install or enable an Android alarm app to set this reminder.'));
  };
  return <View style={[local.row, { backgroundColor: colors.card }]}><View style={[local.day, { backgroundColor: item.scheduled ? colors.primary : colors.secondary }]}><Text style={{ color: item.scheduled ? colors.primaryForeground : colors.mutedForeground, fontFamily: 'Inter_700Bold', fontSize: 11 }}>D{item.day}</Text></View><View style={{ flex: 1 }}><Text style={[local.rowTitle, { color: colors.foreground }]}>{item.title}</Text><Text style={[styles.muted, { color: colors.mutedForeground }]}>{item.duration} · week {item.week}</Text></View>{item.completed ? <Pill color={colors.accent}>DONE</Pill> : <Button label={item.scheduled ? 'Alarm' : 'Book'} secondary={!item.scheduled} onPress={item.scheduled ? alarm : () => toggleSchedule(item.id)} />}</View>;
}
export default function Schedule() {
  const colors = useColors(); const { workouts, scheduleAll } = useApp(); const [week, setWeek] = useState(1);
  const calendar = useGetCalendarPreview({ days: 7 }); const createEvents = useCreateWorkoutCalendarEvents();
  const visible = useMemo(() => workouts.filter((item) => item.week === week), [workouts, week]);
  const multiSchedule = () => {
    scheduleAll();
    const base = new Date(); base.setHours(6, 0, 0, 0);
    createEvents.mutate({ data: { workouts: workouts.map((item, index) => { const start = new Date(base.getTime() + index * 86400000); const end = new Date(start.getTime() + 30 * 60000); return { title: `Day ${item.day}: ${item.title}`, start: start.toISOString(), end: end.toISOString() }; }) } }, { onSuccess: (data) => Alert.alert('Calendar updated', `${data.created} workout events were added to your Google Calendar.`), onError: () => Alert.alert('Calendar unavailable', 'Reconnect Google Calendar and try again.') });
  };
  return <Screen><Header eyebrow="YOUR MONTH" title="Schedule" action={<Feather name="bell" size={22} color={colors.foreground} />} /><View style={[local.notice, { backgroundColor: colors.card }]}><Feather name="calendar" size={20} color={colors.primary} /><View style={{ flex: 1 }}><Text style={[local.noticeTitle, { color: colors.foreground }]}>{calendar.data?.connected ? calendar.data.calendarName : 'Google Calendar'}</Text><Text style={[styles.muted, { color: colors.mutedForeground }]}>{calendar.isLoading ? 'Loading your next 7 days…' : `${calendar.data?.events.length ?? 0} events visible in the preview`}</Text></View><Button label="Open" secondary onPress={() => Linking.openURL('https://calendar.google.com')} /></View><Button label={createEvents.isPending ? 'Adding events…' : 'Multi-schedule 4 weeks'} icon="calendar" onPress={multiSchedule} /><Text style={[styles.muted, { color: colors.mutedForeground, marginVertical: 16 }]}>Flat, level ground only. If joint pain persists past 24 hours, reduce your next interval by 20%.</Text><View style={local.weekTabs}>{[1, 2, 3, 4].map((value) => <Button key={value} label={`Week ${value}`} secondary={week !== value} onPress={() => setWeek(value)} />)}</View><SectionTitle>Week {week} plan</SectionTitle>{visible.map((item) => <WorkoutRow key={item.id} item={item} />)}</Screen>;
}
const local = StyleSheet.create({ notice: { flexDirection: 'row', gap: 12, padding: 15, borderRadius: 18, marginBottom: 12, alignItems: 'center' }, noticeTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, marginBottom: 3 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 17, marginBottom: 8 }, day: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, rowTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, marginBottom: 2 }, weekTabs: { flexDirection: 'row', gap: 6, marginBottom: 18 }, });