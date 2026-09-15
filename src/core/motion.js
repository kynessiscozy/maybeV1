window.MI = window.MI || {};
(function (MI) {
  'use strict';

  /* ────────────────────────────────────────────────────────────
     交互动效内核
     全站只有这一处负责「过程感」：错峰入场、数字滚动、高亮闪烁、脉冲。
     所有函数都在 prefers-reduced-motion 下退化为「直接给出终态」，
     因此调用方不需要自己判断无障碍偏好。
     ──────────────────────────────────────────────────────────── */

  var reduced = false;
  try {
    reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e) { reduced = false; }

  var raf = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };

  // 错峰入场：给一组元素依次加上 keep 类，制造「铺开」的过程感。
  // 元素默认由 CSS 设为 opacity:0，避免首帧闪白。
  function inView(nodes, opts) {
    opts = opts || {};
    var step = opts.step == null ? 70 : opts.step;
    var cap = opts.cap == null ? 460 : opts.cap;
    var cls = opts.cls || 'keep';
    var list = Array.prototype.slice.call(nodes || []);

    if (reduced) {
      list.forEach(function (el) { el.classList.add(cls); });
      return list.length * 0;
    }

    list.forEach(function (el, i) {
      var delay = Math.min(i * step, cap);
      el.style.animationDelay = delay + 'ms';
      // 强制一次样式计算，确保动画从头播放
      void el.offsetWidth;
      el.classList.add(cls);
    });
    return 0;
  }

  // 数字滚动：用于统计、进度、仪表值。终态始终精确落在目标值上。
  // fmt 可选：用来保留调用方的排版（比如导航徽标的零填充）。
  // 没有它的话，滚动过程会把 "01" 写成 "1"，补零只在滚动结束后才恢复。
  function countUp(el, to, opts) {
    if (!el) return;
    opts = opts || {};
    var from = Number(el.dataset.countFrom || opts.from || 0);
    var dur = opts.duration == null ? 620 : opts.duration;
    var suffix = opts.suffix || '';
    var decimals = opts.decimals || 0;
    var fmt = opts.fmt || null;

    function show(v) {
      var n = decimals ? v.toFixed(decimals) : String(Math.round(v));
      el.textContent = fmt ? fmt(n) : n + suffix;
    }

    el.dataset.countFrom = String(to);

    if (reduced || from === to) { show(to); return; }

    var t0 = null;
    show(from);
    function tick(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      // easeOutCubic
      var e = 1 - Math.pow(1 - p, 3);
      show(from + (to - from) * e);
      if (p < 1) raf(tick);
      else show(to);
    }
    raf(tick);
  }

  // 高亮闪烁：元素刚刚发生变化时的一记提醒
  function flash(el, cls, ms) {
    if (!el) return;
    var name = cls || 'flash';
    el.classList.remove(name);
    void el.offsetWidth;
    el.classList.add(name);
    setTimeout(function () { el.classList.remove(name); }, ms || 900);
  }

  // 一次性脉冲，用于打卡、投票等需要即时回应的动作
  function pulse(el, cls, ms) {
    if (!el || reduced) return;
    var name = cls || 'pulse';
    el.classList.remove(name);
    void el.offsetWidth;
    el.classList.add(name);
    setTimeout(function () { el.classList.remove(name); }, ms || 520);
  }

  // 尊重 reduced-motion 的平滑滚动
  function scrollTo(top) {
    try {
      window.scrollTo({ top: top, behavior: reduced ? 'auto' : 'smooth' });
    } catch (e) {
      window.scrollTo(0, top);
    }
  }

  MI.motion = {
    reduced: reduced,
    inView: inView,
    stagger: inView,
    countUp: countUp,
    flash: flash,
    pulse: pulse,
    scrollTo: scrollTo
  };
})(window.MI);
