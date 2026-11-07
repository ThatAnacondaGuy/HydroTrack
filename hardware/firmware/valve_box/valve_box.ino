// =====================================================================
//  HydroTrack valve box firmware (ESP32 DevKit V1)
// =====================================================================
//  * Opens and shuts the motorised valve on the main pipe, and checks
//    the valve's feedback wires to know it really got there.
//  * Hears every tap device over ESP-NOW and answers each packet with
//    the time, the valve state and that tap's settings.
//  * Shuts the water by itself when a tap is left open (after a
//    countdown) or when anything runs in away mode.
//  * Box button: press = close / open. Hold 3 s = away mode on / off.
//  * Phone page on home Wi-Fi: http://hydrotrack.local
//  * MQTT (optional, for control from outside the house): publishes
//    telemetry / alert / status in the dashboard backend's format and
//    listens on hydrotrack/<HOME_ID>/valve-box/command.
//
//  Board: "DOIT ESP32 DEVKIT V1" (or "ESP32 Dev Module").
//  Library: PubSubClient by Nick O'Leary (Library Manager).
//  Functions are defined above where they are used (no ctags here).
// =====================================================================

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <Preferences.h>
#include <PubSubClient.h>
#include <time.h>
#include "config.h"
#include "ht_protocol.h"
#include "web_page.h"
#if __has_include("secrets.h")
#include "secrets.h"
#else
#include "secrets.example.h"
#endif

// ---------------------------------------------------------------------
//  State
// ---------------------------------------------------------------------
enum ValveState : uint8_t { V_OPEN, V_CLOSING, V_CLOSED, V_OPENING, V_FAULT };
static const char *VALVE_NAMES[] = { "open", "closing", "closed", "opening", "fault" };
static ValveState valve = V_OPEN;
static uint32_t valveMoveStart = 0;
static char valveReason[64] = "";

struct TapCfg {                     // saved in flash
  uint32_t id;
  char name[20];
  uint8_t profile, haloMinimal, uvcMinutes;
  float useLimitL, dailyLimitL;
};
struct Tap {
  TapCfg cfg;
  float flowLpm, useLitres, todayLitres, tempC;
  uint16_t tdsPpm, battMv, useSeconds;
  uint8_t flags;
  uint32_t lastSeen, lastPublish;
  bool attended;                    // someone said "It's me" for this use
};
static Tap taps[MAX_TAPS];
static int tapCount = 0;
static portMUX_TYPE tapLock = portMUX_INITIALIZER_UNLOCKED;

static bool awayMode = false, autoClose = true;
static bool alertActive = false;
static int alertTap = -1;
static uint32_t alertDeadline = 0;
static uint32_t flashUntil = 0;     // green flash on the ring when a command arrives

static Preferences prefs;
static WebServer server(80);
#if MQTT_TLS
static WiFiClientSecure netClient;
#else
static WiFiClient netClient;
#endif
static PubSubClient mqtt(netClient);
static const uint8_t BROADCAST[6] = { 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF };

// Packets from the radio callback, handled in loop()
struct RxPacket { uint8_t len; uint8_t data[64]; };
static RxPacket rxQueue[16];
static volatile uint8_t rxHead = 0, rxTail = 0;

// ---------------------------------------------------------------------
//  Time
// ---------------------------------------------------------------------
bool haveTime() { return time(nullptr) > 1700000000; }
uint32_t localEpoch() { return haveTime() ? (uint32_t)time(nullptr) + TZ_OFFSET_S : 0; }
void isoNow(char *out, size_t n) {
  time_t t = time(nullptr); struct tm g; gmtime_r(&t, &g);
  strftime(out, n, "%Y-%m-%dT%H:%M:%SZ", &g);
}

// ---------------------------------------------------------------------
//  LED ring (8 x WS2812B) through the RMT peripheral
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
        ringBits[i].level0 = 1; ringBits[i].duration0 = one ? 8 : 4;
        ringBits[i].level1 = 0; ringBits[i].duration1 = one ? 4 : 8;
        i++;
      }
  }
  rmtWrite(PIN_RING, ringBits, RMT_SYMBOLS_OF(ringBits), RMT_WAIT_FOR_EVER);
}
void ringSet(int n, uint8_t r, uint8_t g, uint8_t b, float k) {
  float s = k * RING_BRIGHTNESS / 255.0f;
  ringRGB[n][0] = r * s; ringRGB[n][1] = g * s; ringRGB[n][2] = b * s;
}

bool anyFlow() {
  for (int i = 0; i < tapCount; i++) if (taps[i].flowLpm > 0.05f && millis() - taps[i].lastSeen < 6000) return true;
  return false;
}

void ringFrame() {
  static uint32_t last = 0;
  uint32_t now = millis();
  if (now - last < 30) return;
  last = now;
  float wave = 0.5f + 0.5f * sinf(now / 300.0f);
  for (int n = 0; n < RING_LEDS; n++) {
    if (now < flashUntil) ringSet(n, 40, 255, 120, 1);                                        // command received
    else if (valve == V_CLOSING || valve == V_OPENING) ringSet(n, 255, 150, 0, n == (now / 90) % RING_LEDS ? 1 : 0.15f);  // spinning amber
    else if (valve == V_FAULT) ringSet(n, 255, 0, 0, (now / 250) % 2 ? 1 : 0);
    else if (valve == V_CLOSED) ringSet(n, 255, 20, 10, 0.8f);
    else if (alertActive) {                                                                    // countdown arc
      float left = autoClose ? (float)(int32_t)(alertDeadline - now) / (AUTO_CLOSE_S * 1000.0f) : 1;
      ringSet(n, 255, 140, 0, n < ceilf(left * RING_LEDS) ? 0.4f + 0.6f * wave : 0.05f);
    }
    else if (WiFi.status() != WL_CONNECTED && strlen(WIFI_SSID) && now < 15000) ringSet(n, 200, 200, 200, n == (now / 120) % RING_LEDS ? 0.8f : 0);
    else if (awayMode) ringSet(n, 150, 60, 255, 0.25f + 0.25f * wave);
    else ringSet(n, 40, 90, 255, anyFlow() ? 0.5f + 0.5f * wave : 0.35f);                      // water on
  }
  ringShow();
}

// ---------------------------------------------------------------------
//  Taps
// ---------------------------------------------------------------------
TapCfg defaultCfg(uint32_t id) {
  TapCfg c = {};
  c.id = id;
  snprintf(c.name, sizeof c.name, "Tap %04lX", (unsigned long)(id & 0xFFFF));
  c.profile = HT_KITCHEN; c.haloMinimal = 1; c.uvcMinutes = 2;
  c.useLimitL = 10; c.dailyLimitL = 150;
  return c;
}

void saveTaps() {
  TapCfg cfgs[MAX_TAPS];
  for (int i = 0; i < tapCount; i++) cfgs[i] = taps[i].cfg;
  prefs.putBytes("taps", cfgs, sizeof(TapCfg) * tapCount);
  prefs.putUChar("ntaps", tapCount);
}

void loadTaps() {
  tapCount = min((int)prefs.getUChar("ntaps", 0), MAX_TAPS);
  TapCfg cfgs[MAX_TAPS];
  if (tapCount) prefs.getBytes("taps", cfgs, sizeof(TapCfg) * tapCount);
  for (int i = 0; i < tapCount; i++) { taps[i] = Tap(); taps[i].cfg = cfgs[i]; }
}

int findTap(uint32_t id) {
  for (int i = 0; i < tapCount; i++) if (taps[i].cfg.id == id) return i;
  return -1;
}

int findOrAddTap(uint32_t id) {
  int i = findTap(id);
  if (i >= 0 || tapCount >= MAX_TAPS) return i;
  Tap fresh = Tap(); fresh.cfg = defaultCfg(id);
  portENTER_CRITICAL(&tapLock);                 // the radio callback reads this list
  taps[tapCount] = fresh;
  tapCount++;
  portEXIT_CRITICAL(&tapLock);
  saveTaps();
  return tapCount - 1;
}

const char *profileName(uint8_t p) {
  static const char *n[] = { "kitchen", "basin", "bucket", "garden", "drinking" };
  return p < 5 ? n[p] : "kitchen";
}

// ---------------------------------------------------------------------
//  Radio: answer every tap packet straight away from the Wi-Fi task
// ---------------------------------------------------------------------
void onRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  if (len < (int)sizeof(HtHeader) || len > 64) return;
  const HtHeader *h = (const HtHeader *)data;
  if (h->magic != HT_MAGIC || h->version != HT_VERSION || h->type == HT_ACK) return;
  // ACK with this tap's settings (defaults if it is new; loop() registers it)
  HtAck a = {};
  a.h.magic = HT_MAGIC; a.h.version = HT_VERSION; a.h.type = HT_ACK; a.h.seq = h->seq; a.h.deviceId = h->deviceId;
  a.channel = WiFi.channel(); a.localEpoch = localEpoch();
  a.valveOpen = (valve == V_OPEN || valve == V_OPENING) ? 1 : 0;
  TapCfg c = defaultCfg(h->deviceId);
  portENTER_CRITICAL(&tapLock);
  int i = findTap(h->deviceId);
  if (i >= 0) c = taps[i].cfg;
  portEXIT_CRITICAL(&tapLock);
  a.profile = c.profile; a.useLimitL = c.useLimitL; a.dailyLimitL = c.dailyLimitL;
  a.haloMinimal = c.haloMinimal; a.uvcMinutes = c.uvcMinutes;
  esp_now_send(BROADCAST, (const uint8_t *)&a, sizeof a);
  uint8_t next = (rxHead + 1) % 16;
  if (next == rxTail) return;                 // queue full: drop
  rxQueue[rxHead].len = len; memcpy(rxQueue[rxHead].data, data, len);
  rxHead = next;
}

void startEspNow() {
  if (!strlen(WIFI_SSID)) esp_wifi_set_channel(DEFAULT_CHANNEL, WIFI_SECOND_CHAN_NONE);
  esp_now_init();
  esp_now_register_recv_cb(onRecv);
  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, BROADCAST, 6);
  peer.channel = 0; peer.encrypt = false;
  esp_now_add_peer(&peer);
}

// ---------------------------------------------------------------------
//  MQTT
// ---------------------------------------------------------------------
bool mqttOn() { return strlen(MQTT_HOST) && WiFi.status() == WL_CONNECTED; }

void publish(const char *device, const char *kind, const char *json, bool retain = false) {
  if (!mqttOn() || !mqtt.connected()) return;
  char topic[96];
  snprintf(topic, sizeof topic, "hydrotrack/%s/%s/%s", HOME_ID, device, kind);
  mqtt.publish(topic, json, retain);
}

void publishAlert(const char *device, const char *type, const char *severity, const char *message) {
  char ts[24], json[320];
  isoNow(ts, sizeof ts);
  snprintf(json, sizeof json, "{\"deviceId\":\"%s\",\"zone\":\"%s\",\"type\":\"%s\",\"severity\":\"%s\",\"message\":\"%s\",\"timestamp\":\"%s\"}",
           device, HOME_ID, type, severity, message, ts);
  publish(device, "alert", json);
  Serial.printf("ALERT %s %s: %s\n", device, severity, message);
}

void publishStatus() {
  char ts[24], json[300];
  isoNow(ts, sizeof ts);
  snprintf(json, sizeof json, "{\"deviceId\":\"valve-box\",\"zone\":\"%s\",\"status\":\"online\",\"battery\":0,\"timestamp\":\"%s\","
           "\"valve\":\"%s\",\"away\":%s,\"autoClose\":%s,\"taps\":%d}",
           HOME_ID, ts, VALVE_NAMES[valve], awayMode ? "true" : "false", autoClose ? "true" : "false", tapCount);
  publish("valve-box", "status", json, true);
}

// Telemetry in the exact shape the dashboard backend validates (payloadSchema.ts)
void publishTelemetry(Tap &t) {
  char ts[24], id[16], json[640];
  isoNow(ts, sizeof ts);
  snprintf(id, sizeof id, "tap-%08lx", (unsigned long)t.cfg.id);
  float volts = t.battMv / 1000.0f;
  float days = constrain((t.battMv - 3300) / 900.0f, 0.0f, 1.0f) * 60.0f;
  snprintf(json, sizeof json,
           "{\"deviceId\":\"%s\",\"zone\":\"%s\",\"timestamp\":\"%s\","
           "\"flow\":{\"volumetricRateLpm\":%.2f,\"dailyTotalLiters\":%.2f,\"viscosityCompensated\":%s},"
           "\"thermal\":{\"temperatureC\":%.1f,\"scaldRisk\":%s},"
           "\"waterQuality\":{\"tdsPpm\":%u,\"uvcCycleActive\":%s},"
           "\"acoustic\":{\"classification\":\"Normal\",\"confidence\":0,\"frequencyRangeHz\":null},"
           "\"battery\":{\"voltage\":%.2f,\"estDaysRemaining\":%.0f}}",
           id, HOME_ID, ts, t.flowLpm, t.todayLitres, (t.flags & HT_F_VISCOSITY) ? "true" : "false",
           isnan(t.tempC) ? 0.0f : t.tempC, (t.flags & HT_F_SCALD) ? "true" : "false",
           t.tdsPpm, (t.flags & HT_F_UVC) ? "true" : "false", volts, days);
  publish(id, "telemetry", json);
  t.lastPublish = millis();
}

// Tiny JSON readers for the command messages (no library needed)
bool jsonStr(const char *js, const char *key, char *out, size_t n) {
  char pat[32]; snprintf(pat, sizeof pat, "\"%s\"", key);
  const char *p = strstr(js, pat); if (!p) return false;
  p = strchr(p + strlen(pat), ':'); if (!p) return false;
  while (*++p == ' ') {}
  if (*p != '"') return false;
  size_t i = 0; p++;
  while (*p && *p != '"' && i + 1 < n) out[i++] = *p++;
  out[i] = 0;
  return true;
}
bool jsonNum(const char *js, const char *key, float *v) {
  char pat[32]; snprintf(pat, sizeof pat, "\"%s\"", key);
  const char *p = strstr(js, pat); if (!p) return false;
  p = strchr(p + strlen(pat), ':'); if (!p) return false;
  while (*++p == ' ') {}
  if (!strncmp(p, "true", 4)) { *v = 1; return true; }
  if (!strncmp(p, "false", 5)) { *v = 0; return true; }
  char *end; *v = strtof(p, &end);
  return end != p;
}

// ---------------------------------------------------------------------
//  Valve
// ---------------------------------------------------------------------
void relay(int pin, bool on) { digitalWrite(pin, (on ^ RELAY_ACTIVE_LOW) ? HIGH : LOW); }
bool fbActive(int pin) { return (digitalRead(pin) == LOW) == (bool)FEEDBACK_ACTIVE_LOW; }

void driveValve(bool close) {
#if THREE_WIRE_VALVE
  relay(PIN_RELAY1, close);
  relay(PIN_RELAY2, !close);
#else
  relay(PIN_RELAY1, RELAY_ON_CLOSES ? close : !close);
#endif
}

void requestValve(bool close, const char *why) {
  bool alreadyThere = close ? (valve == V_CLOSED || valve == V_CLOSING) : (valve == V_OPEN || valve == V_OPENING);
  if (alreadyThere) return;
  driveValve(close);
  valve = close ? V_CLOSING : V_OPENING;
  valveMoveStart = millis();
  strlcpy(valveReason, why, sizeof valveReason);
  prefs.putBool("closed", close);
  flashUntil = millis() + 400;
  if (close) { alertActive = false; alertTap = -1; }
  Serial.printf("Valve %s: %s\n", close ? "closing" : "opening", why);
  publishStatus();
}

void valveStep() {
  if (valve != V_CLOSING && valve != V_OPENING) return;
  bool closing = valve == V_CLOSING;
  uint32_t t = millis() - valveMoveStart;
  bool reached;
#if USE_FEEDBACK
  reached = fbActive(closing ? PIN_FB_CLOSED : PIN_FB_OPEN);
  if (!reached && t > 2 * VALVE_TRAVEL_MS) {
    valve = V_FAULT;
    publishAlert("valve-box", "Valve Fault", "critical", closing ? "Valve did not reach closed. Check it and turn the red knob by hand." :
                                                                   "Valve did not reach open. Check it and turn the red knob by hand.");
    publishStatus();
    return;
  }
#else
  reached = t > VALVE_TRAVEL_MS;
#endif
  if (!reached) return;
  valve = closing ? V_CLOSED : V_OPEN;
  Serial.printf("Valve %s\n", VALVE_NAMES[valve]);
  publishStatus();
  if (closing) publishAlert("valve-box", "Water Shut Off", "warning", valveReason);
}

// ---------------------------------------------------------------------
//  What the taps tell us
// ---------------------------------------------------------------------
void startLeftOpenCountdown(int i) {
  if (alertActive || valve != V_OPEN || taps[i].attended) return;
  alertActive = true; alertTap = i;
  alertDeadline = millis() + AUTO_CLOSE_S * 1000UL;
  char dev[16], msg[120];
  snprintf(dev, sizeof dev, "tap-%08lx", (unsigned long)taps[i].cfg.id);
  snprintf(msg, sizeof msg, "%s left open: %.0f L so far. %s", taps[i].cfg.name, taps[i].useLitres,
           autoClose ? "Water shuts in 2 min unless someone answers." : "Auto-close is off.");
  publishAlert(dev, "Tap Left Open", "warning", msg);
}

void handlePacket(const uint8_t *data, int len) {
  const HtHeader *h = (const HtHeader *)data;
  int i = findOrAddTap(h->deviceId);
  if (i < 0) return;
  Tap &t = taps[i];
  bool wasIdle = t.flowLpm < 0.05f || millis() - t.lastSeen > 6000;
  t.lastSeen = millis();
  char dev[16]; snprintf(dev, sizeof dev, "tap-%08lx", (unsigned long)t.cfg.id);

  if (h->type == HT_LIVE && len == sizeof(HtLive)) {
    const HtLive *m = (const HtLive *)data;
    t.flowLpm = m->flowLpm; t.useLitres = m->useLitres; t.todayLitres = m->todayLitres; t.tempC = m->tempC;
    t.tdsPpm = m->tdsPpm; t.battMv = m->battMv; t.useSeconds = m->useSeconds; t.flags = m->flags;
    if (awayMode && valve == V_OPEN) {
      char why[64]; snprintf(why, sizeof why, "Away mode: %s started running", t.cfg.name);
      requestValve(true, why);
      publishAlert(dev, "Water While Away", "critical", why);
    }
    if (m->flags & HT_F_UNATTENDED) startLeftOpenCountdown(i);
    if (wasIdle || millis() - t.lastPublish > LIVE_PUBLISH_MS) publishTelemetry(t);
  } else if (h->type == HT_USE && len == sizeof(HtUse)) {
    const HtUse *m = (const HtUse *)data;
    t.flowLpm = 0; t.useLitres = m->litres; t.todayLitres = m->todayLitres; t.tdsPpm = m->tdsPpm; t.battMv = m->battMv;
    t.flags = m->flags; t.tempC = m->avgTempC; t.attended = false;
    if (alertActive && alertTap == i) { alertActive = false; alertTap = -1; }
    publishTelemetry(t);
  } else if (h->type == HT_ALERT && len == sizeof(HtAlertMsg)) {
    const HtAlertMsg *m = (const HtAlertMsg *)data;
    char msg[120];
    switch (m->alert) {
      case HT_AL_LEFT_OPEN: t.useLitres = m->value; startLeftOpenCountdown(i); break;
      case HT_AL_SCALD: snprintf(msg, sizeof msg, "%s: water at %.0f C, scald risk", t.cfg.name, m->value); publishAlert(dev, "Thermal Hazard", "critical", msg); break;
      case HT_AL_LOW_BATTERY: snprintf(msg, sizeof msg, "%s battery low (%.2f V). Charge it from underneath.", t.cfg.name, m->value); publishAlert(dev, "Low Battery", "warning", msg); break;
      case HT_AL_TDS_HIGH: snprintf(msg, sizeof msg, "%s: TDS %.0f ppm", t.cfg.name, m->value); publishAlert(dev, "Water Quality", "warning", msg); break;
    }
  }
}

void alertStep() {
  if (!alertActive) return;
  if (valve != V_OPEN) { alertActive = false; return; }
  if (autoClose && (int32_t)(millis() - alertDeadline) >= 0) {
    char why[64]; snprintf(why, sizeof why, "Auto-closed: %s was left open", alertTap >= 0 ? taps[alertTap].cfg.name : "a tap");
    requestValve(true, why);
  }
}

void dismissAlert() {
  if (alertTap >= 0) taps[alertTap].attended = true;
  alertActive = false; alertTap = -1;
  flashUntil = millis() + 400;
}

void setAway(bool on) { awayMode = on; prefs.putBool("away", on); flashUntil = millis() + 400; publishStatus(); }
void setAutoClose(bool on) { autoClose = on; prefs.putBool("auto", on); publishStatus(); }

// ---------------------------------------------------------------------
//  MQTT commands: hydrotrack/<HOME_ID>/valve-box/command and .../<tap>/config
// ---------------------------------------------------------------------
void onMqtt(char *topic, byte *payload, unsigned int len) {
  char js[256]; len = min(len, (unsigned int)sizeof js - 1); memcpy(js, payload, len); js[len] = 0;
  char action[16]; float v;
  if (strstr(topic, "/valve-box/command")) {
    if (!jsonStr(js, "action", action, sizeof action)) return;
    if (!strcmp(action, "close")) requestValve(true, "Closed from the app");
    else if (!strcmp(action, "open")) requestValve(false, "Opened from the app");
    else if (!strcmp(action, "dismiss")) dismissAlert();
    else if (!strcmp(action, "away") && jsonNum(js, "value", &v)) setAway(v != 0);
    else if (!strcmp(action, "auto") && jsonNum(js, "value", &v)) setAutoClose(v != 0);
    return;
  }
  const char *p = strstr(topic, "/tap-");
  if (p && strstr(topic, "/config")) {
    uint32_t id = strtoul(p + 5, nullptr, 16);
    int i = findOrAddTap(id); if (i < 0) return;
    TapCfg &c = taps[i].cfg;
    char s[20];
    if (jsonStr(js, "name", s, sizeof s)) strlcpy(c.name, s, sizeof c.name);
    if (jsonStr(js, "profile", s, sizeof s)) for (uint8_t k = 0; k < 5; k++) if (!strcmp(s, profileName(k))) c.profile = k;
    if (jsonNum(js, "useLimitL", &v)) c.useLimitL = v;
    if (jsonNum(js, "dailyLimitL", &v)) c.dailyLimitL = v;
    if (jsonNum(js, "haloMinimal", &v)) c.haloMinimal = v != 0;
    if (jsonNum(js, "uvcMinutes", &v)) c.uvcMinutes = (uint8_t)v;
    saveTaps();
  }
}

void mqttStep() {
  static uint32_t lastTry = 0, lastStatus = 0;
  if (!mqttOn()) return;
  if (!mqtt.connected()) {
    if (millis() - lastTry < 10000) return;
    lastTry = millis();
    char will[64], willMsg[200], ts[24], cid[48];
    snprintf(will, sizeof will, "hydrotrack/%s/valve-box/status", HOME_ID);
    isoNow(ts, sizeof ts);
    snprintf(willMsg, sizeof willMsg, "{\"deviceId\":\"valve-box\",\"zone\":\"%s\",\"status\":\"offline\",\"battery\":0,\"timestamp\":\"%s\"}", HOME_ID, ts);
    snprintf(cid, sizeof cid, "hydrotrack-%s-box", HOME_ID);
    if (mqtt.connect(cid, strlen(MQTT_USER) ? MQTT_USER : nullptr, strlen(MQTT_PASS) ? MQTT_PASS : nullptr, will, 1, true, willMsg)) {
      char sub[64];
      snprintf(sub, sizeof sub, "hydrotrack/%s/valve-box/command", HOME_ID); mqtt.subscribe(sub);
      snprintf(sub, sizeof sub, "hydrotrack/%s/+/config", HOME_ID); mqtt.subscribe(sub);
      Serial.println("MQTT connected");
      publishStatus();
    }
    return;
  }
  mqtt.loop();
  if (millis() - lastStatus > 60000) { lastStatus = millis(); publishStatus(); }
}

// ---------------------------------------------------------------------
//  Phone page + JSON API (home Wi-Fi)
// ---------------------------------------------------------------------
void sendState() {
  String s; s.reserve(1200);
  char buf[256];
  float today = 0;
  for (int i = 0; i < tapCount; i++) today += taps[i].todayLitres;
  snprintf(buf, sizeof buf, "{\"valve\":\"%s\",\"reason\":\"%s\",\"away\":%s,\"autoClose\":%s,\"today\":%.1f,\"alert\":",
           VALVE_NAMES[valve], valveReason, awayMode ? "true" : "false", autoClose ? "true" : "false", today);
  s += buf;
  if (alertActive && alertTap >= 0) {
    int left = max(0, (int)((int32_t)(alertDeadline - millis()) / 1000));
    snprintf(buf, sizeof buf, "{\"title\":\"%s left open\",\"body\":\"Running with nobody using it: %.0f L so far. %s\"}",
             taps[alertTap].cfg.name, taps[alertTap].useLitres, autoClose ? (String("Water shuts in ") + left + " s.").c_str() : "Auto-close is off.");
    s += buf;
  } else s += "null";
  s += ",\"taps\":[";
  for (int i = 0; i < tapCount; i++) {
    Tap &t = taps[i];
    bool fresh = millis() - t.lastSeen < 6000;
    uint32_t ago = t.lastSeen ? (millis() - t.lastSeen) / 60000 : 0;
    char seen[24];
    if (!t.lastSeen) strcpy(seen, "not heard yet"); else if (ago < 1) strcpy(seen, "just now"); else snprintf(seen, sizeof seen, "%lu min ago", (unsigned long)ago);
    snprintf(buf, sizeof buf, "%s{\"id\":\"%08lx\",\"name\":\"%s\",\"profile\":\"%s\",\"flowLpm\":%.2f,\"useLitres\":%.2f,\"todayLitres\":%.2f,\"useLimitL\":%.1f,\"seen\":\"%s\"}",
             i ? "," : "", (unsigned long)t.cfg.id, t.cfg.name, profileName(t.cfg.profile), fresh ? t.flowLpm : 0.0f, t.useLitres, t.todayLitres, t.cfg.useLimitL, seen);
    s += buf;
  }
  s += "]}";
  server.send(200, "application/json", s);
}

void setupWeb() {
  server.on("/", HTTP_GET, []() { server.send_P(200, "text/html", WEB_PAGE); });
  server.on("/api/state", HTTP_GET, sendState);
  server.on("/api/valve", HTTP_POST, []() {
    String a = server.arg("action");
    if (a == "close") requestValve(true, "Closed from the phone");
    else if (a == "open") requestValve(false, "Opened from the phone");
    sendState();
  });
  server.on("/api/dismiss", HTTP_POST, []() { dismissAlert(); sendState(); });
  server.on("/api/settings", HTTP_POST, []() {
    if (server.hasArg("away")) setAway(server.arg("away") == "1");
    if (server.hasArg("auto")) setAutoClose(server.arg("auto") == "1");
    sendState();
  });
  server.on("/api/tap", HTTP_POST, []() {       // ?id=1a2b3c4d&name=Kitchen&profile=kitchen&useLimitL=10
    int i = findTap(strtoul(server.arg("id").c_str(), nullptr, 16));
    if (i < 0) { server.send(404, "text/plain", "No tap with that id"); return; }
    TapCfg &c = taps[i].cfg;
    if (server.hasArg("name")) strlcpy(c.name, server.arg("name").c_str(), sizeof c.name);
    if (server.hasArg("profile")) for (uint8_t k = 0; k < 5; k++) if (server.arg("profile") == profileName(k)) c.profile = k;
    if (server.hasArg("useLimitL")) c.useLimitL = server.arg("useLimitL").toFloat();
    if (server.hasArg("dailyLimitL")) c.dailyLimitL = server.arg("dailyLimitL").toFloat();
    saveTaps();
    sendState();
  });
  server.begin();
  MDNS.begin("hydrotrack");
}

// ---------------------------------------------------------------------
//  Button
// ---------------------------------------------------------------------
void buttonStep() {
  static bool down = false, longDone = false;
  static uint32_t downAt = 0;
  bool pressed = digitalRead(PIN_BUTTON) == LOW;
  uint32_t now = millis();
  if (pressed && !down) { down = true; downAt = now; longDone = false; }
  if (pressed && down && !longDone && now - downAt > LONG_PRESS_MS) { longDone = true; setAway(!awayMode); }
  if (!pressed && down) {
    down = false;
    if (!longDone && now - downAt > 40) {
      if (valve == V_OPEN || valve == V_OPENING) requestValve(true, "Closed with the box button");
      else requestValve(false, "Opened with the box button");
    }
  }
}

// ---------------------------------------------------------------------
//  Setup and loop
// ---------------------------------------------------------------------
void setup() {
  // Relays first, so the valve is never driven the wrong way while booting
  pinMode(PIN_RELAY1, OUTPUT); pinMode(PIN_RELAY2, OUTPUT);
  relay(PIN_RELAY1, false); relay(PIN_RELAY2, false);
  pinMode(PIN_FB_OPEN, INPUT_PULLUP); pinMode(PIN_FB_CLOSED, INPUT_PULLUP);
  pinMode(PIN_BUTTON, INPUT_PULLUP);
  Serial.begin(115200);
  rmtInit(PIN_RING, RMT_TX_MODE, RMT_MEM_NUM_BLOCKS_1, 10000000);

  prefs.begin("hydrotrack", false);
  awayMode = prefs.getBool("away", false);
  autoClose = prefs.getBool("auto", true);
  loadTaps();
  // Put the valve back where it was before the restart
  if (prefs.getBool("closed", false)) { driveValve(true); valve = V_CLOSED; strlcpy(valveReason, "Still closed after a restart", sizeof valveReason); }
  else { driveValve(false); valve = V_OPEN; }

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);                         // stay awake so no tap packet is missed
  if (strlen(WIFI_SSID)) {
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    uint32_t t0 = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - t0 < 15000) { ringFrame(); delay(30); }
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("Wi-Fi OK: %s, channel %d. Phone page: http://hydrotrack.local or http://%s\n",
                  WIFI_SSID, (int)WiFi.channel(), WiFi.localIP().toString().c_str());
    configTime(0, 0, "pool.ntp.org", "time.google.com");
    setupWeb();
  } else Serial.println("No Wi-Fi: button, tap devices and auto-close still work");
  startEspNow();

  if (strlen(MQTT_HOST)) {
#if MQTT_TLS
    netClient.setInsecure();                    // encrypts, but doesn't check the broker's certificate
#endif
    mqtt.setServer(MQTT_HOST, MQTT_PORT);
    mqtt.setCallback(onMqtt);
    mqtt.setBufferSize(768);
  }
  Serial.println("HydroTrack valve box ready");
}

void loop() {
  while (rxTail != rxHead) {                    // packets from the tap devices
    handlePacket(rxQueue[rxTail].data, rxQueue[rxTail].len);
    rxTail = (rxTail + 1) % 16;
  }
  valveStep();
  alertStep();
  buttonStep();
  ringFrame();
  if (WiFi.status() == WL_CONNECTED) server.handleClient();
  mqttStep();
  delay(2);
}
