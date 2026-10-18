const bodyOriginals = new WeakMap();
const ownedGeometry = new WeakMap();
const hairOriginals = new WeakMap();

function collectRules(root) {
  const result = { ...(root?.userData || {}) };
  root?.traverse(node => {
    if (node.userData?.hideHair === true) result.hideHair = true;
    if (node.userData?.bodyHide) result.bodyHide = node.userData.bodyHide;
  });
  return result;
}

function restoreBody(mesh) {
  const geometry = bodyOriginals.get(mesh);
  if (!geometry) return;
  mesh.geometry = geometry;
  ownedGeometry.get(mesh)?.dispose();
  ownedGeometry.delete(mesh);
}

function setHairHidden(root, hidden) {
  if (!root) return;
  if (!hairOriginals.has(root)) hairOriginals.set(root, root.visible);
  root.userData.equipmentVisibilityHidden = hidden;
  root.visible = hidden ? false : hairOriginals.get(root);
}

export function applyOutfitVisibility({ bodyMeshes = [], hairRoots = [], headwearRoot = null, clothesRoot = null } = {}) {
  const head = collectRules(headwearRoot);
  const clothes = collectRules(clothesRoot);
  for (const root of hairRoots) setHairHidden(root, head.hideHair === true);

  for (const mesh of bodyMeshes) {
    restoreBody(mesh);
    const region = clothes.bodyHide;
    if (!region || !mesh.isSkinnedMesh) continue;
    if (!bodyOriginals.has(mesh)) bodyOriginals.set(mesh, mesh.geometry);
    const source = bodyOriginals.get(mesh);
    const positions = source.getAttribute('position');
    const joints = source.getAttribute('skinIndex');
    const weights = source.getAttribute('skinWeight');
    if (!positions || !joints || !weights) continue;

    const wanted = new Set(region.bones || []);
    const boneIds = new Set(mesh.skeleton.bones
      .map((bone, index) => wanted.has(bone.name.split(':').pop().replace(/^mixamorig/i, '')) ? index : -1)
      .filter(index => index >= 0));
    const component = ['getX', 'getY', 'getZ', 'getW'];
    const coverage = vertex => component.reduce((sum, getter, index) => (
      boneIds.has(joints[getter](vertex)) ? sum + weights[getter](vertex) : sum
    ), 0);
    const hidden = new Uint8Array(positions.count);
    for (let index = 0; index < positions.count; index++) {
      hidden[index] = positions.getY(index) >= region.minY
        && positions.getY(index) <= region.maxY
        && coverage(index) > 0.35 ? 1 : 0;
    }

    const vertexAt = offset => source.index ? source.index.getX(offset) : offset;
    const groups = source.groups.length
      ? source.groups
      : [{ start: 0, count: source.index?.count ?? positions.count, materialIndex: 0 }];
    const indices = [];
    const nextGroups = [];
    for (const group of groups) {
      const start = indices.length;
      for (let offset = group.start; offset < group.start + group.count; offset += 3) {
        const a = vertexAt(offset), b = vertexAt(offset + 1), c = vertexAt(offset + 2);
        if (!(hidden[a] && hidden[b] && hidden[c])) indices.push(a, b, c);
      }
      nextGroups.push({ start, count: indices.length - start, materialIndex: group.materialIndex });
    }
    const geometry = source.clone();
    geometry.setIndex(indices);
    geometry.clearGroups();
    nextGroups.forEach(group => geometry.addGroup(group.start, group.count, group.materialIndex));
    mesh.geometry = geometry;
    ownedGeometry.set(mesh, geometry);
  }
}

export function restoreOutfitVisibility({ bodyMeshes = [], hairRoots = [] } = {}) {
  bodyMeshes.forEach(restoreBody);
  for (const root of hairRoots) {
    root.userData.equipmentVisibilityHidden = false;
    if (hairOriginals.has(root)) root.visible = hairOriginals.get(root);
  }
}
