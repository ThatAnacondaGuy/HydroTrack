// ====================================================================
//  HydroTrack v3.1 — final compact design, built from the real parts
// ====================================================================
//  Every bought part sits where print/layout.json says (that file is
//  written by print/make_printed_parts.py, the same script that makes
//  the printable STL files), so the 3D view and the printed parts agree.
//
//  Units: millimetres. Y is up, Y = 0 is the bottom face of the device.
//  X points east (the flow sensor's hall cap side), Z points north.
//
//  Used by index.html and by the GLB exporter, so it takes THREE as an
//  argument instead of importing it.
// ====================================================================

(function (root) {
  const SPEC = { od: 60, height: 85 };          // the size the technical report promised
  const V1 = { od: 63.5, height: 123 };          // the first real-parts build

  // size source: datasheet = manufacturer drawing, listing = seller listings,
  // assumed = no published size (measure it), designed = printed/made part
  const PARTS = [
    // ---------------- Enclosure ----------------
    { id: 'shell', name: 'Body shell (printed)', group: 'Enclosure', printed: true, shell: true,
      size: 'Ø61 × 94.7 mm, 60 flutes', source: 'designed', explode: [0, 140, 0],
      note: 'File 05_body_shell.stl. One piece: the fluted sleeve and the top plate. A hex socket inside the top grips the adapter, so you screw the whole device onto the tap by twisting the body. The flutes give you grip and hide print lines.' },
    { id: 'washer', name: 'Rubber washer', group: 'Enclosure', inPO: false,
      size: 'Ø27 / Ø22.4 × 1 mm', source: 'listing', explode: [0, 165, 0],
      note: 'Sits between the body and the tap. A standard ½" tap washer.' },
    { id: 'adapter', name: 'Tap adapter (M22 × G½)', group: 'Water path', inPO: false,
      size: 'Hex 27, M22×1 male, G½ female', source: 'listing', explode: [0, 108, 0],
      note: 'Chrome-plated brass reducer. Its hex sits in the body’s hex socket. MEASURE the hex across flats: the socket is made for 27 mm.' },
    // ---------------- Sensors ----------------
    { id: 'flow', name: 'YF-S201 flow sensor', group: 'Sensors', inPO: true, po: 'Water Flow Sensor YF-S201', unit: 300,
      size: '63.5 × 36 × 35 mm, G½ both ends', source: 'listing', explode: [0, 62, 0],
      note: 'The spine of the device. Its bottom thread screws into the chamber lid (PTFE tape) and is turned until the hall cap points at the arrow on the lid; the thread leaves 2 mm of play for that. Everything else hangs around it.' },
    { id: 'piezo', name: '27 mm piezo disc', group: 'Sensors', inPO: true, po: '27mm Piezoelectric Disc', unit: 20,
      size: 'Ø27 × 0.5 mm', source: 'listing', explode: [-16, 62, 0],
      note: 'Glued flat on the west face of the turbine drum, where it hears the water. Use thin leads (0.2 mm): the battery sits 0.8 mm away.' },
    { id: 'tdsProbe', name: 'TDS probe', group: 'Sensors', inPO: true, po: 'DFRobot Analog TDS Sensor (kit)', unit: null,
      size: 'Head Ø12 × 32 mm + 8 mm needles (MEASURE)', source: 'assumed', explode: [0, -30, -42],
      note: 'Lies across the chamber, right under the flow sensor’s outlet, so the jet hits it and every drop passes the needles. Its back end sits in a gland in the south wall; seal the cable with silicone. Cut the cable 3 cm from the probe and solder the two thin inner wires.' },
    { id: 'ntc', name: '10K NTC probe (B3950)', group: 'Sensors', inPO: true, po: '10K NTC Thermistor Waterproof', unit: 100,
      size: 'Ø5 × 25 mm steel tip', source: 'listing', explode: [0, -30, 44],
      note: 'Pushed through the north wall along a chord, so 22 mm of its tip is in the water stream. Seal it outside with silicone.' },
    // ---------------- Water path ----------------
    { id: 'chamber', name: 'Chamber cup (printed)', group: 'Water path', printed: true, xray: 0.32,
      size: 'Ø49 × 25.4 mm, ~30 mL', source: 'designed', explode: [0, -30, 0],
      note: 'File 01_chamber_cup.stl. Holds the water, the TDS probe, the thermistor and three UV-C windows. Prints floor down with no supports. The west side is flat so the charger board fits beside it.' },
    { id: 'lid', name: 'Chamber lid (printed)', group: 'Water path', printed: true, xray: 0.4,
      size: 'Ø56.6 × 11.5 mm, printed G½ thread', source: 'designed', explode: [0, 0, 0],
      note: 'File 02_chamber_lid.stl. The flow sensor screws into its thread. A 45 × 1.5 mm O-ring in the groove underneath seals it to the cup; three M2.5 screws clamp lid, cage and cup together.' },
    { id: 'oring', name: 'O-ring 45 × 1.5 mm', group: 'Water path', inPO: false,
      size: 'Nitrile, ID 45, section 1.5 mm', source: 'listing', explode: [0, -10, 0],
      note: 'Face seal between the lid and the cup. About ₹10 at a hardware shop or in an O-ring kit.' },
    { id: 'neoperl', name: 'Neoperl laminar insert', group: 'Water path', inPO: true, po: 'Neoperl M22 Laminar Insert', unit: 250,
      size: 'Ø21 × 13 mm (MEASURE)', source: 'listing', explode: [0, -86, 0],
      note: 'Sits in the outlet cap. Its top washer seals against a shoulder in the cup. It makes the clear, glass-like stream that the halo lights up.' },
    { id: 'cap', name: 'Outlet cap (printed)', group: 'Water path', printed: true,
      size: 'Ø30.4 × 11.6 mm, M27 × 2 thread', source: 'designed', explode: [0, -100, 0],
      note: 'File 06_outlet_cap.stl. Holds the insert and screws into the cup from below, so you can unscrew it by hand to clean scale out of the insert, like a normal tap aerator.' },
    // ---------------- Light ----------------
    { id: 'uvc', name: 'UV-C LEDs ×3 (275 nm)', group: 'Light', inPO: true, po: '275nm UV-C SMD LED', unit: 250, qty: 3,
      size: '3.5 mm LED on an 8 mm board (MEASURE)', source: 'assumed', explode: [0, -30, 0], radial: 16,
      note: 'Three windows, 120° apart, each with a 6 × 1 mm quartz disc (plastic blocks 275 nm). Run them for a few minutes after the tap closes, while water stands in the chamber.' },
    { id: 'ring', name: 'WS2812B 16-LED ring', group: 'Light', inPO: true, po: 'WS2812B RGB LED Ring', unit: 150,
      size: 'Ø44.5 / Ø31.75 × 3.2 mm', source: 'listing', explode: [0, -56, 0],
      note: 'LEDs face down into the diffuser. Its three wires leave through a groove under the cup floor. Draws about 1 mA per LED even when dark, so the firmware switches its power off.' },
    { id: 'diffuser', name: 'Halo diffuser (printed)', group: 'Light', printed: true,
      size: 'Ø61 × 10 mm (6 mm glowing band), natural PETG', source: 'designed', explode: [0, -70, 0],
      note: 'File 04_halo_diffuser.stl, in natural (clear) PETG. The glowing band you see around the bottom. It also has the slot for the USB-C charging plug.' },
    // ---------------- Electronics ----------------
    { id: 'cage', name: 'Electronics cage (printed)', group: 'Electronics', printed: true,
      size: 'Ø56.6 × 61 mm', source: 'designed', explode: [0, 22, 0],
      note: 'File 03_electronics_cage.stl. Its base has a cut-out the exact shape of the flow sensor, so it slides down over it. Feet for the ESP32 and TDS board, a battery shelf, and posts for the perfboard.' },
    { id: 'screws', name: 'M2.5 × 12 screws ×3', group: 'Electronics', inPO: false,
      size: 'Self-tapping, pan head', source: 'listing', explode: [0, 46, 0],
      note: 'Go through the cage and the lid into the cup’s columns. Two of them sit in wells under the battery shelf, so drive them before the battery goes in.' },
    { id: 'esp32', name: 'ESP32-S3 DevKitC-1', group: 'Electronics', inPO: true, po: 'ESP32-S3-DevKitC-1 (N16R8)', unit: 1539,
      size: '62.7 × 25.5 mm (MEASURE your clone)', source: 'datasheet', explode: [0, 42, 54],
      note: 'Stands on the north side, antenna at the top, chip side out. Pull the black plastic strips off the pin headers and snip the pins short. A strip of 2 mm foam tape holds it to the turbine drum. Program it before assembly; later updates go over Wi-Fi.' },
    { id: 'tdsBoard', name: 'TDS signal board', group: 'Electronics', inPO: true, po: 'DFRobot Analog TDS Sensor (kit)', unit: 1429,
      size: '42 × 32 mm, plug sockets removed', source: 'listing', explode: [0, 38, -54],
      note: 'Stands on the south side, back taped to the turbine drum, parts facing out. Pull the two white plug housings off and solder wires to the pins, or it won’t fit.' },
    { id: 'battery', name: 'LiPo 803450 (~1500 mAh)', group: 'Electronics', inPO: false,
      size: '8 × 34 × 50 mm + 4 mm PCM (MEASURE)', source: 'assumed', explode: [-54, 42, 0],
      note: 'The bigger battery we picked (about 2.5× the 600 mAh cell). It stands on the shelf on the west side, 0.8 mm from the piezo. Buy a cell with a protection board (PCM).' },
    { id: 'tp4056', name: 'TP4056 USB-C charger', group: 'Electronics', inPO: true, po: 'TP4056 Type-C Charger', unit: 40,
      size: '28 × 17 mm (MEASURE)', source: 'listing', explode: [-50, -30, 0],
      note: 'Taped to the flat west side of the chamber with its USB-C port pointing down, through a slot in the diffuser. You charge from underneath, so water can’t run into the port.' },
    { id: 'perfboard', name: 'Power & signal perfboard', group: 'Electronics', inPO: true, po: 'Perfboard, LM358, TPS62840, AO3401, buzzer', unit: null,
      size: '30 × 18 mm', source: 'designed', explode: [50, 64, 0],
      note: 'Slides into the two east posts above the hall cap. Carries the TPS62840 power chip, the LM358 piezo amplifier, two AO3401 power switches (LED ring, flow sensor) and the 9 mm buzzer. Keep tall parts in the middle 22 mm.' },
    { id: 'uvDriver', name: 'UV-C boost driver', group: 'Electronics', inPO: false,
      size: '17 × 11 × 4 mm (assumed)', source: 'assumed', explode: [50, 22, 0],
      note: 'Small step-up module for the UV-C LEDs (they need about 6 V). Glued on the lid under the hall cap.' },
    { id: 'wires', name: 'Wiring', group: 'Electronics', inPO: true, po: 'Silicone wire kit', unit: null,
      size: '26–24 AWG silicone, 0.2 mm for the piezo', source: 'designed', explode: [0, 0, 0],
      note: 'Every run is routed and checked against every part: ring, thermistor, probe, UV-C, battery, power, hall sensor, piezo and the signal bus. Each passes through its own notch in the lid.' },
    // ---------------- Context ----------------
    { id: 'tap', name: 'Basin tap (for scale)', group: 'Context', context: true,
      size: 'Typical M22 tap', source: 'designed', explode: [0, 190, 0], note: 'Not part of the product. Shown for scale.' },
  ];

  function materials(THREE) {
    const phys = (o) => new THREE.MeshPhysicalMaterial(o);
    return {
      shell: phys({ name: 'PETG matte white', color: 0xf1efe9, roughness: 0.62, clearcoat: 0.15, clearcoatRoughness: 0.6, sheen: 0.3, sheenColor: 0xffffff }),
      petg: phys({ name: 'PETG white', color: 0xe9ebe8, roughness: 0.5, clearcoat: 0.2, clearcoatRoughness: 0.45 }),
      chrome: phys({ name: 'Chrome', color: 0xe9eaec, metalness: 1, roughness: 0.08 }),
      brass: phys({ name: 'Brass', color: 0xcaa24c, metalness: 1, roughness: 0.28 }),
      steel: phys({ name: 'Stainless steel', color: 0xb9bdc1, metalness: 1, roughness: 0.3 }),
      foil: phys({ name: 'Aluminium tape', color: 0xdfe2e4, metalness: 1, roughness: 0.14 }),
      alu: phys({ name: 'Aluminium', color: 0xc9cdd1, metalness: 1, roughness: 0.3 }),
      quartz: phys({ name: 'Quartz', color: 0xeaf6ff, roughness: 0.02, transparent: true, opacity: 0.45 }),
      black: phys({ name: 'Black plastic', color: 0x1b1d20, roughness: 0.55 }),
      sensor: phys({ name: 'Sensor body (black)', color: 0x202326, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
      rubber: phys({ name: 'Nitrile rubber', color: 0x141516, roughness: 0.85 }),
      rotor: phys({ name: 'Rotor', color: 0x39404a, roughness: 0.5 }),
      grey: phys({ name: 'Grey plastic', color: 0x8b9095, roughness: 0.55 }),
      pcbBlack: phys({ name: 'PCB black', color: 0x1c2226, roughness: 0.6 }),
      pcbBlue: phys({ name: 'PCB blue', color: 0x1f4c98, roughness: 0.55 }),
      pcbGreen: phys({ name: 'PCB green', color: 0x1f6b3a, roughness: 0.55 }),
      fr4: phys({ name: 'FR4 perfboard', color: 0xc2a76e, roughness: 0.7 }),
      copper: phys({ name: 'Copper', color: 0xd08a4e, metalness: 1, roughness: 0.35 }),
      gold: phys({ name: 'Gold', color: 0xd7b25a, metalness: 1, roughness: 0.3 }),
      chip: phys({ name: 'IC package', color: 0x202224, roughness: 0.45 }),
      ceramic: phys({ name: 'Ceramic white', color: 0xf1efe8, roughness: 0.4 }),
      resistor: phys({ name: 'Resistor body', color: 0xd9c6a0, roughness: 0.5 }),
      battery: phys({ name: 'LiPo wrap', color: 0x2f6fb0, roughness: 0.4, clearcoat: 0.5 }),
      kapton: phys({ name: 'Kapton tape', color: 0xd99a2b, roughness: 0.35, transparent: true, opacity: 0.9 }),
      wire_red: phys({ name: 'Wire red', color: 0xc8312b, roughness: 0.5 }),
      wire_black: phys({ name: 'Wire black', color: 0x222222, roughness: 0.5 }),
      wire_yellow: phys({ name: 'Wire yellow', color: 0xe3b62a, roughness: 0.5 }),
      wire_green: phys({ name: 'Wire green', color: 0x2f9a52, roughness: 0.5 }),
      wire_blue: phys({ name: 'Wire blue', color: 0x2f6bd0, roughness: 0.5 }),
      // Live materials the viewer animates
      haloLens: phys({ name: 'Halo LED lens', color: 0xffffff, emissive: 0x2a55ff, emissiveIntensity: 2.5, roughness: 0.3 }),
      diffuser: phys({ name: 'Natural PETG diffuser', color: 0x9aa6ab, roughness: 0.55, transparent: true, opacity: 0.93,
        emissive: 0x2a55ff, emissiveIntensity: 1.2 }),
      uvLens: phys({ name: 'UV-C lens', color: 0x2a1a44, emissive: 0x8a4dff, emissiveIntensity: 2.2, roughness: 0.2 }),
      water: phys({ name: 'Water', color: 0x4c6475, roughness: 0.05, transparent: true, opacity: 0.6, depthWrite: false,
        emissive: 0x2a55ff, emissiveIntensity: 0.9 }),
      bowlWater: phys({ name: 'Water in chamber', color: 0xbfe3ff, roughness: 0.05, transparent: true, opacity: 0.16, depthWrite: false }),
    };
  }

  // Which material each printed STL gets
  const PRINTED_MATERIAL = { shell: 'shell', chamber: 'petg', lid: 'petg', cage: 'petg', cap: 'petg', diffuser: 'diffuser' };

  function build(THREE, opts) {
    opts = opts || {};
    const printed = opts.printed || {};
    const L = opts.layout;
    if (!L) throw new Error('build() needs opts.layout (print/layout.json)');
    const M = materials(THREE);
    const V3 = THREE.Vector3;
    const TAU = Math.PI * 2;
    const D2R = Math.PI / 180;
    const rootGroup = new THREE.Group();
    rootGroup.name = 'HydroTrack_v3_1';
    const parts = {};
    const anim = { rotor: null };

    const part = (id) => {
      const meta = PARTS.find((p) => p.id === id);
      const g = new THREE.Group();
      g.name = meta.name;
      g.userData.partId = id;
      rootGroup.add(g);
      parts[id] = g;
      if (printed[id]) {
        const m = new THREE.Mesh(printed[id], M[PRINTED_MATERIAL[id]]);
        m.name = meta.name + ' (STL)';
        g.add(m);
      }
      return g;
    };
    const mesh = (g, geo, mat, x, y, z, rx, ry, rz, name) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x || 0, y || 0, z || 0);
      m.rotation.set(rx || 0, ry || 0, rz || 0);
      if (name) m.name = name;
      g.add(m);
      return m;
    };
    // Annular tube along +Y with flat ends, base at y = 0
    const ring = (ro, ri, h, seg) => {
      const s = new THREE.Shape();
      s.absarc(0, 0, ro, 0, TAU, false);
      if (ri > 0) { const hole = new THREE.Path(); hole.absarc(0, 0, ri, 0, TAU, true); s.holes.push(hole); }
      const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: seg || 64 });
      geo.rotateX(-Math.PI / 2);
      return geo;
    };
    const cyl = (r, h, seg) => { const geo = new THREE.CylinderGeometry(r, r, h, seg || 48); geo.translate(0, h / 2, 0); return geo; };
    const cylX = (r, len, seg) => { const geo = new THREE.CylinderGeometry(r, r, len, seg || 48); geo.rotateZ(-Math.PI / 2); geo.translate(len / 2, 0, 0); return geo; };
    const cylZ = (r, len, seg) => { const geo = new THREE.CylinderGeometry(r, r, len, seg || 32); geo.rotateX(Math.PI / 2); geo.translate(0, 0, len / 2); return geo; };
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const hexPrism = (acrossFlats, h) => {
      const r = acrossFlats / Math.sqrt(3);
      const s = new THREE.Shape();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + Math.PI / 6; i ? s.lineTo(r * Math.cos(a), r * Math.sin(a)) : s.moveTo(r * Math.cos(a), r * Math.sin(a)); }
      s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      return geo;
    };
    const tube = (g, pts, mat, r, name) => mesh(g, new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(pts.map((p) => new V3(p[0], p[1], p[2])), false, 'centripetal'), Math.max(24, pts.length * 4), r, 8, false), mat,
      0, 0, 0, 0, 0, 0, name);
    const atA = (r, a) => [r * Math.cos(a * D2R), r * Math.sin(a * D2R)];   // model angle a -> (x, z)

    const S = L.SENSOR, Ys = L.Y_S;

    // ---------------- Tap adapter (chrome-plated brass) ----------------
    {
      const g = part('adapter');
      const y0 = L.Y_SENSOR_TOP - S.thread;
      mesh(g, ring(13, 10.6, L.Y_HEX_BOT - y0), M.chrome, 0, y0, 0, 0, 0, 0, 'G½ female socket');
      mesh(g, hexPrism(L.ADAPTER.hex_af, L.ADAPTER.hex_h), M.chrome, 0, L.Y_HEX_BOT, 0, 0, 0, 0, 'Hex 27 mm');
      mesh(g, ring(L.ADAPTER.m22_r, 7.5, L.ADAPTER.m22_len), M.chrome, 0, L.Y_HEX_TOP, 0, 0, 0, 0, 'M22×1 male thread');
      for (let i = 0; i < 8; i++) mesh(g, new THREE.TorusGeometry(L.ADAPTER.m22_r, 0.3, 6, 48), M.chrome, 0, L.Y_HEX_TOP + 1.6 + i * 1.0, 0, Math.PI / 2);
    }
    part('shell');
    mesh(part('washer'), ring(13.5, 11.2, 1), M.rubber, 0, L.Y_TOP, 0, 0, 0, 0, 'Rubber washer');

    // ---------------- YF-S201 flow sensor (black) ----------------
    {
      const g = part('flow');
      mesh(g, cyl(10.45, S.thread), M.sensor, 0, Ys, 0, 0, 0, 0, 'G½ thread (bottom)');
      mesh(g, cyl(S.r_tube, S.length - 2 * S.thread), M.sensor, 0, Ys + S.thread, 0, 0, 0, 0, 'Body tube');
      mesh(g, cyl(10.45, S.thread), M.sensor, 0, L.Y_SENSOR_TOP - S.thread, 0, 0, 0, 0, 'G½ thread (top)');
      for (const y0 of [Ys, L.Y_SENSOR_TOP - S.thread]) for (let i = 0; i < 6; i++)
        mesh(g, new THREE.TorusGeometry(10.45, 0.3, 6, 40), M.sensor, 0, y0 + 1.5 + i * 1.6, 0, Math.PI / 2);
      mesh(g, cylX(S.drum_r, S.drum_x1 - S.drum_x0, 64), M.sensor, S.drum_x0, L.Y_DRUM, 0, 0, 0, 0, 'Turbine housing');
      mesh(g, cylX(S.cap_r, S.cap_x1 - S.drum_x1), M.black, S.drum_x1, L.Y_DRUM, 0, 0, 0, 0, 'Hall sensor cap');
      // moulded flow arrow on the drum's north face
      const arrow = new THREE.Shape(); arrow.moveTo(-1.5, -6); arrow.lineTo(1.5, -6); arrow.lineTo(1.5, 1); arrow.lineTo(4, 1); arrow.lineTo(0, 6); arrow.lineTo(-4, 1); arrow.lineTo(-1.5, 1); arrow.closePath();
      const ag = new THREE.ExtrudeGeometry(arrow, { depth: 0.4, bevelEnabled: false }); ag.rotateZ(Math.PI);
      mesh(g, ag, M.grey, 2.25, L.Y_DRUM, S.drum_r - 0.2, 0, 0, 0, 'Flow arrow');
      const rotor = new THREE.Group();
      rotor.name = 'Turbine rotor';
      rotor.position.set(2.25, L.Y_DRUM, 0);
      mesh(rotor, cylX(3, 12), M.rotor, -6, 0, 0);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const blade = mesh(rotor, box(10, 11, 1.2), M.rotor);
        blade.position.set(0, 8 * Math.cos(a), 8 * Math.sin(a));
        blade.rotation.set(a, 0, 0);
      }
      g.add(rotor);
      anim.rotor = rotor;
    }
    {
      const g = part('piezo');
      mesh(g, cylX(13.5, 0.25), M.brass, S.drum_x0 - 0.25, L.Y_DRUM, 0, 0, 0, 0, 'Brass plate');
      mesh(g, cylX(10, 0.25), M.ceramic, S.drum_x0 - 0.5, L.Y_DRUM, 0, 0, 0, 0, 'Piezo ceramic');
    }

    // ---------------- Printed lid, O-ring ----------------
    part('lid');
    {
      const g = part('oring');
      const rc = L.ORING.id / 2 + L.ORING.cs / 2;
      const o = mesh(g, new THREE.TorusGeometry(rc, L.ORING.cs / 2, 12, 96), M.rubber, 0, L.Y_LID_BOT + 0.58, 0, Math.PI / 2, 0, 0, 'O-ring 45 × 1.5');
      o.scale.set(1, 1, 0.77);
    }

    // ---------------- Printed chamber cup, lining and standing water ----------------
    {
      const g = part('chamber');
      const h = L.Y_LID_BOT - L.Y_FLOOR_TOP;
      mesh(g, ring(L.R_CIN - 0.05, L.R_CIN - 0.2, h - 0.5), M.foil, 0, L.Y_FLOOR_TOP + 0.3, 0, 0, 0, 0, 'Aluminium tape lining');
      const water = mesh(g, cyl(L.R_CIN - 0.25, h), M.bowlWater, 0, L.Y_FLOOR_TOP, 0, 0, 0, 0, 'Water');
      water.userData.water = true;
    }

    // ---------------- TDS probe (across the chamber, north-south) ----------------
    {
      const g = part('tdsProbe');
      const P = L.PROBE, zb = -(L.R_CIN + 1.0);
      mesh(g, cylZ(P.d / 2, P.head), M.black, 0, L.Y_PROBE, zb, 0, 0, 0, 'Probe head');
      for (const dx of [-P.needle_gap / 2, P.needle_gap / 2]) mesh(g, cylZ(0.5, P.needle, 16), M.steel, dx, L.Y_PROBE, zb + P.head, 0, 0, 0, 'Needle');
      mesh(g, cylZ(P.relief_d / 2, zb + L.R_COUT + 1.1), M.black, 0, L.Y_PROBE, -(L.R_COUT + 1.1), 0, 0, 0, 'Strain relief');
    }
    {
      const g = part('ntc');
      const zo = Math.sqrt(L.R_COUT ** 2 - L.NTC_X ** 2);
      mesh(g, cylZ(L.NTC.d / 2, L.NTC.length), M.steel, L.NTC_X, L.Y_PROBE, zo - L.NTC.length, 0, 0, 0, 'Steel tip');
    }

    // ---------------- UV-C LEDs + quartz windows ----------------
    {
      const g = part('uvc');
      const d = L.UV_PAD_D, U = L.UV;
      L.UV_ANGLES.forEach((a, i) => {
        const sub = new THREE.Group();
        sub.name = 'UV-C LED ' + (i + 1);
        sub.rotation.y = -a * D2R;              // local +X points outward along angle a
        sub.position.y = L.Y_UV;
        sub.userData.angle = a;
        mesh(sub, cylX(U.quartz_d / 2, U.quartz_t), M.quartz, d - U.led_t - U.quartz_t, 0, 0, 0, 0, 0, 'Quartz window 6 × 1 mm');
        mesh(sub, box(U.led_t, U.led, U.led), M.ceramic, d - U.led_t / 2, 0, 0, 0, 0, 0, 'LED 3535');
        mesh(sub, box(0.1, 2.6, 2.6), M.uvLens, d - U.led_t - 0.05, 0, 0, 0, 0, 0, 'UV lens');
        mesh(sub, box(U.board_t, U.board, U.board), M.alu, d + U.board_t / 2, 0, 0, 0, 0, 0, 'Aluminium LED board');
        g.add(sub);
      });
    }

    // ---------------- WS2812B ring (LEDs face down into the diffuser) ----------------
    {
      const g = part('ring');
      const R = L.RING;
      mesh(g, ring(R.od / 2, R.id / 2, R.pcb), M.pcbBlack, 0, L.Y_RING_PCB, 0, 0, 0, 0, 'Ring PCB');
      for (let i = 0; i < R.n; i++) {
        const a = (i / R.n) * TAU;
        const x = 19.06 * Math.cos(a), z = 19.06 * Math.sin(a);
        mesh(g, box(5, R.led, 5), M.ceramic, x, L.Y_RING_LED + R.led / 2, z, 0, -a, 0, 'WS2812B ' + (i + 1));
        mesh(g, box(3.6, 0.1, 3.6), M.haloLens, x, L.Y_RING_LED - 0.04, z, 0, -a, 0, 'LED lens');
      }
    }
    part('diffuser');

    {
      const g = part('neoperl');
      const h = L.Y_SEAT - L.Y_LIP;
      mesh(g, ring(L.INSERT.d / 2, 8.6, h), M.grey, 0, L.Y_LIP, 0, 0, 0, 0, 'Insert body');
      mesh(g, cyl(8.6, 0.8), M.black, 0, L.Y_LIP + 0.1, 0, 0, 0, 0, 'Honeycomb screen');
      for (let r = 2; r < 8.6; r += 2.2) mesh(g, new THREE.TorusGeometry(r, 0.25, 4, 36), M.grey, 0, L.Y_LIP + 0.1, 0, Math.PI / 2);
    }
    part('cap');

    // ---------------- Cage + screws ----------------
    part('cage');
    {
      const g = part('screws');
      for (const a of L.SCREW_ANGLES) {
        const [x, z] = atA(L.SCREW_R, a);
        mesh(g, cyl(2.5, 1.6, 24), M.steel, x, L.Y_CAGE_TOP, z, 0, 0, 0, 'Pan head');
        mesh(g, cyl(1.25, 12, 16), M.steel, x, L.Y_CAGE_TOP - 12, z, 0, 0, 0, 'Shank');
      }
    }

    // ---------------- ESP32-S3 DevKitC-1 (north side, chip side out) ----------------
    {
      const g = part('esp32');
      const D = L.DEVKIT, y0 = L.DK_Y0, y1 = y0 + D.l;
      const zp = L.DK_Z0 + D.stub, zo = zp + D.pcb;
      mesh(g, box(D.w, D.l, D.pcb), M.pcbBlack, 0, (y0 + y1) / 2, zp + D.pcb / 2, 0, 0, 0, 'PCB');
      mesh(g, box(18, 25.5, 0.8), M.pcbBlack, 0, y1 - 12.75, zo + 0.4, 0, 0, 0, 'WROOM-1 module board');
      mesh(g, box(16.6, 17, 2.4), M.steel, 0, y1 - 25.5 + 9.0, zo + 0.8 + 1.2, 0, 0, 0, 'WROOM-1 shield');
      mesh(g, box(14, 4.5, 0.05), M.gold, 0, y1 - 4.2, zo + 0.83, 0, 0, 0, 'PCB antenna');
      for (const x of [-6.5, 6.5]) mesh(g, box(9, 7.4, 3.2), M.steel, x, y0 + 3.2, zo + 1.6, 0, 0, 0, 'USB-C');
      for (const x of [-9, 9]) mesh(g, box(4, 3, 2), M.ceramic, x, y0 + 16, zo + 1, 0, 0, 0, 'Button');
      mesh(g, box(3, 3, 1.4), M.chip, 0, y0 + 22, zo + 0.7, 0, 0, 0, 'Regulator');
      mesh(g, box(4, 4, 0.9), M.chip, -5, y0 + 13, zo + 0.45, 0, 0, 0, 'USB-UART bridge');
      mesh(g, box(1.6, 1.6, 0.8), M.ceramic, 9, y0 + 27, zo + 0.4, 0, 0, 0, 'RGB LED');
      for (let i = 0; i < 22; i++) for (const x of [-11.43, 11.43])
        mesh(g, cylZ(0.32, D.stub, 8), M.gold, x, y0 + 4 + i * 2.54, L.DK_Z0, 0, 0, 0, 'Pin stub');
    }

    // ---------------- TDS board (south side, parts face out) ----------------
    {
      const g = part('tdsBoard');
      const T = L.TDSB, y0 = L.TDS_Y0, zb = L.TDS_Z0, zf = zb - T.pcb;   // back face toward the drum, front face out
      mesh(g, box(T.w, T.l, T.pcb), M.pcbBlue, 0, y0 + T.l / 2, zb - T.pcb / 2, 0, 0, 0, 'PCB');
      mesh(g, box(5, 6, 1.6), M.chip, 4, y0 + 22, zf - 0.8, 0, 0, 0, 'Op-amp');
      mesh(g, box(5, 4, 1.4), M.chip, -6, y0 + 26, zf - 0.7, 0, 0, 0, 'Oscillator');
      mesh(g, box(3, 3, 2), M.chip, 8, y0 + 12, zf - 1, 0, 0, 0, 'Regulator');
      for (const [x, y] of [[-10, 8], [-4, 8], [10, 30], [-11, 32], [0, 34]]) mesh(g, box(2, 1.2, 1.2), M.ceramic, x, y0 + y, zf - 0.6, 0, 0, 0, 'Capacitor');
      // the two plug sockets with their housings pulled off: bare pins, wires soldered on
      for (let i = 0; i < 2; i++) mesh(g, cylZ(0.32, 2.2, 8), M.gold, -7 + i * 2.5, y0 + 3.5, zf - 2.2, 0, 0, 0, 'Probe pin');
      for (let i = 0; i < 3; i++) mesh(g, cylZ(0.32, 2.2, 8), M.gold, 4 + i * 2.0, y0 + T.l - 3.5, zf - 2.2, 0, 0, 0, 'Signal pin');
    }

    // ---------------- LiPo 803450 (west shelf) ----------------
    {
      const g = part('battery');
      const B = L.BATT, x = L.BAT_X0 - B.t / 2;
      mesh(g, box(B.t, B.l, B.w), M.battery, x, L.Y_SHELF + B.l / 2, 0, 0, 0, 0, 'Pouch cell');
      mesh(g, box(B.t - 2, B.pcm, 24), M.kapton, x, L.Y_SHELF + B.l + B.pcm / 2, 0, 0, 0, 0, 'Protection board (PCM)');
    }

    // ---------------- TP4056 (on the cup's west flat, USB-C down) ----------------
    {
      const g = part('tp4056');
      const T = L.TP, x0 = L.TP_X0, y0 = L.Y_TP_USB;
      mesh(g, box(T.pcb, T.l, T.w), M.pcbBlue, x0 - T.pcb / 2, y0 + T.usb_over + T.l / 2, 0, 0, 0, 0, 'PCB');
      mesh(g, box(T.usb_t, T.usb_l, T.usb_w), M.steel, x0 - T.pcb - T.usb_t / 2, y0 + T.usb_l / 2, 0, 0, 0, 0, 'USB-C receptacle');
      mesh(g, box(1.5, 5, 4), M.chip, x0 - T.pcb - 0.75, y0 + 15, -3, 0, 0, 0, 'TP4056');
      mesh(g, box(1.2, 3, 3), M.chip, x0 - T.pcb - 0.6, y0 + 21, 4, 0, 0, 0, 'DW01 protection');
      mesh(g, box(1.2, 3, 3), M.chip, x0 - T.pcb - 0.6, y0 + 25, -2, 0, 0, 0, '8205A switch');
      mesh(g, box(0.6, 0.8, 1.6), M.ceramic, x0 - T.pcb - 0.3, y0 + 11, 6, 0, 0, 0, 'Charge LED');
    }

    // ---------------- Perfboard (east posts) ----------------
    {
      const g = part('perfboard');
      const P = L.PERF, x0 = L.PERF_X0, y0 = L.Y_PERF0, xf = x0 + P.pcb;
      mesh(g, box(P.pcb, P.l, P.w), M.fr4, x0 + P.pcb / 2, y0 + P.l / 2, 0, 0, 0, 0, 'Perfboard');
      for (let j = 0; j < 7; j++) for (let k = 0; k < 11; k++) mesh(g, cylX(0.5, 0.05, 8), M.copper, xf, y0 + 1.3 + j * 2.54, -12.7 + k * 2.54);
      mesh(g, box(3.4, 9.8, 6.4), M.chip, xf + 1.7, y0 + 9, -3.5, 0, 0, 0, 'LM358 (DIP-8)');
      mesh(g, box(0.8, 8, 8), M.pcbGreen, xf + 0.4, y0 + 9, 8.5, 0, 0, 0, 'TPS62840 adapter');
      mesh(g, box(0.8, 2, 1.5), M.chip, xf + 1.2, y0 + 9, 8.5, 0, 0, 0, 'TPS62840');
      mesh(g, box(1.4, 2.5, 2.5), M.grey, xf + 1.5, y0 + 13.5, 8.5, 0, 0, 0, 'Inductor');
      for (const z of [-11.5, 11.5]) mesh(g, box(1.2, 3, 2.9), M.chip, xf + 0.6, y0 + 3, z, 0, 0, 0, 'AO3401 switch');
      mesh(g, cylX(4.5, 5.5, 32), M.black, xf, y0 + 12.5, 1.5, 0, 0, 0, '9 mm buzzer');
      for (let k = 0; k < 4; k++) mesh(g, cylZ(0.9, 6, 12), M.resistor, xf + 0.9, y0 + 3 + k * 2.5, -9.5, 0, 0, 0, 'Resistor');
    }

    // ---------------- UV-C boost driver (on the lid, under the hall cap) ----------------
    {
      const g = part('uvDriver');
      const U = L.UVDRV, x0 = L.UVDRV_X0;
      mesh(g, box(1.6, U.l, U.w), M.pcbBlue, x0 + 0.8, L.Y_LID_TOP + U.l / 2, 0, 0, 0, 0, 'Driver PCB');
      mesh(g, box(2.4, 4, 4), M.grey, x0 + 1.6 + 1.2, L.Y_LID_TOP + 6, -3, 0, 0, 0, 'Boost inductor');
      mesh(g, box(1.2, 3, 2.5), M.chip, x0 + 1.6 + 0.6, L.Y_LID_TOP + 6, 4, 0, 0, 0, 'Boost IC');
    }

    // ---------------- Wiring ----------------
    {
      const g = part('wires');
      for (const [name, w] of Object.entries(L.WIRES)) tube(g, w.pts, M['wire_' + w.color] || M.wire_black, w.r, name + ' wire');
    }

    // ---------------- Basin tap (context only) ----------------
    if (opts.tap !== false) {
      const g = part('tap');
      const yt = L.Y_TOP + 1;
      mesh(g, cyl(14, 13.5), M.chrome, 0, yt, 0, 0, 0, 0, 'Spout end (M22 female)');
      const spout = new THREE.CatmullRomCurve3([
        new V3(0, yt + 12, 0), new V3(0, yt + 26, 0), new V3(-6, yt + 42, 0), new V3(-30, yt + 54, 0),
        new V3(-80, yt + 58, 0), new V3(-130, yt + 56, 0), new V3(-160, yt + 50, 0)]);
      mesh(g, new THREE.TubeGeometry(spout, 96, 9.5, 24, false), M.chrome, 0, 0, 0, 0, 0, 0, 'Spout');
      mesh(g, cyl(25, 230), M.chrome, -170, yt - 164, 0, 0, 0, 0, 'Tap body');
      mesh(g, cyl(27, 6), M.chrome, -170, yt + 66, 0, 0, 0, 0, 'Tap top');
      const lever = mesh(g, box(70, 7, 14), M.chrome, -150, yt + 78, 0, 0, 0, 0.18, 'Lever');
      lever.geometry.translate(10, 0, 0);
    }

    // ---------------- Laminar water stream (shown when water flows) ----------------
    {
      const stream = mesh(rootGroup, cyl(8.4, 170, 32), M.water, 0, -170 + L.Y_LIP, 0, 0, 0, 0, 'Laminar stream');
      stream.userData.water = true;
      anim.stream = stream;
    }

    return { root: rootGroup, parts, materials: M, anim, layout: L };
  }

  // Shared loader: parts.json + layout.json + STL bytes -> placed geometries and the layout.
  // `fetchBytes(path)` returns an ArrayBuffer; `STLLoader` and `toCreasedNormals` come from three's addons.
  async function loadAssets(THREE, STLLoader, toCreasedNormals, fetchBytes, base) {
    const text = async (p) => new TextDecoder().decode(await fetchBytes(base + p));
    const manifest = JSON.parse(await text('parts.json'));
    const layout = JSON.parse(await text('layout.json'));
    const loader = new STLLoader();
    const printed = {};
    await Promise.all(manifest.parts.map(async (p) => {
      let geo = loader.parse(await fetchBytes(base + p.file));
      geo.applyMatrix4(new THREE.Matrix4().fromArray(p.matrix));
      geo.deleteAttribute('normal');
      geo = toCreasedNormals(geo, THREE.MathUtils.degToRad(30));
      printed[p.id] = geo;
    }));
    return { printed, layout };
  }

  root.HydroTrackModel = { PARTS, SPEC, V1, build, loadAssets };
})(typeof globalThis !== 'undefined' ? globalThis : window);
