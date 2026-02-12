
// src/speech-sign/AvatarController.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

const MODELS = {
  idle: chrome.runtime.getURL('assets/idle.glb'),
  hello: chrome.runtime.getURL('assets/hello.glb'),
  cool: chrome.runtime.getURL('assets/cool.glb'),
  good: chrome.runtime.getURL('assets/good.glb'),
  alright: chrome.runtime.getURL('assets/alright.glb'),
  job: chrome.runtime.getURL('assets/job.glb'),
  new: chrome.runtime.getURL('assets/new.glb'),
  secretary: chrome.runtime.getURL('assets/secretary.glb'),
  sorry: chrome.runtime.getURL('assets/sorry.glb'),
  team: chrome.runtime.getURL('assets/team.glb'),
  technology: chrome.runtime.getURL('assets/technology.glb'),
  thankyou: chrome.runtime.getURL('assets/thankyou.glb'),


};

export const AvatarController = ({ queue, onAnimationFinished }: any) => {
  const group = useRef<THREE.Group>(null);
  const [currentAnim, setCurrentAnim] = useState<string>("idle");
  const internalQueue = useRef<string[]>([]);
  const isPlaying = useRef(false);

  // 1. Load all models
  const gltfs = {
    idle: useGLTF(MODELS.idle),
    hello: useGLTF(MODELS.hello),
    cool: useGLTF(MODELS.cool),
    good: useGLTF(MODELS.good),
    alright: useGLTF(MODELS.alright),
    job: useGLTF(MODELS.job),
    new: useGLTF(MODELS.new),
    secretary: useGLTF(MODELS.secretary),
    sorry: useGLTF(MODELS.sorry),
    team: useGLTF(MODELS.team),
    technology: useGLTF(MODELS.technology),
    thankyou: useGLTF(MODELS.thankyou),
  };

  // 2. Prepare Animations (The "Nuclear" Retargeting)
  const animations = useMemo(() => {
    const clips: THREE.AnimationClip[] = [];
    const idleScene = gltfs.idle.scene;

    // Create the bone map for retargeting (keeps skeletons synced)
    const idleBoneMap = new Map<string, string>();
    idleScene.traverse((obj) => {
      if (obj.type === 'Bone') {
        const cleanName = obj.name.split(':').pop(); 
        if (cleanName) idleBoneMap.set(cleanName, obj.name);
      }
    });

    Object.entries(gltfs).forEach(([name, gltf]) => {
      // 🛠️ FIX: Select the correct animation index
      // 'hello' and 'idle' usually have the motion at index 0.
      // 'cool', 'good', and 'alright' have the motion at index 1.
      const animIndex =(name === 'hello' || name === 'good' || name === 'idle') ? 0: (name === 'technology') ? 2: 1;

      const originalClip = gltf.animations[animIndex] || gltf.animations[0];

      if (originalClip) {
        const clip = originalClip.clone();
        clip.name = name;

        // Retarget tracks to match Idle skeleton names
        const newTracks: THREE.KeyframeTrack[] = [];
        clip.tracks.forEach((track) => {
          const trackParts = track.name.split('.');
          const property = trackParts.pop();
          const boneName = trackParts.join('.');
          const cleanBoneName = boneName.split(':').pop();
          const targetBoneName = idleBoneMap.get(cleanBoneName!);

          if (targetBoneName) {
            track.name = `${targetBoneName}.${property}`;
            newTracks.push(track);
          }
        });

        clip.tracks = newTracks.filter((t) => !t.name.includes('_end'));
        clips.push(clip);
        console.log(`[SIGNMEET] Loaded animation "${name}" from index ${animIndex}`);
      }
    });

    return clips;
  }, []);

  const { actions, mixer } = useAnimations(animations, group);

  // 3. Queue Logic
  useEffect(() => {
    if (queue.length > 0) {
      queue.forEach((word: string) => internalQueue.current.push(word));
      onAnimationFinished(); 
    }
  }, [queue, onAnimationFinished]);

  // 4. Animation Loop
  useFrame(() => {
    if (isPlaying.current) return;

    if (internalQueue.current.length > 0) {
      const nextWord = internalQueue.current.shift()!;
      playAnimation(nextWord);
    } 
    else if (currentAnim !== 'idle') {
      playIdle();
    }
  });

  const playAnimation = (name: string) => {
    const action = actions[name];
    if (!action) {
      console.warn(`[SIGNMEET] Missing animation: ${name}`);
      return;
    }

    console.log(`[SIGNMEET] playing -> ${name}`);
    isPlaying.current = true;

    // Hard Reset strategy (Most reliable for distinct clips)
    mixer.stopAllAction();
    
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    
    // Quick fade in to prevent popping
    action.fadeIn(0.1); 
    action.play();

    setCurrentAnim(name);

    const onFinish = (e: any) => {
      if (e.action === action) {
        console.log(`[SIGNMEET] finished -> ${name}`);
        mixer.removeEventListener('finished', onFinish);
        isPlaying.current = false;
      }
    };
    mixer.addEventListener('finished', onFinish);
  };

  const playIdle = () => {
    if (!actions.idle) return;
    
    console.log("[SIGNMEET] fading to idle");
    setCurrentAnim('idle');

    // Fade into idle
    actions.idle.reset().fadeIn(0.2).play();
  };

  return (
    <group ref={group} position={[0, -1.3, 0]} scale={1.0}> 
      {/* IMPORTANT: We render the IDLE scene. All animations map to THIS skeleton. */}
      <primitive object={gltfs.idle.scene} />
    </group>
  );
};