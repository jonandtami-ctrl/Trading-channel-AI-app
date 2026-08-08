"""Generates simple PNG app icons (no external deps): a dark gradient
panel with two horizontal support/resistance lines and a zigzag price
path bouncing between them, plus a rounded-rect background band so it
reads as a real app icon rather than a flat sketch.
"""
import struct
import zlib
import os

BG_TOP = (12, 17, 26)
BG_BOTTOM = (8, 11, 17)
PANEL = (19, 26, 38)
LINE = (88, 166, 255)
PRICE = (63, 185, 80)

def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

def make_icon(size, margin_scale=1.0):
    px = [[lerp(BG_TOP, BG_BOTTOM, y / (size - 1)) for _ in range(size)] for y in range(size)]

    def set_px(x, y, color, w=1):
        for dx in range(-(w // 2), w - w // 2):
            for dy in range(-(w // 2), w - w // 2):
                xx, yy = x + dx, y + dy
                if 0 <= xx < size and 0 <= yy < size:
                    px[yy][xx] = color

    def line(x0, y0, x1, y1, color, w=2):
        steps = max(round(abs(x1 - x0)), round(abs(y1 - y0)), 1)
        for i in range(steps + 1):
            t = i / steps
            x = round(x0 + (x1 - x0) * t)
            y = round(y0 + (y1 - y0) * t)
            set_px(x, y, color, w)

    def fill_rect(x0, y0, x1, y1, color):
        for y in range(round(y0), round(y1)):
            for x in range(round(x0), round(x1)):
                if 0 <= x < size and 0 <= y < size:
                    px[y][x] = color

    # rounded-feeling inner panel (corners left square; masked round by the OS anyway)
    panel_margin = size * 0.08
    fill_rect(panel_margin, panel_margin, size - panel_margin, size - panel_margin, PANEL)

    margin = size * 0.22 * margin_scale
    top = size * 0.5 - (size * 0.16)
    bottom = size * 0.5 + (size * 0.16)
    lw = max(2, round(size * 0.016))

    # support / resistance lines
    line(margin, top, size - margin, top, LINE, lw)
    line(margin, bottom, size - margin, bottom, LINE, lw)

    # zigzag price path bouncing between them
    pts_x = [margin, margin + (size - 2 * margin) * 0.18, margin + (size - 2 * margin) * 0.36,
              margin + (size - 2 * margin) * 0.54, margin + (size - 2 * margin) * 0.72,
              margin + (size - 2 * margin) * 0.9]
    pts_y = [size * 0.5, top + lw * 2, bottom - lw * 2, top + lw * 2, bottom - lw * 2, size * 0.42]
    pw = max(3, round(size * 0.026))
    for i in range(len(pts_x) - 1):
        line(pts_x[i], pts_y[i], pts_x[i + 1], pts_y[i + 1], PRICE, pw)

    return px

def write_png(path, px):
    size = len(px)
    raw = bytearray()
    for row in px:
        raw.append(0)  # no filter
        for (r, g, b) in row:
            raw += bytes((r, g, b, 255))

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    png = sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')

    with open(path, 'wb') as f:
        f.write(png)

if __name__ == '__main__':
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'assets')
    os.makedirs(out_dir, exist_ok=True)
    write_png(os.path.join(out_dir, 'icon.png'), make_icon(1024))
    write_png(os.path.join(out_dir, 'adaptive-icon.png'), make_icon(1024, margin_scale=2.2))
    write_png(os.path.join(out_dir, 'splash-icon.png'), make_icon(400))
    print('wrote icon.png, adaptive-icon.png, splash-icon.png')
