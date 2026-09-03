/* Interaction data management view code. Module owners can edit collection overview, patient list, and NSD launcher UI here. */

async function loadCaseDatabase() {
  try {
    caseDatabase = await api("/api/nsd-cases");
  } catch (err) {
    caseDatabase = await api("/api/cases");
  }
  if (!activePatientId && caseDatabase.patients[0]) activePatientId = caseDatabase.patients[0].id;
  renderCaseBoards();
}

async function loadNsdCollectionOverview() {
  try {
    nsdCollectionOverview = await api("/api/nsd-collection-overview");
  } catch (err) {
    const fallbackLabels = ["笔式", "抓握", "姿态", "手势", "眼动", "触觉", "肌电", "心电", "语音", "面部"];
    nsdCollectionOverview = {
      database_exists: false,
      exe_exists: false,
      totals: { channels: 11, patients: 0, records: 0, batches: 0, size_bytes: 0, recent_import: "" },
      channels: fallbackLabels.map((label) => ({ label, batch_count: 0, file_count: 0, size_bytes: 0, kind_counts: {}, recent_import: "" })),
    };
  }
  renderCaseManage();
}

function activePatient() {
  return (caseDatabase.patients || []).find((item) => item.id === activePatientId) || (caseDatabase.patients || [])[0];
}

function renderCaseBoards() {
  renderCaseManage();
  renderCaseReport();
  renderCaseMapping();
}

function renderCaseManage() {
  const node = $("#caseManageBoard");
  if (!node) return;
  const config = getFeatureConfig("interactionDataManagement");
  const overview = nsdCollectionOverview;
  if (!overview) {
    node.innerHTML = `<section class="collection-overview-loading">正在读取本地采集数据库...</section>`;
    loadNsdCollectionOverview();
    return;
  }
  const totals = overview.totals || {};
  const channels = overview.channels || [];
  node.innerHTML = `
    <section class="collection-overview-hero">
      <div>
        <h3>${escapeHtml(config.title || "采集概览")}</h3>
        <p>${escapeHtml(config.subtitle || "NSDDataSystem Local Collection Overview")}</p>
      </div>
      <button id="openNsdSystemBtn">${escapeHtml(config.launchButtonText || "打开采集系统")}</button>
    </section>
    <section class="collection-total-grid">
      <div><span>本地数据库</span><b>${overview.database_exists ? "已连接" : "未找到"}</b></div>
      <div><span>病例数</span><b>${Number(totals.patients || 0).toLocaleString()}</b></div>
      <div><span>采集记录</span><b>${Number(totals.records || 0).toLocaleString()}</b></div>
      <div><span>覆盖通道</span><b>${Number(totals.channels || 0).toLocaleString()}</b></div>
      <div><span>数据容量</span><b>${formatBytes(totals.size_bytes || 0)}</b></div>
      <div><span>最近采集</span><b>${escapeHtml(totals.recent_import || "暂无")}</b></div>
    </section>
    <section class="collection-channel-grid">
      ${channels.map((channel) => renderCollectionChannelCard(channel)).join("")}
    </section>
  `;
  $("#openNsdSystemBtn").onclick = launchNsdSystem;
}

function renderCollectionChannelCard(channel) {
  const config = getFeatureConfig("interactionDataManagement");
  const kinds = Object.entries(channel.kind_counts || {});
  return `
    <article class="collection-channel-card ${channel.file_count ? "" : "empty"}">
      <h3>${escapeHtml(channel.label)}</h3>
      <div class="collection-card-stats">
        <div><span>批次</span><b>${channel.batch_count || 0}</b></div>
        <div><span>记录</span><b>${channel.file_count || 0}</b></div>
        <div><span>容量</span><b>${formatBytes(channel.size_bytes || 0)}</b></div>
      </div>
      <div class="collection-tags">
        ${kinds.length ? kinds.map(([name, count]) => `<span>${escapeHtml(name)} ${count}</span>`).join("") : `<span>${escapeHtml(config.emptyText || "暂无数据")}</span>`}
      </div>
      <footer>最近采集：${escapeHtml(channel.recent_import || "暂无")}</footer>
    </article>`;
}

async function launchNsdSystem() {
  const btn = $("#openNsdSystemBtn");
  if (btn) btn.textContent = "正在打开...";
  try {
    await api("/api/launch-nsd-data-system", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (btn) btn.textContent = "已打开采集系统";
  } catch (err) {
    alert(err.message || "采集系统启动失败");
    if (btn) btn.textContent = "打开采集系统";
  }
}

function renderPatientDetail(patient) {
  return `
    <div class="patient-profile">
      <h3>${escapeHtml(patient.name)} <small>${escapeHtml(patient.id)}</small></h3>
      <p>${escapeHtml(patient.sex || "-")} · ${escapeHtml(patient.age || "-")} 岁 · ${escapeHtml(patient.handedness || "-")} · ${escapeHtml(patient.education || "-")} · ${escapeHtml(patient.label || "-")}</p>
      <button id="startPatientTestBtn">开始测试</button>
    </div>
    <table><tr><th>测试名</th><th>测试时间</th><th>文件路径</th><th>结果</th></tr>
      ${(patient.tests || []).map((test) => `<tr><td>${escapeHtml(test.test_name)}</td><td>${escapeHtml(test.test_time)}</td><td>${escapeHtml(test.file_path)}</td><td>${escapeHtml(test.summary || "")}</td></tr>`).join("") || "<tr><td colspan='4'>暂无测试记录</td></tr>"}
    </table>
  `;
}

async function registerPatientFromForm() {
  const payload = {
    id: $("#caseIdInput").value,
    name: $("#caseNameInput").value,
    age: $("#caseAgeInput").value,
    sex: $("#caseSexInput").value,
    handedness: $("#caseHandInput").value,
    education: $("#caseEduInput").value,
    label: $("#caseLabelInput").value,
  };
  const result = await api("/api/register-patient", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  caseDatabase = { patients: result.patients || [] };
  activePatientId = result.patient.id;
  renderCaseBoards();
}

async function addDemoPatientTest() {
  const patient = activePatient();
  if (!patient) return;
  const task = activeTask();
  const result = await api("/api/add-patient-test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patient_id: patient.id, test_id: task.id, test_name: task.name, file_path: `Data/${task.channel}/${task.id}_${Date.now()}.csv`, score: 0, summary: "已创建测试记录，等待 exe 写入结果" }),
  });
  caseDatabase = { patients: result.patients || [] };
  renderCaseBoards();
}
