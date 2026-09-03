/*
  核心架构维护区：最小 DOM 工具。
  必须在其他前端脚本之前加载，避免功能模块脚本先执行时找不到 $ / $$。
*/
window.$ = window.$ || function $(selector) {
  return document.querySelector(selector);
};

window.$$ = window.$$ || function $$(selector) {
  return Array.from(document.querySelectorAll(selector));
};
