// =====================================================================
//  HydroTrack ESP-NOW protocol: tap devices <-> valve box
//  The same file is in firmware/tap_device and firmware/valve_box.
//  If you change one copy, copy it to the other.
// =====================================================================
#pragma once
#include <stdint.h>

#define HT_MAGIC 0x48      // 'H'
#define HT_VERSION 1

enum HtType : uint8_t {
  HT_HELLO = 1,   // tap -> box: "is a valve box on this channel?"
  HT_ACK = 2,     // box -> tap: answer to every packet (time, valve state, settings)
  HT_LIVE = 3,    // tap -> box: every 2 s while water runs
  HT_USE = 4,     // tap -> box: one record when a use ends
  HT_ALERT = 5,   // tap -> box: something needs attention
};

enum HtAlert : uint8_t {
  HT_AL_LEFT_OPEN = 1,     // steady flow with nobody using the tap
  HT_AL_SCALD = 2,         // water hotter than the scald limit
  HT_AL_LOW_BATTERY = 3,
  HT_AL_TDS_HIGH = 4,
};

enum HtProfile : uint8_t { HT_KITCHEN = 0, HT_BASIN = 1, HT_BUCKET = 2, HT_GARDEN = 3, HT_DRINKING = 4 };

// HtLive.flags / HtUse.flags
#define HT_F_SCALD 0x01
#define HT_F_UVC 0x02
#define HT_F_UNATTENDED 0x04
#define HT_F_LOW_BATT 0x08
#define HT_F_VISCOSITY 0x10   // flow is temperature-compensated

struct __attribute__((packed)) HtHeader {
  uint8_t magic, version, type, seq;
  uint32_t deviceId;          // low 4 bytes of the tap's MAC
};

struct __attribute__((packed)) HtLive {
  HtHeader h;
  float flowLpm, useLitres, todayLitres, tempC;
  uint16_t tdsPpm, battMv, useSeconds;
  uint8_t flags;
};

struct __attribute__((packed)) HtUse {
  HtHeader h;
  float litres, avgTempC, maxTempC, todayLitres;
  uint16_t seconds, tdsPpm, battMv;
  uint8_t flags;
};

struct __attribute__((packed)) HtAlertMsg {
  HtHeader h;
  uint8_t alert;
  float value;
};

// Sent by the valve box as a broadcast; the tap keeps it only if h.deviceId is its own id.
struct __attribute__((packed)) HtAck {
  HtHeader h;
  uint8_t channel;            // Wi-Fi channel the box is on
  uint32_t localEpoch;        // seconds since 1970 in local time (0 = box has no time yet)
  uint8_t valveOpen;          // 1 = water on
  uint8_t profile;            // HtProfile
  float useLimitL, dailyLimitL;
  uint8_t haloMinimal;        // 1 = halo only at the start of a use and for warnings (saves battery)
  uint8_t uvcMinutes;         // UV-C cycle length after a use, 0 = off
};
