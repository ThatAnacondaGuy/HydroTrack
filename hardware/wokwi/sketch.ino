// ====================================================================
//  HydroTrack v3.0 — Ambient Smart Tap | Wokwi Simulation Firmware
// ====================================================================
//  La Trobe Technology Infusion Grand Challenge 2026
//  "Smart City Innovation"
//
//  This firmware simulates the complete HydroTrack v3.0 digital logic
//  using Wokwi proxy components mapped to the real hardware:
//
//    REAL HARDWARE               → WOKWI PROXY
//    ─────────────────────────── → ──────────────────────────
//    WS2812B 16-LED Halo Ring    → 16x Chained NeoPixels
//    275nm UV-C SMD LED          → Purple LED + 330Ω Resistor
//    10K NTC Thermistor          → NTC Temperature Sensor
//    Analog TDS Sensor (AC exc.) → Rotary Potentiometer
//    27mm Piezoelectric Mic      → Slide Potentiometer
//    Vortex Flow Sensor (PCNT)   → Pushbutton (pulse interrupt)
// ====================================================================

#include <Adafruit_NeoPixel.h>
#include <math.h>

// ========================== PIN DEFINITIONS ==========================
#define PIN_WS2812B       4     // WS2812B Ambient Halo Data In
#define PIN_UVC_LED       5     // UV-C Sterilization LED (Digital Out)
#define PIN_NTC           6     // NTC Thermistor → ADC1 Channel
#define PIN_TDS           7     // TDS Sensor Proxy → ADC1 Channel
#define PIN_PIEZO         8     // Piezo Acoustic Mic Proxy → ADC1 Channel
#define PIN_FLOW_BTN      15    // Flow Sensor Pushbutton → Interrupt

// ======================== SYSTEM CONSTANTS ===========================
#define NUM_PIXELS        16    // WS2812B Ring pixel count
#define ADC_RESOLUTION    12    // 12-bit ADC (0–4095)
#define ADC_MAX           4095.0
#define VCC               3.3   // Supply voltage
#define DEBOUNCE_MS       200   // Button debounce (ms)
#define SCALD_THRESHOLD   50.0  // °C — Thermal safety override
#define SERIAL_BAUD       115200
#define SERIAL_TX_BUFFER  2048  // Holds a full telemetry frame so printing never blocks
#define HALO_FRAME_MS     20    // Halo animation refresh (50 fps)
#define TELEMETRY_MS      500   // Serial telemetry interval

// ================= TARGET 150 THRESHOLDS (SCALED) ====================
// In real hardware, 1 pulse ≈ 1 liter (via K-factor calibration).
// For simulation, each button press = 1 "liter" consumed.
// Thresholds are scaled down for interactive demo:
//   0–15  clicks → OPTIMAL    (Blue)    [≈ 0–100L]
//   16–25 clicks → APPROACHING (Amber)  [≈ 100–150L]
//   >25   clicks → EXCEEDED   (Red)     [≈ >150L]
#define TIER_OPTIMAL      15
#define TIER_APPROACHING  25

// ==================== NTC THERMISTOR CONSTANTS =======================
// Steinhart-Hart Beta parameter method
// R0 = 10kΩ at T0 = 25°C (298.15K), Beta = 3950
#define NTC_R_REF         10000.0   // Reference resistor (ohms)
#define NTC_R0            10000.0   // NTC resistance at 25°C
#define NTC_T0            298.15    // Reference temp in Kelvin
#define NTC_BETA          3950.0    // Beta coefficient

// ======================== COLOR DEFINITIONS ===========================
// Target 150 Ambient UI colors (approximate CIE wavelengths)
#define COLOR_BLUE_R      0       // ~470nm Cool Blue
#define COLOR_BLUE_G      40
#define COLOR_BLUE_B      255

#define COLOR_AMBER_R     255     // ~590nm Warm Amber
#define COLOR_AMBER_G     165
#define COLOR_AMBER_B     0

#define COLOR_RED_R       255     // ~620nm Alert Red
#define COLOR_RED_G       0
#define COLOR_RED_B       0

// ===================== GLOBAL VARIABLES ==============================
Adafruit_NeoPixel halo(NUM_PIXELS, PIN_WS2812B, NEO_GRB + NEO_KHZ800);

// Flow pulse counter (volatile — modified inside ISR)
volatile unsigned long flowPulseCount = 0;
volatile unsigned long lastInterruptTime = 0;

// UV-C sterilization state
bool uvcActive = true;

// Telemetry data struct (mirrors the ESP-NOW payload concept)
struct TelemetryPacket {
  float    temperature;     // °C from NTC
  float    tdsVoltage;      // Raw voltage from TDS sensor
  float    tdsPPM;          // Estimated TDS in ppm
  float    acousticLevel;   // Piezo signal strength (0–100%)
  uint32_t flowPulses;      // Cumulative flow pulses
  bool     scaldAlert;      // Thermal safety flag
  bool     leakDetected;    // Acoustic anomaly flag
  uint8_t  targetTier;      // 0=Optimal, 1=Approaching, 2=Exceeded
};

TelemetryPacket telemetry;

// ===================== INTERRUPT SERVICE ROUTINE =====================
// Simulates the ESP32-S3 PCNT (Pulse Counter) peripheral.
// In real hardware, the vortex flow sensor generates pulses at a
// frequency proportional to fluid velocity (Von Kármán principle).
// Here, each button press = one discrete vortex pulse = ~1 liter.
void IRAM_ATTR flowPulseISR() {
  unsigned long currentTime = millis();
  // Software debounce to prevent double-counting
  if (currentTime - lastInterruptTime > DEBOUNCE_MS) {
    flowPulseCount = flowPulseCount + 1;
    lastInterruptTime = currentTime;
  }
}

// ============================== SETUP ================================
void setup() {
  Serial.setTxBufferSize(SERIAL_TX_BUFFER);  // Must be called before begin()
  Serial.begin(SERIAL_BAUD);
  while (!Serial && millis() < 3000); // Wait for serial (max 3s)

  Serial.println();
  Serial.println("╔══════════════════════════════════════════════════╗");
  Serial.println("║   HydroTrack v3.0 — Ambient Smart Tap Node      ║");
  Serial.println("║   Wokwi Simulation | La Trobe Grand Challenge   ║");
  Serial.println("╚══════════════════════════════════════════════════╝");
  Serial.println();

  // --- GPIO Initialization ---
  pinMode(PIN_UVC_LED, OUTPUT);
  pinMode(PIN_FLOW_BTN, INPUT_PULLUP);

  // ADC configuration (12-bit resolution for all analog channels)
  analogReadResolution(ADC_RESOLUTION);

  // --- NeoPixel Ambient Halo Initialization ---
  halo.begin();
  halo.setBrightness(80);  // Moderate brightness for simulation
  setAllPixels(halo.Color(COLOR_BLUE_R, COLOR_BLUE_G, COLOR_BLUE_B));
  Serial.println("[HALO]  WS2812B Ring initialized (16 LEDs on GPIO 4)");

  // --- Flow Sensor Interrupt (PCNT Proxy) ---
  attachInterrupt(digitalPinToInterrupt(PIN_FLOW_BTN), flowPulseISR, FALLING);
  Serial.println("[FLOW]  Vortex pulse interrupt attached (GPIO 15)");

  // --- UV-C Sterilization LED ---
  digitalWrite(PIN_UVC_LED, HIGH);
  Serial.println("[UV-C]  275nm sterilization LED active (GPIO 5)");

  // --- Sensor Initialization ---
  Serial.println("[NTC]   Thermistor on ADC1 (GPIO 6)");
  Serial.println("[TDS]   Water quality sensor on ADC1 (GPIO 7)");
  Serial.println("[PIEZO] Acoustic diagnostic mic on ADC1 (GPIO 8)");

  Serial.println();
  Serial.println("━━━ SYSTEM READY ━━━");
  Serial.println("→ Press the BLUE button to simulate water flow pulses.");
  Serial.println("→ Adjust the NTC slider to simulate temperature changes.");
  Serial.println("→ Turn the TDS knob to simulate water quality variation.");
  Serial.println("→ Move the Piezo slider to simulate acoustic anomalies.");
  Serial.println();
}

// ============================== LOOP =================================
// Non-blocking scheduler: the halo is redrawn every HALO_FRAME_MS so the
// pulse and 10Hz scald animations render smoothly, while telemetry is
// printed on its own slower TELEMETRY_MS interval.
void loop() {
  static unsigned long lastFrame = 0;
  static unsigned long lastTelemetry = 0;
  unsigned long now = millis();

  if (now - lastFrame >= HALO_FRAME_MS) {
    lastFrame = now;

    // ─── 1. READ ALL SENSORS ─────────────────────────────────────
    readSensors();

    // ─── 2. SAFETY CHECK: THERMAL SCALD OVERRIDE ────────────────
    if (telemetry.scaldAlert) {
      flashScaldWarning();  // Skip normal UI — safety takes priority
    } else {
      // ─── 3. UPDATE AMBIENT HALO (TARGET 150 UI) ───────────────
      updateAmbientHalo();

      // ─── 4. CHECK ACOUSTIC ANOMALIES ──────────────────────────
      checkAcousticAnomalies();
    }
  }

  // ─── 5. PRINT TELEMETRY TO SERIAL (MQTT PAYLOAD PROXY) ──────────
  if (now - lastTelemetry >= TELEMETRY_MS) {
    lastTelemetry = now;
    printTelemetry();
  }
}

// ===================== SENSOR READING FUNCTIONS ======================

void readSensors() {
  // --- NTC Thermistor (Kinematic Viscosity Input) ---
  int ntcRaw = analogRead(PIN_NTC);
  telemetry.temperature = calculateTemperature(ntcRaw);

  // --- TDS Sensor (Bio-Health Water Quality) ---
  int tdsRaw = analogRead(PIN_TDS);
  telemetry.tdsVoltage = (tdsRaw / ADC_MAX) * VCC;
  // TDS sensor outputs 0–2.3V for 0–1000 ppm (linear approximation)
  telemetry.tdsPPM = (telemetry.tdsVoltage / 2.3) * 1000.0;
  if (telemetry.tdsPPM > 1000.0) telemetry.tdsPPM = 1000.0;

  // --- Piezoelectric Acoustic Mic (Pipe Diagnostics) ---
  int piezoRaw = analogRead(PIN_PIEZO);
  telemetry.acousticLevel = (piezoRaw / ADC_MAX) * 100.0;

  // --- Flow Pulse Counter (Vortex Shedding Proxy) ---
  noInterrupts();  // Atomic read of volatile counter
  telemetry.flowPulses = flowPulseCount;
  interrupts();

  // --- Derived Flags ---
  telemetry.scaldAlert = (telemetry.temperature > SCALD_THRESHOLD);
  telemetry.leakDetected = (telemetry.acousticLevel > 75.0);

  // --- Target 150 Tier Classification ---
  if (telemetry.flowPulses <= TIER_OPTIMAL) {
    telemetry.targetTier = 0;  // Optimal
  } else if (telemetry.flowPulses <= TIER_APPROACHING) {
    telemetry.targetTier = 1;  // Approaching
  } else {
    telemetry.targetTier = 2;  // Exceeded
  }
}

// =================== NTC TEMPERATURE CALCULATION =====================
// Uses the Steinhart-Hart Beta parameter equation to convert the
// raw ADC reading from the NTC thermistor voltage divider into °C.
//
// Circuit: VCC → R_REF (10kΩ) → ADC_OUT → NTC → GND
// (matches the Wokwi NTC module: hotter water → lower R_NTC → lower V_out)
// V_out = VCC × R_NTC / (R_NTC + R_REF)
// R_NTC = R_REF × V_out / (VCC - V_out)
//
// 1/T = 1/T0 + (1/β) × ln(R_NTC / R0)

float calculateTemperature(int rawADC) {
  float voltage = (rawADC / ADC_MAX) * VCC;

  // Guard against division by zero at extremes
  if (voltage < 0.01) return 125.0;   // NTC resistance → 0 (very hot)
  if (voltage > (VCC - 0.01)) return -40.0; // NTC resistance → ∞ (very cold)

  // Calculate NTC resistance from voltage divider
  float resistance = NTC_R_REF * voltage / (VCC - voltage);

  // Steinhart-Hart Beta equation
  float steinhart = log(resistance / NTC_R0) / NTC_BETA;
  steinhart += 1.0 / NTC_T0;
  float tempC = (1.0 / steinhart) - 273.15;

  return tempC;
}

// ================ AMBIENT HALO UI (TARGET 150) ======================
// Implements the three-tier macro-environmental user interface:
//   OPTIMAL      → Static Cool Blue    (subconscious positive reinforcement)
//   APPROACHING  → Pulsing Amber       (heightened awareness nudge)
//   EXCEEDED     → Pulsing Red         (urgent behavioral intervention)

void updateAmbientHalo() {
  switch (telemetry.targetTier) {

    case 0: {
      // ── OPTIMAL: Static Cool Blue (470nm) ──
      setAllPixels(halo.Color(COLOR_BLUE_R, COLOR_BLUE_G, COLOR_BLUE_B));
      break;
    }

    case 1: {
      // ── APPROACHING: Pulsing Amber (590nm) ──
      // Sinusoidal brightness modulation — creates a "breathing" effect
      // that draws peripheral attention without active cognitive demand.
      float progress = (float)(telemetry.flowPulses - TIER_OPTIMAL)
                     / (float)(TIER_APPROACHING - TIER_OPTIMAL);
      float pulse = (sin(millis() / 400.0) + 1.0) / 2.0;  // 0.0–1.0
      float intensity = 0.3 + 0.7 * pulse;  // Never fully off

      // Interpolate from blue to amber based on how close to the limit
      uint8_t r = (uint8_t)(COLOR_AMBER_R * progress * intensity);
      uint8_t g = (uint8_t)(COLOR_AMBER_G * (1.0 - progress * 0.3) * intensity);
      uint8_t b = (uint8_t)(COLOR_BLUE_B * (1.0 - progress) * intensity);

      setAllPixels(halo.Color(r, g, b));
      break;
    }

    case 2: {
      // ── EXCEEDED: Fast Pulsing Red (620nm) ──
      // High-frequency pulsation creates visual urgency and friction,
      // inducing cessation of water use.
      float pulse = (sin(millis() / 150.0) + 1.0) / 2.0;
      uint8_t brightness = (uint8_t)(COLOR_RED_R * (0.2 + 0.8 * pulse));

      setAllPixels(halo.Color(brightness, 0, 0));
      break;
    }
  }
}

// ================ THERMAL SCALD SAFETY OVERRIDE =====================
// When water temperature exceeds 50°C, ALL normal UI logic is
// immediately overridden. The WS2812B ring flashes at 10Hz (50ms on,
// 50ms off) in maximum-intensity red — an unmistakable danger signal.
// This directly prevents scalding before physical contact.

void flashScaldWarning() {
  bool ledOn = (millis() / 50) % 2;  // 10Hz flash (50ms period)
  if (ledOn) {
    setAllPixels(halo.Color(255, 0, 0));
  } else {
    setAllPixels(halo.Color(0, 0, 0));
  }
}

// =============== ACOUSTIC ANOMALY DETECTION ==========================
// In real hardware, the TinyML CNN classifies acoustic signatures into:
//   - Micro-Leaks    (70 Hz – 1.5 kHz)
//   - Water Hammer   (10 Hz – 100 Hz)
//   - Pipe Cavitation (>2.0 kHz broadband)
//
// For simulation, we use a simple threshold on the piezo proxy slider.
// Levels >75% trigger a "leak detected" classification.

void checkAcousticAnomalies() {
  if (telemetry.leakDetected) {
    // In real firmware, this would pack an anomaly flag into the
    // ESP-NOW payload and flash a specific LED pattern.
    // For simulation, we just log the alert.
  }
}

// =================== UTILITY FUNCTIONS ===============================

void setAllPixels(uint32_t color) {
  for (int i = 0; i < NUM_PIXELS; i++) {
    halo.setPixelColor(i, color);
  }
  halo.show();
}

// =============== TELEMETRY OUTPUT (MQTT PAYLOAD PROXY) ===============
// In real hardware, this data is packed into a condensed byte array
// and transmitted via ESP-NOW to the gateway, which serializes it
// to JSON and publishes via MQTT to the cloud broker.
//
// For simulation, we print a formatted telemetry dashboard to Serial.

void printTelemetry() {
  Serial.println("╔══════════════════════════════════════════════════╗");
  Serial.println("║          HYDROTRACK v3.0 — TELEMETRY            ║");
  Serial.println("╠══════════════════════════════════════════════════╣");

  // Temperature + Viscosity Compensation Status
  Serial.printf("║ 🌡️  Temperature:    %6.1f °C", telemetry.temperature);
  if (telemetry.scaldAlert) {
    Serial.print("  ⚠️  SCALD ALERT!");
  }
  Serial.println();

  // AI Kinematic Viscosity Compensation indicator
  Serial.printf("║ 🔬 Viscosity Comp: ");
  if (telemetry.temperature < 15.0) {
    Serial.println("ACTIVE (cold water — high viscosity correction)");
  } else if (telemetry.temperature > 35.0) {
    Serial.println("ACTIVE (hot water — low viscosity correction)");
  } else {
    Serial.println("MINIMAL (near 25°C calibration baseline)");
  }

  // TDS Water Quality
  Serial.printf("║ 💧 TDS Reading:    %6.0f ppm  (%.2f V)", telemetry.tdsPPM, telemetry.tdsVoltage);
  if (telemetry.tdsPPM < 150) {
    Serial.println("  [Excellent]");
  } else if (telemetry.tdsPPM < 300) {
    Serial.println("  [Good]");
  } else if (telemetry.tdsPPM < 500) {
    Serial.println("  [Fair]");
  } else {
    Serial.println("  [Poor — UV-C critical!]");
  }

  // Acoustic Diagnostics
  Serial.printf("║ 🎤 Acoustic Level: %6.1f %%", telemetry.acousticLevel);
  if (telemetry.leakDetected) {
    Serial.println("    🚨 ANOMALY DETECTED!");
  } else if (telemetry.acousticLevel > 50.0) {
    Serial.println("    ⚠️  Elevated noise");
  } else {
    Serial.println("    ✅ Normal");
  }

  // Flow Consumption
  Serial.printf("║ 🚰 Flow Pulses:   %6lu L", (unsigned long)telemetry.flowPulses);
  Serial.println();

  // Target 150 Status
  Serial.print("║ 📊 Target 150:    ");
  switch (telemetry.targetTier) {
    case 0:
      Serial.printf("✅ OPTIMAL (%lu/%d L) — Halo: BLUE\n",
                     (unsigned long)telemetry.flowPulses, TIER_OPTIMAL);
      break;
    case 1:
      Serial.printf("⚠️  APPROACHING (%lu/%d L) — Halo: AMBER PULSE\n",
                     (unsigned long)telemetry.flowPulses, TIER_APPROACHING);
      break;
    case 2:
      Serial.printf("🔴 EXCEEDED (%lu L > %d L) — Halo: RED PULSE\n",
                     (unsigned long)telemetry.flowPulses, TIER_APPROACHING);
      break;
  }

  // UV-C Status
  Serial.printf("║ ☣️  UV-C Status:   %s\n", uvcActive ? "ACTIVE (275nm)" : "STANDBY");

  Serial.println("╚══════════════════════════════════════════════════╝");
  Serial.println();
}
