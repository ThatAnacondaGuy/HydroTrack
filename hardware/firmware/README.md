# HydroTrack firmware

| Folder | Board | What it is |
|---|---|---|
| `calibration_logger/` | ESP32-S3 DevKitC-1 | Bucket-and-scale runs to calibrate the flow sensor (bench rig) |
| `tap_device/` | ESP32-S3 DevKitC-1 | The tap device: litres, temperature, TDS, halo, alerts, UV-C, battery saving |
| `valve_box/` | ESP32 DevKit V1 | The valve box on the main pipe: valve control, auto-close, phone page, MQTT |

The tap devices and the valve box talk over **ESP-NOW**, a direct radio link
between ESP32 boards that needs no router. The format is in `ht_protocol.h`; the
two copies of that file must stay identical.

## Arduino IDE setup

1. Boards Manager: **esp32 by Espressif**, version 3.x.
2. Tap device: board **ESP32S3 Dev Module**, PSRAM **OPI PSRAM**, Flash Size **16MB**.
3. Valve box: board **DOIT ESP32 DEVKIT V1**. Library Manager: install **PubSubClient** by Nick O'Leary.
4. Valve box: copy `secrets.example.h` to `secrets.h` and fill in your Wi-Fi (and MQTT if you use it). `secrets.h` is ignored by git.

On this Mac the IDE's ctags tool is replaced by a stub, so every function in
these sketches is written above the place it is used. Keep it that way when you
add code.

Both sketches compile with no warnings (esp32 core 3.3.12).

## Tap device

**Pins (ESP32-S3).** Flow, NTC and TDS are on the same pins as the bench rig.

| GPIO | Connects to |
|---|---|
| 4 | YF-S201 yellow (flow pulses) |
| 1 | NTC divider: 3V3 –10k– GPIO 1 –NTC– GND |
| 2 | TDS board A |
| 5 | TDS board + (powered from the pin, only during a reading) |
| 6 | LM358 piezo amplifier output |
| 7 | LED ring DIN |
| 15 | AO3401 gate: LOW powers the LED ring and the flow sensor |
| 16 | UV-C driver EN |
| 17 | Buzzer |
| 9 | Battery through a 100k + 100k divider (battery + → 100k → GPIO 9 → 100k → GND) |

**What it does**

- **Idle:** light sleep. Every 2 s it powers the flow sensor for 150 ms to see whether water is running.
- **Water running:**
  - counts litres and reads the temperature 4 times a second;
  - reads TDS once per use, after 3 s of flow;
  - sends a LIVE packet to the valve box every 2 s.
- **Halo:** blue below 75% of the use limit, amber pulse from 75%, red pulse over the limit.
  - Scalding water (45 °C and above): fast red flash and beeps.
  - Tap left open: red and amber alternating, with a chirp every 10 s.
  - In minimal mode (the default) the halo shows only for the first 5 s of a use and for warnings, which saves battery.
- **Tap left open:** flow that has run for 3 minutes and stayed very steady for the last minute. It sends an alert to the valve box, which starts its countdown.
- **When the use ends:**
  1. It sends one USE record (litres, seconds, average and maximum temperature, TDS).
  2. It runs UV-C for 2 minutes while water stands in the chamber, at most once every 2 hours. UV-C stops at once if water starts flowing.
  3. It goes back to sleep.
- **Bench mode:** `BENCH_MODE 1` in `config.h` (the default) never sleeps and prints readings every second at 115200 baud. Set it to 0 for battery use; the USB serial port then drops out while the board sleeps.
- **Calibration:** put your calibration-logger results into `PULSES_PER_LITRE`, `CAL_LOW_FLOW_GAIN` and `VISCOSITY_COEFF` in `config.h`. Set `TDS_K` against a TDS pen.

## Valve box

**Pins (ESP32 DevKit V1)**

| GPIO | Connects to |
|---|---|
| 26 | Relay IN1 (valve control) |
| 27 | Relay IN2 (open wire, 3-wire valves only) |
| 32 | Valve feedback: open (CR05 green) |
| 33 | Valve feedback: closed (CR05 white) |
| 13 | LED ring DIN |
| 14 | Button (other leg to GND) |

**Valve wiring:** connect **relay 1 NC** (not NO) to the valve's red control
wire. With the relay off the water is on, so a restart or a crash never shuts off
the house's water. If you wired NO instead, set `RELAY_ON_CLOSES 0`. For a 3-wire
valve, set `THREE_WIRE_VALVE 1`.

**What it does**

- **Valve control:** it drives the valve and waits for the feedback wire. If the valve hasn't arrived after 16 s, it reports "Valve stuck".
  - It remembers whether the water was on or off, and puts the valve back after a power cut.
- **Tap devices:** it answers every packet with the time, the valve state and that tap's settings.
  - New tap devices are added automatically, up to 8.
- **Auto-close:** "tap left open" starts a 2-minute countdown; the light ring shows it as a shrinking arc. If nobody answers, the water shuts.
  - In away mode, any water running shuts the valve straight away.
- **Button:** press to close or open the water. Hold for 3 s to switch away mode on or off.
- **Light ring:**

  | Colour | Meaning |
  |---|---|
  | Blue (breathing while water runs) | Water on |
  | Spinning amber | Valve moving |
  | Red | Valve closed |
  | Amber arc | Countdown |
  | Purple | Away mode |
  | Green flash | Command received |
  | Blinking red | Valve stuck |

- **Phone page:** on home Wi-Fi, open **http://hydrotrack.local** (or the IP address printed on the Serial Monitor). It shows the valve, every tap and the alert, with Close / Open, "It's me", auto-close and away mode. It works with no internet.
- **MQTT** (optional, for control from outside the house): it uses the topics and JSON format the dashboard backend in this repo already reads.

| Topic | Direction |
|---|---|
| `hydrotrack/<HOME_ID>/tap-xxxxxxxx/telemetry` | box → broker, matches `payloadSchema.ts` |
| `hydrotrack/<HOME_ID>/<device>/alert` | box → broker |
| `hydrotrack/<HOME_ID>/valve-box/status` | box → broker (retained; an offline message is sent if the box drops off) |
| `hydrotrack/<HOME_ID>/valve-box/command` | broker → box: `{"action":"close"}`, `{"action":"open"}`, `{"action":"dismiss"}`, `{"action":"away","value":true}`, `{"action":"auto","value":false}` |
| `hydrotrack/<HOME_ID>/tap-xxxxxxxx/config` | broker → box: `{"name":"Kitchen","profile":"kitchen","useLimitL":10,"dailyLimitL":150,"haloMinimal":true,"uvcMinutes":2}` |

Sample telemetry, alert and status messages were checked against the backend's
zod schemas, and all three pass.

**Security:** anyone who can publish to your command topic can shut your water.
Use a broker with a username and password (your own Mosquitto, or HiveMQ Cloud
with `MQTT_TLS 1`), and a `HOME_ID` nobody can guess. Don't use a public test
broker. On the local phone page, anyone on your home Wi-Fi can press the
buttons.

## Not tested yet

Both sketches compile and the message formats are checked, but neither has run on
real boards. Test in this order:

1. Valve box on the bench with the valve (no pipe).
2. Tap device in bench mode on the rig.
3. Pairing, then a live use.
4. Battery mode last, measuring the sleep current with a multimeter.
