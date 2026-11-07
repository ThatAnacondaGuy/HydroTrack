// ====================================================================
//  HydroTrack v3.0 — Flow calibration logger (bucket-and-scale method)
// ====================================================================
//  Wiring (holiday rig):
//    Flow sensor  red → 3V3, black → GND, yellow → GPIO 4 (direct)
//    TDS board    + → 3V3 (via breadboard col 10), − → GND, A → GPIO 2
//    Thermistor   3V3 –[10k]– GPIO 1 –[NTC]– GND
//
//  How to use (Serial Monitor at 115200, "New Line" selected):
//    s            start a run   (open the tap first, then type s)
//    e            end the run   (type e, then close the tap)
//    w 1234       weight of the water in grams (scale tared with the empty bucket)
//    x            cancel the current run
//  Every finished run prints one line starting with "RUN," — copy those
//  lines into a file; they are the training data for the flow model.
// ====================================================================

const int PIN_FLOW = 4, PIN_NTC = 1, PIN_TDS = 2, PIN_RGB = 48;
const float DATASHEET_HZ_PER_LPM = 7.5;   // YF-S201: F(Hz) = 7.5 × Q(L/min)

volatile uint32_t pulses = 0;
void IRAM_ATTR onPulse() { pulses = pulses + 1; }

float readTempC() {                      // 3V3 –[10k]– pin –[NTC]– GND, beta 3950
  float v = analogReadMilliVolts(PIN_NTC) / 1000.0f;
  if (v < 0.01f || v > 3.29f) return NAN;
  float r = 10000.0f * v / (3.3f - v);
  return 1.0f / (log(r / 10000.0f) / 3950.0f + 1.0f / 298.15f) - 273.15f;
}

float readTdsVolts() { return analogReadMilliVolts(PIN_TDS) / 1000.0f; }

// Run state
bool running = false, awaitingWeight = false;
uint32_t runId = 0, runStartMs = 0, runStartPulses = 0, runPulses = 0;
float runSeconds = 0;
double tempSum = 0, tdsSum = 0;
uint32_t sampleCount = 0;

void setHalo(uint8_t r, uint8_t g, uint8_t b) { rgbLedWrite(PIN_RGB, r, g, b); }

void startRun() {
  noInterrupts(); runStartPulses = pulses; interrupts();
  runStartMs = millis();
  tempSum = tdsSum = 0; sampleCount = 0;
  running = true; awaitingWeight = false;
  runId++;
  setHalo(0, 60, 0);                     // green = recording
  Serial.printf("# run %lu started — water into the bucket now\n", (unsigned long)runId);
}

void endRun() {
  noInterrupts(); runPulses = pulses - runStartPulses; interrupts();
  runSeconds = (millis() - runStartMs) / 1000.0f;
  running = false; awaitingWeight = true;
  setHalo(60, 40, 0);                    // amber = waiting for the weight
  Serial.printf("# run %lu stopped: %.1f s, %lu pulses. Close the tap, weigh the water, then type: w <grams>\n",
                (unsigned long)runId, runSeconds, (unsigned long)runPulses);
}

void recordWeight(float grams) {
  float meanHz = runPulses / runSeconds;
  float meanTemp = sampleCount ? tempSum / sampleCount : NAN;
  float meanTds = sampleCount ? tdsSum / sampleCount : NAN;
  float trueLpm = (grams / 1000.0f) / (runSeconds / 60.0f);   // 1 g of water ≈ 1 mL
  float datasheetLpm = meanHz / DATASHEET_HZ_PER_LPM;
  float errPct = (datasheetLpm - trueLpm) / trueLpm * 100.0f;
  Serial.println("RUN,id,seconds,pulses,mean_hz,mean_temp_c,mean_tds_v,grams,true_lpm,datasheet_lpm,error_pct");
  Serial.printf("RUN,%lu,%.2f,%lu,%.3f,%.2f,%.3f,%.1f,%.3f,%.3f,%.1f\n",
                (unsigned long)runId, runSeconds, (unsigned long)runPulses, meanHz, meanTemp, meanTds,
                grams, trueLpm, datasheetLpm, errPct);
  awaitingWeight = false;
  setHalo(0, 10, 60);                    // blue = ready
}

void handleCommand(String cmd) {
  cmd.trim();
  if (cmd == "s") {
    if (running) Serial.println("# already recording — type e to end");
    else startRun();
  } else if (cmd == "e") {
    if (running) endRun(); else Serial.println("# not recording — type s to start");
  } else if (cmd.startsWith("w")) {
    float g = cmd.substring(1).toFloat();
    if (!awaitingWeight) Serial.println("# no finished run to weigh");
    else if (g <= 0) Serial.println("# type the weight like: w 1234");
    else recordWeight(g);
  } else if (cmd == "x") {
    running = awaitingWeight = false;
    setHalo(0, 10, 60);
    Serial.println("# run cancelled");
  } else if (cmd.length()) {
    Serial.println("# commands: s = start, e = end, w <grams> = weight, x = cancel");
  }
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  pinMode(PIN_FLOW, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_FLOW), onPulse, FALLING);
  setHalo(0, 10, 60);
  delay(1500);
  Serial.println("# HydroTrack calibration logger ready. Commands: s = start, e = end, w <grams>, x = cancel");
}

void loop() {
  if (Serial.available()) handleCommand(Serial.readStringUntil('\n'));

  static uint32_t lastMs = 0, lastPulses = 0;
  if (millis() - lastMs >= 1000) {
    lastMs += 1000;
    noInterrupts(); uint32_t p = pulses; interrupts();
    uint32_t hz = p - lastPulses; lastPulses = p;
    float t = readTempC(), tds = readTdsVolts();
    if (running) {
      if (!isnan(t)) { tempSum += t; tdsSum += tds; sampleCount++; }
      Serial.printf("# live %4.0f s | %lu Hz ~ %.2f L/min (datasheet) | %.1f C | TDS %.3f V\n",
                    (millis() - runStartMs) / 1000.0f, (unsigned long)hz, hz / DATASHEET_HZ_PER_LPM, t, tds);
    }
  }
}
