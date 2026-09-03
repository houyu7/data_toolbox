/* Shared data API and utility helpers used by feature modules. */

async function api(path, options = {}) {
  const res = await fetch(path, options);
  let data = {};
  try {
    data = await res.json();
  } catch (err) {
    data = { error: res.statusText || "接口响应不是 JSON" };
  }
  if (!res.ok || data.error) {
    const hint = res.status === 404 ? "接口未找到，请重启 app.py 以加载最新后端。" : "";
    throw new Error([data.error || res.statusText, hint].filter(Boolean).join(" "));
  }
  return data;
}

function showJson(node, data) {
  node.textContent = JSON.stringify(data, null, 2);
}

function formatSize(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

async function loadLabels() {
  const data = await api("/api/labels");
  allLabels = data.labels;
  const options = data.labels.map((label) => `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`).join("");
  const channelChecks = data.labels.map((label) => `
    <label><input type="checkbox" value="${escapeHtml(label)}" /> ${escapeHtml(label)}</label>
  `).join("");
  if ($("#multiChannelChecks")) $("#multiChannelChecks").innerHTML = channelChecks;
  if ($("#validationChannelChecks")) $("#validationChannelChecks").innerHTML = channelChecks;
  $$("#multiChannelChecks input, #validationChannelChecks input").forEach((input) => {
    input.addEventListener("change", () => loadTargets().catch(() => {}));
  });
}

function selectedChannelsFrom(selector) {
  return $$(selector).map((input) => input.value);
}

async function loadTargets() {
  let targets = [];
  let details = [];
  const channels = selectedChannelsFrom("#multiChannelChecks input:checked").concat(selectedChannelsFrom("#validationChannelChecks input:checked"));
  try {
    const qs = channels.length ? `?channels=${encodeURIComponent(channels.join(","))}` : "";
    const data = await api(`/api/multichannel-targets${qs}`);
    targets = data.targets || [];
    details = data.target_details || [];
  } catch (err) {
    targets = ["diagnosis"];
    details = [{ name: "diagnosis", labeled_sample_count: 0 }];
    $("#multiExploreOutput").innerHTML = `<p>目标列暂未加载：${escapeHtml(err.message)}</p>`;
  }
  const targetOptions = [`<option value="">自动识别目标列</option>`]
    .concat(targets.map((target) => {
      const detail = details.find((item) => item.name === target);
      const suffix = detail && detail.labeled_sample_count ? `（${detail.labeled_sample_count}）` : "";
      return `<option value="${escapeHtml(target)}">${escapeHtml(target + suffix)}</option>`;
    }))
    .join("");
  $("#multiTargetSelect").innerHTML = targetOptions;
  if ($("#validationTargetSelect")) $("#validationTargetSelect").innerHTML = targetOptions;
}

async function loadExploreHistory() {
  try {
    const data = await api("/api/multichannel-history");
    explorationHistory = data.history || [];
  } catch (err) {
    explorationHistory = [];
  }
  renderExploreHistory();
}

function renderExploreHistory() {
  const node = $("#multiExploreHistory");
  if (!node) return;
  if (!explorationHistory.length) {
    node.innerHTML = "<p>暂无历史探索。</p>";
    return;
  }
  node.innerHTML = explorationHistory.map((item, index) => {
    const top = (item.top_features || [])[0];
    const combo = (item.cross_channel_combinations || [])[0];
    return `
      <article class="history-item" data-history-index="${index}">
        <div>
          <b>${escapeHtml(item.goal || "未填写探索目标")}</b>
          <small>${escapeHtml(item.created_at || "")} · ${escapeHtml((item.channels || []).join(" + "))} · ${escapeHtml(item.target_column || "自动")}</small>
        </div>
        <p>Top：${escapeHtml(top ? top.feature : "暂无")}；组合：${escapeHtml(combo ? combo.feature : "暂无")}</p>
      </article>
    `;
  }).join("");
  $$("#multiExploreHistory .history-item").forEach((item) => {
    item.onclick = () => renderHistoryRecord(explorationHistory[Number(item.dataset.historyIndex)]);
  });
}

function renderHistoryRecord(record) {
  if (!record) return;
  renderMultiExplore({
    ...record,
    goal: record.goal,
    top_features: record.top_features || [],
    cross_channel_combinations: record.cross_channel_combinations || [],
    llm_interpretation: { enabled: false, message: "这是历史探索摘要；如需重新调用 LLM，请重新点击开始探索。" },
  });
}

async function clearExploreHistory() {
  try {
    const data = await api("/api/clear-multichannel-history", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    explorationHistory = data.history || [];
  } catch (err) {
    explorationHistory = [];
  }
  renderExploreHistory();
}

async function generateDemoData() {
  $("#featureAnalysisOutput").innerHTML = "<p>正在载入本地演示数据...</p>";
  $("#multiExploreOutput").innerHTML = "<p>正在载入本地演示数据...</p>";
  try {
    const result = await api("/api/generate-demo-multichannel-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    await loadLabels();
    await loadTargets();
    await loadNsdCollectionOverview();
    $("#featureAnalysisOutput").innerHTML = `<p>演示数据已就绪：${escapeHtml((result.channels || []).join("、"))}。</p>`;
    $("#multiExploreOutput").innerHTML = `<p>目标列已从 CSV 中重新发现，可以继续探索融合特征。</p>`;
  } catch (err) {
    await loadLabels();
    await loadTargets();
    await loadNsdCollectionOverview();
    $("#multiExploreOutput").innerHTML = `<p>本地演示数据已经保存，无需重复生成。若目标列为空，请重启 app.py 后刷新页面。</p>`;
  }
}
