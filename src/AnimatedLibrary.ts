// src/sign-speech/AnimationLibrary.ts

export interface BoneTarget {
  name: string;
  x: number;
  y: number;
  z: number;
}

export const ISL_ANIMATIONS: Record<string, { duration: number; bones: BoneTarget[] }> = {
  alright: {
    duration: 800,
    bones: [
      // Right Arm - Raised and bent
      { name: 'mixamorig2RightArm', x: -1.2, y: 0, z: 0 },
      { name: 'mixamorig2RightForeArm', x: -1.5, y: 0, z: 0 },
      { name: 'mixamorig2RightHand', x: 0, y: 0, z: 0.5 },
      // Left Arm - Mirroring slightly
      { name: 'mixamorig2LeftArm', x: -1.2, y: 0, z: 0 },
      { name: 'mixamorig2LeftForeArm', x: -1.5, y: 0, z: 0 },
      { name: 'mixamorig2LeftHand', x: 0, y: 0, z: -0.5 },
    ]
  },
  idle: {
    duration: 1000,
    bones: [
      { name: 'mixamorig2RightArm', x: 0, y: 0, z: 1.4 },
      { name: 'mixamorig2LeftArm', x: 0, y: 0, z: -1.4 },
      { name: 'mixamorig2RightForeArm', x: 0, y: 0, z: 0 },
      { name: 'mixamorig2LeftForeArm', x: 0, y: 0, z: 0 }
    ]
  }
};