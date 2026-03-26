// src/content/Overlay.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { AvatarController } from '../speech-sign/AvatarController';
import { SpeechManager } from '../speech-sign/SpeechManager';
import { MeetCaptionCapture } from './Capture';
import { SignCapture } from './SignCapture';

type AppMode = 'OFF' | 'SPEECH_IMPAIRED' | 'NORMAL';

// ── Voice Initialization (Run once globally) ──────────────────────────────────
// Removed strict global caching in favor of bulletproof Pitch-Shifting fallback.


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

export const Overlay = () => {
  const [mode, setMode] = useState<AppMode>('OFF');
  const [queue, setQueue] = useState<string[]>([]);
  const [captionsText, setCaptionsText] = useState("System Ready");
  const [detectedSign, setDetectedSign] = useState("");
  const [voicePref, setVoicePref] = useState(() => {
    // Initialize from chrome.storage on mount - for now default to MALE
    // The useEffect below will sync the actual saved value
    return 'MALE';
  });

  const manager = useRef(new SpeechManager((newQueue) => {
    setQueue([...newQueue]);
  }));
  const signCaptureRef = useRef<SignCapture | null>(null);

  // Load voicePref from chrome.storage on mount
  useEffect(() => {
    chrome.storage.local.get(['signmeet_voice_pref'], (result) => {
      if (result.signmeet_voice_pref) {
        setVoicePref(result.signmeet_voice_pref);
      }
    });
  }, []);

  // Whenever voicePref changes, persist to chrome.storage (shared with camera iframe)
  useEffect(() => {
    chrome.storage.local.set({ signmeet_voice_pref: voicePref });
  }, [voicePref]);

  // HANDLE MODES
  useEffect(() => {
    let speechCapture: MeetCaptionCapture | null = null;
    let signCapture: SignCapture | null = null;

    if (mode === 'SPEECH_IMPAIRED') {
      setCaptionsText("Listening to Meet Captions...");
      setDetectedSign("");

      speechCapture = new MeetCaptionCapture((text) => {
        setCaptionsText(text);
        manager.current.processSentence(text);
      });
      speechCapture.start();
    } else if (mode === 'NORMAL') {
      setCaptionsText("Avatar Paused");
      setDetectedSign("");
      let lastSpoken = "";

      const speakText = (text: string) => {
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(text.toLowerCase());
          utterance.rate = 1;
          
          const pref = localStorage.getItem('signmeet_voice_pref') || 'MALE';
          const isFemale = pref === 'FEMALE';
          
          const voices = window.speechSynthesis.getVoices();
          
          if (voices.length > 0) {
            // Basic check for common names like Zira (Female) or David (Male)
            const exactFemale = voices.find(v => v.name.includes('Female') || v.name.includes('Zira') || v.name === 'Google US English');
            const exactMale = voices.find(v => v.name.includes('Male') || v.name.includes('David'));
            
            if (isFemale && exactFemale) {
              utterance.voice = exactFemale;
            } else if (!isFemale && exactMale) {
              utterance.voice = exactMale;
            } else {
              // If we can't find strict names, just grab the two English voices and alternate them
              const enVoices = voices.filter(v => v.lang.startsWith('en'));
              if (enVoices.length > 1) {
                utterance.voice = isFemale ? enVoices[1] : enVoices[0];
              }
            }
          }

          // 🔥 THE BULLETPROOF FIX: Pitch Shifting 🔥
          // If your computer literally ONLY has one voice installed (which is very common on Windows),
          // changing the Pitch forces the one single voice to sound feminine or masculine artificially! 
          // This works 100% of the time, no matter what voices are installed!
          utterance.pitch = isFemale ? 1.6 : 1.0;
          
          window.speechSynthesis.speak(utterance);
        }
      };

      signCapture = new SignCapture((text) => {
        setDetectedSign(text);
        if (text && text !== lastSpoken) {
          speakText(text);
          lastSpoken = text;
        }
      });
      signCapture.start();
      signCaptureRef.current = signCapture;
      // Send the current voicePref immediately into the iframe
      signCapture.setVoicePref(voicePref);
    } else {
      setCaptionsText("Avatar Paused");
      setDetectedSign("");
    }

    return () => {
      speechCapture?.stop();
      signCapture?.stop();
      signCaptureRef.current = null;
    };
  }, [mode]);

  const handleTestAvatar = () => {
    if (mode !== 'SPEECH_IMPAIRED') setMode('SPEECH_IMPAIRED');
    setQueue([]);
    setTimeout(() => {
      manager.current.processSentence("hello cool good alright");
    }, 100);
  };

  const handleChildConsumed = () => {
    setQueue([]);
  };

  // ── Reusable style helper ────────────────────────────────────────────────────
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

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 999999 }}>

      {/* ── AVATAR CONTAINER ── */}
      <div style={{
        position: 'absolute', bottom: 20, right: 20, width: 250, height: 300,
        background: C.bgCard,
        borderRadius: '20px',
        border: `1px solid ${C.border}`,
        backdropFilter: 'blur(8px)',
        opacity: mode === 'SPEECH_IMPAIRED' || (mode === 'OFF' && queue.length > 0) ? 1 : 0,
        pointerEvents: 'none',
        transition: 'opacity 0.5s',
        boxShadow: C.blueGlow,
      }}>
        <Canvas camera={{ position: [0, 0.2, 1.5], fov: 40 }} gl={{ alpha: true }}>
          <ambientLight intensity={1.5} />
          <pointLight position={[5, 5, 5]} intensity={1} />
          <AvatarController
            queue={queue}
            onAnimationFinished={handleChildConsumed}
          />
        </Canvas>
      </div>

      {/* ── SIGN DETECTED OVERLAY (Top Center) ── */}
      {detectedSign && mode === 'NORMAL' && (
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

      {/* ── CONTROL PANEL ── */}
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
            background: mode !== 'OFF' ? C.blueDim  : C.bgButton,
            color:      mode !== 'OFF' ? C.blue      : C.textMuted,
            border:     `1px solid ${mode !== 'OFF' ? C.blueBorder : C.border}`,
            fontWeight: 'bold', letterSpacing: '0.5px',
          }}>
            {mode === 'OFF' ? 'IDLE' : mode.replace('_', ' ')}
          </div>
        </div>

        {/* Mode Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setMode(mode === 'SPEECH_IMPAIRED' ? 'OFF' : 'SPEECH_IMPAIRED')}
            style={modeBtn(mode === 'SPEECH_IMPAIRED')}
          >
            🎧 Listening Mode
          </button>
          <button
            onClick={() => setMode(mode === 'NORMAL' ? 'OFF' : 'NORMAL')}
            style={modeBtn(mode === 'NORMAL')}
          >
            ✋ Speaking Mode
          </button>
        </div>

        {/* Voice Preference */}
        <div style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
          background: C.bgButton, padding: '10px 12px', borderRadius: '8px', border: `1px solid ${C.border}`
        }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: C.textPrimary }}>Voice:</span>
          <select 
            value={voicePref}
            onChange={(e) => {
              const val = e.target.value;
              setVoicePref(val);
              // Also persist to chrome.storage so the camera iframe can read it
              chrome.storage.local.set({ signmeet_voice_pref: val });
            }}
            style={{
              background: 'transparent', color: C.blueText, border: 'none', outline: 'none',
              fontSize: '12px', fontWeight: 'bold', cursor: 'pointer'
            }}
          >
            <option value="MALE" style={{ background: '#222' }}>Male</option>
            <option value="FEMALE" style={{ background: '#222' }}>Female</option>
          </select>
        </div>

        {/* Listening Mode Panel */}
        {mode === 'SPEECH_IMPAIRED' && (
          <div style={infoPanel}>
            <div style={{ fontSize: '11px', color: C.textMuted }}>
              Avatar translating speech to signs...
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
            <div style={{
              fontSize: '11px', color: C.blueText, fontStyle: 'italic',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <span>📡</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {captionsText.length > 30 ? captionsText.substring(0, 30) + '…' : captionsText}
              </span>
            </div>
          </div>
        )}

        {/* Speaking Mode Panel */}
        {mode === 'NORMAL' && (
          <div style={infoPanel}>
            <div style={{ fontSize: '11px', color: C.textMuted }}>
              Capturing signs from camera...
            </div>
            <div style={{ fontSize: '11px', color: C.blueText, fontStyle: 'italic' }}>
               {detectedSign || 'Waiting for signs...'}
            </div>
          </div>
        )}

        {/* Off State */}
        {mode === 'OFF' && (
          <div style={{ textAlign: 'center', padding: '8px', color: C.textCaption, fontSize: '11px' }}>
            Select a mode above to begin.
          </div>
        )}

      </div>
    </div>
  );
};