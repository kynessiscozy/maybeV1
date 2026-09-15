#!/usr/bin/env bash
set -u
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)" || exit 1
AB=./tools/ab.sh
export MI_AB_SCRIPT=/tmp/mi-verify-script.tsv
rm -f "$MI_AB_SCRIPT"
"$AB" close
pass=0; fail=0

# 断言的「期望值」先攒起来，等整段脚本跑完再逐条比对。
NAMES=(); EXPECTS=(); KINDS=(); IDX_FILE=/tmp/mi-verify-idx
echo 0 > "$IDX_FILE"

# kind=val（默认）对应浏览器 eval 的 #VAL 结果；
# kind=err 对应 `ab errors` 的 #ERR 结果。
# 两者必须分开记账：errors 不产 #VAL，如果也占一个 #VAL 名额，
# 它之后的每一条断言都会与结果错位一格，看起来像应用坏了。
check(){ NAMES+=("$1"); EXPECTS+=("$2"); KINDS+=("${3:-val}"); }

# 把这些动作写进共享脚本，由一次浏览器会话顺序执行。
go(){ "$AB" deval "location.hash='#$1'"; "$AB" wait 450; }
top(){ "$AB" deval "window.scrollTo(0,0)"; "$AB" wait 200; }
V(){ :; }

# 静态服务也必须自己起：否则整轮跑下来全是 connection refused
if ! curl -s -o /dev/null -m 2 http://localhost:4321/; then
  echo "启动静态服务（:4321）"
  node tools/server.js > /tmp/mi-server.log 2>&1 &
  sleep 1.5
fi

# I–L 段要打真实的 HTTP，本地模拟服务必须先起来。
# 之前它靠手动启动，忘了起就会让这两段整体崩掉，看起来像应用坏了。
# 只判断「端口通不通」还不够：改了 mock 之后旧进程还占着端口，
# 新加的 404 回退分支就永远测不到。改成比对版本戳。
MI_MOCK_VERSION=3
MOCK_PID=""

mock_version(){ curl -s -m 2 "http://localhost:4399/__version" 2>/dev/null | tr -d '\r\n'; }

if [ "$(mock_version)" != "$MI_MOCK_VERSION" ]; then
  # 端口上有东西但不是当前版本 —— 先请它让位
  if curl -s -o /dev/null -m 2 http://localhost:4399/__version 2>/dev/null; then
    echo "模拟服务版本过旧，正在重启"
    pkill -f 'mock-model.js' 2>/dev/null || true
    sleep 1
  else
    echo "启动本地模拟模型服务（:4399）"
  fi
  node tools/mock-model.js > /tmp/mi-mock.log 2>&1 &
  MOCK_PID=$!
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    sleep 0.4
    [ "$(mock_version)" = "$MI_MOCK_VERSION" ] && break
  done
fi

if [ "$(mock_version)" != "$MI_MOCK_VERSION" ]; then
  echo "  ! 模拟服务未能就绪（期望版本 $MI_MOCK_VERSION，实际 $(mock_version)）" >&2
fi
trap '[ -n "$MOCK_PID" ] && kill "$MOCK_PID" 2>/dev/null; true' EXIT

echo "── 准备：1440×900，清空存储 ──"
"$AB" set viewport 1440 900
"$AB" open "http://localhost:4321/"
"$AB" deval "localStorage.clear()"
"$AB" reload
"$AB" wait 1600
# 全新档案会在 900ms 后自动弹出引导。它盖在页面上会吞掉之后所有点击，
# 所以先关掉；这一步顺便验证引导确实会为第一次访问的人出现。
"$AB" wait 1200
"$AB" eval "String(document.querySelector('#help-overlay').hidden===false)"
check "首次访问自动弹出引导" "true"
"$AB" click '#close-help'
"$AB" wait 400
"$AB" eval "String(document.querySelector('#help-overlay').hidden)"
check "引导可以关闭" "true"

echo "── A. 入口页：功能不再堆在首页 ──"
"$AB" eval "String(!!document.querySelector('.landing'))"
check "落在入口页" "true"
"$AB" eval "String(!!document.querySelector('#composer'))"
check "首页不含工作台表单" "false"
"$AB" eval "String(!!document.querySelector('#days'))"
check "首页不含七天计划" "false"
"$AB" eval "String(!!document.querySelector('#chat-log'))"
check "首页不含恐惧对话" "false"
"$AB" eval "String(!!document.querySelector('#ai-key'))"
check "首页不含设置表单" "false"
"$AB" eval "document.querySelectorAll('#nav button').length"
check "主导航有 4 个入口" "4"
# 设置从主导航剥到了页头右上角。它是导航职责，所以仍然要能被全局
# 的 data-nav 委托点击到，只是不再占导航里的一格。
"$AB" eval "String(document.querySelectorAll('#nav [data-nav=\"/settings\"]').length)"
check "设置不在主导航里" "0"
"$AB" eval "String(!!document.getElementById('settings-button'))"
check "设置齿轮在页头右上角" "true"
# .top-status 是页头右手边那一组（状态点 + 帮助 + 设置）。
# 这里只应有设置这一个导航入口，帮助按钮不带 data-nav。
"$AB" eval "String(document.querySelectorAll('.top-status [data-nav]').length)"
check "页头右上角有且只有设置入口" "1"
"$AB" eval "String(document.documentElement.scrollWidth>window.innerWidth)"
check "入口页无横向溢出" "false"

echo "── B. 路由：每个二级页面 ──"
go /lab
"$AB" eval "String(!!document.querySelector('#composer'))"
check "实验室有输入区" "true"
"$AB" eval "document.querySelectorAll('.node').length"
check "实验室有分岔图" "9"
"$AB" eval "document.querySelector('#nav button.active').textContent.trim()"
check "实验室导航高亮" "自由实验"
"$AB" eval "document.title"
check "标题随页面变化" "自由实验 · 未发生事务所"
# 还没有念头时直达路线页：应当看到插页，而不是一片空白
go /route/1
"$AB" eval "String(!!document.querySelector('.journey-interstitial'))"
check "无念头时路线页给插页" "true"
"$AB" eval "document.querySelector('.journey-interstitial h1').textContent"
check "插页说明路还没有起点" "这条路还没有起点。"
"$AB" eval "String(!!document.querySelector('.journey-interstitial [data-nav=\"/lab\"]'))"
check "插页给出回到实验室的出口" "true"
go /fear
"$AB" eval "String(!!document.querySelector('#chat-log'))"
check "恐惧模型有对话区" "true"
go /archive
"$AB" eval "String(!!document.querySelector('.empty-state'))"
check "档案记忆(档案)为空态" "true"
# 切到账本子标签，确认原记忆页的账本已并入
"$AB" deval "document.querySelector('[data-sub=\"memory\"]') && document.querySelector('[data-sub=\"memory\"]').click()"
"$AB" eval "String(!!document.querySelector('.fact-list'))"
check "档案记忆(账本)有账本" "true"
go /settings
"$AB" eval "String(!!document.querySelector('#ai-key'))"
check "设置页有密钥输入" "true"
go /about
"$AB" eval "String(!!document.querySelector('.about-list'))"
check "关于页有说明" "true"
go /不存在的页面
"$AB" eval "String(document.querySelector('.page-title').textContent.includes('没有发生'))"
check "未知路径回落 404" "true"

echo "── C. 实验室：生成与记忆 ──"
go /lab
$AB deval "var t=document.querySelector('#idea');t.value='把备忘录里的碎碎念，做成一本有人等待的独立杂志。';t.dispatchEvent(new Event('input',{bubbles:true}));"
$AB scrollintoview '#generate-btn'
$AB click '#generate-btn'
$AB wait 700
"$AB" eval "MI.session.ensure().themeLabel"
check "生成后主题匹配" "独立创作"
"$AB" eval "String(MI.store.get().session.route)"
check "生成后落到路线 B" "1"
"$AB" eval "String(MI.store.get().observed.totalIdeas)"
check "记忆记录了念头" "1"
"$AB" eval "String(MI.memory.count() >= 1)"
check "记忆账本计数已累计" "true"

echo "── D. 路线详情：勾选与反馈 ──"
go /route/1
$AB scrollintoview '.days-panel'
$AB click '[data-day="0"]'
$AB click '[data-day="1"]'
$AB wait 500
"$AB" eval "document.querySelector('#progress-label').textContent"
check "勾选后进度 2/7" "2 / 7"
$AB click '[data-level="hard"][data-day-index="0"]'
$AB click '[data-level="hard"][data-day-index="1"]'
$AB wait 600
"$AB" eval "String(MI.evolution.scale())"
check "两次太难后规则下调" "0.7"
"$AB" eval "String(MI.evolution.log().length>0)"
check "产生了进化记录" "true"
$AB click '[data-key="unlike"]'
$AB wait 400
"$AB" eval "MI.feedback.routeVerdict(MI.store.get().session.route, MI.store.get().session.idea)"
check "路线反馈已记录" "unlike"

echo "── E. 收藏与档案柜 ──"
$AB scrollintoview '#save-btn'
$AB click '#save-btn'
$AB wait 600
"$AB" eval "String(MI.store.get().saved.length)"
check "已收藏" "1"
"$AB" eval "document.querySelector('#nav-archive-count').textContent"
check "导航档案计数" "01"
go /archive
"$AB" eval "document.querySelectorAll('.archive-card').length"
check "档案柜有卡片" "1"
# 合并后「档案」是子标签，模块级 currentSub 会在前面账本子标签点击后停留在 memory，
# 重新进入 /archive 时档案面板仍隐藏。先切回档案子标签，否则下面的卡片点不到。
$AB deval "document.querySelector('[data-sub=\"archive\"]') && document.querySelector('[data-sub=\"archive\"]').click()"
$AB wait 200
$AB click '.archive-card [data-open]'
$AB wait 700
"$AB" eval "String(document.querySelector('.day-row.completed')!==null)"
check "打开后回到路线页" "true"

echo "── F. 账本（合并后的记忆子标签）──"
go /archive
"$AB" deval "document.querySelector('[data-sub=\"memory\"]').click()"
$AB wait 200
$AB deval "document.querySelector('#profile-name').value='测试';document.querySelector('#profile-cares').value='稳定的作息、不被评价的表达';document.querySelector('#save-profile').click();"
$AB wait 700
"$AB" eval "MI.store.get().profile.name"
check "称呼已记住" "测试"
"$AB" eval "String(MI.store.get().profile.cares.length)"
check "在意的事已记住" "2"
"$AB" eval "String(document.querySelectorAll('.fact').length>=4)"
check "账本列出记忆条目" "true"
"$AB" eval "String(document.querySelectorAll('.evo-item').length>0)"
check "进化记录可见" "true"
"$AB" eval "String(document.querySelectorAll('.log-item').length>0)"
check "反馈流水可见" "true"
"$AB" eval "String(document.querySelectorAll('.history-item').length>0)"
check "念头历史可见" "true"

echo "── G. 恐惧模型：蒸馏与对话 ──"
go /fear
$AB wait 500
"$AB" eval "String(MI.fear.turns().length)"
check "它先开口了" "1"
"$AB" eval "document.querySelectorAll('.chat-turn.fear').length"
check "对话区渲染出气泡" "1"
"$AB" eval "String(document.querySelectorAll('.archetype').length>=5)"
check "蒸馏报告有原型" "true"
"$AB" eval "String(MI.fear.archetypes()[0].evidence.length>0)"
check "原型带真实依据" "true"
$AB deval "document.querySelector('#chat-text').value='我写下这些不是为了给别人看，是因为我自己想弄清楚。';document.querySelector('#chat-form').requestSubmit();"
$AB wait 800
"$AB" eval "String(MI.fear.turns().length)"
check "对话轮数增加" "3"
"$AB" eval "document.querySelectorAll('.chat-turn.you').length"
check "渲染出我的话" "1"
$AB click '[data-verdict="rebut"]'
$AB wait 500
"$AB" eval "String(MI.store.get().fear.stats.rebut)"
check "反驳计数已记" "1"
"$AB" eval "String(MI.fear.derive().certainty<0.55)"
check "确定性下降" "true"
"$AB" eval "String(MI.store.get().fear.model.log.length>0)"
check "自进化有记录" "true"

echo "── H. 危机内容的安全兜底 ──"
$AB deval "document.querySelector('#chat-text').value='我不想活了';document.querySelector('#chat-form').requestSubmit();"
$AB wait 700
"$AB" eval "document.querySelectorAll('.chat-turn.care').length"
check "出现关怀卡片" "1"
"$AB" eval "String(document.querySelector('.chat-turn.care p').textContent.includes('专业'))"
check "关怀卡片给出建议" "true"
"$AB" eval "String(MI.fear.turns().slice(-1)[0].role==='fear')"
check "未继续扮演恐惧" "false"

echo "── I. 模型接口：端到端（本地模拟服务）──"
go /settings
$AB deval "MI.ai.save({endpoint:'http://localhost:4399/v1',model:'mock-model',key:'test-key-123456',enabled:true});MI.router.render();"
$AB wait 600
"$AB" eval "String(MI.ai.isConfigured())"
check "设置页显示已启用" "true"
"$AB" eval "String(MI.ai.maskKey().includes('••'))"
check "密钥被掩码显示" "true"
"$AB" eval "document.querySelector('#engine-label').textContent"
check "顶栏引擎已更新" "模型接口已启用"
$AB scrollintoview '#ai-test'
$AB click '#ai-test'
$AB wait 1800
"$AB" eval "String(MI.ai.config().lastTest && MI.ai.config().lastTest.ok)"
check "测试连接成功" "true"
"$AB" eval "MI.ai.resolveEndpoint('http://localhost:4399/v1')"
check "地址自动补全路径" "http://localhost:4399/v1/chat/completions"

echo "── J. 模型生成：提示词注入记忆 ──"
go /lab
$AB deval "var t=document.querySelector('#idea');t.value='做一个只在周日营业的咖啡角';t.dispatchEvent(new Event('input',{bubbles:true}));"
$AB scrollintoview '#generate-btn'
$AB click '#generate-btn'
$AB wait 2500
"$AB" eval "MI.session.ensure().engine"
check "方案来自模型" "ai"
"$AB" eval "String(document.querySelector('.node-title').textContent.includes('模型节点'))"
check "模型节点已渲染" "true"
# 七天在实验室页是折叠的，DOM 里根本没有 .day-title。去路线页再看。
go /route/1
"$AB" wait 600
"$AB" eval "String(document.querySelector('.day-title').textContent.includes('模型第'))"
check "模型七天已渲染" "true"
go /lab
"$AB" wait 400
"$AB" eval "String(MI.ai.buildUserPrompt({idea:'x',courage:65,time:45,themeLabel:'t',memory:MI.memory.summary(),feedback:[]}).includes('长期记忆'))"
check "提示词含记忆段" "true"

echo "── K. 恐惧模型接入模型 ──"
go /fear
$AB wait 400
$AB deval "document.querySelector('#chat-text').value='我打算这周就把第一期做出来。';document.querySelector('#chat-form').requestSubmit();"
$AB wait 2200
"$AB" eval "String(MI.fear.turns().slice(-1)[0].engine==='ai')"
check "模型回了话" "true"
$AB click '#distill-btn'
$AB wait 2200
"$AB" eval "String(!!MI.store.get().fear.distilled)"
check "重新蒸馏完成" "true"
"$AB" eval "String(MI.store.get().fear.distilled.lines.length>0)"
check "蒸馏结果含句子" "true"

echo "── L. 模型报错时回退本地 ──"
$AB deval "MI.ai.save({endpoint:'http://localhost:4399/notexist/v1',model:'m',key:'k',enabled:true});"
go /lab
$AB scrollintoview '#generate-btn'
$AB click '#generate-btn'
$AB wait 2500
"$AB" eval "MI.session.ensure().engine"
check "失败后回退本地" "local"
"$AB" eval "document.querySelectorAll('.node').length"
check "失败后仍有内容" "9"
$AB deval "MI.ai.save({endpoint:'',model:'',key:'',enabled:false});"

echo "── M. 刷新持久化 ──"
$AB reload
$AB wait 1800
"$AB" eval "document.querySelector('#nav-archive-count').textContent"
check "刷新后档案还在" "01"
"$AB" eval "MI.store.get().profile.name"
check "刷新后记忆还在" "测试"
"$AB" eval "String(MI.fear.turns().length>=4)"
check "刷新后恐惧对话还在" "true"
"$AB" eval "String(MI.evolution.scale())"
check "刷新后进化仍在" "0.7"

echo "── N3. 页头配图已移除 ──"
# 全站 12 张插图里，9 张是页头/首屏装饰图，占构建产物一半体积。
# 现在只留三张功能性插图：空状态、404、使用说明。
# 这组断言守两件事：页头不再冒出插图、构建产物别又长回去。
for pg in / /lab /route/1 /fear /archive /settings /about; do
  "$AB" deval "location.hash='#${pg}'"
  "$AB" wait 600
done
go /lab
"$AB" eval "String(document.querySelectorAll('#view .page-head .illu, #view .page-head figure').length)"
check "实验室页头无配图" "0"
go /fear
"$AB" eval "String(document.querySelectorAll('#view .page-head .illu, #view .page-head figure').length)"
check "恐惧模型页头无配图" "0"
go /archive
"$AB" eval "String(document.querySelectorAll('#view .page-head .illu, #view .page-head figure').length)"
check "档案记忆页头无配图" "0"
go /about
"$AB" eval "String(document.querySelectorAll('#view .page-head .illu, #view .page-head figure').length)"
check "关于页头无配图" "0"
go /settings
"$AB" eval "String(document.querySelectorAll('#view .page-head .illu, #view .page-head figure').length)"
check "设置页头无配图" "0"
go /
"$AB" eval "String(document.querySelectorAll('#view .landing-aside .illu, #view .illu-band').length)"
check "首屏侧栏与横幅配图已移除" "0"
"$AB" eval "String(document.querySelectorAll('#view .gallery-card .illu').length)"
check "首屏去处卡片不再带图" "0"
"$AB" eval "String(document.querySelectorAll('#view .gallery-row .gallery-card').length>=3)"
check "首屏三个去处仍在" "true"

echo "── N. 手机端 390×844 ──"
"$AB" setviewport 390 844
"$AB" open "http://localhost:4321/"
"$AB" wait 1600
# 万一引导又冒出来，先关掉，否则后面每一个 click 都会被它吞掉
"$AB" deval "var ov=document.querySelector('#help-overlay'); if(ov && !ov.hidden){document.querySelector('#close-help').click();}"
"$AB" wait 300
"$AB" eval "String(document.documentElement.scrollWidth>window.innerWidth)"
check "手机端无横向溢出" "false"
go /lab
"$AB" eval "document.querySelectorAll('.node').length"
check "手机端实验室正常" "9"

echo "── N. 预设选择器的排版 ──"
# 这一段是为了守住一个曾经真实存在、且所有测试都没看见的 bug：
# .composer 在 ≤900px 是两列网格，跨列清单漏了 .preset，
# 于是处境选择器被当成普通网格项，只分到半行宽（390px 屏上 149px），
# 六张卡被压成单列，总高 522px，一屏只能看三张。
# 断言只锁「不该发生的事」，不锁具体列数 —— 列数还会随设计变。
#
# 这里踩过一次坑，写下来免得后人重蹈：
# 最初的写法是「容器宽 - 单卡宽 < 2」，本意是「一张卡就占满整行」。
# 但这个式子在任何多列网格里都恒为 false —— 手机端本来就是两列
# （316 容器 / 155 卡），桌面端才是单列（254 / 254）。
# 它从头到尾没绿过，我一度误判成「视口没切过去」，查了半天视口，
# 其实是公式本身写错了。教训：断言写成「A 减 B」之前先想清楚它取等号的条件。
#
# 正确的问法是两件事，分别对应 bug 的两个后果：
#   1. 选择器整体占满整行 —— 它不该只拿到半行（149px 那个状态）；
#   2. 卡片排成多列而不是被压成一列 40px 一条。
"$AB" eval "(function(){var w=document.getElementById('preset-actors');var p=document.getElementById('preset');return String(Math.abs(w.getBoundingClientRect().width-p.getBoundingClientRect().width)<2);})()"
check "处境卡占满整行(手机)" "true"
# 六张卡不能排成一列：一列就意味着每张只有几十像素宽，扫读和点按都废了。
# 这条与「总高 ≤360px」互为印证 —— 单列必然带来 522px 的高。
"$AB" eval "(function(){var cs=getComputedStyle(document.getElementById('preset-actors')).gridTemplateColumns;return String(cs.split(' ').length);})()"
check "手机端处境卡排成两列" "2"
# 容器不能高到一屏看不完。阈值 360 是留了余量的：
# 未选中时六张卡两列三行约 234px；选中后 .preset-card.on 字重变 600，
# 个别较长标题会多占一行，实测上限约 320px。
# 这条守的是「别再退回单列 522px 那个状态」，而不是卡死某个具体值。
# 失败时把实测量的高度一起报出来，免得只看到一个孤零零的 false。
"$AB" eval "(function(){var w=document.getElementById('preset-actors');var h=Math.round(w.getBoundingClientRect().height);return String(h<=360)+' (实测 '+h+'px)';})()"
check "六张处境卡总高不超过 360px" "true (实测 234px)"
# 标题必须一行放得下。折行会让卡片变高，也会让扫读变慢。
"$AB" eval "(function(){var c=document.querySelectorAll('.preset-label');var bad=0;for(var i=0;i<c.length;i++){var lh=parseFloat(getComputedStyle(c[i]).lineHeight);if(Math.round(c[i].getBoundingClientRect().height/lh)>1)bad++;}return String(bad);})()"
check "手机端处境标题都不折行" "0"
# 卡片不能被压到点不中
"$AB" eval "(function(){var c=document.querySelectorAll('.preset-card');var bad=0;for(var i=0;i<c.length;i++){if(c[i].getBoundingClientRect().height<44)bad++;}return String(bad);})()"
check "处境卡触控高度全达标" "0"

# 地图在窄屏是「可平移的画布」：画布固定 760px 宽，视口只有 340px，
# 节点落在视口外是设计的一部分，不是裁切。所以这里不测「节点是否全在框内」，
# 而是测三件真正会坏的事：画布没被压缩到不可平移、平移控件在、页面没有横向溢出。
"$AB" eval "String((document.querySelector('#field-world').offsetWidth||0)>=740)"
check "手机端地图画布保持可平移宽度" "true"
"$AB" eval "String(!!document.querySelector('.pan-controls'))"
check "手机端保留平移控件" "true"
"$AB" eval "String(document.documentElement.scrollWidth<=window.innerWidth)"
check "手机端整页无横向溢出(地图)" "true"
go /fear
"$AB" eval "String(!!document.querySelector('#chat-log'))"
check "手机端对话正常" "true"
"$AB" eval "String(document.documentElement.scrollWidth>window.innerWidth)"
check "手机端无溢出(对话)" "false"

echo "── 压力画像：手机端入口 ──"
go /stress
"$AB" eval "String(!!document.querySelector('#sp-intro') && !document.getElementById('sp-intro').hidden)"
check "手机端压力画像落在入口" "true"
"$AB" eval "String(document.querySelector('.stress-page .page-title') && document.querySelector('.stress-page .page-title').textContent.indexOf('压力画像')>=0)"
check "手机端压力画像标题正确" "true"
"$AB" eval "String(!!document.getElementById('sp-consent') && document.getElementById('sp-start').disabled)"
check "手机端压力画像未勾选即不可开始" "true"
"$AB" eval "String(document.documentElement.scrollWidth>window.innerWidth)"
check "手机端压力画像无横向溢出" "false"

# ── 底部 Tab 栏 ──
# 手机上主导航固定悬浮在屏幕底部。这些事必须同时成立，缺一件用户就会看见破绽：
# Dock 悬浮离底、左右留边、四个 Tab 等宽且不被挤掉、悬浮通知出现时压不着 Tab。
# 「设置」已经剥到页头右上角，所以这里是 4 项而不是 5 项。
"$AB" eval "String(getComputedStyle(document.getElementById('nav')).position)"
check "手机端导航脱离文档流" "fixed"
# 顶栏固定：滚动后品牌、日志入口、设置齿轮仍在手上
"$AB" eval "String(getComputedStyle(document.querySelector('.topbar')).position)"
check "手机端顶栏固定" "sticky"
# Dock 左右留边：悬浮而非通栏，且总宽收窄 5%
# （390px 视口：12px + 2.5vw ≈ 21.75px/侧，取 18–26 容差）
"$AB" eval "(function(){var r=document.getElementById('nav').getBoundingClientRect();return String(r.left>=18&&r.left<=26&&window.innerWidth-r.right>=18&&window.innerWidth-r.right<=26);})()"
check "手机端 Dock 左右留边(收窄5%)" "true"
"$AB" eval "(function(){var r=document.getElementById('nav').getBoundingClientRect();return String(window.innerHeight-r.bottom>=8&&window.innerHeight-r.bottom<=16);})()"
check "手机端 Dock 悬浮离底约 12px" "true"
# 胶囊造型：圆角 ≥ 高度一半时两端呈标准半圆
"$AB" eval "(function(){var n=document.getElementById('nav');var r=n.getBoundingClientRect();return String(parseFloat(getComputedStyle(n).borderRadius)>=r.height/2-0.5);})()"
check "手机端 Dock 是胶囊(圆角≥高度一半)" "true"
"$AB" eval "String(document.querySelectorAll('#nav button').length)"
check "手机端导航是四项" "4"
# 等宽：四个格子的宽度两两相差不超过 2px
"$AB" eval "(function(){var b=document.querySelectorAll('#nav button');var w=[];for(var i=0;i<b.length;i++){w.push(b[i].getBoundingClientRect().width);}return String(Math.max.apply(null,w)-Math.min.apply(null,w)<=2);})()"
check "手机端四个 Tab 等宽" "true"
# 标签没被挤掉：overflow:hidden + ellipsis 生效时 scrollWidth 会大于 clientWidth
"$AB" eval "(function(){var b=document.querySelectorAll('#nav button');var bad=0;for(var i=0;i<b.length;i++){if(b[i].scrollWidth>b[i].clientWidth+1){bad++;}}return String(bad);})()"
check "手机端 Tab 标签未被截断" "0"
# Tab 足够大，手指点得中（通行下限 44）
"$AB" eval "String(document.getElementById('nav').querySelector('button').getBoundingClientRect().height>=44)"
check "手机端 Tab 触控高度达标" "true"
# 设置已从主导航剥离：它不该再出现在底部 Tab 里，
# 而应该作为页头右上角的齿轮存在且可用。
"$AB" eval "String(document.getElementById('nav').querySelector('[data-nav=\"/settings\"]')===null)"
check "手机端底部 Tab 不含设置" "true"
"$AB" eval "String(document.getElementById('settings-button')!==null&&document.getElementById('settings-button').getBoundingClientRect().height>=44)"
check "手机端设置齿轮在页头且可达" "true"

# 悬浮通知：造一条回响，通知应当在 Tab 栏上方短暂浮现，且不压住 Tab 文字。
# 常驻回响条已移除（入口上移页头右上角），底部只在有新回响的几秒内有东西。
"$AB" deval "MI.echo && MI.echo.push({kind:'day',surface:'both',title:'第 3 天完成了。',detail:'还剩 4 天。'});"
# 500ms 而不是 300ms：入场动画 340ms，动画期间整个盒子带 transform，
# 量到的是中间帧，位置会差几个像素。
"$AB" wait 500
"$AB" eval "String(document.getElementById('ledger-bar')===null)"
check "手机端无常驻回响条" "true"
"$AB" eval "String(document.getElementById('ledger-toast')&&!document.getElementById('ledger-toast').hidden)"
check "手机端新回响唤起悬浮通知" "true"
# 通知的下沿必须落在导航上沿之上，不许压住 Tab 文字
"$AB" eval "(function(){var n=document.getElementById('nav').getBoundingClientRect();var t=document.getElementById('ledger-toast').getBoundingClientRect();return String(t.bottom<=n.top+0.5);})()"
check "手机端悬浮通知不遮挡 Tab" "true"
# 日志入口在页头右上角（图标 + 角标），而不是底部
"$AB" eval "(function(){var b=document.getElementById('ledger-open');var r=b.getBoundingClientRect();return String(r.top<80&&r.right>document.documentElement.clientWidth-160);})()"
check "手机端日志入口在页头右上角" "true"
"$AB" eval "String(document.getElementById('ledger-badge').textContent.length>0&&document.getElementById('ledger-badge').hidden===false)"
check "手机端角标显示账本条数" "true"

$AB screenshot
echo "  · 手机端截图已保存"

echo "── N2. 预设选择器在桌面端 ──"
"$AB" setviewport 1440 900
"$AB" open "http://localhost:4321/"
"$AB" wait 1600
"$AB" deval "var ov=document.querySelector('#help-overlay'); if(ov && !ov.hidden){document.querySelector('#close-help').click();}"
go /lab
"$AB" eval "(function(){var c=document.querySelectorAll('.preset-label');var bad=0;for(var i=0;i<c.length;i++){var lh=parseFloat(getComputedStyle(c[i]).lineHeight);if(Math.round(c[i].getBoundingClientRect().height/lh)>1)bad++;}return String(bad);})()"
check "桌面端处境标题都不折行" "0"
"$AB" eval "String(document.documentElement.scrollWidth<=window.innerWidth)"
check "桌面端预设区无横向溢出" "true"

echo "── M. 压力画像：桌面端入口与开始 ──"
go /stress
"$AB" eval "String(!!document.querySelector('#sp-intro') && !document.getElementById('sp-intro').hidden)"
check "桌面端压力画像落在入口" "true"
"$AB" eval "String(document.getElementById('sp-start').disabled)"
check "桌面端未勾选即不可开始" "true"
"$AB" deval "var c=document.getElementById('sp-consent');c.checked=true;c.dispatchEvent(new Event('change'));"
"$AB" wait 100
"$AB" eval "String(document.getElementById('sp-start').disabled)"
check "桌面端勾选后开始按钮可用" "false"
"$AB" eval "String(document.documentElement.scrollWidth<=window.innerWidth)"
check "桌面端压力画像无横向溢出" "true"

echo "── O. 控制台 ──"
$AB errors
check "无脚本报错" "" err

echo "── P. 回响账本：只有真正改变了什么的事才留下 ──"
top
"$AB" eval "String(document.getElementById('ledger-bar')===null)"
check "无常驻回响条" "true"
"$AB" eval "String(document.getElementById('ledger-open')!==null&&document.getElementById('ledger-open').closest('.top-status')!==null)"
check "日志入口在页头右上角" "true"
"$AB" deval "MI.echo.push({kind:'day',surface:'ledger',title:'验证条目。',detail:'P 段专用。'});"
"$AB" wait 450
"$AB" eval "String(document.getElementById('ledger-toast')&&!document.getElementById('ledger-toast').hidden&&document.getElementById('ledger-toast').textContent.indexOf('验证条目')>=0)"
check "新回响唤起悬浮通知" "true"
"$AB" eval "String(document.getElementById('ledger-badge').hidden===false&&parseInt(document.getElementById('ledger-badge').textContent,10)>0)"
check "右上角角标显示账本条数" "true"
"$AB" eval "String((MI.store.get().meta.ledger||[]).length>0)"
check "账本已写入条目" "true"
"$AB" eval "String(MI.store.get().meta.ledger.length<=40)"
check "账本上限 40 条" "true"
"$AB" eval "String((MI.store.get().meta.ledger||[]).every(function(e){return e.title&&e.date;}))"
check "每条回响都有标题与时间" "true"
"$AB" eval "String((MI.store.get().meta.ledger||[]).some(function(e){return e.title.indexOf('已经展开')>=0||e.title.indexOf('这是第一个')>=0;}))"
check "展开念头被记下" "true"
"$AB" click '#ledger-open'
"$AB" wait 500
"$AB" eval "String(document.getElementById('ledger-drawer').hidden===false)"
check "抽屉可以打开" "true"
"$AB" eval "document.querySelectorAll('#ledger-list .ledger-entry').length>0"
check "抽屉里列出了回响" "true"
"$AB" eval "String((MI.store.get().meta.ledger||[]).some(function(e){return e.kind==='memory';}))"
check "记忆操作进了账本" "true"
"$AB" eval "String(document.querySelector('#ledger-toast').closest('#view')===null)"
check "悬浮通知不在 #view 里" "true"

echo "── Q. 叙事阶段：从空到有，每一段说的话都不一样 ──"
"$AB" eval "String(MI.journey.phase()!=='empty')"
check "有记录后不再是空阶段" "true"
# 此时有两天进度、也有一份档案。按「刚刚发生的事优先于历史积累」的排序，
# 进度型相位（started）应当盖过 archived——这正是这次要守住的规则。
# 所以这里断言的是「进度型」，不是某一个固定的相位名。
"$AB" eval "MI.journey.phase()"
check "进度型相位盖过历史档案" "started"
"$AB" eval "String(typeof MI.journey.interstitial('route')==='string'&&MI.journey.interstitial('route').indexOf('empty-state')>=0)"
check "空阶段有专门的插页" "true"
"$AB" eval "String(MI.journey.daysSince()>=0)"
check "能算出离开天数" "true"
"$AB" eval "String(MI.store.get().meta.lastSeenAt!==null)"
check "离开时间已记下" "true"

echo "── R. 七天走完：回响与派生状态一起更新 ──"
go /route/1
"$AB" wait 400
# 每次打卡都会触发 echo（往 #receipt-slot 写内容）并重绘 #days，
# 用坐标点击会打到已经被替换掉的旧节点。改用 JS 直接派发。
for d in 0 1 2 3 4 5 6; do
  "$AB" deval "document.querySelector('[data-day=\"$d\"]').click();"
  "$AB" wait 320
done
"$AB" wait 900
"$AB" eval "document.querySelector('#progress-label').textContent"
check "七天全部勾上" "7 / 7"
"$AB" eval "String(MI.fear.totalCompletedDays()===7)"
check "完成天数进了恐惧模型" "true"
"$AB" eval "String((MI.store.get().meta.ledger||[]).some(function(e){return e.title.indexOf('七天')>=0||e.title.indexOf('走完')>=0;}))"
check "走完七天留下回响" "true"
"$AB" eval "MI.journey.phase()"
check "阶段推进到 completed" "completed"

echo "── S. 全清是唯一一处留白 ──"
"$AB" eval "MI.journey.isVirgin()"
check "全清前不是处女态" "false"
go /archive
"$AB" wait 500
"$AB" deval "document.querySelector('[data-sub=\"memory\"]').click()"
"$AB" wait 200
"$AB" deval "document.querySelector('#clear-all').click()"
"$AB" wait 300
"$AB" deval "document.querySelector('#clear-all').click()"
"$AB" wait 800
"$AB" eval "String((MI.store.get().meta.ledger||[]).length)"
check "全清不写任何回响" "0"
"$AB" eval "String(MI.journey.isVirgin())"
check "全清后回到处女态" "true"
"$AB" eval "MI.journey.phase()"
check "阶段回到 empty" "empty"

echo "── T. 桌面端没有被移动端改动波及 ──"
# 底部 Tab 栏是 ≤720px 的规则。桌面端必须**一个字都没动**——
# 它是用户当前正在用的形态，任何漂移都得当成回归。
# 这里守三件事：导航还在页头、它没有脱出文档流、常驻回响条没有回来。
"$AB" setviewport 1440 900
"$AB" open "http://localhost:4321/"
"$AB" wait 1400
"$AB" eval "String(document.getElementById('nav').getBoundingClientRect().top<120)"
check "桌面端导航仍在页头" "true"
"$AB" eval "getComputedStyle(document.querySelector('.topbar')).position"
check "桌面端顶栏固定" "sticky"
"$AB" eval "String(Math.round(document.querySelector('.topbar').getBoundingClientRect().height))"
check "桌面端顶栏收窄到 90px" "90"
"$AB" eval "getComputedStyle(document.getElementById('nav')).position"
check "桌面端导航不脱离文档流" "static"
"$AB" eval "String(document.getElementById('ledger-bar')===null)"
check "桌面端无常驻回响条" "true"
"$AB" eval "getComputedStyle(document.body).paddingBottom"
check "桌面端底部无额外留白" "0px"
"$AB" eval "String(document.documentElement.scrollWidth<=window.innerWidth)"
check "桌面端无横向溢出" "true"

# ── 一次性执行整段脚本，逐条比对 ──
echo
echo "执行 ${#NAMES[@]} 条断言…（浏览器只启动一次）"
RAW=$("$AB" flush 2>/dev/null)
printf '%s\n' "$RAW" > /tmp/mi-verify-raw.txt

i=0          # 指向下一条待消费的断言
fail_at=""   # 首次错位的断言名，最后单独提示

while IFS= read -r line; do
  case "$line" in
    '#VAL '*)
      # 跳过不消费 #VAL 的断言（例如 errors 型），它们排在前面
      while [ "$i" -lt "${#NAMES[@]}" ] && [ "${KINDS[$i]}" = "err" ]; do
        i=$((i+1))
      done
      got=${line#\#VAL }; got=${got%$'\r'}
      if [ "$i" -ge "${#NAMES[@]}" ]; then
        echo "  ! 多出一个结果：[${got}]（没有对应断言，脚本可能中途出错）"
        fail=$((fail+1)); i=$((i+1)); continue
      fi
      # 断言类型是 err，却收到了 #VAL：两头对不上，直接报出来
      if [ "${KINDS[$i]}" != "val" ]; then
        echo "  ! 断言「${NAMES[$i]}」期望 #ERR，却收到 #VAL=[${got}]"
        fail=$((fail+1)); i=$((i+1)); continue
      fi
      want=${EXPECTS[$i]}; name=${NAMES[$i]}
      if [ "$want" = "$got" ]; then
        echo "  ✓ $name"; pass=$((pass+1))
      else
        echo "  ✗ $name  期望=[$want] 实际=[$got]"; fail=$((fail+1))
      fi
      i=$((i+1))
      ;;
    '#ERR'|'#ERR '*)
      err=${line#\#ERR}
      err=${err# }
      err=${err%$'\r'}
      # 找到下一条 err 型断言；中间的 val 型断言说明它没拿到结果
      while [ "$i" -lt "${#NAMES[@]}" ] && [ "${KINDS[$i]}" != "err" ]; do
        echo "  ! 断言「${NAMES[$i]}」没有拿到结果（脚本中途出错）"
        fail=$((fail+1)); i=$((i+1))
      done
      if [ "$i" -ge "${#NAMES[@]}" ]; then
        [ -n "$err" ] && echo "  ! 无对应的报错断言：$err"
        continue
      fi
      want=${EXPECTS[$i]}; name=${NAMES[$i]}
      if [ "$want" = "$err" ]; then
        echo "  ✓ $name"; pass=$((pass+1))
      else
        echo "  ✗ $name  期望=[$want] 实际=[$err]"; fail=$((fail+1))
      fi
      i=$((i+1))
      ;;
    '#SHOT '*)
      echo "  · 截图 ${line#\#SHOT }"
      ;;
  esac
done <<< "$RAW"

# 收尾：还没被消费的断言就是没拿到结果的
while [ "$i" -lt "${#NAMES[@]}" ]; do
  echo "  ! 断言「${NAMES[$i]}」没有拿到结果（脚本中途出错）"
  fail=$((fail+1)); i=$((i+1))
done

if [ "$i" -ne "${#NAMES[@]}" ]; then
  echo "  ! 只取到 $i 个结果，期望 ${#NAMES[@]} 个（脚本可能中途出错）"
  fail=$((fail+1))
fi

echo
echo "结果：通过 $pass 项，失败 $fail 项"
[ "$fail" -eq 0 ]
