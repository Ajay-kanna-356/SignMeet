
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
  // New words
  finish: chrome.runtime.getURL('assets/finish.glb'),
  start: chrome.runtime.getURL('assets/start.glb'),
  meeting: chrome.runtime.getURL('assets/meeting.glb'),
  we: chrome.runtime.getURL('assets/we.glb'),
  you: chrome.runtime.getURL('assets/you.glb'),
  me: chrome.runtime.getURL('assets/me.glb'),
  what: chrome.runtime.getURL('assets/what.glb'),
  tomorrow: chrome.runtime.getURL('assets/tomorrow.glb'),
  yesterday: chrome.runtime.getURL('assets/yesterday.glb'),
  no: chrome.runtime.getURL('assets/no.glb'),
  problem: chrome.runtime.getURL('assets/problem.glb'),
  // help: chrome.runtime.getURL('assets/help.glb'), // DISABLED: help.glb missing from public/assets
};

// Always pick the animation clip with the longest duration.
// This avoids guessing indices — T-pose/setup clips are always short (~0.5s),
// and the actual sign animation is always the longest one in the file.
function getLongestClip(animations: THREE.AnimationClip[]): THREE.AnimationClip | null {
  if (!animations || animations.length === 0) return null;
  return animations.reduce((longest, clip) =>
    clip.duration > longest.duration ? clip : longest
  );
}

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
    finish: useGLTF(MODELS.finish),
    start: useGLTF(MODELS.start),
    meeting: useGLTF(MODELS.meeting),
    we: useGLTF(MODELS.we),
    you: useGLTF(MODELS.you),
    me: useGLTF(MODELS.me),
    what: useGLTF(MODELS.what),
    tomorrow: useGLTF(MODELS.tomorrow),
    yesterday: useGLTF(MODELS.yesterday),
    no: useGLTF(MODELS.no),
    problem: useGLTF(MODELS.problem),
    // help: useGLTF(MODELS.help), // DISABLED: help.glb missing
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
      // Automatically pick the longest clip — sign animations are always longer
      // than T-pose/setup clips (~0.5s). This removes all index guessing.
      const originalClip = getLongestClip(gltf.animations);

      if (!originalClip) {
        console.warn(`[SIGNMEET] No animation found in "${name}.glb". Skipping.`);
        return;
      }

      console.log(`[SIGNMEET] "${name}" -> clip "${originalClip.name}" (${originalClip.duration.toFixed(2)}s from ${gltf.animations.length} clips)`);

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

      if (clip.tracks.length === 0) {
        console.warn(`[SIGNMEET] Retargeting produced 0 tracks for "${name}". Bone names may not match idle skeleton.`);
        return;
      }

      clips.push(clip);
      console.log(`[SIGNMEET] Loaded animation "${name}" (${clip.tracks.length} tracks)`);
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
      console.warn(`[SIGNMEET] Missing animation: "${name}". Check that ${name}.glb exists in assets and its bones match the idle skeleton.`);
      return;
    }

    console.log(`[SIGNMEET] playing -> ${name}`);
    isPlaying.current = true;

    mixer.stopAllAction();

    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
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

    actions.idle.reset().fadeIn(0.2).play();
  };

  return (
    <group ref={group} position={[0, -1.3, 0]} scale={1.0}>
      {/* IMPORTANT: We render the IDLE scene. All animations map to THIS skeleton. */}
      <primitive object={gltfs.idle.scene} />
    </group>
  );
};