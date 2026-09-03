/*
  通道负责人维护区：语音 / speech

  本文件集中维护该任务在“交互任务的特征映射解析”中的三类内容：
  1. registerInteractionTask：任务基础信息、特征列表、人体映射区域。
  2. registerTaskDataOverview：数据概览、统计数据、真实特征列、分布图片。
  3. registerTaskDiagnosisReport：诊断报告标题、报告图片、关键指标和结论。

  素材放在同级目录：../assets/speech/
  核心靶点区域由架构负责人维护：static/core/task-registry.js
*/

/* 负责人修改区：语音任务。修改规则同 tmta.js。 */
window.registerInteractionTask({
  id: "speech",
  name: "语音任务",
  channel: "语音",
  icon: "●",
  image: "/developer_modules/interaction_channels/speech/assets/speech/feature_mapping/example.png",
  bodyImage: "/developer_modules/interaction_channels/speech/assets/speech/feature_mapping/human_region.png",
  desc: "语音任务分析语速、停顿、音强和发音启动，辅助评估语言与运动控制。",
  features: [
    ["语速均值", "Mean speech rate", "口唇/语音", "mouth", "#38bdf8"],
    ["停顿时长比例", "Pause duration ratio", "语音节律", "mouth", "#3b82f6"],
    ["音强变异", "Intensity variability", "胸腹/发声", "chest", "#f59e0b"],
    ["发音启动延迟", "Phonation onset delay", "口唇", "mouth", "#8b5cf6"],
  ],
});

/* 数据概览 / 语音任务：修改任务描述、示例图和概览关注指标。 */
window.registerTaskDataOverview({
  id: "speech",
  image: "/developer_modules/interaction_channels/speech/assets/speech/data_overview/example.png",
  desc: "语音任务分析语速、停顿、音强和发音启动。",
  distributionFeatures: ["语速", "停顿比例", "音强变异", "启动延迟"],
});

/* 诊断报告 / 语音任务：后续可替换本任务报告截图、报告指标和解释模板。 */
window.registerTaskDiagnosisReport({
  id: "speech",
  assetBase: "/developer_modules/interaction_channels/speech/assets/speech/diagnosis_report",
  reportTitle: "语音任务报告",
  referenceImages: ["case_report_signals.png", "case_report_features.png", "case_report_scatter.png"],
  keyMetrics: ["语速", "停顿比例", "音强变异", "语言运动指数"],
});
