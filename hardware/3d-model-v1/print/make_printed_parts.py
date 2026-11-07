"""
HydroTrack v3.0 — printable parts generator
===========================================
Builds the five 3D-printed parts of the "real parts" prototype as watertight
solids and writes print-ready STL files (already oriented for printing, no
supports needed) plus parts.json, which the 3D viewer uses to put each STL back
in its assembled position.

    pip install manifold3d numpy
    python make_printed_parts.py

All sizes are millimetres. Measure the parts marked MEASURE when they arrive,
change the value here and run the script again.

Coordinate frame used below (assembly frame): Z is up along the tap axis,
Z = 0 is the bottom face of the device. "Model angle" a is measured in the
3D viewer's x-z plane; a point at model angle a is at (r·cos a, −r·sin a) here.
"""

import base64
import json
import math
import struct
from pathlib import Path

import numpy as np
from manifold3d import CrossSection, Manifold

OUT = Path(__file__).resolve().parent

# ----------------------------------------------------------------------------
# Parameters
# ----------------------------------------------------------------------------
SEG = 160                  # facets on large circles

# Fit clearances for printed PETG
CLEAR_THREAD = 0.30        # radial clearance on the printed G½ female thread
CLEAR_SLIP = 0.15          # radial clearance for slip fits

# Bought parts (MEASURE the ones marked)
G12_MAJOR = 20.955         # G½ (BSPP) thread on the YF-S201C
G12_PITCH = 25.4 / 14
G12_DEPTH = 0.640327 * G12_PITCH
INSERT_D, INSERT_H = 21.0, 13.0      # Neoperl M22 laminar insert (MEASURE)
PROBE_D = 12.0                       # TDS probe head diameter (MEASURE)
PROBE_R = 16.5                       # probe axis distance from the centre
NTC_D = 5.0                          # NTC probe tip
QUARTZ_D, QUARTZ_T = 6.0, 1.0        # fused-quartz window disc
UV_LED = 3.5                         # 3535 UV-C LED body
ORING_ID, ORING_CS = 48.0, 1.5       # chamber lid face seal: 48 × 1.5 mm nitrile
M2_PILOT, M2_CLEAR = 1.7, 2.2        # self-tapping M2 into PETG / clearance

# Assembly heights (Z) — keep in step with hydrotrack-model.js
Z_DIFF_TOP = 2.0           # top of the diffuser base
Z_FLOOR_BOT, Z_FLOOR_TOP = 5.5, 9.0
Z_RIM = 51.0               # cup rim = lid underside
Z_LID_TOP = 54.0
Z_BOSS_TOP = 62.0
Z_CARRIER_TOP = 56.0
Z_SLEEVE_BOT, Z_SLEEVE_TOP = 8.0, 104.0
Z_CAP_PLATE, Z_TOP = 120.0, 123.0

R_OUT = 31.75              # outside of the 63.5 mm aluminium tube
R_SLEEVE_IN = 30.15        # inside of the tube (1.6 mm wall)
R_CUP_OUT, R_CUP_IN = 27.0, 24.0

SCREW_ANGLES = (0, 110, 250)   # chamber screws, model angles
SCREW_R = 28.0
CHANNELS = {90: (33.0, Z_RIM + 0.5), 180: (Z_FLOOR_BOT - 0.5, Z_RIM + 0.5)}  # wire channels: angle -> (z0, z1)
UV_ANGLES = (45, 135, 225, 315)
UV_Z = 30.0
NTC_ANGLE = 90


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def at(r, a):
    """Assembly-frame XY of a point at model angle a (degrees), radius r."""
    t = math.radians(a)
    return (r * math.cos(t), -r * math.sin(t))


def cyl(r, z0, z1, x=0.0, y=0.0, seg=SEG):
    return Manifold.cylinder(z1 - z0, r, r, seg).translate((x, y, z0))


def ring(ro, ri, z0, z1, seg=SEG):
    return cyl(ro, z0, z1, seg=seg) - cyl(ri, z0 - 0.01, z1 + 0.01, seg=seg)


def box(x0, x1, y0, y1, z0, z1):
    return Manifold.cube((x1 - x0, y1 - y0, z1 - z0)).translate((x0, y0, z0))


def radial(solid, a):
    """Rotate a feature built along +X to model angle a."""
    return solid.rotate((0, 0, -a))


def cyl_x(r, x0, x1, z, seg=64):
    """Cylinder along +X from x0 to x1, centred at height z."""
    return Manifold.cylinder(x1 - x0, r, r, seg).rotate((0, 90, 0)).translate((x0, 0, z))


def revolve(points, seg=SEG, degrees=360.0):
    """Revolve a (radius, z) outline about Z (either winding order)."""
    area = sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(points, points[1:] + points[:1]))
    return Manifold.revolve(CrossSection([points if area > 0 else points[::-1]]), seg, degrees)


def union(parts):
    out = parts[0]
    for p in parts[1:]:
        out = out + p
    return out


def thread_solid(r_major, r_minor, pitch, z0, length, per_turn=96):
    """Right-hand ISO-style truncated thread as a solid (crest P/6, root P/6)."""
    h = r_major - r_minor

    def profile(u):
        u %= pitch
        if u < pitch / 6:
            return r_major
        if u < pitch / 2:
            return r_major - h * (u - pitch / 6) / (pitch / 3)
        if u < 2 * pitch / 3:
            return r_minor
        return r_minor + h * (u - 2 * pitch / 3) / (pitch / 3)

    pts = []
    for i in range(per_turn):
        th = 2 * math.pi * i / per_turn
        r = profile(-pitch * th / (2 * math.pi))
        pts.append((r * math.cos(th), r * math.sin(th)))
    turns = length / pitch
    return Manifold.extrude(CrossSection([pts]), length, int(turns * per_turn / 2), 360.0 * turns).translate((0, 0, z0))


def g12_female_hole(z0, z1):
    """Printed G½ female thread from z0 to z1 with a lead-in chamfer at z1."""
    rM = G12_MAJOR / 2 + CLEAR_THREAD
    rm = G12_MAJOR / 2 - G12_DEPTH + CLEAR_THREAD
    hole = thread_solid(rM, rm, G12_PITCH, z0 - 1.0, (z1 - z0) + 2.0)
    lead_in = Manifold.cylinder(1.0, rm, rM + 0.6, SEG).translate((0, 0, z1 - 1.0 + 0.001))
    return hole + lead_in


# ----------------------------------------------------------------------------
# Parts
# ----------------------------------------------------------------------------
def chamber_cup():
    outer = cyl(R_CUP_OUT, Z_FLOOR_BOT, Z_RIM)
    # Cavity with a 1 mm inward ledge at the rim (seal land), chamfered for printing
    cavity = revolve([(0, Z_FLOOR_TOP), (R_CUP_IN, Z_FLOOR_TOP), (R_CUP_IN, Z_RIM - 3.0),
                      (R_CUP_IN - 1.0, Z_RIM - 2.0), (R_CUP_IN - 1.0, Z_RIM + 1.0), (0, Z_RIM + 1.0)])
    # Screw columns outside the wall, 45° chamfer underneath so they print without support
    cols = [Manifold.hull(cyl(2.0, 40.0, Z_RIM, *at(SCREW_R, a), seg=48) +
                          cyl(2.0, 37.5, Z_RIM, *at(SCREW_R - 2.5, a), seg=48)) for a in SCREW_ANGLES]
    cup = union([outer] + cols) - cavity

    # Insert boss rising from the floor (the bore is cut after the probe clip is added)
    r_bore = INSERT_D / 2 + CLEAR_SLIP
    cup = cup + ring(r_bore + 2.0, r_bore, Z_FLOOR_TOP - 0.01, 6.5 + INSERT_H)

    # TDS probe snap clip (C-shape, open towards the centre), tied to the wall
    pc = at(PROBE_R, 270)
    rc_in = PROBE_D / 2 + 0.2
    clip = cyl(rc_in + 1.3, Z_FLOOR_TOP - 0.01, 44.0, *pc, seg=64) - cyl(rc_in, Z_FLOOR_TOP - 0.1, 44.1, *pc, seg=64)
    clip = clip - box(pc[0] - 3.5, pc[0] + 3.5, pc[1] - rc_in - 2.0, pc[1], Z_FLOOR_TOP - 0.1, 44.1)
    bridge = box(pc[0] - 2.0, pc[0] + 2.0, pc[1] + rc_in + 0.5, R_CUP_IN + 0.5, Z_FLOOR_TOP - 0.01, 44.0)
    cup = cup + clip + bridge
    cup = cup - cyl(rc_in, 18.5, Z_RIM + 1.0, *pc, seg=64)            # room for the probe head beside the boss
    # Insert bore with a 1 mm retaining lip at the bottom
    cup = cup - cyl(r_bore, 6.5, 6.5 + INSERT_H + 0.1) - cyl(8.5, Z_FLOOR_BOT - 0.1, 6.6)

    # Wire channels on the outside wall
    for a, (z0, z1) in CHANNELS.items():
        cup = cup - radial(box(26.3, 29.0, -1.8, 1.8, z0, z1), a)

    # UV-C windows: flat land for the LED board, LED pocket, quartz seat, light hole
    land_d = 26.7
    for a in UV_ANGLES:
        f = (box(land_d, 33.0, -6.0, 6.0, UV_Z - 6.0, UV_Z + 6.0)
             + box(land_d - 1.1, land_d + 0.1, -(UV_LED + 0.4) / 2, (UV_LED + 0.4) / 2,
                   UV_Z - (UV_LED + 0.4) / 2, UV_Z + (UV_LED + 0.4) / 2)
             + cyl_x(QUARTZ_D / 2 + 0.15, land_d - 1.1 - QUARTZ_T - 0.05, land_d - 1.0, UV_Z)
             + cyl_x(2.25, R_CUP_IN - 1.0, land_d - 2.0, UV_Z))
        cup = cup - radial(f, a)

    # Thermistor port
    cup = cup - radial(cyl_x(NTC_D / 2 + 0.1, R_CUP_IN - 1.0, R_CUP_OUT + 1.0, UV_Z), NTC_ANGLE)

    # Pilot holes (M2 self-tapping) and diffuser peg holes in the floor
    for a in SCREW_ANGLES:
        cup = cup - cyl(M2_PILOT / 2, 43.0, Z_RIM + 0.1, *at(SCREW_R, a), seg=32)
    for a in (30, 150, 270):
        cup = cup - cyl(1.55, Z_FLOOR_BOT - 0.1, 8.0, *at(25.0, a), seg=32)
    return cup


def chamber_lid():
    lid = cyl(R_SLEEVE_IN - 0.15, Z_RIM, Z_LID_TOP) + cyl(13.0, Z_LID_TOP - 0.01, Z_BOSS_TOP)
    lid = lid - g12_female_hole(Z_RIM, Z_BOSS_TOP)
    # O-ring face groove on the underside
    r_c = ORING_ID / 2 + ORING_CS / 2  # O-ring centre-line radius
    lid = lid - ring(r_c + 0.95, r_c - 0.95, Z_RIM - 0.1, Z_RIM + 1.1)
    for a in SCREW_ANGLES:
        lid = lid - cyl(M2_CLEAR / 2, Z_RIM - 0.1, Z_LID_TOP + 0.1, *at(SCREW_R, a), seg=32)
    for a in CHANNELS:
        lid = lid - radial(box(26.3, 32.0, -2.2, 2.2, Z_RIM - 0.1, Z_LID_TOP + 0.1), a)
    lid = lid - cyl(2.25, Z_RIM - 0.1, Z_LID_TOP + 0.1, *at(PROBE_R, 270), seg=32)  # probe cable
    return lid


def halo_diffuser():
    d = ring(R_OUT, 13.25, 0.0, Z_DIFF_TOP) + ring(R_OUT, 29.5, Z_DIFF_TOP - 0.01, Z_SLEEVE_BOT)
    d = d - ring(22.6, 15.6, 1.0, Z_DIFF_TOP + 0.1)          # pocket for the LED ring (LEDs face down)
    for a in (45, 145, 305):                                   # tabs that locate the sleeve
        tab = Manifold.revolve(CrossSection.square((1.4, 4.0)).translate((28.6, Z_SLEEVE_BOT - 0.01)), 24, 16.0)
        d = d + tab.rotate((0, 0, -a - 8.0))
    for a in (30, 150, 270):                                   # pegs into the cup floor
        x, y = at(25.0, a)
        d = d + cyl(2.25, Z_DIFF_TOP - 0.01, Z_FLOOR_BOT, x, y, seg=32) + cyl(1.4, Z_FLOOR_BOT - 0.01, 7.8, x, y, seg=32)
    return d


def electronics_carrier():
    z0 = Z_LID_TOP
    base = ring(29.8, 13.4, z0, Z_CARRIER_TOP)
    for a in CHANNELS:
        base = base - radial(box(26.3, 32.0, -2.2, 2.2, z0 - 0.1, Z_CARRIER_TOP + 0.1), a)
    for a in SCREW_ANGLES:
        base = base - cyl(1.2, z0 - 0.1, Z_CARRIER_TOP + 0.1, *at(SCREW_R, a), seg=32)
    px, py = at(PROBE_R, 270)  # probe cable: a slot open to the inner edge, so no thin sliver is left
    base = base - cyl(3.0, z0 - 0.1, Z_CARRIER_TOP + 0.1, px, py, seg=32) - box(px - 3.0, px + 3.0, 12.0, py, z0 - 0.1, Z_CARRIER_TOP + 0.1)

    zt = Z_CARRIER_TOP - 0.01
    # Panel A: battery back-plate (battery sits between it and the ESP32 rails)
    panel_a = box(-14.4, -13.6, -15.0, 15.0, zt, 112.0)
    # ESP32 rails: C-channels the bare DevKit slides into from above
    rails = []
    for s in (-1, 1):
        y0, y1 = sorted((s * 12.2, s * 15.2))
        rail = box(-23.6, -19.6, y0, y1, zt, 118.0)
        sy0, sy1 = sorted((s * 12.1, s * 12.8))
        rails.append(rail - box(-22.7, -20.9, sy0, sy1, zt - 0.1, 118.1))
    # Panel B (-z side of the model, +Y here): TDS board, with a gap for the probe cable
    panel_b = box(-14.0, 14.0, 17.6, 18.4, zt, 104.0) - box(-4.0, 4.0, 17.5, 18.5, zt - 0.1, 62.0)
    # Panel C (+z side of the model): power board and TP4056
    panel_c = box(-11.0, 11.0, -18.0, -17.2, zt, 114.0)
    return union([base, panel_a, panel_b, panel_c] + rails)


def top_cap():
    # One revolved profile: top plate, radio band, sleeve seat, 45° shoulder, spigot into the sleeve
    cap = revolve([(11.3, Z_TOP), (11.3, Z_CAP_PLATE), (R_SLEEVE_IN, Z_CAP_PLATE), (R_SLEEVE_IN, Z_SLEEVE_TOP + 1.6),
                   (28.6, Z_SLEEVE_TOP + 0.05), (28.6, 100.0), (R_SLEEVE_IN - 0.1, 100.0),
                   (R_SLEEVE_IN - 0.1, Z_SLEEVE_TOP), (R_OUT, Z_SLEEVE_TOP), (R_OUT, Z_TOP)])
    ux, uy = at(21.2, 90)
    cap = cap - box(ux - 4.8, ux + 4.8, uy - 1.9, uy + 1.9, Z_CAP_PLATE - 0.1, Z_TOP + 0.1)       # USB-C opening
    cap = cap - box(ux - 6.5, ux + 6.5, uy - 3.75, uy + 3.75, Z_TOP - 1.5, Z_TOP + 0.1)            # plug pocket
    return cap


# ----------------------------------------------------------------------------
# Export
# ----------------------------------------------------------------------------
# id, file, builder, flip for printing, what it is
PARTS = [
    ("chamber", "01_chamber_cup.stl", chamber_cup, False, "Sensor & UV-C chamber cup"),
    ("lid", "02_chamber_lid.stl", chamber_lid, False, "Chamber lid with G½ thread"),
    ("diffuser", "03_halo_diffuser.stl", halo_diffuser, False, "Halo diffuser (natural/clear PETG)"),
    ("carrier", "04_electronics_carrier.stl", electronics_carrier, False, "Electronics carrier"),
    ("topCap", "05_top_cap.stl", top_cap, True, "Top cap + radio window band"),
]

# Assembly frame (Z up) -> 3D viewer frame (Y up): x' = x, y' = z, z' = -y
A_TO_MODEL = np.array([[1, 0, 0, 0], [0, 0, 1, 0], [0, -1, 0, 0], [0, 0, 0, 1]], float)


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


def main():
    manifest = []
    built = {}
    for pid, fname, fn, flip, label in PARTS:
        solid = fn()
        built[pid] = solid
        R = np.diag([1.0, -1.0, -1.0, 1.0]) if flip else np.eye(4)
        oriented = solid.transform(R[:3, :4]) if flip else solid
        (x0, y0, z0, x1, y1, z1) = oriented.bounding_box()
        shift = np.eye(4)
        shift[2, 3] = -z0
        printed = oriented.translate((0, 0, -z0))
        tris = write_stl(OUT / fname, printed, f"HydroTrack {label}")
        # print frame -> assembly frame -> viewer frame
        to_model = A_TO_MODEL @ np.linalg.inv(shift @ R)
        manifest.append({"id": pid, "file": fname, "label": label,
                         "matrix": [round(float(x), 6) for x in to_model.T.flatten()]})
        bb = printed.bounding_box()
        bodies = len(printed.decompose())
        assert bodies == 1, f"{fname} has {bodies} separate bodies"
        print(f"{fname:30s} {tris:7d} tris  vol {printed.volume() / 1000:6.1f} cm³  bodies {bodies}  holes {printed.genus():2d}  "
              f"size {bb[3] - bb[0]:.1f} × {bb[4] - bb[1]:.1f} × {bb[5] - bb[2]:.1f} mm")
    (OUT / "parts.json").write_text(json.dumps({"units": "mm", "parts": manifest}, indent=1))
    # The web viewer can't be served .stl files, so it reads them from one JSON bundle
    bundle = {name: base64.b64encode((OUT / name).read_bytes()).decode()
              for name in ["parts.json"] + [f for _, f, _, _, _ in PARTS]}
    (OUT / "stl-bundle.json").write_text(json.dumps(bundle))
    return built


if __name__ == "__main__":
    main()
