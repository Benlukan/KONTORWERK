"""Rendert die Marken-SVGs (assets/branding/, erzeugt von tools/brand.mjs) zu PNG:
   assets/ (Quelle für `npm run icons`) und public/ (Web-App-Icons). Braucht: pip playwright."""
from pathlib import Path
from playwright.sync_api import sync_playwright
R = Path(__file__).resolve().parent.parent
B = R / 'assets' / 'branding'
FONTS = R / 'public' / 'fonts'

def page_html(body, bg='transparent'):
    ff = ''.join(f'@font-face{{font-family:Inter;font-weight:{w};src:url(file://{FONTS}/inter-latin-{w}-normal.woff2)}}' for w in (400, 600, 800))
    return f'<html><head><style>{ff}html,body{{margin:0;background:{bg}}}</style></head><body>{body}</body></html>'

def splash(dark):
    ink, sub = ('#e8ecf4', '#8b95a8') if dark else ('#0b1f44', '#5b6478')
    return f'''<div style="width:2732px;height:2732px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Inter">
      <img src="file://{B}/icon.svg" width="760" height="760" style="border-radius:175px;box-shadow:0 40px 120px rgba(0,20,54,.35)">
      <div style="margin-top:110px;font-size:200px;font-weight:800;letter-spacing:4px;color:{ink}">KONTOR<span style="color:#1683e0">WERK</span></div>
      <div style="margin-top:30px;font-size:70px;font-weight:600;letter-spacing:22px;color:{sub}">DAS ERP FÜR SELBSTSTÄNDIGE</div></div>'''

with sync_playwright() as p:
    b = p.chromium.launch()
    def shot(html, size, out, bg='transparent', omit=True):
        pg = b.new_page(viewport={'width': size, 'height': size})
        tmp = B / '_render.html'; tmp.write_text(page_html(html, bg), encoding='utf-8')
        pg.goto(tmp.as_uri()); pg.wait_for_timeout(400); tmp.unlink()
        pg.screenshot(path=str(out), omit_background=omit); pg.close()
    img = lambda n, s: f'<img src="file://{B}/{n}" width="{s}" height="{s}" style="display:block">'
    shot(img('icon-full.svg', 1024), 1024, R / 'assets/icon-only.png', omit=False)
    shot(img('icon-foreground.svg', 1024), 1024, R / 'assets/icon-foreground.png')
    shot(img('icon-background.svg', 1024), 1024, R / 'assets/icon-background.png', omit=False)
    for s, n in ((192, 'icon-192.png'), (512, 'icon-512.png'), (180, 'apple-touch-icon.png')):
        shot(img('icon-full.svg', s), s, R / 'public' / n, omit=False)
    shot(splash(False), 2732, R / 'assets/splash.png', '#f0f2f8', omit=False)
    shot(splash(True), 2732, R / 'assets/splash-dark.png', '#0d1117', omit=False)
    b.close()
print('ok')
