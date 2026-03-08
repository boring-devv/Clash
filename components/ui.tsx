import { C, R, S, T } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import {
    ActivityIndicator,
    Animated,
    StyleSheet,
    Text, TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';

// ─── GlowButton ──────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';
type BtnSize = 'sm' | 'md' | 'lg';

export function Btn({
  label, onPress, variant = 'primary', size = 'md',
  loading, disabled, style, fullWidth, icon,
}: {
  label: string; onPress: () => void; variant?: BtnVariant; size?: BtnSize;
  loading?: boolean; disabled?: boolean; style?: ViewStyle;
  fullWidth?: boolean; icon?: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 60 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 60 }).start();

  const heights: Record<BtnSize, number> = { sm: 36, md: 46, lg: 54 };
  const sizes:   Record<BtnSize, number> = { sm: T.sm, md: T.md, lg: T.lg };
  const isOff = disabled || loading;

  const inner = (
    <View style={[s.btnInner, { height: heights[size] }, isOff && { opacity: 0.45 }]}>
      {loading
        ? <ActivityIndicator color="#fff" size="small" />
        : <>{icon}<Text style={[s.btnLabel, { fontSize: sizes[size] }, variant === 'ghost' && { color: C.purple }]}>{label}</Text></>
      }
    </View>
  );

  return (
    <Animated.View style={[fullWidth && { width: '100%' }, { transform: [{ scale }] }, style]}>
      <TouchableOpacity onPressIn={onIn} onPressOut={onOut} onPress={onPress} disabled={isOff} activeOpacity={1}>
        {variant === 'primary' ? (
          <LinearGradient colors={C.gPurple} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[s.btn, { shadowColor: C.purple, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 }]}>
            {inner}
          </LinearGradient>
        ) : variant === 'gold' ? (
          <LinearGradient colors={C.gGold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btn}>
            {inner}
          </LinearGradient>
        ) : (
          <View style={[
            s.btn,
            variant === 'secondary' && { backgroundColor: C.bgElevated, borderWidth: 1, borderColor: C.border },
            variant === 'ghost' && { backgroundColor: C.purpleDim, borderWidth: 1, borderColor: C.purple + '50' },
            variant === 'danger' && { backgroundColor: C.red },
          ]}>
            {inner}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Card ────────────────────────────────────────────────────────
export function Card({ children, style, glow }: { children: React.ReactNode; style?: ViewStyle; glow?: boolean }) {
  return (
    <View style={[s.card, glow && { borderColor: C.purple + '60', shadowColor: C.purple, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6 }, style]}>
      {children}
    </View>
  );
}

// ─── WalletAvatar ────────────────────────────────────────────────
export function WalletAvatar({ pubkey, size = 40, username }: { pubkey?: string | null; size?: number; username?: string }) {
  const seed   = pubkey || username || '?';
  const hue    = (seed.charCodeAt(0) * 31 + seed.charCodeAt(1) * 17) % 360;
  const satL   = `hsl(${hue},65%,38%)`;
  const initials = username ? username.slice(0, 2).toUpperCase() : (pubkey ? pubkey.slice(0, 2).toUpperCase() : '??');

  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: satL }]}>
      <Text style={[s.avatarText, { fontSize: size * 0.32 }]}>{initials}</Text>
    </View>
  );
}

// ─── StatusPill ──────────────────────────────────────────────────
import { STATUS_META } from '@/constants/theme';

export function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] || { label: status.toUpperCase(), color: C.t3 };
  return (
    <View style={[s.pill, { borderColor: meta.color + '55', backgroundColor: meta.color + '18' }]}>
      <View style={[s.dot, { backgroundColor: meta.color }]} />
      <Text style={[s.pillLabel, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

// ─── CategoryPill ────────────────────────────────────────────────
import { CAT_COLORS, CAT_ICONS } from '@/constants/theme';

export function CatPill({ category }: { category: string }) {
  const color = CAT_COLORS[category] || C.purple;
  const icon  = CAT_ICONS[category]  || '⚡';
  return (
    <View style={[s.pill, { borderColor: color + '55', backgroundColor: color + '18' }]}>
      <Text style={{ fontSize: 11 }}>{icon}</Text>
      <Text style={[s.pillLabel, { color }]}>{category.toUpperCase()}</Text>
    </View>
  );
}

// ─── SectionHeader ───────────────────────────────────────────────
export function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {sub && <Text style={s.sectionSub}>{sub}</Text>}
    </View>
  );
}

// ─── EmptyState ──────────────────────────────────────────────────
export function Empty({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyIcon}>{icon}</Text>
      <Text style={s.emptyTitle}>{title}</Text>
      {sub && <Text style={s.emptySub}>{sub}</Text>}
    </View>
  );
}

// ─── Divider ─────────────────────────────────────────────────────
export function Divider({ label }: { label?: string }) {
  if (!label) return <View style={{ height: 1, backgroundColor: C.border, marginVertical: S.md }} />;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginVertical: S.md }}>
      <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
      <Text style={{ color: C.t3, fontSize: T.xs, fontWeight: '700', letterSpacing: 1 }}>{label}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
    </View>
  );
}

// ─── Shine animated card ─────────────────────────────────────────
export function ShineCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  return <Animated.View style={[{ opacity }, style]}>{children}</Animated.View>;
}

// ─── Styles ──────────────────────────────────────────────────────
const s = StyleSheet.create({
  btn:        { borderRadius: R.lg, overflow: 'hidden' },
  btnInner:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: S.lg },
  btnLabel:   { color: C.t1, fontWeight: '800', letterSpacing: 0.4 },
  card: {
    backgroundColor: C.bgCard, borderRadius: R['2xl'],
    borderWidth: 1, borderColor: C.border, padding: S.md,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, elevation: 3,
  },
  avatar:     { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.purple + '50' },
  avatarText: { color: '#fff', fontWeight: '900' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: R.full, borderWidth: 1,
  },
  dot:       { width: 5, height: 5, borderRadius: 3 },
  pillLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  sectionHeader: { paddingHorizontal: S.lg, paddingBottom: S.sm, gap: 2 },
  sectionTitle:  { color: C.t1, fontSize: T['2xl'], fontWeight: '900', letterSpacing: 1 },
  sectionSub:    { color: C.t2, fontSize: T.sm },
  empty:    { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: S.sm },
  emptyIcon:  { fontSize: 52 },
  emptyTitle: { color: C.t1, fontSize: T.xl, fontWeight: '800', textAlign: 'center' },
  emptySub:   { color: C.t2, fontSize: T.base, textAlign: 'center', maxWidth: 240 },
});
