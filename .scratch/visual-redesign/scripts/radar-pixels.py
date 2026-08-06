"""Pixel-verify radar screenshots + WCAG contrast report (D-03)."""
from PIL import Image

OUT = ".scratch/visual-redesign/shots-radar"


def near(c, target, tol=8):
    return all(abs(a - b) <= tol for a, b in zip(c, target))


def lum(rgb):
    def f(c):
        c = c / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = rgb
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contrast(a, b):
    la, lb = lum(a), lum(b)
    if la < lb:
        la, lb = lb, la
    return (la + 0.05) / (lb + 0.05)


# Регион первого радара (CSS: x 160..470, y 500..800; dsf=2)
BOX = (2 * 160, 2 * 500, 2 * 470, 2 * 800)

THEMES = {
    "light": {
        "accent": (29, 78, 216),
        "soft": (219, 234, 254),
        "surface": (255, 255, 255),
        "muted": (102, 112, 133),
        "inner_blend": (194, 198, 206),   # muted@0.35 на белом
        "outer_blend": (163, 170, 183),   # muted@0.6
    },
    "dark": {
        "accent": (96, 165, 250),
        "soft": None,
        "surface": (18, 22, 29),
        "muted": (138, 147, 160),
        "inner_blend": (60, 64, 71),      # muted@0.35 на surface
        "outer_blend": (90, 97, 108),     # muted@0.6
    },
    "udmurt": {
        "accent": (192, 38, 38),
        "soft": (251, 233, 233),
        "surface": (255, 255, 255),
        "muted": (102, 111, 121),
        "inner_blend": (193, 197, 205),
        "outer_blend": (162, 168, 179),
    },
}

for theme, meta in THEMES.items():
    im = Image.open(f"{OUT}/radar-{theme}.png").convert("RGB")
    crop = im.crop(BOX)
    w, h = crop.size
    px = crop.load()
    counts = {
        "accent_stroke": 0,
        "soft_fill": 0,
        "inner_grid": 0,
        "outer_grid": 0,
    }
    for y in range(h):
        for x in range(w):
            c = px[x, y]
            if near(c, meta["accent"], 14):
                counts["accent_stroke"] += 1
            if meta["soft"] and near(c, meta["soft"], 10):
                counts["soft_fill"] += 1
            if near(c, meta["inner_blend"], 8):
                counts["inner_grid"] += 1
            if near(c, meta["outer_blend"], 8):
                counts["outer_grid"] += 1
    print(f"=== {theme} ===")
    print("  pixels:", counts)
    print(f"  accent vs surface: {contrast(meta['accent'], meta['surface']):.2f}:1")
    print(f"  outer grid vs surface: {contrast(meta['outer_blend'], meta['surface']):.2f}:1")
    print(f"  inner grid vs surface: {contrast(meta['inner_blend'], meta['surface']):.2f}:1")
