/*
  通道负责人维护区：姿态 / posture

  本文件集中维护该任务在“交互任务的特征映射解析”中的三类内容：
  1. registerInteractionTask：任务基础信息、特征列表、人体映射区域。
  2. registerTaskDataOverview：数据概览、统计数据、真实特征列、分布图片。
  3. registerTaskDiagnosisReport：诊断报告标题、报告图片、关键指标和结论。

  素材放在同级目录：../assets/posture/
  核心靶点区域由架构负责人维护：static/core/task-registry.js
*/

/* 负责人修改区：姿态任务。修改规则同 tmta.js。 */
window.registerInteractionTask({
  id: "posture",
  name: "姿态任务",
  channel: "姿态",
  icon: "⌁",
  image: "/developer_modules/interaction_channels/posture/assets/posture/feature_mapping/example.png",
  bodyImage: "/developer_modules/interaction_channels/posture/assets/posture/feature_mapping/human_region.png",
  desc: "姿态任务分析躯干稳定、重心偏移和动作补偿，观察整体运动控制。",
  features: [
    ["躯干摆动角", "Trunk sway angle", "躯干", "trunk", "#8b5cf6"],
    ["重心偏移", "Center-of-mass shift", "下肢", "leg", "#ef4444"],
    ["姿态稳定指数", "Postural stability index", "躯干", "trunk", "#38bdf8"],
    ["步态代偿幅度", "Gait compensation amplitude", "下肢", "leg", "#f59e0b"],
  ],
});

/* 数据概览 / 姿态任务：修改任务描述、示例图和概览关注指标。 */
window.registerTaskDataOverview({
  id: "posture",
  image: "/developer_modules/interaction_channels/posture/assets/posture/data_overview/example.png",
  desc: "姿态任务分析躯干稳定、重心偏移和动作补偿。",
  distributionFeatures: ["躯干摆动", "重心偏移", "姿态稳定", "步态代偿"],
});

/* 诊断报告 / 姿态任务：后续可替换本任务报告截图、报告指标和解释模板。 */
window.registerTaskDiagnosisReport({
  id: "posture",
  assetBase: "/developer_modules/interaction_channels/posture/assets/posture/diagnosis_report",
  reportTitle: "姿态任务报告",
  referenceImages: ["case_report_signals.png", "case_report_features.png", "case_report_scatter.png"],
  keyMetrics: ["躯干摆动", "重心偏移", "稳定指数", "姿态控制指数"],
});
