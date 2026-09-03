# 多模态神经功能解析与智能交互工具箱

这是本地 Web 工具箱项目。当前项目已经按协作开发责任边界拆分到 `developer_modules/`。

## 启动

```powershell
python app.py
```

默认访问：

```text
http://127.0.0.1:8765
```

## 协作开发入口

```text
developer_modules/
  core_architecture/                       核心架构负责人
  interaction_data_management/             交互数据管理负责人
  interaction_channels/                    10 个交互通道负责人
    pen/                                   笔式
    grasp/                                 抓握
    posture/                               姿态
    gesture/                               手势
    eye/                                   眼动
    tactile/                               触觉
    emg/                                   肌电
    ecg/                                   心电
    speech/                                语音
    face/                                  面部
  multimodal_feature_analysis/             多模态特征解析负责人
  exploration_validation/                  探索与验证负责人
```

每个负责人目录内均包含自己的 `frontend/`、`assets/`、`backend/`。通道负责人新增或修改任务时，优先修改：

```text
developer_modules/interaction_channels/<channel_slug>/frontend/tasks/<task_id>.js
developer_modules/interaction_channels/<channel_slug>/assets/<task_id>/
developer_modules/interaction_channels/<channel_slug>/backend/
```

10 个通道的系统接入由核心架构负责人维护：

```text
developer_modules/core_architecture/frontend/channel-loader.js
developer_modules/core_architecture/backend/channel_registry.py
```

其中前端实际脚本接入写在 `developer_modules/core_architecture/frontend/index.html`，`channel-loader.js` 仅保留通道清单说明，避免动态脚本写入影响页面启动。

统一说明文档：

```text
docs/TOOLBOX_DEVELOPMENT_GUIDE.md
```

`ADT/` 是外部采集程序目录，本次结构拆分不修改。
