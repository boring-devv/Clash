import { C } from '@/constants/theme';
import { useWallet } from '@/context/WalletContext';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const { connected, connecting } = useWallet();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Add a small delay to ensure the Root Layout is mounted
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isReady || connecting) return;
    if (connected) router.replace('/(tabs)/feed');
    else           router.replace('/connect');
  }, [connected, connecting, isReady]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={C.purple} size="large" />
    </View>
  );
}
