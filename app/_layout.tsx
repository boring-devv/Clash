/**
 * app/_layout.tsx
 * Root layout — WalletProvider + notification badge subscription.
 */
import { C } from '@/constants/theme';
import { WalletProvider, useWallet } from '@/context/WalletContext';
import { subscribeUnreadCount } from '@/services/notifications';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// ── Notification badge context ────────────────────────────────────
interface NotifContextValue {
  unreadCount: number;
  setUnreadCount: (n: number) => void;
}

export const NotifContext = createContext<NotifContextValue>({
  unreadCount:    0,
  setUnreadCount: () => {},
});

export function useNotifBadge() { return useContext(NotifContext); }

// ── Inner layout — has access to WalletContext ─────────────────────
function InnerLayout() {
  const { pubkey }                      = useWallet();
  const [unreadCount, setUnreadCount]   = useState(0);
  const unsubRef                        = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Clean up previous subscription
    unsubRef.current?.();
    unsubRef.current = null;

    if (!pubkey) { setUnreadCount(0); return; }

    // Subscribe to real-time unread badge count
    const unsub = subscribeUnreadCount(pubkey, count => {
      setUnreadCount(count);
    });
    unsubRef.current = unsub;

    return () => { unsub(); };
  }, [pubkey]);

  return (
    <NotifContext.Provider value={{ unreadCount, setUnreadCount }}>
      <StatusBar style="light" backgroundColor={C.bg} />
      <Stack
        screenOptions={{
          headerShown:  false,
          contentStyle: { backgroundColor: C.bg },
          animation:    'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="connect" />
        <Stack.Screen name="phantom" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="challenge/[id]"    options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="join/[id]"         options={{ animation: 'slide_from_bottom', presentation: 'transparentModal' }} />
        <Stack.Screen name="create-challenge"  options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
        <Stack.Screen name="upload-proof/[id]" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
        <Stack.Screen name="vote/[id]"         options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
        <Stack.Screen name="edit-profile"      options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
        <Stack.Screen name="notifications"     options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings"          options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="user/[id]"         options={{ animation: 'slide_from_right' }} />
      </Stack>
    </NotifContext.Provider>
  );
}

// ── Root export ───────────────────────────────────────────────────
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <WalletProvider>
        <InnerLayout />
      </WalletProvider>
    </GestureHandlerRootView>
  );
}