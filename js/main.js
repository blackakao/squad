resizeCanvas();
window.addEventListener("resize", resizeCanvas);

async function initApp() {
  await Promise.all([
    loadMonsterJson(),
    loadCharacterJson(),
    loadBattleRecordsJson()
  ]);

  initRoleOptions();
  refreshMonsterUI();
  refreshCharacterUI();
  renderBattleRecords();
  updateBattleButton();
  updateStatusUI();
  gameLoop();
}

initApp();
