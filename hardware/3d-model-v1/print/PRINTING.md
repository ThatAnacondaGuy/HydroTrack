# HydroTrack v3.0: printing and assembly

Five parts, all PETG, all print **without supports**. The STL files are already
oriented for printing and sit at the centre of the bed.

| File | Part | Lay on bed | Filament and settings |
|---|---|---|---|
| `01_chamber_cup.stl` | Sensor & UV-C chamber | Floor down | White PETG. 4 walls, 5 top/bottom layers, 40% gyroid. It holds water, so don't go lighter. |
| `02_chamber_lid.stl` | Lid with G½ thread | Flat side down | White PETG. 0.12 mm layers (for the thread), 4 walls. |
| `03_halo_diffuser.stl` | Halo diffuser | Flat side down | **Natural (clear) PETG.** 100% concentric infill, so the glow is even. |
| `04_electronics_carrier.stl` | Electronics carrier | Ring down | White PETG. 3 walls, 20% infill. |
| `05_top_cap.stl` | Top cap + radio band | Top face down | White PETG. 3 walls, 20% infill. |

PETG: nozzle 235–245 °C, bed 75–80 °C. Use glue stick on a smooth PEI sheet so
PETG doesn't bond too hard. Total is about 70 cm³, roughly 90 g of filament.

## Measure these first

The model uses typical sizes for parts whose dimensions aren't published.
Check them with calipers. If one differs, edit the value at the top of
`make_printed_parts.py` and run it again (`pip install manifold3d numpy`, then
`python make_printed_parts.py`):

| What | Value used | Setting |
|---|---|---|
| Neoperl laminar insert | Ø21 × 13 mm | `INSERT_D`, `INSERT_H` |
| TDS probe head | Ø12 mm | `PROBE_D` |
| LiPo thickness | 5 mm (pocket is 5.2 mm) | carrier: panel A and rail positions |
| WS2812B ring outside diameter | 44.5 mm (pocket fits up to 45.2 mm) | diffuser pocket |

## Buy these too (not in the purchase order)

- Brass adapter, M22 × 1 male to G½ female
- Aluminium tube, **63.5 mm (2½ in) OD, 1.6 mm wall**, at least 100 mm long. The 60 mm tube in the order is too narrow.
- 4 × fused-quartz discs, 6 mm × 1 mm
- Small boost/constant-current driver for the UV-C LEDs (they need about 6 V)
- O-ring, nitrile, 48 × 1.5 mm
- 3 × M2 × 12 self-tapping screws (pan head)
- Rubber washer for the M22 tap joint
- Food-safe silicone sealant, PTFE thread tape, double-sided foam tape

## Assembly order

1. **Lid thread.** Wrap the flow sensor's bottom G½ thread with PTFE tape and screw it into the lid. If it binds, run it in and out a few times. Don't force it.
2. **Line the cup.** Line the inside with aluminium tape. Cut the tape away over the four UV-C windows and the thermistor port.
3. **Windows and LEDs.** Glue a quartz disc into each window seat from outside, putting epoxy on the edge only. Then fix each UV-C LED board on its flat pad with the LED in the square pocket.
4. **Insert.** From inside the cup, drop the Neoperl insert into the floor seat. It rests on the 1 mm lip.
5. **Thermistor.** Push it through the side port until the tip reaches the middle. Seal the outside with silicone.
6. **TDS probe.** Shorten the cable and pass it up through the lid's small hole before re-crimping the plug. Snap the probe into the clip inside the cup, then seal the hole with silicone.
7. **Close the chamber.** Put the O-ring in the groove under the lid and set the lid on the cup. Line the two notches up with the cup's wire channels. Put the carrier on top and drive the three M2 screws through the carrier and lid into the cup.
8. **Leak test before any electronics.** Fit the adapter to the flow sensor's top thread (with PTFE tape), screw it onto the tap and run water at full flow for a few minutes. Look for drips at the lid, the windows and the thermistor port.
9. **Halo.** Lay the LED ring in the diffuser pocket with the LEDs facing down. Run its three wires up the channel at the back of the cup, then press the diffuser's pegs into the cup floor with a drop of glue.
10. **Electronics.**
    - Glue the piezo disc to the flat face of the flow sensor's turbine housing.
    - Slide the ESP32 (headers removed) into the carrier rails, antenna end up.
    - Slip the battery between the back plate and the rails.
    - Foam-tape the TDS board to the panel above the probe, and the power board and TP4056 to the opposite panel, with the USB-C port at the top.
11. **Sleeve and cap.** Cut the tube to fit between the diffuser and the cap (about 96 mm, but measure on your build). Slide it on, then fit the top cap with its USB-C opening over the charger. The cap is clamped between the adapter hex and the tap.

Every part was checked in the model against every bought part: no collisions,
and nothing reaches past the 60.3 mm inside of the tube. The chamber has been
checked as a CAD model only, not yet printed or pressure-tested. Do the leak test
in step 8.
