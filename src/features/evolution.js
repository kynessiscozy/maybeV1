window.MI = window.MI || {};
(function (MI) {
  'use strict';

  // 自进化 = 一组可解释的规则，不是机器学习。
  // 每次调整都会写进日志，说明「因为什么，改了什么」，并且可以回滚。

  var RULES = {
    taskWindow: 6,        // 只看最近多少次任务反馈
    hardThreshold: 2,     // 累计多少次「太难」就下调
    easyThreshold: 2,     // 累计多少次「太简单」就上调
    scaleDown: 0.7,
    scaleUp: 1.4,
    verdictThreshold: 2,  // 多少个不同念头都说「不太像」，才给这条路线降权
    rebutWindow: 6,       // 反驳战绩只看最近多少条已评价的对话
    rebutMin: 2,          // 至少评价过几次才谈得上「战绩」
    rebutRatio: 0.6,      // 成功反驳占比达到多少才算「多数」
    rebutBoost: 1.1,      // 反驳战绩好时，任务规模再上调的比例
    scaleCeiling: 1.5     // 规模上限：规则一与规则三叠加后也不得超过
  };

  function state() { return MI.store.get(); }

  function baseRoute(courage) {
    return courage < 34 ? 0 : courage < 75 ? 1 : 2;
  }

  // 依据反馈重算规则参数。只在数值真的变化时记录日志。
  function recompute() {
    MI.store.update(function (s) {
      var before = {
        scale: s.evolution.scale,
        bias: s.evolution.routeBias.join(',')
      };
      var changes = [];

      // ── 规则一：任务难度校准 ──
      var recent = s.feedback.tasks.slice(-RULES.taskWindow);
      var hard = recent.filter(function (t) { return t.level === 'hard'; }).length;
      var easy = recent.filter(function (t) { return t.level === 'easy'; }).length;
      var scale = 1;
      if (hard >= RULES.hardThreshold && hard > easy) {
        scale = RULES.scaleDown;
        changes.push({
          trigger: '最近 ' + recent.length + ' 次任务反馈里有 ' + hard + ' 次「太难」',
          change: '把任务规模下调到 ' + Math.round(scale * 100) + '%'
        });
      } else if (easy >= RULES.easyThreshold && easy > hard) {
        scale = RULES.scaleUp;
        changes.push({
          trigger: '最近 ' + recent.length + ' 次任务反馈里有 ' + easy + ' 次「太简单」',
          change: '把任务规模上调到 ' + Math.round(scale * 100) + '%'
        });
      }
      s.evolution.scale = scale;

      // ── 规则三：反驳战绩 ──
      // 恐惧模型对话里成功反驳占多数 → 它得承认你比它描述的更有力量，
      // 任务规模在规则一的基础上再上调一档。被击中居多时不惩罚——
      // 「太难」的反馈已经管着下调，这里不需要第二条鞭子。
      var judged = s.fear.turns.filter(function (t) { return t.verdict; }).slice(-RULES.rebutWindow);
      var rebuts = judged.filter(function (t) { return t.verdict === 'rebut'; }).length;
      if (judged.length >= RULES.rebutMin && rebuts / judged.length >= RULES.rebutRatio) {
        scale = Math.min(RULES.scaleCeiling, scale * RULES.rebutBoost);
        s.evolution.scale = scale;
        changes.push({
          trigger: '最近 ' + judged.length + ' 次对话里，你成功反驳了它 ' + rebuts + ' 次',
          change: '它承认你比它说的更有力量，任务规模再上调 ' + Math.round((RULES.rebutBoost - 1) * 100) + '%'
        });
      }

      // ── 规则二：路线偏好 ──
      var bias = [0, 0, 0];
      [0, 1, 2].forEach(function (r) {
        var list = s.feedback.routes.filter(function (f) { return f.route === r; });
        var unlike = list.filter(function (f) { return f.verdict === 'unlike'; }).length;
        var like = list.filter(function (f) { return f.verdict === 'like'; }).length;
        if (unlike >= RULES.verdictThreshold && unlike > like) {
          bias[r] = -1;
          changes.push({
            trigger: MI.data.ROUTE_NAMES[r] + ' 在 ' + unlike + ' 个不同念头里被判断「不太像我」',
            change: '不再默认推荐这条路线'
          });
        } else if (like >= RULES.verdictThreshold && like > unlike) {
          bias[r] = 1;
          changes.push({
            trigger: MI.data.ROUTE_NAMES[r] + ' 在 ' + like + ' 个不同念头里被判断「像我」',
            change: '在相近情况下优先推荐这条路线'
          });
        }
      });
      s.evolution.routeBias = bias;

      // ── 记录变化 ──
      var after = { scale: s.evolution.scale, bias: s.evolution.routeBias.join(',') };
      var changed = before.scale !== after.scale || before.bias !== after.bias;
      if (changed) {
        s.evolution.revision += 1;
        changes.forEach(function (c) {
          s.evolution.log.push({
            date: new Date().toISOString(),
            revision: s.evolution.revision,
            trigger: c.trigger,
            change: c.change
          });
        });
      }
    });
  }

  function scale() { return state().evolution.scale; }
  function bias() { return state().evolution.routeBias.slice(); }
  function revision() { return state().evolution.revision; }
  function log() { return state().evolution.log.slice().reverse(); }

  // 在胆量推出的基准路线上，叠加反馈带来的偏好
  function suggestedRoute(courage) {
    var base = baseRoute(courage);
    var b = bias();
    if (b[base] >= 0) return base;
    var neighbours = [base - 1, base + 1].filter(function (r) { return r >= 0 && r < 3; });
    for (var i = 0; i < neighbours.length; i++) {
      if (b[neighbours[i]] >= 0) return neighbours[i];
    }
    return base;
  }

  // 说明当前为什么选了这条路线（没有调整时返回 null）
  function routeReason(courage, chosen) {
    var base = baseRoute(courage);
    if (base === chosen) return null;
    return '你曾判断「' + MI.data.ROUTE_NAMES[base] + '」不太像你，所以先为你选了另一条。';
  }

  function reset() {
    MI.store.update(function (s) {
      s.evolution.scale = 1;
      s.evolution.routeBias = [0, 0, 0];
      s.evolution.log = [];
      s.evolution.revision = 1;
    });
  }

  MI.evolution = {
    RULES: RULES,
    recompute: recompute,
    scale: scale,
    bias: bias,
    revision: revision,
    log: log,
    baseRoute: baseRoute,
    suggestedRoute: suggestedRoute,
    routeReason: routeReason,
    reset: reset
  };
})(window.MI);
