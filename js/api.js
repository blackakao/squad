async function loadJsonFile(kind, defaults = []) {
  try {
    const response = await fetch(API_URLS[kind], { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    log(`${kind} 데이터를 불러왔습니다.`, "api");
    return data;
  } catch (error) {
    logError("api", `${kind} 데이터를 읽지 못해 기본 데이터를 사용합니다.`, error);
    return defaults.map(item => ({ ...item }));
  }
}

async function saveJsonFile(kind, data) {
  try {
    const response = await fetch(API_URLS[kind], {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`${kind} 저장 실패: HTTP ${response.status} ${responseText}`);
    }

    log(`${kind} 데이터가 저장되었습니다.`, "api");
  } catch (error) {
    logError("api", `${kind} 저장 요청이 실패했습니다.`, error);
    throw error;
  }
}
