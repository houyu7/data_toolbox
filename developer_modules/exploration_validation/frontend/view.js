/* Exploration and validation view code. Module owners can edit model training and validation rendering here. */

async function runFusionModel() {
  const validationChannels = selectedChannelsFrom("#validationChannelChecks input:checked");
  const channels = validationChannels.length ? validationChannels : selectedChannelsFrom("#multiChannelChecks input:checked");
  if (!channels.length) return alert("请至少选择一个通道。");
  const targetColumn = $("#validationTargetSelect")?.value || $("#multiTargetSelect").value;
  $("#fusionModelOutput").innerHTML = "<p>正在训练融合诊断模型...</p>";
  try {
    const result = await api("/api/multichannel-train", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channels,
        target_column: targetColumn,
        model: $("#fusionModelSelect").value,
        test_ratio: Number($("#fusionTestRatioSelect").value || 0.25),
        goal: $("#fusionModelGoalInput").value,
      }),
    });
    renderFusionModel(result);
  } catch (err) {
    $("#fusionModelOutput").innerHTML = `<p>${escapeHtml(err.message)}</p>`;
  }
}

function renderFusionModel(result) {
  const matrix = (result.confusion_matrix || []).map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
  const labels = (result.labels || []).map((label) => `<span>${escapeHtml(label)}</span>`).join("");
  const acc = Number(result.accuracy || 0);
  $("#fusionModelOutput").innerHTML = `
    <div class="model-result-grid">
      <div class="model-score"><span>测试准确率</span><b>${(acc * 100).toFixed(1)}%</b><i style="width:${Math.min(100, acc * 100).toFixed(1)}%"></i></div>
      <div><span>模型</span><b>${escapeHtml(result.name || "-")}</b></div>
      <div><span>训练/测试</span><b>${escapeHtml(result.details?.train_rows || 0)} / ${escapeHtml(result.details?.test_rows || 0)}</b></div>
      <div><span>输入特征</span><b>${escapeHtml(result.details?.features_after_encoding || 0)}</b></div>
    </div>
    <div class="model-visual-grid">
      <section><h4>混淆矩阵</h4><table class="confusion-table">${matrix}</table><div class="kind-tags">${labels}</div></section>
      <section><h4>建模解释</h4><p>当前模型基于所选通道的对齐特征进行训练，测试集表现用于快速判断多模态融合诊断是否具备进一步验证价值。</p></section>
    </div>
  `;
}
