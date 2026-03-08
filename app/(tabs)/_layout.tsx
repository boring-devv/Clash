import { C, R, S } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';

type IonName = keyof typeof Ionicons.glyphMap;

function TabIcon({ name, focused, label }: { name: IonName; focused: boolean; label: string }) {
  return (
    <View style={[styles.tabItem, focused && styles.tabItemActive]}>
      {focused && <View style={styles.activeGlow} />}
      <View style={styles.iconContainer}>
        <Ionicons
          name={focused ? name : (`${name}-outline` as IonName)}
          size={21}
          color={focused ? C.purple : C.t3}
        />
      </View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
      {focused && <View style={styles.activeDot} />}
    </View>
  );
}

function CreateIcon() {
  return (
    <View style={styles.createWrap}>
      <View style={styles.createHalo} />
      <LinearGradient
        colors={C.gPurple}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.createBtn}
      >
        <View style={styles.createInner}>
          <Ionicons name="add" size={28} color="#fff" />
        </View>
      </LinearGradient>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.bar,
        tabBarBackground: () => (
          <>
            {Platform.OS === 'ios'
              ? <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill} />
              : <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bgCard }]} />
            }
            <LinearGradient
              colors={['transparent', C.purple + '50', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.topGlowLine}
            />
          </>
        ),
        tabBarItemStyle: { paddingVertical: 4 },
        tabBarActiveTintColor: C.purple,
        tabBarInactiveTintColor: C.t3,
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{ tabBarIcon: ({ focused }) => <TabIcon name="flame" focused={focused} label="ARENA" /> }}
      />
      <Tabs.Screen
        name="explore"
        options={{ tabBarIcon: ({ focused }) => <TabIcon name="compass" focused={focused} label="EXPLORE" /> }}
      />
      <Tabs.Screen
        name="create-tab"
        options={{ tabBarIcon: () => <CreateIcon /> }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{ tabBarIcon: ({ focused }) => <TabIcon name="trophy" focused={focused} label="RANKS" /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} label="ME" /> }}
      />
      <Tabs.Screen name="vote"    options={{ href: null }} />
      <Tabs.Screen name="results" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    height: Platform.OS === 'ios' ? 86 : 68,
    paddingBottom: Platform.OS === 'ios' ? 26 : 8,
    borderTopWidth: 0,
    elevation: 0,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    bottom: Platform.OS === 'ios' ? 24 : 20,
    borderTopLeftRadius: R['2xl'],
    borderTopRightRadius: R['2xl'],
  },

  // Glowing purple gradient line at very top of bar
  topGlowLine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
  },

  // Tab item
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: S.xs,
    paddingVertical: 5,
    gap: 3,
    borderRadius: R.xl,
    minWidth: 56,
    flex: 1,
    overflow: 'visible',
    position: 'relative',
  },
  tabItemActive: {
    backgroundColor: 'transparent',
  },

  // Icon container for centering
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
  },

  // Radial soft glow behind active icon
  activeGlow: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -34,
    marginLeft: -27,
    width: 60,
    height: 60,
    backgroundColor: C.purple,
    opacity: 0.15,
    borderRadius: 30,
  },

  tabLabel: {
    color: C.t3,
    fontSize: Platform.OS === 'ios' ? 9 : 8,
    fontWeight: '800',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: C.purple,
  },

  // Tiny indicator dot below active label
  activeDot: {
    position: 'absolute',
    bottom: 2,
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: C.purple,
  },

  // Create button — floats up above the bar
  createWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
    flex: 1,
    marginBottom: Platform.OS === 'ios' ? 16 : 10,
  },
  createHalo: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: C.purple,
    opacity: 0.20,
    zIndex: 0,
  },
  createBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.purple,
    shadowOpacity: 0.75,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    elevation: 14,
    zIndex: 1,
  },
  // Inner highlight border for depth
  createInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
});