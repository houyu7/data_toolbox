/*
  多模态特征解析 / 特征探索

  修改这里可以调整两个探索模块的标题、按钮、默认提示语和本功能独立素材。
*/
window.registerFeatureConfig("multimodalFeatureAnalysis", {
  featureAnalysisTitle: "特征分析",
  featureAnalysisSubtitle: "Feature Correlation Analysis",
  featureAnalysisButton: "刷新分析",
  featureAnalysisPlaceholder: "例如：分析特征间相关性，找出冗余特征和可能融合的低相关特征。",
  fusionExploreTitle: "融合特征探索",
  fusionExploreSubtitle: "Fusion Feature Exploration",
  fusionExploreButton: "开始探索",
  fusionExplorePlaceholder: "例如：探索归一化差值、取对数比值或跨任务稳定联合特征。",
  explorationImage: "/developer_modules/multimodal_feature_analysis/assets/feature_exploration/data_view.png",
});
