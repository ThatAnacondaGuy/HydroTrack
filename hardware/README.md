# HydroTrack — Tap Device Hardware

- `3d-model/` — final compact design v3.1 (Ø61 × 101.7 mm): 3D viewer (`index.html`), Blender model (`.glb`), six printable STL parts and the generator script in `print/`. Print and assembly guide: `3d-model/print/PRINTING.md`.
- `valve-box/` — main-pipe shut-off valve box: 3D viewer with phone app simulation (`index.html`), four printable STL parts and generator in `print/`, build and pipe-fitting guide `BUILD.md`.
- `3d-model-v1/` — first real-parts build, kept for reference.
- `firmware/` — tap device and valve box firmware (ESP-NOW between them, MQTT to the dashboard backend) plus the flow-sensor calibration logger. See `firmware/README.md`.
- `wokwi/` — Wokwi simulation of the device firmware.
- `wiring/`, `design/` — breadboard and size-comparison diagrams.
- `docs/` — technical report and purchase order.
