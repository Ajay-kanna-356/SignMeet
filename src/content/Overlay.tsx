

// src/content/Overlay.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { AvatarController } from '../speech-sign/AvatarController';
import { SpeechManager } from '../speech-sign/SpeechManager';
import { MeetCaptionCapture } from './Capture';

export const Overlay = () => {
  const [queue, setQueue] = useState<string[]>([]);
  const [debugText, setDebugText] = useState("System Ready");
  const [isLive, setIsLive] = useState(false);
  
  const manager = useMemo(() => new SpeechManager((newQueue) => {
    setQueue([...newQueue]);
  }), []);

  useEffect(() => {
    let capture: MeetCaptionCapture | null = null;

    if (isLive) {
      setDebugText("Listening to Meet Captions...");
      capture = new MeetCaptionCapture((text) => {
        setDebugText(text);
        manager.processSentence(text);
      });
      capture.start();
    } else {
      setDebugText("Live Mode Paused");
      manager.clearMemory();
    }

    return () => capture?.stop();
  }, [isLive, manager]);

  const handleTest = () => {
    setIsLive(false); // Pause live to run test
    setQueue([]);
    setTimeout(() => {
      manager.processSentence("hello cool good alright");
    }, 100);
  };

  const handleChildConsumed = () => {
    setQueue([]);
    manager.shiftQueue();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 999999 }}>
      
      {/* AVATAR CONTAINER */}
      <div style={{ 
        position: 'absolute', bottom: 20, right: 20, width: 250, height: 300,
        background: 'rgba(255,255,255,0.05)', borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(5px)'
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

      {/* CONTROL PANEL */}
      <div style={{
        position: 'absolute', bottom: '30px', left: '30px', pointerEvents: 'auto',
        background: 'rgba(0,0,0,0.85)', color: 'white', padding: '15px',
        borderRadius: '12px', border: '1px solid #444', width: '280px',
        fontFamily: 'sans-serif', boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#aaa' }}>SIGNMEET LIVE</span>
          <div style={{ 
            width: '10px', height: '10px', borderRadius: '50%', 
            background: isLive ? '#00ff00' : '#ff4444',
            boxShadow: isLive ? '0 0 8px #00ff00' : 'none'
          }} />
        </div>

        <div style={{ marginBottom: '10px', minHeight: '40px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Last Captions:</div>
          <div style={{ fontSize: '13px', color: '#eee', fontStyle: 'italic' }}>
            "{debugText.length > 60 ? debugText.substring(0, 60) + "..." : debugText}"
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button 
            onClick={() => setIsLive(!isLive)}
            style={{
              width: '100%', padding: '10px', 
              background: isLive ? '#ef4444' : '#22c55e', 
              color: 'white', border: 'none', borderRadius: '6px', 
              cursor: 'pointer', fontWeight: 'bold', transition: '0.2s'
            }}
          >
            {isLive ? "Stop Live Capture" : "Start Live Capture"}
          </button>

          <button 
            onClick={handleTest}
            style={{
              width: '100%', padding: '8px', background: '#3b82f6', color: 'white',
              border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px'
            }}
          >
            Run Test Sequence
          </button>
        </div>
      </div>
    </div>
  );
};