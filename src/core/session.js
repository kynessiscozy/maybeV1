window.MI = window.MI || {};
(function (MI) {
  'use strict';

  // 当前这一次展开的方案。属于会话级派生状态，不写进本地存储：
  // 存储里只留念头、胆量、时间这些「用户输入」，方案永远可以重新算出来。

  var plan = null;

  function build() {
    var s = MI.store.get().session;
    return MI.generate.local(s.idea, s.courage, s.time, s.motive);
  }

  function ensure() {
    if (!plan) plan = build();
    return plan;
  }

  function set(next) { plan = next; return plan; }

  function rebuild() { plan = build(); return plan; }

  function clear() { plan = null; }

  MI.session = {
    ensure: ensure,
    set: set,
    rebuild: rebuild,
    clear: clear,
    get: function () { return plan; }
  };
})(window.MI);
