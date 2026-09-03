var allLabels = [];
var explorationHistory = [];

var demoExploreResult = {
  goal: "本地演示模式",
  channels: ["笔式", "眼动", "肌电", "语音"],
  target_column: "diagnosis",
  sample_count: 108,
  labeled_sample_count: 72,
  feature_count: 96,
  target_available: true,
  target_distribution: { control: 36, disease: 36 },
  top_features: [
    { feature: "肌电::tremor_band_power::median", score: 0.797, stability: 0.775 },
    { feature: "肌电::tremor_band_power::mean", score: 0.797, stability: 0.575 },
    { feature: "语音::speech_rate::mean", score: 0.792, stability: 0.475 },
    { feature: "眼动::pursuit_gain::mean", score: 0.802, stability: 0.875 },
  ],
  cross_channel_combinations: [
    { feature: "肌电::tremor_band_power::median × 语音::speech_rate::mean", operation: "乘积", score: 0.804, stability: 0.625, channels: ["肌电", "语音"] },
    { feature: "眼动::pursuit_gain::mean × 笔式::pressure_variability::max", operation: "乘积", score: 0.779, stability: 0.637, channels: ["眼动", "笔式"] },
  ],
  exploration_loop: [
    "候选生成：使用本地已保存 demo CSV，按 subject_id 对齐多通道样本。",
    "疾病相关性评分：围绕 diagnosis 的 control/disease 分组计算候选解释强度。",
    "跨通道组合搜索：组合不同通道的高分候选，寻找联合信号。",
    "稳定性验证：展示预先计算的 bootstrap 稳定性分数。",
    "LLM 解释：正式模式需启动新版后端并配置 API Key。",
  ],
  hypotheses: [
    "肌电 tremor_band_power 与语音 speech_rate 的组合在 demo 中高于单通道候选，适合演示联合特征价值。",
    "下一轮应检查肌电、语音、眼动和笔式通道是否在真实数据中仍保持一致方向。",
    "正式分析需要运行新版 app.py，由后端基于当前 Data 目录重新计算。",
  ],
  goal_response: "已围绕本地演示目标筛选候选；当前结果提示肌电与语音组合值得优先复核。",
  next_exploration_goals: [
    "验证肌电 tremor_band_power 与语音 speech_rate 的组合在新增样本中是否仍稳定。",
    "比较乘积、比例和差异三类组合，筛选更稳健的跨通道指标。",
    "回看 disease/control 原始分布，确认高分特征是否由少数异常样本驱动。",
  ],
  llm_interpretation: { enabled: false, message: "当前为本地演示模式；启动新版后端并配置 OPENAI_API_KEY 后可调用 LLM 解释。" },
};

var $ = (sel) => document.querySelector(sel);
var $$ = (sel) => Array.from(document.querySelectorAll(sel));

function getFeatureConfig(featureId) {
  return window.featureConfig ? window.featureConfig(featureId) : {};
}

function applyFeatureConfigs() {
  const multimodal = getFeatureConfig("multimodalFeatureAnalysis");
  const validation = getFeatureConfig("explorationValidation");
  const textBindings = [
    ["#featureAnalysisTitle", multimodal.featureAnalysisTitle],
    ["#featureAnalysisSubtitle", multimodal.featureAnalysisSubtitle],
    ["#runFeatureAnalysisBtn", multimodal.featureAnalysisButton],
    ["#fusionExploreTitle", multimodal.fusionExploreTitle],
    ["#fusionExploreSubtitle", multimodal.fusionExploreSubtitle],
    ["#runMultiExploreBtn", multimodal.fusionExploreButton],
    ["#validationWorkspaceTitle", validation.workspaceTitle],
    ["#validationWorkspaceSubtitle", validation.workspaceSubtitle],
    ["#validationWorkspaceText", validation.workspaceText],
    ["#fusionModelTitle", validation.modelTitle],
    ["#fusionModelSubtitle", validation.modelSubtitle],
    ["#runFusionModelBtn", validation.trainButtonText],
  ];
  textBindings.forEach(([selector, value]) => {
    const node = $(selector);
    if (node && value) node.textContent = value;
  });
  if ($("#featureAnalysisGoalInput") && multimodal.featureAnalysisPlaceholder) {
    $("#featureAnalysisGoalInput").placeholder = multimodal.featureAnalysisPlaceholder;
  }
  if ($("#multiGoalInput") && multimodal.fusionExplorePlaceholder) {
    $("#multiGoalInput").placeholder = multimodal.fusionExplorePlaceholder;
  }
  if ($("#fusionModelGoalInput") && validation.modelGoalPlaceholder) {
    $("#fusionModelGoalInput").placeholder = validation.modelGoalPlaceholder;
  }
  if ($("#fusionModelSelect") && validation.defaultModel) $("#fusionModelSelect").value = validation.defaultModel;
  if ($("#fusionTestRatioSelect") && validation.defaultTestRatio) $("#fusionTestRatioSelect").value = validation.defaultTestRatio;
}

var taskCatalog = window.buildTaskCatalogFromModules && window.TOOLBOX_TASK_MODULES?.length
  ? window.buildTaskCatalogFromModules()
  : [
  {
    channel: "笔式",
    icon: "✒",
    tasks: [
      { id: "tmta", name: "TMT-A", desc: "连线测验 A 主要观察视觉搜索、注意维持、数字序列加工和手部书写控制。", image: "trail" },
      { id: "tmtb", name: "TMT-B", desc: "连线测验 B 在数字和字母之间切换，侧重执行功能、认知灵活性与任务转换能力。", image: "switch" },
      { id: "clock", name: "画钟测试", desc: "画钟测试综合反映空间组织、计划能力、数字概念和精细运动控制。", image: "clock" },
      { id: "line", name: "连线测试", desc: "连线任务关注目标定位、路径规划、笔压控制和错误修正过程。", image: "line" },
      { id: "write", name: "书写测试", desc: "书写任务用于观察笔迹节律、速度变异、压力波动和运动迟滞。", image: "write" },
    ],
  },
  {
    channel: "眼动",
    icon: "◉",
    tasks: [
      { id: "saccade", name: "扫视任务", desc: "观察扫视潜伏期、速度和准确性，反映视觉注意和眼动控制。", image: "eye" },
      { id: "fixation", name: "注视任务", desc: "观察注视稳定性和微扫视活动，反映注意维持和眼动抑制能力。", image: "fix" },
    ],
  },
  {
    channel: "语音",
    icon: "●",
    tasks: [
      { id: "speech", name: "语音任务", desc: "分析语速、停顿、音强变异和发音稳定性，辅助评估语言与运动控制。", image: "voice" },
    ],
  },
  {
    channel: "姿态",
    icon: "⌁",
    tasks: [
      { id: "posture", name: "姿态任务", desc: "分析躯干稳定、左右摆动和任务期间的姿态补偿。", image: "posture" },
    ],
  },
  {
    channel: "面部",
    icon: "☻",
    tasks: [
      { id: "face", name: "表情任务", desc: "观察面部肌群激活、表情幅度与反应迟滞。", image: "face" },
    ],
  },
];

var activeTaskId = "tmta";
var featureListHidden = false;

function allTasks() {
  return taskCatalog.flatMap((group) => group.tasks.map((task) => ({ ...task, channel: group.channel })));
}

function activeTask() {
  return allTasks().find((task) => task.id === activeTaskId) || allTasks()[0];
}

/* Shared feature state recovered from the former monolithic app.js. */
var caseDatabase = { patients: [] };
var nsdCollectionOverview = null;
var activePatientId = "123456";
var activeCaseReportKey = "";
var selectedMultimodalTasks = new Set(getFeatureConfig("multimodalFeatureAnalysis").defaultTasks || ["tmta", "line", "speech"]);

var mappingZoneCatalog = window.MAPPING_ZONE_CATALOG || [
  { id: "head", label: "头颈/执行", x: 44.3, y: 11.6 },
  { id: "eye", label: "眼动", x: 44.4, y: 17.4 },
  { id: "mouth", label: "口唇/语音", x: 44.4, y: 17.4 },
  { id: "chest", label: "胸腹/发声", x: 50.5, y: 23.3 },
  { id: "trunk", label: "躯干稳定", x: 44.4, y: 61.9 },
  { id: "hand", label: "手腕/上肢", x: 52.4, y: 46.6 },
  { id: "fingers", label: "手指精细", x: 54.5, y: 52.4 },
  { id: "leg", label: "下肢平衡", x: 47.4, y: 79.9 },
];

var mappingTaskProfiles = window.buildTaskProfilesFromModules && window.TOOLBOX_TASK_MODULES?.length
  ? window.buildTaskProfilesFromModules()
  : {
  tmta: {
    category: "笔式",
    image: "trail",
    desc: "TMT-A 要求按数字顺序连接目标，主要观察视觉搜索、处理速度、注意维持和手眼协同。",
    features: [
      ["目标搜索时间", "Target search time", "视觉搜索", "eye", "#38bdf8"],
      ["数字连线速度", "Number sequencing speed", "手指/腕部", "hand", "#3b82f6"],
      ["路径回绕次数", "Path regression count", "执行控制", "head", "#8b5cf6"],
      ["笔尖停顿时长", "Pen-tip pause duration", "手指精细", "fingers", "#38bdf8"],
      ["压力变异系数", "Pressure variation coefficient", "掌指控制", "fingers", "#f59e0b"],
    ],
  },
  tmtb: {
    category: "笔式",
    image: "switch",
    desc: "TMT-B 要求数字与字母交替连接，更强调任务切换、抑制控制和认知灵活性。",
    features: [
      ["字母数字切换延迟", "Number-letter switching delay", "执行控制", "head", "#8b5cf6"],
      ["错误修正次数", "Error correction count", "认知灵活性", "head", "#ef4444"],
      ["轨迹折返幅度", "Trajectory reversal amplitude", "手腕控制", "hand", "#3b82f6"],
      ["注视跳转频率", "Gaze transition frequency", "眼动", "eye", "#38bdf8"],
      ["切换成本比值", "Switching cost ratio", "执行控制", "head", "#f59e0b"],
    ],
  },
  clock: {
    category: "笔式",
    image: "clock",
    desc: "画钟测试通过钟面、数字和指针绘制，观察视空间组织、计划能力和图形运动控制。",
    features: [
      ["数字空间偏移", "Digit spatial displacement", "视空间", "eye", "#38bdf8"],
      ["钟面闭合误差", "Clock contour closure error", "手部精细控制", "fingers", "#3b82f6"],
      ["指针角度偏差", "Hand angle deviation", "计划能力", "head", "#8b5cf6"],
      ["绘制节律波动", "Drawing rhythm fluctuation", "腕部", "hand", "#38bdf8"],
      ["中心定位误差", "Center placement error", "视空间", "eye", "#f59e0b"],
    ],
  },
  line: {
    category: "笔式",
    image: "line",
    desc: "连线测试记录路径、压力和运动曲线，评估手部控制、连续追踪和局部运动稳定性。",
    features: [
      ["手指关节角度", "Finger joint angle", "手指", "fingers", "#3b82f6"],
      ["腕部旋转速度", "Wrist rotation speed", "腕部", "hand", "#38bdf8"],
      ["压力峰值", "Peak pen pressure", "掌指压力", "fingers", "#f59e0b"],
      ["连线完成时间", "Line completion time", "手眼协同", "eye", "#38bdf8"],
      ["错误点击次数", "Incorrect tap count", "执行控制", "head", "#ef4444"],
    ],
  },
  write: {
    category: "笔式",
    image: "write",
    desc: "书写测试用于观察笔画节律、速度变异、压力波动和精细运动迟滞。",
    features: [
      ["笔画微颤指数", "Stroke micro-tremor index", "手指", "fingers", "#3b82f6"],
      ["平均书写速度", "Mean writing speed", "腕部", "hand", "#38bdf8"],
      ["字形空间稳定性", "Glyph spatial stability", "视空间", "eye", "#38bdf8"],
      ["压力节律", "Pressure rhythm", "掌指压力", "fingers", "#f59e0b"],
      ["起笔延迟", "Stroke initiation delay", "执行控制", "head", "#8b5cf6"],
    ],
  },
  saccade: {
    category: "眼动",
    image: "trail",
    desc: "扫视任务观察眼跳潜伏期、峰速度和目标定位误差，反映视觉注意和眼动控制。",
    features: [
      ["扫视潜伏期", "Saccade latency", "眼动", "eye", "#38bdf8"],
      ["扫视峰速度", "Peak saccade velocity", "眼动", "eye", "#3b82f6"],
      ["目标捕获误差", "Target acquisition error", "视觉搜索", "eye", "#f59e0b"],
      ["头部补偿幅度", "Head compensation amplitude", "头颈", "head", "#8b5cf6"],
    ],
  },
  fixation: {
    category: "眼动",
    image: "trail",
    desc: "注视任务观察视线保持、微扫视和眨眼节律，评估注意维持和眼动抑制能力。",
    features: [
      ["注视稳定性", "Fixation stability", "眼动", "eye", "#38bdf8"],
      ["微扫视频率", "Microsaccade frequency", "眼动", "eye", "#3b82f6"],
      ["眨眼间隔", "Blink interval", "眼周", "eye", "#f59e0b"],
      ["视线漂移速度", "Gaze drift velocity", "眼动", "eye", "#8b5cf6"],
    ],
  },
  speech: {
    category: "语音",
    image: "trail",
    desc: "语音任务分析语速、停顿、音强和发音启动，辅助评估语言与运动控制。",
    features: [
      ["语速均值", "Mean speech rate", "口唇/语音", "mouth", "#38bdf8"],
      ["停顿时长比例", "Pause duration ratio", "语音节律", "mouth", "#3b82f6"],
      ["音强变异", "Intensity variability", "胸腹/发声", "chest", "#f59e0b"],
      ["发音启动延迟", "Phonation onset delay", "口唇", "mouth", "#8b5cf6"],
    ],
  },
  posture: {
    category: "姿态",
    image: "trail",
    desc: "姿态任务分析躯干稳定、重心偏移和动作补偿，观察整体运动控制。",
    features: [
      ["躯干摆动角", "Trunk sway angle", "躯干", "trunk", "#8b5cf6"],
      ["重心偏移", "Center-of-mass shift", "下肢", "leg", "#ef4444"],
      ["姿态稳定指数", "Postural stability index", "躯干", "trunk", "#38bdf8"],
      ["步态代偿幅度", "Gait compensation amplitude", "下肢", "leg", "#f59e0b"],
    ],
  },
  face: {
    category: "面部",
    image: "trail",
    desc: "表情任务观察眼周、口角和面部肌群变化，评估面部运动幅度与反应迟滞。",
    features: [
      ["嘴角运动幅度", "Mouth-corner motion range", "口唇/语音", "mouth", "#38bdf8"],
      ["眼周表情幅度", "Periocular expression range", "眼动", "eye", "#3b82f6"],
      ["表情反应迟滞", "Expression response latency", "头面部", "head", "#8b5cf6"],
      ["面部不对称指数", "Facial asymmetry index", "口唇/语音", "mouth", "#f59e0b"],
    ],
  },
};

