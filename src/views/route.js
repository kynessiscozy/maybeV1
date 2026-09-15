window.MI = window.MI || {};
(function (MI) {
  'use strict';
  MI.views = MI.views || {};

  var d = MI.dom;

  function parseRoute(ctx) {
    var n = Number(ctx.params.index);
    return Number.isInteger(n) && n >= 0 && n < 3 ? n : MI.store.get().session.route;
  }

  // 隔了几天回来，先认出「你停在哪里」。只有真的离开过才说，
  // 否则每次刷新都报一次，会变成噪音。
  function resumeNote() {
    var j = MI.journey.state();
    var s = MI.store.get();
    var done = s.session.done[s.session.route] || [];
    if (!done.length) return '';
    if (j.daysSince === null || j.daysSince < 2) return '';
    var lastDay = Math.max.apply(null, done);
    return '<p class="resume-note">上一次你停在 DAY 0' + (lastDay + 1) +
      '，那是 ' + d.esc(d.relativeDay(s.meta.lastSeenAt)) + '。格子还在，按下去就接着走。</p>';
  }

  // 底色提示：压力画像显示橙/红区时，在七天面板开场说一句实话——
  // 不改任务规模（那是自进化按反馈管的事），只提醒「不必连续」这一本来就成立的规则。
  function stressNoteHTML() {
    var snap = (MI.stress && MI.stress.snapshot) ? MI.stress.snapshot() : null;
    if (!snap || snap.levelIndex < 4) return '';
    return '<div class="stress-hint" style="margin:0 0 14px">' +
      '<span><b>你的压力画像显示最近负荷偏高（' + d.esc(snap.level) + '）。</b>' +
      '这七天不要求连续，跳过不扣分，格子也不会作废。把步子切小一点，先让第一天发生。</span>' +
      '</div>';
  }

  function render(ctx) {
    // 没有念头就直接落到这里，原本会静默套用「自由试验」的通用模板，
    // 面包屑还是空的。原地给一句引导，比让人对着通用模板猜要好。
    if (!String(MI.store.get().session.idea || '').trim()) {
      return MI.journey.interstitial('route');
    }

    var route = parseRoute(ctx);
    var plan = MI.session.ensure();
    var data = plan.routes[route];

    var switcher = MI.data.ROUTE_NAMES.map(function (name, i) {
      return '<button data-switch="' + i + '"' + (i === route ? ' class="active"' : '') +
        ' aria-pressed="' + (i === route) + '">' + MI.data.ROUTE_LETTERS[i] + ' · ' + d.esc(name) + '</button>';
    }).join('');

    var steps = data.nodes.map(function (n, i) {
      return '<article class="step">' +
        '<div class="step-code"><span>0' + (i + 1) + ' / ' + d.esc(n.code) + '</span>' +
        MI.data.icon(i === 0 ? 'seed' : i === 1 ? 'people' : 'flag') + '</div>' +
        '<h3>' + d.esc(n.title) + '</h3>' +
        '<p>' + d.esc(n.advice) + '</p>' +
        '</article>';
    }).join('');

    var engineBadge = plan.engine === 'ai'
      ? '<span class="engine-badge ai">MODEL</span>'
      : '<span class="engine-badge">LOCAL</span>';

    return '' +
      '<section class="page">' +
      '<div class="crumb">' +
      '<button data-nav="/lab">自由实验</button><span>/</span>' +
      '<span>' + d.esc(d.truncate(plan.idea, 26)) + '</span>' +
      '</div>' +
      '<div class="route-head">' +
      '<div>' +
      '<div class="route-code">ROUTE ' + MI.data.ROUTE_LETTERS[route] + ' / 0' + (route + 1) + ' ' + engineBadge + '</div>' +
      '<h1>' + d.esc(MI.data.ROUTE_NAMES[route]) + '</h1>' +
      '</div>' +
      '<div class="route-switch" role="group" aria-label="切换路线">' + switcher + '</div>' +
      '</div>' +

      '<div class="route-layout">' +
      '<div>' +
      '<p class="route-desc">' + d.esc(data.description) + '</p>' +
      '<div class="steps">' + steps + '</div>' +

      '<div class="days-panel">' +
      '<div class="days-head">' +
      '<div><h2>七天，让它真实一点。</h2>' +
      '<p id="plan-sub">每天以 ' + plan.time + ' 分钟为上限，可自由拆分。可以跳过，可以重来。</p></div>' +
      '<div class="progress-group"><div class="progress-track"><div class="progress-fill" id="progress-fill"></div></div>' +
      '<span id="progress-label">0 / 7</span></div>' +
      '</div>' +
      resumeNote() +
      stressNoteHTML() +
      '<div class="days" id="days"></div>' +
      '<div class="completion-box" id="completion" hidden>' +
      '<strong>一件未发生的事，已经发生了。</strong>' +
      '你不必立刻做得更大。记下这七天里最想再来一次的瞬间，那就是下一条路的入口。' +
      '</div>' +
      '<div class="plan-note"><span>每天完成后可以顺手告诉它难度，下次会调整。</span>' +
      '<span id="plan-note-right">开始本身，就很了不起。</span></div>' +
      '</div>' +
      '</div>' +

      '<aside>' +
      '<div class="feedback-card">' +
      '<h3>这条路，像你吗？</h3>' +
      '<p>你的判断会被记住，用来调整以后推荐哪条路。只统计不同念头下的判断。</p>' +
      '<div class="seg" id="route-verdict" role="group" aria-label="对这条路的判断">' +
      MI.data.FEEDBACK_VERDICTS.map(function (v) {
        return '<button data-key="' + v.key + '" aria-pressed="false">' + d.esc(v.label) + '</button>';
      }).join('') +
      '</div>' +
      '<div id="receipt-slot" hidden></div>' +
      '<p class="feedback-hint" id="verdict-hint"></p>' +
      '</div>' +

      '<div class="panel" style="margin-top:18px">' +
      '<div class="panel-head"><div><h2>带走它</h2>' +
      '<p>存进档案柜，或导出一份可离线阅读的备忘录。</p></div></div>' +
      '<button class="btn btn-soft btn-block" id="save-btn">收藏这个版本的自己</button>' +
      '<button class="btn btn-ghost btn-block" id="export-btn" style="margin-top:10px">导出可能性备忘录</button>' +
      '<p class="feedback-hint" id="save-hint"></p>' +
      '</div>' +
      '</aside>' +
      '</div>' +
      '</section>';
  }

  // ── 局部刷新 ────────────────────────────────────────
  function paintDays(root, opts) {
    opts = opts || {};
    var s = MI.store.get();
    var route = s.session.route;
    var plan = MI.session.ensure();
    var done = s.session.done[route] || [];
    var host = root.querySelector('#days');
    if (!host) return;

    // 记录每行的完成状态，用于判断哪一行刚刚发生了变化
    var before = host.dataset.snapshot || '';
    host.dataset.snapshot = done.join(',');

    host.innerHTML = plan.routes[route].days.map(function (text, i) {
      var isDone = done.indexOf(i) > -1;
      var level = MI.feedback.taskLevel(route, i, s.session.idea);
      return '<div class="day-row' + (isDone ? ' completed' : '') + '" data-row="' + i + '">' +
        '<button class="day-main" data-day="' + i + '" aria-pressed="' + isDone + '">' +
        '<span class="check" aria-hidden="true">' + (isDone ? '✓' : '') + '</span>' +
        '<span><span class="day-number">DAY 0' + (i + 1) + '</span>' +
        '<span class="day-title">' + d.esc(text) + '</span></span>' +
        '</button>' +
        '<div class="day-feedback">' +
        '<div class="seg compact" role="group" aria-label="第 ' + (i + 1) + ' 天任务难度">' +
        MI.data.TASK_LEVELS.map(function (lv) {
          return '<button data-level="' + lv.key + '" data-day-index="' + i + '" aria-pressed="' +
            (level === lv.key) + '">' + d.esc(lv.label) + '</button>';
        }).join('') +
        '</div></div>' +
        '</div>';
    }).join('');

    // 进度条：数值用滚动，条用 CSS 过渡，两者节奏一致
    var label = root.querySelector('#progress-label');
    var fill = root.querySelector('#progress-fill');
    MI.motion.countUp(label, done.length, { suffix: ' / 7', duration: 340 });
    var pct = done.length / 7 * 100;
    fill.style.width = pct + '%';
    if (opts.pulseRow != null && done.indexOf(opts.pulseRow) > -1) {
      var row = host.querySelector('[data-row="' + opts.pulseRow + '"]');
      if (row) MI.motion.flash(row, 'row-flash', 900);
    }
    if (done.length === 7 && before !== host.dataset.snapshot) {
      MI.motion.flash(root.querySelector('#completion'), 'in', 900);
    }

    root.querySelector('#completion').hidden = done.length !== 7;
    root.querySelector('#plan-note-right').textContent = done.length === 7
      ? '你已经把「如果」变成了「做过」。'
      : '开始本身，就很了不起。';
  }

  function paintVerdict(root) {
    var s = MI.store.get();
    var verdict = MI.feedback.routeVerdict(s.session.route, s.session.idea);
    root.querySelectorAll('#route-verdict button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.key === verdict));
    });
    var stats = MI.feedback.routeStats()[s.session.route];
    var hint = root.querySelector('#verdict-hint');
    var bias = MI.evolution.bias()[s.session.route];
    var parts = [];
    parts.push('这条路上，你共留下 ' + (stats.like + stats.unlike + stats.unsure) + ' 次判断。');
    if (bias < 0) parts.push('目前它已被降权，不再被默认推荐。');
    if (bias > 0) parts.push('目前它在相近情况下会被优先推荐。');
    hint.textContent = parts.join(' ');
  }

  function paintSave(root) {
    var s = MI.store.get();
    var saved = s.saved.some(function (x) { return x.id === s.session.savedId; });
    var btn = root.querySelector('#save-btn');
    btn.textContent = saved ? '已收藏 · 进度会自动更新' : '收藏这个版本的自己';
    btn.className = 'btn btn-block ' + (saved ? 'btn-ghost' : 'btn-soft');
    root.querySelector('#save-hint').textContent = MI.store.isStorageOK()
      ? '收藏只保存在当前浏览器；重要的念头，记得导出带走。'
      : '浏览器未允许保存，请立即导出，否则刷新后会丢失。';
  }

  function paintAll(root, opts) {
    paintDays(root, opts);
    paintVerdict(root);
    paintSave(root);
  }

  function save(root) {
    var s = MI.store.get();
    if (s.saved.some(function (x) { return x.id === s.session.savedId; })) {
      MI.store.update(function (st) {
        st.saved = st.saved.map(function (x) {
          return x.id === st.session.savedId
            ? { id: x.id, date: x.date, idea: st.session.idea, courage: st.session.courage, time: st.session.time, route: st.session.route, actor: st.session.actor || null, motive: st.session.motive || null, done: st.session.done, plan: x.plan || st.session.plan }
            : x;
        });
      });
      var entry = s.saved.filter(function (x) { return x.id === s.session.savedId; })[0];
      var doneN = entry && entry.done && entry.done[entry.route] ? entry.done[entry.route].length : 0;
      MI.echo.push({
        kind: 'archive',
        surface: 'inline',
        anchor: '#receipt-slot',
        title: '档案已更新到今天的进度。',
        detail: 'FILE / ' + String(s.session.savedId).slice(-6).toUpperCase() +
          ' · 已迈出 ' + doneN + ' 个小步骤',
        delta: { journey: true }
      });
      paintSave(root);
      return;
    }
    if (s.saved.length >= 100) {
      d.toast('档案柜已满。请先导出重要路线，再移除旧档案。');
      return;
    }
    var id = d.uid();
    MI.store.update(function (st) {
      st.session.savedId = id;
      st.saved.push({
        id: id,
        date: new Date().toISOString(),
        idea: st.session.idea,
        courage: st.session.courage,
        time: st.session.time,
        route: st.session.route,
        // 记下当时的预设：只存念头的话，下次「继续这条路」
        // 会退回关键词猜主题，可能算出和当初不一样的三条路。
        actor: st.session.actor || null,
        motive: st.session.motive || null,
        done: st.session.done,
        // 连同展开出的方案一起收进档案：本地结果可以重算，
        // 模型结果带随机性，不存下来，重新打开时就不是当时那份了。
        plan: st.session.plan
      });
    });
    paintSave(root);

    // 存储失败是告警，不是后果，仍然走 toast
    if (!MI.store.isStorageOK()) {
      d.toast('已暂存本次会话；浏览器无法持久保存，请导出。');
      return;
    }
    MI.echo.push({
      kind: 'archive',
      surface: 'inline',
      anchor: '#receipt-slot',
      title: '已编号归档。',
      detail: 'FILE / ' + id.slice(-6).toUpperCase() + ' · ' + d.formatDate(new Date().toISOString()) +
        ' · 这个版本的你不会被覆盖。',
      delta: { journey: true }
    });
    MI.app.announce('已编号归档。之后的进度会跟着这份档案走。');
  }

  function mount(root, ctx) {
    var route = parseRoute(ctx);
    if (route !== MI.store.get().session.route) {
      MI.store.update(function (s) { s.session.route = route; });
    }

    root.querySelectorAll('[data-switch]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        MI.router.go('/route/' + btn.dataset.switch);
      });
    });

    root.querySelector('#days').addEventListener('click', function (e) {
      var levelBtn = e.target.closest('[data-level]');
      if (levelBtn) {
        var dayIndex = Number(levelBtn.dataset.dayIndex);
        MI.feedback.rateTask(MI.store.get().session.route, dayIndex, levelBtn.dataset.level, MI.store.get().session.idea);
        paintAll(root);
        // 反馈回执：把它做了什么摊开给用户看，同时记进事务所日志
        MI.echo.engineReceipt(root, '#receipt-slot',
          MI.receipt.taskReceipt(MI.store.get().session.route, dayIndex, levelBtn.dataset.level));
        MI.app.announce('已记录任务难度，引擎规则已重算。');
        return;
      }
      var dayBtn = e.target.closest('[data-day]');
      if (!dayBtn) return;
      var idx = Number(dayBtn.dataset.day);
      var willComplete = MI.store.get().session.done[MI.store.get().session.route].indexOf(idx) === -1;
      MI.store.update(function (s) {
        var list = s.session.done[s.session.route];
        s.session.done[s.session.route] = list.indexOf(idx) > -1
          ? list.filter(function (i) { return i !== idx; })
          : list.concat(idx).sort(function (a, b) { return a - b; });
        // 已收藏的档案同步进度
        s.saved = s.saved.map(function (x) {
          return x.id === s.session.savedId
            ? { id: x.id, date: x.date, idea: s.session.idea, courage: s.session.courage, time: s.session.time, route: s.session.route, done: s.session.done, plan: x.plan || s.session.plan }
            : x;
        });
      });
      paintAll(root, { pulseRow: willComplete ? idx : null });
      var count = MI.store.get().session.done[MI.store.get().session.route].length;
      if (willComplete) MI.motion.pulse(dayBtn.querySelector('.check'), 'pulse', 520);

      // 取消打卡保持静默。给取消和完成一样的叙事重量，
      // 等于在用户想收回一步时施加压力，这恰是本应用拒绝做的事。
      if (!willComplete) {
        d.toast('已取消这一天的完成状态。');
        return;
      }

      if (count === 7) {
        // 走完七天是最强的情绪时刻，却也是原本闭环最弱的一处：
        // 只有一句 toast，连恐惧模型都不重算——而 you_will_quit 原型
        // 正是拿「完成天数」当证据的。delta.fear 补上了这条断链。
        var s = MI.store.get();
        var times = s.saved.filter(function (x) {
          return x.done && x.done[x.route] && x.done[x.route].length === 7;
        }).length + 1;
        // 收尾的话：这个时刻该有它的声音，而不只是事务所的记录。
        // 本地规则生成（不依赖模型接口），确定性低时它会认输，负荷高时它收着说。
        var closing = (MI.fear.closingLine) ? MI.fear.closingLine(times) : '';
        MI.echo.push({
          kind: 'complete',
          surface: 'inline',
          anchor: '#receipt-slot',
          title: '七天，都走完了。',
          detail: '你在 ' + d.formatDate(new Date().toISOString()) + ' 让「' +
            d.truncate(s.session.idea, 18) + '」发生过。这是第 ' + times + ' 次。' +
            (closing ? '——它说：「' + closing + '」' : ''),
          delta: { fear: true, evolution: true }
        });
        MI.app.announce('七天全部完成。这是第 ' + times + ' 次。');
        return;
      }

      MI.echo.push({
        kind: 'day',
        surface: 'inline',
        anchor: '#receipt-slot',
        title: '第 ' + (idx + 1) + ' 天，已记下。',
        detail: '剩下的 ' + (7 - count) + ' 格还在。不必连续，格子也不会作废。',
        delta: { fear: true }
      });
      MI.app.announce('已记下第 ' + (idx + 1) + ' 天，共完成 ' + count + ' 天。');
    });

    root.querySelector('#route-verdict').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-key]');
      if (!btn) return;
      var route = MI.store.get().session.route;
      var verdict = btn.dataset.key;
      MI.feedback.rateRoute(route, verdict, MI.store.get().session.idea);
      paintAll(root);
      // 关键闭环：让用户看到「我的一票改变了推荐」
      MI.echo.engineReceipt(root, '#receipt-slot',
        MI.receipt.routeReceipt(route, verdict, MI.store.get().session.idea));
      MI.app.announce('已记录判断，路线权重已重新计算。');
    });

    root.querySelector('#save-btn').addEventListener('click', function () { save(root); });
    root.querySelector('#export-btn').addEventListener('click', function () { MI.exporter.downloadMemo(); });

    paintAll(root);
  }

  MI.views.route = {
    title: '路线详情',
    render: render,
    mount: mount
  };
})(window.MI);
