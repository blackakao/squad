async function loadJsonFile(kind, defaults = []) {
  try {
    const response = await fetch(API_URLS[kind], { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    log(`${kind} 데이터를 읽지 못해 기본 데이터를 사용합니다.`);
    return defaults.map(item => ({ ...item }));
  }
}

async function saveJsonFile(kind, data) {
  const response = await fetch(API_URLS[kind], {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error(`${kind} 저장 실패`);
  }
}
