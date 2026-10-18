import * as THREE from 'three';

const HAIR_COLORS = [
  { id: 'natural-black', label: '자연 흑갈색', value: '#2a1814' },
  { id: 'soft-black', label: '부드러운 검정', value: '#17191f' },
  { id: 'chestnut', label: '밤색', value: '#6b3526' },
  { id: 'blonde', label: '금발', value: '#c9902f' },
  { id: 'silver', label: '은발', value: '#b9c2cf' },
  { id: 'red', label: '적발', value: '#8f2735' },
  { id: 'blue', label: '청색', value: '#294e83' },
  { id: 'violet', label: '보라색', value: '#61447f' },
];

const EYE_COLORS = [
  { id: 'brown', label: '갈색', value: '#7a4327' },
  { id: 'blue', label: '청색', value: '#3f72ad' },
  { id: 'green', label: '녹색', value: '#477d52' },
  { id: 'violet', label: '보라색', value: '#76579b' },
  { id: 'amber', label: '호박색', value: '#b77825' },
  { id: 'gray', label: '회색', value: '#65717f' },
  { id: 'red', label: '적색', value: '#9a3434' },
  { id: 'gold', label: '금색', value: '#d19a32' },
];

const OUTFIT_COLORS = [
  { id: 'navy', label: '남색', value: '#263f73' },
  { id: 'wine', label: '와인색', value: '#7f2940' },
  { id: 'forest', label: '짙은 녹색', value: '#355f4b' },
  { id: 'brown', label: '갈색', value: '#75432d' },
  { id: 'ivory', label: '아이보리', value: '#d7c8a9' },
  { id: 'gray', label: '회색', value: '#69717d' },
  { id: 'black', label: '검정', value: '#24262d' },
  { id: 'violet', label: '보라색', value: '#684d82' },
];

const EQUIPMENT_COLORS = [
  { id: 'black', label: '검정', value: '#26282e' },
  { id: 'brown', label: '갈색', value: '#71442e' },
  { id: 'navy', label: '남색', value: '#304b70' },
  { id: 'red', label: '적색', value: '#87343b' },
  { id: 'green', label: '녹색', value: '#3e654d' },
  { id: 'gray', label: '회색', value: '#717986' },
  { id: 'ivory', label: '아이보리', value: '#cfc3a8' },
  { id: 'violet', label: '보라색', value: '#654c7d' },
];

const freezeProfile = (colors, materials) => Object.freeze({
  colors: Object.freeze(colors),
  materials: Object.freeze(materials.map(Object.freeze)),
});

export const PART_COLOR_PROFILES = Object.freeze({
  hair: freezeProfile(HAIR_COLORS, [
    { names: ['Hair_Base', 'Hair_Dark'], lightness: 0 },
    { names: ['Hair_Highlight', 'Hair_Light'], lightness: 0.12 },
  ]),
  eyes: freezeProfile(EYE_COLORS, [
    { names: ['Eye_Iris'], lightness: 0 },
    { names: ['Eye_Iris_Light'], lightness: 0.18 },
  ]),
  clothes: freezeProfile(OUTFIT_COLORS, [
    { names: ['Leather_Primary', 'Uniform_Navy', 'Underwear_Fabric', 'Armor_Steel', 'Robe_Blue', 'Tuxedo_Black', 'Hanbok_Jeogori', 'Dress_Wine'], lightness: 0 },
    { names: ['Leather_Panels', 'Robe_Dark', 'Hanbok_Baji', 'Hanbok_Chima', 'Dress_Shadow'], lightness: -0.1 },
  ]),
  equipmentFeet: freezeProfile(EQUIPMENT_COLORS, [
    { names: ['Leather', 'Fabric_Navy', 'Metal_Gold'], lightness: 0 },
    { names: ['Metal_Dark'], lightness: -0.12 },
  ]),
  equipmentHead: freezeProfile(EQUIPMENT_COLORS, [
    { names: ['Leather', 'Fabric_Navy', 'Fabric_Gray', 'Metal_Dark', 'Metal_Steel', 'Metal_Gold', 'Straw', 'Wood'], lightness: 0 },
  ]),
});

export function applyPartColor(root, profile, value) {
  if (!root || !profile || !value) return 0;
  const changed = new Set();
  root.traverse(node => {
    if (!node.isMesh) return;
    for (const material of [].concat(node.material || [])) {
      if (!material?.color || changed.has(material)) continue;
      const role = profile.materials.find(entry => entry.names.includes(material.name));
      if (!role) continue;
      material.color.set(value);
      if (role.lightness) material.color.offsetHSL(0, 0, role.lightness);
      material.needsUpdate = true;
      changed.add(material);
    }
  });
  return changed.size;
}

export function randomPartColor(profile, random = Math.random) {
  if (!profile?.colors?.length) return null;
  const number = Number(random());
  const normalized = Number.isFinite(number) ? THREE.MathUtils.clamp(number, 0, 0.999999999) : 0;
  return profile.colors[Math.floor(normalized * profile.colors.length)];
}
