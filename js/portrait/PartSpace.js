import * as THREE from 'three';

// Capture the model-root to attachment-parent transform once, before playback starts.
// Runtime part creation must not depend on the bone's current animation pose.
export function capturePartSpace(root,parent){
  root.updateMatrixWorld(true);
  return Object.freeze({
    rootToParent:new THREE.Matrix4().copy(parent.matrixWorld).invert().multiply(root.matrixWorld)
  });
}

export function rootPointToPartLocal(space,point){
  return new THREE.Vector3(...point).applyMatrix4(space.rootToParent);
}
