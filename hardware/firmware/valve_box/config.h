// =====================================================================
//  HydroTrack valve box: pins and behaviour
//  Your Wi-Fi and MQTT details go in secrets.h (copy secrets.example.h).
// =====================================================================
#pragma once

// ---- Pins (ESP32 DevKit V1, 30-pin) ----
#define PIN_RELAY1 26        // relay 1: valve control wire (CR05 red)
#define PIN_RELAY2 27        // relay 2: open wire, only for 3-wire valves
#define PIN_FB_OPEN 32       // valve feedback: fully open (CR05 green)
#define PIN_FB_CLOSED 33     // valve feedback: fully closed (CR05 white)
#define PIN_RING 13          // WS2812B 8-LED ring DIN
#define PIN_BUTTON 14        // push button to GND

// ---- Valve wiring ----
#define RELAY_ACTIVE_LOW 1   // most relay modules switch on when IN is LOW
// Wire relay 1 NC -> valve red. Relay off = water on, so a restart or a
// crash never shuts the house's water. Set to 0 if you wired NO instead.
#define RELAY_ON_CLOSES 1
#define THREE_WIRE_VALVE 0   // 1 = valve with separate close (relay 1) and open (relay 2) wires
#define USE_FEEDBACK 1       // 0 if your valve has no feedback wires
#define FEEDBACK_ACTIVE_LOW 1
#define VALVE_TRAVEL_MS 8000 // a 5 s valve, plus margin. Without feedback this is the assumed travel time.

// ---- Behaviour ----
#define AUTO_CLOSE_S 120     // countdown after "tap left open" before the water shuts
#define RING_LEDS 8
#define RING_BRIGHTNESS 50   // 0-255
#define MAX_TAPS 8
#define TZ_OFFSET_S 19800    // India, UTC+5:30
#define LIVE_PUBLISH_MS 5000 // MQTT telemetry at most every 5 s per tap while water runs
#define DEFAULT_CHANNEL 1    // ESP-NOW channel when there is no Wi-Fi
#define LONG_PRESS_MS 3000   // hold the button 3 s to switch away mode
