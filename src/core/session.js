window.MI = window.MI || {};
(function (MI) {
  'use strict';

  // 当前这一次展开的方案。
  // 它会写进 store.session.plan 持久层：本地引擎的结果随时可以重算，
  // 但接入模型之后的结果带有随机性——同样的输入，第二次问不出同样的文字。
  // 所以方案和进度一样属于「不能丢的状态」：刷新、重开之后必须还是当初那份。
  // ensure() / rebuild() 都优先读存储里的方案，缺失时才回退到本地规则重算。

  var plan = null;

  function stored() {
    return MI.store.get().session.plan;
  }

  function build() {
    var s = MI.store.get().session;
    return MI.generate.local(s.idea, s.courage, s.time, s.motive);
  }

  function ensure() {
    if (!plan) plan = stored() || build();
    return plan;
  }

  // 接受一个新方案（本地或模型），内存与持久层一起更新
  function set(next) {
    plan = next || null;
    MI.store.update(function (s) { s.session.plan = plan; });
    return plan;
  }

  // 丢弃内存值，按「存储优先、本地回退」重新取一次。
  // 用于打开档案：档案条目里存着当时的方案，恢复时原样还原。
  function rebuild() {
    plan = stored() || build();
    return plan;
  }

  // 清空当前念头相关状态时使用：内存与存储一起清
  function clear() {
    plan = null;
    MI.store.update(function (s) { s.session.plan = null; });
  }

  MI.session = {
    ensure: ensure,
    set: set,
    rebuild: rebuild,
    clear: clear,
    get: function () { return plan; }
  };
})(window.MI);
