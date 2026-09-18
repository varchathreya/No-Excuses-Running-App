import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const colors = useColors(); const insets = useSafeAreaInsets();
  const content = <View style={[styles.content, !scroll && styles.fill, { paddingTop: insets.top + 18, paddingBottom: scroll ? insets.bottom + 24 : 0 }]}>{children}</View>;
  return <View style={[styles.root, { backgroundColor: colors.background }]}>{scroll ? <ScrollView style={styles.fill} showsVerticalScrollIndicator={false}>{content}</ScrollView> : content}</View>;
}
export function Header({ eyebrow, title, titleIcon, action }: { eyebrow: string; title: string; titleIcon?: keyof typeof Feather.glyphMap; action?: React.ReactNode }) {
  const colors = useColors();
  const { offlineMode, isOnline, setOfflineMode } = useApp();
  const isConnected = !offlineMode && isOnline;
  const statusColor = isConnected ? colors.accent : colors.destructive;
  const statusLabel = offlineMode ? 'OFFLINE' : isOnline ? 'ONLINE' : 'NO WIFI';
  return <View style={styles.header}>
    <View style={styles.headerCopy}>
      <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text>
       <View style={styles.titleRow}>
         <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
         {titleIcon ? <Feather name={titleIcon} size={25} color={colors.primary} style={styles.titleIcon} /> : null}
       </View>
    </View>
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={offlineMode ? 'Offline mode is on' : isOnline ? 'Online mode is on' : 'No Wi-Fi detected'}
      accessibilityHint="Toggle network-required features"
      accessibilityState={{ checked: isConnected }}
      onPress={() => setOfflineMode(!offlineMode)}
      style={({ pressed }) => [styles.networkToggle, { borderColor: statusColor, opacity: pressed ? 0.72 : 1 }]}
    >
      <Feather name={isConnected ? 'wifi' : 'wifi-off'} size={13} color={statusColor} />
      <View style={[styles.toggleTrack, { borderColor: statusColor }]}>
        <View style={[styles.toggleThumb, { backgroundColor: statusColor, alignSelf: isConnected ? 'flex-end' : 'flex-start' }]} />
      </View>
      <Text style={[styles.networkText, { color: statusColor }]}>{statusLabel}</Text>
    </Pressable>
    <View style={styles.headerActions}>{action}</View>
  </View>;
}
export function Button({ label, onPress, secondary = false, icon, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; icon?: keyof typeof Feather.glyphMap; disabled?: boolean }) {
  const colors = useColors();
  return <Pressable testID={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: secondary ? colors.secondary : colors.primary, opacity: disabled ? 0.42 : pressed ? 0.78 : 1 }]}>{icon && <Feather name={icon} size={16} color={secondary ? colors.foreground : colors.primaryForeground} />}<Text style={[styles.buttonText, { color: secondary ? colors.foreground : colors.primaryForeground }]}>{label}</Text></Pressable>;
}
export function Pill({ children, color }: { children: React.ReactNode; color?: string }) { const colors = useColors(); return <View style={[styles.pill, { backgroundColor: color ?? colors.secondary }]}><Text style={[styles.pillText, { color: color ? colors.background : colors.mutedForeground }]}>{children}</Text></View>; }
export function SectionTitle({ children }: { children: React.ReactNode }) { const colors = useColors(); return <Text style={[styles.section, { color: colors.foreground }]}>{children}</Text>; }
export const styles = StyleSheet.create({ root: { flex: 1 }, fill: { flex: 1 }, content: { paddingHorizontal: 20 }, header: { position: 'relative', marginBottom: 24, minHeight: 86 }, headerCopy: { paddingRight: 86 }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, titleIcon: { marginTop: 2 }, headerActions: { alignItems: 'flex-end', marginTop: 10 }, networkToggle: { position: 'absolute', top: 0, right: 0, minHeight: 24, borderWidth: 1.5, borderRadius: 13, paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center', gap: 4 }, toggleTrack: { width: 22, height: 12, borderWidth: 1, borderRadius: 7, padding: 1, justifyContent: 'center' }, toggleThumb: { width: 8, height: 8, borderRadius: 4 }, networkText: { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: .4 }, eyebrow: { fontFamily: 'Inter_700Bold', letterSpacing: 1.5, fontSize: 11, marginBottom: 6 }, title: { fontFamily: 'Inter_700Bold', fontSize: 32, letterSpacing: -1 }, section: { fontFamily: 'Inter_700Bold', fontSize: 18, marginBottom: 12 }, button: { minHeight: 48, borderRadius: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, buttonText: { fontFamily: 'Inter_700Bold', fontSize: 14 }, pill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 30 }, pillText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.7 }, card: { borderRadius: 22, padding: 18, marginBottom: 12 }, muted: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 } });