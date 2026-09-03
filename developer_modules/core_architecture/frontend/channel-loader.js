/*
  核心架构维护区：10 个交互通道的前端接入清单。

  通道负责人只修改自己的：
  developer_modules/interaction_channels/<channel_slug>/frontend/channel.js
  和该通道下的 tasks/assets/backend 文件。
*/
(function () {
  const channelEntries = [
    "pen",
    "grasp",
    "posture",
    "gesture",
    "eye",
    "tactile",
    "emg",
    "ecg",
    "speech",
    "face",
  ];

  window.TOOLBOX_CHANNEL_ENTRIES = channelEntries;
})();
