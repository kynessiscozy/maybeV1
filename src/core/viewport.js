window.MI = window.MI || {};
(function (MI) {
  'use strict';

  /* 视口与软键盘
     ============================================================
     这个模块只解决一件事：iOS 上软键盘弹出时，页面底部那两条常驻
     元素（底部 Tab 栏、回响条）会被键盘压在下面看不见，而正文末尾
     还留着一块永远看不到的占位空档。

     为什么不能只靠 CSS：软键盘是**覆盖**在页面上的，它不改变布局
     视口（window.innerHeight 不变），所以纯 CSS 没有任何信号可用。
     唯一的信号是 visualViewport —— 它才会跟着键盘收缩。

     做法是给 <html> 加一个 kb-open 类，由 CSS 把 --tabbar-h /
     --ledger-h 归零。这样四条依赖高度的规则同时失效，不需要在这里
     逐个去改元素的内联样式。 */

  var api = {};

  // 触摸设备判定：认指针类型，不认屏幕宽度。
  // 窄窗口的桌面浏览器是鼠标，不该拿到触摸设备的那套行为。
  api.touch = false;
  try {
    api.touch = !!(window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches);
  } catch (e) {
    api.touch = false;
  }

  /* 判定阈值
     收缩量低于 120px 不算键盘 —— 手机上滚动时 safari 地址栏收起也会
     让视口变高，那一下的差值在 60~100px 之间，误判成键盘会让 Tab 栏
     无故消失。
     超过 200px 才算「确定是键盘」，中间那段（120~200）保持上一次的
     结论不动，避免在边界上反复横跳。 */
  var ON = 120;
  var OFF = 60;

  var lastOpen = false;
  var timer = null;

  function viewport() { return window.visualViewport || null; }

  function apply(open) {
    if (open === lastOpen) return;
    lastOpen = open;
    var root = document.documentElement;
    if (open) root.classList.add('kb-open');
    else root.classList.remove('kb-open');
  }

  /* evaluate：量一次当前视口，判断键盘是否开着。
     基准取 window.innerHeight（布局视口），当前值取 visualViewport.height。
     两者之差就是被键盘吃掉的高度。 */
  function evaluate() {
    var vv = viewport();
    if (!vv) return;
    var lost = window.innerHeight - vv.height;
    if (lost > ON) apply(true);
    else if (lost < OFF) apply(false);
    // 落在 120~200 之间：维持现状，不下结论
  }

  /* 节流：visualViewport 的 resize 在键盘动画期间会连发几十次，
     每次都去读写 class 会让键盘弹出变卡。80ms 的尾部延迟足够跟手，
     又能把一整段动画压成一次实际计算。 */
  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      timer = null;
      try { evaluate(); } catch (e) { /* 量不到就当没发生 */ }
    }, 80);
  }

  api.mount = function () {
    var vv = viewport();
    if (!vv) return false;
    // passive：这些事件里我们从不 preventDefault，
    // 声明 passive 能让浏览器不必等回调结束就能继续滚动。
    var opts = { passive: true };
    try {
      vv.addEventListener('resize', schedule, opts);
      vv.addEventListener('scroll', schedule, opts);
      // 旋转屏幕后布局视口会变，基准跟着变，需要重新判定一次
      window.addEventListener('orientationchange', schedule, opts);
      // 输入框失焦时键盘一定收了，这时立刻判定而不是等 resize ——
      // 有些情况下 resize 会晚到，Tab 栏会有一段空窗期不回来。
      document.addEventListener('focusout', function () {
        setTimeout(function () { try { evaluate(); } catch (e) { /* 忽略 */ } }, 180);
      }, true);
    } catch (e) {
      // 老浏览器对 options 对象或 visualViewport 的支持不全，
      // 退化掉这个能力即可 —— 底部两条在键盘开启时不隐藏，
      // 用户往上滚一点仍然能用，不是致命问题。
      return false;
    }
    try { evaluate(); } catch (e) { /* 忽略 */ }
    return true;
  };

  // 给测试和调试用：直接问「现在键盘算开着吗」
  api.isKeyboardOpen = function () { return lastOpen; };

  MI.viewport = api;
})(window.MI);
