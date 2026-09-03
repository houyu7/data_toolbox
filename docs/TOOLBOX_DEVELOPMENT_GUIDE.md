# 工具箱协作开发总说明

本项目按“开发者责任边界”拆分。每个开发者只改自己的文件夹，文件夹内同时包含前端、素材和后端代码；公共入口、注册机制、人体区域集合和靶点坐标由核心架构负责人维护。

## 1. 总体目录

```text
data_toolbox/
  developer_modules/                         协作开发主目录
    core_architecture/                       核心架构负责人
    interaction_data_management/             交互数据管理负责人
    interaction_channels/                    10 个交互通道负责人
    multimodal_feature_analysis/             多模态特征解析负责人
    exploration_validation/                  探索与验证负责人
  data/                                      本地数据
  custom_features/                           自定义特征提取方法
  exploration_history/                       探索历史
  external_methods/                          外部方法扩展
  ADT/                                       外部采集程序，不修改
  toolbox_server.py                          服务启动和总路由装配
```

## 2. 负责人边界

### 核心架构负责人

```text
developer_modules/core_architecture/
  frontend/
    index.html                               主界面 HTML
    styles.css                               全局样式
    app.js                                   全局状态和公共函数
    bootstrap.js                             页面启动和事件绑定
    feature-registry.js                      一级功能配置注册
    task-registry.js                         交互任务注册、人体区域集合、靶点
    channel-loader.js                        10 个交互通道清单说明，不负责动态写入脚本
    shared/data_api.js                       前端 API 工具
    interaction_task_feature_mapping/
      data_overview_view.js                  数据概览公共渲染
      feature_mapping_view.js                特征映射公共渲染
      diagnosis_report_view.js               诊断报告公共渲染
  assets/                                    封面、公共人体图、公共报告图
  backend/
    channel_registry.py                      10 个交互通道后端 API 接入清单
    legacy_data_api.py                       历史通用接口
    legacy_data_service.py                   历史通用业务函数
```

核心负责人维护：主页面装配、全局样式、交互任务注册函数、人体映射区域 ID、靶点坐标、公共渲染逻辑、通道入口加载规则。

10 个通道接入点也在核心层：

```text
developer_modules/core_architecture/frontend/index.html
developer_modules/core_architecture/frontend/channel-loader.js
developer_modules/core_architecture/backend/channel_registry.py
```

通道负责人新增任务时，只改自己通道的 `frontend/channel.js`；只有新增第 11 个通道时，才由核心架构负责人修改以上核心接入文件。前端通道脚本在 `index.html` 中直接声明，避免动态 `document.write` 影响脚本执行顺序。

### 交互数据管理负责人

```text
developer_modules/interaction_data_management/
  frontend/collection_overview/
    config.js
    view.js
  assets/collection_overview/
  backend/
    api.py
    service.py
```

维护内容：采集概览、病例数据读取、NSDDataSystem 启动按钮、交互数据管理相关接口。

### 多模态特征解析负责人

```text
developer_modules/multimodal_feature_analysis/
  frontend/
    view.js
    multimodal_mapping/config.js
    feature_exploration/config.js
  assets/
    multimodal_mapping/
    feature_exploration/
  backend/
    api.py
    service.py
```

维护内容：多任务人体映射叠加、特征相关性分析、融合特征探索、LLM 解释、相关可视化。

### 探索与验证负责人

```text
developer_modules/exploration_validation/
  frontend/
    view.js
    validation_workspace/config.js
    fusion_modeling/config.js
  assets/
    validation_workspace/
    fusion_modeling/
  backend/
    api.py
    service.py
```

维护内容：验证工作台、训练集/测试集划分、模型选择、模型训练、模型结果报告。

## 3. 10 个交互通道负责人目录

交互任务的特征映射解析部分按 10 个通道拆分，每个通道一个开发者独立维护：

```text
developer_modules/interaction_channels/
  pen/                 笔式
  grasp/               抓握
  posture/             姿态
  gesture/             手势
  eye/                 眼动
  tactile/             触觉
  emg/                 肌电
  ecg/                 心电
  speech/              语音
  face/                面部
```

每个通道目录结构一致：

```text
developer_modules/interaction_channels/<channel_slug>/
  frontend/
    channel.js                         本通道任务入口；新增任务时只改这里
    tasks/
      <task_id>.js                     单个任务配置：概览、特征映射、诊断报告
  assets/
    <task_id>/
      data_overview/                   数据概览图片
      feature_mapping/                 特征映射图片、人体图
      diagnosis_report/                诊断报告图片
  backend/
    api.py                             本通道专属接口
    service.py                         本通道专属数据读取/特征计算/报告生成
```

例如笔式负责人维护：

```text
developer_modules/interaction_channels/pen/
  frontend/channel.js
  frontend/tasks/tmta.js
  frontend/tasks/tmtb.js
  frontend/tasks/clock.js
  frontend/tasks/line.js
  frontend/tasks/write.js
  assets/tmta/data_overview/
  assets/tmta/feature_mapping/
  assets/tmta/diagnosis_report/
  backend/api.py
  backend/service.py
```

## 4. 一个任务文件负责三类页面

每个任务文件集中维护该任务的三部分内容，不再散落到三个功能文件夹。

```js
window.registerInteractionTask({ ... });       // 特征映射
window.registerTaskDataOverview({ ... });      // 数据概览
window.registerTaskDiagnosisReport({ ... });   // 诊断报告
```

### 数据概览怎么改

位置：

```text
developer_modules/interaction_channels/<channel_slug>/frontend/tasks/<task_id>.js
```

修改 `registerTaskDataOverview`：

```js
window.registerTaskDataOverview({
  id: "tmta",
  image: "/developer_modules/interaction_channels/pen/assets/tmta/data_overview/example.png",
  desc: "TMT-A 任务描述。",
  statistics: {
    totalRows: 12112,
    participants: 3028,
    male: 1529,
    female: 1499,
  },
  ageBuckets: [
    { label: "20-30", value: 120 },
    { label: "30-40", value: 180 },
  ],
  diseases: [
    { label: "健康对照", value: 492, color: "#4f8df7" },
  ],
  distributionFeatures: [
    { key: "completion_time", cn: "完成时间", en: "Completion Time" },
  ],
  dataSource: "/data/task_features/tmta_features.csv",
});
```

图片放在：

```text
developer_modules/interaction_channels/<channel_slug>/assets/<task_id>/data_overview/
```

真实数据建议放在：

```text
data/task_features/<task_id>_features.csv
```

### 特征映射怎么改

修改 `registerInteractionTask`：

```js
window.registerInteractionTask({
  id: "tmta",
  name: "TMT-A",
  channel: "笔式",
  icon: "✒",
  image: "/developer_modules/interaction_channels/pen/assets/tmta/feature_mapping/example.png",
  bodyImage: "/developer_modules/interaction_channels/pen/assets/tmta/feature_mapping/human_region.png",
  desc: "TMT-A 任务描述。",
  features: [
    ["目标搜索时间", "Target search time", "视觉搜索", "eye", "#38bdf8"],
    ["数字连线速度", "Number sequencing speed", "手指/腕部", "hand", "#3b82f6"],
  ],
});
```

`features` 每行含义：

```text
[中文特征名, 英文解释, 显示区域名, 人体区域 ID, 颜色]
```

人体区域 ID 在这里维护：

```text
developer_modules/core_architecture/frontend/task-registry.js
```

通道负责人只引用区域 ID；如果需要新增区域或改靶点，交给核心架构负责人改。

### 诊断报告怎么改

修改 `registerTaskDiagnosisReport`：

```js
window.registerTaskDiagnosisReport({
  id: "tmta",
  assetBase: "/developer_modules/interaction_channels/pen/assets/tmta/diagnosis_report",
  reportTitle: "TMT-A 测试报告",
  referenceImages: [
    "case_report_drawing.png",
    "case_report_signals.png",
    "case_report_bars.png",
    "case_report_features.png",
    "case_report_scatter.png",
  ],
  keyMetrics: ["完成时间", "错误次数", "路径效率"],
  conclusion: {
    title: "当前任务表现良好",
    text: "结合轨迹、过程信号和诊断特征进行综合判断。",
    suggestions: ["建议继续补充其他通道任务。"],
  },
});
```

报告图片放在：

```text
developer_modules/interaction_channels/<channel_slug>/assets/<task_id>/diagnosis_report/
```

## 5. 新增通道或任务

### 新增一个手势任务

手势负责人只修改：

```text
developer_modules/interaction_channels/gesture/
```

新增：

```text
frontend/tasks/gesture_tap.js
assets/gesture_tap/data_overview/
assets/gesture_tap/feature_mapping/
assets/gesture_tap/diagnosis_report/
```

然后在本通道入口注册脚本：

```text
developer_modules/interaction_channels/gesture/frontend/channel.js
```

加入：

```js
document.write('<script src="/developer_modules/interaction_channels/gesture/frontend/tasks/gesture_tap.js"><\/script>');
```

不需要修改核心 `index.html`。

### 新增一个眼跳任务

眼动负责人只修改：

```text
developer_modules/interaction_channels/eye/
```

新增：

```text
frontend/tasks/eye_jump.js
assets/eye_jump/data_overview/
assets/eye_jump/feature_mapping/
assets/eye_jump/diagnosis_report/
```

并在：

```text
frontend/channel.js
```

加入该任务脚本。

## 6. 后端怎么独立开发

每个负责人目录都有自己的 `backend/api.py` 和 `backend/service.py`。

例如交互数据管理：

```text
developer_modules/interaction_data_management/backend/api.py
developer_modules/interaction_data_management/backend/service.py
```

例如笔式通道：

```text
developer_modules/interaction_channels/pen/backend/api.py
developer_modules/interaction_channels/pen/backend/service.py
```

10 个既定通道的 `backend/api.py` 已经由 `toolbox_server.py` 自动接入。通道负责人后续增加本通道接口时，直接修改自己目录下的 `backend/api.py` 和 `backend/service.py` 即可，不需要修改核心服务器代码。

只有新增第 11 个通道时，才需要核心架构负责人把新的通道 slug 加入主入口和路由装配。

## 7. 修改原则

- 通道负责人只改自己的 `developer_modules/interaction_channels/<channel_slug>/`。
- 交互数据管理负责人只改 `developer_modules/interaction_data_management/`。
- 多模态特征解析负责人只改 `developer_modules/multimodal_feature_analysis/`。
- 探索与验证负责人只改 `developer_modules/exploration_validation/`。
- 核心架构负责人维护 `developer_modules/core_architecture/` 和 `toolbox_server.py`。
- `ADT/` 不修改。
- 新增公共区域、改靶点、改主入口、改全局样式，应由核心架构负责人处理。
