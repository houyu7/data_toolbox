/*
  通道负责人维护区：笔式 / line

  本文件集中维护该任务在“交互任务的特征映射解析”中的三类内容：
  1. registerInteractionTask：任务基础信息、特征列表、人体映射区域。
  2. registerTaskDataOverview：数据概览、统计数据、真实特征列、分布图片。
  3. registerTaskDiagnosisReport：诊断报告标题、报告图片、关键指标和结论。

  素材放在同级目录：../assets/line/
  核心靶点区域由架构负责人维护：static/core/task-registry.js
*/

/* 负责人修改区：连线测试。修改规则同 tmta.js。 */
window.registerInteractionTask({
  id: "line",
  name: "连线测试",
  channel: "笔式",
  icon: "✒",
  image: "/developer_modules/interaction_channels/pen/assets/line/feature_mapping/example.png",
  bodyImage: "/developer_modules/interaction_channels/pen/assets/line/feature_mapping/human_region.png",
  desc: "连线测试记录路径、压力和运动曲线，评估手部控制、连续追踪和局部运动稳定性。",
  features: [
    ["手指关节角度", "Finger joint angle", "手指", "fingers", "#3b82f6"],
    ["腕部旋转速度", "Wrist rotation speed", "腕部", "hand", "#38bdf8"],
    ["压力峰值", "Peak pen pressure", "掌指压力", "fingers", "#f59e0b"],
    ["连线完成时间", "Line completion time", "手眼协同", "eye", "#38bdf8"],
    ["错误点击次数", "Incorrect tap count", "执行控制", "head", "#ef4444"],
  ],
});

/* 数据概览 / 连线测试：修改任务描述、示例图和概览关注指标。 */
window.registerTaskDataOverview({
  id: "line",
  image: "/developer_modules/interaction_channels/pen/assets/line/data_overview/example.png",
  desc: "连线测试记录路径、压力和运动曲线，评估连续追踪与局部运动稳定性。",
  distributionFeatures: ["完成时间", "压力峰值", "手指角度", "错误点击"],
});

/* 诊断报告 / 连线测试：后续可替换本任务报告截图、报告指标和解释模板。 */
window.registerTaskDiagnosisReport({
  id: "line",
  assetBase: "/developer_modules/interaction_channels/pen/assets/line/diagnosis_report",
  reportTitle: "连线测试报告",
  referenceImages: ["case_report_drawing.png", "case_report_signals.png", "case_report_bars.png", "case_report_features.png", "case_report_scatter.png"],
  keyMetrics: ["完成时间", "错误次数", "压力波动", "手功能指数"],
});
