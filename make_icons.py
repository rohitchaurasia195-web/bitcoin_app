import struct
import zlib

ORANGE = (247, 147, 26)
WHITE = (255, 255, 255)
LINE = [(0.20, 0.68), (0.36, 0.50), (0.48, 0.60), (0.64, 0.34), (0.80, 0.24)]
BASE = [(0.20, 0.80), (0.80, 0.80)]


def distance(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    cx, cy = ax + t * dx, ay + t * dy
    return ((px - cx) ** 2 + (py - cy) ** 2) ** 0.5


def cover(px, py, points, half):
    best = min(distance(px, py, *points[i], *points[i + 1]) for i in range(len(points) - 1))
    return max(0.0, min(1.0, half - best + 0.5))


def chunk(kind, data):
    body = kind + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


def make(size):
    line = [(x * size, y * size) for x, y in LINE]
    base = [(x * size, y * size) for x, y in BASE]
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            a = max(cover(x + 0.5, y + 0.5, line, size * 0.035), cover(x + 0.5, y + 0.5, base, size * 0.016))
            rows.extend(int(o + (w - o) * a) for o, w in zip(ORANGE, WHITE))
    header = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(bytes(rows), 9)) + chunk(b"IEND", b"")
    with open(f"icon-{size}.png", "wb") as f:
        f.write(png)
    print(f"icon-{size}.png written")


make(192)
make(512)
