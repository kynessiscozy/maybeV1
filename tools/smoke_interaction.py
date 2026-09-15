#!/usr/bin/env python3
"""冒烟测试：验证本轮交互改造在真实浏览器里不报错，且关键行为生效。"""
import sys, json
from playwright.sync_api import sync_playwright

URL = "file:///workspace/maybe-institute/outputs/index.html"
errors = []
results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium",
                                args=["--no-sandbox", "--disable-dev-shm-usage"])
    page = browser.new_page(viewport={"width": 1440, "height": 950})

    page.on("console", lambda m: errors.append(f"[console.{m.type}] {m.text}")
            if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))

    page.goto(URL)
    page.wait_for_timeout(1400)

    # 1. 引导弹窗（首次进入自动弹出）
    check("首次进入自动弹出引导", page.is_visible("#help-overlay"))
    # 情境提示已填充
    ctx = page.inner_text("#help-context")
    check("引导含情境提示", "你现在在" in ctx, ctx[:40])
    page.click("#close-help")
    page.wait_for_timeout(320)

    # 2. 进入实验室
    page.click('#nav button[data-nav="/lab"]')
    page.wait_for_timeout(700)
    check("实验室已挂载", page.is_visible("#composer"))

    # 3. 地图可拖拽 — 世界层存在且宽度大于窗口
    world_w = page.evaluate("document.getElementById('field-world').offsetWidth")
    frame_w = page.evaluate("document.getElementById('field-frame').clientWidth")
    check("世界层大于可视窗口（可拖拽）", world_w > frame_w, f"world={world_w} frame={frame_w}")

    # 模拟拖拽
    box = page.locator("#field-frame").bounding_box()
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.mouse.down()
    page.mouse.move(box["x"] + box["width"] / 2 - 160, box["y"] + box["height"] / 2, steps=8)
    page.mouse.up()
    page.wait_for_timeout(420)
    tx = page.evaluate("document.getElementById('field-world').style.transform")
    check("拖拽改变了世界层位移", "translate3d" in tx and "-" in tx, tx)

    # 平移按钮复位
    page.click('#pan-controls [data-pan="reset"]')
    page.wait_for_timeout(420)
    tx2 = page.evaluate("document.getElementById('field-world').style.transform")
    check("平移按钮可复位", "translate3d(0px,0px" in tx2.replace(" ", ""), tx2)

    # 4. 悬停预读（先把镜头对准左上节点，确保它在可视区域内）
    page.click("#field")
    page.keyboard.press("ArrowUp")
    page.keyboard.press("ArrowLeft")
    page.wait_for_timeout(300)
    page.evaluate("document.getElementById('node-peek').hidden = true")
    page.hover('.node[data-node="0-0"]')
    page.wait_for_timeout(400)
    check("悬停出现预读浮层", page.is_visible("#node-peek"))
    peek = page.inner_text("#node-peek")
    check("预读含路线与建议", "SEED" in peek and "点击或按回车" in peek, peek[:50].replace("\n", " "))

    # 5. 键盘导航
    page.click("#field")
    page.keyboard.press("ArrowDown")
    page.wait_for_timeout(240)
    cursor_sub = page.evaluate(
        "() => { const e=document.querySelector('.node.cursor'); return e? e.dataset.node : null }")
    check("方向键移动了地图光标", cursor_sub is not None, str(cursor_sub))
    page.keyboard.press("Enter")
    page.wait_for_timeout(400)
    check("回车打开了节点详情", page.is_visible("#node-detail"))

    # 6. 生成：错峰入场 + 路径描线
    page.fill("#idea", "做一个只在雨天营业的电台")
    page.click("#generate-btn")
    page.wait_for_timeout(900)
    kept = page.evaluate("document.querySelectorAll('#nodes .node.keep').length")
    check("生成后九个节点完成入场", kept == 9, f"keep={kept}")
    selected_path = page.evaluate(
        "() => document.querySelector('.route-path.selected') ? true : false")
    check("选中路线有高亮路径", selected_path)
    check("地图标题已更新为念头主题",
          "三种生长方式" in page.inner_text("#map-title"), page.inner_text("#map-title"))

    # 7. 数字键切路线
    page.keyboard.press("Escape")
    page.click("body")
    page.keyboard.press("3")
    page.wait_for_timeout(400)
    active_tab = page.evaluate(
        "() => { const e=document.querySelector('.route-tab.active'); return e? e.dataset.route : null }")
    check("数字键 3 切到第三条路线", active_tab == "2", str(active_tab))

    # 8. 路线页：反馈回执
    page.click("#open-route")
    page.wait_for_timeout(800)
    check("进入路线详情页", page.is_visible("#days"))

    # 打卡第一天
    page.click('.day-main[data-day="0"]')
    page.wait_for_timeout(600)
    progress = page.inner_text("#progress-label")
    check("打卡后进度更新", "/ 7" in progress, progress)

    # 难度反馈 → 回执条出现
    page.click('.day-feedback [data-level="hard"]')
    page.wait_for_timeout(700)
    check("难度反馈后出现回执条", page.is_visible("#receipt-slot"))
    receipt = page.inner_text("#receipt-slot")
    check("回执说明了引擎做了什么", "不要太难" in receipt or "难度" in receipt or "任务规模" in receipt,
          receipt[:60].replace("\n", " "))

    # 路线判断反馈（多次以触发权重变化）
    for _ in range(3):
        page.click('#route-verdict [data-key="unlike"]')
        page.wait_for_timeout(280)
    page.wait_for_timeout(500)
    check("路线判断后回执条仍在", page.is_visible("#receipt-slot"))

    # 9. 恐惧模型：气泡视觉重量 + 反驳
    page.click('#nav button[data-nav="/fear"]')
    page.wait_for_timeout(900)
    check("恐惧模型已挂载", page.is_visible("#chat-log"))
    check("对话已自动开场", page.locator(".chat-turn.fear").count() > 0)
    wc = page.evaluate("document.querySelector('.chat-panel').dataset.weight")
    check("气泡带确定性权重标记", wc in ("w-solid", "w-firm", "w-soft", "w-faint"), str(wc))
    check("确定性仪表已渲染", page.locator("#meters .meter").count() == 2)

    before_c = page.evaluate("MI.fear.derive().certainty")
    page.click('.chat-turn.fear [data-verdict="rebut"]')
    page.wait_for_timeout(900)
    after_c = page.evaluate("MI.fear.derive().certainty")
    check("反驳后确定性下降", after_c < before_c, f"{before_c:.3f} -> {after_c:.3f}")
    check("反驳后出现回执", page.is_visible("#fear-receipt"))
    check("被反驳的气泡标记为 rebutted",
          page.locator(".chat-turn.fear.rebutted").count() > 0)

    # 10. 记忆页 / 设置页无异常
    page.click('#nav button[data-nav="/memory"]')
    page.wait_for_timeout(600)
    check("记忆页已挂载", page.is_visible(".stat-row"))
    page.click('#settings-button')
    page.wait_for_timeout(600)
    check("设置页已挂载", page.is_visible("#ai-endpoint"))

    # 11. 首页可点击情境入口
    page.click('.brand')
    page.wait_for_timeout(700)
    check("首页情境入口可点击", page.locator('.landing-meta div[data-nav]').count() == 4)

    # 12. 折叠披露：默认收起、可展开、重渲染后状态保持、打印时展开
    page.click('.footer button[data-nav="/about"]')
    page.wait_for_timeout(700)
    folds = page.locator("details.fold")
    n_folds = folds.count()
    check("关于页使用折叠披露", n_folds >= 8, f"{n_folds} 个折叠块")

    # 默认只有「它是什么」是展开的，其余收起
    open_default = page.evaluate(
        "Array.from(document.querySelectorAll('details.fold')).filter(function(e){return e.open}).length")
    check("默认仅少量折叠块展开", open_default == 1, f"{open_default} 个默认展开")

    # 关闭那个默认展开的，再打开第 3 个，验证能双向切换
    page.evaluate("document.querySelectorAll('details.fold')[0].open = false")
    page.wait_for_timeout(160)
    page.evaluate("document.querySelectorAll('details.fold')[2].open = true")
    page.wait_for_timeout(260)
    mid = page.evaluate(
        "Array.from(document.querySelectorAll('details.fold')).map(function(e){return e.open})")
    check("折叠块可展开", mid[2] is True and mid[0] is False, str(mid))

    # 关键：切走再切回来，展开状态应被记住（不被重置为默认）
    page.click('#settings-button')
    page.wait_for_timeout(500)
    page.click('.footer button[data-nav="/about"]')
    page.wait_for_timeout(700)
    back = page.evaluate(
        "Array.from(document.querySelectorAll('details.fold')).map(function(e){return e.open})")
    check("离开再返回后展开状态被记住", back[2] is True and back[0] is False, str(back))

    # 页内操作（保存身份）会触发整页重渲染，折叠状态不应被重置
    page.click('#nav button[data-nav="/memory"]')
    page.wait_for_timeout(600)
    page.evaluate("document.querySelectorAll('details.fold')[2].open = true")
    page.wait_for_timeout(260)
    before_ops = page.evaluate(
        "Array.from(document.querySelectorAll('details.fold')).map(function(e){return e.open})")
    did = page.evaluate("""() => {
      const btn = document.querySelector('[data-action="save-profile"]')
        || document.querySelector('#profile-name') || null;
      return !!btn;
    }""")
    page.evaluate("MI.router.render()")
    page.wait_for_timeout(400)
    after_ops = page.evaluate(
        "Array.from(document.querySelectorAll('details.fold')).map(function(e){return e.open})")
    check("页内重渲染后折叠状态保持", before_ops == after_ops,
          f"{before_ops} -> {after_ops}")

    # 折叠体里的内容在收起时不可见、展开后可见
    page.click('.footer button[data-nav="/about"]')
    page.wait_for_timeout(700)
    body_vis = page.evaluate("""() => {
      const f = document.querySelectorAll('details.fold')[2];
      return { open: f.open, h: f.querySelector('.fold-body').getBoundingClientRect().height };
    }""")
    check("折叠体在展开时占据高度", body_vis["open"] and body_vis["h"] > 10, str(body_vis))

    # 打印样式下折叠应全部展开（纸面上不存在「点开」）
    page.emulate_media(media="print")
    page.wait_for_timeout(300)
    printed = page.evaluate("""() => {
      const f = document.querySelectorAll('details.fold')[5];
      const b = f.querySelector('.fold-body');
      return { open: f.open, display: getComputedStyle(b).display };
    }""")
    check("打印时收起内容也会呈现", printed["display"] == "block", str(printed))
    page.emulate_media(media="screen")

    # 13. 预设：处境 → 动机 → 念头 → 正确的行动模板
    page.click('#nav button[data-nav="/lab"]')
    page.wait_for_timeout(800)
    check("三级预设已渲染", page.locator(".preset-card").count() == 6)
    check("二级默认收起", page.locator("#preset-motives").is_hidden())

    page.click('.preset-card[data-actor="tired"]')
    page.wait_for_timeout(400)
    n_motives = page.locator(".preset-motive").count()
    check("选处境后出现动机", page.locator("#preset-motives").is_visible() and n_motives >= 3,
          f"{n_motives} 个动机")
    check("动机按处境筛过", page.locator('.preset-motive[data-motive="money"]').count() == 1)

    # 换一个处境，动机列表应该跟着换
    page.click('.preset-card[data-actor="carer"]')
    page.wait_for_timeout(400)
    check("换处境后动机列表随之变化",
          page.locator('.preset-motive[data-motive="rest"]').count() == 1 and
          page.locator('.preset-motive[data-motive="craft"]').count() == 0)

    # 选动机：应同步胆量、时间，并显示回声条
    page.click('.preset-card[data-actor="tired"]')
    page.wait_for_timeout(300)
    page.click('.preset-motive[data-motive="rest"]')
    page.wait_for_timeout(500)
    st = page.evaluate("MI.store.get().session")
    check("选动机同步了胆量", st["courage"] == 25, f"courage={st['courage']}")
    check("选动机同步了时间", st["time"] == 15, f"time={st['time']}")
    check("滑块读数与状态一致", page.inner_text("#courage-value") == "25%")
    check("时间档位已切换", "15" in page.inner_text(".time-switch .active"))
    check("回声条说明预设改变了什么", page.is_visible("#preset-echo"))

    # 点预设念头并生成，应命中对应的行动模板
    page.click(".sample-chip >> nth=0")
    page.wait_for_timeout(300)
    check("预设念头已填入输入框", len(page.input_value("#idea")) > 6)
    page.click("#generate-btn")
    page.wait_for_timeout(1400)
    plan = page.evaluate("""() => {
      const p = MI.session.get();
      return { theme: p.theme, motive: p.motive, node: p.routes[0].nodes[0].title };
    }""")
    check("生成结果命中预设主题", plan["theme"] == "rest", str(plan))
    check("计划里保留了动机", plan["motive"] == "rest")
    check("行动模板与预设一致", plan["node"] == "先停一件事", plan["node"])

    # 每条预设都必须落在自己声明的主题上（防止关键词互相抢）
    mism = page.evaluate("""() => {
      const bad = [];
      MI.data.MOTIVES.forEach(function (m) {
        MI.data.seedsFor(m.seedSet).forEach(function (s) {
          if (MI.generate.themeFor(s.idea, m.key).key !== m.theme) bad.push(m.key + '/' + s.label);
        });
      });
      return bad;
    }""")
    check("88 条预设全部命中各自主题", len(mism) == 0, str(mism[:5]))

    # 取消处境选择应能回到自由书写
    page.click('.preset-card[data-actor="tired"]')
    page.wait_for_timeout(400)
    check("再点一次可取消处境", page.evaluate("MI.store.get().session.actor") is None)

    # 14. 预设必须能穿过「收藏 → 继续这条路」而不变形
    page.goto(URL + "#/lab")
    page.wait_for_timeout(800)
    page.click('.preset-card[data-actor="maker"]')
    page.wait_for_timeout(300)
    page.click('.preset-motive[data-motive="craft"]')
    page.wait_for_timeout(400)
    page.click(".sample-chip >> nth=0")
    page.wait_for_timeout(300)
    page.click("#generate-btn")
    page.wait_for_timeout(1400)
    snap_before = page.evaluate("""() => {
      const p = MI.session.get();
      return { theme: p.theme, motive: p.motive, node: p.routes[0].nodes[0].title };
    }""")

    page.evaluate("MI.router.go('/route/' + MI.session.get().route)")
    page.wait_for_timeout(1000)
    page.click("#save-btn")
    page.wait_for_timeout(600)
    entry = page.evaluate("MI.store.get().saved[0]")
    check("存档记住了处境与动机",
          entry.get("actor") == "maker" and entry.get("motive") == "craft",
          str({k: entry.get(k) for k in ("actor", "motive")}))

    # 把当前状态打乱，再从档案柜恢复
    page.evaluate("""() => {
      MI.store.update(function (s) {
        s.session.actor = null; s.session.motive = null;
        s.session.idea = '和刚才完全无关的另一件事';
      });
      MI.session.clear();
    }""")
    page.goto(URL + "#/archive")
    page.wait_for_timeout(900)
    page.click("[data-open]")
    page.wait_for_timeout(1200)
    snap_after = page.evaluate("""() => {
      const p = MI.session.get();
      return { theme: p.theme, motive: p.motive, node: p.routes[0].nodes[0].title };
    }""")
    check("「继续这条路」还原出同一套方案", snap_before == snap_after,
          f"{snap_before} -> {snap_after}")

    browser.close()

print("=" * 62)
passed = 0
for name, ok, detail in results:
    mark = "PASS" if ok else "FAIL"
    if ok:
        passed += 1
    print(f"[{mark}] {name}" + (f"  · {detail}" if detail and not ok else ""))
print("=" * 62)
print(f"通过 {passed}/{len(results)}")
if errors:
    print("\n控制台错误：")
    for e in errors[:20]:
        print("  " + e)
    sys.exit(1)
print("无控制台错误。")
sys.exit(0 if passed == len(results) else 2)
