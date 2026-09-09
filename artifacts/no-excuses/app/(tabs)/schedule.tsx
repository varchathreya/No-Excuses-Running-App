import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useGetCalendarPreview } from '@workspace/api-client-react';
import * as IntentLauncher from 'expo-intent-launcher';
import { Screen, Header, Button, Pill, SectionTitle, styles } from '@/components/Screen';
import { useApp, WEEKDAYS, Workout, workoutWeekdayIndex } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/expo';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

function calendarDateFor(item: Workout) {
  const now = new Date();
  const monday = new Date(now);
  const day = now.getDay() || 7;
  monday.setDate(now.getDate() - day + 1 + 7 + (item.week - 1) * 7 + workoutWeekdayIndex(item.day));
  monday.setHours(6, 0, 0, 0);
  const end = new Date(monday.getTime() + 30 * 60000);
  return { start: monday, end };
}

function openCalendar(item: Workout) {
  const { start, end } = calendarDateFor(item);
  const format = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const details = `${item.focus}\n\nNo Excuses · Week ${item.week} · ${WEEKDAYS[workoutWeekdayIndex(item.day)]}\nWorkout marker: NE-${item.id}`;
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`No Excuses · W${item.week}D${item.day} · ${item.title}`)}&dates=${format(start)}/${format(end)}&details=${encodeURIComponent(details)}`;
  Linking.openURL(url).catch(() => Alert.alert('Google Calendar unavailable', 'Install Google Calendar or open this link in your mobile browser.'));
}

async function openAlarm(item: Workout) {
  if (Platform.OS !== 'android') {
    Alert.alert('Android alarm', 'Alarm setup opens the native Android Clock app on an Android device.');
    return false;
  }
  const androidDay = ((workoutWeekdayIndex(item.day) + 1) % 7) + 1;
  try {
    await IntentLauncher.startActivityAsync('android.intent.action.SET_ALARM', {
      extra: {
        'android.intent.extra.alarm.HOUR': 6,
        'android.intent.extra.alarm.MINUTES': 0,
        'android.intent.extra.alarm.MESSAGE': `No Excuses · ${item.title}`,
        'android.intent.extra.alarm.DAYS': [androidDay],
        'android.intent.extra.alarm.SKIP_UI': false,
        'android.intent.extra.alarm.VIBRATE': true,
      },
    });
    return true;
  } catch {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.SHOW_ALARMS');
      return true;
    } catch {
      Alert.alert('Clock app unavailable', 'No compatible Android Clock app was found. Open your device’s Clock app and set the alarm manually.');
      return false;
    }
  }
}

function formatEventTime(start?: string) {
  if (!start || !start.includes('T')) return null;
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function WorkoutRow({ item, booked, calendarStart, onAlarmRequested }: { item: Workout; booked: boolean; calendarStart?: string; onAlarmRequested: (item: Workout) => void }) {
  const colors = useColors();
  const router = useRouter();
  const { setAlarmChecked } = useApp();
  const weekday = WEEKDAYS[workoutWeekdayIndex(item.day)];
  const start = () => router.push(item.type === 'rehab' ? `/rehab?workoutId=${item.id}` : `/run?workoutId=${item.id}`);
  const alarmChecked = !!item.alarmSet;
  const alarmPress = () => {
    if (alarmChecked) {
      setAlarmChecked(item.id, false);
      return;
    }
    onAlarmRequested(item);
  };
  return (
    <View style={[local.row, { backgroundColor: colors.card }]}>
      <View style={local.rowTop}>
        <View style={[local.day, { backgroundColor: item.completed ? colors.accent : colors.secondary, borderColor: item.completed ? colors.accent : colors.border }]}>
          <Text style={{ color: item.completed ? colors.accentForeground : colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 11 }}>{weekday.slice(0, 3).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={local.titleLine}><Text style={[local.rowTitle, { color: colors.foreground }]}>{item.title}</Text>{item.completed && <Pill color={colors.accent}>DONE</Pill>}</View>
          <Text style={[styles.muted, { color: colors.primary }]}>{item.duration}</Text>
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>Week {item.week}</Text>
        </View>
      </View>
      <View style={local.actions}>
        {booked && formatEventTime(calendarStart) ? (
          <View testID={`calendar-time-${item.id}`} style={[local.smallButton, { backgroundColor: colors.accent, borderColor: colors.accent }]}>
            <Feather name="calendar" size={14} color={colors.background} />
            <Text style={[local.smallText, { color: colors.background }]}>{formatEventTime(calendarStart)}</Text>
          </View>
        ) : (
          <Pressable testID={`book-${item.id}`} onPress={() => openCalendar(item)} style={[local.smallButton, { borderColor: booked ? colors.accent : colors.border }]}><Feather name="calendar" size={14} color={booked ? colors.accent : colors.foreground} /><Text style={[local.smallText, { color: booked ? colors.accent : colors.foreground }]}>{booked ? 'Booked' : 'Book'}</Text></Pressable>
        )}
        <Pressable testID={`start-${item.id}`} onPress={start} style={[local.smallButton, { backgroundColor: colors.accent, borderColor: colors.accent }]}><Feather name="play" size={14} color={colors.background} /><Text style={[local.smallText, { color: colors.background }]}>Start</Text></Pressable>
        <Pressable testID={`alarm-${item.id}`} accessibilityRole="checkbox" accessibilityLabel={alarmChecked ? 'Alarm marked as set' : 'Set 6:00 AM alarm'} accessibilityHint={alarmChecked ? 'Uncheck here if you remove it in Clock' : undefined} accessibilityState={{ checked: alarmChecked }} onPress={alarmPress} style={[local.smallButton, { borderColor: alarmChecked ? colors.accent : colors.border }]}>
          {alarmChecked ? <View style={[local.checkbox, { borderColor: colors.accent, backgroundColor: colors.accent }]}><Feather name="check" size={13} color={colors.accentForeground} /></View> : <Feather name="clock" size={16} color={colors.foreground} />}
          <Text style={[local.smallText, { color: alarmChecked ? colors.accent : colors.foreground }]}>{alarmChecked ? 'Alarm set' : 'Alarm'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function Schedule() {
  const colors = useColors();
  const { user } = useUser();
  const { workouts, setAlarmChecked } = useApp();
  const [week, setWeek] = useState(1);
  const [linkingCalendar, setLinkingCalendar] = useState(false);
  const calendar = useGetCalendarPreview({ days: 42 });
  const visible = useMemo(() => workouts.filter((item) => item.week === week), [workouts, week]);
  const previousAppState = useRef(AppState.currentState);
  const pendingAlarm = useRef<Workout | null>(null);
  const linkGoogleCalendar = async () => {
    const googleAccount = user?.externalAccounts.find((account) => account.provider === 'google');
    if (!googleAccount) {
      Alert.alert('Google account unavailable', 'Sign out and continue with the Google account you want to use.');
      return;
    }

    setLinkingCalendar(true);
    try {
      const redirectUrl = AuthSession.makeRedirectUri();
      const account = await googleAccount.reauthorize({
        additionalScopes: ['https://www.googleapis.com/auth/calendar.readonly'],
        redirectUrl,
        oidcPrompt: 'consent select_account',
      });
      const authorizationUrl = account.verification?.externalVerificationRedirectURL;
      if (!authorizationUrl) throw new Error('Google did not return an authorization link.');
      const result = await WebBrowser.openAuthSessionAsync(authorizationUrl.toString(), redirectUrl);
      if (result.type === 'success') {
        await user?.reload();
        await calendar.refetch();
      }
    } catch (cause) {
      Alert.alert(
        'Calendar connection failed',
        cause instanceof Error ? cause.message : 'Google Calendar could not be connected.',
      );
    } finally {
      setLinkingCalendar(false);
    }
  };
  const requestAlarm = async (item: Workout) => {
    const launched = await openAlarm(item);
    if (launched) pendingAlarm.current = item;
  };
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (previousAppState.current.match(/inactive|background/) && nextState === 'active') {
        calendar.refetch();
        const pending = pendingAlarm.current;
        if (pending) {
          pendingAlarm.current = null;
          Alert.alert(
            'Did you save the alarm?',
            `Android does not let No Excuses verify alarms saved in another Clock app. Confirm only if you saved the 6:00 AM alarm for ${pending.title}.`,
            [
              { text: 'Not yet', style: 'cancel' },
              { text: 'Mark as set', onPress: () => setAlarmChecked(pending.id, true) },
            ],
          );
        }
      }
      previousAppState.current = nextState;
    });
    return () => subscription.remove();
  }, [calendar.refetch, setAlarmChecked]);
  useEffect(() => {
    const interval = setInterval(() => calendar.refetch(), 30000);
    return () => clearInterval(interval);
  }, [calendar.refetch]);
  return <Screen><Header eyebrow="YOUR MONTH" title="Schedule" />
    <View style={local.weekTabs}>{[1, 2, 3, 4].map((value) => <Button key={value} label={`Week ${value}`} secondary={week !== value} onPress={() => setWeek(value)} />)}</View>
    <View style={[local.notice, { backgroundColor: colors.card }]}>
      <View style={local.accountRow}><Feather name="calendar" size={20} color={colors.primary} /><View style={{ flex: 1 }}><Text style={[local.noticeTitle, { color: colors.foreground }]}>{calendar.data?.connected ? calendar.data.calendarName : 'Connect Google Calendar'}</Text><Text style={[styles.muted, { color: colors.mutedForeground }]}>{calendar.isLoading ? 'Loading your next 42 days…' : calendar.data?.connected ? `${calendar.data.events.length} events visible · ${user?.primaryEmailAddress?.emailAddress ?? 'Google account'}` : 'Grant calendar access to sync booked workout times'}</Text></View></View>
      <View style={local.accountActions}>
        <Pressable accessibilityRole="button" onPress={() => Linking.openURL('https://calendar.google.com')} style={[local.accountButton, { backgroundColor: colors.secondary }]}><Feather name="external-link" size={14} color={colors.foreground} /><Text style={[local.accountButtonText, { color: colors.foreground }]}>Open GCal</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={linkingCalendar} onPress={linkGoogleCalendar} style={[local.accountButton, { backgroundColor: colors.secondary, opacity: linkingCalendar ? 0.65 : 1 }]}><Feather name="user-plus" size={14} color={colors.foreground} /><Text style={[local.accountButtonText, { color: colors.foreground }]}>{linkingCalendar ? 'Connecting…' : 'Link New Account'}</Text></Pressable>
      </View>
    </View>
    <Text style={[styles.muted, { color: colors.mutedForeground, marginBottom: 16 }]}>Book opens Google Calendar’s event editor so you can choose the final date and time. Booked times can only sync from the connected calendar account shown above.</Text>
    <SectionTitle>Week {week} plan · {visible.length} sessions</SectionTitle>
    {visible.map((item) => {
      const marker = `W${item.week}D${item.day}`;
      const calendarEvent = calendar.data?.events.find((event) => event.summary.includes(marker));
      return <WorkoutRow key={item.id} item={item} booked={!!calendarEvent} calendarStart={calendarEvent?.start} onAlarmRequested={requestAlarm} />;
    })}
  </Screen>;
}

const local = StyleSheet.create({
  notice: { gap: 12, padding: 15, borderRadius: 18, marginBottom: 12 },
  accountRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  accountActions: { flexDirection: 'row', gap: 8 },
  accountButton: { minHeight: 42, flex: 1, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  accountButtonText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  noticeTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, marginBottom: 3 },
  row: { padding: 12, borderRadius: 17, marginBottom: 10, gap: 12 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  day: { width: 46, height: 46, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, flex: 1 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  checkbox: { width: 16, height: 16, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 7 },
  smallButton: { flex: 1, minHeight: 42, borderRadius: 11, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 7 },
  smallText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  weekTabs: { flexDirection: 'row', gap: 6, marginBottom: 18 },
});