import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as Linking from 'expo-linking';
import type { AuthSession } from '@/services/auth/authService';
import {
  getCurrentSession,
  fetchUserProfile,
  handleAuthCallback,
  onAuthStateChange,
  requestPasswordReset,
  signInWithEmail,
  signUpWithEmail,
  signOut as authSignOut,
  deleteAccount as deleteUserAccount,
  updatePassword,
  updateUserAvatar,
  updateUserProfile,
} from '@/services/auth/authService';

type AuthContextValue = {
  session: AuthSession | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (displayName: string, email: string, password: string) => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  setNewPassword: (password: string) => Promise<string | null>;
  updateProfile: (displayName: string, bio: string) => Promise<string | null>;
  updateAvatar: (uri: string | null, mimeType?: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    let mounted = true;

    const openUrl = async (url: string | null) => {
      if (!url) {
        return;
      }
      if (url.includes('reset-password')) {
        setIsPasswordRecovery(true);
      }
      await handleAuthCallback(url);
    };

    void Promise.all([getCurrentSession(), Linking.getInitialURL()])
      .then(async ([current, initialUrl]) => {
        if (!mounted) return;
        if (current) {
          const profile = await fetchUserProfile();
          if (mounted) {
            setSession(profile ? { ...current, user: profile } : current);
          }
        } else {
          setSession(null);
        }
        await openUrl(initialUrl);
      })
      .catch(() => {
        if (mounted) setSession(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const linkSubscription = Linking.addEventListener('url', ({ url }) => {
      void openUrl(url);
    });
    const unsubscribe = onAuthStateChange((nextSession, event) => {
      setSession((current) =>
        nextSession && current
          ? {
              ...nextSession,
              user: {
                ...current.user,
                ...nextSession.user,
                bio: current.user.bio,
              },
            }
          : nextSession,
      );
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
    });
    return () => {
      mounted = false;
      linkSubscription.remove();
      unsubscribe?.();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { session: next, error } = await signInWithEmail(email, password);
    if (error) {
      return error;
    }
    setSession(next);
    return null;
  }, []);

  const signUp = useCallback(async (displayName: string, email: string, password: string) => {
    const { session: next, error } = await signUpWithEmail(displayName, email, password);
    if (error) {
      return error;
    }
    if (next) {
      setSession(next);
    }
    return null;
  }, []);

  const resetPassword = useCallback(
    async (email: string) => requestPasswordReset(email),
    [],
  );

  const setNewPassword = useCallback(async (password: string) => {
    const error = await updatePassword(password);
    if (!error) {
      setIsPasswordRecovery(false);
    }
    return error;
  }, []);

  const updateProfile = useCallback(async (displayName: string, bio: string) => {
    const { user, error } = await updateUserProfile(displayName, bio);
    if (error || !user) {
      return error ?? 'Could not update your profile.';
    }
    setSession((current) => current ? { ...current, user } : current);
    return null;
  }, []);

  const updateAvatar = useCallback(async (uri: string | null, mimeType?: string) => {
    const { user, error } = await updateUserAvatar(uri, mimeType);
    if (error || !user) {
      return error ?? 'Could not update your profile photo.';
    }
    setSession((current) => current ? { ...current, user } : current);
    return null;
  }, []);

  const signOut = useCallback(async () => {
    await authSignOut();
    setSession(null);
    setIsPasswordRecovery(false);
  }, []);

  const deleteAccount = useCallback(async () => {
    const error = await deleteUserAccount();
    if (!error) {
      setSession(null);
      setIsPasswordRecovery(false);
    }
    return error;
  }, []);

  const value = useMemo(
    () => ({
      session,
      loading,
      isPasswordRecovery,
      signIn,
      signUp,
      resetPassword,
      setNewPassword,
      updateProfile,
      updateAvatar,
      signOut,
      deleteAccount,
    }),
    [
      session,
      loading,
      isPasswordRecovery,
      signIn,
      signUp,
      resetPassword,
      setNewPassword,
      updateProfile,
      updateAvatar,
      signOut,
      deleteAccount,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
