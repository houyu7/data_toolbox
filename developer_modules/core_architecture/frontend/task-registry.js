/*
  核心架构维护区：交互任务注册中心和人体映射区域。

  通道负责人不要直接修改本文件。新增通道任务时，请在：
  developer_modules/interaction_channels/<channel_slug>/frontend/tasks/<task_id>.js
  注册任务、数据概览和诊断报告。
*/
(function () {
  const taskModules = [];
  const taskOverviewModules = {};
  const taskReportModules = {};

  window.TOOLBOX_TASK_MODULES = taskModules;
  window.TOOLBOX_TASK_OVERVIEWS = taskOverviewModules;
  window.TOOLBOX_TASK_REPORTS = taskReportModules;

  window.registerInteractionTask = function registerInteractionTask(task) {
    if (!task || !task.id) return;
    taskModules.push(task);
  };

  window.registerTaskDataOverview = function registerTaskDataOverview(task) {
    if (!task || !task.id) return;
    taskOverviewModules[task.id] = task;
  };

  window.registerTaskDiagnosisReport = function registerTaskDiagnosisReport(task) {
    if (!task || !task.id) return;
    taskReportModules[task.id] = task;
  };

  window.MAPPING_ZONE_CATALOG = [
    { id: "head", label: "头颈/执行", x: 44.3, y: 11.6 },
    { id: "eye", label: "眼动", x: 44.4, y: 17.4 },
    { id: "mouth", label: "口唇/语音", x: 44.4, y: 17.4 },
    { id: "chest", label: "胸腹/发声", x: 50.5, y: 23.3 },
    { id: "trunk", label: "躯干稳定", x: 44.4, y: 61.9 },
    { id: "hand", label: "手腕/上肢", x: 52.4, y: 46.6 },
    { id: "fingers", label: "手指精细", x: 54.5, y: 52.4 },
    { id: "leg", label: "下肢平衡", x: 47.4, y: 79.9 },
  ];

  window.buildTaskCatalogFromModules = function buildTaskCatalogFromModules() {
    const groups = new Map();
    taskModules.forEach((task) => {
      const overview = taskOverviewModules[task.id] || {};
      const channel = task.channel || "其他";
      if (!groups.has(channel)) groups.set(channel, { channel, icon: task.icon || "•", tasks: [] });
      groups.get(channel).tasks.push({
        id: task.id,
        name: task.name,
        desc: overview.desc || task.desc,
        image: overview.image || task.image,
      });
    });
    return Array.from(groups.values());
  };

  window.buildTaskProfilesFromModules = function buildTaskProfilesFromModules() {
    return taskModules.reduce((profiles, task) => {
      const overview = taskOverviewModules[task.id] || {};
      profiles[task.id] = {
        category: task.channel || "其他",
        image: task.image,
        bodyImage: task.bodyImage,
        desc: task.desc,
        features: task.features || [],
        report: taskReportModules[task.id] || {},
      };
      return profiles;
    }, {});
  };
})();
