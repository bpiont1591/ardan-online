#!/usr/bin/env python3
"""Buduje jednoplikowe demo ARDAN: demo/ardan-demo.html"""
import base64, io, json, os, re
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, 'public'); SRV = os.path.join(ROOT, 'server'); HERE = os.path.dirname(os.path.abspath(__file__))
rd = lambda p: open(p, encoding='utf-8').read()

def b64(data, mime): return 'data:%s;base64,%s' % (mime, base64.b64encode(data).decode())
IMG = {}
for f in sorted(os.listdir(os.path.join(PUB, 'img'))):
    p = os.path.join(PUB, 'img', f)
    if f.endswith('.jpg'):
        b = io.BytesIO(); Image.open(p).save(b, 'WEBP', quality=int(os.environ.get('DEMO_Q', '40')), method=6); IMG[f] = b64(b.getvalue(), 'image/webp')
    elif f.endswith('.png'):
        IMG[f] = b64(open(p, 'rb').read(), 'image/png')
FONTS = {f: b64(open(os.path.join(PUB, 'fonts', f), 'rb').read(), 'font/woff2') for f in os.listdir(os.path.join(PUB, 'fonts'))}
FAV = b64(open(os.path.join(PUB, 'favicon.svg'), 'rb').read(), 'image/svg+xml')

def fix_css(css):
    css = re.sub(r'url\("/fonts/([^"]+)"\)', lambda m: 'url("%s")' % FONTS[m.group(1)], css)
    # tła strony: mniejsze wersje (i tak są rozmyte / przyciemnione)
    css = re.sub(r'url\("/img/([a-z_]+)\.jpg"\)', lambda m: 'url("%s")' % IMG[m.group(1) + '_m.jpg'], css)
    return css
site_css = rd(os.path.join(PUB, 'css/style.css'))
font_css = '\n'.join(l for l in site_css.splitlines() if l.startswith('@font-face'))
site_css = '\n'.join(l for l in site_css.splitlines() if not l.startswith('@font-face'))
game_css = '\n'.join(l for l in rd(os.path.join(PUB, 'css/game.css')).splitlines() if not l.startswith('@font-face'))
demo_css = """
#demoBadge{position:fixed;left:8px;bottom:8px;z-index:9999;pointer-events:none;font:700 10px/1 Inter,system-ui,sans-serif;letter-spacing:.14em;color:#ffd84a;background:rgba(12,9,16,.72);border:1px solid rgba(255,216,74,.35);border-radius:999px;padding:5px 9px;opacity:.85}
body.game-mode #demoBadge{left:auto;right:0;bottom:auto;top:50%;transform:translateY(-50%);writing-mode:vertical-rl;text-orientation:mixed;font-size:8px;letter-spacing:.18em;padding:8px 3px;border-radius:8px 0 0 8px;border-right:0;opacity:.6}
.demo-mail{margin-top:16px;padding:16px 18px;border-radius:12px;border:1px dashed rgba(255,216,74,.6);background:rgba(255,216,74,.07)}
.demo-mail p{margin:8px 0 12px;color:#cfc4ad;font-size:.95rem}
"""

def fix_html(h):
    h = re.sub(r'src="/img/([^"]+)"', lambda m: 'src="%s"' % IMG[m.group(1)], h)
    h = re.sub(r'href="/#([a-z]+)"', r'href="#/?s=\1"', h)
    h = re.sub(r'href="/([^"]*)"', r'href="#/\1"', h)
    h = h.replace(' loading="lazy"', '')
    return h
PAGES = {}
for path, f in {'/': 'index', '/rejestracja': 'rejestracja', '/logowanie': 'logowanie', '/nie-pamietam-hasla': 'nie-pamietam-hasla', '/nowe-haslo': 'nowe-haslo',
                '/postacie': 'postacie', '/regulamin': 'regulamin', '/prywatnosc': 'prywatnosc', '/404': '404'}.items():
    src = rd(os.path.join(PUB, f + '.html'))
    title = re.search(r'<title>(.*?)</title>', src).group(1)
    pm = re.search(r'<body data-page="([a-z]+)"', src)
    main = re.search(r'<main>(.*)</main>', src, re.S).group(1)
    if f == 'index':
        main += re.search(r'(<div class="lightbox".*?</div></div>)', src, re.S).group(1)
    PAGES[path] = {'title': title, 'page': pm.group(1) if pm else ('home' if f == 'index' else 'other'), 'html': fix_html(main)}
PAGES['/rejestracja']['html'] = PAGES['/rejestracja']['html'].replace('Postęp zapisuje się na serwerze.', 'W wersji demo konto zapisuje się tylko w tej przeglądarce.')

graj = rd(os.path.join(PUB, 'graj.html'))
game_html = fix_html(re.search(r'<body>(.*?)<script', graj, re.S).group(1))

client = rd(os.path.join(PUB, 'js/game-client.js'))
reps = [
    ("new URLSearchParams(location.search).get('postac')", "DEMO.q().get('postac')"),
    ("location.replace('/postacie')", "DEMO.go('/postacie')"),
    ("location.replace('/logowanie?next=' + encodeURIComponent('/graj?postac=' + charId))", "DEMO.go('/logowanie?next=/graj?postac=' + charId)"),
    ('href="/postacie"', 'href="#/postacie"'),
]
for a, b in reps:
    assert a in client, a
    client = client.replace(a, b)
client, n = re.subn(r'new WebSocket\(`[^`]*`\)', 'new DemoSocket(charId)', client); assert n == 1
client = "window.DEMO_GAME_CLIENT = function () {\n" + client + "\n};"

engine = rd(os.path.join(PUB, 'js/engine.js'))
gameui = rd(os.path.join(PUB, 'js/game-ui.js'))
gameui += '\n' + rd(os.path.join(PUB, 'js/game-ui2.js'))
import subprocess
NEWS_JSON = subprocess.check_output(['node', '-e', "process.stdout.write(JSON.stringify(require(process.argv[1])))", os.path.join(SRV, 'news.js')]).decode()
mods = {}
for m in ['chat', 'party', 'passives', 'items', 'gear', 'battle', 'market', 'trade', 'guild', 'gather', 'dungeon', 'craft', 'daily', 'ach', 'ranking', 'game']:
    mods[m] = rd(os.path.join(SRV, m + '.js'))
require_js = """(function(){
const defs = {}, cache = {};
%s
const builtins = { './engine': () => ({ createArdan: window.createArdan }), './characters': () => window.DEMO.charsMock, './config': () => ({ tickMs: 50 }), './store': () => STORE };
const STORE = (function () { const P = 'ardan_demo_kv_', cache = {}; return { get(k, def) { if (!(k in cache)) { let v = def; try { const r = localStorage.getItem(P + k); if (r) v = JSON.parse(r); } catch (e) {} cache[k] = v; } return cache[k]; }, set(k, v) { cache[k] = v; try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) {} } }; })();
function req(n) { if (cache[n]) return cache[n].exports; if (builtins[n]) return builtins[n](); const module = cache[n] = { exports: {} }; defs[n](module, module.exports, req, PROC); return module.exports; }
const PROC = { env: { ARDAN_TEST_HOOKS: '1', NODE_ENV: 'demo' } };
window.DEMO_REQUIRE = req;
})();""" % '\n'.join("defs['./%s'] = function (module, exports, require, process) {\n%s\n};" % (k, v) for k, v in mods.items())

app = rd(os.path.join(HERE, 'src/app.js'))
safe = lambda s: s.replace('</script', '<\\/script')
html = f"""<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ARDAN – przeglądarkowa gra MMORPG dark fantasy</title>
<meta name="theme-color" content="#0c0910">
<meta name="robots" content="noindex">
<link rel="icon" href="{FAV}" type="image/svg+xml">
<style id="cssFonts">{fix_css(font_css)}</style>
<style id="cssSite">{fix_css(site_css)}</style>
<style id="cssGame" media="not all">{fix_css(game_css)}</style>
<style>{demo_css}</style>
</head>
<body>
<header id="nav" class="nav"></header>
<main id="main"></main>
<footer id="foot"></footer>
<script>
window.DEMO_IMG = {json.dumps(IMG)};
window.DEMO_NEWS = {safe(NEWS_JSON)};
window.DEMO_PAGES = {safe(json.dumps(PAGES, ensure_ascii=False))};
window.DEMO_GAME_HTML = {safe(json.dumps(game_html, ensure_ascii=False))};
</script>
<script>{safe(engine)}</script>
<script>{safe(require_js)}</script>
<script>{safe(gameui)}</script>
<script>{safe(client)}</script>
<script>{safe(app)}</script>
</body>
</html>
"""
out = os.path.join(HERE, 'ardan-demo.html')
open(out, 'w', encoding='utf-8').write(html)
print(out, os.path.getsize(out))
