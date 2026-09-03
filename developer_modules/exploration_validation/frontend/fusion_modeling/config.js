/*
  探索与验证 / 融合诊断建模

  修改这里可以调整模型训练模块标题、按钮、默认模型和测试集比例。
*/
window.registerFeatureConfig("explorationValidation", {
  modelTitle: "融合诊断建模",
  modelSubtitle: "Fusion Diagnostic Modeling",
  trainButtonText: "训练模型",
  defaultModel: "linear_svm",
  defaultTestRatio: "0.25",
  modelGoalPlaceholder: "例如：基于当前通道和融合候选特征训练疾病辅助诊断模型，并报告测试集表现。",
  modelingImage: "/developer_modules/exploration_validation/assets/fusion_modeling/data_view.png",
});
