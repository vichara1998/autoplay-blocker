
from PIL import Image, ImageDraw

TEAL = (13, 148, 136, 255)      # #0D9488 - matches --color-primary
WHITE = (255, 255, 255, 255)
RED = (220, 38, 38, 255)        # #DC2626


def make_icon(size: int) -> Image.Image:
    # Render at 4x and downsample for crisp edges at small sizes.
    scale = 4
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background badge
    radius = s * 0.22
    draw.rounded_rectangle([0, 0, s - 1, s - 1], radius=radius, fill=TEAL)

    # Play triangle, nudged right of center so it balances visually
    # against the slash that runs the other diagonal.
    cx, cy = s / 2, s / 2
    tri_w, tri_h = s * 0.34, s * 0.40
    offset = s * 0.03
    p1 = (cx - tri_w / 2 + offset, cy - tri_h / 2)
    p2 = (cx - tri_w / 2 + offset, cy + tri_h / 2)
    p3 = (cx + tri_w / 2 + offset, cy)
    draw.polygon([p1, p2, p3], fill=WHITE)

    # "Blocked" ring + slash
    margin = s * 0.07
    stroke = max(scale * 2, int(s * 0.10))
    draw.ellipse([margin, margin, s - margin, s - margin], outline=RED, width=stroke)

    inset = margin + stroke / 2
    draw.line([(inset, inset), (s - inset, s - inset)], fill=RED, width=stroke)

    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    for icon_size in (16, 48, 128):
        make_icon(icon_size).save(f"icons/icon{icon_size}.png")
    print("Icons generated.")
