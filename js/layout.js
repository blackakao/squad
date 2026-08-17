const LAYOUT_STORAGE_KEY = "squad-auto-battle-layout-settings";
const LAYOUT_PAGES = [
  { key: "common", label: "공통" },
  { key: "battle", label: "전투" },
  { key: "team", label: "팀 편성" },
  { key: "stats", label: "스탯 관리" },
  { key: "equipment", label: "장비 착용" },
  { key: "item", label: "아이템 관리" },
  { key: "skill", label: "스킬 관리" },
  { key: "category", label: "장비 카테고리" },
  { key: "record", label: "전투 기록" },
  { key: "layout", label: "페이지 조정" }
];
const LAYOUT_SETTING_DEFS = [
  { page: "common", key: "pageHeight", group: "페이지", label: "공통 페이지 높이", cssVar: "--page-height", value: 86, unit: "vh", units: ["px", "%", "vh"] },
  { page: "common", key: "pagePaddingTop", group: "페이지", label: "위 여백", cssVar: "--page-padding-top", value: 5, unit: "px", units: ["px", "%"] },
  { page: "common", key: "pagePaddingX", group: "페이지", label: "좌우 여백", cssVar: "--page-padding-x", value: 16, unit: "px", units: ["px", "%"] },
  { page: "common", key: "pagePaddingBottom", group: "페이지", label: "아래 여백", cssVar: "--page-padding-bottom", value: 16, unit: "px", units: ["px", "%"] },
  { page: "common", key: "panelPadding", group: "패널", label: "패널 안쪽 여백", cssVar: "--panel-padding", value: 8, unit: "px", units: ["px", "%"] },
  { page: "common", key: "panelMarginBottom", group: "패널", label: "패널 아래 간격", cssVar: "--panel-margin-bottom", value: 5, unit: "px", units: ["px", "%"] },
  { page: "common", key: "dataTableCellPadding", group: "테이블", label: "공통 셀 여백", cssVar: "--data-table-cell-padding", value: 8, unit: "px", units: ["px", "%"] },
  { page: "common", key: "dataTableSelectWidth", group: "테이블", label: "선택 컬럼 너비", cssVar: "--data-table-select-width", value: 44, unit: "px", units: ["px", "%"] },
  { page: "common", key: "dataTableActionWidth", group: "테이블", label: "수정/동작 컬럼 너비", cssVar: "--data-table-action-width", value: 90, unit: "px", units: ["px", "%"] },
  { page: "common", key: "modalWidth", group: "모달", label: "공통 모달 너비", cssVar: "--modal-width", value: 420, unit: "px", units: ["px", "%", "vw"] },
  { page: "common", key: "modalMaxHeight", group: "모달", label: "공통 모달 최대 높이", cssVar: "--modal-max-height", value: 96, unit: "vh", units: ["px", "%", "vh"] },
  { page: "common", key: "modalPadding", group: "모달", label: "공통 모달 안쪽 여백", cssVar: "--modal-padding", value: 16, unit: "px", units: ["px", "%"] },
  { page: "common", key: "formRowGap", group: "모달 폼", label: "입력 라벨/필드 간격", cssVar: "--form-row-gap", value: 4, unit: "px", units: ["px", "%"] },
  { page: "common", key: "formRowMarginBottom", group: "모달 폼", label: "입력 행 아래 간격", cssVar: "--form-row-margin-bottom", value: 10, unit: "px", units: ["px", "%"] },

  { page: "battle", key: "battlePageHeight", group: "전투 페이지", label: "전체 높이", cssVar: "--battle-page-height", value: 88, unit: "vh", units: ["px", "%", "vh"] },
  { page: "battle", key: "battleLeftWidth", group: "전투 페이지", label: "왼쪽 영역 너비", cssVar: "--battle-left-width", value: 25, unit: "%", units: ["px", "%"] },
  { page: "battle", key: "battleCenterWidth", group: "전투 페이지", label: "가운데 영역 너비", cssVar: "--battle-center-width", value: 50, unit: "%", units: ["px", "%"] },
  { page: "battle", key: "battleRightWidth", group: "전투 페이지", label: "오른쪽 영역 너비", cssVar: "--battle-right-width", value: 25, unit: "%", units: ["px", "%"] },
  { page: "battle", key: "battleSelectionTableFontSize", group: "선택 현황 표", label: "글자 크기", cssVar: "--battle-selection-table-font-size", value: 12, unit: "px", units: ["px"] },
  { page: "battle", key: "battleSelectionTablePadding", group: "선택 현황 표", label: "셀 여백", cssVar: "--battle-selection-table-padding", value: 4, unit: "px", units: ["px", "%"] },
  { page: "battle", key: "battleSelectionNameWidth", group: "선택 현황 표", label: "이름 컬럼 너비", cssVar: "--battle-selection-name-width", value: 30, unit: "%", units: ["px", "%"] },
  { page: "battle", key: "battleModalWidth", group: "전투 모달", label: "전투 모달 너비", cssVar: "--battle-modal-width", value: 1280, unit: "px", units: ["px", "%", "vw"] },
  { page: "battle", key: "battleModalHeight", group: "전투 모달", label: "전투 모달 높이", cssVar: "--battle-modal-height", value: 820, unit: "px", units: ["px", "%", "vh"] },
  { page: "battle", key: "battleModalPadding", group: "전투 모달", label: "전투 모달 여백", cssVar: "--battle-modal-padding", value: 12, unit: "px", units: ["px", "%"] },
  { page: "battle", key: "battleSideWidth", group: "전투 모달 내부", label: "상태 패널 너비", cssVar: "--battle-side-width", value: 20, unit: "%", units: ["px", "%"] },
  { page: "battle", key: "battleFieldWidth", group: "전투 모달 내부", label: "전장 패널 너비", cssVar: "--battle-field-width", value: 60, unit: "%", units: ["px", "%"] },
  { page: "battle", key: "battleScreenGap", group: "전투 모달 내부", label: "패널 간격", cssVar: "--battle-screen-gap", value: 8, unit: "px", units: ["px", "%"] },

  { page: "team", key: "teamLeftWidth", group: "팀 편성 그리드", label: "왼쪽 목록 너비", cssVar: "--team-left-width", value: 280, unit: "px", units: ["px", "%"] },
  { page: "team", key: "teamRightWidth", group: "팀 편성 그리드", label: "오른쪽 목록 너비", cssVar: "--team-right-width", value: 320, unit: "px", units: ["px", "%"] },
  { page: "team", key: "teamMinHeight", group: "팀 편성 그리드", label: "최소 높이", cssVar: "--team-min-height", value: 520, unit: "px", units: ["px", "vh"] },
  { page: "team", key: "memberTableFontSize", group: "멤버 표", label: "글자 크기", cssVar: "--member-table-font-size", value: 12, unit: "px", units: ["px"] },
  { page: "team", key: "memberTableCellPadding", group: "멤버 표", label: "셀 여백", cssVar: "--member-table-cell-padding", value: 4, unit: "px", units: ["px", "%"] },

  { page: "stats", key: "statLeftWidth", group: "스탯 그리드", label: "왼쪽 목록 너비", cssVar: "--stat-left-width", value: 240, unit: "px", units: ["px", "%"] },
  { page: "stats", key: "statRightWidth", group: "스탯 그리드", label: "오른쪽 미리보기 너비", cssVar: "--stat-right-width", value: 340, unit: "px", units: ["px", "%"] },
  { page: "stats", key: "statMinHeight", group: "스탯 그리드", label: "최소 높이", cssVar: "--stat-min-height", value: 420, unit: "px", units: ["px", "vh"] },

  { page: "equipment", key: "equipmentLeftWidth", group: "장비 그리드", label: "왼쪽 목록 너비", cssVar: "--equipment-left-width", value: 240, unit: "px", units: ["px", "%"] },
  { page: "equipment", key: "equipmentRightWidth", group: "장비 그리드", label: "오른쪽 목록 너비", cssVar: "--equipment-right-width", value: 340, unit: "px", units: ["px", "%"] },
  { page: "equipment", key: "equipmentMinHeight", group: "장비 그리드", label: "최소 높이", cssVar: "--equipment-min-height", value: 420, unit: "px", units: ["px", "vh"] },
  { page: "equipment", key: "equipmentSlotMinWidth", group: "장비 슬롯", label: "슬롯 최소 너비", cssVar: "--equipment-slot-min-width", value: 120, unit: "px", units: ["px", "%"] },
  { page: "equipment", key: "equipmentSlotGap", group: "장비 슬롯", label: "슬롯 간격", cssVar: "--equipment-slot-gap", value: 8, unit: "px", units: ["px", "%"] },
  { page: "equipment", key: "equipmentSlotPadding", group: "장비 슬롯", label: "슬롯 안쪽 여백", cssVar: "--equipment-slot-padding", value: 8, unit: "px", units: ["px", "%"] },
  { page: "equipment", key: "equipmentSlotMinHeight", group: "장비 슬롯", label: "슬롯 최소 높이", cssVar: "--equipment-slot-min-height", value: 96, unit: "px", units: ["px", "vh"] },
  { page: "equipment", key: "equipmentSlotItemMinHeight", group: "장비 슬롯", label: "슬롯 아이템 영역 높이", cssVar: "--equipment-slot-item-min-height", value: 28, unit: "px", units: ["px", "%"] },
  { page: "equipment", key: "equipmentTooltipWidth", group: "장비 툴팁", label: "툴팁 너비", cssVar: "--equipment-tooltip-width", value: 220, unit: "px", units: ["px", "%", "vw"] },

  { page: "item", key: "itemTableCellPadding", group: "아이템 표", label: "셀 여백", cssVar: "--item-table-cell-padding", value: 8, unit: "px", units: ["px", "%"] },

  { page: "skill", key: "skillModalWidth", group: "스킬 모달", label: "스킬 모달 너비", cssVar: "--skill-modal-width", value: 980, unit: "px", units: ["px", "%", "vw"] },
  { page: "skill", key: "skillTableCellPadding", group: "스킬 표", label: "셀 여백", cssVar: "--skill-table-cell-padding", value: 8, unit: "px", units: ["px", "%"] },
  { page: "skill", key: "skillActionMinColumn", group: "액션 카드", label: "액션 필드 최소 너비", cssVar: "--skill-action-min-column", value: 110, unit: "px", units: ["px", "%"] },
  { page: "skill", key: "skillActionGap", group: "액션 카드", label: "액션 필드 간격", cssVar: "--skill-action-gap", value: 8, unit: "px", units: ["px", "%"] },
  { page: "skill", key: "skillActionPadding", group: "액션 카드", label: "액션 카드 안쪽 여백", cssVar: "--skill-action-padding", value: 8, unit: "px", units: ["px", "%"] },
  { page: "skill", key: "skillCoefficientTypeWidth", group: "계수 행", label: "계수 유형 너비", cssVar: "--skill-coefficient-type-width", value: 110, unit: "px", units: ["px", "%"] },
  { page: "skill", key: "skillCoefficientFieldWidth", group: "계수 행", label: "대상 필드 너비", cssVar: "--skill-coefficient-field-width", value: 110, unit: "px", units: ["px", "%"] },
  { page: "skill", key: "skillCoefficientCalcWidth", group: "계수 행", label: "값계산 너비", cssVar: "--skill-coefficient-calc-width", value: 100, unit: "px", units: ["px", "%"] },
  { page: "skill", key: "skillCoefficientValueWidth", group: "계수 행", label: "값입력 너비", cssVar: "--skill-coefficient-value-width", value: 80, unit: "px", units: ["px", "%"] },
  { page: "skill", key: "skillResourceCostColumnWidth", group: "자원 소모", label: "자원 소모 필드 너비", cssVar: "--skill-resource-cost-column-width", value: 110, unit: "px", units: ["px", "%"] },
  { page: "skill", key: "skillRangeOptionWidth", group: "거리", label: "거리 선택 너비", cssVar: "--skill-range-option-width", value: 110, unit: "px", units: ["px", "%"] },

  { page: "category", key: "categoryRightWidth", group: "카테고리 그리드", label: "오른쪽 영역 너비", cssVar: "--category-right-width", value: 420, unit: "px", units: ["px", "%"] },
  { page: "category", key: "categoryTableCellPadding", group: "카테고리 표", label: "셀 여백", cssVar: "--category-table-cell-padding", value: 8, unit: "px", units: ["px", "%"] },

  { page: "record", key: "recordDateWidth", group: "기록 표", label: "전투일시 컬럼 너비", cssVar: "--record-date-width", value: 140, unit: "px", units: ["px", "%"] },
  { page: "record", key: "recordResultWidth", group: "기록 표", label: "결과 컬럼 너비", cssVar: "--record-result-width", value: 72, unit: "px", units: ["px", "%"] },
  { page: "record", key: "recordDurationWidth", group: "기록 표", label: "소요시간 컬럼 너비", cssVar: "--record-duration-width", value: 84, unit: "px", units: ["px", "%"] },
  { page: "record", key: "recordMemberFixedWidth", group: "기록 표", label: "멤버 외 고정 폭 합계", cssVar: "--record-member-fixed-width", value: 340, unit: "px", units: ["px", "%"] },
  { page: "record", key: "recordMemberPadding", group: "기록 표", label: "멤버 셀 여백", cssVar: "--record-member-padding", value: 6, unit: "px", units: ["px", "%"] },

  { page: "layout", key: "layoutGroupColumnWidth", group: "조정 표", label: "구조 컬럼 너비", cssVar: "--layout-group-column-width", value: 160, unit: "px", units: ["px", "%"] },
  { page: "layout", key: "layoutLabelColumnWidth", group: "조정 표", label: "항목 컬럼 너비", cssVar: "--layout-label-column-width", value: 220, unit: "px", units: ["px", "%"] },
  { page: "layout", key: "layoutValueColumnWidth", group: "조정 표", label: "값 컬럼 너비", cssVar: "--layout-value-column-width", value: 120, unit: "px", units: ["px", "%"] },
  { page: "layout", key: "layoutUnitColumnWidth", group: "조정 표", label: "단위 컬럼 너비", cssVar: "--layout-unit-column-width", value: 96, unit: "px", units: ["px", "%"] }
];

const LAYOUT_FRAME_DEFS = {
  common: {
    id: "commonPage",
    label: "공통 페이지",
    keys: ["pageHeight", "pagePaddingTop", "pagePaddingX", "pagePaddingBottom"],
    children: [
      { id: "commonPanel", label: "패널", keys: ["panelPadding", "panelMarginBottom"] },
      { id: "commonTable", label: "테이블", keys: ["dataTableCellPadding", "dataTableSelectWidth", "dataTableActionWidth"] },
      {
        id: "commonModal",
        label: "모달",
        keys: ["modalWidth", "modalMaxHeight", "modalPadding"],
        children: [
          { id: "commonForm", label: "입력 행", keys: ["formRowGap", "formRowMarginBottom"] }
        ]
      }
    ]
  },
  battle: {
    id: "battlePageFrame",
    label: "전투 페이지",
    keys: ["battlePageHeight"],
    children: [
      { id: "battleLeftFrame", label: "왼쪽 영역", keys: ["battleLeftWidth"] },
      {
        id: "battleCenterFrame",
        label: "가운데 영역",
        keys: ["battleCenterWidth"],
        children: [
          { id: "battleSelectionTableFrame", label: "선택 현황 표", keys: ["battleSelectionTableFontSize", "battleSelectionTablePadding", "battleSelectionNameWidth"] }
        ]
      },
      { id: "battleRightFrame", label: "오른쪽 영역", keys: ["battleRightWidth"] },
      {
        id: "battleModalFrame",
        label: "전투 모달",
        keys: ["battleModalWidth", "battleModalHeight", "battleModalPadding"],
        children: [
          { id: "battleModalSideFrame", label: "상태 패널", keys: ["battleSideWidth"] },
          { id: "battleModalFieldFrame", label: "전장 패널", keys: ["battleFieldWidth", "battleScreenGap"] }
        ]
      }
    ]
  },
  team: {
    id: "teamPageFrame",
    label: "팀 편성",
    keys: ["teamMinHeight"],
    children: [
      { id: "teamLeftFrame", label: "팀 목록", keys: ["teamLeftWidth"] },
      { id: "teamCenterFrame", label: "팀 편집", keys: [] },
      { id: "teamRightFrame", label: "캐릭터 목록", keys: ["teamRightWidth"] },
      { id: "teamMemberTableFrame", label: "멤버 표", keys: ["memberTableFontSize", "memberTableCellPadding"] }
    ]
  },
  stats: {
    id: "statsPageFrame",
    label: "스탯 관리",
    keys: ["statMinHeight"],
    children: [
      { id: "statsLeftFrame", label: "캐릭터 목록", keys: ["statLeftWidth"] },
      { id: "statsCenterFrame", label: "스탯 편집", keys: [] },
      { id: "statsRightFrame", label: "능력치 미리보기", keys: ["statRightWidth"] }
    ]
  },
  equipment: {
    id: "equipmentPageFrame",
    label: "장비 착용",
    keys: ["equipmentMinHeight"],
    children: [
      { id: "equipmentLeftFrame", label: "캐릭터 목록", keys: ["equipmentLeftWidth"] },
      {
        id: "equipmentCenterFrame",
        label: "장비 편집",
        keys: [],
        children: [
          { id: "equipmentSlotFrame", label: "장비 슬롯", keys: ["equipmentSlotMinWidth", "equipmentSlotGap", "equipmentSlotPadding", "equipmentSlotMinHeight", "equipmentSlotItemMinHeight"] }
        ]
      },
      { id: "equipmentRightFrame", label: "장비 리스트", keys: ["equipmentRightWidth", "equipmentTooltipWidth"] }
    ]
  },
  item: {
    id: "itemPageFrame",
    label: "아이템 관리",
    keys: [],
    children: [
      { id: "itemTableFrame", label: "아이템 표", keys: ["itemTableCellPadding"] },
      { id: "itemModalFrame", label: "아이템 모달", keys: ["modalWidth", "modalMaxHeight", "modalPadding", "formRowGap", "formRowMarginBottom"] }
    ]
  },
  skill: {
    id: "skillPageFrame",
    label: "스킬 관리",
    keys: [],
    children: [
      { id: "skillTableFrame", label: "스킬 표", keys: ["skillTableCellPadding"] },
      {
        id: "skillModalFrame",
        label: "스킬 모달",
        keys: ["skillModalWidth"],
        children: [
          { id: "skillActionFrame", label: "액션 카드", keys: ["skillActionMinColumn", "skillActionGap", "skillActionPadding"] },
          { id: "skillRangeFrame", label: "거리", keys: ["skillRangeOptionWidth"] },
          { id: "skillCoefficientFrame", label: "계수 행", keys: ["skillCoefficientTypeWidth", "skillCoefficientFieldWidth", "skillCoefficientCalcWidth", "skillCoefficientValueWidth"] },
          { id: "skillResourceCostFrame", label: "자원 소모", keys: ["skillResourceCostColumnWidth"] }
        ]
      }
    ]
  },
  category: {
    id: "categoryPageFrame",
    label: "장비 카테고리",
    keys: ["categoryRightWidth"],
    children: [
      { id: "categoryWeaponFrame", label: "무기 카테고리 표", keys: ["categoryTableCellPadding"] },
      { id: "categoryArmorFrame", label: "방어구 카테고리 표", keys: ["categoryTableCellPadding"] }
    ]
  },
  record: {
    id: "recordPageFrame",
    label: "전투 기록",
    keys: [],
    children: [
      { id: "recordTableFrame", label: "기록 표", keys: ["recordDateWidth", "recordResultWidth", "recordDurationWidth", "recordMemberFixedWidth", "recordMemberPadding"] }
    ]
  },
  layout: {
    id: "layoutPageFrame",
    label: "페이지 조정",
    keys: [],
    children: [
      { id: "layoutVisualFrame", label: "프레임 영역", keys: [] },
      { id: "layoutControlFrame", label: "선택 패널", keys: ["layoutGroupColumnWidth", "layoutLabelColumnWidth", "layoutValueColumnWidth", "layoutUnitColumnWidth"] }
    ]
  }
};

let layoutSettings = {};
let selectedLayoutPage = "common";
let selectedLayoutNodeId = "";

function cloneLayoutDefaults() {
  return LAYOUT_SETTING_DEFS.reduce((settings, def) => {
    settings[def.key] = { value: def.value, unit: def.unit };
    return settings;
  }, {});
}

function normalizeLayoutSettings(settings) {
  const source = settings && typeof settings === "object" ? settings : {};
  return LAYOUT_SETTING_DEFS.reduce((normalized, def) => {
    const raw = source[def.key] ?? {};
    const value = Number(raw.value);
    const unit = def.units.includes(raw.unit) ? raw.unit : def.unit;
    normalized[def.key] = {
      value: Number.isFinite(value) ? value : def.value,
      unit
    };
    return normalized;
  }, {});
}

function getLayoutCssValue(setting) {
  return `${setting.value}${setting.unit}`;
}

function applyLayoutSettings() {
  LAYOUT_SETTING_DEFS.forEach(def => {
    const setting = layoutSettings[def.key];
    if (setting) {
      document.documentElement.style.setProperty(def.cssVar, getLayoutCssValue(setting));
    }
  });

  if (typeof resizeCanvas === "function") {
    resizeCanvas();
  }
}

function loadLayoutSettings() {
  try {
    layoutSettings = normalizeLayoutSettings(JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) || "null"));
  } catch (error) {
    logError("layout", "페이지 조정값을 읽지 못했습니다.", error);
    layoutSettings = cloneLayoutDefaults();
  }
  applyLayoutSettings();
}

function saveLayoutSettings() {
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layoutSettings));
  applyLayoutSettings();
  log("페이지 조정값이 저장되었습니다.", "layout");
}

function resetLayoutSettings() {
  layoutSettings = cloneLayoutDefaults();
  saveLayoutSettings();
  renderLayoutSettingsPage();
}

function changeLayoutPageFilter(pageKey) {
  selectedLayoutPage = LAYOUT_PAGES.some(page => page.key === pageKey) ? pageKey : "common";
  selectedLayoutNodeId = "";
  renderLayoutSettingsPage();
}

function updateLayoutSetting(key, prop, value) {
  const def = LAYOUT_SETTING_DEFS.find(item => item.key === key);
  if (!def) {
    return;
  }

  const current = layoutSettings[key] ?? { value: def.value, unit: def.unit };
  if (prop === "value") {
    const number = Number(value);
    current.value = Number.isFinite(number) ? number : def.value;
  } else if (prop === "unit") {
    current.unit = def.units.includes(value) ? value : def.unit;
  }

  layoutSettings[key] = current;
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layoutSettings));
  applyLayoutSettings();
  renderLayoutCurrentValues();
}

function renderLayoutPageFilter() {
  if (!layoutPageFilterEl) {
    return;
  }

  layoutPageFilterEl.innerHTML = LAYOUT_PAGES
    .map(page => `<option value="${page.key}" ${page.key === selectedLayoutPage ? "selected" : ""}>${escapeHtml(page.label)}</option>`)
    .join("");
}

function renderLayoutSettingsPage() {
  if (!layoutFrameEl || !layoutSelectedControlsEl) {
    return;
  }

  renderLayoutPageFilter();
  const frame = LAYOUT_FRAME_DEFS[selectedLayoutPage] ?? LAYOUT_FRAME_DEFS.common;
  if (!selectedLayoutNodeId) {
    selectedLayoutNodeId = frame.id;
  }

  layoutFrameEl.innerHTML = renderLayoutFrameNode(frame);
  renderSelectedLayoutControls();
}

function renderLayoutFrameNode(node) {
  const selectedClass = node.id === selectedLayoutNodeId ? " selected" : "";
  const emptyClass = node.keys.length ? "" : " empty";
  const childrenHtml = (node.children ?? []).map(renderLayoutFrameNode).join("");

  return `
    <div class="layout-frame-node${selectedClass}${emptyClass}" role="button" tabindex="0" onclick="event.stopPropagation(); selectLayoutFrameNode('${node.id}')" onkeydown="handleLayoutFrameKey(event, '${node.id}')">
      <span>${escapeHtml(node.label)}</span>
      ${node.keys.length ? `<small>${node.keys.length}개 조정값</small>` : `<small>구조</small>`}
      ${childrenHtml ? `<div class="layout-frame-children">${childrenHtml}</div>` : ""}
    </div>
  `;
}

function handleLayoutFrameKey(event, nodeId) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    event.stopPropagation();
    selectLayoutFrameNode(nodeId);
  }
}

function selectLayoutFrameNode(nodeId) {
  selectedLayoutNodeId = nodeId;
  if (layoutFrameEl) {
    const frame = LAYOUT_FRAME_DEFS[selectedLayoutPage] ?? LAYOUT_FRAME_DEFS.common;
    layoutFrameEl.innerHTML = renderLayoutFrameNode(frame);
  }
  renderSelectedLayoutControls();
}

function findLayoutFrameNode(node, nodeId) {
  if (node.id === nodeId) {
    return node;
  }

  for (const child of node.children ?? []) {
    const found = findLayoutFrameNode(child, nodeId);
    if (found) {
      return found;
    }
  }

  return null;
}

function renderSelectedLayoutControls() {
  const frame = LAYOUT_FRAME_DEFS[selectedLayoutPage] ?? LAYOUT_FRAME_DEFS.common;
  const node = findLayoutFrameNode(frame, selectedLayoutNodeId) ?? frame;
  const defs = node.keys
    .map(key => LAYOUT_SETTING_DEFS.find(def => def.key === key))
    .filter(Boolean);

  if (layoutSelectionTitleEl) {
    layoutSelectionTitleEl.textContent = node.label;
  }

  if (layoutSelectionHintEl) {
    layoutSelectionHintEl.textContent = defs.length
      ? "선택한 프레임에 연결된 값을 조정합니다."
      : "이 프레임은 구조를 보여주는 영역입니다. 안쪽 네모를 선택하세요.";
  }

  layoutSelectedControlsEl.innerHTML = defs.length ? defs.map(def => {
    const setting = layoutSettings[def.key] ?? { value: def.value, unit: def.unit };
    return `
      <div class="layout-control-row">
        <div>
          <strong>${escapeHtml(def.label)}</strong>
          <small>${escapeHtml(def.group)}</small>
        </div>
        <div class="layout-control-inputs">
          <input
            class="layout-value-input"
            type="number"
            step="0.1"
            value="${setting.value}"
            onchange="updateLayoutSetting('${def.key}', 'value', this.value)"
          >
          <select class="layout-unit-select" onchange="updateLayoutSetting('${def.key}', 'unit', this.value)">
            ${def.units.map(unit => `<option value="${unit}" ${unit === setting.unit ? "selected" : ""}>${unit}</option>`).join("")}
          </select>
        </div>
        <code class="layout-current-value" data-layout-key="${def.key}">${escapeHtml(getLayoutCssValue(setting))}</code>
      </div>
    `;
  }).join("") : `<div class="empty-text">조정값이 직접 연결되지 않은 구조 프레임입니다.</div>`;

  renderLayoutCurrentValues();
}

function renderLayoutCurrentValues() {
  LAYOUT_SETTING_DEFS.forEach(def => {
    const cell = document.querySelector(`[data-layout-key="${def.key}"]`);
    if (cell) {
      cell.textContent = getLayoutCssValue(layoutSettings[def.key] ?? { value: def.value, unit: def.unit });
    }
  });
}
