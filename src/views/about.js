window.MI = window.MI || {};
(function (MI) {
  'use strict';
  MI.views = MI.views || {};

  var d = MI.dom;

  /* ────────────────────────────────────────────────────────────
     应用介绍
     这一页原本把 1630 字全部铺开，是信息密度最高的地方。
     现在改成：首屏只留一句话定位，其余章节收进折叠块，
     默认只展开「它是什么」，需要时再逐层展开。
     ──────────────────────────────────────────────────────────── */

  function render() {
    var s = MI.store.get();
    var fbCount = s.feedback.routes.length + s.feedback.tasks.length;
    var storageNote = MI.store.isStorageOK()
      ? '全部保存在本浏览器的 localStorage，不上传。'
      : '<strong>当前浏览器拒绝保存，刷新后会丢失，请立即导出。</strong>';

    return '' +
      '<section class="page about-page">' +
      '<div class="page-head">' +
      '<div>' +
      '<div class="eyebrow">APPLICATION BRIEF &nbsp;/&nbsp; v2 · 2026</div>' +
      '<h1 class="page-title">为尚未发生的你，<br>留一间工作室。</h1>' +
      '<p class="page-desc">一个本地优先的可能性工作台。收留一个念头，' +
      '让它长出几条路，再借你七天去轻轻试探。</p>' +
      '</div>' +
      '</div>' +

      '<div class="panel about-lede">' +
      '<p class="landing-quote">未来不是一道单选题。<br>而你，还没有定稿。</p>' +
      '</div>' +

      // ── 只默认展开这一段：定位 ──
      d.fold({
        summary: '它是什么',
        hint: '一句话定位与它做的三件事',
        open: true,
        body: d.points([
          '<strong>一句话。</strong>一个不替你做决定的可能性策划台：本地规则默认可用，记忆会留下，反馈会改口吻，进化公开可查；也可以接入自己的模型密钥。',
          '<strong>展开。</strong>把「如果我想……」拆成三条强度不同的路，每条三个推进节点。',
          '<strong>落地。</strong>把其中一条写成七天可执行的小步骤，规模与你能借出的时间匹配。',
          '<strong>记住并进化。</strong>保存判断与难度反馈，据此调整下次的推荐与任务规模。规则写死、日志可查、可以回滚。'
        ])
      }) +

      d.fold({
        summary: '它不是什么',
        hint: '这几条比「是什么」更重要',
        body: d.points([
          '<strong>不是算命，不是教练。</strong>没有成功概率、收入估计、命运暗示。不鸡血，不替你辞职。',
          '<strong>不替代专业意见。</strong>涉及食品、场地、经营、健康、法律、财务的事项，请咨询相应专业人士并确认合规要求。',
          '<strong>不鼓励贸然投入。</strong>所有路线都从可撤回的小动作开始。远期愿景不等于七天内实现。',
          '<strong>不替你下结论。</strong>它只提供选项和第一小步。选哪条、要不要继续，始终由你决定。'
        ])
      }) +

      d.fold({
        summary: '写给谁',
        body: d.points([
          '想试试独立杂志、周日咖啡角、一个小工具、重新学画画，又怕把人生押上去。',
          '如果你需要商业计划、融资模型或心理诊疗，请去找相应的专业支持。这里只处理「尚未发生」的那一层：想象、缩小、试探、留下证据。'
        ])
      }) +

      // ── 八个房间：从 8 条要点改成 4×2 紧凑网格 ──
      d.fold({
        summary: '八个房间',
        hint: '功能不摊在首页',
        body: '<div class="intro-rooms">' +
          room('01', '入口', '诗意的门厅。告诉你上次在想什么，然后送你进实验室。') +
          room('02', '可能性实验室', '种下念头，调胆量和时间，展开三条路。唯一的工作台。') +
          room('03', '路线详情', '七天清单、节点说明、像不像我、任务难不难。') +
          room('04', '恐惧模型', '用你的痕迹蒸馏出「拦住你的声音」。越辩越弱。') +
          room('05', '压力画像', '九十道题，把「压力」画成一张可看的图。不诊断，不评判。') +
          room('06', '档案记忆', '一边收藏某个版本的自己，一边记下它学到的你。双子标签，可删可导出。') +
          room('07', '设置', '默认完全本地。可填兼容接口的地址、模型与密钥。') +
          room('08', '应用介绍', '你现在读的这一页。') +
          '</div>'
      }) +

      d.fold({
        summary: '怎么用',
        hint: '三步，不必一次走完',
        body: d.points([
          '<strong>01 进实验室。</strong>写下你想试的事。调整胆量和时间，点展开，或按 Ctrl / ⌘ + Enter。',
          '<strong>02 选一条路。</strong>点节点看建议，进路线详情看七天安排。没有哪条更正确。',
          '<strong>03 留下一点。</strong>勾选会保存。觉得不像自己或太难，当场反馈。想留底就收藏或导出。'
        ]) +
          '<button class="btn btn-primary" data-nav="/lab" style="margin-top:16px">进入可能性实验室</button>'
      }) +

      d.fold({
        summary: '记忆与自进化',
        hint: '只有两条写死的规则',
        body: d.points([
          '它没有训练模型，也没有偷偷学习你的行为轨迹。只有三条写死的规则：',
          '累计两次以上「太难」→ 任务规模下调到 70%；两次以上「太简单」→ 上调到 140%。',
          '某条路线在两个不同念头下都被判断「不太像我」→ 不再被默认推荐。',
          '最近几次对话里你多数都成功反驳了它 → 任务规模再上调 10%。它得承认你比它说的更有力量。',
          '每次调整都写进记忆页的变更记录，说明原因，并且可以一键回滚。'
        ])
      }) +

      d.fold({
        summary: '恐惧模型',
        hint: '那间侧室',
        body: d.points([
          '它不是通用毒舌机器人。每一句话都来自你写过的念头、说过太难的任务、判断过不像你的路线。',
          '目的是让你看清那个拦住你的声音、反驳它，而不是相信它。认真反驳，它的确定性会下降。',
          '对话不是心理咨询、不是诊断。若感到难以承受，请告诉信任的人或寻求专业支持。'
        ]) +
          '<button class="btn btn-ghost btn-block" data-nav="/fear" style="margin-top:16px">去恐惧模型</button>'
      }) +

      d.fold({
        summary: '两个引擎',
        hint: '默认那个不需要配置',
        body: d.points([
          '<strong>本地规则引擎（默认）。</strong>关键词匹配五类主题，套用策划好的行动模板，按时间参数化。完全离线。',
          '<strong>模型接口（可选）。</strong>在设置里填地址、模型与密钥后，会把念头、记忆摘要与反馈作为提示词发出去。失败时自动回退本地结果。',
          '无论用哪个引擎，返回内容都会经过结构校验；不合格的部分回退到本地模板。'
        ])
      }) +

      d.fold({
        summary: '你的数据',
        hint: s.saved.length + ' 份档案 · ' + s.observed.totalIdeas + ' 个念头',
        body: d.points([
          '存有 ' + s.saved.length + ' 份档案、' + s.observed.totalIdeas + ' 个念头、' + fbCount + ' 条反馈。',
          storageNote,
          '更换浏览器或清理站点数据会导致内容丢失。无痕模式无法保证持久保存。',
          '你可以随时在档案记忆页逐条删除、清空、导出 JSON 备份或导入恢复。'
        ]) +
          '<button class="btn btn-ghost btn-block" data-nav="/archive" style="margin-top:16px">查看档案记忆</button>'
      }) +

      d.fold({
        summary: '诚实说明',
        hint: '内容仅供灵感参考',
        body: d.points([
          '不构成法律、医疗、财务或职业建议。模型若被接入，仍应被当作措辞助手，而不是权威。',
          '密钥以明文存在 localStorage。不要在公用电脑上填写；建议使用额度受限、可随时吊销的密钥。',
          '启用模型后，念头与记忆摘要会发往你指定的接口。关掉之后，这些内容不会再离开浏览器。',
          '页面底部的「回响」不是活动记录。它只记下真正改变了什么的事，最多 40 条，删了就删了。',
          '有一处例外：删除全部内容时它不会记这一笔。清空是让它闭嘴，不是又给它一次说话的机会。',
          '允许生活出现计划之外的分支——这是事务所唯一的主张。'
        ])
      }) +
      '</section>';
  }

  function room(n, title, text) {
    return '<article class="intro-room">' +
      '<div class="kicker">ROOM / ' + n + '</div>' +
      '<h3>' + title + '</h3>' +
      '<p>' + text + '</p>' +
      '</article>';
  }

  MI.views.about = {
    title: '应用介绍',
    render: render
  };
})(window.MI);
