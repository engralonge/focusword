import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Linking,
  Platform,
  Pressable,
  Switch,
  View,
  type AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import type { HomeStackParamList } from '@/navigation/types';
import type { FocusSession } from '@/types';
import {
  acceptFocusConsent,
  fetchFocusOverview,
  finishFocusSession,
  startFocusSession,
  updateFocusProgress,
} from '@/services/focus/focusService';
import { palette } from '@/constants/colors';
import { cn } from '@/utils/cn';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'FocusMode'>;

const DURATIONS = [15, 30, 45, 60] as const;

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function FocusModeScreen() {
  const navigation = useNavigation<Nav>();
  const [consented, setConsented] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>(30);
  const [session, setSession] = useState<FocusSession | null>(null);
  const [recentSessions, setRecentSessions] = useState<FocusSession[]>([]);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [interruptions, setInterruptions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const interruptionRef = useRef(0);
  const focusedSecondsRef = useRef(0);
  const finishingRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const overview = await fetchFocusOverview();
      setConsented(Boolean(overview.preference));
      setSession(overview.activeSession);
      setRecentSessions(overview.recentSessions);
      if (overview.activeSession) {
        setRemainingSeconds(
          Math.max(
            0,
            overview.activeSession.plannedSeconds - overview.activeSession.focusedSeconds,
          ),
        );
        setInterruptions(overview.activeSession.interruptionCount);
        interruptionRef.current = overview.activeSession.interruptionCount;
        focusedSecondsRef.current = overview.activeSession.focusedSeconds;
      }
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : 'Could not load Focus Mode.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const finish = useCallback(
    async (completed: boolean) => {
      if (!session || finishingRef.current) return;
      finishingRef.current = true;
      setWorking(true);
      setError(null);
      try {
        await finishFocusSession(
          session,
          focusedSecondsRef.current,
          interruptionRef.current,
          completed,
        );
        setSession(null);
        setRemainingSeconds(0);
        setInterruptions(0);
        interruptionRef.current = 0;
        focusedSecondsRef.current = 0;
        await load();
      } catch (nextError) {
        setError(
          nextError instanceof Error ? nextError.message : 'Could not finish the session.',
        );
      } finally {
        finishingRef.current = false;
        setWorking(false);
      }
    },
    [load, session],
  );

  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active') {
        return;
      }
      focusedSecondsRef.current = Math.min(
        session.plannedSeconds,
        focusedSecondsRef.current + 1,
      );
      const nextRemaining = Math.max(
        0,
        session.plannedSeconds - focusedSecondsRef.current,
      );
      setRemainingSeconds(nextRemaining);
      if (focusedSecondsRef.current % 15 === 0) {
        void updateFocusProgress(
          session.id,
          focusedSecondsRef.current,
          interruptionRef.current,
        ).catch(() => undefined);
      }
      if (nextRemaining === 0) {
        void finish(true);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [finish, session]);

  useEffect(() => {
    if (!session) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasAway = /inactive|background/.test(appState.current);
      if (/inactive|background/.test(nextState)) {
        void updateFocusProgress(
          session.id,
          focusedSecondsRef.current,
          interruptionRef.current,
        ).catch(() => undefined);
      }
      appState.current = nextState;
      if (nextState === 'active' && wasAway) {
        const nextCount = interruptionRef.current + 1;
        interruptionRef.current = nextCount;
        setInterruptions(nextCount);
        void updateFocusProgress(
          session.id,
          focusedSecondsRef.current,
          nextCount,
        ).catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [session]);

  const acceptConsent = async () => {
    setWorking(true);
    setError(null);
    try {
      await acceptFocusConsent();
      setConsented(true);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : 'Could not save consent.',
      );
    } finally {
      setWorking(false);
    }
  };

  const begin = async () => {
    setWorking(true);
    setError(null);
    try {
      const nextSession = await startFocusSession(duration);
      setSession(nextSession);
      setRemainingSeconds(nextSession.plannedSeconds);
      setInterruptions(0);
      interruptionRef.current = 0;
      focusedSecondsRef.current = 0;
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : 'Could not start Focus Mode.',
      );
    } finally {
      setWorking(false);
    }
  };

  const openSystemControls = async () => {
    try {
      if (Platform.OS === 'android') {
        await Linking.sendIntent(
          'android.settings.NOTIFICATION_POLICY_ACCESS_SETTINGS',
        );
      } else {
        await Linking.openSettings();
      }
    } catch {
      await Linking.openSettings();
    }
  };

  const confirmEnd = () => {
    Alert.alert(
      'End Focus Mode early?',
      'Your time will be saved, but this session will not count as completed.',
      [
        { text: 'Keep focusing', style: 'cancel' },
        {
          text: 'End session',
          style: 'destructive',
          onPress: () => void finish(false),
        },
      ],
    );
  };

  const completedSessions = recentSessions.filter((item) => item.completed);
  const totalMinutes = Math.floor(
    recentSessions.reduce((total, item) => total + item.focusedSeconds, 0) / 60,
  );

  return (
    <ScreenContainer contentClassName="px-5">
      <View className="pt-2 flex-row items-center">
        <Pressable
          className="w-11 h-11 -ml-2 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={navigation.goBack}
        >
          <Ionicons name="chevron-back" size={25} color={palette.brandLight} />
        </Pressable>
        <Text variant="title" className="ml-1">Focus Mode</Text>
      </View>

      {error ? <Text className="mt-3 text-center text-red-400">{error}</Text> : null}
      {loading ? <Text variant="caption" className="mt-6">Loading Focus Mode...</Text> : null}

      {!loading && session ? (
        <>
          <View className="mt-10 items-center">
            <View className="w-56 h-56 rounded-full border border-brand/40 bg-brand/[0.06] items-center justify-center">
              <Ionicons name="moon" size={28} color={palette.brand} />
              <Text className="mt-4 text-[48px] leading-[58px] font-light text-scripture">
                {formatTime(remainingSeconds)}
              </Text>
              <Text variant="label" className="mt-2">Quiet study</Text>
            </View>
            <Text className="mt-7 text-center text-lg leading-7 text-scripture">
              Stay present with Scripture.
            </Text>
            <Text variant="caption" className="mt-2 text-center">
              {interruptions === 0
                ? 'No interruptions'
                : `${interruptions} ${interruptions === 1 ? 'interruption' : 'interruptions'}`}
            </Text>
          </View>
          <Card className="mt-8">
            <View className="flex-row items-center gap-3">
              <Ionicons name="notifications-off-outline" size={22} color={palette.brandLight} />
              <View className="flex-1">
                <Text className="font-semibold">System quiet controls</Text>
                <Text variant="caption" className="mt-1 leading-5">
                  Manage Do Not Disturb or Focus settings directly on your device.
                </Text>
              </View>
            </View>
            <Button
              title="Open system settings"
              variant="secondary"
              className="mt-4"
              onPress={() => void openSystemControls()}
            />
          </Card>
          <Button
            title={working ? 'Ending...' : 'End session early'}
            variant="ghost"
            className="mt-5"
            disabled={working}
            onPress={confirmEnd}
          />
        </>
      ) : null}

      {!loading && !session && !consented ? (
        <>
          <Card className="mt-6 rounded-3xl p-6">
            <Ionicons name="shield-checkmark-outline" size={30} color={palette.brandLight} />
            <Text variant="subtitle" className="mt-5">Your choice, every time</Text>
            <Text className="mt-3 leading-7">
              Focus Mode records the study time you choose and notices when you leave the
              app. It does not secretly control your phone, inspect other apps, or activate
              system restrictions without your permission.
            </Text>
            <View className="mt-5 flex-row items-start gap-3">
              <Switch
                value={consentChecked}
                onValueChange={setConsentChecked}
                trackColor={{ false: palette.border, true: palette.brand }}
              />
              <Text variant="caption" className="flex-1 leading-5">
                I choose to use Focus Mode and understand that system-level controls remain
                under my device settings.
              </Text>
            </View>
          </Card>
          <Button
            title={working ? 'Saving...' : 'Continue'}
            className="mt-5"
            disabled={working || !consentChecked}
            onPress={() => void acceptConsent()}
          />
        </>
      ) : null}

      {!loading && !session && consented ? (
        <>
          <Card className="mt-6 rounded-3xl p-6 items-center">
            <View className="w-16 h-16 rounded-2xl bg-brand/12 items-center justify-center">
              <Ionicons name="moon-outline" size={30} color={palette.brandLight} />
            </View>
            <Text variant="subtitle" className="mt-5">Choose a quiet window</Text>
            <Text variant="caption" className="mt-2 text-center leading-5">
              Leaving the app during the timer is recorded as an interruption.
            </Text>
            <View className="mt-6 w-full flex-row flex-wrap gap-2">
              {DURATIONS.map((minutes) => (
                <Pressable
                  key={minutes}
                  className={cn(
                    'w-[48%] min-h-12 rounded-xl border items-center justify-center',
                    duration === minutes
                      ? 'border-brand bg-brand/15'
                      : 'border-border bg-surface',
                  )}
                  onPress={() => setDuration(minutes)}
                >
                  <Text
                    className={
                      duration === minutes
                        ? 'font-semibold text-brand-light'
                        : 'font-medium text-muted'
                    }
                  >
                    {minutes} minutes
                  </Text>
                </Pressable>
              ))}
            </View>
            <Button
              title={working ? 'Starting...' : 'Begin Focus Mode'}
              className="mt-6 w-full"
              disabled={working}
              onPress={() => void begin()}
            />
          </Card>

          <View className="mt-7 flex-row gap-3">
            <Card className="flex-1 items-center">
              <Text className="text-2xl font-light text-scripture">
                {completedSessions.length}
              </Text>
              <Text variant="caption" className="mt-1 text-center">Completed</Text>
            </Card>
            <Card className="flex-1 items-center">
              <Text className="text-2xl font-light text-scripture">{totalMinutes}</Text>
              <Text variant="caption" className="mt-1 text-center">Focused minutes</Text>
            </Card>
          </View>
          <Button
            title="Open system quiet controls"
            variant="secondary"
            className="mt-5"
            onPress={() => void openSystemControls()}
          />
        </>
      ) : null}
      <View className="h-8" />
    </ScreenContainer>
  );
}
