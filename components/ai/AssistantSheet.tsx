import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Animated,
  PanResponder,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { hapticImpactLight } from '@/lib/haptics';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { AppText } from '@/components/ui';
import { AI_COPY } from '@/lib/copy/ai';
import { buildFinancialDigest } from '@/lib/financial-digest';
import { FinancialDigest } from '@/lib/ai-types';
import { parseEntry, chat, AiError, refreshQuota } from '@/services/ai';
import { isVoiceAvailable, startVoice, stopVoice, destroyVoice } from '@/services/voice';
import { getCostPerUseMap } from '@/services/value-engine';
import { useAiStore } from '@/stores/aiStore';
import { useChatStore } from '@/stores/chatStore';
import { useItemsStore } from '@/stores/itemsStore';
import { usePreferencesStore } from '@/stores/preferencesStore';

const { height: SCREEN_H } = Dimensions.get('window');
const ADD_INTENT = /^\s*(add|track|new|create)\b/i;

// ── Animated typing dots ──────────────────────────────────────────────────────
function TypingDots() {
  const theme = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 3, duration: 750, useNativeDriver: true }),
        Animated.delay(300),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <View style={dotStyles.row}>
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          style={[
            dotStyles.dot,
            { backgroundColor: theme.colors.text.tertiary },
            {
              opacity: anim.interpolate({
                inputRange: [i, i + 0.5, i + 1, 3],
                outputRange: [0.25, 1, 0.25, 0.25],
                extrapolate: 'clamp',
              }),
              transform: [{
                translateY: anim.interpolate({
                  inputRange: [i, i + 0.5, i + 1, 3],
                  outputRange: [0, -4, 0, 0],
                  extrapolate: 'clamp',
                }),
              }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});

// ── Main sheet ────────────────────────────────────────────────────────────────
export function AssistantSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
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

  const scrollRef = useRef<ScrollView>(null);
  const digestRef = useRef<FinancialDigest | null>(null);

  // Swipe-to-dismiss
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;

  const dismiss = useCallback(() => {
    Animated.timing(translateY, {
      toValue: SCREEN_H,
      useNativeDriver: false,
      duration: 260,
    }).start(() => onCloseRef.current());
  }, [translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100 || g.vy > 0.6) {
          Animated.timing(translateY, {
            toValue: SCREEN_H,
            useNativeDriver: false,
            duration: 260,
          }).start(() => onCloseRef.current());
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: false,
            speed: 16,
            bounciness: 4,
          }).start();
        }
      },
    }),
  ).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(SCREEN_H);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: false,
        speed: 14,
        bounciness: 4,
      }).start();
      refreshChat();
      void refreshQuota();
      isVoiceAvailable().then(setVoiceOk);
      const items = useItemsStore.getState().items;
      getCostPerUseMap(items).then((cpu) => {
        digestRef.current = buildFinancialDigest(items, cpu, defaultCurrency);
      });
    } else {
      digestRef.current = null;
    }
  }, [visible, refreshChat, defaultCurrency]);

  useEffect(() => () => void destroyVoice(), []);

  useEffect(() => {
    if (turns.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [turns.length, sending]);

  const exhausted = !!quota && !quota.paid && quota.limit >= 0 && quota.used >= quota.limit;

  const send = useCallback(
    async (raw?: string) => {
      const text = (raw ?? input).trim();
      if (!text || sending) return;
      hapticImpactLight();
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
          const digest = digestRef.current ?? buildFinancialDigest(items, new Map(), defaultCurrency);
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
    <Modal
      visible={visible}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kav}
        >
          {/* Drag handle — top of the screen, full width tap zone */}
          <View
            style={[styles.handleArea, { paddingTop: insets.top + 6 }]}
            {...panResponder.panHandlers}
          >
            <View style={styles.handlePill} />
          </View>

          {/* Header row */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="sparkles" size={17} color={theme.colors.accent} />
              <AppText size="lg" weight="semibold">
                {AI_COPY.assistant.title}
              </AppText>
            </View>
            <TouchableOpacity
              onPress={dismiss}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close assistant"
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Chat history */}
          <ScrollView
            ref={scrollRef}
            style={styles.flex1}
            contentContainerStyle={styles.history}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {turns.length === 0 ? (
              <View style={styles.suggestions}>
                <AppText size="sm" color={theme.colors.text.tertiary} style={styles.scopeNote}>
                  {AI_COPY.assistant.scope}
                </AppText>
                {AI_COPY.assistant.suggestions.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={styles.suggestionRow}
                    onPress={() => send(s)}
                    activeOpacity={0.6}
                    accessibilityRole="button"
                  >
                    <AppText size="sm" color={theme.colors.text.secondary} style={styles.flex1}>
                      {s}
                    </AppText>
                    <Ionicons name="arrow-forward" size={14} color={theme.colors.text.tertiary} />
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
              <View style={[styles.bubble, styles.aiBubble]}>
                <TypingDots />
              </View>
            ) : null}
          </ScrollView>

          {/* Bottom: quota exhausted banner or input row */}
          {exhausted ? (
            <View style={[styles.exhausted, { marginBottom: insets.bottom + 8 }]}>
              <AppText size="sm" color={theme.colors.status.warning} align="center">
                {AI_COPY.assistant.quotaExhausted}
              </AppText>
            </View>
          ) : (
            <View style={[styles.inputRow, { paddingBottom: insets.bottom + 4 }]}>
              <TouchableOpacity
                onPress={onMic}
                style={[styles.iconButton, listening && styles.micActive]}
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
                returnKeyType="send"
                blurOnSubmit
                onSubmitEditing={() => send()}
              />
              <TouchableOpacity
                onPress={() => send()}
                disabled={!input.trim() || sending}
                style={[
                  styles.iconButton,
                  styles.sendButton,
                  (!input.trim() || sending) && styles.sendDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Send"
              >
                {sending ? (
                  <ActivityIndicator size="small" color={theme.colors.text.inverse} />
                ) : (
                  <Ionicons name="arrow-up" size={20} color={theme.colors.text.inverse} />
                )}
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    kav: {
      flex: 1,
    },
    handleArea: {
      alignItems: 'center',
      paddingBottom: theme.spacing.sm,
    },
    handlePill: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.sm,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginHorizontal: theme.spacing.base,
    },
    flex1: { flex: 1 },
    history: {
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.base,
      gap: theme.spacing.sm,
      flexGrow: 1,
    },
    scopeNote: {
      marginBottom: theme.spacing.sm,
    },
    suggestions: {
      gap: theme.spacing.xs,
    },
    suggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: 12,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceAlt,
    },
    bubble: {
      maxWidth: '88%',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.lg,
    },
    userBubble: { alignSelf: 'flex-end', backgroundColor: theme.colors.accent },
    aiBubble: { alignSelf: 'flex-start', backgroundColor: theme.colors.surfaceAlt },
    exhausted: {
      margin: theme.spacing.base,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.status.warningLight,
      borderRadius: theme.radius.md,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.base,
      paddingTop: theme.spacing.sm,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    micActive: { backgroundColor: theme.colors.accent },
    sendButton: { backgroundColor: theme.colors.accent },
    sendDisabled: { opacity: 0.4 },
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
  });
