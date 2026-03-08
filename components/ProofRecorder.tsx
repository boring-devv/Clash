/**
 * components/ProofRecorder.tsx
 * ─────────────────────────────────────────────────────────────────
 * Camera-only video recorder. No file picker.
 * Used in:
 *   - create-challenge.tsx (creator records their proof at creation)
 *   - join/[id].tsx (participant records proof when joining)
 *
 * Props:
 *   onVideoRecorded(uri) — called when user confirms their recording
 *   onCancel()           — called when user backs out
 *   maxDuration          — seconds, default 60
 *   title                — shown at top, e.g. "Record Your Proof"
 *   subtitle             — shown below title
 * ─────────────────────────────────────────────────────────────────
 */

import { C, R, S, T } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SW, height: SH } = Dimensions.get('window');

type RecorderState = 'permission' | 'ready' | 'recording' | 'preview' | 'uploading';

interface Props {
  onVideoRecorded: (uri: string) => void;
  onCancel:        () => void;
  maxDuration?:    number;
  title?:          string;
  subtitle?:       string;
}

export function ProofRecorder({
  onVideoRecorded,
  onCancel,
  maxDuration = 60,
  title    = 'Record Your Proof',
  subtitle = 'Show yourself completing the challenge. Max 60 seconds.',
}: Props) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission,    requestMicPermission]    = useMicrophonePermissions();

  const [state,     setState]     = useState<RecorderState>('permission');
  const [videoUri,  setVideoUri]  = useState<string | null>(null);
  const [elapsed,   setElapsed]   = useState(0);
  const [facing,    setFacing]    = useState<'front' | 'back'>('front');

  const cameraRef    = useRef<CameraView>(null);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const fadeAnim     = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // ── Permissions ────────────────────────────────────────────────
  useEffect(() => {
    checkPermissions();
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const checkPermissions = async () => {
    if (cameraPermission?.granted && micPermission?.granted) {
      setState('ready');
      return;
    }
    // Don't auto-request — show UI first
  };

  const requestPermissions = async () => {
    const cam = await requestCameraPermission();
    const mic = await requestMicPermission();
    if (cam.granted && mic.granted) {
      setState('ready');
    } else {
      Alert.alert(
        'Permissions Required',
        'Camera and microphone access is needed to record your proof.',
        [{ text: 'OK' }]
      );
    }
  };

  useEffect(() => {
    if (cameraPermission?.granted && micPermission?.granted && state === 'permission') {
      setState('ready');
    }
  }, [cameraPermission, micPermission]);

  // ── Recording timer ────────────────────────────────────────────
  const startTimer = () => {
    setElapsed(0);
    progressAnim.setValue(0);

    // Animate progress bar
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: maxDuration * 1000,
      useNativeDriver: false,
    }).start();

    timerRef.current = setInterval(() => {
      setElapsed(prev => {
        if (prev + 1 >= maxDuration) {
          stopRecording();
          return maxDuration;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    progressAnim.stopAnimation();
  };

  useEffect(() => () => stopTimer(), []);

  // ── Pulse animation while recording ───────────────────────────
  useEffect(() => {
    if (state === 'recording') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state]);

  // ── Start recording ────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!cameraRef.current || state !== 'ready') return;
    try {
      setState('recording');
      startTimer();
      const video = await cameraRef.current.recordAsync({
        maxDuration,
      });
      if (video?.uri) {
        setVideoUri(video.uri);
        setState('preview');
      }
    } catch (e: any) {
      console.error('Record error:', e);
      setState('ready');
      stopTimer();
    }
  }, [state, maxDuration]);

  // ── Stop recording ─────────────────────────────────────────────
  const stopRecording = useCallback(async () => {
    if (state !== 'recording') return;
    stopTimer();
    try {
      await cameraRef.current?.stopRecording();
      // State transitions to 'preview' via recordAsync resolution above
    } catch (e) {
      console.error('Stop error:', e);
      setState('ready');
    }
  }, [state]);

  // ── Confirm ────────────────────────────────────────────────────
  const confirmVideo = () => {
    if (videoUri) onVideoRecorded(videoUri);
  };

  // ── Retake ─────────────────────────────────────────────────────
  const retake = () => {
    setVideoUri(null);
    setElapsed(0);
    progressAnim.setValue(0);
    setState('ready');
  };

  const timeStr = `${Math.floor(elapsed / 60).toString().padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`;
  const maxStr  = `${Math.floor(maxDuration / 60).toString().padStart(2, '0')}:${(maxDuration % 60).toString().padStart(2, '0')}`;

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // ── Permission screen ──────────────────────────────────────────
  if (state === 'permission') {
    return (
      <Animated.View style={[s.root, { opacity: fadeAnim }]}>
        <SafeAreaView style={s.permWrap}>
          <TouchableOpacity onPress={onCancel} style={s.closeBtn}>
            <Ionicons name="close" size={24} color={C.t2} />
          </TouchableOpacity>
          <View style={s.permContent}>
            <LinearGradient colors={C.gPurple} style={s.permIcon}>
              <Text style={{ fontSize: 44 }}>📹</Text>
            </LinearGradient>
            <Text style={s.permTitle}>Camera Access Needed</Text>
            <Text style={s.permSub}>
              CLASH needs your camera and microphone to record proof videos. Your video is stored securely and only shown to community voters.
            </Text>
            <TouchableOpacity onPress={requestPermissions} style={s.permBtn}>
              <LinearGradient colors={C.gPurple} style={s.permBtnGrad}>
                <Text style={s.permBtnTxt}>ALLOW CAMERA ACCESS</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={onCancel} style={s.permCancelBtn}>
              <Text style={s.permCancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>
    );
  }

  // ── Preview screen ─────────────────────────────────────────────
  if (state === 'preview' && videoUri) {
    return (
      <Animated.View style={[s.root, { opacity: fadeAnim }]}>
        <SafeAreaView style={s.previewWrap}>
          {/* Header */}
          <View style={s.previewHeader}>
            <TouchableOpacity onPress={retake} style={s.retakeBtn}>
              <Ionicons name="refresh" size={18} color={C.t2} />
              <Text style={s.retakeTxt}>Retake</Text>
            </TouchableOpacity>
            <Text style={s.previewTitle}>REVIEW PROOF</Text>
            <View style={{ width: 70 }} />
          </View>

          {/* Video preview */}
          <View style={s.videoPreviewWrap}>
            <Video
              source={{ uri: videoUri }}
              style={s.videoPreview}
              resizeMode={ResizeMode.COVER}
              useNativeControls
              isLooping
              shouldPlay
            />
            <View style={s.videoDurationBadge}>
              <Text style={s.videoDurationTxt}>{timeStr}</Text>
            </View>
          </View>

          {/* Tips */}
          <View style={s.previewTips}>
            <Text style={s.previewTipsTitle}>Before you submit:</Text>
            <Text style={s.previewTip}>• Is the challenge clearly visible?</Text>
            <Text style={s.previewTip}>• Can you be seen and identified?</Text>
            <Text style={s.previewTip}>• Is the audio/video quality good?</Text>
          </View>

          {/* Actions */}
          <View style={s.previewActions}>
            <TouchableOpacity onPress={retake} style={s.retakeFullBtn}>
              <Text style={s.retakeFullTxt}>🔄 Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmVideo} style={s.confirmBtn}>
              <LinearGradient colors={C.gPurple} style={s.confirmBtnGrad}>
                <Text style={s.confirmBtnTxt}>✅ USE THIS TAKE</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>
    );
  }

  // ── Camera screen (ready + recording) ─────────────────────────
  return (
    <Animated.View style={[s.root, { opacity: fadeAnim }]}>
      {/* Header overlay */}
      <SafeAreaView style={s.cameraHeaderWrap} edges={['top']}>
        <View style={s.cameraHeader}>
          <TouchableOpacity onPress={onCancel} style={s.closeBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={s.headerTextWrap}>
            <Text style={s.cameraTitle}>{title}</Text>
            {state === 'ready' && (
              <Text style={s.cameraSubtitle}>{subtitle}</Text>
            )}
            {state === 'recording' && (
              <View style={s.recordingBadge}>
                <Animated.View style={[s.recDot, { transform: [{ scale: pulseAnim }] }]} />
                <Text style={s.recTxt}>REC  {timeStr} / {maxStr}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setFacing(f => f === 'front' ? 'back' : 'front')}
            style={s.flipBtn}
          >
            <Ionicons name="camera-reverse" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        {state === 'recording' && (
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressFill, { width: progressWidth }]} />
          </View>
        )}
      </SafeAreaView>

      {/* Camera */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode="video"
      />

      {/* Record button overlay */}
      <View style={s.controlsOverlay}>
        {state === 'ready' && (
          <View style={s.readyHint}>
            <Text style={s.readyHintTxt}>Tap the button to start recording</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={state === 'ready' ? startRecording : stopRecording}
          activeOpacity={0.85}
          style={s.recordBtnWrap}
        >
          {state === 'ready' ? (
            <View style={s.recordBtnOuter}>
              <LinearGradient colors={['#EF4444', '#DC2626']} style={s.recordBtnInner}>
                <View style={s.recordBtnDot} />
              </LinearGradient>
            </View>
          ) : (
            <View style={s.recordBtnOuter}>
              <View style={[s.recordBtnInner, s.stopBtnInner]}>
                <View style={s.stopBtnSquare} />
              </View>
            </View>
          )}
        </TouchableOpacity>

        <Text style={s.recordBtnLabel}>
          {state === 'ready' ? 'TAP TO RECORD' : 'TAP TO STOP'}
        </Text>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  // ── Permission ────────────────────────────────────────────────
  permWrap:    { flex: 1, backgroundColor: C.bg },
  permContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.lg, gap: S.lg },
  permIcon:    { width: 110, height: 110, borderRadius: 55, alignItems: 'center', justifyContent: 'center', marginBottom: S.sm },
  permTitle:   { color: C.t1, fontSize: T['2xl'], fontWeight: '900', textAlign: 'center' },
  permSub:     { color: C.t2, fontSize: T.base, textAlign: 'center', lineHeight: 22 },
  permBtn:         { width: '100%', borderRadius: R['2xl'], overflow: 'hidden' },
  permBtnGrad:     { paddingVertical: S.lg, alignItems: 'center' },
  permBtnTxt:      { color: '#fff', fontSize: T.base, fontWeight: '900', letterSpacing: 1 },
  permCancelBtn:   { paddingVertical: S.sm },
  permCancelTxt:   { color: C.t3, fontSize: T.sm },

  // ── Preview ───────────────────────────────────────────────────
  previewWrap:       { flex: 1, backgroundColor: C.bg },
  previewHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: S.lg },
  previewTitle:      { color: C.t1, fontSize: T.base, fontWeight: '900', letterSpacing: 2 },
  retakeBtn:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: R.full, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgCard },
  retakeTxt:         { color: C.t2, fontSize: T.sm, fontWeight: '700' },
  videoPreviewWrap:  { flex: 1, margin: S.lg, borderRadius: R['2xl'], overflow: 'hidden', borderWidth: 1, borderColor: C.purple },
  videoPreview:      { flex: 1 },
  videoDurationBadge:{ position: 'absolute', top: S.sm, right: S.sm, backgroundColor: '#000000AA', borderRadius: R.full, paddingHorizontal: 10, paddingVertical: 4 },
  videoDurationTxt:  { color: '#fff', fontSize: T.xs, fontWeight: '800', fontFamily: 'monospace' },
  previewTips:       { margin: S.lg, marginTop: 0, backgroundColor: C.bgCard, borderRadius: R.xl, padding: S.md, gap: 5, borderWidth: 1, borderColor: C.border },
  previewTipsTitle:  { color: C.t1, fontSize: T.sm, fontWeight: '800', marginBottom: 4 },
  previewTip:        { color: C.t2, fontSize: T.sm },
  previewActions:    { flexDirection: 'row', gap: S.md, padding: S.lg, paddingTop: 0 },
  retakeFullBtn:     { flex: 1, paddingVertical: S.md, borderRadius: R.xl, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  retakeFullTxt:     { color: C.t2, fontSize: T.base, fontWeight: '800' },
  confirmBtn:        { flex: 2, borderRadius: R.xl, overflow: 'hidden' },
  confirmBtnGrad:    { paddingVertical: S.md, alignItems: 'center' },
  confirmBtnTxt:     { color: '#fff', fontSize: T.base, fontWeight: '900', letterSpacing: 0.5 },

  // ── Camera header ─────────────────────────────────────────────
  cameraHeaderWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  cameraHeader:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: S.lg },
  headerTextWrap:   { flex: 1, alignItems: 'center', paddingHorizontal: S.sm },
  cameraTitle:      { color: '#fff', fontSize: T.base, fontWeight: '900', letterSpacing: 1, textShadowColor: '#000', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
  cameraSubtitle:   { color: 'rgba(255,255,255,0.7)', fontSize: T.xs, textAlign: 'center', marginTop: 3, textShadowColor: '#000', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },

  recordingBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: R.full, paddingHorizontal: 10, paddingVertical: 5, marginTop: 4 },
  recDot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  recTxt:         { color: '#fff', fontSize: T.xs, fontWeight: '900', letterSpacing: 1, fontFamily: 'monospace' },

  closeBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  flipBtn:  { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },

  progressTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: S.lg, borderRadius: 2, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: '#EF4444', borderRadius: 2 },

  // ── Controls ──────────────────────────────────────────────────
  controlsOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 50, alignItems: 'center', gap: S.sm },
  readyHint:       { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: R.full, paddingHorizontal: S.lg, paddingVertical: S.sm },
  readyHintTxt:    { color: 'rgba(255,255,255,0.8)', fontSize: T.sm },

  recordBtnWrap:   { alignItems: 'center', justifyContent: 'center' },
  recordBtnOuter:  { width: 84, height: 84, borderRadius: 42, borderWidth: 4, borderColor: 'rgba(255,255,255,0.6)', padding: 4, alignItems: 'center', justifyContent: 'center' },
  recordBtnInner:  { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  recordBtnDot:    { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff' },
  stopBtnInner:    { backgroundColor: '#EF4444' },
  stopBtnSquare:   { width: 26, height: 26, borderRadius: 5, backgroundColor: '#fff' },
  recordBtnLabel:  { color: 'rgba(255,255,255,0.8)', fontSize: T.xs, fontWeight: '900', letterSpacing: 2, textShadowColor: '#000', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
});