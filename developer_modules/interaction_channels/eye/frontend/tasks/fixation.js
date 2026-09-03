/*
  通道负责人维护区：眼动 / fixation

  本文件集中维护该任务在“交互任务的特征映射解析”中的三类内容：
  1. registerInteractionTask：任务基础信息、特征列表、人体映射区域。
  2. registerTaskDataOverview：数据概览、统计数据、真实特征列、分布图片。
  3. registerTaskDiagnosisReport：诊断报告标题、报告图片、关键指标和结论。

  素材放在同级目录：../assets/fixation/
  核心靶点区域由架构负责人维护：static/core/task-registry.js
*/

/* 负责人修改区：注视任务。修改规则同 tmta.js。 */
window.registerInteractionTask({
  id: "fixation",
  name: "注视任务",
  channel: "眼动",
  icon: "◉",
  image: "/developer_modules/interaction_channels/eye/assets/fixation/feature_mapping/example.png",
  bodyImage: "/developer_modules/interaction_channels/eye/assets/fixation/feature_mapping/human_region.png",
  desc: "注视任务观察视线保持、微扫视和眨眼节律，评估注意维持和眼动抑制能力。",
  features: [
    ["注视稳定性", "Fixation stability", "眼动", "eye", "#38bdf8"],
    ["微扫视频率", "Microsaccade frequency", "眼动", "eye", "#3b82f6"],
    ["眨眼间隔", "Blink interval", "眼周", "eye", "#f59e0b"],
    ["视线漂移速度", "Gaze drift velocity", "眼动", "eye", "#8b5cf6"],
  ],
});

/* 数据概览 / 注视任务：修改任务描述、示例图和概览关注指标。 */
window.registerTaskDataOverview({
  id: "fixation",
  image: "/developer_modules/interaction_channels/eye/assets/fixation/data_overview/example.png",
  desc: "注视任务观察视线保持、微扫视和眨眼节律。",
  distributionFeatures: ["注视稳定性", "微扫视频率", "眨眼间隔", "视线漂移"],
});

/* 诊断报告 / 注视任务：后续可替换本任务报告截图、报告指标和解释模板。 */
window.registerTaskDiagnosisReport({
  id: "fixation",
  assetBase: "/developer_modules/interaction_channels/eye/assets/fixation/diagnosis_report",
  reportTitle: "注视任务报告",
  referenceImages: ["case_report_signals.png", "case_report_features.png", "case_report_scatter.png"],
  keyMetrics: ["注视稳定性", "微扫视频率", "眨眼间隔", "注意维持指数"],
});
