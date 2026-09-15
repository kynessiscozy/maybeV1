window.MI = window.MI || {};
(function (MI) {
  'use strict';

  var d = MI.dom;

  /* ────────────────────────────────────────────────────────────
     恐惧模型
     它不是通用毒舌机器人。它只由你在本站留下的痕迹蒸馏而成：
     写过的念头、判断过不像你的路线、说过太难的任务、从没走完的七天。
     因此它的每一句话，都能追溯到一条真实数据。
     它唯一的进化方向是「越辩越弱」：被认真反驳，确定性就下降。
     ──────────────────────────────────────────────────────────── */

  var ARCHETYPES = {
    not_enough: {
      label: '你还没资格',
      lines: [
        '你写下了 {ideas} 个念头，一个都没有真的开始。这不是准备，这是躲。',
        '「{idea}」——你写下来的时候很像那么回事。然后呢？',
        '你收集可能性，像别人收集明信片。好看，但哪儿也没去。'
      ]
    },
    too_late: {
      label: '已经来不及了',
      lines: [
        '你现在才开始。别人在这个年纪早就做完了。',
        '你把每天的时间定成 {time} 分钟。你心里清楚，这点时间什么都做不成。',
        '时间不是省出来的，是过去了的。'
      ]
    },
    not_good_enough: {
      label: '做不好就别做',
      lines: [
        '你说过「{hardTask}」太难。那还做什么呢？',
        '你会做出一个很普通的东西，然后不好意思拿出手。',
        '与其做得难看，不如一直不开始。你一直是这么选的。'
      ]
    },
    no_one_cares: {
      label: '没人在意',
      lines: [
        '就算你做出来了，也没有人会看。',
        '你自己判断过「{unlikeRoute}」不像你。连你都不信，凭什么要别人信。',
        '没有读者、没有观众、没有回声。你确定要一个人做下去？'
      ]
    },
    you_will_quit: {
      label: '你会半途而废',
      lines: [
        '七天计划你走完过 {doneCount} 次。数字不会说谎。',
        '你会在第三天停下来，然后假装忘了这件事。',
        '你熟悉「重新开始」这个动作，因为那是你唯一练熟的。'
      ]
    },
    who_are_you: {
      label: '你凭什么',
      lines: [
        '你凭什么觉得这次会不一样？',
        '你没有任何证据能证明你做得到。一条都没有。',
        '你不是那种会把它做完的人。你自己也知道。'
      ]
    }
  };

  var CRISIS_WORDS = ['自杀', '不想活', '活不下去', '结束生命', '伤害自己', '自残', '死了算了', '没有意义活着'];

  function state() { return MI.store.get(); }
  function model() { return state().fear.model; }
  function turns() { return state().fear.turns; }

  // ── 蒸馏：从真实痕迹里提取素材 ────────────────────────
  function corpus() {
    var s = state();
    return {
      ideas: s.observed.totalIdeas,
      history: s.observed.history,
      saved: s.saved.length,
      feedbackRoutes: s.feedback.routes,
      feedbackTasks: s.feedback.tasks,
      turns: s.fear.turns.length,
      themes: MI.memory.themeRanking()
    };
  }

  function totalCompletedDays() {
    var s = state();
    var fromSession = s.session.done.reduce(function (n, list) { return n + list.length; }, 0);
    var fromSaved = s.saved.reduce(function (n, item) {
      var list = item.done && item.done[item.route] ? item.done[item.route] : [];
      return n + list.length;
    }, 0);
    return Math.max(fromSession, fromSaved);
  }

  // 每个原型都带一条「证据」：它为什么有资格说这句话
  function archetypes() {
    var c = corpus();
    var s = state();
    var list = [];
    var topTheme = c.themes.length ? c.themes[0].label : null;

    list.push({
      key: 'not_enough',
      label: ARCHETYPES.not_enough.label,
      weight: c.ideas >= 2 && c.saved === 0 ? 3 : c.ideas >= 1 ? 1.5 : 0.5,
      evidence: c.ideas
        ? '你写下了 ' + c.ideas + ' 个念头，收藏了 ' + c.saved + ' 份'
        : '你还没有写下任何念头'
    });

    list.push({
      key: 'too_late',
      label: ARCHETYPES.too_late.label,
      weight: s.session.time <= 45 ? 2 : 1,
      evidence: '你把每天的时间设成 ' + s.session.time + ' 分钟'
    });

    var hardCount = c.feedbackTasks.filter(function (f) { return f.level === 'hard'; }).length;
    list.push({
      key: 'not_good_enough',
      label: ARCHETYPES.not_good_enough.label,
      weight: hardCount ? 2 + hardCount : 0.8,
      evidence: hardCount ? '你有 ' + hardCount + ' 次说任务太难' : '你还没有评价过任务难度'
    });

    var unlike = c.feedbackRoutes.filter(function (f) { return f.verdict === 'unlike'; });
    list.push({
      key: 'no_one_cares',
      label: ARCHETYPES.no_one_cares.label,
      weight: unlike.length ? 2 + unlike.length : 0.8,
      evidence: unlike.length
        ? '你在 ' + unlike.length + ' 个念头下判断某条路不像你'
        : (topTheme ? '你最常写的是「' + topTheme + '」，那通常是一个人做的事' : '你还没有给出过路线判断')
    });

    var done = totalCompletedDays();
    list.push({
      key: 'you_will_quit',
      label: ARCHETYPES.you_will_quit.label,
      weight: c.ideas >= 1 && done < 7 ? 2.5 : 0.6,
      evidence: c.ideas
        ? '你累计完成过 ' + done + ' 天，七天计划一次都没走完'
        : '你还没有开始过任何一个七天计划'
    });

    list.push({
      key: 'who_are_you',
      label: ARCHETYPES.who_are_you.label,
      weight: 1,
      evidence: '这是它不需要证据就能说的一句话'
    });

    return list;
  }

  // ── 状态：确定性、压迫感、焦点 ────────────────────────
  function derive() {
    var s = state().fear.stats;
    var m = model();
    var certainty = d.clamp(0.55 + s.hit * 0.14 - s.rebut * 0.22, 0.08, 0.95);
    var pressure = d.clamp(0.45 + s.avoid * 0.16 - s.rebut * 0.11, 0.1, 1);
    var focus = m.focus;
    return { certainty: certainty, pressure: pressure, focus: focus };
  }

  function recompute() {
    MI.store.update(function (s) {
      var stats = s.fear.stats;
      var before = {
        certainty: s.fear.model.certainty,
        pressure: s.fear.model.pressure,
        focus: s.fear.model.focus
      };
      var certainty = d.clamp(0.55 + stats.hit * 0.14 - stats.rebut * 0.22, 0.08, 0.95);
      var pressure = d.clamp(0.45 + stats.avoid * 0.16 - stats.rebut * 0.11, 0.1, 1);

      // 焦点：被判断「击中我了」最多的原型
      var tally = {};
      s.fear.turns.forEach(function (t) {
        if (t.role === 'fear' && t.verdict === 'hit' && t.archetype) {
          tally[t.archetype] = (tally[t.archetype] || 0) + 1;
        }
      });
      var focus = null;
      var best = 0;
      Object.keys(tally).forEach(function (k) {
        if (tally[k] > best) { best = tally[k]; focus = k; }
      });

      s.fear.model.certainty = certainty;
      s.fear.model.pressure = pressure;
      s.fear.model.focus = focus;

      var changed = Math.abs(before.certainty - certainty) > 0.001 ||
        Math.abs(before.pressure - pressure) > 0.001 ||
        before.focus !== focus;

      if (changed) {
        s.fear.model.revision += 1;
        var changes = [];
        if (Math.abs(before.certainty - certainty) > 0.001) {
          changes.push((certainty < before.certainty ? '确定性下降' : '确定性上升') +
            '至 ' + Math.round(certainty * 100) + '%');
        }
        if (Math.abs(before.pressure - pressure) > 0.001) {
          changes.push((pressure < before.pressure ? '压迫感减弱' : '压迫感增强') +
            '至 ' + Math.round(pressure * 100) + '%');
        }
        if (before.focus !== focus && focus) {
          changes.push('开始反复提起「' + (ARCHETYPES[focus] ? ARCHETYPES[focus].label : focus) + '」');
        }
        s.fear.model.log.push({
          date: new Date().toISOString(),
          revision: s.fear.model.revision,
          trigger: '对话统计：击中 ' + stats.hit + ' 次、被反驳 ' + stats.rebut + ' 次、回避 ' + stats.avoid + ' 次',
          change: changes.join('；')
        });
      }
    });
  }

  // ── 组装一句话 ────────────────────────────────────────
  function fillSlots(text) {
    var s = state();
    var c = corpus();
    var hard = c.feedbackTasks.filter(function (f) { return f.level === 'hard'; });
    var unlike = c.feedbackRoutes.filter(function (f) { return f.verdict === 'unlike'; });
    var lastIdea = c.history.length ? c.history[c.history.length - 1].idea : '那件事';

    return text
      .replace(/\{ideas\}/g, String(c.ideas || 1))
      .replace(/\{idea\}/g, d.truncate(lastIdea, 22))
      .replace(/\{time\}/g, String(s.session.time))
      .replace(/\{doneCount\}/g, String(totalCompletedDays()))
      .replace(/\{hardTask\}/g, hard.length ? '第 ' + (hard[hard.length - 1].day + 1) + ' 天的任务' : '那个任务')
      .replace(/\{unlikeRoute\}/g, unlike.length ? MI.data.ROUTE_NAMES[unlike[unlike.length - 1].route] : '那条路');
  }

  function pickArchetype() {
    var list = archetypes();
    var focus = model().focus;
    var weighted = list.map(function (a) {
      var w = a.weight;
      if (focus && a.key === focus) w += 2;
      return { key: a.key, w: Math.max(0.1, w) };
    });
    var total = weighted.reduce(function (n, a) { return n + a.w; }, 0);
    // 用对话轮数做偏移，保证同一原型不会连续重复
    var seed = (turns().length * 0.618) % 1;
    var point = seed * total;
    var acc = 0;
    for (var i = 0; i < weighted.length; i++) {
      acc += weighted[i].w;
      if (point <= acc) return weighted[i].key;
    }
    return weighted[weighted.length - 1].key;
  }

  function lineFor(key) {
    var set = ARCHETYPES[key];
    if (!set) return '';
    var idx = turns().filter(function (t) { return t.role === 'fear'; }).length % set.lines.length;
    return fillSlots(set.lines[idx]);
  }

  // 确定性越低，结尾越站不住
  function tail() {
    var c = derive().certainty;
    if (c < 0.2) return '……我说不动了。这句话，你拿去吧。';
    if (c < 0.4) return '……不过，我也不确定这句还站得住。';
    if (c < 0.6) return '……你可以反驳我。';
    return '';
  }

  // 模型蒸馏出来的句子：每条只登场一次，用完就回到本地原型
  function distilledLine() {
    var dis = state().fear.distilled;
    if (!dis || !Array.isArray(dis.lines) || !dis.lines.length) return null;
    var used = turns().filter(function (t) { return t.role === 'fear'; }).length;
    if (used >= dis.lines.length) return null;
    var line = dis.lines[used];
    return { text: line.text, archetype: line.archetype, engine: 'distilled' };
  }

  function compose() {
    var dl = distilledLine();
    var t = tail();
    if (dl) {
      return { text: dl.text + (t ? '\n\n' + t : ''), archetype: dl.archetype, engine: 'distilled' };
    }
    var key = pickArchetype();
    var text = lineFor(key);
    return {
      text: text + (t ? '\n\n' + t : ''),
      archetype: key,
      engine: 'local'
    };
  }

  function opening() {
    if (turns().length) return null;
    var dl = distilledLine();
    if (dl) {
      return {
        text: dl.text + '\n\n我是从你留在这里的东西长出来的。' +
          '你可以试着反驳我。',
        archetype: dl.archetype,
        engine: 'distilled'
      };
    }
    var list = archetypes().slice().sort(function (a, b) { return b.weight - a.weight; });
    var top = list[0];
    var text = fillSlots(ARCHETYPES[top.key].lines[0]);
    return {
      text: text + '\n\n我是从你留在这里的东西长出来的。' +
        '你写下的 ' + corpus().ideas + ' 个念头、你判断过的路线、你说过太难的任务，就是我的全部素材。\n' +
        '你可以试着反驳我。',
      archetype: top.key,
      engine: 'local'
    };
  }

  // ── 对话 ─────────────────────────────────────────────
  function addTurn(role, text, archetype, engine) {
    MI.store.update(function (s) {
      s.fear.turns.push({
        role: role,
        text: String(text).slice(0, 1200),
        archetype: archetype || null,
        engine: engine || null,
        verdict: null,
        at: new Date().toISOString()
      });
      // 只保留最近 60 轮，避免无限增长
      if (s.fear.turns.length > 60) s.fear.turns = s.fear.turns.slice(-60);
    });
  }

  function rateTurn(index, verdict) {
    MI.store.update(function (s) {
      var t = s.fear.turns[index];
      if (!t) return;
      var previous = t.verdict;
      if (previous) s.fear.stats[previous] = Math.max(0, s.fear.stats[previous] - 1);
      t.verdict = verdict;
      s.fear.stats[verdict] = (s.fear.stats[verdict] || 0) + 1;
    });
    recompute();
  }

  function reset() {
    MI.store.update(function (s) {
      s.fear.turns = [];
      s.fear.stats = { hit: 0, rebut: 0, avoid: 0 };
      s.fear.model = { pressure: 0.45, certainty: 0.55, focus: null, log: [], revision: 1 };
    });
  }

  function detectCrisis(text) {
    var t = String(text);
    return CRISIS_WORDS.some(function (w) { return t.indexOf(w) > -1; });
  }

  // 给模型的提示词上下文：把蒸馏结果摊开
  function promptContext() {
    var c = corpus();
    var der = derive();
    var ctx = {
      corpus: c,
      archetypes: archetypes(),
      certainty: der.certainty,
      pressure: der.pressure,
      focus: der.focus,
      history: turns().slice(-8).map(function (t) {
        return (t.role === 'fear' ? '恐惧' : '用户') + '：' + t.text;
      })
    };
    // 把压力画像结果一起喂给模型：让恐惧模型说话时也带着用户「此刻」的负荷底色。
    var st = MI.store.get().stress;
    if (st && st.last) {
      ctx.stress = {
        at: st.last.at,
        cpsi: st.last.cpsi,
        level: st.last.level,
        main: st.last.main,
        chan: st.last.chan,
        type: st.last.type
      };
    }
    return ctx;
  }

  // ── 收尾的话：七天走完时，它基于此刻的状态说话 ──
  // 本地规则生成，每一句仍可追溯到数据（完成次数、确定性、压力底色），
  // 不依赖模型接口；负荷偏高时主动收着说，不把这一天的话说重。
  function closingLine(times) {
    var der = derive();
    var snap = (MI.stress && MI.stress.snapshot) ? MI.stress.snapshot() : null;
    var heavy = snap && snap.levelIndex >= 4;
    var first = times <= 1;
    var line;
    if (first && der.certainty < 0.55) {
      line = '七天前它还说这种事你坚持不了。现在证据没变，是它的结论先撑不住了。';
    } else if (first) {
      line = '它还在。但它也第一次亲眼看到：你真的会把说过的事做完。这两件事它得重新放在一起算。';
    } else if (der.certainty < 0.55) {
      line = '第 ' + times + ' 次了。它给「你不会开始」找的那些证据，正在一条一条过期。';
    } else {
      line = '第 ' + times + ' 次了，它还不肯退。可它记得的每一次「没开始」，现在都得和这 ' + times + ' 次「走完了」摆在一起算。';
    }
    if (heavy) {
      line += '何况你是在背着不轻的负荷走完的——下次它再说你不行，你会记得它没看见全部。';
    }
    return line;
  }

  MI.fear = {
    ARCHETYPES: ARCHETYPES,
    corpus: corpus,
    archetypes: archetypes,
    derive: derive,
    recompute: recompute,
    compose: compose,
    opening: opening,
    addTurn: addTurn,
    rateTurn: rateTurn,
    reset: reset,
    detectCrisis: detectCrisis,
    promptContext: promptContext,
    totalCompletedDays: totalCompletedDays,
    closingLine: closingLine,
    turns: turns
  };
})(window.MI);
