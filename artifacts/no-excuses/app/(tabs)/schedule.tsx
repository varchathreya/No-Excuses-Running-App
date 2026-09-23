import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { currentPlanWeek, isWorkoutAvailableToday, useApp, workoutDateLabel, workoutWeekdayName, Workout, workoutWeekdayIndex, workoutDate } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
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

function sessionType(item: Workout) {
  if (item.kind === 'rest') return 'Rest day';
  if (item.type === 'rehab') return 'Rehab';
  if (item.kind === 'hsr') return 'Strength';
  return 'Run';
}

function WorkoutRow({
  item,
  startDate,
  booked,
  networkAvailable,
  onInfoRequested,
  onStartRequested,
  onBookRequested,
  onAlarmRequested,
}: {
  item: Workout;
  startDate?: string | null;
  booked: boolean;
  networkAvailable: boolean;
  onInfoRequested: (item: Workout) => void;
  onStartRequested: (item: Workout) => void;
  onBookRequested: (item: Workout) => void;
  onAlarmRequested: (item: Workout) => void;
}) {
  const colors = useColors();
  const weekday = workoutWeekdayName(item.day, startDate);
  return (
    <View style={[local.row, { backgroundColor: colors.card }]}>
      <View style={local.rowTop}>
        <View style={[local.day, { backgroundColor: item.completed ? colors.accent : colors.secondary, borderColor: item.completed ? colors.accent : colors.border }]}>
          <Text style={{ color: item.completed ? colors.accentForeground : colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 11 }}>{weekday.slice(0, 3).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={local.titleLine}><Text style={[local.rowTitle, { color: colors.foreground }]}>{sessionType(item)}</Text>{item.completed && <Pill color={colors.accent}>DONE</Pill>}</View>
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>{workoutDateLabel(item.day, startDate) ?? weekday}</Text>
           {item.targetPaceLabel && <Text style={[styles.muted, { color: colors.primary, marginTop: 3 }]}>{item.targetPaceLabel}</Text>}
        </View>
        <Pressable
          testID={`Info ${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={`More information about ${item.title}`}
          onPress={() => onInfoRequested(item)}
          style={({ pressed }) => [local.infoButton, { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="info" size={18} color={colors.primary} />
        </Pressable>
      </View>
      <View style={local.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Start ${item.title}`}
          onPress={() => onStartRequested(item)}
          style={({ pressed }) => [local.smallButton, { backgroundColor: colors.primary, borderColor: colors.primary, opacity: pressed ? 0.75 : 1 }]}
        >
          <Feather name="play" size={13} color={colors.primaryForeground} />
          <Text style={[local.smallText, { color: colors.primaryForeground }]}>START</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${booked ? 'Booked' : 'Book'} ${item.title} in Google Calendar`}
          disabled={!networkAvailable}
          onPress={() => onBookRequested(item)}
          style={({ pressed }) => [local.smallButton, { backgroundColor: colors.secondary, borderColor: colors.border, opacity: !networkAvailable ? 0.42 : pressed ? 0.75 : 1 }]}
        >
          <Feather name="calendar" size={13} color={colors.foreground} />
          <Text style={[local.smallText, { color: colors.foreground }]}>{booked ? 'BOOKED' : 'BOOK'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.alarmSet ? `Alarm marked as set for ${item.title}` : `Set alarm for ${item.title}`}
          onPress={() => onAlarmRequested(item)}
          style={({ pressed }) => [local.smallButton, { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
        >
          <Feather name="clock" size={13} color={colors.foreground} />
          <Text style={[local.smallText, { color: colors.foreground }]}>{item.alarmSet ? 'ALARM SET' : 'ALARM'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function WorkoutInfoModal({
  item,
  startDate,
  booked,
  calendarStart,
  networkAvailable,
  onClose,
  onStart,
  onBook,
  onAlarm,
}: {
  item: Workout | null;
  startDate: string | null;
  booked: boolean;
  calendarStart?: string;
  networkAvailable: boolean;
  onClose: () => void;
  onStart: (item: Workout) => void;
  onBook: (item: Workout) => void;
  onAlarm: (item: Workout) => void;
}) {
  const colors = useColors();
  if (!item) return null;
  const dateLabel = workoutDateLabel(item.day, startDate) ?? workoutWeekdayName(item.day, startDate);
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={local.infoBackdrop}>
        <View style={[local.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={local.infoHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[local.infoEyebrow, { color: colors.primary }]}>{sessionType(item)} · WEEK {item.week}</Text>
              <Text style={[local.infoTitle, { color: colors.foreground }]}>{item.title}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close workout information" onPress={onClose} style={[local.infoClose, { backgroundColor: colors.secondary }]}>
              <Feather name="x" size={18} color={colors.foreground} />
            </Pressable>
          </View>
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>{item.focus}</Text>
          <View style={[local.infoMetrics, { backgroundColor: colors.secondary }]}>
            <View style={local.infoMetric}><Text style={[local.infoMetricLabel, { color: colors.mutedForeground }]}>DATE</Text><Text style={[local.infoMetricValue, { color: colors.foreground }]}>{dateLabel}</Text></View>
            <View style={local.infoMetric}><Text style={[local.infoMetricLabel, { color: colors.mutedForeground }]}>SESSION</Text><Text style={[local.infoMetricValue, { color: colors.foreground }]}>{item.duration}</Text></View>
          </View>
          {item.minimumDurationSeconds ? (
            <Text style={[styles.muted, { color: colors.mutedForeground }]}>Minimum run time: {Math.floor(item.minimumDurationSeconds / 60)} minutes.</Text>
          ) : null}
          {item.targetPaceLabel ? (
            <Text style={[styles.muted, { color: colors.primary }]}>{item.targetPaceLabel}</Text>
          ) : null}
          <Button label="Start session" icon="play" onPress={() => onStart(item)} />
          <Button
            label={booked && formatEventTime(calendarStart) ? `Booked · ${formatEventTime(calendarStart)}` : networkAvailable ? 'Book in Google Calendar' : 'Calendar unavailable offline'}
            icon="calendar"
            secondary
            disabled={!networkAvailable}
            onPress={() => onBook(item)}
          />
          <Button label={item.alarmSet ? 'Alarm marked as set' : 'Set 6:00 AM alarm'} icon="clock" secondary onPress={() => onAlarm(item)} />
          <Pressable accessibilityRole="button" onPress={onClose} style={local.infoCancel}>
            <Text style={[local.infoCancelText, { color: colors.mutedForeground }]}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function Schedule() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { workouts, startDate, setAlarmChecked, networkAvailable, offlineMode, isOnline } = useApp();
  const { isLoaded: authLoaded, isSignedIn, getToken } = useAuth();
  const [week, setWeek] = useState(() => currentPlanWeek(workouts, startDate) ?? 1);
  const [pendingStart, setPendingStart] = useState<Workout | null>(null);
  const [pendingAlarmConfirmation, setPendingAlarmConfirmation] = useState<Workout | null>(null);
  const [infoWorkout, setInfoWorkout] = useState<Workout | null>(null);
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
  const infoCalendarEvent = infoWorkout
    ? calendar.data?.events.find((event) => event.summary.includes(`W${infoWorkout.week}D${infoWorkout.day}`))
    : undefined;
  const previousAppState = useRef(AppState.currentState);
  const pendingAlarm = useRef<Workout | null>(null);
  const navigateToWorkout = (item: Workout) => {
    const activeWeek = currentPlanWeek(workouts, startDate) ?? 1;
    if (!isWorkoutAvailableToday(item.day, item.week, activeWeek, startDate)) {
      setPendingStart(item);
      return;
    }
    router.push(item.type === 'rehab' ? `/rehab?workoutId=${item.id}` : `/run?workoutId=${item.id}`);
  };
  useFocusEffect(useCallback(() => {
    setWeek(currentPlanWeek(workouts, startDate) ?? 1);
  }, [startDate, workouts]));
  useEffect(() => {
    // Changing the plan is not an attempt to start a locked workout. Clear
    // any stale warning left behind by the previous plan.
    setPendingStart(null);
  }, [startDate, workouts]);
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
     {visible.map((item) => (
        <WorkoutRow
          key={item.id}
          item={item}
          startDate={startDate}
          booked={calendar.data?.events.some((event) => event.summary.includes(`W${item.week}D${item.day}`)) ?? false}
          networkAvailable={networkAvailable}
          onInfoRequested={setInfoWorkout}
          onStartRequested={navigateToWorkout}
          onBookRequested={(workout) => openCalendar(workout, startDate)}
          onAlarmRequested={requestAlarm}
        />
     ))}
      <WorkoutInfoModal
        item={infoWorkout}
        startDate={startDate}
        booked={!!infoCalendarEvent}
        calendarStart={infoCalendarEvent?.start}
        networkAvailable={networkAvailable}
        onClose={() => setInfoWorkout(null)}
        onStart={(item) => {
          setInfoWorkout(null);
          navigateToWorkout(item);
        }}
        onBook={(item) => {
          openCalendar(item, startDate);
          setInfoWorkout(null);
        }}
        onAlarm={async (item) => {
          setInfoWorkout(null);
          await requestAlarm(item);
        }}
      />
     <BrandedModal
       visible={!!pendingStart}
          title={`Please wait until ${pendingStart ? workoutWeekdayName(pendingStart.day, startDate) : 'the scheduled day'}`}
         message={pendingStart ? `This is a Week ${pendingStart.week} session scheduled for ${workoutDateLabel(pendingStart.day, startDate) ?? workoutWeekdayName(pendingStart.day, startDate)}. You can review it now, but start it on its assigned date.` : ''}
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
  infoButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  infoBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.72)', justifyContent: 'center', padding: 24 },
  infoCard: { borderRadius: 24, borderWidth: 1, padding: 22, gap: 14 },
  infoHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoEyebrow: { fontFamily: 'Inter_700Bold', letterSpacing: 1.2, fontSize: 10, marginBottom: 6 },
  infoTitle: { fontFamily: 'Inter_700Bold', fontSize: 23, lineHeight: 28 },
  infoClose: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  infoMetrics: { borderRadius: 15, padding: 14, flexDirection: 'row', gap: 18 },
  infoMetric: { flex: 1, gap: 4 },
  infoMetricLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1 },
  infoMetricValue: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  infoCancel: { minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  infoCancelText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  checkbox: { width: 16, height: 16, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 7 },
  smallButton: { flex: 1, minHeight: 42, borderRadius: 11, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 7 },
  smallText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  weekTabs: { flexDirection: 'row', gap: 6, marginBottom: 18, paddingRight: 20 },
});