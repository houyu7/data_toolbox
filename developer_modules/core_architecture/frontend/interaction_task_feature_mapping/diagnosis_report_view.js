/* Diagnosis report view code. Module owners can edit case report layout and report asset rendering here. */

function renderCaseReport() {
  const node = $("#caseReportBoard");
  if (!node) return;
  const patient = activePatient();
  const patients = caseDatabase.patients || [];
  const tests = patient?.tests || [];
  if (!activeCaseReportKey || !tests.some((item) => caseTestKey(item) === activeCaseReportKey)) {
    activeCaseReportKey = tests[0] ? caseTestKey(tests[0]) : "";
  }
  const test = tests.find((item) => caseTestKey(item) === activeCaseReportKey) || tests[0] || {
    test_id: "line",
    test_name: "连线测试",
    test_time: "",
    score: 31.8,
    status: "normal",
    summary: "良好",
    channel: "笔式",
  };
  const task = canonicalTaskForCase(test);
  const reportConfig = window.TOOLBOX_TASK_REPORTS?.[task.id] || {};
  const reportImages = reportConfig.referenceImages || [];
  const status = test.status || "normal";
  const statusText = severityLabel(status);
  const score = Number(test.score || 31.8);
  const signalNames = signalNamesForTest(test);
  node.innerHTML = `
    <div class="case-report-layout">
      <aside class="case-report-selector">
        <label>选择用户
          <select id="caseReportPatientSelect">
            ${patients.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === patient?.id ? "selected" : ""}>${escapeHtml(item.name || item.id)} (${escapeHtml(item.id)})</option>`).join("")}
          </select>
        </label>
        <div class="report-test-list">
          <b>用户测试项目</b>
          ${tests.map((item) => `
            <button class="${caseTestKey(item) === activeCaseReportKey ? "active" : ""} ${escapeHtml(item.status || "normal")}" data-report-test="${escapeHtml(caseTestKey(item))}">
              <span>${escapeHtml(item.test_name)}</span>
              <small>${escapeHtml(item.test_time || "未知时间")} · ${escapeHtml(item.channel || canonicalTaskForCase(item).channel)}</small>
              <em>${escapeHtml(severityLabel(item.status || "normal"))}</em>
            </button>
          `).join("") || "<p>暂无测试报告。</p>"}
        </div>
      </aside>
      <section class="modern-case-report">
        <header class="modern-report-head">
          <div>
            <span>${escapeHtml(test.channel || task.channel)} / ${escapeHtml(test.test_id || task.id)}</span>
            <h3>${escapeHtml(reportConfig.reportTitle || `${test.test_name}测试报告`)}</h3>
            <p>${escapeHtml(reportConfig.description || task.description || "基于当前病例的单次任务数据生成诊断结果。")}</p>
          </div>
          <button class="secondary-btn">打印报告</button>
          <dl>
            <div><dt>姓名</dt><dd>${escapeHtml(patient?.name || "-")}</dd></div>
            <div><dt>编号</dt><dd>${escapeHtml(patient?.id || "-")}</dd></div>
            <div><dt>年龄</dt><dd>${escapeHtml(patient?.age || "-")}</dd></div>
            <div><dt>性别</dt><dd>${escapeHtml(patient?.sex || "-")}</dd></div>
            <div><dt>测试时间</dt><dd>${escapeHtml(test.test_time || "-")}</dd></div>
            <div><dt>结论</dt><dd><mark class="${escapeHtml(status)}">${escapeHtml(statusText)}</mark></dd></div>
          </dl>
          ${reportConfig.keyMetrics?.length ? `<div class="report-key-metrics">${reportConfig.keyMetrics.map((metric) => `<span>${escapeHtml(metric)}</span>`).join("")}</div>` : ""}
        </header>
        <div class="modern-report-grid">
          <section class="report-module trajectory-module">
            <h4>任务轨迹</h4>
            ${reportReferenceImg(reportImages[0] || "case_report_drawing.png", "绘图轨迹区域", task.id)}
          </section>
          <section class="report-module signal-module">
            <h4>过程信号</h4>
            ${reportReferenceImg(reportImages[1] || "case_report_signals.png", "压力、方位角、高度角过程信号", task.id)}
          </section>
          <section class="report-module report-bars">
            <h4>任务指标</h4>
            ${reportReferenceImg(reportImages[2] || "case_report_bars.png", "完成时间与错误次数", task.id)}
          </section>
          <section class="report-module feature-module">
            <h4>诊断特征</h4>
            ${reportReferenceImg(reportImages[3] || "case_report_features.png", "诊断特征分布", task.id)}
          </section>
          <section class="report-module scatter-module">
            <h4>分类模型</h4>
            ${reportReferenceImg(reportImages[4] || "case_report_scatter.png", "分类模型散点", task.id)}
          </section>
        </div>
        <footer class="modern-report-footer report-image-footer ${escapeHtml(status)}">
          ${renderReportConclusion(reportConfig, reportImages[5], task.id, test, patient, statusText)}
        </footer>
      </section>
    </div>
  `;
  const patientSelect = $("#caseReportPatientSelect");
  if (patientSelect) {
    patientSelect.onchange = () => {
      activePatientId = patientSelect.value;
      activeCaseReportKey = "";
      renderCaseBoards();
    };
  }
  $$("#caseReportBoard [data-report-test]").forEach((btn) => {
    btn.onclick = () => {
      activeCaseReportKey = btn.dataset.reportTest;
      renderCaseReport();
    };
  });
}

function renderReportConclusion(reportConfig, footerImage, taskId, test, patient, statusText) {
  const conclusion = reportConfig.conclusion || {};
  if (!conclusion.title && !conclusion.text && !conclusion.suggestions?.length) {
    return reportReferenceImg(footerImage || "case_report_footer.png", "诊断结论", taskId);
  }
  const suggestions = (conclusion.suggestions || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `
    <div class="report-conclusion-text">
      <span>${escapeHtml(conclusion.eyebrow || "诊断结论")}</span>
      <h4>${escapeHtml(conclusion.title || `${patient?.name || "当前病例"}${test.test_name || ""}：${statusText}`)}</h4>
      <p>${escapeHtml(conclusion.text || test.summary || "请结合任务轨迹、过程信号和诊断特征进行综合判断。")}</p>
      ${suggestions ? `<ul>${suggestions}</ul>` : ""}
    </div>`;
}

function reportReferenceImg(name, alt, taskId = "") {
  const source = String(name || "");
  const reportConfig = window.TOOLBOX_TASK_REPORTS?.[taskId] || {};
  const task = window.TOOLBOX_TASKS?.[taskId] || {};
  const channelSlug = channelSlugForTask(task);
  const assetBase = reportConfig.assetBase || `/developer_modules/interaction_channels/${escapeHtml(channelSlug)}/assets/${escapeHtml(taskId)}/diagnosis_report`;
  const src = source.startsWith("/") || source.startsWith("http")
    ? source
    : `${assetBase}/${escapeHtml(source.split("/").pop())}`;
  return `<img class="report-reference-img" src="${src}" alt="${escapeHtml(alt)}" />`;
}

function channelSlugForTask(task) {
  const channel = task?.channel || "";
  const map = {
    "笔式": "pen",
    "眼动": "eye",
    "语音": "speech",
    "姿态": "posture",
    "面部": "face",
    "手势": "gesture",
    "抓握": "grasp",
    "触觉": "tactile",
    "肌电": "emg",
    "心电": "ecg",
  };
  return map[channel] || "pen";
}

function caseTestKey(test) {
  return [test.test_id || "", test.test_time || "", test.file_path || ""].join("|");
}

function signalNamesForTest(test) {
  const channel = test.channel || "";
  if (channel.includes("语音")) return ["基频稳定性", "语速变化", "停顿比例"];
  if (channel.includes("眼动")) return ["扫视潜伏期", "追踪增益", "眨眼频率"];
  if (channel.includes("肌电")) return ["震颤功率", "激活延迟", "协同收缩"];
  if (channel.includes("姿态")) return ["步宽变化", "步高变化", "躯干摆动"];
  return ["压力均值", "方位角变异", "高度角变异"];
}

function reportFeatureNames(test) {
  const task = canonicalTaskForCase(test);
  return taskFeatureTemplates(task).slice(0, 6).map((item) => item.name);
}

function reportMetricValue(test, offset) {
  const seed = String(test.test_id || "") + String(test.test_time || "");
  const raw = Array.from(seed).reduce((sum, ch) => sum + ch.charCodeAt(0), 0) + offset * 37;
  return 8 + (raw % 92);
}

function renderReportTrajectory(taskId) {
  return `<div class="report-task-art">${renderMiniTaskArt(taskId || "line")}</div>`;
}

function renderReportSignal(name, idx, test) {
  const base = reportMetricValue(test, idx) / 100;
  const points = Array.from({ length: 12 }, (_, i) => {
    const x = 14 + i * 34;
    const y = 55 - base * 18 + Math.sin(i * 0.9 + idx) * 12 + Math.cos(i * 0.45 + idx) * 7;
    return `${x.toFixed(1)},${Math.max(12, Math.min(76, y)).toFixed(1)}`;
  }).join(" ");
  return `<div class="signal-card"><b>${escapeHtml(name)}：${(base * 100).toFixed(3)}</b><svg viewBox="0 0 420 88"><polyline points="${points}"/></svg></div>`;
}

function renderReportMetricBar(label, value, status) {
  return `<div><b>${escapeHtml(label)}</b><span>${Number(value).toFixed(4)}</span><i class="${escapeHtml(status)}" style="width:${Math.min(96, value)}%"></i></div>`;
}

function renderReportFeatureSpark(name, idx) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const x = 8 + i * 18;
    const y = 44 - Math.sin(i * 0.8 + idx) * 14 - Math.cos(i * 0.36 + idx) * 7;
    return `${x.toFixed(1)},${Math.max(8, Math.min(52, y)).toFixed(1)}`;
  }).join(" ");
  return `<div><b>${escapeHtml(name)}</b><svg viewBox="0 0 180 58"><polyline points="${points}"/></svg></div>`;
}

function renderReportScatter(status) {
  const statusClass = status === "danger" ? "danger" : status === "watch" ? "watch" : "normal";
  const dots = Array.from({ length: 140 }, (_, i) => `<circle cx="${28 + (i * 41) % 350}" cy="${28 + (i * 59) % 250}" r="4" class="${i % 5 === 0 ? "case" : i % 2 === 0 ? "control" : "disease"}"/>`).join("");
  return `<svg class="report-scatter ${escapeHtml(statusClass)}" viewBox="0 0 420 310"><path d="M30 20 V280 H390"/>${dots}<circle cx="138" cy="198" r="7" class="current"/></svg>`;
}

function canonicalTaskForCase(test) {
  const map = {
    tmta: "tmta",
    tmtb: "tmtb",
    clock: "clock",
    clockCopy: "clock",
    dial: "clock",
    drawshapes: "write",
    spiral: "write",
    spiralTrace: "write",
    spoon: "line",
    blocks: "line",
    doubletap: "line",
    gait: "posture",
    sound: "speech",
    mmse: "tmta",
    moca: "tmtb",
  };
  return allTasks().find((task) => task.id === (map[test.test_id] || test.test_id)) || activeTask();
}

function severityRank(status) {
  return { normal: 1, watch: 2, danger: 3 }[status] || 1;
}

function severityLabel(status) {
  return { normal: "正常", watch: "需注意", danger: "危险" }[status] || "正常";
}

function buildCaseZoneAssessments(tests) {
  const zones = new Map();
  tests.forEach((test) => {
    const task = canonicalTaskForCase(test);
    const status = test.status || (Number(test.score || 0) >= 82 ? "danger" : Number(test.score || 0) >= 65 ? "watch" : "normal");
    taskFeatureTemplates(task).slice(0, 5).forEach((feature) => {
      const existing = zones.get(feature.zone);
      if (!existing || severityRank(status) > severityRank(existing.status)) {
        zones.set(feature.zone, {
          zone: feature.zone,
          status,
          tests: [test.test_name],
          channels: [test.channel || task.channel],
          score: Number(test.score || 0),
        });
      } else if (existing) {
        existing.tests.push(test.test_name);
        existing.channels.push(test.channel || task.channel);
      }
    });
  });
  return Array.from(zones.values());
}

function renderCaseRegionMap(assessments) {
  const byZone = new Map(assessments.map((item) => [item.zone, item]));
  const point = (zone) => {
    const item = mappingZoneCatalog.find((entry) => entry.id === zone);
    const assessment = byZone.get(zone);
    if (!item || !assessment) return "";
    return `
      <button class="zone hot ${escapeHtml(assessment.status)}" data-zone="${escapeHtml(zone)}" title="${escapeHtml(item.label)}：${escapeHtml(severityLabel(assessment.status))}" style="left:${item.x}%;top:${item.y}%">
        <span class="region-zone-dot"></span>
      </button>`;
  };
  const worst = assessments.reduce((max, item) => Math.max(max, severityRank(item.status)), 0);
  const statusText = worst >= 3 ? "存在危险区域" : worst >= 2 ? "存在需注意区域" : "整体正常";
  return `
    <div class="case-region-wrap">
      <div class="case-map-legend">
        <span><i class="normal"></i>正常</span>
        <span><i class="watch"></i>需注意</span>
        <span><i class="danger"></i>危险</span>
        <b>${statusText}</b>
      </div>
      <div class="region-map-stage case-region-stage" aria-label="病例人体功能区域映射">
        <img class="human-region-img" src="/developer_modules/core_architecture/assets/human_region.png" alt="人体物理特征映射区域" />
        <div class="region-map-count">映射区域: ${assessments.length}处</div>
        <div class="body-zones">${mappingZoneCatalog.map((item) => point(item.id)).join("")}</div>
      </div>
    </div>`;
}

function renderCaseOverlayInsight(patient, tests, assessments) {
  const byChannel = {};
  tests.forEach((test) => {
    const channel = test.channel || canonicalTaskForCase(test).channel || "其他";
    const current = byChannel[channel] || { total: 0, normal: 0, watch: 0, danger: 0 };
    current.total += 1;
    current[test.status || "normal"] = (current[test.status || "normal"] || 0) + 1;
    byChannel[channel] = current;
  });
  const topZones = assessments
    .sort((a, b) => severityRank(b.status) - severityRank(a.status))
    .slice(0, 4)
    .map((item) => `${zoneLabel(item.zone)}(${severityLabel(item.status)})`);
  const worst = assessments.reduce((max, item) => Math.max(max, severityRank(item.status)), 0);
  const summary = worst >= 3
    ? "多任务结果提示存在高风险功能区域，建议优先复核红色区域对应任务的原始轨迹、压力或时序信号。"
    : worst >= 2
      ? "多个任务在部分功能区域出现轻中度异常聚集，建议结合单任务报告进一步确认稳定性。"
      : "当前已完成任务整体以正常区域为主，可继续补充其他通道提高综合判断覆盖度。";
  return `
    <div class="case-map-insight">
      <h3>叠加结论</h3>
      <div class="channel-diagnosis-list">
        ${Object.entries(byChannel).map(([channel, item]) => `
          <div>
            <b>${escapeHtml(channel)}</b>
            <span>正常 ${item.normal || 0} · 需注意 ${item.watch || 0} · 危险 ${item.danger || 0}</span>
          </div>
        `).join("") || "<p>暂无可叠加的测试结果。</p>"}
      </div>
      <p>${escapeHtml(patient?.name || "当前病例")} 已完成 ${tests.length} 项测试，主要映射区域为：${escapeHtml(topZones.join("、") || "暂无")}。</p>
      <p>${escapeHtml(summary)}</p>
    </div>`;
}

function renderCaseMapping() {
  const node = $("#caseMappingBoard");
  if (!node) return;
  const patient = activePatient();
  const patients = caseDatabase.patients || [];
  const tests = patient?.tests || [];
  const assessments = buildCaseZoneAssessments(tests);
  node.innerHTML = `
    <section class="case-map-summary">
      <div>
        <h3>${escapeHtml(patient?.name || "未选择病例")} / 多任务映射叠加</h3>
        <p>${escapeHtml(patient?.id || "-")} · ${escapeHtml(patient?.sex || "-")} · ${escapeHtml(patient?.education || "-")}</p>
      </div>
      <label>选择病例
        <select id="caseMappingPatientSelect">
          ${patients.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === patient?.id ? "selected" : ""}>${escapeHtml(item.name || item.id)} (${escapeHtml(item.id)})</option>`).join("")}
        </select>
      </label>
    </section>
    <section class="case-map-main">
      <div class="case-map-list"><b>已完成测试</b>${tests.map((test) => `<span class="${escapeHtml(test.status || "normal")}"><em>${escapeHtml(severityLabel(test.status || "normal"))}</em>${escapeHtml(test.test_name)}<small>${escapeHtml(test.test_time || "未知时间")} · ${escapeHtml(test.channel || canonicalTaskForCase(test).channel)}</small></span>`).join("") || "<span>暂无测试记录</span>"}</div>
      <div class="body-panel">${renderCaseRegionMap(assessments)}</div>
      ${renderCaseOverlayInsight(patient, tests, assessments)}
    </section>
  `;
  const select = $("#caseMappingPatientSelect");
  if (select) {
    select.onchange = () => {
      activePatientId = select.value;
      activeCaseReportKey = "";
      renderCaseReport();
      renderCaseMapping();
    };
  }
}
