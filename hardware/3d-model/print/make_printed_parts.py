"""
HydroTrack v3.1 — printable parts generator (final compact design)
==================================================================
Builds the five 3D-printed parts as watertight solids, writes print-ready STL
files (already oriented for printing, no supports needed), parts.json (where
each STL sits in the assembly) and layout.json (where every bought part sits),
which the 3D viewer reads so the printed and bought parts always agree.

    pip install manifold3d numpy
    python make_printed_parts.py

All sizes are millimetres. Parts marked MEASURE: check them with calipers when
you have the part in hand, change the number here and run the script again.

Frames
------
"Model frame" (used for every number below and by the 3D viewer):
    X = east, Y = up, Z = north. Y = 0 is the bottom face of the device.
    The flow sensor's turbine drum points east-west, its hall cap faces east.
    A "model angle" a is measured from +X towards +Z.
manifold3d builds with Z up, so solids are made in the "assembly frame"
(x, y, z)_asm = (x, -z, y)_model and converted at export.
"""

import base64
import json
import math
import struct
from pathlib import Path

import numpy as np
from manifold3d import CrossSection, Manifold

OUT = Path(__file__).resolve().parent
SEG = 128                  # facets on large circles

# ----------------------------------------------------------------------------
# Fit clearances for printed PETG
# ----------------------------------------------------------------------------
CLEAR_THREAD = 0.30        # radial clearance on the printed G½ female thread
CLEAR = 0.40               # general clearance around bought parts

# ----------------------------------------------------------------------------
# Bought parts (MEASURE the ones marked)
# ----------------------------------------------------------------------------
G12_MAJOR = 20.955                      # G½ (BSPP) thread
G12_PITCH = 25.4 / 14
G12_DEPTH = 0.640327 * G12_PITCH

SENSOR = dict(                          # YF-S201: listed 62 × 36 × 35 mm (MEASURE drum Ø and length)
    length=63.5, thread=11.0, r_tube=12.5, bore=11.0,
    drum_r=17.5, drum_x0=-12.5, drum_x1=17.0,      # turbine housing, axis east-west
    cap_r=11.0, cap_x1=23.0)                       # black hall-sensor cap on the east end
INSERT_D, INSERT_H = 21.0, 13.0         # Neoperl laminar insert (MEASURE)
PROBE = dict(d=12.0, head=32.0, needle=8.0, needle_gap=5.0, relief_d=6.0)   # DFRobot TDS probe (MEASURE)
NTC = dict(d=5.0, length=25.0)          # 10K NTC, steel tip
UV = dict(board=8.0, board_t=1.0, led=3.5, led_t=2.0, quartz_d=6.0, quartz_t=1.0)   # UV-C LED on a small board (MEASURE)
RING = dict(od=44.5, id=31.75, pcb=1.6, led=1.6, n=16)                          # WS2812B 16-LED ring
DEVKIT = dict(w=25.5, l=62.7, pcb=1.6, module_t=3.3, stub=1.5)                  # ESP32-S3 DevKitC-1 clone (MEASURE)
TDSB = dict(w=32.0, l=42.0, pcb=1.6, comp=3.5)  # DFRobot TDS board, plug sockets removed
BATT = dict(t=8.0, w=34.0, l=50.0, pcm=4.0)     # 803450 LiPo, ~1500 mAh (MEASURE when bought)
TP = dict(w=17.0, l=28.0, pcb=1.6, comp=1.6, usb_w=9.0, usb_t=3.2, usb_l=7.4, usb_over=0.8)   # TP4056 USB-C (MEASURE)
PERF = dict(w=30.0, l=18.0, pcb=1.6, comp=5.0)  # power & signal perfboard
UVDRV = dict(w=17.0, l=11.0, t=4.0)             # small UV-C boost driver (assumed)
ADAPTER = dict(socket_r=13.0, hex_af=27.0, hex_h=5.0, m22_r=11.0, m22_len=9.0)  # brass M22 × G½ (MEASURE hex)
ORING = dict(id=45.0, cs=1.5)           # chamber lid face seal, nitrile 45 × 1.5
SCREW = dict(clear=2.9, pilot=2.0, head_d=5.0, head_h=1.6)   # M2.5 × 12 self-tapping pan head

# ----------------------------------------------------------------------------
# Layout (model frame, mm)
# ----------------------------------------------------------------------------
R_OUT = 30.5               # body outside radius  -> Ø61
R_IN = 28.7                # body inside radius (1.8 mm wall)
R_PART = 28.3              # nothing inside may go past this radius

Y_PLATE = 1.6              # top of the diffuser's bottom plate
Y_RING_LED, Y_RING_PCB, Y_RING_TOP = 1.8, 3.4, 5.0
Y_FLOOR_BOT, Y_FLOOR_TOP = 5.2, 7.6
Y_LIP = 0.6                # insert sits on a lip at the outlet
Y_INSERT_TOP = Y_LIP + INSERT_H
Y_PROBE = 21.6             # TDS probe axis height (it lies north-south across the chamber)
Y_UV = 11.6                # UV-C windows
Y_LID_BOT, Y_LID_TOP = 30.6, 33.1
Y_S = 31.1                 # bottom of the flow sensor
SENSOR_PLAY = 1.0          # the sensor may sit up to 1 mm higher or lower, so it can be turned until it lines up
Y_BOSS_TOP = Y_S + SENSOR["thread"] - SENSOR_PLAY   # shoulder clears the boss by 0-2 mm
Y_CAGE_TOP = 34.7
Y_DRUM = Y_S + SENSOR["length"] / 2                 # drum centre height
Y_SENSOR_TOP = Y_S + SENSOR["length"]
Y_HEX_BOT = Y_SENSOR_TOP + 0.5
Y_HEX_TOP = Y_HEX_BOT + ADAPTER["hex_h"]
Y_TOP = Y_HEX_TOP + 1.6                             # top face of the body
Y_SHELL_BOT = 7.5
Y_BAND_TOP = 6.0           # glowing band at the bottom

R_CIN, R_COUT = 22.0, 24.5                          # chamber cup inside / outside
FLAT_OUT, FLAT_IN, FLAT_HALF = -22.8, -20.8, 10.0   # west flat on the cup for the charger board
Y_FLAT_TOP = 29.4

UV_ANGLES = (0, 120, 240)
UV_PAD_D = 25.2            # outer face of the UV-C pads (LED board sits on it)
SCREW_ANGLES = (0, 140, 220)
SCREW_R = 25.8
PEG_ANGLES = (30, 150, 270)
PEG_R = 14.0
NOTCHES = {90: 5.0, 60: 4.0, 270: 5.0, 180: 11.0, 345: 7.0}   # wire notches: angle -> width
NTC_X = 12.0
# Screw-in outlet cap (holds the laminar insert, unscrews from below for cleaning)
CAP_THREAD = dict(major=27.0, pitch=2.0, y0=Y_FLOOR_BOT, y1=Y_FLOOR_BOT + 7.0)
CAP_FLANGE_R, CAP_FLANGE_H = 15.2, 0.8
Y_SEAT = Y_INSERT_TOP - 0.2       # insert's top washer seals against this shoulder
R_BOSS = CAP_THREAD["major"] / 2 + CLEAR_THREAD + 1.8

# The sensor's footprint seen from above (the electronics cage is lowered over it)
FOOTPRINT = [(-13.6, 17.8, -18.2, 18.2), (17.8, 24.2, -12.0, 12.0)]   # (x0, x1, z0, z1) model

# Electronics positions (model)
DK_Z0 = 18.3               # DevKit: header-stub side faces the drum
DK_Y0 = Y_CAGE_TOP + 0.8
TDS_Z0 = -18.3             # TDS board: back taped to the drum, parts face out
TDS_Y0 = Y_CAGE_TOP + 0.2
BAT_X0 = -13.8             # battery inner face (piezo is at -13.0)
Y_SHELF = 38.0
TP_X0 = -23.1              # charger board inner face (on the cup's west flat)
Y_TP_USB = 0.4             # USB-C opening is 0.4 mm up inside the bottom face
PERF_X0 = 19.0
Y_PERF0 = Y_DRUM + SENSOR["cap_r"] + 2.3
UVDRV_X0 = 19.0


def at(r, a):
    """Assembly-frame XY of a point at model angle a (degrees)."""
    t = math.radians(a)
    return (r * math.cos(t), -r * math.sin(t))


# ----------------------------------------------------------------------------
# Geometry helpers (all take MODEL coordinates, build in the assembly frame)
# ----------------------------------------------------------------------------
def box(x0, x1, y0, y1, z0, z1):
    """Model-frame box: x east, y up, z north."""
    return Manifold.cube((x1 - x0, z1 - z0, y1 - y0)).translate((x0, -z1, y0))


def cyl(r, y0, y1, x=0.0, z=0.0, seg=SEG):
    """Vertical cylinder."""
    return Manifold.cylinder(y1 - y0, r, r, seg).translate((x, -z, y0))


def ring(ro, ri, y0, y1, seg=SEG):
    return cyl(ro, y0, y1, seg=seg) - cyl(ri, y0 - 0.01, y1 + 0.01, seg=seg)


def cyl_x(r, x0, x1, y, z=0.0, seg=64):
    """Cylinder along model X."""
    return Manifold.cylinder(x1 - x0, r, r, seg).rotate((0, 90, 0)).translate((x0, -z, y))


def cyl_z(r, z0, z1, x, y, seg=64):
    """Cylinder along model Z (north)."""
    return Manifold.cylinder(z1 - z0, r, r, seg).rotate((90, 0, 0)).translate((x, -z0, y))


def radial(solid, a):
    """Rotate a feature built along +X to model angle a."""
    return solid.rotate((0, 0, -a))


def revolve(points, seg=SEG):
    """Revolve a (radius, y) outline about the vertical axis (either winding)."""
    area = sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(points, points[1:] + points[:1]))
    return Manifold.revolve(CrossSection([points if area > 0 else points[::-1]]), seg)


def prism(poly_xz, y0, y1):
    """Extrude a model-frame (x, z) polygon vertically."""
    pts = [(x, -z) for x, z in poly_xz]
    area = sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]))
    return Manifold.extrude(CrossSection([pts if area > 0 else pts[::-1]]), y1 - y0).translate((0, 0, y0))


def union(parts):
    out = parts[0]
    for p in parts[1:]:
        out = out + p
    return out


def thread_solid(r_major, r_minor, pitch, y0, length, per_turn=96):
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
    return Manifold.extrude(CrossSection([pts]), length, int(turns * per_turn / 2), 360.0 * turns).translate((0, 0, y0))


def g12_female_hole(y0, y1):
    """Printed G½ female thread from y0 to y1 with a lead-in chamfer at the top."""
    rM = G12_MAJOR / 2 + CLEAR_THREAD
    rm = G12_MAJOR / 2 - G12_DEPTH + CLEAR_THREAD
    hole = thread_solid(rM, rm, G12_PITCH, y0 - 1.0, (y1 - y0) + 2.0)
    lead_in = Manifold.cylinder(1.0, rm, rM + 0.6, SEG).translate((0, 0, y1 - 1.0 + 0.001))
    return hole + lead_in


def footprint(margin=0.0):
    return union([box(x0 - margin, x1 + margin, -50, 200, z0 - margin, z1 + margin) for x0, x1, z0, z1 in FOOTPRINT])


def notch_cut(y0, y1, r0=24.6):
    cuts = []
    for a, w in NOTCHES.items():
        cuts.append(radial(box(r0, 40.0, y0, y1, -w / 2, w / 2), a))
    return union(cuts)


def cup_outline_2d(r, flat_x):
    """Circle of radius r with the west side cut flat at x = flat_x (for |z| < FLAT_HALF)."""
    c = CrossSection.circle(r, SEG)
    cut = CrossSection.square((40.0, 2 * FLAT_HALF)).translate((flat_x - 40.0, -FLAT_HALF))
    return c - cut


def extrude2d(cs, y0, y1):
    return Manifold.extrude(cs, y1 - y0).translate((0, 0, y0))


# ----------------------------------------------------------------------------
# 1. Chamber cup — water, TDS probe, thermistor, UV-C windows, insert seat
# ----------------------------------------------------------------------------
def chamber_cup():
    # Outer body: flattened on the west side up to Y_FLAT_TOP, then a full round seal land
    body = extrude2d(cup_outline_2d(R_COUT, FLAT_OUT), Y_FLOOR_BOT, Y_FLAT_TOP) + cyl(R_COUT, Y_FLAT_TOP - 0.01, Y_LID_BOT)
    cavity = extrude2d(cup_outline_2d(R_CIN, FLAT_IN), Y_FLOOR_TOP, Y_LID_BOT + 1.0)
    cup = body - cavity

    # Outlet boss: female thread for the outlet cap, then the insert's sealing shoulder
    r_bore = INSERT_D / 2 + 0.15
    cup = cup + cyl(R_BOSS, Y_FLOOR_TOP - 0.01, Y_SEAT + 1.0)

    # UV-C pads: flat lands on the outside for the LED boards
    for a in UV_ANGLES:
        pad = box(R_CIN + 0.3, UV_PAD_D, Y_UV - 5.0, Y_UV + 5.0, -5.5, 5.5)
        cup = cup + radial(pad, a)

    # Screw columns (outside, under the rim) with 45° cones below so they print without support
    for a in SCREW_ANGLES:
        x, y = at(SCREW_R, a)
        col = Manifold.hull(Manifold.cylinder(30.6 - 22.0, 2.4, 2.4, 48).translate((x, y, 22.0)) +
                            Manifold.cylinder(0.01, 0.5, 0.5, 16).translate((at(R_COUT - 0.6, a)[0], at(R_COUT - 0.6, a)[1], 22.0 - 3.6)))
        cup = cup + col

    # Probe saddle on the floor (cradles the probe head near its cable end)
    saddle = box(-4.0, 4.0, Y_FLOOR_TOP - 0.01, Y_PROBE, -20.5, -17.5) - cyl_z(PROBE["d"] / 2 + 0.15, -21.0, -17.0, 0.0, Y_PROBE)
    cup = cup + saddle

    # ---- cuts ----
    t = CAP_THREAD
    rM = t["major"] / 2 + CLEAR_THREAD
    rm = t["major"] / 2 - 0.640327 * t["pitch"] + CLEAR_THREAD
    cup = cup - thread_solid(rM, rm, t["pitch"], t["y0"] - t["pitch"], t["y1"] - t["y0"] + t["pitch"])   # whole pitch below, so it phases with the cap
    cup = cup - Manifold.cylinder(1.0, rM + 0.6, rm, SEG).translate((0, 0, t["y0"] - 0.999))   # lead-in from below
    cup = cup - cyl(r_bore, t["y1"] - 0.5, Y_SEAT)                       # insert passes up to the shoulder
    cup = cup - cyl(r_bore - 1.3, Y_SEAT - 0.1, Y_SEAT + 1.1)             # outlet hole above the shoulder

    # UV-C window stack: LED pocket, quartz seat, light hole
    for a in UV_ANGLES:
        f = (box(UV_PAD_D - UV["led_t"], UV_PAD_D + 0.1, Y_UV - (UV["led"] + 0.4) / 2, Y_UV + (UV["led"] + 0.4) / 2,
                 -(UV["led"] + 0.4) / 2, (UV["led"] + 0.4) / 2)
             + cyl_x(UV["quartz_d"] / 2 + 0.15, UV_PAD_D - UV["led_t"] - UV["quartz_t"] - 0.05, UV_PAD_D - UV["led_t"] + 0.01, Y_UV)
             + cyl_x(2.25, R_CIN - 1.0, UV_PAD_D - UV["led_t"] - UV["quartz_t"], Y_UV))
        cup = cup - radial(f, a)

    # TDS probe: the head's back end sits in a counterbore in the south wall, the cable leaves through it
    cup = cup - cyl_z(PROBE["d"] / 2 + 0.2, -(R_CIN + 1.0), -(R_CIN - 2.5), 0.0, Y_PROBE)
    cup = cup - cyl_z(PROBE["relief_d"] / 2 + 0.2, -(R_COUT + 1.0), -(R_CIN), 0.0, Y_PROBE)

    # Thermistor port through the north wall (chord at x = NTC_X)
    cup = cup - cyl_z(NTC["d"] / 2 + 0.1, 10.0, R_COUT + 2.0, NTC_X, Y_PROBE)

    # Ring wire groove under the floor (north)
    cup = cup - radial(box(17.0, R_COUT + 1.0, Y_FLOOR_BOT - 0.1, Y_FLOOR_BOT + 1.4, -2.5, 2.5), 90)

    # Screw pilot holes
    for a in SCREW_ANGLES:
        x, y = at(SCREW_R, a)
        cup = cup - Manifold.cylinder(10.0, SCREW["pilot"] / 2, SCREW["pilot"] / 2, 32).translate((x, y, 21.5))
    return cup


# ----------------------------------------------------------------------------
# 2. Chamber lid — face seal, G½ thread for the flow sensor, wire notches
# ----------------------------------------------------------------------------
def chamber_lid():
    lid = cyl(R_PART, Y_LID_BOT, Y_LID_TOP) + cyl(13.0, Y_LID_TOP - 0.01, Y_BOSS_TOP)
    lid = lid - g12_female_hole(Y_LID_BOT, Y_BOSS_TOP)
    rc = ORING["id"] / 2 + ORING["cs"] / 2
    lid = lid - ring(rc + 0.95, rc - 0.95, Y_LID_BOT - 0.1, Y_LID_BOT + 1.15)       # O-ring face groove
    for a in SCREW_ANGLES:
        x, y = at(SCREW_R, a)
        lid = lid - Manifold.cylinder(5.0, SCREW["clear"] / 2, SCREW["clear"] / 2, 32).translate((x, y, Y_LID_BOT - 1))
    lid = lid - notch_cut(Y_LID_BOT - 0.1, Y_LID_TOP + 0.1)
    # Engraved arrow on the top (east): turn the flow sensor until its hall cap points here
    arrow = [(15.2, -2.2), (19.0, -2.2), (19.0, -3.6), (22.0, 0.0), (19.0, 3.6), (19.0, 2.2), (15.2, 2.2)]
    lid = lid - prism(arrow, Y_LID_TOP - 0.5, Y_LID_TOP + 0.1)
    return lid


# ----------------------------------------------------------------------------
# 3. Electronics cage — lowered over the flow sensor, held by the same 3 screws
# ----------------------------------------------------------------------------
def electronics_cage():
    y0 = Y_LID_TOP
    base = cyl(R_PART, y0, Y_CAGE_TOP) - footprint(0.0)
    base = base - notch_cut(y0 - 0.1, Y_CAGE_TOP + 0.1)
    yt = Y_CAGE_TOP - 0.01

    # DevKit: two feet under its bottom edge and a back stop between the header rows
    dk_pcb = DK_Z0 + DEVKIT["stub"]
    parts = [base]
    for x in (-5.0, 5.0):
        parts.append(box(x - 2.0, x + 2.0, yt, DK_Y0, dk_pcb - 0.6, dk_pcb + DEVKIT["pcb"]))
    parts.append(box(-7.0, 7.0, yt, DK_Y0 + 3.0, DK_Z0 - 0.0, dk_pcb - 0.1))

    # TDS board: two feet and a short lip on the outside of its bottom edge
    for x in (-10.0, 10.0):
        parts.append(box(x - 2.0, x + 2.0, yt, TDS_Y0, TDS_Z0 - TDSB["pcb"] - 0.6, TDS_Z0 + 0.0))

    # Battery shelf (screw heads sit in wells under it) and side walls
    bx1 = BAT_X0 - BATT["t"] - 0.6
    parts.append(box(bx1, BAT_X0 + 0.2, yt, Y_SHELF, -BATT["w"] / 2 - 0.6, BATT["w"] / 2 + 0.6))
    for s in (-1, 1):
        z0, z1 = sorted((s * (BATT["w"] / 2 + 0.4), s * (BATT["w"] / 2 + 1.6)))
        parts.append(box(bx1, -17.0, yt, Y_SHELF + 22.0, z0, z1))
    parts.append(box(bx1 - 1.0, bx1 + 0.01, yt, Y_SHELF + 8.0, -8.0, 8.0))            # stop behind the battery

    # Perfboard posts (east), slotted for the board edges
    for s in (-1, 1):
        z0, z1 = sorted((s * (PERF["w"] / 2 + 0.2), s * (PERF["w"] / 2 + 2.6)))
        post = box(PERF_X0 - 0.2, PERF_X0 + 3.0, yt, Y_PERF0 + PERF["l"], z0, z1)
        sz0, sz1 = sorted((s * (PERF["w"] / 2 - 0.6), s * (PERF["w"] / 2 + 0.8)))
        post = post - box(PERF_X0 - 0.15, PERF_X0 + PERF["pcb"] + 0.15, Y_PERF0 - 0.5, Y_PERF0 + PERF["l"] + 1.0, sz0, sz1)
        parts.append(post)
    cage = union(parts) ^ cyl(R_PART, y0 - 1, 200)
    for a in SCREW_ANGLES[1:]:                      # screw heads sit in wells under the battery shelf
        x, y = at(SCREW_R, a)
        cage = cage - Manifold.cylinder(10.0, 3.2, 3.2, 32).translate((x, y, Y_CAGE_TOP - 0.05))
    for a in SCREW_ANGLES:
        x, y = at(SCREW_R, a)
        cage = cage - Manifold.cylinder(6.0, SCREW["clear"] / 2, SCREW["clear"] / 2, 32).translate((x, y, y0 - 1))
    return cage


# ----------------------------------------------------------------------------
# 4. Halo diffuser — natural PETG; holds the LED ring, glows at the bottom
# ----------------------------------------------------------------------------
def halo_diffuser():
    r_hole = CAP_THREAD["major"] / 2 + 0.4
    d = revolve([(r_hole, 0.0), (R_OUT - 0.8, 0.0), (R_OUT, 0.8), (R_OUT, Y_BAND_TOP - 0.6), (R_OUT - 0.6, Y_BAND_TOP),
                 (R_IN - 0.8, Y_BAND_TOP), (R_IN - 0.8, Y_PLATE), (r_hole, Y_PLATE)])
    ri, ro = RING["id"] / 2, RING["od"] / 2
    d = d + ring(ri - 0.3, ri - 0.9, Y_PLATE - 0.01, Y_FLOOR_BOT)          # locates the ring's inside edge
    d = d + ring(ri + 0.55, ri - 0.3, Y_PLATE - 0.01, Y_RING_PCB)          # inner ledge under the PCB
    d = d + ring(ro + 0.4 + 0.6, ro - 0.5, Y_PLATE - 0.01, Y_RING_PCB)     # outer ledge
    d = d + ring(ro + 1.0, ro + 0.4, Y_PLATE - 0.01, Y_FLOOR_BOT)          # outer wall, carries the cup floor
    # Splash lip: rises inside the shell so the shadow gap above the glowing band is a labyrinth, not an open slot
    d = d + ring(R_IN - 0.3, R_IN - 0.8, Y_BAND_TOP - 0.01, Y_BAND_TOP + 4.0, seg=180)
    d = d - cyl(CAP_FLANGE_R + 0.3, -0.1, CAP_FLANGE_H)                    # recess for the outlet cap's flange
    # Ring wires leave through a gap in the outer wall (north)
    d = d - radial(box(ro - 1.0, ro + 1.5, Y_PLATE + 0.5, Y_FLOOR_BOT + 0.1, -2.5, 2.5), 90)
    # USB-C opening for the charger (west): through-slot for the plug, shallow pocket for the board end
    usb_x0 = TP_X0 - TP["pcb"]
    d = d - box(usb_x0 - TP["usb_t"] - 0.4, usb_x0 + 0.2, -0.1, Y_BAND_TOP + 4.1, -TP["usb_w"] / 2 - 0.3, TP["usb_w"] / 2 + 0.3)
    d = d - box(TP_X0 - TP["pcb"] - TP["comp"] - 0.3, TP_X0 + 0.25, 1.0, Y_BAND_TOP + 4.1, -TP["w"] / 2 - 0.3, TP["w"] / 2 + 0.3)
    return d


# ----------------------------------------------------------------------------
# 6. Outlet cap — screws into the cup from below, holds the laminar insert
# ----------------------------------------------------------------------------
def outlet_cap():
    t = CAP_THREAD
    r_maj = t["major"] / 2
    r_min = r_maj - 0.640327 * t["pitch"]
    cap = cyl(CAP_FLANGE_R, 0.0, CAP_FLANGE_H) + cyl(r_maj, CAP_FLANGE_H - 0.01, t["y0"] - 0.02) + cyl(r_min, t["y0"] - 0.1, t["y0"] + 0.5)
    cap = cap + thread_solid(r_maj, r_min, t["pitch"], t["y0"], t["y1"] - t["y0"] - 0.6)
    cap = cap - cyl(INSERT_D / 2 + 0.15, Y_LIP, 30.0)                          # insert bore
    cap = cap - cyl(INSERT_D / 2 - 1.5, -0.1, Y_LIP + 0.01)                     # outlet, insert rests on this lip
    # Six shallow grip flutes on the flange so it can be turned by hand
    for i in range(6):
        x, y = at(CAP_FLANGE_R + 0.6, 30 + 60 * i)
        cap = cap - Manifold.cylinder(CAP_FLANGE_H + 0.2, 1.2, 1.2, 24).translate((x, y, -0.1))
    return cap


# ----------------------------------------------------------------------------
# 5. Body shell — fluted sleeve + top plate with a hex socket for the adapter
# ----------------------------------------------------------------------------
FLUTES = dict(n=60, r=1.6, depth=0.45, y0=13.0, y1=86.0)
Y_GROOVE = 89.0


def body_shell():
    top_r = 3.0
    prof = [(11.4, Y_TOP), (R_OUT - top_r, Y_TOP)]
    for i in range(1, 9):
        t = (math.pi / 2) * i / 8
        prof.append((R_OUT - top_r + top_r * math.sin(t), Y_TOP - top_r + top_r * math.cos(t)))
    prof += [(R_OUT, Y_SHELL_BOT + 0.6), (R_OUT - 0.6, Y_SHELL_BOT), (R_IN, Y_SHELL_BOT),
             (R_IN, Y_HEX_TOP), (11.4, Y_HEX_TOP)]
    shell = revolve(prof, seg=180)
    # Hex socket collar that grips the adapter's hex (twist the body to screw it onto the tap)
    af = ADAPTER["hex_af"] + 0.4
    rc = af / math.sqrt(3)
    hexpts = [(rc * math.cos(math.radians(30 + 60 * i)), rc * math.sin(math.radians(30 + 60 * i))) for i in range(6)]
    collar = cyl(17.6, Y_HEX_BOT - 0.4, Y_HEX_TOP + 0.01, seg=96)
    collar = collar - Manifold.extrude(CrossSection([hexpts]), Y_HEX_TOP - Y_HEX_BOT + 1.0).translate((0, 0, Y_HEX_BOT - 0.5))
    shell = shell + collar
    # Flutes: soft-ended vertical grooves
    rf, dep = FLUTES["r"], FLUTES["depth"]
    rc_f = R_OUT + rf - dep
    cutters = []
    for i in range(FLUTES["n"]):
        a = 360.0 * i / FLUTES["n"]
        x, y = at(rc_f, a)
        cap = Manifold.hull(Manifold.sphere(rf, 24).translate((x, y, FLUTES["y0"])) + Manifold.sphere(rf, 24).translate((x, y, FLUTES["y1"])))
        cutters.append(cap)
    shell = shell - union(cutters)
    # A fine groove that separates the fluted body from the smooth top band
    shell = shell - (cyl(R_OUT + 1.0, Y_GROOVE - 0.4, Y_GROOVE + 0.4, seg=180) - cyl(R_OUT - 0.35, Y_GROOVE - 1.0, Y_GROOVE + 1.0, seg=180))
    return shell


# ----------------------------------------------------------------------------
# Wire runs (model frame). Smoothed and checked against every part by the fit check.
# ----------------------------------------------------------------------------
WIRES = {
    # LED ring: out through the groove under the cup floor, up the north side, round the DevKit's east edge
    "ring": dict(r=0.6, color="green", ends=("ring", "esp32"), pts=[(0, 4.6, 18.5), (0, 5.85, 19.5), (0, 5.85, 24.0), (0, 5.85, 25.6), (0, 7.5, 25.6),
                                             (0, 29.0, 25.6), (0, 35.2, 25.8), (0, 44.5, 25.6), (8, 45.0, 24.4), (13.9, 45.5, 21.2),
                                             (12.9, 47.0, 19.4)]),
    "ntc": dict(r=1.0, color="black", ends=("ntc", "esp32"), pts=[(12, 21.6, 21.5), (12, 22.6, 23.2), (12.8, 29.0, 22.6), (13.0, 33.5, 22.5),
                                            (14.2, 37.0, 21.6), (14.0, 43.0, 20.8), (12.9, 45.0, 19.4)]),
    # TDS probe: outer jacket ends in the wall gland, the two thin inner wires go up to the board
    "probe": dict(r=0.9, color="black", ends=("probe", "tdsBoard"), pts=[(0, 21.6, -25.6), (0, 21.8, -26.5), (0, 24.0, -26.7), (0, 29.5, -26.7),
                                              (0, 35.0, -26.3), (-4, 36.6, -24.5), (-6, 37.6, -22.6)]),
    "uv0": dict(r=0.8, color="red", ends=("uvc",), pts=[(27.1, 11.6, -1.0), (27.0, 15.0, -3.0), (26.6, 19.0, -5.0), (26.0, 22.0, -5.2)]),
    "uv120": dict(r=0.8, color="red", ends=("uvc",), pts=[(-13.55, 11.6, 23.47), (-12.5, 16.5, 24.3), (-6, 17.4, 26.8), (0, 17.4, 27.4),
                                            (7, 17.4, 26.4), (14, 17.4, 23.2), (22.5, 17.4, 14.0), (26.5, 17.4, 3.5),
                                            (26.6, 19.5, -2.5), (26.0, 22.0, -5.2)]),
    "uv240": dict(r=0.8, color="red", ends=("uvc",), pts=[(-13.55, 11.6, -23.47), (-9.5, 16.8, -25.6), (0, 17.0, -26.8), (13.5, 17.6, -23.4),
                                            (22.5, 19.5, -14.0), (25.8, 21.0, -8.0), (26.0, 22.0, -5.2)]),
    "uvBundle": dict(r=1.3, color="red", ends=("uvDriver",), pts=[(26.0, 22.0, -5.2), (25.7, 26.0, -6.6), (25.6, 29.0, -6.9), (25.6, 33.4, -6.9),
                                               (23.2, 36.3, -6.0), (21.5, 38.5, -5.0)]),
    "battery": dict(r=0.8, color="red", ends=("battery", "tp4056"), pts=[(-17.8, 92.2, 3), (-21.5, 93.0, 4), (-25.2, 91.0, 4), (-25.2, 36.0, 4),
                                              (-25.6, 33.0, 3), (-25.6, 30.2, 3), (-24.0, 29.0, 3)]),
    "power": dict(r=0.8, color="black", ends=("tp4056", "perfboard"), pts=[(-24.0, 29.0, -3), (-25.6, 30.2, -3), (-25.6, 33.0, -3), (-25.2, 36.0, -4),
                                              (-25.2, 86.0, -4), (-24.5, 93.5, -4), (-15, 93.5, -18), (0, 92.0, -21),
                                              (14, 89.0, -18), (18.0, 86.0, -10)]),
    "hall": dict(r=0.9, color="yellow", ends=("sensor", "perfboard"), pts=[(23.2, 62.85, 0), (25.0, 63.5, 0), (25.3, 72.0, 0), (24.0, 75.2, 0), (20.5, 75.3, 0)]),
    "piezo": dict(r=0.3, color="black", ends=("piezo", "perfboard"), pts=[(-13.25, 62.85, 0), (-13.3, 62.85, 12), (-13.2, 63.0, 17.9), (-13.2, 82.0, 17.9),
                                              (-8, 88.0, 16.5), (8, 88.0, 16.5), (17.0, 87.5, 13.5), (18.6, 86.0, 9)]),
    "bus": dict(r=1.0, color="blue", ends=("esp32", "perfboard"), pts=[(12.5, 70.0, 19.0), (14.5, 72.0, 18.6), (17.0, 77.0, 18.8), (18.0, 80.0, 13.0)]),
    "tds": dict(r=0.8, color="yellow", ends=("tdsBoard", "esp32"), pts=[(15.0, 40.0, -21.5), (16.5, 38.0, -17.0), (15.5, 36.0, 0), (14, 38.0, 16.0),
                                             (11.5, 40.0, 19.0)]),
    "uvEnable": dict(r=0.6, color="blue", ends=("perfboard", "uvDriver"), pts=[(19.5, 75.8, -12.0), (20.0, 60.0, -12.5), (20.5, 46.0, -10.0), (20.5, 44.0, -7.0)]),
}


def smooth(pts, it=2):
    """Chaikin corner cutting, endpoints kept."""
    p = [tuple(map(float, q)) for q in pts]
    for _ in range(it):
        out = [p[0]]
        for a, b in zip(p, p[1:]):
            out.append(tuple(0.75 * x + 0.25 * y for x, y in zip(a, b)))
            out.append(tuple(0.25 * x + 0.75 * y for x, y in zip(a, b)))
        out.append(p[-1])
        p = out
    return [[round(v, 3) for v in q] for q in p]


# ----------------------------------------------------------------------------
# Layout for the viewer (where every bought part sits, model frame)
# ----------------------------------------------------------------------------
def layout():
    return dict(
        R_OUT=R_OUT, R_IN=R_IN, Y_TOP=Y_TOP, Y_SHELL_BOT=Y_SHELL_BOT, Y_BAND_TOP=Y_BAND_TOP,
        Y_PLATE=Y_PLATE, Y_RING_LED=Y_RING_LED, Y_RING_PCB=Y_RING_PCB, Y_FLOOR_BOT=Y_FLOOR_BOT, Y_FLOOR_TOP=Y_FLOOR_TOP,
        Y_LIP=Y_LIP, Y_INSERT_TOP=Y_INSERT_TOP, Y_PROBE=Y_PROBE, Y_UV=Y_UV, Y_LID_BOT=Y_LID_BOT, Y_LID_TOP=Y_LID_TOP,
        Y_S=Y_S, Y_CAGE_TOP=Y_CAGE_TOP, Y_DRUM=Y_DRUM, Y_SENSOR_TOP=Y_SENSOR_TOP, Y_HEX_BOT=Y_HEX_BOT, Y_HEX_TOP=Y_HEX_TOP,
        R_CIN=R_CIN, R_COUT=R_COUT, UV_ANGLES=UV_ANGLES, UV_PAD_D=UV_PAD_D, SCREW_ANGLES=SCREW_ANGLES, SCREW_R=SCREW_R,
        NTC_X=NTC_X, Y_SEAT=Y_SEAT, CAP_THREAD=CAP_THREAD, CAP_FLANGE_R=CAP_FLANGE_R, DK_Z0=DK_Z0, DK_Y0=DK_Y0, TDS_Z0=TDS_Z0, TDS_Y0=TDS_Y0, BAT_X0=BAT_X0, Y_SHELF=Y_SHELF,
        TP_X0=TP_X0, Y_TP_USB=Y_TP_USB, PERF_X0=PERF_X0, Y_PERF0=Y_PERF0, UVDRV_X0=UVDRV_X0,
        SENSOR=SENSOR, INSERT=dict(d=INSERT_D, h=INSERT_H), PROBE=PROBE, NTC=NTC, UV=UV, RING=RING, DEVKIT=DEVKIT,
        TDSB=TDSB, BATT=BATT, TP=TP, PERF=PERF, UVDRV=UVDRV, ADAPTER=ADAPTER, ORING=ORING,
        WIRES={k: dict(r=v["r"], color=v["color"], ends=list(v["ends"]), pts=smooth(v["pts"])) for k, v in WIRES.items()})


# ----------------------------------------------------------------------------
# Export
# ----------------------------------------------------------------------------
# id, file, builder, flip for printing, what it is
PARTS = [
    ("chamber", "01_chamber_cup.stl", chamber_cup, False, "Chamber cup"),
    ("lid", "02_chamber_lid.stl", chamber_lid, False, "Chamber lid with G½ thread"),
    ("cage", "03_electronics_cage.stl", electronics_cage, False, "Electronics cage"),
    ("diffuser", "04_halo_diffuser.stl", halo_diffuser, False, "Halo diffuser (natural PETG)"),
    ("shell", "05_body_shell.stl", body_shell, True, "Body shell"),
    ("cap", "06_outlet_cap.stl", outlet_cap, False, "Outlet cap (holds the insert)"),
]

# Assembly frame (Z up) -> viewer frame (Y up): x' = x, y' = z, z' = -y
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


def build_all():
    return {pid: fn() for pid, _, fn, _, _ in PARTS}


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
        to_model = A_TO_MODEL @ np.linalg.inv(shift @ R)
        manifest.append({"id": pid, "file": fname, "label": label,
                         "matrix": [round(float(x), 6) for x in to_model.T.flatten()]})
        bb = printed.bounding_box()
        bodies = len(printed.decompose())
        assert bodies == 1, f"{fname} has {bodies} separate bodies"
        print(f"{fname:28s} {tris:7d} tris  vol {printed.volume() / 1000:6.1f} cm³  bodies {bodies}  "
              f"size {bb[3] - bb[0]:.1f} × {bb[4] - bb[1]:.1f} × {bb[5] - bb[2]:.1f} mm")
    (OUT / "parts.json").write_text(json.dumps({"units": "mm", "parts": manifest}, indent=1))
    (OUT / "layout.json").write_text(json.dumps(layout(), indent=1))
    bundle = {name: base64.b64encode((OUT / name).read_bytes()).decode()
              for name in ["parts.json", "layout.json"] + [f for _, f, _, _, _ in PARTS]}
    (OUT / "stl-bundle.json").write_text(json.dumps(bundle))
    return built


if __name__ == "__main__":
    main()
