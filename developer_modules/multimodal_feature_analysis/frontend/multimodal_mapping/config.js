/*
  多模态特征解析 / 多模态映射

  修改这里可以调整多任务叠加映射的标题、人体图片、强度模块名称和结论模块名称。
*/
window.registerFeatureConfig("multimodalFeatureAnalysis", {
  mappingTitle: "映射叠加强度",
  complementTitle: "互补关系",
  bodyImage: "/developer_modules/multimodal_feature_analysis/assets/multimodal_mapping/human_region.png",
  defaultTasks: ["tmta", "line", "speech"],
});
