/*
  通道负责人维护区：笔式 / tmta

  本文件集中维护该任务在“交互任务的特征映射解析”中的三类内容：
  1. registerInteractionTask：任务基础信息、特征列表、人体映射区域。
  2. registerTaskDataOverview：数据概览、统计数据、真实特征列、分布图片。
  3. registerTaskDiagnosisReport：诊断报告标题、报告图片、关键指标和结论。

  素材放在同级目录：../assets/tmta/
  核心靶点区域由架构负责人维护：static/core/task-registry.js
*/

/*
  负责人修改区：TMT-A
  - image 可替换为 /developer_modules/interaction_developer_modules/interaction_channels/pen/assets/tmta/xxx.png
  - features 每行格式：[中文特征名, English short name, 界面标签, 映射区域ID, 颜色]
  - 映射区域ID 见 static/core/task-registry.js 的 MAPPING_ZONE_CATALOG
*/
window.registerInteractionTask({
  id: "tmta",
  name: "TMT-A",
  channel: "笔式",
  icon: "✒",
  image: "/developer_modules/interaction_channels/pen/assets/tmta/feature_mapping/example.png",
  bodyImage: "/developer_modules/interaction_channels/pen/assets/tmta/feature_mapping/human_region.png",
  desc: "TMT-A 要求按数字顺序连接目标，主要观察视觉搜索、处理速度、注意维持和手眼协同。",
  features: [
    ["目标搜索时间", "Target search time", "视觉搜索", "eye", "#38bdf8"],
    ["数字连线速度", "Number sequencing speed", "手指/腕部", "hand", "#3b82f6"],
    ["路径回绕次数", "Path regression count", "执行控制", "head", "#8b5cf6"],
    ["笔尖停顿时长", "Pen-tip pause duration", "手指精细", "fingers", "#38bdf8"],
    ["压力变异系数", "Pressure variation coefficient", "掌指控制", "fingers", "#f59e0b"],
  ],
});

/* 数据概览 / TMT-A：修改任务描述、示例图和概览关注指标。 */
window.registerTaskDataOverview({
  id: "tmta",
  image: "/developer_modules/interaction_channels/pen/assets/tmta/data_overview/example.png",
  desc: "TMT-A 主要观察视觉搜索、注意维持、数字序列加工和手部书写控制。",
  distributionFeatures: ["完成时间", "路径长度", "停顿次数", "笔压变异"],
});

/* 诊断报告 / TMT-A：后续可替换本任务报告截图、报告指标和解释模板。 */
window.registerTaskDiagnosisReport({
  id: "tmta",
  assetBase: "/developer_modules/interaction_channels/pen/assets/tmta/diagnosis_report",
  reportTitle: "TMT-A 测试报告",
  referenceImages: ["case_report_drawing.png", "case_report_signals.png", "case_report_bars.png", "case_report_features.png", "case_report_scatter.png"],
  keyMetrics: ["完成时间", "错误次数", "路径效率", "手部控制指数"],
});
