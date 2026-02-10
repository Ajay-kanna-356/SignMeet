// src/speech-sign/Gestures.ts (export all functions)
import * as THREE from 'three';

export const ALRIGHT = (ref: { bones: Record<string, THREE.Bone>; animations: any[][][]; pending: boolean; animate: () => void }) => {
  let animations: any[][] = [];

  // Step 1: Raise right arm, bend forearm, form OK hand (thumb-index curl)
  animations.push(["mixamorigRightArm", "rotation", "x", -Math.PI / 4, "-"]);  // Arm down/out
  animations.push(["mixamorigRightArm", "rotation", "y", -Math.PI / 2, "-"]);
  animations.push(["mixamorigRightForeArm", "rotation", "x", -Math.PI / 1.5, "-"]);  // Bend elbow
  animations.push(["mixamorigRightHand", "rotation", "z", Math.PI / 4, "+"]);  // Palm face
  animations.push(["mixamorigRightHandThumb1", "rotation", "z", Math.PI / 3, "+"]);  // Thumb curl
  animations.push(["mixamorigRightHandThumb2", "rotation", "z", Math.PI / 3, "+"]);
  animations.push(["mixamorigRightHandIndex1", "rotation", "z", -Math.PI / 3, "-"]);  // Index curl to meet thumb
  animations.push(["mixamorigRightHandIndex2", "rotation", "z", -Math.PI / 3, "-"]);
  // Left arm idle (slight relax)
  animations.push(["mixamorigLeftArm", "rotation", "x", Math.PI / 6, "+"]);
  ref.animations.push(animations);

  // Step 2: Hold pose briefly (small adjustments for natural look)
  animations = [];
  animations.push(["mixamorigRightHand", "rotation", "y", Math.PI / 6, "+"]);  // Slight hand twist
  ref.animations.push(animations);

  // Step 3: Reset to idle
  animations = [];
  animations.push(["mixamorigRightArm", "rotation", "x", 0, "+"]);  // Relative reset (add back to neutral)
  animations.push(["mixamorigRightArm", "rotation", "y", 0, "+"]);
  animations.push(["mixamorigRightForeArm", "rotation", "x", 0, "+"]);
  animations.push(["mixamorigRightHand", "rotation", "z", 0, "-"]);
  animations.push(["mixamorigRightHandThumb1", "rotation", "z", 0, "-"]);
  animations.push(["mixamorigRightHandThumb2", "rotation", "z", 0, "-"]);
  animations.push(["mixamorigRightHandIndex1", "rotation", "z", 0, "+"]);
  animations.push(["mixamorigRightHandIndex2", "rotation", "z", 0, "+"]);
  animations.push(["mixamorigLeftArm", "rotation", "x", 0, "-"]);
  ref.animations.push(animations);

  if (!ref.pending) {
    ref.pending = true;
    ref.animate();
  }
};

// Add similar for other words (e.g., export const HELLO = (ref) => { ... } )
// Tweak values based on testing (log current rotations, adjust relatively)