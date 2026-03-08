// import { C, S, T } from "@/constants/theme";
// import { useWallet } from "@/context/WalletContext";
// import * as Linking from "expo-linking";
// import { useLocalSearchParams, useRouter } from "expo-router";
// import React, { useEffect, useRef } from "react";
// import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

// export default function PhantomCallbackScreen() {
//   const router  = useRouter();
//   const params  = useLocalSearchParams<{
//     phantom_encryption_public_key?: string;
//     nonce?: string;
//     data?: string;
//     errorCode?: string;
//     errorMessage?: string;
//   }>();
//   const { handlePhantomCallback, connectDemo } = useWallet();
//   const handled = useRef(false);

//   useEffect(() => {
//     if (handled.current) return;
//     handled.current = true;

//     (async () => {
//       try {
//         // Also check the initial URL in case params weren't parsed by Expo Router
//         const initialUrl = await Linking.getInitialURL();
//         console.log("phantom.tsx params:", params);
//         console.log("phantom.tsx initialUrl:", initialUrl);

//         let pk    = params.phantom_encryption_public_key;
//         let nonce = params.nonce;
//         let data  = params.data;
//         let errCode = params.errorCode;

//         // Fallback: parse from raw URL if params are empty
//         if (!pk && initialUrl && initialUrl.includes("phantom")) {
//           const urlObj = new URL(initialUrl);
//           pk      = urlObj.searchParams.get("phantom_encryption_public_key") ?? undefined;
//           nonce   = urlObj.searchParams.get("nonce") ?? undefined;
//           data    = urlObj.searchParams.get("data") ?? undefined;
//           errCode = urlObj.searchParams.get("errorCode") ?? undefined;
//         }

//         if (errCode) {
//           console.warn("Phantom error:", errCode);
//           router.replace("/connect");
//           return;
//         }

//         if (pk && nonce && data) {
//           await handlePhantomCallback({
//             phantom_encryption_public_key: pk,
//             nonce,
//             data,
//           });
//         } else {
//           console.warn("No Phantom params found, using demo");
//           await connectDemo();
//         }
//       } catch (e) {
//         console.error("phantom.tsx error:", e);
//         await connectDemo();
//       }

//       router.replace("/(tabs)/feed");
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
//   root:  { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", gap: S.md },
//   title: { color: C.t1, fontSize: T.lg, fontWeight: "700" },
//   sub:   { color: C.t2, fontSize: T.sm },
// });