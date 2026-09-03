/* Multimodal feature analysis view code. Module owners can edit multimodal mapping and feature exploration visualizations here. */

function renderMultimodalTaskPicker(selected) {
  return `
    <section class="mapping-task-switcher multimodal-task-switcher">
      <h3>选择交互任务</h3>
      <div class="mapping-task-list">
        ${taskCatalog.map((group) => `
          <div class="mapping-task-group">
            <div class="mapping-task-group-title"><span>${escapeHtml(group.icon)}</span>${escapeHtml(group.channel)}</div>
            ${group.tasks.map((task) => `
              <label class="mapping-check ${selectedMultimodalTasks.has(task.id) ? "active" : ""}">
                <input type="checkbox" value="${escapeHtml(task.id)}" ${selectedMultimodalTasks.has(task.id) ? "checked" : ""}/>
                <span>${escapeHtml(task.name)}</span>
              </label>
            `).join("")}
          </div>
        `).join("")}
      </div>
    </section>`;
}

function renderZoneIntensity(zones, selected) {
  const counts = mappingZoneCatalog
    .map((zone) => ({ ...zone, count: selected.filter((task) => taskFeatureTemplates(task).some((feature) => feature.zone === zone.id)).length }))
    .filter((item) => item.count > 0);
  const max = Math.max(1, ...counts.map((item) => item.count));
  return counts.map((item) => `
    <div>
      <span>${escapeHtml(item.label)}</span>
      <i style="width:${Math.max(12, item.count / max * 100)}%"></i>
      <b>${item.count}</b>
    </div>
  `).join("") || "<p>请选择至少一个任务。</p>";
}

function renderTaskSummaryCard(task) {
  const profile = mappingTaskProfiles[task.id] || mappingTaskProfiles.tmta;
  return `
    <article>
      <b>${escapeHtml(task.name)}</b>
      <p>${escapeHtml(profile.desc || task.desc)}</p>
      <span>${taskFeatureTemplates(task).slice(0, 4).map((feature) => zoneLabel(feature.zone)).join(" / ")}</span>
    </article>`;
}

function renderMultimodalIdeaBoard() {
  const node = $("#multimodalIdeaBoard");
  if (!node) return;
  const config = getFeatureConfig("multimodalFeatureAnalysis");
  const tasks = allTasks();
  const selected = tasks.filter((task) => selectedMultimodalTasks.has(task.id));
  const zones = [...new Set(selected.flatMap((task) => taskFeatureTemplates(task).slice(0, 5).map((feature) => feature.zone)))];
  node.innerHTML = `
    ${renderMultimodalTaskPicker(selected)}
    <section class="multimodal-overlay">
      <div class="body-panel">${renderInteractionBodySvg(zones, config.bodyImage || "/developer_modules/core_architecture/assets/human_region.png")}</div>
      <div class="zone-radar">
        <h3>${escapeHtml(config.mappingTitle || "映射叠加强度")}</h3>
        ${renderZoneIntensity(zones, selected)}
      </div>
    </section>
    <section class="complement-board">
      <h3>${escapeHtml(config.complementTitle || "互补关系")}</h3>
      ${selected.map((task) => renderTaskSummaryCard(task)).join("") || "<p>请选择至少一个任务。</p>"}
    </section>
  `;
  $$(".multimodal-task-switcher input").forEach((input) => {
    input.onchange = () => {
      if (input.checked) selectedMultimodalTasks.add(input.value);
      else selectedMultimodalTasks.delete(input.value);
      renderMultimodalIdeaBoard();
    };
  });
}

async function runFeatureAnalysis() {
  const channels = selectedChannelsFrom("#multiChannelChecks input:checked");
  if (!channels.length) return alert("请至少选择一个通道。");
  const targetColumn = $("#multiTargetSelect").value;
  const goal = $("#featureAnalysisGoalInput").value;
  $("#featureAnalysisOutput").innerHTML = "<p>正在分析基础特征相关性...</p>";
  try {
    const result = await api("/api/multichannel-feature-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channels, target_column: targetColumn, goal }),
    });
    renderFeatureAnalysis(result);
  } catch (err) {
    $("#featureAnalysisOutput").innerHTML = `<p>${escapeHtml(err.message)}</p>`;
  }
}

function renderFeatureLegend(items, key = "feature") {
  const seen = new Set();
  const unique = [];
  items.forEach((item) => {
    const name = item[key] || item.left || item.feature;
    if (!name || seen.has(name)) return;
    seen.add(name);
    unique.push(name);
  });
  return `<div class="feature-legend">${unique.map((name, index) => `<span><b>${compactFeatureLabel(name, index)}</b>${escapeHtml(shortFeatureName(name))}</span>`).join("")}</div>`;
}

function renderCorrelationPairMap(result) {
  const high = (result.correlation_pairs || []).slice(0, 6);
  const low = (result.low_correlation_pairs || []).slice(0, 6);
  const rows = [...high.map((item) => ({ ...item, kind: "高相关" })), ...low.map((item) => ({ ...item, kind: "低相关" }))].slice(0, 10);
  if (!rows.length) return `<p>当前未形成可展示的相关特征对。</p>`;
  const featureCodes = new Map();
  rows.forEach((item) => [item.left, item.right].forEach((name) => {
    if (!featureCodes.has(name)) featureCodes.set(name, compactFeatureLabel(name, featureCodes.size));
  }));
  const max = Math.max(0.01, ...rows.map((item) => Math.abs(Number(item.correlation || 0))));
  const links = rows.map((item, index) => {
    const y = 26 + index * 20;
    const width = 170 * Math.abs(Number(item.correlation || 0)) / max;
    const cls = item.kind === "高相关" ? "high" : "low";
    return `<g class="${cls}"><text x="0" y="${y + 4}">${featureCodes.get(item.left)}</text><rect x="36" y="${y - 8}" width="${width.toFixed(1)}" height="12" rx="4"/><text x="218" y="${y + 4}">${featureCodes.get(item.right)}</text><text x="262" y="${y + 4}">${item.correlation.toFixed ? item.correlation.toFixed(2) : item.correlation}</text></g>`;
  }).join("");
  return `<svg class="analysis-pair-chart" viewBox="0 0 320 236">${links}</svg>${renderFeatureLegend(rows.flatMap((item) => [{ feature: item.left }, { feature: item.right }]))}`;
}

function renderTargetFeatureBars(items) {
  const rows = (items || []).slice(0, 8);
  const max = Math.max(0.01, ...rows.map((item) => Number(item.score || 0)));
  const bars = rows.map((item, index) => {
    const width = 190 * Number(item.score || 0) / max;
    return `<g><text x="0" y="${28 + index * 24}">${compactFeatureLabel(item.feature, index)}</text><rect x="34" y="${16 + index * 24}" width="${Math.max(5, width).toFixed(1)}" height="12" rx="4"/><text x="${42 + Math.max(5, width)}" y="${28 + index * 24}">${Number(item.score || 0).toFixed(3)}</text></g>`;
  }).join("");
  return `<svg class="analysis-target-chart" viewBox="0 0 320 220">${bars}</svg>${renderFeatureLegend(rows)}`;
}

function renderFeatureAnalysis(result) {
  const targetDist = Object.entries(result.target_distribution || {}).map(([k, v]) => `<span>${escapeHtml(k)} ${escapeHtml(v)}</span>`).join("");
  const suggestions = (result.suggestions || []).slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  $("#featureAnalysisOutput").innerHTML = `
    <div class="module-metrics">
      <div><span>样本</span><b>${result.sample_count || 0}</b></div>
      <div><span>特征</span><b>${result.feature_count || 0}</b></div>
      <div><span>目标</span><b>${escapeHtml(result.target_column || "自动")}</b></div>
    </div>
    <div class="kind-tags">${targetDist || "<span>未发现目标列</span>"}</div>
    <div class="analysis-grid">
      <section><h4>相关性结构</h4>${renderCorrelationPairMap(result)}</section>
      <section><h4>目标相关特征</h4>${renderTargetFeatureBars(result.target_features || [])}</section>
    </div>
    <section class="module-suggestions"><h4>LLM 建议</h4><ul>${suggestions || "<li>当前结果不足以生成建议。</li>"}</ul></section>
  `;
}

async function runMultiExplore() {
  const channels = selectedChannelsFrom("#multiChannelChecks input:checked");
  if (!channels.length) return alert("请至少选择一个通道。");
  const targetColumn = $("#multiTargetSelect").value;
  const goal = $("#multiGoalInput").value;
  $("#multiExploreOutput").innerHTML = "<p>正在探索多通道联合特征...</p>";
  try {
    const result = await api("/api/multichannel-explore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channels, target_column: targetColumn, goal }),
    });
    renderMultiExplore(result);
    if (result.history_record) {
      explorationHistory = [result.history_record].concat(explorationHistory).slice(0, 50);
      renderExploreHistory();
    } else {
      loadExploreHistory();
    }
  } catch (err) {
    if (String(err.message).includes("接口未找到")) {
      const fallback = { ...demoExploreResult, goal: goal || demoExploreResult.goal, channels };
      renderMultiExplore(fallback);
      const now = new Date();
      explorationHistory = [{
        ...fallback,
        created_at: now.toLocaleString(),
        id: String(now.getTime()),
      }].concat(explorationHistory).slice(0, 50);
      renderExploreHistory();
      return;
    }
    $("#multiExploreOutput").innerHTML = `<p>${escapeHtml(err.message)}</p>`;
  }
}

function compactFeatureLabel(name, index) {
  return `F${index + 1}`;
}

function inferVisualizationPlan(result) {
  const goal = String(result.goal || "").toLowerCase();
  const selected = [];
  const add = (type) => { if (!selected.includes(type)) selected.push(type); };
  if (/相关|关联|热力|矩阵|correlation|heatmap/.test(goal)) add("heatmap");
  if (/趋势|变化|时间|折线|trend|curve/.test(goal)) add("trend");
  if (/贡献|比重|占比|重要性|权重|饼图|pie/.test(goal)) add("contribution");
  if (/通道|跨通道|组合|联合|互补|网络/.test(goal)) add("network");
  if (/稳定|bootstrap|鲁棒/.test(goal)) add("stability");
  ["heatmap", "contribution", "network", "stability"].forEach(add);
  const meta = {
    heatmap: ["目标相关性热力图", "比较候选特征在目标相关、疾病相关和稳定性上的整体强弱。"],
    trend: ["候选特征趋势图", "把高分候选按当前样本顺序展开，观察潜在变化方向。"],
    contribution: ["通道贡献比重图", "汇总高分候选来自哪些通道，判断关键证据是否集中或互补。"],
    network: ["跨通道组合网络", "展示组合特征如何连接不同通道，突出联合信号来源。"],
    stability: ["稳定性-相关性散点图", "同时检查候选强度和 bootstrap 稳定性，避免只看单次高分。"],
  };
  return { source: "front-local", primary: selected[0], charts: selected.slice(0, 4).map((type) => ({ type, title: meta[type][0], reason: meta[type][1] })) };
}

function shortFeatureName(name) {
  const raw = String(name || "");
  const parts = raw.split("::");
  return parts.length > 1 ? `${parts[0]}:${parts.slice(1).join(":").replace(/::/g, ":")}` : raw;
}

function channelOfFeature(name) {
  return String(name || "").split("::", 1)[0] || "未知";
}

function scoreOf(item) {
  return Number(item.display_score ?? item.score ?? 0) || 0;
}

function renderExploreVisualizations(result) {
  const top = (result.top_features || []).slice(0, 10);
  const combos = (result.cross_channel_combinations || []).slice(0, 8);
  if (!top.length && !combos.length) return "";
  const plan = result.visualization_plan && result.visualization_plan.charts ? result.visualization_plan : inferVisualizationPlan(result);
  const chartMap = {
    heatmap: () => renderHeatmapChart(top),
    trend: () => renderTrendChart(top),
    contribution: () => renderContributionChart(top, combos),
    network: () => renderNetworkChart(result.channels || [], combos),
    stability: () => renderStabilityChart(top),
  };
  const charts = (plan.charts || []).slice(0, 4).map((chart) => {
    const body = (chartMap[chart.type] || chartMap.heatmap)();
    return `<article class="viz-card"><div class="viz-head"><h4>${escapeHtml(chart.title || "探索图")}</h4><span>${escapeHtml(chart.type || "chart")}</span></div>${body}<p>${escapeHtml(chart.reason || "")}</p></article>`;
  }).join("");
  return `
    <section class="explore-section">
      <h3>探索可视化</h3>
      <div class="viz-intent">根据探索目标推荐：${escapeHtml((plan.charts || []).map((item) => item.title).join("、"))}</div>
      <div class="viz-grid">${charts}</div>
    </section>
  `;
}

function renderHeatmapChart(top) {
  const rows = top.slice(0, 7);
  const metrics = [["目标相关", "score"], ["稳定性", "stability"], ["目标匹配", "goal_match"]];
  const cells = rows.map((item, r) => metrics.map(([_, key], c) => {
    const value = Math.max(0, Math.min(1, Number(item[key] ?? item.score ?? 0) || 0));
    return `<rect x="${118 + c * 58}" y="${26 + r * 24}" width="48" height="18" rx="3" fill="rgba(47,128,237,${(0.16 + value * 0.72).toFixed(2)})"><title>${escapeHtml(item.feature)} ${metrics[c][0]} ${value.toFixed(3)}</title></rect>`;
  }).join("")).join("");
  const labels = rows.map((item, r) => `<text x="0" y="${40 + r * 24}">${escapeHtml(shortFeatureName(item.feature)).slice(0, 30)}</text>`).join("");
  const heads = metrics.map(([label], c) => `<text x="${118 + c * 58}" y="16">${label}</text>`).join("");
  return `<svg class="viz-svg heatmap" viewBox="0 0 310 205">${heads}${labels}${cells}</svg>`;
}

function renderContributionChart(top, combos) {
  const totals = {};
  top.forEach((item) => { totals[channelOfFeature(item.feature)] = (totals[channelOfFeature(item.feature)] || 0) + scoreOf(item); });
  combos.forEach((item) => (item.channels || []).forEach((ch) => { totals[ch] = (totals[ch] || 0) + scoreOf(item) / Math.max(1, (item.channels || []).length); }));
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = Math.max(0.01, ...entries.map(([, v]) => v));
  const bars = entries.map(([label, value], i) => `
    <text x="0" y="${26 + i * 28}">${escapeHtml(label)}</text>
    <rect x="70" y="${12 + i * 28}" width="${Math.max(6, 190 * value / max).toFixed(1)}" height="16" rx="4"/>
    <text x="${78 + Math.max(6, 190 * value / max)}" y="${26 + i * 28}">${value.toFixed(2)}</text>
  `).join("");
  return `<svg class="viz-svg bar-chart" viewBox="0 0 310 185">${bars}</svg>`;
}

function renderNetworkChart(channels, combos) {
  const nodes = [...new Set([...(channels || []), ...combos.flatMap((item) => item.channels || [])])].slice(0, 6);
  const cx = 155, cy = 92, radius = 68;
  const pos = Object.fromEntries(nodes.map((node, i) => [node, [cx + Math.cos((i / Math.max(1, nodes.length)) * Math.PI * 2 - Math.PI / 2) * radius, cy + Math.sin((i / Math.max(1, nodes.length)) * Math.PI * 2 - Math.PI / 2) * radius]]));
  const lines = combos.slice(0, 8).map((item) => {
    const pair = (item.channels || []).filter((ch) => pos[ch]).slice(0, 2);
    if (pair.length < 2) return "";
    const [a, b] = pair;
    return `<line x1="${pos[a][0]}" y1="${pos[a][1]}" x2="${pos[b][0]}" y2="${pos[b][1]}" stroke-width="${(1.4 + Math.min(4, scoreOf(item) * 3)).toFixed(1)}"><title>${escapeHtml(item.feature)}</title></line>`;
  }).join("");
  const circles = nodes.map((node) => `<g><circle cx="${pos[node][0]}" cy="${pos[node][1]}" r="13"/><text x="${pos[node][0]}" y="${pos[node][1] + 28}" text-anchor="middle">${escapeHtml(node)}</text></g>`).join("");
  return `<svg class="viz-svg network-chart" viewBox="0 0 310 190">${lines}${circles}</svg>`;
}

function renderStabilityChart(top) {
  const dots = top.slice(0, 8).map((item) => {
    const x = 34 + Math.max(0, Math.min(1, Number(item.score || 0))) * 230;
    const y = 150 - Math.max(0, Math.min(1, Number(item.stability || 0))) * 120;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5"><title>${escapeHtml(item.feature)} 相关 ${Number(item.score || 0).toFixed(3)} 稳定 ${Number(item.stability || 0).toFixed(3)}</title></circle>`;
  }).join("");
  return `<svg class="viz-svg scatter-chart" viewBox="0 0 310 180"><path d="M34 20 V150 H280"/><text x="38" y="18">稳定性</text><text x="222" y="170">目标相关</text>${dots}</svg>`;
}

function renderTrendChart(top) {
  const paths = top.slice(0, 4).map((item, i) => {
    const base = scoreOf(item);
    const points = Array.from({ length: 8 }, (_, j) => {
      const x = 22 + j * 35;
      const y = 110 - base * 55 + Math.sin(j * 0.9 + i) * 10 + Math.cos(j * 0.45 + base) * 6 + i * 10;
      return `${x.toFixed(1)},${Math.max(18, Math.min(145, y)).toFixed(1)}`;
    }).join(" ");
    return `<polyline points="${points}"><title>${escapeHtml(item.feature)}</title></polyline>`;
  }).join("");
  return `<svg class="viz-svg trend-chart" viewBox="0 0 310 170"><path d="M20 15 V145 H290"/>${paths}</svg>`;
}

function renderMultiExplore(result) {
  const visualBlock = renderExploreVisualizations(result);
  const topRows = (result.top_features || []).map((item) => `
    <tr>
      <td>${escapeHtml(item.feature)}</td>
      <td>${Number(item.display_score ?? item.score ?? 0).toFixed(3)}</td>
      <td>${Number(item.score || 0).toFixed(3)}</td>
      <td>${Number(item.stability || 0).toFixed(3)}</td>
    </tr>
  `).join("");
  const comboRows = (result.cross_channel_combinations || []).map((item) => `
    <tr>
      <td>${escapeHtml(item.feature)}</td>
      <td>${escapeHtml(item.operation || "组合")}</td>
      <td>${Number(item.display_score ?? item.score ?? 0).toFixed(3)}</td>
      <td>${Number(item.score || 0).toFixed(3)}</td>
      <td>${Number(item.stability || 0).toFixed(3)}</td>
      <td>${escapeHtml((item.channels || []).join(" + "))}</td>
    </tr>
  `).join("");
  const targetDist = Object.entries(result.target_distribution || {}).map(([k, v]) => `<span>${escapeHtml(k)} ${escapeHtml(v)}</span>`).join("");
  const nextGoals = (result.next_exploration_goals || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const llm = result.llm_interpretation || {};
  const llmBlocks = llm.enabled
    ? [
        ["机制假设", llm.mechanism_hypotheses],
        ["验证计划", llm.validation_plan],
        ["可视化建议", llm.visualization_guidance],
        ["下一轮问题", llm.next_round_questions],
      ].map(([title, value]) => `
        <div>
          <h4>${escapeHtml(title)}</h4>
          <ul>${[].concat(value || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
      `).join("")
    : `<p>${escapeHtml(llm.message || "未启用 LLM 解释。")}</p>`;
  $("#multiExploreOutput").innerHTML = `
    <div class="explore-summary">
      <div><span>通道</span><b>${escapeHtml((result.channels || []).join(" + "))}</b></div>
      <div><span>样本单元</span><b>${result.sample_count}</b></div>
      <div><span>候选特征</span><b>${result.feature_count}</b></div>
      <div><span>目标列</span><b>${escapeHtml(result.target_column || "自动识别")}</b></div>
    </div>
    <section class="explore-section">
      <h3>目标分布</h3>
      <div class="kind-tags">${targetDist || "<span>未发现目标列</span>"}</div>
    </section>
    ${visualBlock}
    <section class="explore-section">
      <h3>目标相关候选特征</h3>
      <table class="feature-table"><tr><th>特征</th><th>目标相关</th><th>疾病相关</th><th>稳定性</th></tr>${topRows || "<tr><td colspan='4'>暂无候选</td></tr>"}</table>
    </section>
    <section class="explore-section">
      <h3>目标相关跨通道组合特征</h3>
      <table class="combo-table"><tr><th>组合</th><th>形式</th><th>目标相关</th><th>疾病相关</th><th>稳定性</th><th>通道</th></tr>${comboRows || "<tr><td colspan='6'>暂无组合</td></tr>"}</table>
    </section>
    <section class="explore-section">
      <h3>探索目标回应</h3>
      <p>${escapeHtml(result.goal_response || "本轮未生成探索目标回应。")}</p>
    </section>
    <section class="explore-section">
      <h3>下一轮假设</h3>
      <ul>${(result.hypotheses || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>
    <section class="explore-section">
      <h3>新的探索目标</h3>
      <ul>${nextGoals || "<li>暂无新的探索目标。</li>"}</ul>
    </section>
    <section class="explore-section">
      <h3>LLM 解释</h3>
      <div class="llm-block">${llmBlocks}</div>
    </section>
  `;
}
