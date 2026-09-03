/*
  通道负责人维护区：笔式 / write

  本文件集中维护该任务在“交互任务的特征映射解析”中的三类内容：
  1. registerInteractionTask：任务基础信息、特征列表、人体映射区域。
  2. registerTaskDataOverview：数据概览、统计数据、真实特征列、分布图片。
  3. registerTaskDiagnosisReport：诊断报告标题、报告图片、关键指标和结论。

  素材放在同级目录：../assets/write/
  核心靶点区域由架构负责人维护：static/core/task-registry.js
*/

/* 负责人修改区：书写测试。修改规则同 tmta.js。 */
window.registerInteractionTask({
  id: "write",
  name: "书写测试",
  channel: "笔式",
  icon: "✒",
  image: "/developer_modules/interaction_channels/pen/assets/write/feature_mapping/example.png",
  bodyImage: "/developer_modules/interaction_channels/pen/assets/write/feature_mapping/human_region.png",
  desc: "书写测试用于观察笔画节律、速度变异、压力波动和精细运动迟滞。",
  features: [
    ["笔画微颤指数", "Stroke micro-tremor index", "手指", "fingers", "#3b82f6"],
    ["平均书写速度", "Mean writing speed", "腕部", "hand", "#38bdf8"],
    ["字形空间稳定性", "Glyph spatial stability", "视空间", "eye", "#38bdf8"],
    ["压力节律", "Pressure rhythm", "掌指压力", "fingers", "#f59e0b"],
    ["起笔延迟", "Stroke initiation delay", "执行控制", "head", "#8b5cf6"],
  ],
});

/* 数据概览 / 书写测试：修改任务描述、示例图和概览关注指标。 */
window.registerTaskDataOverview({
  id: "write",
  image: "/developer_modules/interaction_channels/pen/assets/write/data_overview/example.png",
  desc: "书写测试观察笔画节律、速度变异、压力波动和精细运动迟滞。",
  distributionFeatures: ["微颤指数", "书写速度", "字形稳定性", "压力节律"],
});

/* 诊断报告 / 书写测试：后续可替换本任务报告截图、报告指标和解释模板。 */
window.registerTaskDiagnosisReport({
  id: "write",
  assetBase: "/developer_modules/interaction_channels/pen/assets/write/diagnosis_report",
  reportTitle: "书写测试报告",
  referenceImages: ["case_report_drawing.png", "case_report_signals.png", "case_report_bars.png", "case_report_features.png", "case_report_scatter.png"],
  keyMetrics: ["书写速度", "微颤指数", "压力节律", "精细运动指数"],
});
