window.MI = window.MI || {};
(function (MI) {
  'use strict';
  MI.views = MI.views || {};

  var d = MI.dom;

  MI.views.landing = {
    title: '入口',

    render: function () {
      var last = MI.memory.lastIdea();
      var def = MI.memory.preferredDefaults();
      var s = MI.store.get();
      var engine = MI.ai.isConfigured() ? '模型 + 本地规则' : '本地规则引擎';

      // 每一项都通向它对应的那一页，让首页不只是说明牌，也是入口
      var s2 = MI.store.get();
      var meta = [
        ['数据去向', '只留在本浏览器', '/archive'],
        ['当前引擎', engine, '/settings'],
        ['已存档案', s.saved.length + ' 份', '/archive'],
        ['写下的念头', s2.observed.totalIdeas + ' 个', '/archive']
      ].map(function (row) {
        return '<div data-nav="' + row[2] + '" role="link" tabindex="0">' +
          '<span>' + d.esc(row[0]) + '</span><strong>' + d.esc(row[1]) + '</strong></div>';
      }).join('');

      // 回来了，和第一次来，不该听到同一句话。
      var phase = MI.journey.phase();
      var days = MI.journey.daysSince();
      var returnNote = '';

      if (phase === 'returned' && last) {
        // daysSince 理论上有值（returned 要求 lastSeenAt 存在），兜一下是防御性的
        var away = (days === null || days === undefined) ? null : days;
        // 底色纵向对照：有过 ≥2 次压力画像时，告诉用户这段时间负荷的变化方向。
        // 只报方向不报诊断——它记得的是坐标，不是结论。
        var stressDelta = '';
        var hist = (s.stress && s.stress.history) ? s.stress.history : [];
        if (hist.length >= 2) {
          var dCpsi = hist[0].cpsi - hist[1].cpsi;
          if (dCpsi > 0) stressDelta = '这段时间你的负荷升高了 ' + dCpsi + ' 分，别急着赶进度。';
          else if (dCpsi < 0) stressDelta = '这段时间你的负荷降了 ' + (-dCpsi) + ' 分，是个好的开始。';
          else stressDelta = '这段时间你的负荷没有变化。';
        }
        returnNote =
          '<button class="return-note" data-nav="/lab" type="button">' +
          '<span>WELCOME BACK &nbsp;·&nbsp; ' +
          (away ? '你已经 ' + away + ' 天没来了' : '你有一阵子没来了') + '</span>' +
          '<p>上次你在想：' + d.esc(d.truncate(last.idea, 34)) + '。<br>' +
          '这条路停在原地，但没有过期。' +
          (def.time ? '你习惯每天借出 ' + def.time + ' 分钟，今天也一样。' : '') +
          (stressDelta ? '<br>' + d.esc(stressDelta) : '') +
          '</p></button>';
      } else if (phase === 'completed' || phase === 'archived') {
        returnNote =
          '<button class="return-note" data-nav="/archive" type="button">' +
          '<span>YOU FINISHED ONE &nbsp;·&nbsp; 有一版你已经被存下来</span>' +
          '<p>档案柜里有 ' + s.saved.length + ' 份。' +
          '那不是一次成功记录，是一个你可以随时取回来对照的版本。</p></button>';
      } else if (last) {
        returnNote =
          '<button class="return-note" data-nav="/lab" type="button">' +
          '<span>WELCOME BACK &nbsp;·&nbsp; 继续上次的念头 ↗</span>' +
          '<p>上次你在想：' + d.esc(d.truncate(last.idea, 34)) + '<br>' +
          '来自 ' + d.esc(d.relativeDay(last.date)) + '。' +
          (def.time ? '你习惯每天借出 ' + def.time + ' 分钟。' : '') +
          '</p></button>';
      }

      return '' +
        '<section class="landing">' +
        '<div class="landing-inner">' +
        '<div>' +
        '<div class="eyebrow">EST. IN THE NOT-YET &nbsp;/&nbsp; 为尚未发生的你而设</div>' +
        '<h1>在另一种可能里，<br>你会<em>成为谁？</em></h1>' +
        '<p class="landing-lede">' +
        '收留一个不合时宜的念头，让它长出几条不同的路。<br>' +
        '不必改变一生。先借给自己七天。' +
        '</p>' +
        '<div class="landing-actions">' +
        '<button class="btn btn-primary" data-nav="/lab">进入自由实验' +
        '<svg viewBox="0 0 20 20" fill="none"><path d="M3 10h13m-5-5 5 5-5 5" stroke="currentColor" stroke-width="1.5"/></svg>' +
        '</button>' +
        '<button class="text-btn" data-nav="/archive">它记得我什么？</button>' +
        '<button class="text-btn" data-nav="/about">应用介绍</button>' +
        '</div>' +
        '</div>' +
        '<aside class="landing-aside">' +
        '<p class="landing-quote">未来不是一道单选题。<br>而你，还没有定稿。</p>' +
        '<div class="landing-meta">' + meta + '</div>' +
        returnNote +
        '</aside>' +
        '</div>' +
        // 四个去处靠「编号 + 名称 + 一句说明 + 箭头」的纯排版卡片区分。
        // 编号给了它们次序感，次序即叙事：想做什么 → 什么拦着 → 此刻背着多少 → 存下来。
        '<div class="landing-gallery">' +
        '<div class="gallery-row">' +
        '<button class="gallery-card" data-nav="/lab" type="button">' +
        '<span class="gallery-no">01</span>' +
        '<strong>自由实验</strong><span class="gallery-sub">种下一个念头，它会展开成三条路</span>' +
        '<span class="gallery-go" aria-hidden="true">→</span></button>' +
        '<button class="gallery-card" data-nav="/fear" type="button">' +
        '<span class="gallery-no">02</span>' +
        '<strong>恐惧模型</strong><span class="gallery-sub">看清拦住你的那个声音</span>' +
        '<span class="gallery-go" aria-hidden="true">→</span></button>' +
        '<button class="gallery-card" data-nav="/stress" type="button">' +
        '<span class="gallery-no">03</span>' +
        '<strong>压力画像</strong><span class="gallery-sub">十分钟，看清你此刻背着多少</span>' +
        '<span class="gallery-go" aria-hidden="true">→</span></button>' +
        '<button class="gallery-card" data-nav="/archive" type="button">' +
        '<span class="gallery-no">04</span>' +
        '<strong>档案记忆</strong><span class="gallery-sub">留存的版本与它学到的你</span>' +
        '<span class="gallery-go" aria-hidden="true">→</span></button>' +
        '</div></div>' +
        '</section>';
    }
  };
})(window.MI);
