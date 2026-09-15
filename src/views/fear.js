window.MI = window.MI || {};
(function (MI) {
  'use strict';
  MI.views = MI.views || {};

  var d = MI.dom;
  var thinking = false;

  var CARE_TEXT = '我停一下。\n\n' +
    '刚才那句话里，有些东西超出了这个作品能接住的范围。这里只是一个用你自己的记录拼出来的声音，' +
    '它说的不是事实，也不该由它来陪你面对这种时刻。\n\n' +
    '如果你此刻感到难以承受，请把它告诉一个你信任的人；如果情况紧急，请联系当地的专业心理支持或急救服务。' +
    '你不需要独自处理这件事。';

  function render() {
    return '' +
      '<section class="page">' +
      '<div class="page-head">' +
      '<div>' +
      '<div class="eyebrow">THE FEAR MODEL &nbsp;/&nbsp; 用你的痕迹蒸馏出来的声音</div>' +
      '<h1 class="page-title">恐惧模型</h1>' +
      '<p class="page-desc">它由你的痕迹蒸馏而成。唯一的进化方向是越辩越弱。</p>' +
      '</div>' +
      '</div>' +

      // 原本整块铺开的警示收进折叠：默认只留一行摘要
      d.fold({
        cls: 'fold-warn',
        summary: '在开始之前',
        hint: '这不是心理咨询',
        body: '<p>这里的对话不是心理咨询、不是诊断，也不能替代专业帮助。它模拟的是「那个拦住你的声音」，' +
          '目的是让你看清它、反驳它，而不是相信它。所有对话只保存在本浏览器。' +
          '如果你正处在情绪危机中，请优先联系你信任的人或专业心理支持。</p>'
      }) +

      '<div class="fear-layout" style="margin-top:18px">' +
      '<div class="chat-panel">' +
      '<div class="chat-log" id="chat-log" role="log" aria-live="polite" aria-label="与恐惧模型的对话"></div>' +
      '<form class="chat-form" id="chat-form">' +
      '<label class="sr-only" for="chat-text">说点什么，反驳它</label>' +
      '<textarea id="chat-text" maxlength="400" placeholder="说点什么，反驳它。它只能听懂你写在这里的东西。"></textarea>' +
      '<div class="chat-actions">' +
      '<span class="chat-count" id="chat-count">0 / 400</span>' +
      '<button class="btn btn-primary" type="submit" id="chat-send">说回去</button>' +
      '</div>' +
      '</form>' +
      '<p class="chat-hint" id="chat-hint">它说的不是事实。它只是你最熟悉的那种声音。</p>' +
      '</div>' +

      '<aside>' +
      stressContextHTML() +
      '<div class="panel">' +
      '<div class="panel-head"><div><h2>蒸馏报告</h2>' +
      '<p>它由什么构成。每一句都能追溯到一条真实数据。</p></div></div>' +
      '<div class="meter-list" id="meters"></div>' +
      '<div id="fear-receipt" hidden></div>' +
      '<div class="fact-list" id="corpus-list"></div>' +
      '<div class="archetype-list" id="archetype-list"></div>' +
      '<div id="distill-actions"></div>' +
      '</div>' +

      // 自进化日志：折叠在蒸馏报告下方，需要时才展开
      '<div class="panel">' +
      d.fold({
        summary: '它的自进化',
        hint: MI.store.get().fear.model.log.length
          ? 'REV ' + MI.store.get().fear.model.revision
          : '还没有变化',
        body: '<div class="fold-note">每次你表态，它都会重新计算自己的确定性与压迫感。</div>' +
          '<div id="fear-log"></div>' +
          (MI.store.get().fear.model.log.length
            ? '<button class="text-btn" id="reset-fear" style="margin-top:14px">重置这段对话</button>'
            : '')
      }) +
      '</div>' +
      '</aside>' +
      '</div>' +
      '</section>';
  }

  // ── 压力底色：把压力画像结果接进恐惧模型 ──────────────
  // 这块是「此刻的坐标」——让恐惧模型知道用户当下背着多大的负荷，
  // 而不只是从他的历史痕迹里推断。它不构成诊断，只作对话背景。
  function stressContextHTML() {
    var snap = (MI.stress && MI.stress.snapshot) ? MI.stress.snapshot() : null;
    if (!snap) {
      return '<div class="panel stress-context" id="stress-context">' +
        '<div class="panel-head"><div><h2>压力底色</h2>' +
        '<p>它此刻能读到的，只有你写下的念头与判断。</p></div></div>' +
        '<p class="sc-note">还没做过压力画像。这是恐惧模型唯一没有坐标的一块——' +
        '它不知道你「此刻」背着多大的负荷，只能从你的历史痕迹里去推断。</p>' +
        '<p class="sc-note">补一次压力画像，给它一个「此刻」的坐标，它接下来对你的判断会更贴近现在的你。</p>' +
        '<button class="btn btn-ghost btn-block" data-nav="/stress" style="margin-top:14px">去做一次压力画像</button>' +
        '</div>';
    }
    var der = MI.fear.derive();
    var focusLabel = (der.focus && MI.fear.ARCHETYPES[der.focus]) ? MI.fear.ARCHETYPES[der.focus].label : null;
    var at = snap.at ? new Date(snap.at).toLocaleString('zh-CN') : '';
    var bridge = stressBridge(snap, der, focusLabel);
    var cpsi = Math.max(2, Math.min(100, snap.cpsi));
    return '<div class="panel stress-context" id="stress-context">' +
      '<div class="panel-head"><div><h2>压力底色</h2>' +
      '<p>来自压力画像，作为此刻对话的背景。</p></div></div>' +
      '<div class="sc-meta">完成于 ' + d.esc(at) + '</div>' +
      '<div class="sc-mini">' +
      '<div class="sc-cpsi" style="color:' + snap.levelColor + '">' + snap.cpsi + '<span>/100</span></div>' +
      '<div class="sc-tags">' +
      '<span class="sc-pill" style="background:' + snap.levelColor + '22;color:' + snap.levelColor + '">' + d.esc(snap.level) + '</span>' +
      '<span class="sc-type">' + d.esc(snap.type) + ' · ' + d.esc(snap.mainName) + ' × ' + d.esc(snap.chanName) + '</span>' +
      '</div></div>' +
      '<div class="sc-bar"><i style="width:' + cpsi + '%;background:' + snap.levelColor + '"></i></div>' +
      '<p class="sc-bridge">' + bridge + '</p>' +
      '<button class="btn btn-ghost btn-block" data-nav="/stress" style="margin-top:14px">查看完整压力画像</button>' +
      '</div>';
  }

  // 桥接句：把「压力画像」与「恐惧模型此刻的状态」做诚实、非诊断的关联。
  // 不夸大因果，只点出它们同时指向的方向。
  function stressBridge(snap, der, focusLabel) {
    var parts = [];
    parts.push('你的压力最先从「' + snap.chanName + '」这一通道发出信号——' +
      '它往往也是那道拦住你的声音最容易被听信的地方。');
    var heavy = (snap.main === 'H' || snap.main === 'O');
    if (heavy && der.certainty >= 0.55) {
      parts.push('而此刻它的确定性偏高（约 ' + Math.round(der.certainty * 100) + '%）：' +
        '负荷越重，那句话越像事实。这正是该慢一点、多反驳两句的时候。');
    } else if (heavy) {
      parts.push('你眼下的负荷不轻，但好消息是它此刻的确定性已经被你压得不高——继续反驳，它还会更轻。');
    } else {
      parts.push('你眼下的负荷尚在缓冲区内，它此刻的确定性也不算高，正适合拿它练练反驳。');
    }
    if (focusLabel) parts.push('它此刻最常提起的是「' + focusLabel + '」。');
    return parts.join('');
  }

  // ── 局部渲染 ────────────────────────────────────────
  // 气泡的「视觉重量」直接由模型当前的确定性驱动：
  // 确定性越高，字越重、影子越实；被反驳后，它会肉眼可见地退一步。
  function weightClass(certainty) {
    if (certainty >= 0.75) return 'w-solid';
    if (certainty >= 0.55) return 'w-firm';
    if (certainty >= 0.35) return 'w-soft';
    return 'w-faint';
  }

  function paintLog(root, opts) {
    opts = opts || {};
    var turns = MI.fear.turns();
    var log = root.querySelector('#chat-log');
    var der = MI.fear.derive();
    var wc = weightClass(der.certainty);

    // 对话区整体也带着确定性的标记，用于背景与边框的语言
    var panel = root.querySelector('.chat-panel');
    if (panel) {
      panel.dataset.weight = wc;
      panel.style.setProperty('--certainty', String(der.certainty.toFixed(3)));
    }

    if (!turns.length) {
      log.innerHTML = '<p class="chat-empty">它还没有开口。点下面的按钮，让它说出第一句。</p>';
      return;
    }

    log.innerHTML = turns.map(function (t, i) {
      if (t.role === 'you') {
        return '<div class="chat-turn you"><p>' + d.esc(t.text) + '</p></div>';
      }
      if (t.role === 'care') {
        return '<div class="chat-turn care">' +
          '<div class="chat-meta"><span>事务所</span></div>' +
          '<p>' + d.esc(t.text).replace(/\n/g, '<br>') + '</p></div>';
      }
      var arch = t.archetype && MI.fear.ARCHETYPES[t.archetype]
        ? MI.fear.ARCHETYPES[t.archetype].label
        : (t.archetype || '恐惧');
      var badge = t.engine === 'ai' ? '模型' : t.engine === 'distilled' ? '蒸馏' : '原型';
      // 这一句当时的确定性：反驳成功的句子会永久留在「更轻」的状态
      var turnWeight = t.rebutWeight != null ? weightClass(t.rebutWeight) : wc;
      return '<div class="chat-turn fear ' + turnWeight + (t.verdict === 'rebut' ? ' rebutted' : '') +
        (opts.freshIndex === i ? ' fresh' : '') + '">' +
        '<div class="chat-meta"><span>' + d.esc(arch) + '</span>' +
        '<span class="engine-badge">' + badge + '</span>' +
        '<span class="turn-weight" title="这句话当时的确定性">' +
        Math.round((t.rebutWeight != null ? t.rebutWeight : der.certainty) * 100) + '%</span></div>' +
        '<p>' + d.esc(t.text).replace(/\n/g, '<br>') + '</p>' +
        '<div class="seg compact" role="group" aria-label="对这句话的反应">' +
        MI.data.FEAR_VERDICTS.map(function (v) {
          return '<button data-verdict="' + v.key + '" data-turn="' + i + '" aria-pressed="' +
            (t.verdict === v.key) + '">' + d.esc(v.label) + '</button>';
        }).join('') +
        '</div></div>';
    }).join('');

    log.scrollTop = log.scrollHeight;

    // 新出现的那一轮，做一次入场
    if (opts.freshIndex != null) {
      var fresh = log.querySelector('.chat-turn.fresh');
      if (fresh) MI.motion.flash(fresh, 'in', 700);
    }
  }

  function paintReport(root) {
    var der = MI.fear.derive();
    var stats = MI.store.get().fear.stats;
    var c = MI.fear.corpus();

    var meters = root.querySelector('#meters');
    if (meters) {
      // 仪表值滚动 + 条宽过渡，让「它变弱了」这件事看得见
      meters.innerHTML =
        meter('确定性', der.certainty) +
        meter('压迫感', der.pressure) +
        '<div class="meter-plain">击中 ' + stats.hit + ' · 反驳 ' + stats.rebut + ' · 回避 ' + stats.avoid + '</div>';
      d.$$('.meter', meters).forEach(function (m, i) {
        var val = i === 0 ? der.certainty : der.pressure;
        var fill = m.querySelector('.bar-fill');
        var out = m.querySelector('.meter-value');
        if (fill) fill.style.width = Math.round(val * 100) + '%';
        if (out) MI.motion.countUp(out, Math.round(val * 100), { suffix: '%', duration: 480 });
      });
    }

    root.querySelector('#corpus-list').innerHTML = [
      ['写下的念头', c.ideas + ' 个'],
      ['判断过的路线', c.feedbackRoutes.length + ' 条'],
      ['评价过的任务', c.feedbackTasks.length + ' 条'],
      ['完成过的天数', MI.fear.totalCompletedDays() + ' 天'],
      ['对话轮数', c.turns + ' 轮']
    ].map(function (row) {
      return '<div class="fact"><span class="fact-label">' + d.esc(row[0]) + '</span>' +
        '<span class="fact-value">' + d.esc(row[1]) + '</span><span style="width:14px"></span></div>';
    }).join('');

    var list = MI.fear.archetypes();
    var max = Math.max.apply(null, list.map(function (a) { return a.weight; }).concat([1]));
    var focusedKey = der.focus;
    root.querySelector('#archetype-list').innerHTML =
      '<div class="archetype-title">它手里的牌</div>' +
      list.slice().sort(function (a, b) { return b.weight - a.weight; }).map(function (a) {
        var focused = focusedKey === a.key;
        return '<div class="archetype' + (focused ? ' focused' : '') + '" data-arch="' + a.key + '">' +
          '<div class="archetype-head"><span>' + d.esc(a.label) + '</span>' +
          '<span class="archetype-weight">' + a.weight.toFixed(1) + '</span></div>' +
          '<div class="bar-track"><span class="bar-fill" style="width:' +
          Math.round(a.weight / max * 100) + '%;background:' + (focused ? 'var(--orange)' : '#c9cfbc') + '"></span></div>' +
          '<p class="archetype-evidence">依据：' + d.esc(a.evidence) + '</p>' +
          '</div>';
      }).join('');

    var dis = MI.store.get().fear.distilled;
    var actions = [];
    // 什么都没发生过的时候先说明「这份画像与此刻的你无关」，
    // 但不禁用任何按钮：读也可以读，只是它暂时还不是你。
    if (MI.journey.phase() === 'empty') {
      actions.push('<p class="hint" style="margin-top:12px">它现在拿到的是一份默认画像——' +
        '下面这些不是从你身上读出来的。写下一个念头之后，它才会开始像你。</p>');
    }
    if (dis) {
      actions.push('<div class="distill-note">已于 ' + d.esc(d.relativeDay(dis.at)) +
        ' 用模型重新蒸馏：' + d.esc(dis.summary || '（无摘要）') + '</div>');
    }
    if (MI.ai.isConfigured()) {
      actions.push('<button class="btn btn-ghost btn-block" id="distill-btn" style="margin-top:12px">' +
        (dis ? '再蒸馏一次' : '用模型重新蒸馏') + '</button>');
    } else {
      actions.push('<p class="hint" style="margin-top:12px">当前是本地蒸馏。' +
        '在设置里接入模型后，可以让它把这份画像说得更准。</p>');
    }
    root.querySelector('#distill-actions').innerHTML = actions.join('');
  }

  // 条宽由 CSS 过渡，数值由 motion 滚动，二者节奏一致
  function meter(label, value) {
    return '<div class="meter">' +
      '<div class="meter-head"><span>' + d.esc(label) + '</span>' +
      '<span class="meter-value">0%</span></div>' +
      '<div class="bar-track"><span class="bar-fill" style="width:0%"></span></div>' +
      '</div>';
  }

  function paintFearLog(root) {
    var log = MI.store.get().fear.model.log.slice().reverse();
    root.querySelector('#fear-log').innerHTML = log.length ? log.map(function (l) {
      return '<div class="evo-item">' +
        '<p class="evo-trigger">' + d.esc(l.trigger) + '</p>' +
        '<p class="evo-change">' + d.esc(l.change) + '</p>' +
        '<p class="evo-meta">REV ' + l.revision + ' &nbsp;·&nbsp; ' + d.esc(d.relativeDay(l.date)) + '</p>' +
        '</div>';
    }).join('') : '<p class="page-desc">还没有变化。你每表一次态，它都会重新算一遍自己站不站得住。</p>';
  }

  function paintAll(root, opts) {
    paintLog(root, opts);
    paintReport(root);
    paintFearLog(root);
    MI.app.syncCounts();
  }

  // ── 对话推进 ─────────────────────────────────────────
  function respond(root, userText) {
    if (thinking) return;
    thinking = true;
    var send = root.querySelector('#chat-send');
    send.disabled = true;
    send.textContent = '它在想…';

    // 打字指示：让「它在组织语言」这件事有视觉过程，而不是干等
    var log = root.querySelector('#chat-log');
    var typing = document.createElement('div');
    typing.className = 'chat-turn fear typing';
    typing.innerHTML = '<div class="chat-meta"><span>它正在组织语言</span></div>' +
      '<p class="typing-dots"><i></i><i></i><i></i></p>';
    log.appendChild(typing);
    log.scrollTop = log.scrollHeight;

    var finish = function (freshIndex) {
      thinking = false;
      send.disabled = false;
      send.textContent = '说回去';
      if (typing.parentNode) typing.parentNode.removeChild(typing);
      paintAll(root, { freshIndex: freshIndex });
    };

    var useLocal = function (note) {
      var reply = MI.fear.compose();
      MI.fear.addTurn('fear', reply.text, reply.archetype, reply.engine);
      if (note) d.toast(note, 4600);
      finish(MI.fear.turns().length - 1);
    };

    if (!MI.ai.isConfigured()) { useLocal(); return; }

    MI.ai.converse(userText, MI.fear.promptContext()).then(function (text) {
      MI.fear.addTurn('fear', text, MI.fear.derive().focus || 'who_are_you', 'ai');
      finish(MI.fear.turns().length - 1);
    }).catch(function (err) {
      useLocal('模型没能回答（' + err.message + '），已用它本地的声音继续。');
    });
  }

  function mount(root) {
    var input = root.querySelector('#chat-text');
    var count = root.querySelector('#chat-count');

    if (!MI.fear.turns().length) {
      var open = MI.fear.opening();
      if (open) MI.fear.addTurn('fear', open.text, open.archetype, open.engine);
    }
    paintAll(root);

    input.addEventListener('input', function () {
      count.textContent = input.value.length + ' / 400';
    });

    root.querySelector('#chat-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!text) {
        d.toast('哪怕只写一句，也算把它说回去了。');
        input.focus();
        return;
      }
      MI.fear.addTurn('you', text);
      input.value = '';
      count.textContent = '0 / 400';

      if (MI.fear.detectCrisis(text)) {
        MI.fear.addTurn('care', CARE_TEXT);
        paintAll(root, { freshIndex: MI.fear.turns().length - 1 });
        MI.app.announce('已给出关怀提示。');
        return;
      }
      paintLog(root, { freshIndex: MI.fear.turns().length - 1 });
      respond(root, text);
    });

    input.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        root.querySelector('#chat-form').requestSubmit();
      }
    });

    root.querySelector('#chat-log').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-verdict]');
      if (!btn) return;
      var idx = Number(btn.dataset.turn);
      var verdict = btn.dataset.verdict;
      var before = MI.fear.derive().certainty;

      // 记下这句话被反驳时的确定性，让「退一步」永久可见
      MI.store.update(function (s) {
        var t = s.fear.turns[idx];
        if (t && t.rebutWeight == null) t.rebutWeight = before;
      });
      MI.fear.rateTurn(idx, verdict);
      paintAll(root);

      // 气泡本身做出反应：反驳成功时它当场变轻
      var turnEl = d.$$('.chat-turn.fear', root.querySelector('#chat-log'))[idx];
      if (turnEl && verdict === 'rebut') {
        turnEl.classList.add('rebutted');
        MI.motion.flash(turnEl, 'rebut-flash', 1000);
      }

      // 回执：把确定性/压迫感的变化直接读出来
      MI.echo.engineReceipt(root, '#fear-receipt', MI.receipt.fearReceipt(verdict, idx));
      var after = MI.fear.derive().certainty;
      var delta = Math.round((after - before) * 100);
      MI.app.announce(delta < 0
        ? '它的确定性下降了 ' + Math.abs(delta) + ' 个百分点。'
        : delta > 0 ? '它的确定性上升了 ' + delta + ' 个百分点。' : '它的状态没有变化。');

      var map = {
        hit: '记下了。它会记住这句话对你有效。',
        rebut: delta < 0 ? '它退了一步：确定性 ' + Math.round(before * 100) + '% → ' + Math.round(after * 100) + '%。'
          : '记下了。它的确定性下降了。',
        avoid: '记下了。它会盯得更紧一点。'
      };
      d.toast(map[verdict] || '记下了。');
    });

    root.querySelector('#distill-actions').addEventListener('click', function (e) {
      if (!e.target.closest('#distill-btn')) return;
      var btn = root.querySelector('#distill-btn');
      btn.disabled = true;
      btn.textContent = '正在蒸馏…';
      var dctx = { corpus: MI.fear.corpus(), archetypes: MI.fear.archetypes(), focus: MI.fear.derive().focus };
      var dSnap = (MI.stress && MI.stress.snapshot) ? MI.stress.snapshot() : null;
      if (dSnap) dctx.stress = { cpsi: dSnap.cpsi, level: dSnap.level, chan: dSnap.chan };
      MI.ai.distill(dctx)
        .then(function (result) {
          var lines = result && result.lines ? result.lines.length : 0;
          MI.store.update(function (s) { s.fear.distilled = result; });
          paintAll(root);
          d.toast('重新蒸馏完成。接下来的对话会用上新句子。');
          MI.echo.push({
            kind: 'fear', surface: 'ledger',
            title: '重新蒸馏了一次。',
            detail: lines
              ? '它换上了 ' + lines + ' 句从你的记录里长出来的话。'
              : '它换了一套说法，来源仍是你写下的记录。'
          });
        })
        .catch(function (err) {
          paintAll(root);
          d.toast('蒸馏失败：' + err.message, 5000);
        });
    });

    var resetBtn = root.querySelector('#reset-fear');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        MI.fear.reset();
        MI.session.clear();
        MI.router.render();
        // 重置后确定性回到初始值，旧回执也不再成立
        MI.receipt.clear(root, '#fear-receipt');
        d.toast('这段对话已重置，它会从你的记录重新长出来。');
        MI.echo.push({
          kind: 'fear', surface: 'ledger',
          title: '重置了这段对话。',
          detail: '确定性与压力回到初始值，之前攒下的原型也一起清掉了。'
        });
      });
    }

    // 入场：报告面板自上而下铺开，暗示「它由这些构成」
    MI.motion.inView(d.$$('.meter, .fact, .archetype', root), { step: 26, cap: 340 });
  }

  MI.views.fear = {
    title: '恐惧模型',
    render: render,
    mount: mount
  };
})(window.MI);
