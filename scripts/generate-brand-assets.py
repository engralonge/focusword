from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "brand" / "citizens-bible-community-master.png"
BRAND_DIR = ROOT / "assets" / "brand"
NAVY = (0, 20, 48, 255)


def gold_alpha(pixel: tuple[int, int, int, int]) -> int:
    red, green, blue, source_alpha = pixel
    if source_alpha == 0:
        return 0
    warmth = min(red - blue, green - blue)
    brightness = max(red, green)
    if brightness < 75 or warmth < 18 or red <= blue * 1.18:
        return 0
    return max(0, min(255, int((warmth - 18) * 5.2)))


def square(source: Image.Image, size: int) -> Image.Image:
    width, height = source.size
    crop_size = min(width, height)
    left = (width - crop_size) // 2
    top = (height - crop_size) // 2
    return source.crop((left, top, left + crop_size, top + crop_size)).resize(
        (size, size),
        Image.Resampling.LANCZOS,
    )


def extract_emblem(source: Image.Image, size: int, padding: int) -> Image.Image:
    source = square(source, 1536).convert("RGBA")
    alpha = Image.new("L", source.size)
    alpha.putdata([gold_alpha(pixel) for pixel in source.get_flattened_data()])
    emblem = source.copy()
    emblem.putalpha(alpha)
    bounds = alpha.getbbox()
    if not bounds:
        raise RuntimeError("Could not isolate the gold emblem.")
    emblem = emblem.crop(bounds)
    available = size - padding * 2
    emblem.thumbnail((available, available), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(
        emblem,
        ((size - emblem.width) // 2, (size - emblem.height) // 2),
    )
    return canvas


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True)


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    emblem = extract_emblem(source, 1024, 120)

    icon = Image.new("RGBA", (1024, 1024), NAVY)
    icon.alpha_composite(extract_emblem(source, 1024, 116))
    save_png(icon, ROOT / "assets" / "icon.png")

    save_png(
        extract_emblem(source, 1024, 190),
        ROOT / "assets" / "android-icon-foreground.png",
    )
    save_png(
        Image.new("RGBA", (1024, 1024), NAVY),
        ROOT / "assets" / "android-icon-background.png",
    )

    monochrome = Image.new("RGBA", emblem.size, (255, 255, 255, 0))
    monochrome.putalpha(emblem.getchannel("A"))
    save_png(monochrome, ROOT / "assets" / "android-icon-monochrome.png")

    save_png(
        extract_emblem(source, 1024, 170),
        ROOT / "assets" / "splash-icon.png",
    )
    save_png(icon.resize((256, 256), Image.Resampling.LANCZOS), ROOT / "assets" / "favicon.png")
    save_png(
        extract_emblem(source, 512, 26),
        BRAND_DIR / "citizens-bible-community-emblem.png",
    )
    icon.convert("RGB").resize((512, 512), Image.Resampling.LANCZOS).save(
        BRAND_DIR / "citizens-bible-community-in-app.jpg",
        "JPEG",
        quality=94,
        optimize=True,
        progressive=False,
    )


if __name__ == "__main__":
    main()
