# HydroTrack valve box: build guide

The box on the house's main pipe that shuts off all the water from the phone,
from the box's own button, or automatically when a tap device reports a tap
left open. Box size **101 × 117 × 40 mm**. Valve: **¾" (DN20) motorised ball
valve, 12 V**.

Open `index.html` (or the published page) to see the 3D model and try the phone
simulation.

## Parts to buy (about ₹2,500–4,000)

| Part | Notes | Approx. price |
|---|---|---|
| ¾" DN20 motorised ball valve, 12 V DC, 5-wire (CR05 type), brass | With a manual override knob. Female G¾ both ends. | ₹1,200–2,500 |
| ESP32 DevKit V1, 30-pin | Any cheap ESP32 board | ₹400–600 |
| 2-channel 5 V relay module | 51 × 38 mm, M3 holes | ₹100–150 |
| MP1584 mini step-down module | 12 V → 5 V | ₹60 |
| WS2812B 8-LED ring (32 mm) + 12 × 12 × 5 mm tactile switch + small perfboard | Halo and button | ₹120 |
| 5-way 5.08 mm screw terminal block | For the valve cable | ₹20 |
| Panel-mount DC jack 5.5 × 2.1 mm + 12 V 1 A adapter | Only 12 V enters the box | ₹220–320 |
| PG7 cable gland | For the valve cable | ₹20 |
| 2 × ¾" CPVC MTA (male threaded adapter) + 1 × ¾" CPVC union | Plumbing joints | ₹150–300 |
| 4 × M3 × 12 + 4 × M3 × 6 self-tapping screws, jumper wires, 22 AWG wire, PTFE tape, CPVC cement | | ₹100 |

## Print (white PETG, halo in natural PETG, no supports)

| File | Lay on bed | Settings |
|---|---|---|
| `print/01_box_body.stl` | Back down | 3 walls, 15% infill |
| `print/02_box_cover.stl` | Front face down | 3 walls; turn off brim |
| `print/03_halo_ring.stl` | Flange down | Natural PETG, 100% infill |
| `print/04_button_cap.stl` | Flange down | 3 walls |

Measure the valve, relay module and LED ring when you have them. If a size is
different, change it at the top of `print/make_box_parts.py` and run
`python make_box_parts.py` (needs `pip install manifold3d numpy`).

## Fit the valve to the pipe

1. Turn off the main supply and drain the line.
2. Pick a spot after the meter or the tank outlet, so the valve controls the whole house. Leave room above it for the actuator and its knob.
3. Cut out a section of the ¾" CPVC pipe. Solvent-weld an MTA on each cut end, putting a union on one side so the valve can come out later.
4. Wrap the MTA brass threads with 6–8 turns of PTFE tape and screw them into the valve. The arrow on the valve body points with the flow, and the actuator goes on top.
5. Clamp the pipe to the wall on both sides of the valve, so the valve's weight isn't hanging on the joints.
6. Turn the supply on slowly and check every joint for drips.

## Build the box

1. Set the step-down module to **5.0 V** with a multimeter before connecting anything to it.
2. Screw the relay module onto its four standoffs, terminals facing down.
3. Push the ESP32, pins up, into its four corner posts, then add a dab of hot glue.
4. Stick the step-down module and the terminal block in their places on the back.
5. Fit the DC jack and the cable gland through the holes in the bottom wall.
6. Solder the switch in the middle of the perfboard and glue the LED ring around it. Screw it onto the two posts inside the cover, then press in the halo ring and the button cap from behind.
7. Wire it as in the wiring table on the page. Most connections are plug-in jumper wires.
8. Hang the box on two wall screws using the keyholes. Feed the valve cable up through the gland with a drip loop below the box, and tighten the gland.
9. Close the cover with four M3 screws.

## Wiring

| From | To |
|---|---|
| 12 V jack + | Step-down IN+, relay 1 COM, terminal 1 → valve yellow (+12 V) |
| 12 V jack − | Step-down IN−, terminal 2 → valve blue (ground) |
| Relay 1 NC | Valve red (control). NC means the water stays on if the box restarts |
| Step-down 5 V / GND | ESP32 VIN / GND, relay VCC / GND, LED ring 5 V / GND |
| ESP32 GPIO 26 / 27 | Relay IN1 / IN2 |
| ESP32 GPIO 32 / 33 | Terminals 4 / 5 → valve green (open) / white (closed) feedback |
| ESP32 GPIO 13 | LED ring DIN |
| ESP32 GPIO 14 | Button (other leg to GND) |

Valve wire colours differ between makers. Check the label on yours before
connecting anything. The firmware is in `firmware/valve_box/`; its README
explains the settings for NO wiring and for 3-wire valves.

## What was checked

All four printed parts and every bought part were checked against each other,
along with every wire run inside the box: no collisions. The parts print without
supports. The pipe, fittings and valve sizes come from typical listings; measure
yours. Nothing has been printed or tested on a real pipe yet.
