// Browser-only portrait editor functions. Loaded after ui.js.
function getPortraitElements(type) {
  if (type === "monster") {
    return { input: monsterPortraitEl, preview: monsterPortraitPreviewEl };
  }

  return { input: characterPortraitEl, preview: characterPortraitPreviewEl };
}

function setPortraitPreview(type, dataUrl) {
  const { preview } = getPortraitElements(type);
  if (!preview) {
    return;
  }

  const portrait = normalizePortrait(dataUrl);
  preview.src = portrait;
  preview.classList.toggle("hidden", !portrait);
  if (type === 'character' && typeof renderCharacterIdentity === 'function') renderCharacterIdentity();
}

function resetPortraitDraft(type, dataUrl = "") {
  const { input } = getPortraitElements(type);
  if (input) {
    input.value = "";
  }

  portraitDrafts[type] = { dataUrl: normalizePortrait(dataUrl), cleared: false };
  setPortraitPreview(type, dataUrl);
}

function clearPortrait(type) {
  if (type === "character") resetPortraitAppearance();
  const { input } = getPortraitElements(type);
  if (input) {
    input.value = "";
  }

  portraitDrafts[type] = { dataUrl: "", cleared: true };
  setPortraitPreview(type, "");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

async function resizePortraitDataUrl(dataUrl) {
  const image = await loadImage(dataUrl);
  const ratio = Math.min(1, PORTRAIT_MAX_SIZE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const buffer = document.createElement("canvas");
  const bufferCtx = buffer.getContext("2d");

  buffer.width = width;
  buffer.height = height;
  bufferCtx.drawImage(image, 0, 0, width, height);
  return buffer.toDataURL("image/png");
}

async function previewPortraitFile(type) {
  const { input } = getPortraitElements(type);
  const file = input?.files?.[0];

  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/")) {
    alert("이미지 파일을 선택해주세요.");
    input.value = "";
    return;
  }

  if (file.size > PORTRAIT_MAX_FILE_SIZE) {
    alert("초상화 파일은 5MB 이하로 선택해주세요.");
    input.value = "";
    return;
  }

  try {
    const dataUrl = await resizePortraitDataUrl(await readFileAsDataUrl(file));
    if (type === "character") resetPortraitAppearance();
    portraitDrafts[type] = { dataUrl, cleared: false };
    setPortraitPreview(type, dataUrl);
  } catch (error) {
    logError("portrait", "초상화 파일을 읽는 중 실패했습니다.", error);
    alert("초상화 파일을 읽지 못했습니다.");
    input.value = "";
  }
}

async function getPortraitForSave(type, previousPortrait = "", assetName = "") {
  const draft = portraitDrafts[type] ?? { dataUrl: "", cleared: false };
  const { input } = getPortraitElements(type);

  if (draft.cleared) {
    return "";
  }

  if (!draft.dataUrl && input?.files?.[0]) {
    const file = input.files[0];
    if (file.type.startsWith("image/") && file.size <= PORTRAIT_MAX_FILE_SIZE) {
      try {
        const dataUrl = await resizePortraitDataUrl(await readFileAsDataUrl(file));
        portraitDrafts[type] = { dataUrl, cleared: false };
        setPortraitPreview(type, dataUrl);
        return await uploadImageAsset("portraits", dataUrl, assetName || type);
      } catch (error) {
        logError("portrait", "초상화 파일을 읽는 중 실패했습니다.", error);
        alert("초상화 파일을 읽지 못했습니다.");
      }
    }
  }

  if (normalizePortrait(draft.dataUrl).startsWith("data:image/")) {
    return await uploadImageAsset("portraits", draft.dataUrl, assetName || type);
  }

  return normalizePortrait(draft.dataUrl) || normalizePortrait(previousPortrait);
}


// Portrait thumbnail and browser image cache.
function renderPortraitCell(portrait, label) {
  const normalizedPortrait = normalizePortrait(portrait);

  if (!normalizedPortrait) {
    return `<span class="empty-text">없음</span>`;
  }

  return `<img class="portrait-thumb" src="${normalizedPortrait}" alt="${escapeHtml(label)} 초상화">`;
}

function getCachedPortraitImage(portrait) {
  const normalizedPortrait = normalizePortrait(portrait);

  if (!normalizedPortrait) {
    return null;
  }

  const cached = portraitImageCache.get(normalizedPortrait);
  if (cached) {
    return cached;
  }

  const image = new Image();
  image.src = normalizedPortrait;
  portraitImageCache.set(normalizedPortrait, image);
  return image;
}

