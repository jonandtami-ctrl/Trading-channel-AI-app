"""Generates simple PNG app icons (no external deps) for the PWA manifest
and iOS home-screen icon: a dark panel with two horizontal support/resistance
lines and a zigzag price path bouncing between them.
"""
import struct
import zlib
import os

BG = (10, 14, 20)
LINE = (88, 166, 255)
PRICE = (63, 185, 80)

def make_icon(size):
    px = [[BG for _ in range(size)] for _ in range(size)]

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

    margin = size * 0.18
    top = size * 0.32
    bottom = size * 0.68
    lw = max(2, round(size * 0.018))

    # support / resistance lines
    line(margin, top, size - margin, top, LINE, lw)
    line(margin, bottom, size - margin, bottom, LINE, lw)

    # zigzag price path bouncing between them
    pts_x = [margin, margin + (size - 2 * margin) * 0.18, margin + (size - 2 * margin) * 0.36,
              margin + (size - 2 * margin) * 0.54, margin + (size - 2 * margin) * 0.72,
              margin + (size - 2 * margin) * 0.9]
    pts_y = [size * 0.5, top + lw * 2, bottom - lw * 2, top + lw * 2, bottom - lw * 2, size * 0.42]
    pw = max(3, round(size * 0.028))
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
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'public')
    os.makedirs(out_dir, exist_ok=True)
    for size, name in [(192, 'icon-192.png'), (512, 'icon-512.png'), (180, 'apple-touch-icon.png')]:
        write_png(os.path.join(out_dir, name), make_icon(size))
        print('wrote', name)
