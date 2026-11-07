# HydroTrack v3.1 (final design): printing and assembly

Six parts, all PETG, and none of them need supports. The STL files are already
oriented for printing and sit at the centre of the bed. The finished body is
**Ø61 × 101.7 mm**.

| File | Part | Lay on bed | Filament and settings |
|---|---|---|---|
| `01_chamber_cup.stl` | Water chamber | Floor down | White PETG, 4 walls, 5 top/bottom layers, 40% gyroid. It holds water. |
| `02_chamber_lid.stl` | Lid with G½ thread | Flat side down | White PETG, **0.12 mm layers** (for the thread), 4 walls. |
| `03_electronics_cage.stl` | Electronics cage | Base down | White PETG, 3 walls, 20% infill. |
| `04_halo_diffuser.stl` | Halo diffuser | Flat side down | **Natural (clear) PETG**, 100% concentric infill so it glows evenly. |
| `05_body_shell.stl` | Fluted body + top plate | Top face down | White PETG, 3 walls, 20% infill. |
| `06_outlet_cap.stl` | Outlet cap (holds the insert) | Flange down | White PETG, **0.12 mm layers** (for the thread). |

PETG: nozzle 235–245 °C, bed 75–80 °C, glue stick on smooth PEI. About 66 cm³ in
total, roughly 85 g of filament.

## Measure these first

Some sizes aren't published, so the model uses typical values. Check them with
calipers. If one is different, change the value at the top of
`make_printed_parts.py` and run it again (`pip install manifold3d numpy`, then
`python make_printed_parts.py`). The script rebuilds every part and the 3D view.

| What | Value used | Setting |
|---|---|---|
| TDS probe head | Ø12 × 32 mm, needles 8 mm | `PROBE` |
| Neoperl laminar insert | Ø21 × 13 mm | `INSERT_D`, `INSERT_H` |
| YF-S201 turbine drum | Ø35 mm, 29.5 mm long + 6 mm cap | `SENSOR` |
| LiPo battery | 8 × 34 × 50 mm + 4 mm PCM | `BATT` |
| ESP32 DevKit board | 62.7 × 25.5 mm | `DEVKIT` |
| TP4056 board | 28 × 17 mm, USB-C 9 × 3.2 mm | `TP` |
| UV-C LED board | 8 × 8 mm | `UV` |
| Adapter hex | 27 mm across flats | `ADAPTER` |

## Buy these too (small parts)

- LiPo **803450**, about 1500 mAh, with a protection board (PCM)
- Chrome-plated brass adapter, **M22 × 1 male to G½ female**, hex 27 mm
- ½" rubber tap washer; nitrile O-ring **45 × 1.5 mm**
- 3 fused-quartz discs, **6 × 1 mm**
- Small UV-C boost driver (step-up to about 6 V)
- 3 × **M2.5 × 12** self-tapping pan-head screws
- 2 × AO3401 MOSFET, 1 × 9 mm passive buzzer
- Food-safe silicone, 2 mm double-sided foam tape, PTFE tape, 0.2 mm enamelled wire

## Prepare the bought parts

1. **ESP32 DevKit:** upload the firmware first. Then pull the black plastic strips off the pin headers with pliers and snip the pins to about 1.5 mm. Solder wires to the pins you use.
2. **TDS board:** pull the two white plug housings off and solder wires straight to the pins.
3. **TDS probe:** cut the cable about 3 cm from the probe. Strip the outer jacket back 1 cm and keep the two thin inner wires.
4. **Piezo:** use thin leads (0.2 mm enamelled wire), because the battery sits 0.8 mm away.

## Assembly order

1. **Sensor into the lid.** Wrap the flow sensor's bottom thread with PTFE tape (4–5 turns) and screw it into the lid until it feels snug. Then keep turning, less than one more turn, until the black hall cap points at the arrow engraved on the lid. The thread leaves 0–2 mm of play above the boss for this; the sealing is done by the PTFE tape.
2. **Line the chamber.** Line the inside with aluminium tape. Cut it away over the three UV-C windows, the probe gland (south) and the thermistor port (north).
3. **UV-C windows.** Glue a quartz disc into each window seat, with epoxy on the edge only. Fix each LED board on its flat pad with the LED in the square pocket.
4. **TDS probe.** From inside, feed the two thin wires out through the south gland. Seat the head's back end in the counterbore so it rests on the saddle. Seal the gland outside with silicone.
5. **Thermistor.** Push it through the north port until its back end is flush with the wall. Seal it with silicone.
6. **Close the chamber.** Lay the O-ring in the groove under the lid. Lower the lid onto the cup with the wires in their notches.
7. **Cage.** Lower the cage over the flow sensor: the drum passes through the cut-out in its base. Drive the three screws through the cage and the lid into the cup's columns. Two of them sit in wells under the battery shelf.
8. **Leak test, before any electronics.** Put the insert into the outlet cap and screw the cap into the cup from below. Fit the adapter (PTFE tape) to the sensor's top thread, screw it into a tap and run water at full flow for a few minutes. Look for drips at the lid joint, the windows, the probe gland and the thermistor port.
9. **Halo and charger.** Unscrew the outlet cap. Lay the LED ring in the diffuser, LEDs down, and run its wires through the gap and the groove under the cup floor. Tape the TP4056 on the cup's flat west side with its USB-C port down through the diffuser slot. Fix the diffuser to the cup floor with three dots of silicone, then screw the outlet cap back in.
10. **Electronics.** Glue the UV-C driver on the lid under the hall cap. Slide the perfboard into the two east posts. Tape the DevKit (chip side out) to the north face of the drum and the TDS board (parts out) to the south face. Stand the battery on its shelf. Wire everything along the routes in the 3D view, through the notches.
11. **Body.** Slide the shell down from the top so its hex socket drops over the adapter's hex.
12. **Fit to the tap.** Put the washer on top, start the M22 thread in the tap by hand, and twist the whole body clockwise until it is snug.

## Living with it

- **Charging:** the USB-C port is underneath, beside the outlet, so water can't run into it. Plug in from below.
- **Cleaning:** unscrew the outlet cap by hand to rinse scale out of the insert, like a normal tap aerator.
- **Hot water:** for taps up to about 50 °C. The TDS probe is rated to 55 °C and the battery sits next to the sensor.

## What was checked

Each part was checked against every other part and every wire run in the model:
there are no collisions, and nothing comes within 0.4 mm of the shell. Three
assembly steps were checked as well: the cage can be lowered over the sensor, the
sensor can be screwed in without its drum hitting anything, and the shell slides
on from the top. Every part prints without supports.

This is all CAD only. Nothing has been printed or pressure-tested yet, so do the
leak test in step 8.
