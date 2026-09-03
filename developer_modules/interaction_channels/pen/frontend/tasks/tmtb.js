/*
  通道负责人维护区：笔式 / tmtb

  本文件集中维护该任务在“交互任务的特征映射解析”中的三类内容：
  1. registerInteractionTask：任务基础信息、特征列表、人体映射区域。
  2. registerTaskDataOverview：数据概览、统计数据、真实特征列、分布图片。
  3. registerTaskDiagnosisReport：诊断报告标题、报告图片、关键指标和结论。

  素材放在同级目录：../assets/tmtb/
  核心靶点区域由架构负责人维护：static/core/task-registry.js
*/

/* 负责人修改区：TMT-B。修改规则同 tmta.js。 */
window.registerInteractionTask({
  id: "tmtb",
  name: "TMT-B",
  channel: "笔式",
  icon: "✒",
  image: "/developer_modules/interaction_channels/pen/assets/tmtb/feature_mapping/example.png",
  bodyImage: "/developer_modules/interaction_channels/pen/assets/tmtb/feature_mapping/human_region.png",
  desc: "TMT-B 要求数字与字母交替连接，更强调任务切换、抑制控制和认知灵活性。",
  features: [
    ["字母数字切换延迟", "Number-letter switching delay", "执行控制", "head", "#8b5cf6"],
    ["错误修正次数", "Error correction count", "认知灵活性", "head", "#ef4444"],
    ["轨迹折返幅度", "Trajectory reversal amplitude", "手腕控制", "hand", "#3b82f6"],
    ["注视跳转频率", "Gaze transition frequency", "眼动", "eye", "#38bdf8"],
    ["切换成本比值", "Switching cost ratio", "执行控制", "head", "#f59e0b"],
  ],
});

/* 数据概览 / TMT-B：修改任务描述、示例图和概览关注指标。 */
window.registerTaskDataOverview({
  id: "tmtb",
  image: "/developer_modules/interaction_channels/pen/assets/tmtb/data_overview/example.png",
  desc: "TMT-B 侧重数字字母切换、执行控制、抑制控制和认知灵活性。",
  distributionFeatures: ["切换成本", "错误修正", "完成时间", "轨迹折返"],
});

/* 诊断报告 / TMT-B：后续可替换本任务报告截图、报告指标和解释模板。 */
window.registerTaskDiagnosisReport({
  id: "tmtb",
  assetBase: "/developer_modules/interaction_channels/pen/assets/tmtb/diagnosis_report",
  reportTitle: "TMT-B 测试报告",
  referenceImages: ["case_report_drawing.png", "case_report_signals.png", "case_report_bars.png", "case_report_features.png", "case_report_scatter.png"],
  keyMetrics: ["切换成本", "错误修正", "完成时间", "执行控制指数"],
});
