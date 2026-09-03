/*
  通道负责人维护区：眼动 / saccade

  本文件集中维护该任务在“交互任务的特征映射解析”中的三类内容：
  1. registerInteractionTask：任务基础信息、特征列表、人体映射区域。
  2. registerTaskDataOverview：数据概览、统计数据、真实特征列、分布图片。
  3. registerTaskDiagnosisReport：诊断报告标题、报告图片、关键指标和结论。

  素材放在同级目录：../assets/saccade/
  核心靶点区域由架构负责人维护：static/core/task-registry.js
*/

/* 负责人修改区：扫视任务。修改规则同 tmta.js。 */
window.registerInteractionTask({
  id: "saccade",
  name: "扫视任务",
  channel: "眼动",
  icon: "◉",
  image: "/developer_modules/interaction_channels/eye/assets/saccade/feature_mapping/example.png",
  bodyImage: "/developer_modules/interaction_channels/eye/assets/saccade/feature_mapping/human_region.png",
  desc: "扫视任务观察眼跳潜伏期、峰速度和目标定位误差，反映视觉注意和眼动控制。",
  features: [
    ["扫视潜伏期", "Saccade latency", "眼动", "eye", "#38bdf8"],
    ["扫视峰速度", "Peak saccade velocity", "眼动", "eye", "#3b82f6"],
    ["目标捕获误差", "Target acquisition error", "视觉搜索", "eye", "#f59e0b"],
    ["头部补偿幅度", "Head compensation amplitude", "头颈", "head", "#8b5cf6"],
  ],
});

/* 数据概览 / 扫视任务：修改任务描述、示例图和概览关注指标。 */
window.registerTaskDataOverview({
  id: "saccade",
  image: "/developer_modules/interaction_channels/eye/assets/saccade/data_overview/example.png",
  desc: "扫视任务观察眼跳潜伏期、峰速度和目标定位误差。",
  distributionFeatures: ["扫视潜伏期", "扫视峰速度", "目标捕获误差", "头部补偿"],
});

/* 诊断报告 / 扫视任务：后续可替换本任务报告截图、报告指标和解释模板。 */
window.registerTaskDiagnosisReport({
  id: "saccade",
  assetBase: "/developer_modules/interaction_channels/eye/assets/saccade/diagnosis_report",
  reportTitle: "扫视任务报告",
  referenceImages: ["case_report_signals.png", "case_report_features.png", "case_report_scatter.png"],
  keyMetrics: ["扫视潜伏期", "峰速度", "目标误差", "眼动控制指数"],
});
