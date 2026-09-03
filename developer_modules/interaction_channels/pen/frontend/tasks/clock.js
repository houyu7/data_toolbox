/*
  通道负责人维护区：笔式 / clock

  本文件集中维护该任务在“交互任务的特征映射解析”中的三类内容：
  1. registerInteractionTask：任务基础信息、特征列表、人体映射区域。
  2. registerTaskDataOverview：数据概览、统计数据、真实特征列、分布图片。
  3. registerTaskDiagnosisReport：诊断报告标题、报告图片、关键指标和结论。

  素材放在同级目录：../assets/clock/
  核心靶点区域由架构负责人维护：static/core/task-registry.js
*/

/* 负责人修改区：画钟测试。修改规则同 tmta.js。 */
window.registerInteractionTask({
  id: "clock",
  name: "画钟测试",
  channel: "笔式",
  icon: "✒",
  image: "/developer_modules/interaction_channels/pen/assets/clock/feature_mapping/example.png",
  bodyImage: "/developer_modules/interaction_channels/pen/assets/clock/feature_mapping/human_region.png",
  desc: "画钟测试通过钟面、数字和指针绘制，观察视空间组织、计划能力和图形运动控制。",
  features: [
    ["数字空间偏移", "Digit spatial displacement", "视空间", "eye", "#38bdf8"],
    ["钟面闭合误差", "Clock contour closure error", "手部精细控制", "fingers", "#3b82f6"],
    ["指针角度偏差", "Hand angle deviation", "计划能力", "head", "#8b5cf6"],
    ["绘制节律波动", "Drawing rhythm fluctuation", "腕部", "hand", "#38bdf8"],
    ["中心定位误差", "Center placement error", "视空间", "eye", "#f59e0b"],
  ],
});

/* 数据概览 / 画钟测试：修改任务描述、示例图和概览关注指标。 */
window.registerTaskDataOverview({
  id: "clock",
  image: "/developer_modules/interaction_channels/pen/assets/clock/data_overview/example.png",
  desc: "画钟测试观察视空间组织、计划能力、数字概念和图形运动控制。",
  distributionFeatures: ["数字偏移", "钟面闭合误差", "指针角度偏差", "中心定位误差"],
});

/* 诊断报告 / 画钟测试：后续可替换本任务报告截图、报告指标和解释模板。 */
window.registerTaskDiagnosisReport({
  id: "clock",
  assetBase: "/developer_modules/interaction_channels/pen/assets/clock/diagnosis_report",
  reportTitle: "画钟测试报告",
  referenceImages: ["case_report_drawing.png", "case_report_signals.png", "case_report_bars.png", "case_report_features.png", "case_report_scatter.png"],
  keyMetrics: ["钟面完整性", "数字空间分布", "指针角度", "计划能力指数"],
});
