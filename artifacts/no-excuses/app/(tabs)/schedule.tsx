import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  disconnectCalendarOAuth,
  getCalendarPreview,
  getAuthSession,
  startCalendarOAuth,
  useGetCalendarPreview,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import * as IntentLauncher from 'expo-intent-launcher';
import { Screen, Header, Button, Pill, SectionTitle, styles } from '@/components/Screen';
import { activeWorkoutWeek, isWorkoutAvailableToday, useApp, workoutDateLabel, workoutWeekdayName, Workout, workoutWeekdayIndex, workoutDate } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { getCalendarOAuthRedirectUrl } from '@/lib/oauth';
import { BrandedModal } from '@/components/BrandedModal';
import { getAuthorization } from '@/lib/api-auth';
import { getAuthErrorCode, linkCalendar, runAuthorized } from '@/lib/auth-flow';
import { useAuth } from '@clerk/expo';

const CALENDAR_PREVIEW_DAYS = 56;
const CALENDAR_PREVIEW_KEY = ['/api/calendar/preview', { days: CALENDAR_PREVIEW_DAYS }] as const;

function calendarDateFor(item: Workout, startDate?: string | null) {
  const plannedDate = workoutDate(item.day, startDate);
  if (plannedDate) {
    plannedDate.setHours(6, 0, 0, 0);
    return { start: plannedDate, end: new Date(plannedDate.getTime() + 30 * 60000) };
  }
  const now = new Date();
  const monday = new Date(now);
  const day = now.getDay() || 7;
  monday.setDate(now.getDate() - day + 1 + 7 + (item.week - 1) * 7 + workoutWeekdayIndex(item.day));
  monday.setHours(6, 0, 0, 0);
  const end = new Date(monday.getTime() + 30 * 60000);
  return { start: monday, end };
}

function openCalendar(item: Workout, startDate?: string | null) {
  const { start, end } = calendarDateFor(item, startDate);
  const format = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const details = `${item.focus}\n\nNo Excuses · Week ${item.week} · ${workoutWeekdayName(item.day, startDate)}${workoutDateLabel(item.day, startDate) ? ` · ${workoutDateLabel(item.day, startDate)}` : ''}\nWorkout marker: NE-${item.id}`;
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`No Excuses · W${item.week}D${item.day} · ${item.title}`)}&dates=${format(start)}/${format(end)}&details=${encodeURIComponent(details)}`;
  Linking.openURL(url).catch(() => Alert.alert('Google Calendar unavailable', 'Install Google Calendar or open this link in your mobile browser.'));
}

async function openAlarm(item: Workout, startDate?: string | null) {
  if (Platform.OS !== 'android') {
    Alert.alert('Android alarm', 'Alarm setup opens the native Android Clock app on an Android device.');
    return false;
  }
  const androidDay = ((workoutWeekdayIndex(item.day, startDate) + 1) % 7) + 1;
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

function WorkoutRow({ item, startDate, booked, calendarStart, networkAvailable, onAlarmRequested, onStartRequested }: { item: Workout; startDate?: string | null; booked: boolean; calendarStart?: string; networkAvailable: boolean; onAlarmRequested: (item: Workout) => void; onStartRequested: (item: Workout) => void }) {
  const colors = useColors();
  const { setAlarmChecked } = useApp();
  const weekday = workoutWeekdayName(item.day, startDate);
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
           <Text style={[styles.muted, { color: colors.mutedForeground }]}>Week {item.week}{workoutDateLabel(item.day, startDate) ? ` · ${workoutDateLabel(item.day, startDate)}` : ''}</Text>
        </View>
      </View>
      <View style={local.actions}>
        {booked && formatEventTime(calendarStart) ? (
          <View testID={`calendar-time-${item.id}`} style={[local.smallButton, { backgroundColor: colors.accent, borderColor: colors.accent }]}>
            <Feather name="calendar" size={14} color={colors.background} />
            <Text style={[local.smallText, { color: colors.background }]}>{formatEventTime(calendarStart)}</Text>
          </View>
        ) : (
          <Pressable testID={`book-${item.id}`} disabled={!networkAvailable} onPress={() => openCalendar(item, startDate)} style={[local.smallButton, { borderColor: booked ? colors.accent : colors.border, opacity: networkAvailable ? 1 : 0.42 }]}><Feather name="calendar" size={14} color={booked ? colors.accent : colors.foreground} /><Text style={[local.smallText, { color: booked ? colors.accent : colors.foreground }]}>{booked ? 'Booked' : networkAvailable ? 'Book' : 'Offline'}</Text></Pressable>
        )}
        <Pressable testID={`start-${item.id}`} onPress={() => onStartRequested(item)} style={[local.smallButton, { backgroundColor: colors.accent, borderColor: colors.accent }]}><Feather name="play" size={14} color={colors.background} /><Text style={[local.smallText, { color: colors.background }]}>Start</Text></Pressable>
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const { workouts, startDate, setAlarmChecked, networkAvailable, offlineMode, isOnline } = useApp();
  const { isLoaded: authLoaded, isSignedIn, getToken } = useAuth();
  const [week, setWeek] = useState(1);
  const [pendingStart, setPendingStart] = useState<Workout | null>(null);
  const [pendingAlarmConfirmation, setPendingAlarmConfirmation] = useState<Workout | null>(null);
  const [linkingCalendar, setLinkingCalendar] = useState(false);
  const [linkingCalendarError, setLinkingCalendarError] = useState<string | null>(null);
  const calendar = useGetCalendarPreview(
    { days: CALENDAR_PREVIEW_DAYS },
    {
      query: {
        queryKey: [...CALENDAR_PREVIEW_KEY],
        enabled: authLoaded && !!isSignedIn && networkAvailable,
        retry: false,
      },
    },
  );
  const authMismatch = getAuthErrorCode(calendar.error) === 'AUTH_TOKEN_REJECTED';
  const authExpired = getAuthErrorCode(calendar.error) === 'AUTH_REQUIRED';
  const visible = useMemo(() => workouts.filter((item) => item.week === week), [workouts, week]);
  const previousAppState = useRef(AppState.currentState);
  const pendingAlarm = useRef<Workout | null>(null);
  const navigateToWorkout = (item: Workout) => {
    if (!isWorkoutAvailableToday(item.day, item.week, activeWorkoutWeek(workouts), startDate)) {
      setPendingStart(item);
      return;
    }
    router.push(item.type === 'rehab' ? `/rehab?workoutId=${item.id}` : `/run?workoutId=${item.id}`);
  };
  const presentLinkCalendarOutcome = (outcome: Awaited<ReturnType<typeof linkCalendar>>) => {
    switch (outcome.status) {
      case 'not-ready':
        return;
      case 'signed-out':
      case 'no-session':
      case 'sign-in-required':
        router.replace('/sign-in');
        return;
      case 'env-mismatch':
        Alert.alert(
          'Calendar connection failed',
          'This build of No Excuses and the server are using different Clerk environments. Rebuild the APK with the Clerk key that matches the published API, then sign in and try again.',
        );
        return;
      case 'unexpected':
        Alert.alert('Calendar connection failed', outcome.message);
        return;
      case 'cancelled':
        return;
      case 'callback-error':
        Alert.alert('Calendar connection failed', 'Google Calendar permission was not completed.');
        return;
      case 'connected':
        return;
    }
  };
  const linkGoogleCalendar = async () => {
    if (!authLoaded || !isSignedIn) {
      router.replace('/sign-in');
      return;
    }
    setLinkingCalendar(true);
    setLinkingCalendarError(null);
    try {
      const outcome = await linkCalendar({
        isLoaded: authLoaded,
        isSignedIn: !!isSignedIn,
        getAuthorization: () => getAuthorization(getToken),
        preflight: (authorization) =>
          getAuthSession({ headers: authorization }).then(() => undefined),
        startOAuth: (authorization) =>
          startCalendarOAuth({ headers: authorization }),
        openBrowser: (authorizationUrl, redirectUrl) =>
          WebBrowser.openAuthSessionAsync(authorizationUrl, redirectUrl),
        redirectUrl: getCalendarOAuthRedirectUrl,
        onConnected: async () => {
          const authorization = await getAuthorization(getToken);
          if (!authorization) return;
           const freshPreview = await getCalendarPreview({ days: CALENDAR_PREVIEW_DAYS }, { headers: authorization });
          queryClient.setQueryData([...CALENDAR_PREVIEW_KEY], freshPreview);
        },
      });
      presentLinkCalendarOutcome(outcome);
      if (outcome.status !== 'connected') {
        setLinkingCalendarError('Connect again to retry.');
      }
    } catch (cause) {
      void WebBrowser.dismissBrowser();
      setLinkingCalendarError(cause instanceof Error ? cause.message : 'Google Calendar could not be connected.');
    } finally {
      setLinkingCalendar(false);
    }
  };
  const disconnectGoogleCalendar = () => {
    Alert.alert(
      'Disconnect Google Calendar?',
      'Booked workout times will stop syncing until you connect a calendar again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await runAuthorized(
                () => getAuthorization(getToken),
                (authorization) => disconnectCalendarOAuth({ headers: authorization }),
              );
              await calendar.refetch();
            } catch (cause) {
              if (getAuthErrorCode(cause) === 'AUTH_TOKEN_REJECTED') {
                Alert.alert(
                  'Disconnect failed',
                  'This build and the server are using different Clerk environments. Rebuild the APK with the matching Clerk key first.',
                );
              } else {
                Alert.alert('Disconnect failed', 'Google Calendar could not be disconnected. Try again.');
              }
            }
          },
        },
      ],
    );
  };
  const requestAlarm = async (item: Workout) => {
    const launched = await openAlarm(item, startDate);
    if (launched) pendingAlarm.current = item;
  };
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (previousAppState.current.match(/inactive|background/) && nextState === 'active') {
        if (networkAvailable) calendar.refetch();
        const pending = pendingAlarm.current;
        if (pending) {
          pendingAlarm.current = null;
          setPendingAlarmConfirmation(pending);
        }
      }
      previousAppState.current = nextState;
    });
    return () => subscription.remove();
  }, [calendar.refetch, networkAvailable, setAlarmChecked]);
  useEffect(() => {
    const interval = setInterval(() => {
      if (networkAvailable) calendar.refetch();
    }, 30000);
    return () => clearInterval(interval);
  }, [calendar.refetch, networkAvailable]);
  return <Screen><Header eyebrow="YOUR PLAN" title="Schedule" />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={local.weekTabs}>{[1, 2, 3, 4, 5, 6, 7, 8].map((value) => <Button key={value} label={`Week ${value}`} secondary={week !== value} onPress={() => setWeek(value)} />)}</ScrollView>
       <View style={[local.notice, { backgroundColor: colors.card }]}>
       <View style={local.accountRow}><Feather name="calendar" size={20} color={colors.primary} /><View style={{ flex: 1 }}><Text style={[local.noticeTitle, { color: colors.foreground }]}>{calendar.data?.connected ? calendar.data.calendarName : 'Connect Google Calendar'}</Text><Text style={[styles.muted, { color: colors.mutedForeground }]}>{offlineMode ? 'Offline mode is on. Calendar actions are disabled.' : !isOnline ? 'No internet connection. Calendar will resume when you reconnect.' : authMismatch ? 'Calendar preview is unavailable' : calendar.isLoading ? `Loading your next ${CALENDAR_PREVIEW_DAYS} days…` : calendar.data?.connected ? `${calendar.data.events.length} events visible from your connected calendar` : 'Grant read-only access to sync booked workout times'}</Text></View></View>
      {authMismatch && (
        <Text style={[styles.muted, { color: colors.destructive, lineHeight: 18 }]}>This build of No Excuses and the server are using different Clerk environments. Rebuild the APK with the matching Clerk key, then sign in again.</Text>
      )}
      {authExpired && !authMismatch && (
        <Text style={[styles.muted, { color: colors.destructive, lineHeight: 18 }]}>Your sign-in expired. Sign in again to check your calendar.</Text>
      )}
      <View style={local.accountActions}>
         <Pressable accessibilityRole="button" disabled={!networkAvailable} onPress={() => Linking.openURL('https://calendar.google.com')} style={[local.accountButton, { backgroundColor: colors.secondary, opacity: networkAvailable ? 1 : 0.42 }]}><Feather name="external-link" size={14} color={colors.foreground} /><Text style={[local.accountButtonText, { color: colors.foreground }]}>Open GCal</Text></Pressable>
         <Pressable
           accessibilityRole="button"
             disabled={linkingCalendar || !networkAvailable}
            onPress={linkGoogleCalendar}
            style={[local.accountButton, { backgroundColor: colors.secondary, opacity: linkingCalendar || !networkAvailable ? 0.42 : 1 }]}
         >
            <Feather name={calendar.data?.connected ? 'repeat' : 'user-plus'} size={14} color={colors.foreground} />
           <Text style={[local.accountButtonText, { color: colors.foreground }]}>
              {linkingCalendar ? 'Connecting…' : calendar.data?.connected ? 'Switch account' : 'Link Account'}
           </Text>
         </Pressable>
      </View>
      {!!linkingCalendarError && (
        <Text style={[styles.muted, { color: colors.destructive, lineHeight: 18 }]}>{linkingCalendarError}</Text>
      )}
       {calendar.data?.connected && (
         <Pressable
           accessibilityRole="button"
            disabled={linkingCalendar || !networkAvailable}
           onPress={disconnectGoogleCalendar}
           style={local.disconnectLink}
         >
           <Text style={[local.disconnectText, { color: colors.mutedForeground }]}>Disconnect this account</Text>
         </Pressable>
       )}
    </View>
    <Text style={[styles.muted, { color: colors.mutedForeground, marginBottom: 16 }]}>Book opens Google Calendar’s event editor so you can choose the final date and time. Booked times can only sync from the connected calendar account shown above.</Text>
     <SectionTitle>Week {week} plan · {visible.length} sessions</SectionTitle>
    {visible.map((item) => {
      const marker = `W${item.week}D${item.day}`;
      const calendarEvent = calendar.data?.events.find((event) => event.summary.includes(marker));
         return <WorkoutRow key={item.id} item={item} startDate={startDate} booked={!!calendarEvent} calendarStart={calendarEvent?.start} networkAvailable={networkAvailable} onAlarmRequested={requestAlarm} onStartRequested={navigateToWorkout} />;
     })}
     <BrandedModal
       visible={!!pendingStart}
         title={`Please wait until Week ${pendingStart?.week ?? 1}, ${pendingStart ? workoutWeekdayName(pendingStart.day, startDate) : ''}${pendingStart && workoutDateLabel(pendingStart.day, startDate) ? ` · ${workoutDateLabel(pendingStart.day, startDate)}` : ''}`}
        message="This planned session can only be completed during its active plan week and on its scheduled day. You can still review it now."
       onRequestClose={() => setPendingStart(null)}
       primaryLabel="Okay"
       onPrimaryPress={() => setPendingStart(null)}
     />
     <BrandedModal
       visible={!!pendingAlarmConfirmation}
       icon="clock"
       title="Did you save the alarm?"
       message={pendingAlarmConfirmation ? `Android does not let No Excuses verify alarms saved in another Clock app. Confirm only if you saved the 6:00 AM alarm for ${pendingAlarmConfirmation.title}.` : ''}
       onRequestClose={() => setPendingAlarmConfirmation(null)}
       primaryLabel="Mark as set"
       onPrimaryPress={() => {
         if (pendingAlarmConfirmation) setAlarmChecked(pendingAlarmConfirmation.id, true);
         setPendingAlarmConfirmation(null);
       }}
       secondaryLabel="Not yet"
       onSecondaryPress={() => setPendingAlarmConfirmation(null)}
     />
  </Screen>;
}

const local = StyleSheet.create({
  notice: { gap: 12, padding: 15, borderRadius: 18, marginBottom: 12 },
  accountRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  accountActions: { flexDirection: 'row', gap: 8 },
  disconnectLink: { alignSelf: 'flex-start', paddingTop: 2 },
  disconnectText: { fontFamily: 'Inter_500Medium', fontSize: 11, textDecorationLine: 'underline' },
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
  weekTabs: { flexDirection: 'row', gap: 6, marginBottom: 18, paddingRight: 20 },
});