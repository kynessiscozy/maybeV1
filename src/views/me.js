window.MI = window.MI || {};
(function (MI) {
  'use strict';
  MI.views = MI.views || {};

  var d = MI.dom;
  var pendingRemove = null;
  var pendingClear = null;
  // 当前子标签跨 MI.router.render() 保留：记忆里的每条动作都会重渲染整个 #view，
  // 若不在渲染时恢复，用户每次删一条就会跳回「档案」子标签。
  var currentSub = 'archive';

  // ───────────────────────── 档案：收藏的路线版本 ─────────────────────────
  function paintArchive(root) {
    var saved = MI.store.get().saved;
    var grid = root.querySelector('#archive-grid');
    pendingRemove = null;

    if (!saved.length) {
      // 「还空着」对走了好几天的人是一句指责，对刚来的人才是邀请。
      var phase = MI.journey.phase();
      var emptyCopy;
      if (phase === 'empty') {
        emptyCopy = ['档案柜还空着，未来不是。',
          '在路线详情页点击「收藏这个版本的自己」，<br>给某一种可能性留一个位置。',
          '去种下第一个念头'];
      } else if (phase === 'started' || phase === 'midway') {
        emptyCopy = ['你还在路上，所以这里还空着。',
          '档案是留给「已经定稿」的那个版本的。<br>等这条路走完，再决定要不要存下它。',
          '回到这条路'];
      } else if (phase === 'completed') {
        emptyCopy = ['七天走完了，但你还没把它存下来。',
          '收藏不会改变任何事，只是留一个对照。<br>将来的你可以回头看看当初是怎么想的。',
          '回到这条路'];
      } else {
        emptyCopy = ['档案柜还空着。',
          '收藏过、又删掉也是可以的。<br>这里只放你现在还愿意留着的东西。',
          '去种下一个念头'];
      }
      var emptyNav = phase === 'empty' ? '/lab' : '/route/' + MI.store.get().session.route;
      grid.innerHTML = '<div class="empty-state">' +
        MI.figure('archive', '三封尚未写上名字的信') +
        '<h2>' + emptyCopy[0] + '</h2>' +
        '<p>' + emptyCopy[1] + '</p>' +
        '<button class="btn btn-primary" data-nav="' + emptyNav + '">' + emptyCopy[2] + '</button>' +
        '</div>';
      return;
    }

    grid.innerHTML = saved.slice().reverse().map(function (s) {
      var done = (s.done && s.done[s.route] ? s.done[s.route].length : 0);
      return '<article class="archive-card">' +
        '<div class="archive-date">FILE / ' + d.esc(s.id.slice(-6).toUpperCase()) + ' &nbsp; ' + d.esc(d.formatDate(s.date)) + '</div>' +
        '<h3>' + d.esc(s.idea) + '</h3>' +
        '<p>' + d.esc(MI.data.ROUTE_NAMES[s.route]) + ' · ' + s.time + ' 分钟 / 天<br>' +
        '已迈出 ' + done + ' 个小步骤</p>' +
        '<div class="archive-actions">' +
        '<button data-open="' + d.esc(s.id) + '">继续这条路 ↗</button>' +
        '<button data-remove="' + d.esc(s.id) + '" aria-label="从档案柜移除：' + d.esc(s.idea) + '">移除</button>' +
        '</div></article>';
    }).join('');
  }

  // ───────────────────────── 账本：学到的你 ─────────────────────────
  // 返回「账本」子面板的内部 HTML（stat-row + memory-grid），由外层包在 #sub-memory 里。

  // 负荷轨迹：把压力画像的历史 CPSI 画成折线（旧→新，最多 12 次）。
  // 阈值色与压力画像的五级预警保持一致（40/56/71/86）。
  function zoneColor(cpsi) {
    if (cpsi < 40) return '#10b981';
    if (cpsi < 56) return '#3b82f6';
    if (cpsi < 71) return '#eab308';
    if (cpsi < 86) return '#f97316';
    return '#ef4444';
  }

  function loadSparkline(pts) {
    var W = 280, H = 88, PAD = 8;
    var n = pts.length;
    function x(i) { return n === 1 ? W / 2 : PAD + (W - PAD * 2) * i / (n - 1); }
    function y(v) { return H - PAD - (H - PAD * 2) * Math.max(0, Math.min(100, v)) / 100; }
    var line = pts.map(function (p, i) {
      return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.cpsi).toFixed(1);
    }).join(' ');
    var dots = pts.map(function (p, i) {
      return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(p.cpsi).toFixed(1) + '" r="3" fill="' + p.color + '"></circle>';
    }).join('');
    return '<svg class="load-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="历次压力画像的综合压力指数折线">' +
      '<line x1="' + PAD + '" y1="' + y(50).toFixed(1) + '" x2="' + (W - PAD) + '" y2="' + y(50).toFixed(1) +
      '" stroke="var(--line)" stroke-dasharray="3 3"></line>' +
      '<path d="' + line + '" fill="none" stroke="var(--ink-soft)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"></path>' +
      dots + '</svg>';
  }

  function loadFold() {
    var st = MI.store.get().stress;
    var all = (st && st.history && st.history.length) ? st.history : [];
    if (!all.length) {
      return d.fold({
        summary: '负荷轨迹',
        hint: '还没有记录',
        cls: 'fold-panel',
        body: '<p class="page-desc">完成一次压力画像后，这里会画出你的负荷随时间的变化。</p>' +
          '<button class="btn btn-ghost" data-nav="/stress" style="margin-top:12px">去做一次压力画像</button>'
      });
    }
    // history 是新的在前，画折线要旧→新
    var pts = all.slice(0, 12).reverse().map(function (e) {
      return { cpsi: e.cpsi, color: zoneColor(e.cpsi) };
    });
    var latest = all[0], prev = all[1];
    var deltaTxt = !prev ? '这是第一次记录'
      : (latest.cpsi === prev.cpsi ? '与上次持平'
        : (latest.cpsi > prev.cpsi ? '比上次高 ' + (latest.cpsi - prev.cpsi) + ' 分' : '比上次低 ' + (prev.cpsi - latest.cpsi) + ' 分'));
    return d.fold({
      summary: '负荷轨迹',
      hint: '最近 ' + Math.min(all.length, 12) + ' 次 · ' + latest.cpsi + '/100',
      cls: 'fold-panel',
      body: loadSparkline(pts) +
        '<p class="fold-note"><strong>' + latest.cpsi + '/100 · ' + d.esc(latest.level) + '</strong>，' +
        d.esc(deltaTxt) + '。分数只是坐标，方向比单次高低更值得看。</p>'
    });
  }

  function memoryInner() {
    var s = MI.store.get();
    var facts = MI.memory.facts();
    var rank = MI.memory.themeRanking();
    var evo = MI.evolution.log();
    var fb = MI.feedback.log();
    var hist = MI.memory.history();

    var factRows = facts.length ? facts.map(function (f) {
      return '<div class="fact">' +
        '<span class="fact-label">' + d.esc(f.label) + '</span>' +
        '<span class="fact-value">' + d.esc(f.value) + '</span>' +
        (f.kind === 'care'
          ? '<button class="fact-remove" data-forget-care="' + f.index + '" aria-label="忘记这条">×</button>'
          : '<span style="width:14px"></span>') +
        '</div>';
    }).join('') : '<p class="page-desc">还没有记住任何事。去自由实验写下一个念头，或者在这里先告诉它你是谁。</p>';

    var bars = rank.length ? rank.map(function (t) {
      return '<div class="bar-row">' +
        '<span class="bar-name">' + d.esc(t.label) + '</span>' +
        '<span class="bar-track"><span class="bar-fill" style="width:' + Math.round(t.share * 100) + '%"></span></span>' +
        '<span class="bar-value">' + t.count + ' 次</span>' +
        '</div>';
    }).join('') : '<p class="page-desc">写下念头后，这里会显示你的注意力落在哪些主题上。</p>';

    var evoList = evo.length ? evo.map(function (l) {
      return '<div class="evo-item">' +
        '<p class="evo-trigger">' + d.esc(l.trigger) + '</p>' +
        '<p class="evo-change">' + d.esc(l.change) + '</p>' +
        '<p class="evo-meta">REV ' + l.revision + ' &nbsp;·&nbsp; ' + d.esc(d.relativeDay(l.date)) + '</p>' +
        '</div>';
    }).join('') : '<p class="page-desc">还没有触发过自我调整。给它几次反馈，这里就会出现变更记录。</p>';

    var fbList = fb.length ? fb.map(function (l) {
      return '<div class="log-item">' +
        '<span class="log-date">' + d.esc(d.relativeDay(l.date)) + '</span>' +
        '<span class="log-body"><strong>' + d.esc(l.text) + '</strong>' +
        (l.detail ? '<span>' + d.esc(l.detail) + '</span>' : '') + '</span>' +
        '</div>';
    }).join('') : '<p class="page-desc">还没有收到反馈。在路线详情页告诉它「像不像你」，它就会开始调整。</p>';

    var histList = hist.length ? hist.map(function (h, i) {
      var realIndex = s.observed.history.length - 1 - i;
      return '<div class="history-item">' +
        '<span class="history-main">' +
        '<span class="history-idea">' + d.esc(h.idea) + '</span>' +
        '<span class="history-meta">' + d.esc(MI.data.THEMES[h.theme] ? MI.data.THEMES[h.theme].label : h.theme) +
        ' · 胆量 ' + h.courage + '% · ' + h.time + ' 分钟 · ' + d.esc(d.relativeDay(h.date)) + '</span>' +
        '</span>' +
        '<button class="fact-remove" data-forget-history="' + realIndex + '" aria-label="忘记这个念头">×</button>' +
        '</div>';
    }).join('') : '<p class="page-desc">还没有写下的念头。</p>';

    return '' +
      '<div class="stat-row">' +
      '<div class="stat"><strong>' + s.observed.totalIdeas + '</strong><span>写下的念头</span></div>' +
      '<div class="stat"><strong>' + (s.feedback.routes.length + s.feedback.tasks.length) + '</strong><span>给出的反馈</span></div>' +
      '<div class="stat"><strong>v' + s.evolution.revision + '</strong><span>规则版本</span></div>' +
      '</div>' +

      '<div class="memory-grid">' +
      '<div>' +
      '<div class="panel">' +
      '<div class="panel-head"><div><h2>你希望它知道的事</h2>' +
      '<p>主动告诉它，比让它猜更准确。</p></div></div>' +
      '<div class="form-row"><label for="profile-name">怎么称呼你</label>' +
      '<input type="text" id="profile-name" maxlength="20" placeholder="留空也可以" value="' + d.esc(s.profile.name) + '"></div>' +
      '<div class="form-row"><label for="profile-cares">你在意的几件事</label>' +
      '<input type="text" id="profile-cares" placeholder="用顿号或逗号分隔，最多 6 项" value="' + d.esc(s.profile.cares.join('、')) + '">' +
      '<p class="hint">例如：稳定的作息、和家人的时间、不被评价的表达</p></div>' +
      '<button class="btn btn-soft" id="save-profile">记住这些</button>' +
      '</div>' +

      d.fold({
        summary: '它观察到的',
        hint: facts.length + ' 条',
        cls: 'fold-panel',
        body: '<div class="fact-list">' + factRows + '</div>'
      }) +

      d.fold({
        summary: '注意力分布',
        hint: rank.length ? rank[0].label + ' 最多' : '暂无',
        cls: 'fold-panel',
        body: '<div class="bar-list">' + bars + '</div>'
      }) +
      '</div>' +

      '<div>' +
      loadFold() +

      d.fold({
        summary: '它为自己改了什么',
        hint: evo.length ? 'REV ' + s.evolution.revision : '还没有调整',
        cls: 'fold-panel',
        open: true,
        body: (evo.length ? '<button class="text-btn" id="reset-evolution" style="margin-bottom:12px">回滚到默认</button>' : '') +
          '<p class="fold-note">每次调整都记录原因，可以一键回滚。这不是机器学习，是可解释的规则。</p>' +
          evoList
      }) +

      d.fold({
        summary: '你给过的反馈',
        hint: fb.length + ' 条',
        cls: 'fold-panel',
        body: (fb.length ? '<button class="text-btn" id="clear-feedback" style="margin-bottom:12px">清空反馈</button>' : '') +
          '<div class="log-list">' + fbList + '</div>'
      }) +

      d.fold({
        summary: '写过的念头',
        hint: hist.length + ' 条',
        cls: 'fold-panel',
        body: '<div class="history-list">' + histList + '</div>'
      }) +

      d.fold({
        summary: '数据管理',
        hint: '导出 · 导入 · 清空',
        cls: 'fold-panel',
        body:
          '<div class="switch-row">' +
          '<span><span class="switch-label">清空记忆与反馈</span>' +
          '<span class="switch-hint">保留档案柜与当前工作台，只忘掉学到的偏好。</span></span>' +
          '<button class="btn btn-ghost" id="clear-learning">清空</button>' +
          '</div>' +
          '<div class="switch-row">' +
          '<span><span class="switch-label">导出全部数据</span>' +
          '<span class="switch-hint">得到一个 JSON 文件，可备份或迁移到别的浏览器。</span></span>' +
          '<button class="btn btn-ghost" id="export-data">导出</button>' +
          '</div>' +
          '<div class="switch-row">' +
          '<span><span class="switch-label">导入数据</span>' +
          '<span class="switch-hint">从备份文件恢复，会覆盖当前全部内容。</span></span>' +
          '<button class="btn btn-ghost" id="import-data">导入</button>' +
          '</div>' +
          '<div class="switch-row">' +
          '<span><span class="switch-label">删除全部内容</span>' +
          '<span class="switch-hint">档案、记忆、反馈、设置一并清空，无法撤销。</span></span>' +
          '<button class="btn btn-danger" id="clear-all">删除</button>' +
          '</div>' +
          '<input type="file" id="import-file" accept="application/json,.json" hidden>'
      }) +
      '</div>' +
      '</div>';
  }

  // 账本里每条动作都会 MI.router.render() 把 #view 换掉，所以回响一律落到抽屉，
  // 不在页内挂锚点。kind 保留 'memory' 以兼容既有回响记录查询。
  function note(title, detail) {
    MI.echo.push({ kind: 'memory', surface: 'ledger', title: title, detail: detail });
  }

  function mountMemory(root) {
    root.querySelector('#save-profile').addEventListener('click', function () {
      var name = root.querySelector('#profile-name').value.trim();
      var cares = root.querySelector('#profile-cares').value
        .split(/[、,，;；]/)
        .map(function (t) { return t.trim(); })
        .filter(Boolean);
      MI.memory.setProfile({ name: name, cares: cares });
      MI.router.render();
      d.toast('记住了。之后展开建议时会带上这些。');
      if (name) {
        note('它现在叫你「' + name + '」。', cares.length
          ? '还记下了你在意的 ' + cares.length + ' 件事。这些只在展开建议时用，不做画像。'
          : '名字记下了。在意的几件事可以随时补上。');
      } else if (cares.length) {
        note('记下了你在意的 ' + cares.length + ' 件事。', '下次展开建议时会绕着它们走。');
      } else {
        note('这次没有告诉它什么。', '空白也是一种答案，它不会替你填。');
      }
    });

    root.querySelector('.fact-list').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-forget-care]');
      if (!btn) return;
      var idx = Number(btn.dataset.forgetCare);
      var cares = MI.store.get().profile.cares.slice();
      var gone = cares[idx] || '';
      cares.splice(idx, 1);
      MI.memory.setProfile({ cares: cares });
      MI.router.render();
      d.toast('已忘记这一条。');
      note(gone ? '忘记「' + gone + '」。' : '忘记了一条。', '这一条不会再影响后面的建议。');
    });

    root.querySelector('.history-list').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-forget-history]');
      if (!btn) return;
      var idx = Number(btn.dataset.forgetHistory);
      var h = MI.store.get().observed.history[idx] || {};
      MI.memory.forgetHistory(idx);
      MI.router.render();
      d.toast('已忘记这个念头。');
      note('忘记一个念头。', h.idea ? '「' + String(h.idea).slice(0, 60) + '」不再计入注意力分布。' : '它不再计入注意力分布。');
    });

    var resetBtn = root.querySelector('#reset-evolution');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        var before = MI.store.get().evolution.revision;
        MI.evolution.reset();
        MI.router.render();
        d.toast('规则已回滚到默认状态。');
        note('规则回滚到默认。', 'REV ' + before + ' 攒下的判断全部作废，从 REV 0 重新开始。');
      });
    }

    var clearFb = root.querySelector('#clear-feedback');
    if (clearFb) {
      clearFb.addEventListener('click', function () {
        var n = MI.store.get().feedback.routes.length + MI.store.get().feedback.tasks.length;
        MI.feedback.clear();
        MI.router.render();
        d.toast('反馈已清空，规则也随之回滚。');
        note('清空 ' + n + ' 条反馈。', '规则随之回滚。你还得重新告诉它什么像你。');
      });
    }

    root.querySelector('#clear-learning').addEventListener('click', function () {
      var ideas = MI.store.get().observed.totalIdeas;
      MI.store.clearLearning();
      MI.session.clear();
      MI.router.render();
      d.toast('记忆与反馈已清空，档案柜保留。');
      note('清空了记忆与反馈。', ideas
        ? '写下的 ' + ideas + ' 个念头不再计入统计，档案柜和当前工作台没动。'
        : '档案柜和当前工作台没动。');
    });

    root.querySelector('#export-data').addEventListener('click', function () {
      var blob = new Blob([MI.store.exportJSON()], { type: 'application/json;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = '未发生事务所-数据备份.json';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
      d.toast('已开始导出数据备份。文件不含模型密钥。');
      note('导出了一份备份。', '这是一份可以带走的副本，模型密钥没有跟着走。文件丢了不影响这里，这里丢了它有。');
    });

    var fileInput = root.querySelector('#import-file');
    root.querySelector('#import-data').addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          MI.store.importJSON(String(reader.result));
          MI.session.clear();
          MI.router.render();
          d.toast('数据已恢复。');
          note('从备份恢复了一份数据。', '当前内容已被这份备份覆盖。');
        } catch (err) {
          d.toast('这个文件读不出来，请确认是本站导出的备份。');
        }
      };
      reader.readAsText(file);
    });

    root.querySelector('#clear-all').addEventListener('click', function () {
      if (pendingClear !== 'yes') {
        pendingClear = 'yes';
        var btn = root.querySelector('#clear-all');
        btn.textContent = '确认删除全部？';
        return;
      }
      // 全清是唯一一处刻意留白：在「我删掉了一切」上面记一笔，
      // 是这台机器不肯松手。这里只重置账本，不写任何条目。
      MI.store.clearAll();
      MI.session.clear();
      MI.echo.reset();
      pendingClear = null;
      MI.router.render();
      d.toast('已删除全部内容。');
    });
  }

  function render() {
    var archiveOn = currentSub === 'archive';
    return '' +
      '<section class="page">' +
      '<div class="page-head">' +
      '<div class="eyebrow">ARCHIVE &amp; LEDGER &nbsp;/&nbsp; 你的与它的</div>' +
      '<h1 class="page-title">档案记忆</h1>' +
      '<p class="page-desc">左边是你收藏的版本，右边是它为更贴身而记住的你。都只在本地，随时可删。</p>' +
      '</div>' +
      '<div class="subtabs" id="me-tabs">' +
      '<button class="subtab' + (archiveOn ? ' active' : '') + '" data-sub="archive" aria-selected="' + (archiveOn ? 'true' : 'false') + '">档案 · 收藏版本</button>' +
      '<button class="subtab' + (archiveOn ? '' : ' active') + '" data-sub="memory" aria-selected="' + (archiveOn ? 'false' : 'true') + '">账本 · 学到的你</button>' +
      '</div>' +
      '<div class="subpanel" id="sub-archive"' + (archiveOn ? '' : ' hidden') + '>' +
      '<div class="archive-grid" id="archive-grid"></div>' +
      '</div>' +
      '<div class="subpanel" id="sub-memory"' + (archiveOn ? ' hidden' : '') + '>' +
      memoryInner() +
      '</div>' +
      '</section>';
  }

  function mount(root) {
    paintArchive(root);

    root.querySelector('#me-tabs').addEventListener('click', function (e) {
      var btn = e.target.closest('.subtab');
      if (!btn) return;
      currentSub = btn.dataset.sub;
      root.querySelectorAll('.subtab').forEach(function (t) {
        var on = t.dataset.sub === currentSub;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      root.querySelector('#sub-archive').hidden = currentSub !== 'archive';
      root.querySelector('#sub-memory').hidden = currentSub !== 'memory';
    });

    root.querySelector('#archive-grid').addEventListener('click', function (e) {
      var openBtn = e.target.closest('[data-open]');
      if (openBtn) {
        var target = MI.store.get().saved.filter(function (x) { return x.id === openBtn.dataset.open; })[0];
        if (!target) return;
        MI.store.update(function (s) {
          s.session = {
            idea: target.idea,
            courage: target.courage,
            time: target.time,
            route: target.route,
            // 恢复当时的预设，保证算出来的三条路和收藏时一致
            actor: target.actor || null,
            motive: target.motive || null,
            done: target.done.map(function (list) { return list.slice(); }),
            savedId: target.id,
            // 档案里存着当时展开出的方案（模型结果带随机性，必须原样还原；
            // 旧档案没有这一项，rebuild 会回退到本地规则重算）
            plan: target.plan || null
          };
        });
        MI.session.rebuild();
        MI.router.go('/route/' + target.route);
        d.toast('已打开这份可能性，之前的行动进度也在。');
        MI.echo.push({
          kind: 'archive', surface: 'ledger',
          title: '打开了 FILE / ' + String(target.id).slice(-6).toUpperCase() + '。',
          detail: '这是你 ' + d.relativeDay(target.date) + '存下的版本，进度原样还原。'
        });
        return;
      }

      var removeBtn = e.target.closest('[data-remove]');
      if (!removeBtn) return;
      var id = removeBtn.dataset.remove;
      if (pendingRemove !== id) {
        root.querySelectorAll('[data-remove]').forEach(function (b) {
          b.textContent = '移除';
          b.classList.remove('btn-danger');
        });
        pendingRemove = id;
        removeBtn.textContent = '确认移除？';
        removeBtn.classList.add('btn-danger');
        return;
      }
      MI.store.update(function (s) {
        s.saved = s.saved.filter(function (x) { return x.id !== id; });
        if (s.session.savedId === id) s.session.savedId = null;
      });
      paintArchive(root);
      d.toast('已从档案柜移除；当前工作台的内容不会被清空。');
      MI.echo.push({
        kind: 'archive', surface: 'ledger',
        title: '移除了 FILE / ' + String(id).slice(-6).toUpperCase() + '。',
        detail: '档案没了。当前这条路还在，随时可以重新存一次。'
      });
    });

    mountMemory(root);
  }

  MI.views.me = {
    title: '档案记忆',
    render: render,
    mount: mount
  };
})(window.MI);
