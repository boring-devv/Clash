// import { C, S, T } from '@/constants/theme';
// import { useWallet } from '@/context/WalletContext';
// import * as Linking from 'expo-linking';
// import { useRouter } from 'expo-router';
// import React, { useEffect, useRef } from 'react';
// import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

// export default function NotFound() {
//   const router  = useRouter();
//   const { handlePhantomCallback, connectDemo } = useWallet();
//   const handled = useRef(false);

//   useEffect(() => {
//     if (handled.current) return;
//     handled.current = true;

//     (async () => {
//       const url = await Linking.getInitialURL() ?? '';
//       console.log('+not-found URL:', url);

//       if (!url.includes('phantom')) {
//         router.replace('/connect');
//         return;
//       }

//       const queryStart = url.indexOf('?');
//       if (queryStart === -1) {
//         await connectDemo();
//         router.replace('/(tabs)/feed');
//         return;
//       }

//       const params  = new URLSearchParams(url.slice(queryStart + 1));
//       const pk      = params.get('phantom_encryption_public_key');
//       const nonce   = params.get('nonce');
//       const data    = params.get('data');
//       const errCode = params.get('errorCode');

//       try {
//         if (errCode) { router.replace('/connect'); return; }
//         if (pk && nonce && data) {
//           await handlePhantomCallback({ phantom_encryption_public_key: pk, nonce, data });
//         } else {
//           await connectDemo();
//         }
//       } catch (e) {
//         await connectDemo();
//       }

//       router.replace('/(tabs)/feed');
//     })();
//   }, []);

//   return (
//     <View style={s.root}>
//       <ActivityIndicator size="large" color={C.purple} />
//       <Text style={s.title}>Connecting wallet...</Text>
//       <Text style={s.sub}>Returning from Phantom</Text>
//     </View>
//   );
// }

// const s = StyleSheet.create({
//   root:  { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: S.md },
//   title: { color: C.t1, fontSize: T.lg, fontWeight: '700' },
//   sub:   { color: C.t2, fontSize: T.sm },
// });