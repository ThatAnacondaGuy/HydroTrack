// =====================================================================
//  Copy this file to secrets.h and fill in your own details.
//  secrets.h is ignored by git, so your password never reaches GitHub.
//  Without secrets.h the box still works: button, tap devices and
//  auto-close all run, just without the phone page and MQTT.
// =====================================================================
#pragma once

#define WIFI_SSID ""            // your home Wi-Fi name (2.4 GHz)
#define WIFI_PASS ""

// Remote control from outside the house goes through an MQTT broker:
// the project's own Mosquitto (docker-compose in the repo), or a free
// HiveMQ Cloud cluster (set MQTT_TLS 1 and port 8883). Leave MQTT_HOST
// empty to turn MQTT off.
#define MQTT_HOST ""
#define MQTT_PORT 1883
#define MQTT_TLS 0
#define MQTT_USER ""
#define MQTT_PASS ""

#define HOME_ID "home-1"        // shows as the "zone" in the dashboard; use something only you know
