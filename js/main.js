resizeCanvas();
window.addEventListener("resize", resizeCanvas);

async function initApp() {
  try {
    loadLayoutSettings();
    log("앱 초기화를 시작합니다.", "main");
    await Promise.all([
      loadMonsterJson(),
      loadFactionJson(),
      loadBattleRecordsJson(),
      loadCategoryJson()
    ]);
    await loadItemJson();
    await loadSkillJson();
    await loadCharacterJson();
    await loadTeamJson();

    initRoleOptions();
    refreshMonsterUI();
    refreshCharacterUI();
    renderBattleTeamButtons();
    renderBattleSelectionSummary();
    renderBattleRecords();
    renderItemPage();
    renderSkillPage();
    updateBattleButton();
    updateStatusUI();
    gameLoop();
    log("앱 초기화가 완료되었습니다.", "main");
  } catch (error) {
    logError("main", "앱 초기화 중 실패했습니다.", error);
    alert("앱 초기화 중 문제가 발생했습니다. 로그 페이지를 확인해주세요.");
  }
}

initApp();
