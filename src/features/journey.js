window.MI = window.MI || {};
(function (MI) {
  'use strict';

  var d = MI.dom;

  /* ────────────────────────────────────────────────────────────
     旅程相位
     给「这个用户现在走到哪一步了」一个唯一答案。各页据此决定：
       · 空态该说什么（而不是对走到一半的人说「还空着」，那读起来像责备）
       · 该不该给出下一步的入口
       · 无数据直达深层页面时该不该先给一句引导

     相位是纯派生的，绝不写进存储。
     存储的相位会在导入、回滚、清空之后与真实数据失同步；
     这与本应用一贯的做法一致——session.js 里也写明派生状态不入库。
     ──────────────────────────────────────────────────────────── */

  var PHASE_LABEL = {
    empty: '还没有开始',
    seeded: '有念头，还没迈步',
    started: '已在路上',
    midway: '走到一半',
    completed: '走完过七天',
    archived: '有一份被留下来',
    returned: '又回来了'
  };

  function state() { return MI.store.get(); }

  function daysSince(iso) {
    if (!iso) return null;
    var then = new Date(iso).getTime();
    if (isNaN(then)) return null;
    return Math.floor((Date.now() - then) / 86400000);
  }

  // 比 memory.isEmpty() 更严格。
  // isEmpty() 只问「有没有记录下学习」，它不检查念头、进度与档案，
  // 所以一个已经写满七天、只是没起过名字的人会被判成 isEmpty。
  // 这个谓词专门回答「这个人是不是完全没开始过」。
  function isVirgin() {
    var s = state();
    return MI.memory.isEmpty() &&
      !String(s.session.idea || '').trim() &&
      MI.fear.totalCompletedDays() === 0 &&
      s.saved.length === 0 &&
      s.fear.turns.length === 0;
  }

  function phase() {
    var s = state();
    if (isVirgin()) return 'empty';

    var days = MI.fear.totalCompletedDays();
    var lastSeen = daysSince(s.meta.lastSeenAt);
    var savedCount = s.saved.length;

    /* 顺序即优先级。这里用一条统一原则来排，而不是逐条打补丁：
       相位描述的是「这个人现在最需要被回应的是什么」，
       所以**刚刚发生的事优先于历史积累**。

       returned    离开≥3天又回来 —— 时间上最紧急，先认人。
       completed   七天才走完   —— 刚刚发生，最该被看见。
       midway / started  正在推进 —— 当下状态。
       archived    只留下过档案 —— 描述历史，最容易变成过时的话，放最后。
       seeded      只有念头     —— 最初始。 */
    if (savedCount >= 1 && lastSeen !== null && lastSeen >= 3) return 'returned';
    if (days >= 7) return 'completed';
    if (days >= 3) return 'midway';
    if (days >= 1) return 'started';
    if (savedCount >= 1) return 'archived';
    return 'seeded';
  }

  // 缓存：phase() 要遍历全部档案算完成天数，不该在渲染循环里反复算。
  // 用 store 的订阅做失效，比在每个写入口手动清缓存可靠。
  var cache = null;
  function cached() {
    if (!cache) cache = { phase: phase(), virgin: isVirgin() };
    return cache;
  }
  MI.store.subscribe(function () { cache = null; });

  // 当前相位的下一步是什么。返回 null 表示没有要推的动作。
  function nextStep() {
    var s = state();
    var p = cached().phase;
    if (p === 'empty') {
      return { nav: '/lab', label: '去种下第一个念头' };
    }
    if (p === 'seeded') {
      return { nav: '/route/' + s.session.route, label: '展开成三条路' };
    }
    if (p === 'started' || p === 'midway') {
      return { nav: '/route/' + s.session.route, label: '接着走完这七天' };
    }
    if (p === 'completed') {
      return { nav: '/archive', label: '把这一次留下来' };
    }
    // archived 与 returned 都已有档案，不再推动作——
    // 这两个相位下用户需要的是一句认出，不是又一条待办。
    return null;
  }

  /* 无数据直达深层页面时的引导。
     刻意不重定向：archive 页的空态是全站质量标杆，它就在原地渲染并给出出口。
     重定向会让用户丢失自己刚才的操作意图，也让地址栏变得不可信。 */
  var INTERSTITIAL = {
    route: {
      title: '这条路还没有起点。',
      desc: '路线是由一个念头长出来的。你现在还没有写下它。<br>哪怕只有一个词，也先把它写下来。',
      art: 'missing',
      artAlt: '一条虚线小路消失在空白的纸上',
      nav: '/lab',
      cta: '去种下第一个念头'
    }
  };

  function interstitial(kind) {
    var cfg = INTERSTITIAL[kind];
    if (!cfg) return '';
    return '' +
      '<section class="page">' +
      '<div class="empty-state journey-interstitial">' +
      (cfg.art ? MI.figure(cfg.art, cfg.artAlt) : '') +
      '<h1>' + d.esc(cfg.title) + '</h1>' +
      '<p>' + cfg.desc + '</p>' +
      '<button class="btn btn-primary" data-nav="' + cfg.nav + '">' + d.esc(cfg.cta) + '</button>' +
      '</div>' +
      '</section>';
  }

  // 外部调用最常问的是「距上次来过了多久」，所以不带参数时默认取 lastSeenAt。
  // 传参仍然支持，archive / 未来别处要算某个档案的年龄时用得上。
  function sinceArg(iso) {
    return daysSince(iso !== undefined ? iso : state().meta.lastSeenAt);
  }

  MI.journey = {
    state: function () {
      var p = cached().phase;
      return {
        phase: p,
        label: PHASE_LABEL[p] || '这里',
        virgin: cached().virgin,
        days: MI.fear.totalCompletedDays(),
        daysSince: sinceArg(),
        lastSeenAt: state().meta.lastSeenAt,
        next: nextStep()
      };
    },
    phase: function () { return cached().phase; },
    isVirgin: function () { return cached().virgin; },
    interstitial: interstitial,
    nextStep: nextStep,
    daysSince: sinceArg
  };
})(window.MI);
