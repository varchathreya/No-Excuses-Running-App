import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const colors = useColors(); const insets = useSafeAreaInsets();
  const content = <View style={[styles.content, { paddingTop: insets.top + 18, paddingBottom: 110 }]}>{children}</View>;
  return <View style={[styles.root, { backgroundColor: colors.background }]}>{scroll ? <ScrollView showsVerticalScrollIndicator={false}>{content}</ScrollView> : content}</View>;
}
export function Header({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  const colors = useColors();
  return <View style={styles.header}><View><Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text><Text style={[styles.title, { color: colors.foreground }]}>{title}</Text></View>{action}</View>;
}
export function Button({ label, onPress, secondary = false, icon, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; icon?: keyof typeof Feather.glyphMap; disabled?: boolean }) {
  const colors = useColors();
  return <Pressable testID={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: secondary ? colors.secondary : colors.primary, opacity: disabled ? 0.42 : pressed ? 0.78 : 1 }]}>{icon && <Feather name={icon} size={16} color={secondary ? colors.foreground : colors.primaryForeground} />}<Text style={[styles.buttonText, { color: secondary ? colors.foreground : colors.primaryForeground }]}>{label}</Text></Pressable>;
}
export function Pill({ children, color }: { children: React.ReactNode; color?: string }) { const colors = useColors(); return <View style={[styles.pill, { backgroundColor: color ?? colors.secondary }]}><Text style={[styles.pillText, { color: color ? colors.background : colors.mutedForeground }]}>{children}</Text></View>; }
export function SectionTitle({ children }: { children: React.ReactNode }) { const colors = useColors(); return <Text style={[styles.section, { color: colors.foreground }]}>{children}</Text>; }
export const styles = StyleSheet.create({ root: { flex: 1 }, content: { paddingHorizontal: 20 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }, eyebrow: { fontFamily: 'Inter_700Bold', letterSpacing: 1.5, fontSize: 11, marginBottom: 6 }, title: { fontFamily: 'Inter_700Bold', fontSize: 32, letterSpacing: -1 }, section: { fontFamily: 'Inter_700Bold', fontSize: 18, marginBottom: 12 }, button: { minHeight: 48, borderRadius: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, buttonText: { fontFamily: 'Inter_700Bold', fontSize: 14 }, pill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 30 }, pillText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.7 }, card: { borderRadius: 22, padding: 18, marginBottom: 12 }, muted: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 } });