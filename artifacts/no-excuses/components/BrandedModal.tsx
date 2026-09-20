import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Button } from '@/components/Screen';
import { useColors } from '@/hooks/useColors';

type BrandedModalProps = {
  visible: boolean;
  title: string;
  message: string;
  icon?: keyof typeof Feather.glyphMap;
  onRequestClose: () => void;
  primaryLabel: string;
  onPrimaryPress: () => void;
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
  children?: React.ReactNode;
};

export function BrandedModal({
  visible,
  title,
  message,
  icon = 'calendar',
  onRequestClose,
  primaryLabel,
  onPrimaryPress,
  secondaryLabel,
  onSecondaryPress,
  children,
}: BrandedModalProps) {
  const colors = useColors();

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onRequestClose}>
      <View style={local.backdrop}>
        <View style={[local.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[local.icon, { backgroundColor: colors.secondary }]}>
            <Feather name={icon} size={24} color={colors.primary} />
          </View>
          <Text style={[local.title, { color: colors.foreground }]}>{title}</Text>
          <Text style={[local.message, { color: colors.mutedForeground }]}>{message}</Text>
          {children}
          <Button label={primaryLabel} onPress={onPrimaryPress} />
          {secondaryLabel && onSecondaryPress && (
            <Button label={secondaryLabel} secondary onPress={onSecondaryPress} />
          )}
          {secondaryLabel && onSecondaryPress && (
            <Pressable accessibilityRole="button" onPress={onRequestClose} style={local.cancel}>
              <Text style={[local.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const local = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.72)', justifyContent: 'center', padding: 24 },
  card: { borderRadius: 24, borderWidth: 1, padding: 22, gap: 14 },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Inter_700Bold', fontSize: 21, lineHeight: 26 },
  message: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
  cancel: { minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
});