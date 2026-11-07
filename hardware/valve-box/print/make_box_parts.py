"""
HydroTrack valve box — printable parts generator
================================================
The wall box that drives the motorised ball valve on the house's main pipe.
Builds the four printed parts as watertight solids, writes print-ready STL
files, parts.json (where each STL sits in the assembly) and layout.json (where
every bought part sits), which the 3D viewer reads.

    pip install manifold3d numpy
    python make_box_parts.py

Frame (same as the viewer): X along the wall (right), Y up, Z out of the wall.
Z = 0 is the inside face of the box's back plate. Millimetres.
Parts marked MEASURE: check them with calipers and change the number here.
"""

import base64
import json
import math
import struct
from pathlib import Path

import numpy as np
from manifold3d import CrossSection, Manifold

OUT = Path(__file__).resolve().parent
SEG = 96
CLEAR = 0.3

# ----------------------------------------------------------------------------
# Bought parts (MEASURE the ones marked)
# ----------------------------------------------------------------------------
RELAY = dict(w=38.0, l=51.0, pcb=1.6, h=18.5, hole_dx=32.5, hole_dy=44.0, hole_d=3.1)   # 2-channel 5 V relay module (MEASURE holes)
ESP = dict(w=28.3, l=51.4, pcb=1.6, under=3.5, pins=8.5, jumper=14.0)                  # ESP32 DevKit V1 30-pin, pins up (MEASURE)
BUCK = dict(w=22.0, l=17.0, h=4.0)            # MP1584 mini step-down 12 V -> 5 V
TERM = dict(w=25.4, l=8.0, h=11.0)            # 5-way 5.08 mm screw terminal block for the valve cable
JACK = dict(hole=8.2, body_d=11.0, body_l=14.0, nut_d=12.0)   # panel-mount DC jack 5.5 × 2.1 mm
GLAND = dict(hole=12.7, nut_d=19.0, nut_t=5.0, body_d=15.0, body_l=14.0, cable_d=6.0)   # PG7 cable gland
RING8 = dict(od=32.0, id=18.0, pcb=1.6, led=1.6, n=8)  # WS2812B 8-LED ring (MEASURE)
SWITCH = dict(body=12.0, h=5.0)               # 12 × 12 × 5 mm tactile switch (MEASURE height)
BTNPCB = dict(w=34.0, pcb=1.6, solder=1.5)    # small perfboard behind the button

# ----------------------------------------------------------------------------
# Box
# ----------------------------------------------------------------------------
IN_X, IN_Y0, IN_Y1, DEPTH = 48.0, 0.0, 112.0, 34.0     # cavity: X ±48, Y 0..112, Z 0..34
WALL, BACK, COVER = 2.4, 3.0, 3.0
R_CORNER = 13.0            # outside corner radius (XY)
R_EDGE = 3.0               # rounding of the front and back edges
OUT_X0, OUT_X1 = -IN_X - WALL, IN_X + WALL
OUT_Y0, OUT_Y1 = IN_Y0 - WALL, IN_Y1 + WALL
Z_BACK, Z_FRONT = -BACK, DEPTH + COVER
BOSSES = [(-41.0, 7.0), (41.0, 7.0), (-41.0, 105.0), (41.0, 105.0)]    # cover screws M3
KEYHOLES = [(-32.0, 100.0), (32.0, 100.0)]
HALO_C = (0.0, 92.0)       # centre of the halo ring + button on the front
HALO_RI, HALO_RO = 9.3, 16.5      # the halo ring's bore is also the button's guide
BTN_R = 9.0

# Bought-part positions (box frame)
RELAY_C = (-21.0, 39.5)     # relay module centre, terminals at the bottom edge
Z_RELAY = 5.0               # on 5 mm standoffs
ESP_X0, ESP_Y0 = 6.0, 20.0  # ESP32 lower-left corner, antenna end up
Z_ESP = 5.0
BUCK_C = (0.0, 88.5)
TERM_X0, TERM_Y0 = -40.0, 68.0
JACK_X, JACK_Z = 22.0, 14.0
GLAND_X, GLAND_Z = -21.0, 14.0
Z_BTNPCB = DEPTH - 6.4      # front face of the button perfboard


# ----------------------------------------------------------------------------
# Helpers (box frame = viewer frame)
# ----------------------------------------------------------------------------
def box(x0, x1, y0, y1, z0, z1):
    return Manifold.cube((x1 - x0, y1 - y0, z1 - z0)).translate((x0, y0, z0))


def cyl_z(r, z0, z1, x=0.0, y=0.0, seg=64):
    return Manifold.cylinder(z1 - z0, r, r, seg).translate((x, y, z0))


def cyl_y(r, y0, y1, x=0.0, z=0.0, seg=64):
    """Cylinder along +Y."""
    return Manifold.cylinder(y1 - y0, r, r, seg).rotate((-90, 0, 0)).translate((x, y0, z))


def union(parts):
    out = parts[0]
    for p in parts[1:]:
        out = out + p
    return out


def rrect(x0, x1, y0, y1, r):
    """Rounded rectangle cross-section."""
    return CrossSection.square((x1 - x0 - 2 * r, y1 - y0 - 2 * r)).translate((x0 + r, y0 + r)).offset(r, circular_segments=SEG)


def ext(cs, z0, z1):
    return Manifold.extrude(cs, z1 - z0).translate((0, 0, z0))


def rounded_slab(x0, x1, y0, y1, r, z0, z1, round_front=True, round_back=False, re=R_EDGE):
    """Rounded-rectangle slab with rounded front and/or back edges (hull of tori and prisms)."""
    def torus(z, upper):
        half = CrossSection.circle(re, 24) ^ CrossSection.square((2 * re, re)).translate((-re, 0.0 if upper else -re))
        t = Manifold.revolve(half.translate((r - re, 0)), 48)
        return [t.translate((x, y, z)) for x in (x0 + r, x1 - r) for y in (y0 + r, y1 - r)]
    pieces = []
    zf = z1 - re if round_front else z1
    zb = z0 + re if round_back else z0
    pieces += torus(zf, True) if round_front else [ext(rrect(x0, x1, y0, y1, r), z1 - 0.01, z1)]
    pieces += [ext(rrect(x0 + re, x1 - re, y0 + re, y1 - re, r - re), z0, z0 + 0.01), ext(rrect(x0, x1, y0, y1, r), z0 + re, z0 + re + 0.01)] if round_back \
        else [ext(rrect(x0, x1, y0, y1, r), z0, z0 + 0.01)]
    return Manifold.hull(union(pieces))


# ----------------------------------------------------------------------------
# 1. Box body (back plate + walls), printed back down
# ----------------------------------------------------------------------------
def box_body():
    outer = rounded_slab(OUT_X0, OUT_X1, OUT_Y0, OUT_Y1, R_CORNER, Z_BACK, DEPTH, round_front=False, round_back=True)
    cavity = ext(rrect(-IN_X, IN_X, IN_Y0, IN_Y1, R_CORNER - WALL), 0.0, DEPTH + 1)
    body = outer - cavity
    # Rabbet at the top of the walls for the cover's skirt
    body = body - ext(rrect(-IN_X - 1.0, IN_X + 1.0, IN_Y0 - 1.0, IN_Y1 + 1.0, R_CORNER - WALL + 1.0), DEPTH - 3.0, DEPTH + 1)
    parts = [body]
    # Cover screw bosses
    for x, y in BOSSES:
        parts.append(cyl_z(3.5, -0.01, DEPTH - 3.2, x, y, 32))
    # Relay standoffs
    rx, ry = RELAY_C
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(cyl_z(3.0, -0.01, Z_RELAY, rx + sx * RELAY["hole_dx"] / 2, ry + sy * RELAY["hole_dy"] / 2, 32))
    # ESP32 corner posts: the board's corners sit on them, a 1.2 mm lip around each corner holds it
    foot = box(ESP_X0 - 0.2, ESP_X0 + ESP["w"] + 0.2, ESP_Y0 - 0.2, ESP_Y0 + ESP["l"] + 0.2, Z_ESP, 60)
    for cx in (ESP_X0, ESP_X0 + ESP["w"]):
        for cy in (ESP_Y0, ESP_Y0 + ESP["l"]):
            parts.append(box(cx - 3.0, cx + 3.0, cy - 3.0, cy + 3.0, -0.01, Z_ESP + ESP["pcb"] + 1.2) - foot)
    # Terminal block seat (two low rails)
    parts.append(box(TERM_X0, TERM_X0 + TERM["w"], TERM_Y0 - 1.6, TERM_Y0 - 0.2, -0.01, 3.0))
    parts.append(box(TERM_X0, TERM_X0 + TERM["w"], TERM_Y0 + TERM["l"] + 0.2, TERM_Y0 + TERM["l"] + 1.6, -0.01, 3.0))
    body = union(parts)
    # ---- cuts ----
    for x, y in BOSSES:
        body = body - cyl_z(1.25, 4.0, DEPTH, x, y, 24)                       # M3 self-tapping pilot
    for sx in (-1, 1):
        for sy in (-1, 1):
            body = body - cyl_z(1.25, 0.5, Z_RELAY + 0.1, rx + sx * RELAY["hole_dx"] / 2, ry + sy * RELAY["hole_dy"] / 2, 24)
    # Keyholes for wall screws (head Ø8.5 drops in, slides down onto the Ø4.5 slot)
    for x, y in KEYHOLES:
        body = body - cyl_z(4.3, Z_BACK - 1, 0.01, x, y, 32) - box(x - 2.3, x + 2.3, y - 8.0, y, Z_BACK - 1, 0.01)
        body = body - (cyl_z(4.6, Z_BACK + 1.6, 0.6, x, y - 8.0, 32) + box(x - 4.6, x + 4.6, y - 8.0, y, Z_BACK + 1.6, 0.6))
    # Bottom wall: DC jack and cable gland (drip side)
    body = body - cyl_y(JACK["hole"] / 2, OUT_Y0 - 1, IN_Y0 + 0.5, JACK_X, JACK_Z)
    body = body - cyl_y(GLAND["hole"] / 2, OUT_Y0 - 1, IN_Y0 + 0.5, GLAND_X, GLAND_Z)
    return body


# ----------------------------------------------------------------------------
# 2. Front cover with the halo window and button hole, printed face down
# ----------------------------------------------------------------------------
def box_cover():
    plate = rounded_slab(OUT_X0, OUT_X1, OUT_Y0, OUT_Y1, R_CORNER, DEPTH, Z_FRONT, round_front=True)
    skirt = ext(rrect(-IN_X - 0.75, IN_X + 0.75, IN_Y0 - 0.75, IN_Y1 + 0.75, R_CORNER - WALL + 0.75), DEPTH - 2.8, DEPTH + 0.01) \
        - ext(rrect(-IN_X + 0.6, IN_X - 0.6, IN_Y0 + 0.6, IN_Y1 - 0.6, R_CORNER - WALL - 0.6), DEPTH - 3.0, DEPTH + 0.1)
    cover = plate + skirt
    hx, hy = HALO_C
    # posts for the button perfboard
    for sx, sy in ((-1, -1), (1, 1)):
        cover = cover + cyl_z(2.6, Z_BTNPCB, DEPTH + 0.01, hx + sx * 15.5, hy + sy * 15.5, 24)
    # ---- cuts ----
    cover = cover - cyl_z(HALO_RO + 0.15, DEPTH - 1, Z_FRONT + 1, hx, hy, 96)
    for x, y in BOSSES:
        cover = cover - cyl_z(1.7, DEPTH - 4, Z_FRONT + 1, x, y, 24) - cyl_z(3.1, Z_FRONT - 1.6, Z_FRONT + 1, x, y, 24)   # countersunk-ish
    for sx, sy in ((-1, -1), (1, 1)):
        cover = cover - cyl_z(0.9, Z_BTNPCB - 1, DEPTH - 1.0, hx + sx * 15.5, hy + sy * 15.5, 16)                 # M2 pilot
    # engraved droplet mark under the halo
    drop = CrossSection.circle(2.6, 48).translate((0, 63.0)) + CrossSection.hull(CrossSection([[(-2.25, 64.3), (2.25, 64.3), (0, 69.4)]]))
    cover = cover - ext(drop, Z_FRONT - 0.5, Z_FRONT + 1)
    return cover


# ----------------------------------------------------------------------------
# 3. Halo diffuser ring (natural PETG) and 4. button cap
# ----------------------------------------------------------------------------
def halo_ring():
    hx, hy = HALO_C
    ring = cyl_z(HALO_RO, DEPTH - 0.01, Z_FRONT - 0.3, hx, hy, 96) + cyl_z(HALO_RO + 1.8, DEPTH - 1.6, DEPTH, hx, hy, 96)
    ring = ring - cyl_z(HALO_RI, DEPTH - 2, Z_FRONT + 1, hx, hy, 64)                 # button bore
    ring = ring - cyl_z(BTN_R + 1.6, DEPTH - 2, DEPTH + 0.4, hx, hy, 64)            # pocket for the button's flange
    return ring


def button_cap():
    hx, hy = HALO_C
    cap = Manifold.hull(cyl_z(BTN_R, DEPTH + 0.3, Z_FRONT - 0.2, hx, hy, 64) + cyl_z(BTN_R - 0.8, Z_FRONT + 0.4, Z_FRONT + 0.41, hx, hy, 64))
    cap = cap + cyl_z(BTN_R + 1.3, DEPTH - 0.8, DEPTH + 0.31, hx, hy, 64)
    return cap


# ----------------------------------------------------------------------------
# Layout for the viewer
# ----------------------------------------------------------------------------
WIRES = {
    # valve cable: in through the gland, up to the relay's screw terminals and the terminal block
    "valveCable": dict(r=3.0, color="grey", ends=["gland", "relay"], pts=[(GLAND_X, -2.0, GLAND_Z), (GLAND_X, 3.0, GLAND_Z), (GLAND_X, 9.0, 12.0)]),
    "valveRed": dict(r=0.6, color="red", ends=["relay"], pts=[(GLAND_X - 1.0, 9.0, 12.0), (GLAND_X - 4.0, 11.5, 14.0), (-26.0, 13.0, 14.0)]),
    "valveYellow": dict(r=0.6, color="yellow", ends=["relay", "term"], pts=[(GLAND_X + 1.0, 9.0, 12.0), (-44.0, 14.0, 16.0), (-45.0, 40.0, 16.0), (-44.5, 64.0, 9.0), (-37.5, 70.0, 9.0)]),
    "valveFeedback": dict(r=0.6, color="green", ends=["term", "esp32"], pts=[(-20.0, 72.0, 11.5), (-6.0, 74.0, 20.0), (8.5, 72.5, 24.0), (8.5, 69.0, 28.0)]),
    "relayIn": dict(r=0.7, color="blue", ends=["relay", "esp32"], pts=[(-21.0, 64.0, 28.0), (-8.0, 66.0, 28.0), (3.0, 66.0, 28.0), (8.5, 60.0, 28.0)]),
    "power12": dict(r=0.8, color="red", ends=["jack", "buck"], pts=[(JACK_X, 14.0, JACK_Z), (JACK_X + 6.0, 16.0, 30.0), (40.0, 30.0, 31.0), (40.0, 75.0, 20.0), (12.0, 85.0, 6.0)]),
    "power5": dict(r=0.7, color="black", ends=["buck", "esp32"], pts=[(10.0, 82.0, 5.0), (31.5, 78.0, 18.0), (31.5, 69.0, 28.0)]),
    "halo": dict(r=0.7, color="green", ends=["btnModule", "esp32"], pts=[(-12.0, 80.0, 25.0), (12.0, 75.0, 27.0), (20.0, 69.0, 28.5)]),
}


def layout():
    return dict(
        IN_X=IN_X, IN_Y0=IN_Y0, IN_Y1=IN_Y1, DEPTH=DEPTH, WALL=WALL, BACK=BACK, COVER=COVER, R_CORNER=R_CORNER,
        OUT=[OUT_X0, OUT_X1, OUT_Y0, OUT_Y1, Z_BACK, Z_FRONT], BOSSES=BOSSES, KEYHOLES=KEYHOLES,
        HALO_C=HALO_C, HALO_RI=HALO_RI, HALO_RO=HALO_RO, BTN_R=BTN_R,
        RELAY=RELAY, RELAY_C=RELAY_C, Z_RELAY=Z_RELAY, ESP=ESP, ESP_X0=ESP_X0, ESP_Y0=ESP_Y0, Z_ESP=Z_ESP,
        BUCK=BUCK, BUCK_C=BUCK_C, TERM=TERM, TERM_X0=TERM_X0, TERM_Y0=TERM_Y0,
        JACK=JACK, JACK_X=JACK_X, JACK_Z=JACK_Z, GLAND=GLAND, GLAND_X=GLAND_X, GLAND_Z=GLAND_Z,
        RING8=RING8, SWITCH=SWITCH, BTNPCB=BTNPCB, Z_BTNPCB=Z_BTNPCB,
        WIRES={k: dict(r=v["r"], color=v["color"], ends=v["ends"], pts=[list(map(float, p)) for p in v["pts"]]) for k, v in WIRES.items()})


# ----------------------------------------------------------------------------
# Export
# ----------------------------------------------------------------------------
# id, file, builder, flip for printing (face down), label
PARTS = [
    ("body", "01_box_body.stl", box_body, False, "Valve box body"),
    ("cover", "02_box_cover.stl", box_cover, True, "Valve box front cover"),
    ("halo", "03_halo_ring.stl", halo_ring, False, "Halo ring (natural PETG)"),
    ("button", "04_button_cap.stl", button_cap, False, "Button cap"),
]


def write_stl(path, solid, name):
    mesh = solid.to_mesh()
    v = np.asarray(mesh.vert_properties)[:, :3].astype(np.float32)
    t = np.asarray(mesh.tri_verts).astype(np.int64)
    tri = v[t]
    n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
    with open(path, "wb") as f:
        f.write(name.encode()[:80].ljust(80, b" "))
        f.write(struct.pack("<I", len(t)))
        rec = np.zeros(len(t), dtype=[("n", "<f4", 3), ("v", "<f4", (3, 3)), ("a", "<u2")])
        rec["n"], rec["v"] = n.astype(np.float32), tri
        f.write(rec.tobytes())
    return len(t)


def build_all():
    return {pid: fn() for pid, _, fn, _, _ in PARTS}


def main():
    manifest = []
    for pid, fname, fn, flip, label in PARTS:
        solid = fn()
        R = np.diag([1.0, -1.0, -1.0, 1.0]) if flip else np.eye(4)
        oriented = solid.transform(R[:3, :4]) if flip else solid
        bb = oriented.bounding_box()
        shift = np.eye(4)
        shift[2, 3] = -bb[2]
        printed = oriented.translate((0, 0, -bb[2]))
        tris = write_stl(OUT / fname, printed, f"HydroTrack {label}")
        to_model = np.linalg.inv(shift @ R)
        manifest.append({"id": pid, "file": fname, "label": label, "matrix": [round(float(x), 6) for x in to_model.T.flatten()]})
        b = printed.bounding_box()
        bodies = len(printed.decompose())
        assert bodies == 1, f"{fname} has {bodies} separate bodies"
        print(f"{fname:22s} {tris:7d} tris  vol {printed.volume() / 1000:6.1f} cm³  bodies {bodies}  "
              f"size {b[3] - b[0]:.1f} × {b[4] - b[1]:.1f} × {b[5] - b[2]:.1f} mm")
    (OUT / "parts.json").write_text(json.dumps({"units": "mm", "parts": manifest}, indent=1))
    (OUT / "layout.json").write_text(json.dumps(layout(), indent=1))
    bundle = {name: base64.b64encode((OUT / name).read_bytes()).decode()
              for name in ["parts.json", "layout.json"] + [f for _, f, _, _, _ in PARTS]}
    (OUT / "stl-bundle.json").write_text(json.dumps(bundle))


if __name__ == "__main__":
    main()
