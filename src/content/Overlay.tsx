// src/content/Overlay.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { AvatarController } from '../speech-sign/AvatarController';
import { SpeechManager } from '../speech-sign/SpeechManager';
import { MeetCaptionCapture } from './Capture';
import { SignCapture } from './SignCapture';

// Speaking mode only — Listening Mode has been removed.
// MeetCaptionCapture now runs continuously from mount regardless of speaking state.
type AppMode = 'OFF' | 'SPEAKING';

// ── Design tokens — change these to retheme the entire extension ──────────────
const C = {
  blue:        'rgb(66, 133, 244)',          // primary accent (Google blue)
  blueDim:     'rgba(66, 133, 244, 0.12)',   // subtle blue tint for active panels
  blueBorder:  'rgba(66, 133, 244, 0.30)',   // border when active
  blueGlow:    '0 0 32px rgba(66, 133, 244, 0.45)',
  blueText:    'rgb(149, 190, 255)',          // softer blue for headings / labels
  bgPanel:     'rgba(12, 12, 14, 0.97)',
  bgCard:      'rgba(255, 255, 255, 0.04)',
  bgButton:    'rgba(255, 255, 255, 0.07)',
  border:      'rgba(255, 255, 255, 0.08)',
  borderStrong:'rgba(255, 255, 255, 0.13)',
  textPrimary: '#ffffff',
  textMuted:   'rgba(255, 255, 255, 0.45)',
  textCaption: 'rgba(255, 255, 255, 0.28)',
  shadow:      '0 16px 40px rgba(0, 0, 0, 0.85)',
};

// Avatar panel fixed dimensions (used for drag clamping and default positioning)
const AVATAR_W = 260;
const AVATAR_H = 320;

// Control panel dimensions (bottom-left) — used to compute a non-overlapping
// default avatar position.
// Control panel: left 30, bottom 30, width 320, height ~240 (estimated)
const CTRL_LEFT    = 30;
const CTRL_BOTTOM  = 30;
const CTRL_HEIGHT  = 250; // approximate rendered height
const CTRL_GAP     = 16;  // spacing between control panel top and avatar bottom

// Camera iframe dimensions (bottom-right) — SignCapture: right 20, bottom 20,
// width 320, height 240. Avatar must NOT overlap this region.
// Default avatar is on the LEFT side, so no overlap risk from x.

function getDefaultAvatarPos(): { x: number; y: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Place avatar above the control panel on the bottom-left.
  // bottom edge of avatar = CTRL_BOTTOM + CTRL_HEIGHT + CTRL_GAP
  // top  edge of avatar   = bottom edge - AVATAR_H  (in top-origin coords)
  const avatarBottomFromBottom = CTRL_BOTTOM + CTRL_HEIGHT + CTRL_GAP;
  const y = Math.max(8, vh - avatarBottomFromBottom - AVATAR_H);
  const x = Math.max(8, CTRL_LEFT);

  // Clamp so avatar never starts off-screen
  return {
    x: Math.min(vw - AVATAR_W - 8, x),
    y: Math.min(vh - AVATAR_H - 8, y),
  };
}

export const Overlay = () => {
  const [mode, setMode]               = useState<AppMode>('OFF');
  const [queue, setQueue]             = useState<string[]>([]);
  const [captionsText, setCaptionsText] = useState("Listening…");
  const [detectedSign, setDetectedSign] = useState("");
  const [voicePref, setVoicePref]     = useState('MALE');
  const [langPref, setLangPref]       = useState('en');
  const [currentSpeaker, setCurrentSpeaker] = useState<string>("");

  // ── Avatar drag state ────────────────────────────────────────────────────────
  const [avatarPos, setAvatarPos] = useState<{ x: number; y: number } | null>(null);
  const dragState = useRef({ active: false, startPx: 0, startPy: 0, origX: 0, origY: 0 });

  // ── Stable refs ──────────────────────────────────────────────────────────────
  const manager       = useRef(new SpeechManager((newQueue) => setQueue([...newQueue])));
  const signCaptureRef = useRef<SignCapture | null>(null);

  // ── Load persisted prefs on mount ────────────────────────────────────────────
  useEffect(() => {
    chrome.storage.local.get(
      ['signmeet_voice_pref', 'signmeet_lang_pref', 'signmeet_avatar_pos'],
      (result) => {
        if (result.signmeet_voice_pref) setVoicePref(result.signmeet_voice_pref as string);
        if (result.signmeet_lang_pref)  setLangPref(result.signmeet_lang_pref as string);

        if (result.signmeet_avatar_pos) {
          // Validate stored position is still within current viewport
          const stored = result.signmeet_avatar_pos as { x: number; y: number };
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          setAvatarPos({
            x: Math.max(0, Math.min(vw - AVATAR_W, stored.x)),
            y: Math.max(0, Math.min(vh - AVATAR_H, stored.y)),
          });
        } else {
          setAvatarPos(getDefaultAvatarPos());
        }
      }
    );
  }, []);

  // ── Persist voice/lang prefs on change ──────────────────────────────────────
  useEffect(() => {
    chrome.storage.local.set({ signmeet_voice_pref: voicePref });
  }, [voicePref]);

  useEffect(() => {
    chrome.storage.local.set({ signmeet_lang_pref: langPref });
  }, [langPref]);

  // ── ALWAYS-ON: Start caption capture on mount, stop on unmount ───────────────
  // This runs completely independently of Speaking Mode.
  useEffect(() => {
    const captureInstance = new MeetCaptionCapture((text, speaker) => {
      if (speaker !== undefined && speaker !== "") {
        setCurrentSpeaker(speaker);
      }
      if (text) {
        setCaptionsText(text);
        manager.current.processSentence(text);
      }
    });
    captureInstance.start();

    return () => {
      captureInstance.stop();
    };
  }, []); // empty dep-array = mount/unmount only

  // ── SPEAKING MODE: Start/stop sign capture on mode toggle ───────────────────
  useEffect(() => {
    if (mode !== 'SPEAKING') {
      setDetectedSign('');
      return;
    }

    let lastSpoken = '';

    const speakText = (text: string) => {
      if (!('speechSynthesis' in window)) return;

      const utterance = new SpeechSynthesisUtterance(text.toLowerCase());
      utterance.rate = 1;

      const pref = voicePref;
      const isFemale = pref === 'FEMALE';

      const voices = window.speechSynthesis.getVoices();

      if (voices.length > 0) {
        const exactFemale = voices.find(
          (v) => v.name.includes('Female') || v.name.includes('Zira') || v.name === 'Google US English'
        );
        const exactMale = voices.find((v) => v.name.includes('Male') || v.name.includes('David'));

        if (isFemale && exactFemale) {
          utterance.voice = exactFemale;
        } else if (!isFemale && exactMale) {
          utterance.voice = exactMale;
        } else {
          const enVoices = voices.filter((v) => v.lang.startsWith('en'));
          if (enVoices.length > 1) {
            utterance.voice = isFemale ? enVoices[1] : enVoices[0];
          }
        }
      }

      // Pitch-shift as a bulletproof fallback when only one voice is installed
      utterance.pitch = isFemale ? 1.6 : 1.0;
      window.speechSynthesis.speak(utterance);
    };

    const signCapture = new SignCapture((text) => {
      setDetectedSign(text);
      if (text && text !== lastSpoken) {
        speakText(text);
        lastSpoken = text;
      }
    });

    signCapture.start();
    signCapture.setVoicePref(voicePref);
    signCaptureRef.current = signCapture;

    return () => {
      signCapture.stop();
      signCaptureRef.current = null;
    };
  }, [mode]); // voicePref intentionally omitted — setVoicePref below handles live updates

  // Push voicePref updates into an active SignCapture without restarting it
  useEffect(() => {
    if (signCaptureRef.current) {
      signCaptureRef.current.setVoicePref(voicePref);
    }
  }, [voicePref]);

  // ── Test avatar without any mode requirement ─────────────────────────────────
  const handleTestAvatar = useCallback(() => {
    setQueue([]);
    setTimeout(() => {
      manager.current.processSentence('hello cool good alright');
    }, 100);
  }, []);

  const handleChildConsumed = useCallback(() => {
    setQueue([]);
  }, []);

  // ── Drag handlers (pointer events, no unnecessary re-renders during drag) ────
  const handleDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = avatarPos ?? getDefaultAvatarPos();
    dragState.current = {
      active: true,
      startPx: e.clientX,
      startPy: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
  }, [avatarPos]);

  const handleDragMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.active) return;
    const dx = e.clientX - dragState.current.startPx;
    const dy = e.clientY - dragState.current.startPy;
    const x = Math.max(0, Math.min(window.innerWidth  - AVATAR_W, dragState.current.origX + dx));
    const y = Math.max(0, Math.min(window.innerHeight - AVATAR_H, dragState.current.origY + dy));
    setAvatarPos({ x, y });
  }, []);

  const handleDragEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.active) return;
    dragState.current.active = false;
    // Persist the final position
    setAvatarPos((current) => {
      if (current) {
        chrome.storage.local.set({ signmeet_avatar_pos: current });
      }
      return current;
    });
  }, []);

  // ── Reusable style helpers ────────────────────────────────────────────────────
  const modeBtn = (active: boolean) => ({
    flex: 1,
    padding: '11px 8px',
    borderRadius: '8px',
    background:  active ? C.blue      : C.bgButton,
    color:       active ? '#fff'       : C.textMuted,
    border:      `1px solid ${active ? C.blueBorder : C.border}`,
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 'bold' as const,
    letterSpacing: '0.4px',
    transition: 'all 0.2s ease',
    boxShadow: active ? `0 2px 14px rgba(66,133,244,0.4)` : 'none',
  });

  const infoPanel = {
    background: C.blueDim,
    padding: '12px',
    borderRadius: '10px',
    border: `1px solid ${C.blueBorder}`,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  };

  // Don't render avatar panel until position is resolved (avoids flash at 0,0)
  const avatarReady = avatarPos !== null;

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 999999 }}>

      {/* ── DRAGGABLE AVATAR PANEL ── */}
      {avatarReady && (
        <div style={{
          position: 'absolute',
          left: avatarPos!.x,
          top:  avatarPos!.y,
          width: AVATAR_W,
          height: AVATAR_H,
          background: C.bgCard,
          borderRadius: '20px',
          border: `1px solid ${C.border}`,
          backdropFilter: 'blur(8px)',
          pointerEvents: 'auto',
          boxShadow: C.blueGlow,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>

          {/* Drag Handle — the header bar with Speaker Identification */}
          <div
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
            style={{
              height: '38px',
              flexShrink: 0,
              background: 'rgba(66, 133, 244, 0.12)',
              borderBottom: `1px solid ${C.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 12px',
              cursor: 'grab',
              userSelect: 'none',
              touchAction: 'none',
            }}
          >
            {/* Speaker identification badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              minWidth: 0,
              flex: 1,
              marginRight: '8px',
            }}>
              <span style={{
                display: 'inline-block',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: currentSpeaker ? '#34A853' : C.blue,
                boxShadow: currentSpeaker ? '0 0 8px #34A853' : 'none',
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: '11px',
                fontWeight: 'bold',
                color: C.textPrimary,
                letterSpacing: '0.2px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                Speaking: {currentSpeaker || 'Unknown'}
              </span>
            </div>

            {/* ISL Avatar tag */}
            <span style={{
              fontSize: '9px',
              fontWeight: 'bold',
              color: C.blueText,
              letterSpacing: '0.8px',
              background: C.blueDim,
              border: `1px solid ${C.blueBorder}`,
              padding: '2px 6px',
              borderRadius: '4px',
              flexShrink: 0,
            }}>
              ISL
            </span>
          </div>

          {/* 3D Canvas fills remaining height */}
          <div style={{ flex: 1, position: 'relative' }}>
            <Canvas camera={{ position: [0, 0.2, 1.5], fov: 40 }} gl={{ alpha: true }}>
              <ambientLight intensity={1.5} />
              <pointLight position={[5, 5, 5]} intensity={1} />
              <AvatarController
                queue={queue}
                onAnimationFinished={handleChildConsumed}
              />
            </Canvas>

            {/* Live caption snippet overlaid at bottom of avatar container */}
            {captionsText && captionsText !== "Listening…" && (
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '4px 8px',
                background: 'rgba(0, 0, 0, 0.70)',
                borderTop: `1px solid ${C.border}`,
                fontSize: '10px',
                color: C.textMuted,
                fontStyle: 'italic',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textAlign: 'center',
                pointerEvents: 'none',
              }}>
                "{captionsText}"
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SIGN DETECTED OVERLAY (Top Center, Speaking Mode only) ── */}
      {detectedSign && mode === 'SPEAKING' && (
        <div style={{
          position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.88)', padding: '15px 40px', borderRadius: '40px',
          color: C.blue, fontSize: '32px', fontWeight: 'bold',
          border: `3px solid ${C.blue}`, backdropFilter: 'blur(10px)',
          boxShadow: C.blueGlow,
          pointerEvents: 'none', letterSpacing: '2px',
        }}>
          ✋ {detectedSign}
        </div>
      )}

      {/* ── CONTROL PANEL (bottom-left) ── */}
      <div style={{
        position: 'absolute', bottom: '30px', left: '30px', pointerEvents: 'auto',
        background: C.bgPanel, color: C.textPrimary, padding: '18px',
        borderRadius: '16px', border: `1px solid ${C.borderStrong}`, width: '320px',
        fontFamily: 'system-ui, sans-serif', boxShadow: C.shadow,
        display: 'flex', flexDirection: 'column', gap: '14px',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `1px solid ${C.border}`, paddingBottom: '12px',
        }}>
          <span style={{
            fontSize: '15px', fontWeight: 'bold', color: C.blueText,
            textTransform: 'uppercase', letterSpacing: '1.5px',
          }}>
            SignMeet
          </span>
          <div style={{
            fontSize: '10px', padding: '3px 9px', borderRadius: '4px',
            background: mode === 'SPEAKING' ? C.blueDim  : C.bgButton,
            color:      mode === 'SPEAKING' ? C.blue      : C.textMuted,
            border:     `1px solid ${mode === 'SPEAKING' ? C.blueBorder : C.border}`,
            fontWeight: 'bold', letterSpacing: '0.5px',
          }}>
            {mode === 'SPEAKING' ? 'SPEAKING' : 'IDLE'}
          </div>
        </div>

        {/* Single Speaking Mode toggle */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setMode(mode === 'SPEAKING' ? 'OFF' : 'SPEAKING')}
            style={modeBtn(mode === 'SPEAKING')}
          >
            {mode === 'SPEAKING' ? '⏹ Stop Speaking' : '▶ Speaking Mode'}
          </button>
        </div>

        {/* Voice & Language Preference Row */}
        <div style={{ display: 'flex', gap: '8px' }}>

          {/* Voice Dropdown */}
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: C.bgButton, padding: '10px 12px', borderRadius: '8px', border: `1px solid ${C.border}`
          }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: C.textPrimary }}>🎙 Voice:</span>
            <select
              value={voicePref}
              onChange={(e) => {
                const val = e.target.value;
                setVoicePref(val);
                chrome.storage.local.set({ signmeet_voice_pref: val });
              }}
              style={{
                background: 'transparent', color: C.blueText, border: 'none', outline: 'none',
                fontSize: '11px', fontWeight: 'bold', cursor: 'pointer'
              }}
            >
              <option value="MALE"   style={{ background: '#222' }}>Male</option>
              <option value="FEMALE" style={{ background: '#222' }}>Female</option>
            </select>
          </div>

          {/* Language Dropdown */}
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: C.bgButton, padding: '10px 12px', borderRadius: '8px', border: `1px solid ${C.border}`
          }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: C.textPrimary }}>🌐 Lang:</span>
            <select
              value={langPref}
              onChange={(e) => {
                const val = e.target.value;
                setLangPref(val);
                chrome.storage.local.set({ signmeet_lang_pref: val });
              }}
              style={{
                background: 'transparent', color: C.blueText, border: 'none', outline: 'none',
                fontSize: '11px', fontWeight: 'bold', cursor: 'pointer'
              }}
            >
              <option value="en" style={{ background: '#222' }}>English</option>
              <option value="hi" style={{ background: '#222' }}>Hindi</option>
              <option value="ta" style={{ background: '#222' }}>Tamil</option>
            </select>
          </div>

        </div>

        {/* Speaking Mode Panel */}
        {mode === 'SPEAKING' && (
          <div style={infoPanel}>
            <div style={{ fontSize: '11px', color: C.textMuted }}>
              Capturing signs from camera…
            </div>
            <div style={{ fontSize: '11px', color: C.blueText, fontStyle: 'italic' }}>
              {detectedSign || 'Waiting for signs…'}
            </div>
          </div>
        )}

        {/* Always-on caption + avatar demo section */}
        <div style={infoPanel}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '11px', color: C.textMuted }}>📡 Meet Captions</span>
            <span style={{
              fontSize: '9px', padding: '2px 7px', borderRadius: '4px',
              background: C.blueDim, color: C.blue, border: `1px solid ${C.blueBorder}`,
              fontWeight: 'bold',
            }}>LIVE</span>
          </div>
          <div style={{
            fontSize: '11px', color: C.blueText, fontStyle: 'italic',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {currentSpeaker ? `[${currentSpeaker}] ` : ''}{captionsText.length > 30 ? captionsText.substring(0, 30) + '…' : captionsText}
          </div>
          <button
            onClick={handleTestAvatar}
            style={{
              width: '100%', padding: '9px', borderRadius: '6px', cursor: 'pointer',
              fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.4px',
              background: C.blue, color: '#fff', border: 'none',
              boxShadow: `0 2px 10px rgba(66,133,244,0.35)`,
              transition: 'opacity 0.2s',
            }}
          >
            ▶ Run Avatar Demo
          </button>
        </div>

        {/* Idle hint */}
        {mode === 'OFF' && (
          <div style={{ textAlign: 'center', padding: '4px', color: C.textCaption, fontSize: '11px' }}>
            Start Speaking Mode to sign to your participants.
          </div>
        )}

      </div>
    </div>
  );
};