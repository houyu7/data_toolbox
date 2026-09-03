/* Data overview view code. Module owners can edit task overview rendering here. */

function taskMetrics(task) {
  const seed = task.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return {
    samples: 186 + (seed % 72),
    controls: 64 + (seed % 18),
    mci: 42 + (seed % 13),
    disease: 35 + (seed % 16),
    features: 96 + (seed % 8) * 34,
    missing: (2.4 + (seed % 8) * 0.7).toFixed(1),
  };
}

function renderMiniTaskArt(type) {
  if (typeof type === "string" && (type.startsWith("/") || type.startsWith("http"))) {
    return `<img class="task-art" src="${escapeHtml(type)}" alt="任务示例图" />`;
  }
  const assets = {
    trail: "/developer_modules/core_architecture/assets/task_trail.png",
    switch: "/developer_modules/core_architecture/assets/task_switch.png",
    clock: "/developer_modules/core_architecture/assets/task_clock.png",
    line: "/developer_modules/core_architecture/assets/task_line.png",
    write: "/developer_modules/core_architecture/assets/task_write.png",
  };
  return `<img class="task-art" src="${assets[type] || assets.trail}" alt="任务示例图" />`;
}

function renderDistributionChart(task) {
  const colors = ["#4f7cff", "#38bdf8", "#f0a36a"];
  const labels = ["健康对照", "MCI", "疾病组"];
  const lines = labels.map((label, idx) => {
    const points = Array.from({ length: 18 }, (_, i) => {
      const x = 28 + i * 18;
      const y = 100 - Math.sin((i + idx * 2 + task.id.length) / 2.2) * (18 + idx * 5) - idx * 8;
      return `${x},${y}`;
    }).join(" ");
    return `<polyline points="${points}" style="--line-color:${colors[idx]}"></polyline>`;
  }).join("");
  const legend = labels.map((label, idx) => `<span><i style="background:${colors[idx]}"></i>${label}</span>`).join("");
  return `
    <div class="dist-card">
      <div class="dist-head"><h3>数据特征分布</h3><div>${legend}</div></div>
      <svg class="dist-chart" viewBox="0 0 360 130" aria-label="特征分布曲线">
        <g class="grid-lines"><path d="M24 24 H342 M24 60 H342 M24 96 H342"/></g>
        ${lines}
      </svg>
    </div>
  `;
}

function buildLocalTaskDataset(task) {
  const seed = task.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const overviewConfig = window.TOOLBOX_TASK_OVERVIEWS?.[task.id] || {};
  const diseases = overviewConfig.diseases || [
    { label: "健康对照", en: "Control", color: "#ff4f7b", count: 420 + (seed % 6) * 18, shift: 0.2 },
    { label: "轻度认知障碍", en: "MCI", color: "#f59e0b", count: 760 + (seed % 7) * 22, shift: 1.3 },
    { label: "帕金森病", en: "PD", color: "#8b5cf6", count: 520 + (seed % 5) * 17, shift: 2.0 },
    { label: "脑卒中", en: "Stroke", color: "#22c55e", count: 460 + (seed % 4) * 14, shift: 2.6 },
    { label: "阿尔茨海默症", en: "AD", color: "#2f80ed", count: 640 + (seed % 8) * 20, shift: 3.2 },
  ];
  const ageBuckets = overviewConfig.ageBuckets || ["20-30", "30-40", "40-50", "50-60", "60-70", "70-80", "80+"].map((label, index) => ({
    label,
    count: Math.round(280 + Math.abs(Math.sin((seed + index) / 2.1)) * 820 + (index === 3 ? 330 : 0)),
  }));
  const configuredFeatures = (overviewConfig.distributionFeatures || []).map((item, index) => {
    if (typeof item === "string") {
      return [item, item, 24 + ((seed + index * 13) % 70), `configured_${index}`, ""];
    }
    return [
      item.cn || item.name || `特征${index + 1}`,
      item.en || item.name || `Feature ${index + 1}`,
      item.max || 24 + ((seed + index * 13) % 70),
      item.key || `configured_${index}`,
      item.image || "",
    ];
  });
  const features = (configuredFeatures.length ? configuredFeatures : [
    ["画线速度", "Drawing Speed", 6, "speed", ""],
    ["画线长度", "Drawing Length", 60, "length", ""],
    ["画线时长", "Drawing Duration", 200, "duration", ""],
    ["抬笔次数", "Pen Lifts", 12, "lift", ""],
    ["笔压变异", "Pressure Variation", 50, "pressure", ""],
    ["错误率", "Error Rate", 40, "error", ""],
  ]).map(([cn, en, max, key, image], index) => ({ cn, en, max, key, image, offset: index * 0.35 + (seed % 5) * 0.1 }));
  const total = diseases.reduce((sum, item) => sum + item.count, 0);
  const statistics = overviewConfig.statistics || {};
  const participants = statistics.participants || total;
  const male = statistics.male || Math.round(participants * (0.49 + (seed % 3) * 0.015));
  return {
    totalRows: statistics.totalRows || total * (3 + (seed % 3)),
    participants,
    male,
    female: statistics.female || Math.max(0, participants - male),
    diseases,
    ageBuckets,
    features,
    ageDistributionImage: overviewConfig.ageDistributionImage || "",
    diseaseDistributionImage: overviewConfig.diseaseDistributionImage || "",
  };
}

function renderAgeDistribution(dataset) {
  if (dataset.ageDistributionImage) {
    return `
      <div class="overview-chart-card image-chart-card">
        <h4>被试年龄分布</h4>
        <img src="${escapeHtml(dataset.ageDistributionImage)}" alt="被试年龄分布" />
      </div>`;
  }
  const max = Math.max(...dataset.ageBuckets.map((item) => item.count));
  return `
    <div class="overview-chart-card">
      <h4>被试年龄分布</h4>
      <div class="age-bars">
        ${dataset.ageBuckets.map((item) => `<div><i style="height:${Math.max(18, item.count / max * 150)}px"></i><span>${item.label}</span></div>`).join("")}
      </div>
    </div>`;
}

function renderDiseaseDistribution(dataset) {
  if (dataset.diseaseDistributionImage) {
    return `
      <div class="overview-chart-card image-chart-card">
        <h4>疾病类型分布</h4>
        <img src="${escapeHtml(dataset.diseaseDistributionImage)}" alt="疾病类型分布" />
      </div>`;
  }
  const max = Math.max(...dataset.diseases.map((item) => item.count));
  return `
    <div class="overview-chart-card">
      <h4>疾病类型分布</h4>
      <div class="disease-bars">
        ${dataset.diseases.map((item) => `
          <div>
            <i style="--bar:${item.color};width:${Math.max(16, item.count / max * 74)}%"></i>
            <span>${escapeHtml(item.label)} ${item.count}人</span>
          </div>
        `).join("")}
      </div>
    </div>`;
}

function renderFeatureDensityChart(dataset, feature) {
  if (feature.image) {
    return `
      <article class="feature-density-card image-feature-card">
        <h4>${escapeHtml(feature.cn)} <span>${escapeHtml(feature.en)}</span></h4>
        <img src="${escapeHtml(feature.image)}" alt="${escapeHtml(feature.cn)}分布" />
      </article>`;
  }
  const lines = dataset.diseases.map((group, groupIndex) => {
    const points = Array.from({ length: 42 }, (_, i) => {
      const x = 34 + i * 10.8;
      const ratio = i / 41;
      const center = 0.2 + group.shift * 0.15 + feature.offset * 0.08;
      const spread = 0.13 + groupIndex * 0.012;
      const y = 214 - Math.exp(-Math.pow(ratio - center, 2) / (2 * spread * spread)) * (90 + groupIndex * 12);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    return `<polyline points="${points}" style="--line-color:${group.color}"></polyline>`;
  }).join("");
  return `
    <article class="feature-density-card">
      <h4>${escapeHtml(feature.cn)} <span>${escapeHtml(feature.en)}</span></h4>
      <svg class="feature-density-chart" viewBox="0 0 520 250" aria-label="${escapeHtml(feature.cn)}分布">
        <g class="chart-grid"><path d="M34 34 H500 M34 82 H500 M34 130 H500 M34 178 H500 M34 226 H500 M34 34 V226"/></g>
        ${lines}
      </svg>
      <div class="density-legend">${dataset.diseases.map((group) => `<span><i style="background:${group.color}"></i>${escapeHtml(group.label)}</span>`).join("")}</div>
    </article>`;
}

function renderTaskTree() {
  const node = $("#taskTree");
  if (!node) return;
  node.innerHTML = taskCatalog.map((group) => `
    <div class="mapping-task-group">
      <div class="mapping-task-group-title"><span>${escapeHtml(group.icon)}</span>${escapeHtml(group.channel)}</div>
      ${group.tasks.map((task) => `<button class="${task.id === activeTaskId ? "active" : ""}" data-task-id="${escapeHtml(task.id)}">${escapeHtml(task.name)}</button>`).join("")}
    </div>
  `).join("");
  $$("#taskTree [data-task-id]").forEach((btn) => {
    btn.onclick = () => {
      activeTaskId = btn.dataset.taskId;
      renderPopulationOverview();
      renderTaskMapping();
    };
  });
}

function renderPopulationOverview() {
  const task = activeTask();
  const profile = mappingTaskProfiles[task.id] || mappingTaskProfiles.tmta;
  const overviewConfig = window.TOOLBOX_TASK_OVERVIEWS?.[task.id] || {};
  const dataset = buildLocalTaskDataset(task);
  dataset.female = dataset.participants - dataset.male;
  const node = $("#populationTaskDetail");
  if (!node) return;
  renderTaskTree();
  node.innerHTML = `
    <div class="data-view-title">
      <h3>${escapeHtml(task.name)} 测试数据概览</h3>
      <span>${escapeHtml(task.channel)} / ${escapeHtml(task.name)}</span>
    </div>
    <section class="task-hero">
      ${renderMiniTaskArt(overviewConfig.image || profile.image || task.image)}
      <div>
        <h3>${escapeHtml(task.name)} 测试任务概述</h3>
        <p>${escapeHtml(overviewConfig.desc || profile.desc || task.desc)}</p>
        <div class="task-meta-line">
          <span>测试时长：约3-5分钟</span>
          <span>适用年龄：18-90岁</span>
          <span>评估维度：${taskFeatureTemplates(task).slice(0, 3).map((feature) => escapeHtml(feature.tag)).join("、")}</span>
        </div>
      </div>
    </section>
    <section class="overview-block">
      <h3>总体统计</h3>
      <div class="overview-strip overview-strip-large">
        <div><span>数据总量</span><b>${dataset.totalRows.toLocaleString()}条</b></div>
        <div><span>被试人数</span><b>${dataset.participants.toLocaleString()}人</b></div>
        <div><span><i style="background:#2f80ed"></i>男性被试</span><b>${dataset.male.toLocaleString()}人</b></div>
        <div><span><i style="background:#ff4f9a"></i>女性被试</span><b>${dataset.female.toLocaleString()}人</b></div>
      </div>
      <div class="overview-chart-grid">
        ${renderAgeDistribution(dataset)}
        ${renderDiseaseDistribution(dataset)}
      </div>
    </section>
    <section class="feature-distribution-block">
      <div>
        <h3>数据特征分布</h3>
        <p>各项测试特征按疾病类型的分布情况</p>
      </div>
      <div class="feature-density-grid">
        ${dataset.features.map((feature) => renderFeatureDensityChart(dataset, feature)).join("")}
      </div>
    </section>
  `;
}
