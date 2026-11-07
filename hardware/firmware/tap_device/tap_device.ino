// =====================================================================
//  HydroTrack tap device firmware (ESP32-S3 DevKitC-1)
// =====================================================================
//  What it does
//   * Idle: light sleep. Every 2 s it powers the flow sensor for 150 ms
//     to see if water is running, then cuts the power again.
//   * Water running: counts litres, reads temperature, reads TDS once,
//     drives the halo, sends a LIVE packet to the valve box every 2 s.
//   * Spots a tap left open (steady flow, nobody using it) and scalding
//     water, and tells the valve box.
//   * When the use ends: sends one USE record, runs a short UV-C cycle
//     while water stands in the chamber, then goes back to sleep.
//
//  Settings: config.h. Radio protocol: ht_protocol.h.
//  Board: "ESP32S3 Dev Module", PSRAM "OPI PSRAM", Flash 16MB.
//  Functions are defined above where they are used (this Mac's Arduino
//  setup has no ctags, so the IDE can't add prototypes for us).
// =====================================================================

#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <esp_sleep.h>
#include <driver/gpio.h>
#include <Preferences.h>
#include <math.h>
#include "config.h"
#include "ht_protocol.h"

// ---------------------------------------------------------------------
//  State
// ---------------------------------------------------------------------
enum Mode { IDLE, ACTIVE };
static Mode mode = IDLE;

volatile uint32_t flowPulses = 0;
void IRAM_ATTR onFlowPulse() { flowPulses = flowPulses + 1; }

static uint32_t deviceId = 0;
static uint8_t seqNo = 0;
static uint8_t gatewayChannel = 0;           // 0 = not paired yet
static Preferences prefs;

// Settings that the valve box sends with every ACK
struct Settings {
  uint8_t profile = HT_KITCHEN;
  float useLimitL = DEFAULT_USE_LIMIT_L;
  float dailyLimitL = DEFAULT_DAILY_LIMIT_L;
  uint8_t haloMinimal = 1;
  uint8_t uvcMinutes = 2;
  uint8_t valveOpen = 1;
} settings;

// Day bookkeeping (local time from the valve box)
static uint32_t epochAtSync = 0, millisAtSync = 0, currentDay = 0;
static float todayLitres = 0;

// The current use
struct Use {
  uint32_t startMs = 0, lastPulseMs = 0;
  uint32_t pulsesAtStart = 0, lastPulses = 0;
  float litres = 0, tempSum = 0, tempMax = -100, lastTemp = NAN, flowLpm = 0;
  uint32_t tempCount = 0;
  uint16_t tdsPpm = 0;
  bool tdsDone = false, scaldSent = false, leftOpenSent = false, overLimitBeeped = false;
  float flowWin[60]; uint8_t flowWinN = 0, flowWinI = 0;   // 1 sample per second for the unattended check
  uint32_t lastWinMs = 0;
} use;

static uint32_t lastUvcMs = 0;
static bool uvcEverRan = false;
static uint16_t battMv = 4000;
static bool lowBattSent = false;

// ---------------------------------------------------------------------
//  Small helpers
// ---------------------------------------------------------------------
void logf(const char *fmt, ...) {
#if BENCH_MODE
  char buf[200];
  va_list ap; va_start(ap, fmt); vsnprintf(buf, sizeof buf, fmt, ap); va_end(ap);
  Serial.println(buf);
#endif
}

uint32_t localEpochNow() {
  if (!epochAtSync) return 0;
  return epochAtSync + (millis() - millisAtSync) / 1000;
}

void rollDayIfNeeded() {
  uint32_t e = localEpochNow();
  if (!e) return;
  uint32_t day = e / 86400;
  if (currentDay && day != currentDay) { todayLitres = 0; lowBattSent = false; }
  currentDay = day;
}

// ---------------------------------------------------------------------
//  Power switches
// ---------------------------------------------------------------------
void ringClear();

void powerSensors(bool on) {
  if (!on) ringClear();                       // data line low before the ring loses power
  digitalWrite(PIN_PWR_EN, on ? LOW : HIGH);  // P-MOSFET: LOW = on
}

// ---------------------------------------------------------------------
//  WS2812B ring through the RMT peripheral (no library needed)
// ---------------------------------------------------------------------
static rmt_data_t ringBits[RING_LEDS * 24];
static uint8_t ringRGB[RING_LEDS][3];

void ringShow() {
  int i = 0;
  for (int n = 0; n < RING_LEDS; n++) {
    uint8_t grb[3] = { ringRGB[n][1], ringRGB[n][0], ringRGB[n][2] };
    for (int c = 0; c < 3; c++)
      for (int b = 7; b >= 0; b--) {
        bool one = grb[c] & (1 << b);
        ringBits[i].level0 = 1; ringBits[i].duration0 = one ? 8 : 4;   // 10 MHz ticks: 0.8 / 0.4 us high
        ringBits[i].level1 = 0; ringBits[i].duration1 = one ? 4 : 8;
        i++;
      }
  }
  rmtWrite(PIN_RING, ringBits, RMT_SYMBOLS_OF(ringBits), RMT_WAIT_FOR_EVER);
}

void ringFill(uint8_t r, uint8_t g, uint8_t b) {
  for (int n = 0; n < RING_LEDS; n++) { ringRGB[n][0] = r; ringRGB[n][1] = g; ringRGB[n][2] = b; }
  ringShow();
}

void ringClear() { ringFill(0, 0, 0); }

// ---------------------------------------------------------------------
//  Buzzer
// ---------------------------------------------------------------------
void beep(uint16_t freq, uint16_t ms) {
  ledcWriteTone(PIN_BUZZER, freq);
  delay(ms);
  ledcWriteTone(PIN_BUZZER, 0);
}

// ---------------------------------------------------------------------
//  Sensors
// ---------------------------------------------------------------------
float readTempC() {
  float vs[5];
  for (int i = 0; i < 5; i++) vs[i] = analogReadMilliVolts(PIN_NTC) / 1000.0f;
  for (int i = 0; i < 4; i++) for (int j = i + 1; j < 5; j++) if (vs[j] < vs[i]) { float t = vs[i]; vs[i] = vs[j]; vs[j] = t; }
  float v = vs[2];                                   // median
  if (v < 0.02f || v > 3.28f) return NAN;
  float r = NTC_RSERIES * v / (3.3f - v);
  return 1.0f / (logf(r / NTC_R25) / NTC_BETA + 1.0f / 298.15f) - 273.15f;
}

uint16_t readTdsPpm(float tempC) {
  digitalWrite(PIN_TDS_PWR, HIGH);
  delay(300);                                        // let the AC excitation settle
  uint32_t mv = 0;
  for (int i = 0; i < 16; i++) { mv += analogReadMilliVolts(PIN_TDS); delay(5); }
  digitalWrite(PIN_TDS_PWR, LOW);
  float v = mv / 16000.0f;
  if (isnan(tempC)) tempC = 25;
  float vc = v / (1.0f + 0.02f * (tempC - 25.0f));   // temperature compensation, about 2 %/°C
  float ppm = (133.42f * vc * vc * vc - 255.86f * vc * vc + 857.39f * vc) * 0.5f * TDS_K;
  return ppm < 0 ? 0 : (uint16_t)lroundf(ppm);
}

uint16_t readBatteryMv() { return (uint16_t)(analogReadMilliVolts(PIN_BATT) * 2); }

float batteryDaysLeft(uint16_t mv) {
  float pct = constrain((mv - 3300) / 900.0f, 0.0f, 1.0f);
  return pct * BATTERY_MAH / DAILY_USE_MAH;
}

// Litres for a burst of pulses, with the calibration corrections
float pulsesToLitres(uint32_t pulses, float lpm, float tempC) {
  float k = PULSES_PER_LITRE;
  if (CAL_LOW_FLOW_GAIN != 0 && lpm < 2.0f) k *= 1.0f + CAL_LOW_FLOW_GAIN * (2.0f - lpm) / 2.0f;
  if (VISCOSITY_COEFF != 0 && !isnan(tempC)) k *= 1.0f + VISCOSITY_COEFF * (tempC - 25.0f);
  return pulses / k;
}

// ---------------------------------------------------------------------
//  Radio (ESP-NOW to the valve box)
// ---------------------------------------------------------------------
static volatile bool ackReceived = false;
static HtAck lastAck;
static const uint8_t BROADCAST[6] = { 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF };
static bool radioUp = false;

void onRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  if (len != (int)sizeof(HtAck)) return;
  const HtAck *a = (const HtAck *)data;
  if (a->h.magic != HT_MAGIC || a->h.type != HT_ACK || a->h.deviceId != deviceId) return;
  memcpy((void *)&lastAck, a, sizeof(HtAck));
  ackReceived = true;
}

void radioOn(uint8_t channel) {
  if (!radioUp) {
    esp_wifi_start();
    esp_now_init();
    esp_now_register_recv_cb(onRecv);
    esp_now_peer_info_t peer = {};
    memcpy(peer.peer_addr, BROADCAST, 6);
    peer.channel = 0;                     // use the current channel
    peer.encrypt = false;
    esp_now_add_peer(&peer);
    radioUp = true;
  }
  esp_wifi_set_channel(channel ? channel : 1, WIFI_SECOND_CHAN_NONE);
}

void radioOff() {
  if (!radioUp) return;
  esp_now_deinit();
  esp_wifi_stop();
  radioUp = false;
}

void fillHeader(HtHeader &h, HtType t) {
  h.magic = HT_MAGIC; h.version = HT_VERSION; h.type = t; h.seq = seqNo++; h.deviceId = deviceId;
}

void applyAck() {
  HtAck a; memcpy(&a, (const void *)&lastAck, sizeof a);
  settings.profile = a.profile;
  if (a.useLimitL > 0) settings.useLimitL = a.useLimitL;
  if (a.dailyLimitL > 0) settings.dailyLimitL = a.dailyLimitL;
  settings.haloMinimal = a.haloMinimal;
  settings.uvcMinutes = a.uvcMinutes;
  settings.valveOpen = a.valveOpen;
  if (a.localEpoch) { epochAtSync = a.localEpoch; millisAtSync = millis(); rollDayIfNeeded(); }
  if (a.channel && a.channel != gatewayChannel) {
    gatewayChannel = a.channel;
    prefs.putUChar("ch", gatewayChannel);
  }
}

// Send a packet and wait briefly for the valve box's ACK
bool sendPacket(const void *buf, size_t len) {
  if (!radioUp) radioOn(gatewayChannel);
  ackReceived = false;
  esp_now_send(BROADCAST, (const uint8_t *)buf, len);
  uint32_t t0 = millis();
  while (!ackReceived && millis() - t0 < 40) delay(1);
  if (ackReceived) applyAck();
  return ackReceived;
}

// Find the valve box: try every channel until one answers
bool pairWithValveBox() {
  HtHeader hello;
  for (uint8_t ch = 1; ch <= 13; ch++) {
    radioOn(ch);
    fillHeader(hello, HT_HELLO);
    gatewayChannel = ch;
    if (sendPacket(&hello, sizeof hello)) {
      prefs.putUChar("ch", gatewayChannel);
      logf("Paired with the valve box on channel %u", gatewayChannel);
      return true;
    }
  }
  gatewayChannel = 0;
  logf("No valve box found; working on my own");
  return false;
}

void sendAlert(HtAlert type, float value) {
  HtAlertMsg m; fillHeader(m.h, HT_ALERT); m.alert = type; m.value = value;
  if (!sendPacket(&m, sizeof m) && gatewayChannel) pairWithValveBox();
  logf("ALERT %u value %.1f", type, value);
}

// ---------------------------------------------------------------------
//  Halo
// ---------------------------------------------------------------------
void haloFrame(uint32_t now, bool scald, bool unattended) {
  float frac = settings.useLimitL > 0 ? use.litres / settings.useLimitL : 0;
  uint32_t age = now - use.startMs;
  uint8_t r = 0, g = 0, b = 0;
  float k = 1.0f;
  bool warning = scald || unattended || frac >= 0.75f;
  if (scald) { r = 255; k = ((now / 50) % 2) ? 1.0f : 0.0f; }                                  // 10 Hz red flash
  else if (unattended) { if ((now / 500) % 2) { r = 255; } else { r = 255; g = 120; } }        // red / amber alternating
  else if (frac >= 1.0f) { r = 255; k = 0.35f + 0.65f * (0.5f + 0.5f * sinf(now / 53.0f)); }  // red pulse
  else if (frac >= 0.75f) { r = 255; g = 140; k = 0.3f + 0.7f * (0.5f + 0.5f * sinf(now / 127.0f)); }  // amber pulse
  else { g = 70; b = 255; }                                                                    // calm blue
  if (age < 1500 && battMv < LOW_BATT_MV && !warning) { r = 255; g = 200; b = 0; k = ((now / 250) % 2) ? 1.0f : 0.0f; }
  if (settings.haloMinimal && !warning && age > HALO_FULL_MS) k = 0;                           // save battery
  float s = k * HALO_BRIGHTNESS / 255.0f;
  ringFill(r * s, g * s, b * s);
}

// ---------------------------------------------------------------------
//  Tap left open: long, very steady flow
// ---------------------------------------------------------------------
bool looksUnattended(uint32_t now) {
  if (now - use.startMs < (uint32_t)LEFT_OPEN_MIN_S * 1000 || use.flowWinN < 60) return false;
  float mean = 0, var = 0;
  for (int i = 0; i < 60; i++) mean += use.flowWin[i];
  mean /= 60;
  if (mean < 0.5f) return false;
  for (int i = 0; i < 60; i++) var += (use.flowWin[i] - mean) * (use.flowWin[i] - mean);
  float cv = sqrtf(var / 60) / mean;
  return cv < LEFT_OPEN_CV;
}

// ---------------------------------------------------------------------
//  UV-C cycle while water stands in the chamber
// ---------------------------------------------------------------------
void runUvcCycle() {
  if (!settings.uvcMinutes) return;
  if (uvcEverRan && millis() - lastUvcMs < (uint32_t)UVC_GAP_MIN * 60000UL) return;
  logf("UV-C on for %u min", settings.uvcMinutes);
  powerSensors(true);                          // keep watching the flow sensor
  uint32_t p0 = flowPulses, t0 = millis();
  digitalWrite(PIN_UVC_EN, HIGH);
  while (millis() - t0 < settings.uvcMinutes * 60000UL) {
    delay(200);
    if (flowPulses - p0 > 2) { logf("Water started: UV-C off"); break; }   // never run UV-C with water flowing
  }
  digitalWrite(PIN_UVC_EN, LOW);
  lastUvcMs = millis(); uvcEverRan = true;
}

// ---------------------------------------------------------------------
//  Use start / end
// ---------------------------------------------------------------------
void startUse() {
  mode = ACTIVE;
  attachInterrupt(digitalPinToInterrupt(PIN_FLOW), onFlowPulse, FALLING);
  use = Use();
  use.startMs = use.lastPulseMs = use.lastWinMs = millis();
  use.pulsesAtStart = use.lastPulses = flowPulses;
  battMv = readBatteryMv();
  if (gatewayChannel) radioOn(gatewayChannel);
  logf("Use started");
}

void endUse() {
  uint32_t now = millis();
  uint16_t secs = (now - use.startMs - END_OF_USE_MS) / 1000;
  HtUse u; fillHeader(u.h, HT_USE);
  u.litres = use.litres;
  u.avgTempC = use.tempCount ? use.tempSum / use.tempCount : NAN;
  u.maxTempC = use.tempMax;
  u.todayLitres = todayLitres;
  u.seconds = secs; u.tdsPpm = use.tdsPpm; u.battMv = battMv;
  u.flags = (use.scaldSent ? HT_F_SCALD : 0) | (use.leftOpenSent ? HT_F_UNATTENDED : 0) | (battMv < LOW_BATT_MV ? HT_F_LOW_BATT : 0) |
            (VISCOSITY_COEFF != 0 ? HT_F_VISCOSITY : 0);
  if (gatewayChannel && !sendPacket(&u, sizeof u)) pairWithValveBox();
  logf("Use ended: %.2f L in %u s, today %.1f L", use.litres, secs, todayLitres);
  detachInterrupt(digitalPinToInterrupt(PIN_FLOW));
  powerSensors(false);
  radioOff();
  if (battMv < LOW_BATT_MV && !lowBattSent) { sendAlert(HT_AL_LOW_BATTERY, battMv / 1000.0f); lowBattSent = true; radioOff(); }
  runUvcCycle();
  powerSensors(false);
  mode = IDLE;
}

// One step of an active use, called about every 20 ms
void activeStep() {
  static uint32_t lastCalc = 0, lastLive = 0;
#if BENCH_MODE
  static uint32_t lastPrint = 0;
#endif
  uint32_t now = millis();

  // Flow, every 250 ms
  if (now - lastCalc >= 250) {
    noInterrupts(); uint32_t p = flowPulses; interrupts();
    uint32_t dp = p - use.lastPulses; use.lastPulses = p;
    float dt = (now - lastCalc) / 1000.0f; lastCalc = now;
    float hz = dp / dt;
    use.flowLpm = 0.6f * use.flowLpm + 0.4f * (hz * 60.0f / PULSES_PER_LITRE);
    if (dp) {
      float l = pulsesToLitres(dp, use.flowLpm, use.lastTemp);
      use.litres += l; todayLitres += l; use.lastPulseMs = now;
    }
    float t = readTempC();
    if (!isnan(t)) { use.lastTemp = t; use.tempSum += t; use.tempCount++; if (t > use.tempMax) use.tempMax = t; }
  }
  // Once a second, keep a minute of flow readings for the unattended check
  if (now - use.lastWinMs >= 1000) {
    use.lastWinMs = now;
    use.flowWin[use.flowWinI] = use.flowLpm; use.flowWinI = (use.flowWinI + 1) % 60;
    if (use.flowWinN < 60) use.flowWinN++;
  }
  // TDS once per use, after 3 s of flow so the chamber holds fresh water
  if (!use.tdsDone && now - use.startMs > 3000) {
    use.tdsPpm = readTdsPpm(use.lastTemp); use.tdsDone = true;
    if (use.tdsPpm >= TDS_HIGH_PPM) sendAlert(HT_AL_TDS_HIGH, use.tdsPpm);
  }
  bool scald = !isnan(use.lastTemp) && use.lastTemp >= SCALD_C;
  bool unattended = looksUnattended(now);
  if (scald && !use.scaldSent) { use.scaldSent = true; sendAlert(HT_AL_SCALD, use.lastTemp); }
  if (unattended && !use.leftOpenSent) { use.leftOpenSent = true; sendAlert(HT_AL_LEFT_OPEN, use.litres); }
  // Buzzer: scald beeps every 2 s, unattended chirps every 10 s, one beep when the use passes its limit
  if (scald && (now / 2000) != ((now - 20) / 2000)) { beep(3200, 60); delay(60); beep(3200, 60); }
  if (unattended && (now / 10000) != ((now - 20) / 10000)) beep(2400, 120);
  if (!use.overLimitBeeped && use.litres > settings.useLimitL) { use.overLimitBeeped = true; beep(1800, 150); }

  haloFrame(now, scald, unattended);

  // Live packet every 2 s
  if (gatewayChannel && now - lastLive >= 2000) {
    lastLive = now;
    HtLive m; fillHeader(m.h, HT_LIVE);
    m.flowLpm = use.flowLpm; m.useLitres = use.litres; m.todayLitres = todayLitres;
    m.tempC = use.lastTemp; m.tdsPpm = use.tdsPpm; m.battMv = battMv; m.useSeconds = (now - use.startMs) / 1000;
    m.flags = (scald ? HT_F_SCALD : 0) | (unattended ? HT_F_UNATTENDED : 0) | (battMv < LOW_BATT_MV ? HT_F_LOW_BATT : 0) |
              (VISCOSITY_COEFF != 0 ? HT_F_VISCOSITY : 0);
    sendPacket(&m, sizeof m);
  }
#if BENCH_MODE
  if (now - lastPrint >= 1000) {
    lastPrint = now;
    logf("%5.1f s | %.2f L/min | use %.2f L | today %.1f L | %.1f C | TDS %u ppm | batt %u mV%s%s",
         (now - use.startMs) / 1000.0f, use.flowLpm, use.litres, todayLitres, use.lastTemp, use.tdsPpm, battMv,
         scald ? " | SCALD" : "", unattended ? " | LEFT OPEN?" : "");
  }
#endif
  if (now - use.lastPulseMs > END_OF_USE_MS) endUse();
}

// ---------------------------------------------------------------------
//  Idle: is water running?
// ---------------------------------------------------------------------
bool lookForWater() {
  powerSensors(true);
  delay(3);
#if BENCH_MODE
  uint32_t p0 = flowPulses;
  attachInterrupt(digitalPinToInterrupt(PIN_FLOW), onFlowPulse, FALLING);
  delay(CHECK_WINDOW_MS);
  detachInterrupt(digitalPinToInterrupt(PIN_FLOW));
  bool water = flowPulses - p0 >= 1;
#else
  // Sleep until the sensor output changes level (the rotor moved) or the window ends
  int level = digitalRead(PIN_FLOW);
  gpio_wakeup_enable((gpio_num_t)PIN_FLOW, level ? GPIO_INTR_LOW_LEVEL : GPIO_INTR_HIGH_LEVEL);
  esp_sleep_enable_gpio_wakeup();
  esp_sleep_enable_timer_wakeup((uint64_t)CHECK_WINDOW_MS * 1000ULL);
  esp_light_sleep_start();
  bool water = esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_GPIO;
  gpio_wakeup_disable((gpio_num_t)PIN_FLOW);
  esp_sleep_disable_wakeup_source(ESP_SLEEP_WAKEUP_GPIO);
#endif
  if (!water) powerSensors(false);
  return water;
}

void idleStep() {
  if (lookForWater()) { startUse(); return; }
#if BENCH_MODE
  static uint32_t lastPrint = 0;
  if (millis() - lastPrint > 5000) {
    lastPrint = millis();
    logf("idle | %.1f C | batt %u mV | today %.1f L | %s", readTempC(), readBatteryMv(), todayLitres,
         gatewayChannel ? "paired" : "no valve box");
  }
  delay(CHECK_INTERVAL_MS - CHECK_WINDOW_MS);
#else
  esp_sleep_enable_timer_wakeup((uint64_t)(CHECK_INTERVAL_MS - CHECK_WINDOW_MS) * 1000ULL);
  esp_light_sleep_start();
#endif
}

// ---------------------------------------------------------------------
//  Setup and loop
// ---------------------------------------------------------------------
void setup() {
  pinMode(PIN_PWR_EN, OUTPUT); digitalWrite(PIN_PWR_EN, HIGH);   // everything off first
  pinMode(PIN_UVC_EN, OUTPUT); digitalWrite(PIN_UVC_EN, LOW);
  pinMode(PIN_TDS_PWR, OUTPUT); digitalWrite(PIN_TDS_PWR, LOW);
  pinMode(PIN_FLOW, INPUT_PULLUP);
  analogReadResolution(12);
  ledcAttach(PIN_BUZZER, 2000, 8);
  rmtInit(PIN_RING, RMT_TX_MODE, RMT_MEM_NUM_BLOCKS_1, 10000000);
#if BENCH_MODE
  Serial.begin(115200);
  delay(1500);
#endif
  WiFi.mode(WIFI_STA);                                          // ESP-NOW needs the Wi-Fi driver, not a network
  uint8_t mac[6]; esp_wifi_get_mac(WIFI_IF_STA, mac);
  deviceId = ((uint32_t)mac[2] << 24) | ((uint32_t)mac[3] << 16) | ((uint32_t)mac[4] << 8) | mac[5];
  esp_wifi_stop();
  prefs.begin("hydrotrack", false);
  gatewayChannel = prefs.getUChar("ch", 0);
  logf("HydroTrack tap %08lX", (unsigned long)deviceId);

  // Hello: a quick blue sweep, then find the valve box
  powerSensors(true);
  for (int n = 0; n < RING_LEDS; n++) { ringRGB[n][2] = 40; ringShow(); delay(25); }
  powerSensors(false);
  HtHeader hello; fillHeader(hello, HT_HELLO);
  if (!gatewayChannel || !sendPacket(&hello, sizeof hello)) pairWithValveBox();
  radioOff();
}

void loop() {
  if (mode == ACTIVE) { activeStep(); delay(20); }
  else idleStep();
}
