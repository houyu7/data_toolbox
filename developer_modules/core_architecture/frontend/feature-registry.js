/*
  功能模块注册中心

  除“交互任务的特征映射解析”外，其他三个一级功能也通过这里注册配置。
  页面主逻辑仍在 static/app.js，但显示文案、默认模块、图片素材路径从各功能目录读取。
*/
(function () {
  window.TOOLBOX_FEATURE_CONFIGS = {
    interactionDataManagement: {},
    multimodalFeatureAnalysis: {},
    explorationValidation: {},
  };

  window.registerFeatureConfig = function registerFeatureConfig(featureId, config) {
    if (!featureId || !config) return;
    window.TOOLBOX_FEATURE_CONFIGS[featureId] = {
      ...(window.TOOLBOX_FEATURE_CONFIGS[featureId] || {}),
      ...config,
    };
  };

  window.featureConfig = function featureConfig(featureId) {
    return window.TOOLBOX_FEATURE_CONFIGS?.[featureId] || {};
  };
})();
