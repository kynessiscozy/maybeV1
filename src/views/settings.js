window.MI = window.MI || {};
(function (MI) {
  'use strict';
  MI.views = MI.views || {};

  var d = MI.dom;

  function render() {
    var ai = MI.ai.config();
    var lastTest = ai.lastTest;

    var testBox = '';
    if (lastTest) {
      testBox = lastTest.ok
        ? '<div class="test-result ok">连接成功，用时 ' + lastTest.latency + ' 毫秒。这个接口可以用了。</div>'
        : '<div class="test-result fail">上次测试失败：' + d.esc(lastTest.message || '未知原因') + '</div>';
    }

    return '' +
      '<section class="page">' +
      '<div class="page-head">' +
      '<div>' +
      '<div class="eyebrow">SETTINGS &nbsp;/&nbsp; 引擎与数据</div>' +
      '<h1 class="page-title">设置</h1>' +
      '<p class="page-desc">默认的本地规则引擎不需要任何配置。' +
      '如果你希望建议更贴身，可以接入一个兼容接口的模型，让它读到你在这里积累的记忆与反馈。</p>' +
      '</div>' +
      '</div>' +

      '<div class="settings-grid">' +
      '<div>' +
      '<div class="panel">' +
      '<div class="panel-head"><div><h2>模型接口</h2>' +
      '<p>可选。留空时一切由本地规则完成，功能不受影响。</p></div>' +
      '<span class="engine-badge' + (MI.ai.isConfigured() ? ' ai' : '') + '">' +
      (MI.ai.isConfigured() ? 'ENABLED' : 'OFF') + '</span></div>' +

      '<div class="switch-row">' +
      '<span><span class="switch-label">启用模型生成</span>' +
      '<span class="switch-hint">启用后，展开可能性时会先给出本地结果，再异步替换为模型版本。</span></span>' +
      '<button class="toggle" id="ai-toggle" role="switch" aria-checked="' + ai.enabled + '" aria-pressed="' + ai.enabled + '" aria-label="启用模型生成"></button>' +
      '</div>' +

      '<div class="form-row" style="margin-top:18px">' +
      '<label for="ai-endpoint">接口地址</label>' +
      '<input type="text" id="ai-endpoint" placeholder="https://api.openai.com/v1" value="' + d.esc(ai.endpoint) + '">' +
      '<p class="hint">兼容 OpenAI 的 chat completions 协议。可以只填到 <code>/v1</code>，会自动补全路径。</p>' +
      '</div>' +

      '<div class="form-row">' +
      '<label for="ai-model">模型名称</label>' +
      '<input type="text" id="ai-model" placeholder="gpt-4o-mini" value="' + d.esc(ai.model) + '">' +
      '<p class="hint">填服务商文档里给出的模型标识，例如 gpt-4o-mini、deepseek-chat、qwen-plus。</p>' +
      '</div>' +

      '<div class="form-row">' +
      '<label for="ai-key">API Key</label>' +
      '<div class="key-wrap">' +
      '<input type="password" id="ai-key" autocomplete="off" spellcheck="false" placeholder="sk-..." value="' + d.esc(ai.key) + '">' +
      '<button type="button" class="key-reveal" id="key-reveal">显示</button>' +
      '</div>' +
      '<p class="hint" id="key-hint">' +
      (ai.key ? '当前：' + d.esc(MI.ai.maskKey()) + '（明文保存在本浏览器）' : '只保存在这个浏览器的本地存储里，不会发给除你填写的接口以外的任何地方。') +
      '</p>' +
      '</div>' +

      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px">' +
      '<button class="btn btn-primary" id="ai-save">保存设置</button>' +
      '<button class="btn btn-ghost" id="ai-test">测试连接</button>' +
      '<button class="btn btn-ghost" id="ai-clear">清除密钥</button>' +
      '</div>' +
      testBox +

      // 五条数据流向原本全部铺开，收进折叠：默认只看得到一句「会发送什么」
      d.fold({
        cls: 'fold-inset',
        summary: '接入之前，请先知道这些',
        hint: '5 条真实数据流向',
        body: d.points([
          '<strong>你的念头会被发送出去。</strong>启用后，你写的念头、记忆摘要和最近的反馈会作为提示词发送到你填写的接口地址。不再启用时，这些内容不会离开浏览器。',
          '<strong>密钥是明文存储的。</strong>API key 以明文形式保存在浏览器的 localStorage 中，任何能打开这台电脑并使用这个浏览器的人都能读到。请不要在公用电脑上填写，并建议使用额度受限、可随时吊销的密钥。',
          '<strong>记忆会进入提示词。</strong>包括你的称呼、在意的事、主题偏好和难度反馈。如果你不希望某些内容被发送，可以先到「记忆」页删除它们。',
          '<strong>模型说的不算数。</strong>模型生成的路线同样不预测未来、不保证成功。返回内容会经过本地结构校验，不合格的部分会回退到本地模板。',
          '<strong>失败不会让你卡住。</strong>接口超时、报错或返回格式不对时，会自动保留本地规则的结果，并告诉你发生了什么。'
        ])
      }) +
      '</div>' +
      '</div>' +

      '<aside>' +
      // 侧栏三块参考资料合并为一条折叠组，默认收起
      d.fold({
        summary: '参考信息',
        hint: '引擎 · 键盘 · 隐私',
        cls: 'fold-aside',
        body:
          '<div class="fold-section">' +
          '<h3>当前引擎</h3>' +
          '<p>' + (MI.ai.isConfigured() ? '模型 + 本地规则' : '本地规则引擎') + '</p>' +
          d.points([
            '本地引擎用关键词匹配 5 类主题，再套用策划好的行动模板，按你选的时间参数化。',
            '它不联网、不调用模型、不做任何成功预测。',
            '自进化的调整由反馈驱动，规则与日志都在「记忆」页可查、可回滚。'
          ]) +
          '</div>' +
          '<div class="fold-section">' +
          '<h3>键盘</h3>' +
          d.points([
            '<code>Ctrl / ⌘ + Enter</code> 在实验室里直接展开',
            '<code>1 / 2 / 3</code> 在实验室里切换路线',
            '<code>方向键</code> 在地图上移动，<code>Enter</code> 读建议',
            '<code>?</code> 打开使用说明，<code>Esc</code> 关闭'
          ]) +
          '</div>' +
          '<div class="fold-section">' +
          '<h3>数据与隐私</h3>' +
          d.points([
            '念头、档案、记忆与反馈都存在本浏览器的 localStorage。',
            '更换浏览器或清理站点数据会导致内容丢失，重要内容请导出。',
            '无痕模式下无法保证持久保存。'
          ]) +
          '</div>'
      }) +
      '<button class="btn btn-ghost btn-block" data-nav="/archive" style="margin-top:18px">去档案记忆管理数据</button>' +
      '</aside>' +
      '</div>' +
      '</section>';
  }

  function mount(root) {
    var endpoint = root.querySelector('#ai-endpoint');
    var model = root.querySelector('#ai-model');
    var key = root.querySelector('#ai-key');

    function collect() {
      return {
        endpoint: endpoint.value.trim(),
        model: model.value.trim(),
        key: key.value.trim()
      };
    }

    root.querySelector('#ai-toggle').addEventListener('click', function () {
      var next = !MI.ai.config().enabled;
      var cfg = collect();
      if (next && (!cfg.endpoint || !cfg.model || !cfg.key)) {
        MI.ai.save(Object.assign(cfg, { enabled: true }));
        d.toast('已打开开关，但三项都填好之前不会真正调用。');
      } else {
        MI.ai.save(Object.assign(cfg, { enabled: next }));
        d.toast(next ? '已启用模型生成。' : '已关闭模型生成，回到本地规则。');
      }
      MI.router.render();
    });

    root.querySelector('#ai-save').addEventListener('click', function () {
      MI.ai.save(collect());
      MI.router.render();
      d.toast('设置已保存。');
    });

    root.querySelector('#ai-test').addEventListener('click', function () {
      var cfg = collect();
      if (!cfg.endpoint || !cfg.model || !cfg.key) {
        d.toast('三项都填好才能测试连接。');
        return;
      }
      MI.ai.save(cfg);
      var btn = root.querySelector('#ai-test');
      btn.disabled = true;
      btn.textContent = '正在测试…';
      MI.ai.test().then(function (res) {
        d.toast('连接成功，用时 ' + res.latency + ' 毫秒。');
      }).catch(function (err) {
        d.toast('测试失败：' + err.message, 5600);
      }).then(function () {
        MI.router.render();
      });
    });

    root.querySelector('#ai-clear').addEventListener('click', function () {
      MI.ai.save({ key: '', enabled: false });
      MI.router.render();
      d.toast('密钥已清除，回到本地规则引擎。');
    });

    root.querySelector('#key-reveal').addEventListener('click', function () {
      var btn = root.querySelector('#key-reveal');
      var showing = key.type === 'text';
      key.type = showing ? 'password' : 'text';
      btn.textContent = showing ? '显示' : '隐藏';
    });
  }

  MI.views.settings = {
    title: '设置',
    render: render,
    mount: mount
  };
})(window.MI);
