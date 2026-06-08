import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Modal,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { AppText } from '@/components/ui';
import { AI_COPY } from '@/lib/copy/ai';
import { buildFinancialDigest } from '@/lib/financial-digest';
import { parseEntry, chat, AiError, refreshQuota } from '@/services/ai';
import { isVoiceAvailable, startVoice, stopVoice, destroyVoice } from '@/services/voice';
import { getCostPerUseMap } from '@/services/value-engine';
import { useAiStore } from '@/stores/aiStore';
import { useChatStore } from '@/stores/chatStore';
import { useItemsStore } from '@/stores/itemsStore';
import { usePreferencesStore } from '@/stores/preferencesStore';

const ADD_INTENT = /^\s*(add|track|new|create)\b/i;

export function AssistantSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();

  const turns = useChatStore((s) => s.turns);
  const addTurn = useChatStore((s) => s.add);
  const refreshChat = useChatStore((s) => s.refresh);
  const setPrefill = useAiStore((s) => s.setPrefill);
  const quota = useAiStore((s) => s.quota);
  const defaultCurrency = usePreferencesStore((s) => s.defaultCurrency);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOk, setVoiceOk] = useState(false);

  useEffect(() => {
    if (visible) {
      refreshChat();
      void refreshQuota();
      isVoiceAvailable().then(setVoiceOk);
    }
  }, [visible, refreshChat]);

  useEffect(() => () => void destroyVoice(), []);

  const exhausted = !!quota && !quota.paid && quota.limit >= 0 && quota.used >= quota.limit;

  const send = useCallback(
    async (raw?: string) => {
      const text = (raw ?? input).trim();
      if (!text || sending) return;
      setInput('');
      await addTurn('user', text);
      setSending(true);
      try {
        if (ADD_INTENT.test(text)) {
          const entry = await parseEntry(text.replace(ADD_INTENT, '').trim() || text);
          setPrefill(entry);
          await addTurn('assistant', AI_COPY.assistant.addedIntent);
          onClose();
          router.push('/(modal)/add-item');
        } else {
          const items = useItemsStore.getState().items;
          const cpu = await getCostPerUseMap(items);
          const digest = buildFinancialDigest(items, cpu, defaultCurrency);
          const answer = await chat(text, digest);
          await addTurn('assistant', answer);
        }
      } catch (err) {
        const msg = err instanceof AiError ? err.message : 'Something went wrong. Please try again.';
        await addTurn('assistant', msg);
        if (err instanceof AiError && err.code === 'quota') void refreshQuota();
      } finally {
        setSending(false);
      }
    },
    [input, sending, addTurn, setPrefill, onClose, router, defaultCurrency],
  );

  const onMic = useCallback(() => {
    if (listening) {
      void stopVoice();
      setListening(false);
      return;
    }
    if (!voiceOk) {
      Alert.alert(AI_COPY.voice.rationaleTitle, AI_COPY.assistant.micHint);
      return;
    }
    Alert.alert(AI_COPY.voice.rationaleTitle, AI_COPY.voice.rationaleBody, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start',
        onPress: async () => {
          const ok = await startVoice({
            onPartial: setInput,
            onResult: setInput,
            onError: () => setListening(false),
            onEnd: () => setListening(false),
          });
          setListening(ok);
        },
      },
    ]);
  }, [listening, voiceOk]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheet}
        >
          <View style={styles.header}>
            <View style={styles.flex1}>
              <AppText size="lg" weight="bold" accessibilityRole="header">
                {AI_COPY.assistant.title}
              </AppText>
              <AppText size="xs" color={theme.colors.text.tertiary}>
                {AI_COPY.assistant.scope}
              </AppText>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="chevron-down" size={24} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.flex1} contentContainerStyle={styles.history} showsVerticalScrollIndicator={false}>
            {turns.length === 0 ? (
              <View style={styles.empty}>
                {AI_COPY.assistant.suggestions.map((s) => (
                  <TouchableOpacity key={s} style={styles.suggestion} onPress={() => send(s)} accessibilityRole="button">
                    <Ionicons name="sparkles-outline" size={16} color={theme.colors.accent} />
                    <AppText size="sm" color={theme.colors.text.secondary} style={styles.flex1}>
                      {s}
                    </AppText>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              turns.map((t) => (
                <View
                  key={t.id}
                  style={[styles.bubble, t.role === 'user' ? styles.userBubble : styles.aiBubble]}
                >
                  <AppText
                    size="sm"
                    color={t.role === 'user' ? theme.colors.text.inverse : theme.colors.text.primary}
                  >
                    {t.text}
                  </AppText>
                </View>
              ))
            )}
            {sending ? (
              <View style={[styles.bubble, styles.aiBubble, styles.thinking]}>
                <ActivityIndicator size="small" color={theme.colors.accent} />
                <AppText size="sm" color={theme.colors.text.tertiary}>
                  {AI_COPY.assistant.thinking}
                </AppText>
              </View>
            ) : null}
          </ScrollView>

          {exhausted ? (
            <View style={styles.exhausted}>
              <AppText size="sm" color={theme.colors.status.warning} align="center">
                {AI_COPY.assistant.quotaExhausted}
              </AppText>
            </View>
          ) : (
            <View style={styles.inputRow}>
              <TouchableOpacity
                onPress={onMic}
                style={[styles.micButton, listening && styles.micActive]}
                accessibilityRole="button"
                accessibilityLabel="Voice input"
              >
                <Ionicons
                  name={listening ? 'mic' : 'mic-outline'}
                  size={20}
                  color={listening ? theme.colors.text.inverse : theme.colors.accent}
                />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder={AI_COPY.assistant.placeholder}
                placeholderTextColor={theme.colors.text.tertiary}
                multiline
                onSubmitEditing={() => send()}
              />
              <TouchableOpacity
                onPress={() => send()}
                disabled={!input.trim() || sending}
                style={[styles.sendButton, (!input.trim() || sending) && styles.sendDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Send"
              >
                <Ionicons name="arrow-up" size={20} color={theme.colors.text.inverse} />
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    sheet: {
      height: '82%',
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: theme.radius.lg,
      borderTopRightRadius: theme.radius.lg,
      paddingHorizontal: theme.spacing.base,
      paddingTop: theme.spacing.base,
      paddingBottom: theme.spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
      paddingBottom: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    flex1: { flex: 1 },
    history: { paddingVertical: theme.spacing.md, gap: theme.spacing.sm },
    empty: { gap: theme.spacing.sm, paddingTop: theme.spacing.md },
    suggestion: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    bubble: {
      maxWidth: '88%',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.lg,
    },
    userBubble: { alignSelf: 'flex-end', backgroundColor: theme.colors.accent },
    aiBubble: { alignSelf: 'flex-start', backgroundColor: theme.colors.surfaceAlt },
    thinking: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    exhausted: {
      padding: theme.spacing.md,
      backgroundColor: theme.colors.status.warningLight,
      borderRadius: theme.radius.md,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: theme.spacing.sm,
    },
    micButton: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.accentLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    micActive: { backgroundColor: theme.colors.accent },
    input: {
      flex: 1,
      maxHeight: 120,
      minHeight: 44,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.md,
      paddingTop: Platform.OS === 'ios' ? theme.spacing.md : theme.spacing.sm,
      fontFamily: 'Inter_400Regular',
      fontSize: theme.fontSize.md,
      color: theme.colors.text.primary,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendDisabled: { opacity: 0.4 },
  });
