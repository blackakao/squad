const IMAGE_STYLE_SETTINGS_URL = "/api/image-settings";
const DEFAULT_PUTER_IMAGE_MODEL = "gpt-image-2";
const IMAGE_STYLE_PRESETS = [
  {
    key: "gamePortrait",
    label: "게임 초상화",
    prompt: "fantasy RPG character portrait, detailed face, clean silhouette, painterly digital art, neutral background, high quality"
  },
  {
    key: "monsterConcept",
    label: "몬스터 콘셉트",
    prompt: "fantasy monster concept art, full body, readable shape language, game asset design, dramatic but clear lighting"
  },
  {
    key: "skillIcon",
    label: "스킬 아이콘",
    prompt: "square fantasy skill icon, centered symbol, sharp readable design, polished game UI asset, high contrast"
  },
  {
    key: "itemIcon",
    label: "아이템 아이콘",
    prompt: "square fantasy item icon, centered object, clean game inventory asset, detailed material, readable at small size"
  },
  {
    key: "custom",
    label: "직접 입력",
    prompt: ""
  }
];

let generatedImageDataUrl = "";
let generatedImageUrl = "";
let imageGeneratorSettingsLoaded = false;
let imageGeneratorBusy = false;
let savedImageStyles = [];
let imageStyleLibraryReady = false;
let imageStyleLibraryBusy = false;

async function renderImageGeneratorPage() {
  populateImageStylePresets();
  if (!imageStyleLibraryReady) await loadImageStyleLibrary();

  if (!imageGeneratorSettingsLoaded) {
    imageGeneratorSettingsLoaded = true;
    await loadImageGeneratorSettings();
    await refreshPuterUsage(false, true);
  }
}

function imageStyleLibraryStatus(message) {
  const element = document.getElementById("imageStyleLibraryStatus");
  if (element) element.textContent = message;
}

function updateImageStyleLibraryControls() {
  const selected = savedImageStyles.some(style => style.id === getFieldValue("savedImageStyle"));
  for (const id of ["imageStyleCreate", "imageStyleLoad", "imageStyleUpdate", "imageStyleDelete"]) {
    const button = document.getElementById(id);
    if (button) button.disabled = imageStyleLibraryBusy || !imageStyleLibraryReady || (id !== "imageStyleCreate" && !selected);
  }
  for (const id of ["savedImageStyle", "imageStyleRefresh", "imageStyleName"]) {
    const element = document.getElementById(id);
    if (element) element.disabled = imageStyleLibraryBusy;
  }
}

function renderImageStyleLibrary(selectedId = getFieldValue("savedImageStyle")) {
  const select = document.getElementById("savedImageStyle");
  if (!select) return;
  select.replaceChildren(new Option(savedImageStyles.length ? "스타일 선택" : "저장된 스타일 없음", ""));
  for (const style of savedImageStyles) select.add(new Option(style.name, style.id));
  select.value = savedImageStyles.some(style => style.id === selectedId) ? selectedId : "";
  updateImageStyleLibraryControls();
}

async function loadImageStyleLibrary() {
  if (imageStyleLibraryBusy) return;
  imageStyleLibraryBusy = true;
  updateImageStyleLibraryControls();
  try {
    const response = await fetch("/api/image-styles", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const styles = await response.json();
    if (!Array.isArray(styles) || styles.some(style => !style || typeof style.id !== "string" || !style.id || typeof style.name !== "string" || typeof style.stylePrompt !== "string") || new Set(styles.map(style => style.id)).size !== styles.length) {
      throw new Error("저장된 스타일 목록 형식이 올바르지 않습니다.");
    }
    savedImageStyles = styles;
    imageStyleLibraryReady = true;
    renderImageStyleLibrary();
    imageStyleLibraryStatus(`${styles.length}개의 스타일을 불러왔습니다.`);
  } catch (error) {
    imageStyleLibraryReady = false;
    imageStyleLibraryStatus(`목록 로드 실패: ${getImageGeneratorErrorMessage(error)} 목록 새로고침으로 다시 시도하세요.`);
    logError("image-generator", "스타일 목록 로드 실패", error);
  } finally {
    imageStyleLibraryBusy = false;
    updateImageStyleLibraryControls();
  }
}

function selectSavedImageStyle() {
  const style = savedImageStyles.find(item => item.id === getFieldValue("savedImageStyle"));
  setFieldValue("imageStyleName", style?.name || "");
  updateImageStyleLibraryControls();
  imageStyleLibraryStatus(style ? `“${style.name}” 선택됨. 불러오기를 누르면 스타일 세팅에 적용합니다.` : "스타일을 선택하거나 새 이름을 입력하세요.");
}

function loadNamedImageStyle() {
  if (!imageStyleLibraryReady || imageStyleLibraryBusy) return;
  const style = savedImageStyles.find(item => item.id === getFieldValue("savedImageStyle"));
  if (!style) return;
  setFieldValue("imageStyleName", style.name);
  setFieldValue("imageStylePreset", "custom");
  setFieldValue("imageStylePrompt", style.stylePrompt);
  imageStyleLibraryStatus(`“${style.name}” 스타일을 적용했습니다. 내용을 바꾼 뒤 선택 스타일 수정으로 저장하세요.`);
}

async function persistImageStyleLibrary(next, selectedId, message) {
  imageStyleLibraryBusy = true;
  updateImageStyleLibraryControls();
  try {
    const response = await fetch("/api/image-styles", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next)
    });
    const result = await parseJsonResponse(response);
    if (!response.ok || !result?.ok) throw new Error(result?.error || `HTTP ${response.status}`);
    savedImageStyles = next;
    renderImageStyleLibrary(selectedId);
    setFieldValue("imageStyleName", next.find(style => style.id === selectedId)?.name || "");
    imageStyleLibraryStatus(message);
  } catch (error) {
    imageStyleLibraryStatus(`저장 실패: ${getImageGeneratorErrorMessage(error)} 입력 내용은 유지됩니다.`);
    logError("image-generator", "스타일 목록 저장 실패", error);
  } finally {
    imageStyleLibraryBusy = false;
    updateImageStyleLibraryControls();
  }
}

async function saveNamedImageStyle(updateExisting = false) {
  if (!imageStyleLibraryReady || imageStyleLibraryBusy) return;
  const name = getFieldValue("imageStyleName");
  const stylePrompt = getFieldValue("imageStylePrompt");
  const existing = updateExisting ? savedImageStyles.find(style => style.id === getFieldValue("savedImageStyle")) : null;
  if (updateExisting && !existing) return;
  if (!name || name.length > 80 || !stylePrompt) {
    imageStyleLibraryStatus("스타일 이름(1~80자)과 스타일 세팅을 입력하세요.");
    return;
  }
  if (savedImageStyles.some(style => style.id !== existing?.id && style.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    imageStyleLibraryStatus("같은 이름의 스타일이 있습니다. 다른 이름을 입력하거나 해당 스타일을 선택해 수정하세요.");
    return;
  }
  const style = { ...existing, id: existing?.id || crypto.randomUUID(), name, stylePrompt, updatedAt: new Date().toISOString() };
  const next = existing ? savedImageStyles.map(item => item.id === existing.id ? style : item) : [...savedImageStyles, style];
  await persistImageStyleLibrary(next, style.id, `“${name}” 스타일을 ${existing ? "수정" : "저장"}했습니다.`);
}

async function deleteNamedImageStyle() {
  if (!imageStyleLibraryReady || imageStyleLibraryBusy) return;
  const style = savedImageStyles.find(item => item.id === getFieldValue("savedImageStyle"));
  if (!style || !window.confirm(`“${style.name}” 스타일을 삭제할까요?`)) return;
  await persistImageStyleLibrary(savedImageStyles.filter(item => item.id !== style.id), "", `“${style.name}” 스타일을 삭제했습니다. 현재 스타일 세팅은 유지됩니다.`);
}

function populateImageStylePresets() {
  const presetSelect = document.getElementById("imageStylePreset");
  if (!presetSelect || presetSelect.dataset.ready === "true") {
    return;
  }

  presetSelect.innerHTML = IMAGE_STYLE_PRESETS
    .map(preset => `<option value="${preset.key}">${preset.label}</option>`)
    .join("");
  presetSelect.dataset.ready = "true";
  applyImageStylePreset("gamePortrait");
}

function applyImageStylePreset(key) {
  const preset = IMAGE_STYLE_PRESETS.find(item => item.key === key) ?? IMAGE_STYLE_PRESETS[0];
  const styleInput = document.getElementById("imageStylePrompt");
  if (styleInput && preset.key !== "custom") {
    styleInput.value = preset.prompt;
  }
}

async function loadImageGeneratorSettings() {
  try {
    const response = await fetch(IMAGE_STYLE_SETTINGS_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const settings = await response.json();
    applyImageGeneratorSettings(settings);
    if (settings?.updatedAt) {
      setImageGeneratorStatus(`저장된 스타일을 불러왔습니다. 마지막 저장: ${settings.updatedAt}`);
    }
  } catch (error) {
    logError("image-generator", "이미지 생성 설정을 불러오지 못했습니다.", error);
  }
}

function applyImageGeneratorSettings(settings = {}) {
  setFieldValue("imageAssetName", settings.assetName ?? "");
  setFieldValue("imageStylePreset", settings.stylePreset ?? "gamePortrait");
  setFieldValue("imageStylePrompt", settings.stylePrompt ?? IMAGE_STYLE_PRESETS[0].prompt);
  setFieldValue("imageProvider", settings.provider ?? "puter");
  setFieldValue("imageModel", settings.model ?? "");
  setFieldValue("imageWidth", settings.width ?? 768);
  setFieldValue("imageHeight", settings.height ?? 768);
  setFieldValue("imageSeed", settings.seed || "");
}

async function saveImageGeneratorSettings(fullPrompt = "") {
  const settings = getImageGeneratorSettings(fullPrompt);
  try {
    const response = await fetch(IMAGE_STYLE_SETTINGS_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status} ${text}`);
    }
  } catch (error) {
    logError("image-generator", "이미지 생성 설정을 저장하지 못했습니다.", error);
  }
}

function getImageGeneratorSettings(fullPrompt = "") {
  return {
    assetName: getFieldValue("imageAssetName"),
    stylePreset: getFieldValue("imageStylePreset"),
    stylePrompt: getFieldValue("imageStylePrompt"),
    provider: getFieldValue("imageProvider") || "puter",
    model: getFieldValue("imageModel"),
    width: Number(getFieldValue("imageWidth")) || 768,
    height: Number(getFieldValue("imageHeight")) || 768,
    seed: Number(getFieldValue("imageSeed")) || 0,
    finalPrompt: fullPrompt
  };
}

async function generateImageFromPrompt(event) {
  event.preventDefault();
  if (imageGeneratorBusy) return;

  const prompt = getFieldValue("imagePrompt");
  if (!prompt) {
    setImageGeneratorStatus("제시어를 입력하세요.");
    return;
  }
  for (const id of ["imageWidth", "imageHeight", "imageSeed"]) {
    const field = document.getElementById(id);
    if (field?.validity && !field.validity.valid) {
      setImageGeneratorStatus(`${id === "imageWidth" ? "가로" : id === "imageHeight" ? "세로" : "시드"} 값을 확인하세요. ${field.validationMessage}`);
      return;
    }
  }
  const settings = getImageGeneratorSettings();
  const fullPrompt = [prompt, settings.stylePrompt].filter(Boolean).join(", ");

  setImageGeneratorBusy(true, "이미지를 생성하고 있습니다...");

  try {
    if (settings.provider === "puter") {
      if (!window.puter?.ai?.txt2img) {
        throw new Error("Puter.js가 로드되지 않았습니다. 인터넷 연결을 확인하세요.");
      }

      const options = {
        model: settings.model || DEFAULT_PUTER_IMAGE_MODEL
      };
      const imageElement = await window.puter.ai.txt2img(fullPrompt, options);
      const imageSource = imageElement?.src || imageElement;
      if (typeof imageSource !== "string" || !imageSource) {
        throw new Error("Puter가 이미지 주소를 반환하지 않았습니다.");
      }
      setGeneratedImage(imageSource, "생성이 완료되었습니다. 마음에 들면 이미지 폴더에 저장하세요.");
    } else {
      const response = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          style: settings.stylePrompt,
          provider: settings.provider,
          model: settings.model,
          width: settings.width,
          height: settings.height,
          seed: settings.seed
        })
      });
      const result = await parseJsonResponse(response);

      if (!response.ok || !result?.dataUrl) {
        throw new Error(result?.error || `HTTP ${response.status}`);
      }

      setGeneratedImage(result.dataUrl, "생성이 완료되었습니다. 마음에 들면 이미지 폴더에 저장하세요.");
    }

    await saveImageGeneratorSettings(fullPrompt);
    if (settings.provider === "puter") {
      await refreshPuterUsage(false, true);
    }
  } catch (error) {
    const message = getImageGeneratorErrorMessage(error);
    logError("image-generator", "이미지 생성에 실패했습니다.", error);
    setImageGeneratorStatus(`생성 실패: ${message}`);
  } finally {
    setImageGeneratorBusy(false);
  }
}

async function saveGeneratedImage() {
  if (imageGeneratorBusy) return;
  if (!generatedImageDataUrl && !generatedImageUrl) {
    return;
  }

  const assetName = getFieldValue("imageAssetName") || getFieldValue("imagePrompt") || "generated-image";
  setImageGeneratorBusy(true, "이미지를 저장하고 있습니다...");

  try {
    const path = generatedImageDataUrl
      ? await uploadImageAsset("generated", generatedImageDataUrl, assetName)
      : await uploadImageAssetFromUrl("generated", generatedImageUrl, assetName);
    setImageGeneratorStatus("저장되었습니다.");
    document.getElementById("generatedImagePath").textContent = path;
  } catch (error) {
    const message = getImageGeneratorErrorMessage(error);
    logError("image-generator", "생성 이미지를 저장하지 못했습니다.", error);
    setImageGeneratorStatus(`저장 실패: ${message}`);
  } finally {
    setImageGeneratorBusy(false);
  }
}

async function openGeneratedImageFolder() {
  setImageGeneratorStatus("이미지 폴더를 여는 중입니다...");

  try {
    const response = await fetch("/api/open-folder/generated", { method: "POST" });
    const result = await parseJsonResponse(response);

    if (!response.ok || !result?.ok) {
      throw new Error(result?.error || `HTTP ${response.status}`);
    }

    setImageGeneratorStatus("이미지 폴더를 열었습니다.");
  } catch (error) {
    const message = getImageGeneratorErrorMessage(error);
    logError("image-generator", "이미지 폴더를 열지 못했습니다.", error);
    setImageGeneratorStatus(`폴더 열기 실패: ${message}`);
  }
}

async function parseJsonResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    const contentType = response.headers.get("Content-Type") || "";
    throw new Error(`서버가 JSON 대신 ${contentType || "알 수 없는 형식"} 응답을 반환했습니다. 서버를 최신 코드로 재시작해 주세요.`);
  }
}

async function refreshPuterUsage(showBusy = true, onlyWhenSignedIn = false) {
  const summaryEl = document.getElementById("imageUsageSummary");
  const meterFillEl = document.getElementById("imageUsageMeterFill");
  const button = document.getElementById("imageUsageRefreshButton");
  if (!summaryEl || !meterFillEl) {
    return;
  }

  if (showBusy) {
    summaryEl.textContent = "사용량을 불러오는 중...";
  }
  if (button) {
    button.disabled = true;
  }

  try {
    if (!window.puter?.auth?.getMonthlyUsage) {
      throw new Error("Puter 사용량 API를 사용할 수 없습니다.");
    }
    if (onlyWhenSignedIn && window.puter.auth.isSignedIn && !window.puter.auth.isSignedIn()) {
      summaryEl.textContent = "Puter 로그인 후 새로고침하면 사용량을 볼 수 있습니다.";
      setPuterUsageMeter(0);
      return;
    }

    const usage = await window.puter.auth.getMonthlyUsage();
    renderPuterUsage(usage);
  } catch (error) {
    const message = getImageGeneratorErrorMessage(error);
    summaryEl.textContent = `사용량 조회 실패: ${message}`;
    setPuterUsageMeter(0);
    logError("image-generator", "Puter 사용량을 불러오지 못했습니다.", error);
  } finally {
    if (button) {
      button.disabled = false;
    }
  }
}

function renderPuterUsage(usage) {
  const summaryEl = document.getElementById("imageUsageSummary");
  const allowance = usage?.allowanceInfo ?? {};
  const remaining = Number(allowance.remaining);
  const allowanceTotal = Number(allowance.monthUsageAllowance);

  if (!Number.isFinite(remaining) || !Number.isFinite(allowanceTotal) || allowanceTotal <= 0) {
    setPuterUsageMeter(0);
    summaryEl.textContent = "남은 사용량을 계산할 수 없습니다.";
    return;
  }

  const percent = Math.max(0, Math.min(100, Math.round((remaining / allowanceTotal) * 100)));
  setPuterUsageMeter(percent);
  summaryEl.textContent = `남은 사용량 ${percent}%`;
}

function setPuterUsageMeter(percent) {
  const meterFillEl = document.getElementById("imageUsageMeterFill");
  if (!meterFillEl) {
    return;
  }

  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  meterFillEl.style.width = `${value}%`;
  if (value <= 20) {
    meterFillEl.style.backgroundColor = "var(--bs-danger)";
  } else if (value <= 50) {
    meterFillEl.style.backgroundColor = "var(--bs-warning)";
  } else {
    meterFillEl.style.backgroundColor = "var(--bs-success)";
  }
}

function getImageGeneratorErrorMessage(error) {
  if (!error) {
    return "알 수 없는 오류";
  }
  if (typeof error === "string") {
    return error;
  }
  if (error.error && error.error !== error) {
    return getImageGeneratorErrorMessage(error.error);
  }
  if (error.message) {
    return error.message;
  }
  if (error.msg) {
    return error.msg;
  }

  const details = [error.code, error.errorCode].filter(Boolean).join(" / ");
  if (details) {
    return details;
  }

  try {
    return JSON.stringify(error);
  } catch (jsonError) {
    return String(error);
  }
}

function setGeneratedImage(imageSource, statusText) {
  generatedImageDataUrl = imageSource?.startsWith("data:image/") ? imageSource : "";
  generatedImageUrl = imageSource && !generatedImageDataUrl ? imageSource : "";
  const preview = document.getElementById("generatedImagePreview");
  const saveButton = document.getElementById("imageSaveButton");
  const pathEl = document.getElementById("generatedImagePath");

  if (preview) {
    preview.src = imageSource;
    preview.classList.toggle("has-image", Boolean(imageSource));
  }
  if (saveButton) {
    saveButton.disabled = !imageSource;
  }
  if (pathEl) {
    pathEl.textContent = "";
  }
  if (statusText) {
    setImageGeneratorStatus(statusText);
  }
}

function setImageGeneratorBusy(isBusy, statusText = "") {
  imageGeneratorBusy = isBusy;
  const generateButton = document.getElementById("imageGenerateButton");
  const saveButton = document.getElementById("imageSaveButton");

  if (generateButton) {
    generateButton.disabled = isBusy;
  }
  if (saveButton) {
    saveButton.disabled = isBusy || (!generatedImageDataUrl && !generatedImageUrl);
  }
  if (statusText) {
    setImageGeneratorStatus(statusText);
  }
}

function setImageGeneratorStatus(message) {
  const actionStatus = document.getElementById("imageActionStatus");
  if (actionStatus) actionStatus.textContent = message;
  const statusEl = document.getElementById("imageGeneratorStatus");
  if (statusEl) {
    statusEl.textContent = message;
  }
}

function getFieldValue(id) {
  return document.getElementById(id)?.value?.trim() ?? "";
}

function setFieldValue(id, value) {
  const field = document.getElementById(id);
  if (field) {
    field.value = value;
  }
}
