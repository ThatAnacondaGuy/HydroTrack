// =====================================================================
//  HydroTrack tap device: pins, calibration and behaviour
// =====================================================================
#pragma once

// ---- Turn this on while testing on the bench ----
// 1 = never sleeps, prints readings every second on the Serial Monitor (115200).
// 0 = normal battery mode (the USB serial port drops out while it sleeps).
#define BENCH_MODE 1

// ---- Pins (ESP32-S3 DevKitC-1; avoid 0, 3, 19, 20, 35-37, 45, 46) ----
#define PIN_FLOW 4          // YF-S201 yellow wire (internal pull-up)
#define PIN_NTC 1           // 3V3 -[10k]- PIN -[NTC]- GND
#define PIN_TDS 2           // DFRobot TDS board "A" output
#define PIN_TDS_PWR 5       // TDS board "+" (powered from this pin, about 5 mA)
#define PIN_PIEZO 6         // LM358 output, biased near 1.2 V
#define PIN_RING 7          // WS2812B ring DIN
#define PIN_PWR_EN 15       // AO3401 gate: LOW = LED ring and flow sensor get power
#define PIN_UVC_EN 16       // UV-C boost driver EN (HIGH = on)
#define PIN_BUZZER 17       // 9 mm passive buzzer
#define PIN_BATT 9          // battery through a 100k/100k divider

// ---- Calibration (replace with your bucket-and-scale results) ----
#define PULSES_PER_LITRE 450.0f   // datasheet: 7.5 Hz per L/min = 450 pulses per litre
#define CAL_LOW_FLOW_GAIN 0.0f    // extra correction below 2 L/min; 0 = off
#define VISCOSITY_COEFF 0.0f      // fractional change per °C away from 25 °C; 0 = off
#define NTC_BETA 3950.0f
#define NTC_R25 10000.0f
#define NTC_RSERIES 10000.0f
#define TDS_K 1.0f                // probe factor; set it against a TDS pen in a glass of tap water

// ---- Behaviour ----
#define CHECK_INTERVAL_MS 2000    // while idle, look for water this often
#define CHECK_WINDOW_MS 150       // flow sensor powered for this long on each look
#define END_OF_USE_MS 3000        // no pulses for this long = the use has ended
#define SCALD_C 45.0f
#define LEFT_OPEN_MIN_S 180       // unattended flow must run at least this long...
#define LEFT_OPEN_CV 0.04f        // ...and be this steady (std dev / mean over the last minute)
#define LOW_BATT_MV 3500
#define TDS_HIGH_PPM 300
#define HALO_FULL_MS 5000         // in minimal halo mode, the halo shows for the first 5 s of a use
#define RING_LEDS 16
#define HALO_BRIGHTNESS 60        // 0-255; keep it low to save battery
#define DEFAULT_USE_LIMIT_L 10.0f
#define DEFAULT_DAILY_LIMIT_L 150.0f
#define UVC_GAP_MIN 120           // at least 2 hours between UV-C cycles
#define BATTERY_MAH 1500.0f
#define DAILY_USE_MAH 25.0f       // rough average, used only for the "days left" estimate
