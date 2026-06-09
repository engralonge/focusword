import type { ReactNode } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { palette } from '@/constants/colors';

type Props = {
  visible: boolean;
  title: string;
  value: string;
  placeholder: string;
  submitTitle: string;
  maxLength: number;
  loading?: boolean;
  allowEmptySubmit?: boolean;
  error?: string | null;
  children?: ReactNode;
  onChangeText: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function ComposerModal({
  visible,
  title,
  value,
  placeholder,
  submitTitle,
  maxLength,
  loading = false,
  allowEmptySubmit = false,
  error,
  children,
  onChangeText,
  onClose,
  onSubmit,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-background-light dark:bg-background px-4 pt-4">
        <View className="flex-row items-center justify-between">
          <Text variant="title">{title}</Text>
          <Pressable
            className="w-11 h-11 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
          >
            <Ionicons name="close" size={26} color={palette.muted} />
          </Pressable>
        </View>
        <TextInput
          className="mt-5 min-h-40 bg-surface-light dark:bg-surface rounded-xl px-4 py-4 text-foreground-light dark:text-foreground border border-black/10 dark:border-white/10"
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          maxLength={maxLength}
          multiline
          textAlignVertical="top"
          autoFocus
        />
        <Text variant="caption" className="mt-2 text-right">
          {value.length}/{maxLength}
        </Text>
        {children}
        {error ? <Text className="text-red-500 mt-3">{error}</Text> : null}
        <Button
          title={loading ? 'Saving...' : submitTitle}
          className="mt-5"
          disabled={loading || (!allowEmptySubmit && value.trim().length === 0)}
          onPress={onSubmit}
        />
      </View>
    </Modal>
  );
}
