import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { disconnectCalendarOAuth } from '@workspace/api-client-react';
import { Header, Screen } from '@/components/Screen';
import { dateFromKey, dateKeyFromDate, useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@clerk/expo';
import { getAuthorization } from '@/lib/api-auth';
import { runAuthorized } from '@/lib/auth-flow';

type CalendarDay = Date | null;

function monthLabel(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function shortDateLabel(value: string | null) {
  const date = dateFromKey(value);
  return date
    ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Not set';
}

function buildCalendarDays(month: Date): CalendarDay[] {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const leadingDays = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return [
    ...Array.from({ length: leadingDays }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1)),
  ];
}

export default function SettingsScreen() {
  const colors = useColors();
  const { regimenId, setRegimen, startDate, setStartDate, resetApp, networkAvailable } = useApp();
  const { isLoaded: authLoaded, isSignedIn, getToken } = useAuth();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => dateFromKey(startDate) ?? new Date());
  const [resetting, setResetting] = useState(false);
  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);
  const selectedDateKey = startDate;
  const todayKey = dateKeyFromDate(new Date());

  const openCalendar = () => {
    setCalendarMonth(dateFromKey(startDate) ?? new Date());
    setCalendarOpen(true);
  };

  const chooseDate = (date: Date) => {
    setStartDate(dateKeyFromDate(date));
    setCalendarOpen(false);
  };

  const moveMonth = (direction: number) => {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  };

  const confirmReset = () => {
    Alert.alert(
      'Reset app?',
      'This clears saved runs, rehab logs, workouts, alarms, regimen choices, and the plan start date. It also disconnects Google Calendar when you are signed in and online.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset app',
          style: 'destructive',
          onPress: async () => {
            setResetting(true);
            let calendarDisconnected = true;
            if (isSignedIn) {
              if (authLoaded && networkAvailable) {
                try {
                  await runAuthorized(
                    () => getAuthorization(getToken),
                    (authorization) => disconnectCalendarOAuth({ headers: authorization }),
                  );
                } catch {
                  calendarDisconnected = false;
                }
              } else {
                calendarDisconnected = false;
              }
            }
            resetApp();
            setResetting(false);
            Alert.alert(
              calendarDisconnected ? 'App reset' : 'App reset locally',
              calendarDisconnected
                ? 'Saved runs and plan data were cleared, and Google Calendar was disconnected.'
                : 'Saved runs and plan data were cleared. Connect to the internet and disconnect Google Calendar from Schedule to finish.',
            );
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <Header eyebrow="PLAN CONTROL" title="Settings" />

      <View style={styles.column}>
        <View style={[styles.resetCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.resetIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="refresh-ccw" size={19} color={colors.destructive} />
          </View>
          <View style={styles.resetCopy}>
            <Text style={[styles.resetTitle, { color: colors.foreground }]}>Reset app</Text>
            <Text style={[styles.resetDescription, { color: colors.mutedForeground }]}>Clear all saved runs and plan data, then disconnect Google Calendar.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reset app"
            disabled={resetting}
            onPress={confirmReset}
            style={({ pressed }) => [styles.resetButton, { borderColor: colors.destructive, opacity: resetting ? 0.42 : pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.resetButtonText, { color: colors.destructive }]}>{resetting ? 'RESETTING…' : 'RESET'}</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>START DATE</Text>
          <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>Day 1 of your 56-day plan</Text>
        </View>
        <Pressable
          testID="Choose start date"
          accessibilityRole="button"
          accessibilityLabel={`Start date ${shortDateLabel(startDate)}`}
          onPress={openCalendar}
          style={({ pressed }) => [
            styles.dateCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: pressed ? 0.78 : 1,
            },
          ]}
        >
          <View style={[styles.dateIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="calendar" size={20} color={colors.primary} />
          </View>
          <View style={styles.dateCopy}>
            <Text style={[styles.dateValue, { color: colors.foreground }]}>{shortDateLabel(startDate)}</Text>
            <Text style={[styles.dateSubtext, { color: colors.mutedForeground }]}>
              {startDate ? 'Tap to change the first training day' : 'Choose when your plan begins'}
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
        </Pressable>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>REGIMEN</Text>
          <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>Choose the plan that fits your return</Text>
        </View>
        <View style={styles.regimenList}>
          <RegimenOption
            id={1}
            title="Current regimen"
            description="Progressive gait work with structured rehab"
            selected={regimenId === 1}
            onPress={() => setRegimen(1)}
          />
          <RegimenOption
            id={2}
            title="Home-Grown Runner"
            description="Strength-first work with a measured run build"
            selected={regimenId === 2}
            onPress={() => setRegimen(2)}
          />
        </View>
      </View>

      <Modal
        transparent
        visible={calendarOpen}
        animationType="fade"
        onRequestClose={() => setCalendarOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={[styles.modalBackdrop, { backgroundColor: colors.background }]} onPress={() => setCalendarOpen(false)} />
          <View style={[styles.calendarSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={[styles.sheetEyebrow, { color: colors.primary }]}>PLAN START</Text>
                <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Choose a date</Text>
              </View>
              <Pressable
                testID="Close calendar"
                accessibilityRole="button"
                accessibilityLabel="Close calendar"
                onPress={() => setCalendarOpen(false)}
                hitSlop={10}
                style={({ pressed }) => [styles.closeButton, { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 }]}
              >
                <Feather name="x" size={19} color={colors.foreground} />
              </Pressable>
            </View>

            <View style={styles.monthRow}>
              <Pressable
                testID="Previous month"
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                onPress={() => moveMonth(-1)}
                hitSlop={8}
                style={({ pressed }) => [styles.monthButton, { borderColor: colors.border, opacity: pressed ? 0.65 : 1 }]}
              >
                <Feather name="chevron-left" size={18} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.monthTitle, { color: colors.foreground }]}>{monthLabel(calendarMonth)}</Text>
              <Pressable
                testID="Next month"
                accessibilityRole="button"
                accessibilityLabel="Next month"
                onPress={() => moveMonth(1)}
                hitSlop={8}
                style={({ pressed }) => [styles.monthButton, { borderColor: colors.border, opacity: pressed ? 0.65 : 1 }]}
              >
                <Feather name="chevron-right" size={18} color={colors.foreground} />
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
                <Text key={`${day}-${index}`} style={[styles.weekday, { color: colors.mutedForeground }]}>{day}</Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {calendarDays.map((day, index) => {
                if (!day) return <View key={`empty-${index}`} style={styles.dayCell} />;
                const key = dateKeyFromDate(day);
                const isSelected = key === selectedDateKey;
                const isToday = key === todayKey;
                return (
                  <Pressable
                    key={key}
                    testID={`Select ${key}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${day.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}${isSelected ? ', selected' : ''}`}
                    onPress={() => chooseDate(day)}
                    style={({ pressed }) => [
                      styles.dayCell,
                      styles.dayButton,
                      {
                        backgroundColor: isSelected ? colors.primary : 'transparent',
                        borderColor: isToday && !isSelected ? colors.accent : 'transparent',
                        opacity: pressed ? 0.68 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.dayText, { color: isSelected ? colors.primaryForeground : colors.foreground }]}>{day.getDate()}</Text>
                    {isToday && !isSelected ? <View style={[styles.todayDot, { backgroundColor: colors.accent }]} /> : null}
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.calendarFootnote, { color: colors.mutedForeground }]}>
              Your plan will schedule Day 1 from this date.
            </Text>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function RegimenOption({
  id,
  title,
  description,
  selected,
  onPress,
}: {
  id: 1 | 2;
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      testID={`Regimen ${id}`}
      accessibilityRole="radio"
      accessibilityLabel={`Regimen ${id}, ${title}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.regimenOption,
        {
          backgroundColor: selected ? colors.secondary : colors.card,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.78 : 1,
        },
      ]}
    >
      <View style={[styles.regimenNumber, { backgroundColor: selected ? colors.primary : colors.muted }]}>
        <Text style={[styles.regimenNumberText, { color: selected ? colors.primaryForeground : colors.mutedForeground }]}>{id}</Text>
      </View>
      <View style={styles.regimenCopy}>
        <Text style={[styles.regimenTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.regimenDescription, { color: colors.mutedForeground }]}>{description}</Text>
      </View>
      <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.mutedForeground }]}>
        {selected ? <View style={[styles.radioInner, { backgroundColor: colors.primary }]} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  column: { width: '100%', maxWidth: 430, alignSelf: 'stretch', paddingBottom: 28 },
  resetCard: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 26 },
  resetIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  resetCopy: { flex: 1, gap: 3 },
  resetTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  resetDescription: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  resetButton: { minHeight: 34, borderWidth: 1, borderRadius: 9, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center' },
  resetButtonText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.7 },
  sectionHeader: { marginBottom: 10 },
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.45 },
  sectionHint: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 4 },
  dateCard: { minHeight: 82, borderWidth: 1, borderRadius: 18, paddingHorizontal: 15, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 13 },
  dateIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dateCopy: { flex: 1, gap: 4 },
  dateValue: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  dateSubtext: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  divider: { height: 1, width: '100%', marginVertical: 28 },
  regimenList: { gap: 10 },
  regimenOption: { minHeight: 86, borderWidth: 1, borderRadius: 18, paddingHorizontal: 15, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 13 },
  regimenNumber: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  regimenNumberText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  regimenCopy: { flex: 1, gap: 4 },
  regimenTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  regimenDescription: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  radio: { width: 22, height: 22, borderWidth: 2, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFill, opacity: 0.78 },
  calendarSheet: { borderTopWidth: 1, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 30 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 23 },
  sheetEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.4, marginBottom: 5 },
  sheetTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.5 },
  closeButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  monthButton: { width: 38, height: 38, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekday: { flex: 1, textAlign: 'center', fontFamily: 'Inter_700Bold', fontSize: 11 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.2857%', height: 43, alignItems: 'center', justifyContent: 'center' },
  dayButton: { borderWidth: 1, borderRadius: 14, position: 'relative' },
  dayText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  todayDot: { position: 'absolute', bottom: 5, width: 3, height: 3, borderRadius: 2 },
  calendarFootnote: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 16 },
});