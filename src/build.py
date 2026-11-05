"""Build ../index.html — same mechanism as the K-PaF sample:
a shell page + embedded tool pages (JSON strings in window.TM1_EMBEDDED_PAGES)
that the shell loads into iframes (srcdoc) after login.

Usage:  python build.py         → ../index.html        (current design)
        python build.py glass   → ../index_glass.html  (Liquid Glass preview: adds theme_glass.css,
                                   theme_glass_shell.css and glass_bubbles.js on top of the same code)
        add "demo" (python build.py demo / python build.py glass demo) → ../index_demo.html /
        ../index_glass_demo.html: the same pages without the Supabase connection (illustrative mock-up)
Edit the files in src/, never the built .html files directly.
"""
import base64, io, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[1:]
DEMO = "demo" in ARGS
VARIANT = "glass" if "glass" in ARGS else ""
if any(a not in ("glass", "demo") for a in ARGS):
    sys.exit("usage: python build.py [glass] [demo]")
OUT = os.path.join(os.path.dirname(HERE), ("index_glass" if VARIANT == "glass" else "index") + ("_demo" if DEMO else "") + ".html")
LOGO = os.path.join(os.path.dirname(HERE), "who-wpro-logo-new.png")   # new WHO Western Pacific Region logo (transparent PNG)

def read(name):
    with open(os.path.join(HERE, name), encoding="utf-8") as f:
        return f.read()

def logo_data_uri():
    from PIL import Image
    im = Image.open(LOGO).convert("RGBA")
    h = 200   # sharp on high-density screens at the larger glass sidebar size
    im = im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
    im = im.quantize(colors=48, method=Image.FASTOCTREE)   # one-colour logo: a small palette keeps it sharp at ~1/4 the size
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

def js_string(html):
    """JSON string that is safe inside an inline <script> block."""
    return json.dumps(html, ensure_ascii=False).replace("</", "<\\/").replace("<!--", "<\\!--")

def add_head(html, extra):
    """Insert before the document's own </head> (the first one; later ones are inside JS strings)."""
    i = html.index("</head>")
    return html[:i] + extra + "\n" + html[i:]

def add_body_end(html, extra):
    """Insert before the document's own </body> (the last one)."""
    i = html.rindex("</body>")
    return html[:i] + extra + "\n" + html[i:]

css, js = read("common.css"), read("common.js")
pages = {}
for key, fname in [("dashboard", "dashboard.html"), ("submission", "submission.html"), ("review", "review.html")]:
    p = read(fname)
    assert "/*__COMMON_CSS__*/" in p and "/*__COMMON_JS__*/" in p, fname
    pages[key] = p.replace("/*__COMMON_CSS__*/", css).replace("/*__COMMON_JS__*/", js)

if VARIANT == "glass":
    gcss, gjs = read("theme_glass.css"), read("glass_bubbles.js") + "\n" + read("glass_liquid.js")
    for key in pages:
        pages[key] = add_body_end(add_head(pages[key], "<style>\n" + gcss + "</style>"), "<script>\n" + gjs + "</script>")

shell = read("shell.html")
if DEMO:   # no Supabase connection → DEMO mode with the illustrative data kept in the browser
    import re
    shell, n = re.subn(r'(SUPABASE_URL:\s*)"[^"]*"', lambda m: m.group(1) + '""', shell, count=1)
    assert n == 1, "SUPABASE_URL in TM1_CONFIG"
assert "/*__EMBEDDED_PAGES__*/" in shell and "/*__WPRO_LOGO__*/" in shell
if VARIANT == "glass":
    # swap the shell's bubble background (canvas + script between the BUBBLES markers) for the glass droplets
    parts = shell.split("<!--BUBBLES-->")
    assert len(parts) == 3 and all("<!--/BUBBLES-->" in p for p in parts[1:]), "BUBBLES markers"
    shell = parts[0] + parts[1].split("<!--/BUBBLES-->", 1)[1] + "<script>\n" + read("glass_bubbles.js") + "\n" + read("glass_liquid.js") + "</script>" + parts[2].split("<!--/BUBBLES-->", 1)[1]
    shell = add_head(shell, "<style>\n" + read("theme_glass_shell.css") + "</style>")
    shell = shell.replace("<title>TM1 MDS Dashboard · Western Pacific Region</title>", "<title>TM1 MDS Dashboard · Western Pacific Region (Liquid Glass preview)</title>", 1)
embedded = "window.TM1_EMBEDDED_PAGES = {\n" + ",\n".join(f"  {k}: {js_string(v)}" for k, v in pages.items()) + "\n};"
shell = shell.replace("/*__EMBEDDED_PAGES__*/", embedded).replace("/*__WPRO_LOGO__*/", logo_data_uri())

with open(OUT, "w", encoding="utf-8", newline="\n") as f:
    f.write(shell)
print("built", OUT, f"{os.path.getsize(OUT)/1024:.0f} KB")
