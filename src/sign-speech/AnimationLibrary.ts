// src/speech-sign/AnimationLibrary.ts

export interface BonePose {
  boneName: string;
  quaternion: { x: number; y: number; z: number; w: number };
  duration?: number;
}

export const ISL_POSES: Record<string, BonePose[]> = {
  idle: [
    { boneName: 'mixamorigRightArm', quaternion: { x: 0.0, y: 0.7, z: 0.0, w: 0.7 } },  // Approx from Euler {x:1.6,y:0,z:1.3}
    { boneName: 'mixamorigRightForeArm', quaternion: { x: 0.0, y: 0.0, z: 0.0, w: 1.0 } },
    { boneName: 'mixamorigRightHand', quaternion: { x: 0.0, y: 0.0, z: -0.15, w: 0.99 } },
    { boneName: 'mixamorigLeftArm', quaternion: { x: 0.0, y: -0.7, z: 0.0, w: 0.7 } },
    { boneName: 'mixamorigLeftForeArm', quaternion: { x: 0.0, y: 0.0, z: 0.0, w: 1.0 } },
    { boneName: 'mixamorigLeftHand', quaternion: { x: 0.0, y: 0.0, z: 0.15, w: 0.99 } },
  ],

  alright: [
    // Right arm up for OK sign
    { boneName: 'mixamorigRightArm', quaternion: { x: -0.2, y: -0.4, z: 0.1, w: 0.9 } },  // Approx from {-0.5,-1.0,0.8}
    { boneName: 'mixamorigRightForeArm', quaternion: { x: -0.8, y: 0.1, z: 0.1, w: 0.6 } },
    { boneName: 'mixamorigRightHand', quaternion: { x: 0.1, y: 0.6, z: 0.2, w: 0.8 } },

    // OK hand: thumb-index curl, others straight
    { boneName: 'mixamorigRightHandThumb1', quaternion: { x: 0.0, y: 0.0, z: 0.4, w: 0.9 } },
    { boneName: 'mixamorigRightHandThumb2', quaternion: { x: 0.0, y: 0.0, z: 0.5, w: 0.9 } },
    { boneName: 'mixamorigRightHandIndex1', quaternion: { x: 0.0, y: 0.0, z: -0.4, w: 0.9 } },
    { boneName: 'mixamorigRightHandIndex2', quaternion: { x: 0.0, y: 0.0, z: -0.5, w: 0.9 } },
    { boneName: 'mixamorigRightHandMiddle1', quaternion: { x: 0.0, y: 0.0, z: 0.0, w: 1.0 } },
    { boneName: 'mixamorigRightHandRing1', quaternion: { x: 0.0, y: 0.0, z: 0.0, w: 1.0 } },
    { boneName: 'mixamorigRightHandPinky1', quaternion: { x: 0.0, y: 0.0, z: 0.0, w: 1.0 } },

    // Left arm idle
    { boneName: 'mixamorigLeftArm', quaternion: { x: 0.0, y: -0.7, z: 0.0, w: 0.7 } },
    { boneName: 'mixamorigLeftForeArm', quaternion: { x: 0.0, y: 0.0, z: 0.0, w: 1.0 } },
    { boneName: 'mixamorigLeftHand', quaternion: { x: 0.0, y: 0.0, z: 0.15, w: 0.99 } },
  ],
};