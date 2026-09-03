/* Application bootstrap: event binding and initial rendering. */

function on(sel, event, handler) {
  const node = $(sel);
  if (node) node.addEventListener(event, handler);
}

const workspaceConfig = {
  toolbox: {
    title: "多模态神经功能解析与智能交互工具箱",
    subtitle: "Multimodal Neural Function Analysis and Intelligent Interaction Toolbox",
    defaultTab: "interactionDataManage",
  },
};

function showCoverPage() {
  $("#coverPage")?.classList.remove("hidden");
  $(".topbar")?.classList.add("hidden");
  $(".app-shell")?.classList.add("hidden");
  document.body.removeAttribute("data-workspace");
}

function setWorkspaceMode(mode) {
  const config = workspaceConfig[mode];
  if (!config) return;
  document.body.dataset.workspace = mode;
  $("#coverPage")?.classList.add("hidden");
  $(".topbar")?.classList.remove("hidden");
  $(".app-shell")?.classList.remove("hidden");
  if ($("#appTitle")) $("#appTitle").textContent = config.title;
  if ($("#appSubtitle")) $("#appSubtitle").textContent = config.subtitle;
  activatePanel(config.defaultTab);
}

function activatePanel(tabId) {
  $$(".nav-item").forEach((x) => x.classList.toggle("active", x.dataset.tab === tabId));
  $$(".panel").forEach((x) => x.classList.toggle("active", x.id === tabId));
  if (tabId === "interactionDataManage") renderCaseManage();
  if (tabId === "taskFeatureAnalysis") {
    renderPopulationOverview();
    renderTaskMapping();
    renderCaseReport();
    updateFeatureConnections();
  }
  if (tabId === "multimodalFeatureAnalysis") renderMultimodalIdeaBoard();
  if (tabId === "explorationValidation") loadTargets().catch(() => {});
}

$$(".nav-item").forEach((tab) => {
  tab.onclick = () => activatePanel(tab.dataset.tab);
});

$$(".workbench-tab").forEach((tab) => {
  tab.onclick = () => {
    const group = tab.closest(".workbench-tabs");
    if (!group) return;
    group.querySelectorAll(".workbench-tab").forEach((item) => item.classList.toggle("active", item === tab));
    const scope = group.parentElement;
    scope.querySelectorAll(".workbench-pane").forEach((pane) => pane.classList.toggle("active", pane.id === tab.dataset.subpanel));
    if (tab.dataset.subpanel === "taskMappingPane") setTimeout(updateFeatureConnections, 50);
    if (tab.dataset.subpanel === "taskDataOverviewPane") renderPopulationOverview();
    if (tab.dataset.subpanel === "caseReportPane") renderCaseReport();
    if (tab.dataset.subpanel === "multimodalMappingPane") renderMultimodalIdeaBoard();
    if (tab.dataset.subpanel === "multimodalExplorePane") loadTargets().catch(() => {});
  };
});

$$(".nav-group-head").forEach((btn) => {
  btn.onclick = () => {
    btn.classList.toggle("active");
    const panel = $(`[data-group-panel="${btn.dataset.group}"]`);
    if (panel) panel.classList.toggle("open");
  };
});

on("#toggleFeatureListBtn", "click", () => {
  featureListHidden = !featureListHidden;
  $("#toggleFeatureListBtn").textContent = featureListHidden ? "展开特征列表" : "隐藏特征列表";
  renderTaskMapping();
});

window.addEventListener("resize", () => updateFeatureConnections());

if ($("#refreshBtn")) $("#refreshBtn").onclick = () => {
  loadLabels()
    .then(loadTargets)
    .then(loadNsdCollectionOverview)
    .then(loadCaseDatabase)
    .then(loadExploreHistory)
    .catch((err) => alert(err.message));
};
if ($("#enterToolboxBtn")) $("#enterToolboxBtn").onclick = () => setWorkspaceMode("toolbox");
if ($("#backToCoverBtn")) $("#backToCoverBtn").onclick = () => showCoverPage();
if ($("#runMultiExploreBtn")) $("#runMultiExploreBtn").onclick = () => runMultiExplore();
if ($("#runFeatureAnalysisBtn")) $("#runFeatureAnalysisBtn").onclick = () => runFeatureAnalysis();
if ($("#runFusionModelBtn")) $("#runFusionModelBtn").onclick = () => runFusionModel();
if ($("#generateDemoDataBtn")) $("#generateDemoDataBtn").onclick = () => generateDemoData();
if ($("#clearHistoryBtn")) $("#clearHistoryBtn").onclick = () => clearExploreHistory();

applyFeatureConfigs();
renderPopulationOverview();
renderTaskMapping();
renderMultimodalIdeaBoard();
renderCaseBoards();

loadLabels()
  .then(loadTargets)
  .then(loadNsdCollectionOverview)
  .then(loadCaseDatabase)
  .then(loadExploreHistory)
  .catch((err) => {
    if ($("#caseManageBoard")) $("#caseManageBoard").innerHTML = `<section class="collection-overview-loading">初始化失败：${escapeHtml(err.message)}</section>`;
    console.error(err);
  });
