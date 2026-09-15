# 路由 × 视口 回归：确认没有空视图 / 横向溢出 / 控制台报错
from playwright.sync_api import sync_playwright
import pathlib, sys

ROUTES = ["/", "/lab", "/route/0", "/route/1", "/route/2", "/fear",
          "/archive", "/stress", "/settings", "/about", "/nope"]
VIEWPORTS = [1600, 1440, 1280, 1024, 768, 430, 390]
errors, fails = [], []

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/chromium",
                          args=["--no-sandbox", "--disable-dev-shm-usage"])
    for w in VIEWPORTS:
        pg = b.new_page(viewport={"width": w, "height": 880})
        pg.on("console", lambda m: m.type == "error" and errors.append(f"{w}px {m.text}"))
        pg.on("pageerror", lambda e: errors.append(f"{w}px PAGEERROR {e}"))
        url = pathlib.Path("outputs/index.html").resolve().as_uri()
        for r in ROUTES:
            pg.goto(url + "#" + r)
            pg.wait_for_timeout(420)
            pg.evaluate("() => { const g = document.querySelector('.guide, .overlay, #guide'); if (g) g.remove(); }")
            out = pg.evaluate("""() => {
              const v = document.querySelector('#view');
              const h1 = v && v.querySelector('h1');
              return {
                h: v ? v.scrollHeight : 0,
                title: h1 ? h1.textContent.trim().slice(0, 12) : '',
                ox: document.documentElement.scrollWidth - document.documentElement.clientWidth
              };
            }""")
            if out["h"] < 120: fails.append(f"{w}px {r} 空视图 h={out['h']}")
            if not out["title"]: fails.append(f"{w}px {r} 无标题")
            if out["ox"] > 4: fails.append(f"{w}px {r} 横向溢出 {out['ox']}px")
        pg.close()
    b.close()

print(f"检查 {len(ROUTES)*len(VIEWPORTS)} 个组合")
if fails:
    print("失败：")
    for f in fails[:20]: print("  " + f)
if errors:
    print("控制台错误：")
    for e in errors[:10]: print("  " + e)
if not fails and not errors:
    print("全部通过：无空视图、无横向溢出、无控制台错误。")
sys.exit(1 if (fails or errors) else 0)
