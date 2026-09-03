/*
  通道负责人维护区：面部 / face

  本文件集中维护该任务在“交互任务的特征映射解析”中的三类内容：
  1. registerInteractionTask：任务基础信息、特征列表、人体映射区域。
  2. registerTaskDataOverview：数据概览、统计数据、真实特征列、分布图片。
  3. registerTaskDiagnosisReport：诊断报告标题、报告图片、关键指标和结论。

  素材放在同级目录：../assets/face/
  核心靶点区域由架构负责人维护：static/core/task-registry.js
*/

/* 负责人修改区：表情任务。修改规则同 tmta.js。 */
window.registerInteractionTask({
  id: "face",
  name: "表情任务",
  channel: "面部",
  icon: "☻",
  image: "/developer_modules/interaction_channels/face/assets/face/feature_mapping/example.png",
  bodyImage: "/developer_modules/interaction_channels/face/assets/face/feature_mapping/human_region.png",
  desc: "表情任务观察眼周、口角和面部肌群变化，评估面部运动幅度与反应迟滞。",
  features: [
    ["嘴角运动幅度", "Mouth-corner motion range", "口唇/语音", "mouth", "#38bdf8"],
    ["眼周表情幅度", "Periocular expression range", "眼动", "eye", "#3b82f6"],
    ["表情反应迟滞", "Expression response latency", "头面部", "head", "#8b5cf6"],
    ["面部不对称指数", "Facial asymmetry index", "口唇/语音", "mouth", "#f59e0b"],
  ],
});

/* 数据概览 / 表情任务：修改任务描述、示例图和概览关注指标。 */
window.registerTaskDataOverview({
  id: "face",
  image: "/developer_modules/interaction_channels/face/assets/face/data_overview/example.png",
  desc: "表情任务观察眼周、口角和面部肌群变化。",
  distributionFeatures: ["嘴角幅度", "眼周幅度", "反应迟滞", "不对称指数"],
});

/* 诊断报告 / 表情任务：后续可替换本任务报告截图、报告指标和解释模板。 */
window.registerTaskDiagnosisReport({
  id: "face",
  assetBase: "/developer_modules/interaction_channels/face/assets/face/diagnosis_report",
  reportTitle: "表情任务报告",
  referenceImages: ["case_report_signals.png", "case_report_features.png", "case_report_scatter.png"],
  keyMetrics: ["表情幅度", "反应迟滞", "不对称指数", "面部运动指数"],
});
