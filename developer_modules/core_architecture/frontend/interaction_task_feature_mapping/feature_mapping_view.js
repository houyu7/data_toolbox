/* Feature mapping view code. Module owners can edit task selector, feature list, anchors, and connection rendering here. */

function taskFeatureTemplates(task) {
  const profile = mappingTaskProfiles[task.id] || mappingTaskProfiles.tmta;
  const base = profile.features;
  const extra = Array.from({ length: 34 }, (_, i) => {
    const seed = base[i % base.length];
    return [`${task.name}_${seed[0]}_${i + 1}`, seed[1], seed[2], seed[3], seed[4]];
  });
  return base.concat(extra).map(([name, en, tag, zone, color], index) => ({ name, en, tag, zone, color, index }));
}

function zoneCoordinates(zone) {
  const match = mappingZoneCatalog.find((item) => item.id === zone);
  return match ? [match.x, match.y] : [52.4, 46.6];
}

function bodySvg(highlightZones = []) {
  const active = new Set(highlightZones);
  const point = (zone, cx, cy, label, lx, ly) => `
    <g class="zone ${active.has(zone) ? "hot" : ""}" data-zone="${zone}">
      <circle cx="${cx}" cy="${cy}" r="${active.has(zone) ? 10 : 6}"/>
      <text x="${lx}" y="${ly}">${label}</text>
    </g>`;
  return `
    <div class="elder-body-stage">
      <img class="elder-photo" src="/developer_modules/core_architecture/assets/asian_elder_front.png" alt="亚洲老人全身轮廓" onload="this.parentElement.classList.add('photo-loaded')" onerror="this.style.display='none';this.parentElement.classList.add('photo-missing')" />
      <svg class="body-map elder" viewBox="0 0 330 470" aria-label="人体区域映射">
      <g class="elder-shape">
        <path class="cane" d="M252 266 C270 314 282 368 292 426 M278 430 Q292 448 306 430"/>
        <path class="hair" d="M128 47 C136 18 192 16 204 48 C184 35 148 34 128 47Z"/>
        <circle class="head" cx="166" cy="68" r="36"/>
        <path class="ear" d="M130 68 C120 70 121 88 133 88 M202 68 C212 70 211 88 199 88"/>
        <path class="glasses" d="M141 66 a12 10 0 1 0 24 0 a12 10 0 1 0 -24 0 M169 66 H176 M177 66 a12 10 0 1 0 24 0 a12 10 0 1 0 -24 0"/>
        <path class="face" d="M166 70 C162 79 164 84 171 84 M151 91 Q166 101 184 91"/>
        <path class="neck" d="M150 102 H182 V126 H150Z"/>
        <path class="collar" d="M132 128 L164 156 L198 128"/>
        <path class="torso" d="M112 128 C138 116 194 116 220 128 L238 258 C214 282 184 292 166 292 C146 292 116 282 92 258Z"/>
        <path class="coat-line" d="M166 154 V286 M136 146 C150 172 156 206 154 286 M196 146 C184 176 178 212 178 286"/>
        <path class="arm left-arm" d="M112 146 C90 188 72 224 58 254 C67 264 78 270 90 270 C106 238 122 202 132 166"/>
        <path class="arm right-arm" d="M220 148 C238 190 252 224 268 258 C260 270 250 278 238 280 C218 244 206 206 202 168"/>
        <path class="hand-shape" d="M82 270 C73 278 65 288 60 300 C72 308 88 300 94 286 C99 276 94 268 82 270Z"/>
        <path class="finger-lines" d="M74 288 l-18 18 M80 292 l-11 24 M88 288 l-2 27"/>
        <path class="leg left-leg" d="M138 290 C132 338 124 382 118 424"/>
        <path class="leg right-leg" d="M192 290 C202 340 212 384 222 426"/>
        <path class="foot" d="M108 428 Q124 440 142 425 M212 430 Q232 446 250 430"/>
      </g>
      <g class="body-zones">
        ${point("head", 166, 50, "头颈/执行", 210, 54)}
        ${point("eye", 166, 72, "眼动", 82, 74)}
        ${point("mouth", 166, 94, "口唇/语音", 210, 98)}
        ${point("chest", 166, 150, "胸腹/发声", 214, 154)}
        ${point("trunk", 166, 215, "躯干", 214, 220)}
        ${point("hand", 144, 252, "手腕", 86, 254)}
        ${point("fingers", 142, 286, "手指", 82, 312)}
        ${point("leg", 166, 420, "下肢", 206, 424)}
      </g>
      </svg>
    </div>
  `;
}

function renderMappingTaskSelector(task) {
  return `
    <section class="mapping-task-switcher">
      <h3>交互任务</h3>
      <div class="mapping-task-list">
        ${taskCatalog.map((group) => `
          <div class="mapping-task-group">
            <div class="mapping-task-group-title"><span>${escapeHtml(group.icon)}</span>${escapeHtml(group.channel)}</div>
            ${group.tasks.map((item) => `
              <button class="${item.id === task.id ? "active" : ""}" data-map-task="${escapeHtml(item.id)}">
                ${escapeHtml(item.name)}
              </button>
            `).join("")}
          </div>
        `).join("")}
      </div>
    </section>`;
}

function renderInteractionBodySvg(highlightZones = [], imageSrc = "/developer_modules/core_architecture/assets/human_region.png") {
  const active = new Set(highlightZones);
  const point = (zone) => {
    const item = mappingZoneCatalog.find((entry) => entry.id === zone);
    if (!item) return "";
    const hot = active.has(zone);
    return `
      <button class="zone ${hot ? "hot" : ""}" data-zone="${escapeHtml(zone)}" title="${escapeHtml(item.label)}" style="left:${item.x}%;top:${item.y}%">
        <span class="region-zone-dot"></span>
      </button>`;
  };
  return `
    <div class="region-map-stage" aria-label="人体物理特征映射区域">
      <img class="human-region-img" src="${escapeHtml(imageSrc)}" alt="人体物理特征映射区域" />
      <div class="region-map-count">活动关节: ${highlightZones.length}处</div>
      <div class="body-zones">
        ${mappingZoneCatalog.map((item) => point(item.id)).join("")}
      </div>
    </div>`;
}

function renderTaskMapping() {
  const node = $("#featureMappingCanvas");
  if (!node) return;
  const task = activeTask();
  const profile = mappingTaskProfiles[task.id] || mappingTaskProfiles.tmta;
  const features = taskFeatureTemplates(task);
  const visible = features.slice(0, 18);
  const hotZones = [...new Set(visible.map((item) => item.zone))];
  node.classList.toggle("list-hidden", featureListHidden);
  node.innerHTML = `
    ${renderMappingTaskSelector(task)}
    <section class="mapping-task-card">
      <div class="task-channel-chip">${escapeHtml(profile.category || task.channel)}</div>
      ${renderMiniTaskArt(profile.image || task.image)}
      <h3>${escapeHtml(task.name)}</h3>
      <p>${escapeHtml(profile.desc || task.desc)}</p>
      <div class="legend-dots">
        ${hotZones.map((zone) => `<span><i style="background:#2f80ed"></i>${escapeHtml(zoneLabel(zone))}</span>`).join("")}
      </div>
    </section>
    <section class="feature-list-panel">
      <div class="feature-list-head"><b>特征列表</b><span>${features.length} 个任务相关特征</span></div>
      <div class="feature-scroll">
        ${features.map((item) => `
          <div class="feature-row" data-zone="${escapeHtml(item.zone)}">
            <span style="background:${item.color}"></span>
            <b>${escapeHtml(item.name)}<small>${escapeHtml(item.en)}</small></b>
            <i>${escapeHtml(item.tag)}</i>
          </div>
        `).join("")}
      </div>
    </section>
    <svg class="connection-layer" viewBox="0 0 1120 560" preserveAspectRatio="none"></svg>
    <section class="body-panel">${renderInteractionBodySvg(hotZones, profile.bodyImage || "/developer_modules/core_architecture/assets/human_region.png")}</section>
  `;
  $$("[data-map-task]").forEach((btn) => {
    btn.onclick = () => {
      activeTaskId = btn.dataset.mapTask;
      renderTaskMapping();
      renderPopulationOverview();
    };
  });
  const scroll = node.querySelector(".feature-scroll");
  if (scroll) {
    scroll.addEventListener("scroll", () => updateFeatureConnections(), { passive: true });
  }
  window.requestAnimationFrame(() => window.requestAnimationFrame(updateFeatureConnections));
}

function updateFeatureConnections() {
  const canvas = $("#featureMappingCanvas");
  if (!canvas) return;
  const svg = canvas.querySelector(".connection-layer");
  const scroll = canvas.querySelector(".feature-scroll");
  if (!svg) return;
  const canvasRect = canvas.getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${Math.max(1, canvasRect.width)} ${Math.max(1, canvasRect.height)}`);
  if (featureListHidden) {
    svg.innerHTML = "";
    return;
  }
  if (!scroll) return;
  const scrollRect = scroll.getBoundingClientRect();
  const paths = Array.from(canvas.querySelectorAll(".feature-row")).map((row) => {
    const rowRect = row.getBoundingClientRect();
    if (rowRect.bottom < scrollRect.top || rowRect.top > scrollRect.bottom) return "";
    const zone = row.dataset.zone || "hand";
    const target = canvas.querySelector(`.body-zones [data-zone="${CSS.escape(zone)}"] .region-zone-dot`);
    if (!target) return "";
    const targetRect = target.getBoundingClientRect();
    const colorNode = row.querySelector("span");
    const color = colorNode ? getComputedStyle(colorNode).backgroundColor : "#2f80ed";
    const startX = rowRect.right - canvasRect.left + 4;
    const startY = rowRect.top + rowRect.height / 2 - canvasRect.top;
    const endX = targetRect.left + targetRect.width / 2 - canvasRect.left;
    const endY = targetRect.top + targetRect.height / 2 - canvasRect.top;
    const c1x = startX + Math.max(90, (endX - startX) * 0.36);
    const c2x = endX - Math.max(90, (endX - startX) * 0.22);
    return `<path d="M${startX.toFixed(1)} ${startY.toFixed(1)} C${c1x.toFixed(1)} ${startY.toFixed(1)}, ${c2x.toFixed(1)} ${endY.toFixed(1)}, ${endX.toFixed(1)} ${endY.toFixed(1)}" stroke="${color}" />`;
  }).join("");
  svg.innerHTML = paths;
}

function zoneLabel(zone) {
  const match = mappingZoneCatalog.find((item) => item.id === zone);
  return match ? match.label : zone;
}
