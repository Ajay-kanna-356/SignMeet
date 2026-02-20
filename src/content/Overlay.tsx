
// src/content/Overlay.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { AvatarController } from '../speech-sign/AvatarController';
import { SpeechManager } from '../speech-sign/SpeechManager';
import { MeetCaptionCapture } from './Capture';
import { SignCapture } from './SignCapture';

type AppMode = 'OFF' | 'SPEECH_IMPAIRED' | 'NORMAL';

export const Overlay = () => {
  const [mode, setMode] = useState<AppMode>('OFF');
  const [queue, setQueue] = useState<string[]>([]);
  const [captionsText, setCaptionsText] = useState("System Ready");
  const [detectedSign, setDetectedSign] = useState("");

  // 1. Use useRef instead of useMemo for the class instance
  const manager = useRef(new SpeechManager((newQueue) => {
    setQueue([...newQueue]);
  }));

  // HANDLE MODES
  useEffect(() => {
    let speechCapture: MeetCaptionCapture | null = null;
    let signCapture: SignCapture | null = null;

    if (mode === 'SPEECH_IMPAIRED') {
      setCaptionsText("Listening to Meet Captions...");
      setDetectedSign("");

      speechCapture = new MeetCaptionCapture((text) => {
        setCaptionsText(text);
        // 2. Use .current here
        manager.current.processSentence(text);
      });
      speechCapture.start();
    } else if (mode === 'NORMAL') {
      setCaptionsText("Avatar Paused");
      setDetectedSign("");
      let lastSpoken = "";

      const speakText = (text: string) => {
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(text.toLowerCase()); // Speak naturally
          utterance.rate = 1;
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

    } else {
      setCaptionsText("Avatar Paused");
      setDetectedSign("");
    }

    return () => {
      speechCapture?.stop();
      signCapture?.stop();
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

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 999999 }}>

      {/* AVATAR CONTAINER */}
      <div style={{
        position: 'absolute', bottom: 20, right: 20, width: 250, height: 300,
        background: 'rgba(255,255,255,0.05)', borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(5px)',
        opacity: mode === 'SPEECH_IMPAIRED' || (mode === 'OFF' && queue.length > 0) ? 1 : 0,
        pointerEvents: 'none',
        transition: 'opacity 0.5s'
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

      {/* OVERLAY (Top Center) */}
      {detectedSign && mode === 'NORMAL' && (
        <div style={{
          position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.85)', padding: '15px 40px', borderRadius: '40px',
          color: '#0f0', fontSize: '32px', fontWeight: 'bold',
          border: '3px solid #0f0', backdropFilter: 'blur(10px)',
          boxShadow: '0 0 40px rgba(0,255,0,0.6)',
          pointerEvents: 'none', letterSpacing: '2px'
        }}>
          ✋ {detectedSign}
        </div>
      )}


      {/* CONTROL PANEL */}
      <div style={{
        position: 'absolute', bottom: '30px', left: '30px', pointerEvents: 'auto',
        background: 'rgba(15,15,15,0.95)', color: 'white', padding: '20px',
        borderRadius: '16px', border: '1px solid #333', width: '320px',
        fontFamily: 'system-ui, sans-serif', boxShadow: '0 12px 32px rgba(0,0,0,0.8)',
        display: 'flex', flexDirection: 'column', gap: '15px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
          <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f0', textTransform: 'uppercase', letterSpacing: '1px' }}>SignMeet Beta</span>
          <div style={{
            fontSize: '10px', padding: '4px 8px', borderRadius: '4px', background: '#333', color: '#aaa'
          }}>
            {mode === 'OFF' ? 'SERVICE IDLE' : mode.replace('_', ' ')}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setMode(mode === 'SPEECH_IMPAIRED' ? 'OFF' : 'SPEECH_IMPAIRED')}
            style={{
              flex: 1, padding: '12px 8px', borderRadius: '8px',
              background: mode === 'SPEECH_IMPAIRED' ? '#0f0' : '#222',
              color: mode === 'SPEECH_IMPAIRED' ? '#000' : '#fff',
              border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold',
              transition: '0.2s all'
            }}
          >
            Listening Mode
          </button>
          <button
            onClick={() => setMode(mode === 'NORMAL' ? 'OFF' : 'NORMAL')}
            style={{
              flex: 1, padding: '12px 8px', borderRadius: '8px',
              background: mode === 'NORMAL' ? 'rgb(186, 217, 246)' : '#222',
              color: mode === 'NORMAL' ? '#000' : '#fff',
              border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold',
              transition: '0.2s all'
            }}
          >
            Speaking mode
          </button>
        </div>

        {/* MODE UI */}
        {mode === 'SPEECH_IMPAIRED' && (
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>Avatar translating speech to signs...</div>
            <button onClick={handleTestAvatar} style={{ width: '100%', padding: '8px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
              Run Avatar Demo
            </button>
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#0f0', fontStyle: 'italic', opacity: 0.7 }}>
              📡 {captionsText.length > 30 ? captionsText.substring(0, 30) + "..." : captionsText}
            </div>
          </div>
        )}

        {mode === 'NORMAL' && (
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>Capturing signs from camera...</div>
              <div style={{ marginTop: '8px', fontSize: '11px', color: '#0f0', fontStyle: 'italic', opacity: 0.7 }}>
                Target: {detectedSign || "Waiting for signs..."}
              </div>
            </div>
          </div>
        )}

        {mode === 'OFF' && (
          <div style={{ textAlign: 'center', padding: '10px', color: '#555', fontSize: '11px' }}>
            Select a mode above to begin.
          </div>
        )}

      </div>
    </div>
  );
};