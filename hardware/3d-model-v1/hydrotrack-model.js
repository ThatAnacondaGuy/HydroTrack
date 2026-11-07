// ====================================================================
//  HydroTrack v3.0 — "Real parts" prototype 3D model
// ====================================================================
//  Built only from the parts in the purchase order (plus the few
//  unavoidable extras flagged `inPO: false`), at their real sizes.
//  Units: millimetres. Y is up. Y = 0 is the bottom face of the body.
//
//  The five 3D-printed parts come from the STL files in print/ (made by
//  print/make_printed_parts.py). The caller loads them and passes them in
//  as `opts.printed[id]`, already moved into place with parts.json.
//
//  Used by index.html (interactive viewer) and by the GLB exporter, so it
//  takes THREE as an argument instead of importing it.
// ====================================================================

(function (root) {
  // Overall envelope of the build (mm)
  const BODY = { od: 63.5, idSleeve: 60.3, height: 123, threadTop: 129 };
  // The size the technical report promises
  const SPEC = { od: 60, height: 85 };

  // size source: datasheet = manufacturer drawing, listing = seller listings
  // (they vary), assumed = no published size, designed = printed/made part
  const PARTS = [
    { id: 'adapter', name: 'Tap adapter (M22 × G½)', group: 'Water path', inPO: false,
      size: 'Ø26 × 25.5 mm brass, M22×1 male on top', source: 'designed',
      note: 'Not in the purchase order. A standard brass reducer that turns the tap’s M22 thread into the flow sensor’s G½ thread.',
      explode: [0, 55, 0] },
    { id: 'flow', name: 'YF-S201C flow sensor', group: 'Sensors', inPO: true, po: 'Water Flow Sensor YF-S201C', unit: 300,
      size: '63.5 × 35.5 × 32 mm, G½ threads both ends', source: 'listing',
      note: 'A turbine with a hall-effect pickup, so it has a moving rotor. At 63.5 mm long it decides most of the height on its own.',
      explode: [0, 24, 0] },
    { id: 'piezo', name: '27 mm piezo disc', group: 'Sensors', inPO: true, po: '27mm Piezoelectric Disc', unit: 20,
      size: 'Ø27 × 0.5 mm', source: 'listing',
      note: 'Glued to the flat face of the flow sensor’s turbine housing, so it hears the water path directly.',
      explode: [-8, 24, 0] },
    { id: 'lid', name: 'Chamber lid (printed)', group: 'Water path', inPO: true, po: 'PETG filament (printed)', unit: null, printed: true,
      size: 'Ø60 × 11 mm, printed G½ thread', source: 'designed',
      note: 'File 02_chamber_lid.stl. The flow sensor screws into its printed G½ thread. A 48 × 1.5 mm O-ring in the underside groove seals it to the cup, and three M2 screws hold it.',
      explode: [0, 10, 0] },
    { id: 'chamber', name: 'Chamber cup (printed)', group: 'Water path', inPO: true, po: 'PETG filament (printed)', unit: null, printed: true,
      size: 'Ø57 × 45.5 mm, holds about 70 mL', source: 'designed',
      note: 'File 01_chamber_cup.stl. Line the inside with aluminium tape, leaving the four UV-C windows clear. It has a snap clip for the TDS probe, the insert seat in the floor and wire channels outside.',
      explode: [0, -24, 0] },
    { id: 'tdsProbe', name: 'TDS probe', group: 'Sensors', inPO: true, po: 'DFRobot Analog TDS Sensor (kit)', unit: null,
      size: 'Head Ø12 × 32 mm + two needles (assumed)', source: 'assumed',
      note: 'DFRobot doesn’t publish the probe size, so measure yours. It snaps into the clip in the cup. Its 83 cm cable has to be shortened and re-crimped. Rated to 55 °C.',
      explode: [0, -24, -34] },
    { id: 'ntc', name: '10K NTC probe (B3950)', group: 'Sensors', inPO: true, po: '10K NTC Thermistor Waterproof', unit: 100,
      size: 'Ø5 × 25 mm steel tip', source: 'listing',
      note: 'Pushed through the 5.2 mm port in the cup wall and sealed with silicone, so the tip sits in the water.',
      explode: [0, -24, 36] },
    { id: 'uvc', name: 'UV-C LEDs ×4 (275 nm)', group: 'Light', inPO: true, po: '275nm UV-C SMD LED', unit: 250, qty: 4,
      size: '3.5 × 3.5 mm each, on 8 mm boards', source: 'listing',
      note: 'Each LED sits in a pocket on a flat pad of the cup wall and shines through a 6 × 1 mm quartz disc, because PETG and epoxy block 275 nm light. The quartz discs are not in the purchase order.',
      explode: [0, -24, 0], radial: 14 },
    { id: 'ring', name: 'WS2812B 16-LED ring', group: 'Light', inPO: true, po: 'WS2812B RGB LED Ring', unit: 150,
      size: 'Ø44.5 / Ø31.75 × 3.2 mm', source: 'listing',
      note: 'LEDs face down into a pocket in the diffuser. Some sellers’ 16-LED rings are 48 mm across; this one still fits.',
      explode: [0, -46, 0] },
    { id: 'diffuser', name: 'Halo diffuser (printed)', group: 'Light', inPO: true, po: 'PETG filament (natural/clear)', unit: null, printed: true,
      size: 'Ø63.5 × 12 mm', source: 'designed',
      note: 'File 03_halo_diffuser.stl, printed in natural (clear) PETG so it glows. It closes the bottom of the sleeve, holds the LED ring and pegs into the cup floor. This is the Ambient Halo you actually see.',
      explode: [0, -62, 0] },
    { id: 'neoperl', name: 'Neoperl M22 laminar insert', group: 'Water path', inPO: true, po: 'Neoperl M22 Laminar Insert', unit: 250,
      size: 'Ø21 × 13 mm (MEASURE)', source: 'listing',
      note: 'Drops into the seat in the cup floor from inside and rests on a 1 mm lip. It turns the outlet into a clear, splash-free rod of water inside the halo.',
      explode: [0, -84, 0] },
    { id: 'carrier', name: 'Electronics carrier (printed)', group: 'Electronics', inPO: true, po: 'PETG filament (printed)', unit: null, printed: true,
      size: 'Ø59.5 × 64 mm', source: 'designed',
      note: 'File 04_electronics_carrier.stl. Sits on the lid under the same three screws. The ESP32 slides into its two rails, the battery fits between a back plate and the rails, and the other boards stick to flat panels with foam tape.',
      explode: [0, 6, 0] },
    { id: 'esp32', name: 'ESP32-S3-DevKitC-1', group: 'Electronics', inPO: true, po: 'Espressif ESP32-S3-DevKitC-1', unit: 1539,
      size: '62.7 × 25.4 mm, headers removed', source: 'datasheet',
      note: 'Slides into the carrier rails with the antenna end up, inside the plastic band. Inside the aluminium sleeve the radio would be blocked.',
      explode: [-46, 8, 0] },
    { id: 'battery', name: '800 mAh LiPo', group: 'Electronics', inPO: true, po: '800mAh LiPo Pouch Cell', unit: 300,
      size: '50 × 34 × 5 mm (typical, assumed)', source: 'assumed',
      note: 'Robu doesn’t list this pack’s size. Common 800 mAh pouches are 50 × 34 × 4–6 mm. The carrier pocket is 5.2 mm deep, so measure before printing.',
      explode: [-28, 8, 0] },
    { id: 'tdsBoard', name: 'TDS signal board', group: 'Electronics', inPO: true, po: 'DFRobot Analog TDS Sensor (kit)', unit: 1429,
      size: '42 × 32 mm', source: 'listing',
      note: 'The widest board. It is what forces a 60.3 mm inside diameter, so the 60 mm tube in the order is too small.',
      explode: [0, 8, -44] },
    { id: 'perfboard', name: 'Power & signal board', group: 'Electronics', inPO: true, po: 'FR4 perfboard, LM358, TPS62840', unit: null,
      size: '22 × 28 mm, cut from a 5 × 7 cm board', source: 'designed',
      note: 'Carries the TPS62840 buck converter on an adapter, the LM358 piezo amplifier and a small UV-C boost driver. UV-C LEDs need about 6 V, so the driver is not optional, and it is not in the order.',
      explode: [0, 8, 42] },
    { id: 'tp4056', name: 'TP4056 USB-C charger', group: 'Electronics', inPO: true, po: 'TP4056 Type-C Charger', unit: 40,
      size: '28 × 17 mm', source: 'listing',
      note: 'The USB-C port sits right under the opening in the top cap, beside the tap thread. Use a slim USB-C plug.',
      explode: [0, 18, 48] },
    { id: 'wires', name: 'Wiring', group: 'Electronics', inPO: true, po: 'AWG 24 Silicone Wire Kit', unit: null,
      size: '24 AWG silicone', source: 'designed',
      note: 'Main runs only: halo, thermistor, flow pulse, piezo and battery leads. The halo and thermistor wires run up channels in the cup wall.',
      explode: [0, 0, 0] },
    { id: 'sleeve', name: 'Aluminium sleeve', group: 'Enclosure', inPO: true, po: 'Brushed Aluminum Shell (60mm)', unit: 600,
      size: 'Ø63.5 × 1.6 mm wall × 96 mm', source: 'designed',
      note: 'Needs a 63.5 mm (2½ inch) tube, a stock size. The 60 mm tube in the order leaves only about 57 mm inside. Cut it to length after a test fit.',
      explode: [0, 14, 0] },
    { id: 'topCap', name: 'Top cap + radio band (printed)', group: 'Enclosure', inPO: true, po: 'PETG filament (printed)', unit: null, printed: true,
      size: 'Ø63.5 × 23 mm', source: 'designed',
      note: 'File 05_top_cap.stl. The plastic band lets the ESP32 antenna reach the gateway. The cap is clamped between the adapter hex and the tap, with a rubber washer on top (not in the order).',
      explode: [0, 44, 0] },
    { id: 'tap', name: 'Basin tap (for scale)', group: 'Context', context: true,
      size: 'Typical M22 basin tap', source: 'designed', note: 'Not part of the product. Shown for scale.',
      explode: [0, 80, 0] },
  ];

  function materials(THREE) {
    const phys = (o) => new THREE.MeshPhysicalMaterial(o);
    return {
      petg: phys({ name: 'PETG white', color: 0xeeeeea, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.4 }),
      alu: phys({ name: 'Brushed aluminium', color: 0xd2d6d9, metalness: 1, roughness: 0.24, anisotropy: 0.35 }),
      brass: phys({ name: 'Brass', color: 0xcaa24c, metalness: 1, roughness: 0.28 }),
      chrome: phys({ name: 'Chrome', color: 0xe9eaec, metalness: 1, roughness: 0.07 }),
      steel: phys({ name: 'Stainless steel', color: 0xb9bdc1, metalness: 1, roughness: 0.3 }),
      foil: phys({ name: 'Aluminium tape', color: 0xdfe2e4, metalness: 1, roughness: 0.12 }),
      clear: phys({ name: 'Clear plastic', color: 0xd9eef4, roughness: 0.08, transparent: true, opacity: 0.32, depthWrite: false }),
      quartz: phys({ name: 'Quartz', color: 0xeaf6ff, roughness: 0.02, transparent: true, opacity: 0.45 }),
      black: phys({ name: 'Black plastic', color: 0x1a1c1e, roughness: 0.55 }),
      rubber: phys({ name: 'Nitrile rubber', color: 0x141516, roughness: 0.85 }),
      rotor: phys({ name: 'Rotor', color: 0x2b2f33, roughness: 0.5 }),
      grey: phys({ name: 'Grey plastic', color: 0x8b9095, roughness: 0.55 }),
      pcbBlack: phys({ name: 'PCB black', color: 0x1c2226, roughness: 0.6 }),
      pcbBlue: phys({ name: 'PCB blue', color: 0x1f4c98, roughness: 0.55 }),
      pcbDfr: phys({ name: 'PCB DFRobot', color: 0x18438a, roughness: 0.55 }),
      fr4: phys({ name: 'FR4 perfboard', color: 0xc2a76e, roughness: 0.7 }),
      copper: phys({ name: 'Copper', color: 0xd08a4e, metalness: 1, roughness: 0.35 }),
      gold: phys({ name: 'Gold trace', color: 0xd7b25a, metalness: 1, roughness: 0.3 }),
      chip: phys({ name: 'IC package', color: 0x202224, roughness: 0.45 }),
      ceramic: phys({ name: 'Ceramic white', color: 0xf1efe8, roughness: 0.4 }),
      battery: phys({ name: 'LiPo wrap', color: 0xe07a24, roughness: 0.45, clearcoat: 0.5 }),
      foilPouch: phys({ name: 'Pouch foil', color: 0xc0c3c6, metalness: 0.8, roughness: 0.3 }),
      wireRed: phys({ name: 'Wire red', color: 0xc8312b, roughness: 0.5 }),
      wireBlack: phys({ name: 'Wire black', color: 0x222222, roughness: 0.5 }),
      wireYellow: phys({ name: 'Wire yellow', color: 0xe3b62a, roughness: 0.5 }),
      wireGreen: phys({ name: 'Wire green', color: 0x2f9a52, roughness: 0.5 }),
      // Live materials the viewer animates
      haloLens: phys({ name: 'Halo LED lens', color: 0xffffff, emissive: 0x2a55ff, emissiveIntensity: 2.5, roughness: 0.3 }),
      diffuser: phys({ name: 'Natural PETG diffuser', color: 0x5d666a, roughness: 0.85, transparent: true, opacity: 0.95,
        emissive: 0x2a55ff, emissiveIntensity: 1.2 }),
      uvLens: phys({ name: 'UV-C lens', color: 0x2a1a44, emissive: 0x8a4dff, emissiveIntensity: 2.2, roughness: 0.2 }),
      water: phys({ name: 'Water', color: 0x4c6475, roughness: 0.05, transparent: true, opacity: 0.6, depthWrite: false,
        emissive: 0x2a55ff, emissiveIntensity: 0.9 }),
      bowlWater: phys({ name: 'Water in chamber', color: 0xbfe3ff, roughness: 0.05, transparent: true, opacity: 0.16, depthWrite: false }),
    };
  }

  // Which material each printed STL gets
  const PRINTED_MATERIAL = { chamber: 'petg', lid: 'petg', carrier: 'petg', topCap: 'petg', diffuser: 'diffuser' };

  function build(THREE, opts) {
    opts = opts || {};
    const printed = opts.printed || {};
    const M = materials(THREE);
    const V3 = THREE.Vector3;
    const TAU = Math.PI * 2;
    const rootGroup = new THREE.Group();
    rootGroup.name = 'HydroTrack_v3_real_parts';
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
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; i ? s.lineTo(r * Math.cos(a), r * Math.sin(a)) : s.moveTo(r, 0); }
      s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      return geo;
    };
    const wire = (g, pts, mat, r) => mesh(g, new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(pts.map((p) => new V3(p[0], p[1], p[2]))), 64, r || 0.6, 8, false), mat);

    // ---------------- Tap adapter (brass) ----------------
    {
      const g = part('adapter');
      mesh(g, ring(13, 10.5, 11.5), M.brass, 0, 103.5, 0, 0, 0, 0, 'G½ female socket');
      mesh(g, hexPrism(27, 5), M.brass, 0, 115, 0, 0, 0, 0, 'Hex 27 mm');
      mesh(g, ring(11, 7.5, 9), M.brass, 0, 120, 0, 0, 0, 0, 'M22×1 male thread');
      for (let i = 0; i < 5; i++) mesh(g, new THREE.TorusGeometry(11, 0.32, 6, 48), M.brass, 0, 124 + i * 1.0, 0, Math.PI / 2);
    }

    // ---------------- YF-S201C flow sensor ----------------
    {
      const g = part('flow');
      mesh(g, cyl(10.45, 11), M.clear, 0, 51, 0, 0, 0, 0, 'G½ thread (bottom)');
      mesh(g, cyl(12.5, 41.5), M.clear, 0, 62, 0, 0, 0, 0, 'Body tube');
      mesh(g, cyl(10.45, 11), M.clear, 0, 103.5, 0, 0, 0, 0, 'G½ thread (top)');
      for (const y0 of [51, 103.5]) for (let i = 0; i < 6; i++)
        mesh(g, new THREE.TorusGeometry(10.45, 0.3, 6, 40), M.clear, 0, y0 + 1.5 + i * 1.6, 0, Math.PI / 2);
      const drum = mesh(g, cylX(16, 29.5), M.clear, -12.5, 82.75, 0, 0, 0, 0, 'Turbine housing');
      drum.renderOrder = 2;
      mesh(g, cylX(11, 6), M.black, 17, 82.75, 0, 0, 0, 0, 'Hall sensor cap');
      const rotor = new THREE.Group();
      rotor.name = 'Turbine rotor';
      rotor.position.set(2.25, 82.75, 0);
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

    // ---------------- Piezo disc on the drum face ----------------
    {
      const g = part('piezo');
      mesh(g, cylX(13.5, 0.25), M.brass, -12.85, 82.75, 0, 0, 0, 0, 'Brass plate');
      mesh(g, cylX(10, 0.28), M.ceramic, -13.13, 82.75, 0, 0, 0, 0, 'Piezo ceramic');
    }

    // ---------------- Printed chamber lid + O-ring ----------------
    {
      const g = part('lid');
      const oring = mesh(g, new THREE.TorusGeometry(24.75, 0.75, 12, 96), M.rubber, 0, 51.55, 0, Math.PI / 2, 0, 0, 'O-ring 48 × 1.5 (compressed)');
      oring.scale.set(1, 1, 0.73);
    }

    // ---------------- Printed chamber cup, lining and water ----------------
    {
      const g = part('chamber');
      mesh(g, ring(23.95, 23.8, 39), M.foil, 0, 9, 0, 0, 0, 0, 'Aluminium tape lining');
      const water = mesh(g, cyl(23.7, 41.8), M.bowlWater, 0, 9.1, 0, 0, 0, 0, 'Water');
      water.userData.water = true;
    }

    // ---------------- TDS probe (sits in the cup's snap clip) ----------------
    {
      const g = part('tdsProbe');
      mesh(g, cyl(6, 32), M.black, 0, 19, -16.5, 0, 0, 0, 'Probe head');
      for (const dx of [-2.5, 2.5]) mesh(g, cyl(0.5, 8), M.steel, dx, 11, -16.5, 0, 0, 0, 'Needle');
      wire(g, [[0, 51, -16.5], [0, 55.5, -16.5], [0, 57.6, -19.5], [-2.5, 58.6, -23], [-5, 61, -23.6], [-6, 64.4, -23]], M.wireBlack, 1.5);
    }

    // ---------------- NTC thermistor ----------------
    {
      const g = part('ntc');
      mesh(g, cylZ(2.5, 25), M.steel, 0, 30, 2.6, 0, 0, 0, 'Steel tip');
      wire(g, [[0, 30, 27.6], [0, 31.6, 27.2], [0, 35, 26.8], [0, 50, 26.8], [0, 56.6, 26.9], [3, 58.6, 23.6], [8.5, 60.5, 20.0]], M.wireBlack, 1.0);
    }

    // ---------------- UV-C LEDs + quartz windows ----------------
    {
      const g = part('uvc');
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        const sub = new THREE.Group();
        sub.name = 'UV-C LED ' + (i + 1);
        sub.rotation.y = -a;              // local +X points outward along angle a
        sub.position.y = 30;
        mesh(sub, cylX(3, 1), M.quartz, 24.6, 0, 0, 0, 0, 0, 'Quartz window 6 × 1 mm');
        mesh(sub, box(1.6, 3.5, 3.5), M.ceramic, 26.4, 0, 0, 0, 0, 0, 'LED 3535');
        mesh(sub, box(0.1, 2.6, 2.6), M.uvLens, 25.57, 0, 0, 0, 0, 0, 'UV lens');
        mesh(sub, box(1, 8, 8), M.alu, 27.7, 0, 0, 0, 0, 0, 'Aluminium LED board');
        g.add(sub);
      }
    }

    // ---------------- WS2812B ring (LEDs face down into the diffuser) ----------------
    {
      const g = part('ring');
      mesh(g, ring(22.25, 15.875, 1.6), M.pcbBlack, 0, 2.6, 0, 0, 0, 0, 'Ring PCB');
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        const x = 19.06 * Math.cos(a), z = 19.06 * Math.sin(a);
        mesh(g, box(5, 1.6, 5), M.ceramic, x, 1.8, z, 0, -a, 0, 'WS2812B ' + (i + 1));
        mesh(g, box(3.6, 0.1, 3.6), M.haloLens, x, 0.97, z, 0, -a, 0, 'LED lens');
      }
    }

    part('diffuser');

    {
      const g = part('neoperl');
      mesh(g, ring(10.4, 8.6, 13), M.grey, 0, 6.5, 0, 0, 0, 0, 'Insert body');
      mesh(g, cyl(8.6, 0.8), M.black, 0, 6.6, 0, 0, 0, 0, 'Honeycomb screen');
      for (let r = 2; r < 8.6; r += 2.2) mesh(g, new THREE.TorusGeometry(r, 0.25, 4, 36), M.grey, 0, 6.6, 0, Math.PI / 2);
    }

    part('carrier');

    // ---------------- ESP32-S3-DevKitC-1 (in the carrier rails) ----------------
    {
      const g = part('esp32');
      mesh(g, box(1.6, 62.7, 25.4), M.pcbBlack, -21.8, 56 + 62.7 / 2, 0, 0, 0, 0, 'PCB');
      mesh(g, box(3.1, 17.6, 18), M.steel, -24.15, 102.0, 0, 0, 0, 0, 'WROOM-1 shield');
      mesh(g, box(0.8, 7.9, 18), M.pcbBlack, -23.0, 114.75, 0, 0, 0, 0, 'Antenna area');
      mesh(g, box(0.1, 5, 14), M.gold, -23.45, 114.5, 0, 0, 0, 0, 'Antenna trace');
      for (const z of [-6.5, 6.5]) mesh(g, box(3.2, 7.4, 9), M.steel, -24.2, 59.7, z, 0, 0, 0, 'USB-C');
      mesh(g, box(1.5, 3, 3), M.chip, -23.35, 71.5, 8, 0, 0, 0, 'Regulator');
      mesh(g, box(1.2, 5, 4), M.chip, -23.2, 67.5, -6, 0, 0, 0, 'USB-UART bridge');
      for (const z of [-9, 9]) mesh(g, box(2, 4, 4), M.ceramic, -23.6, 77.5, z, 0, 0, 0, 'Button');
      mesh(g, box(1, 2, 2), M.ceramic, -23.1, 87.5, 9, 0, 0, 0, 'RGB LED');
      for (let i = 0; i < 22; i++) for (const z of [-11.4, 11.4])
        mesh(g, cylX(0.6, 0.1), M.gold, -22.7, 60.5 + i * 2.54, z, 0, 0, 0);
    }

    // ---------------- LiPo battery (between carrier back plate and rails) ----------------
    {
      const g = part('battery');
      mesh(g, box(5, 50, 34), M.battery, -17, 81, 0, 0, 0, 0, 'Pouch cell');
      mesh(g, box(4, 3, 12), M.foilPouch, -17, 107.5, 0, 0, 0, 0, 'Protection board');
    }

    // ---------------- TDS signal board (on carrier panel B) ----------------
    {
      const g = part('tdsBoard');
      mesh(g, box(32, 42, 1.6), M.pcbDfr, 0, 83, -19.3, 0, 0, 0, 'PCB');
      mesh(g, box(6, 7.5, 5.8), M.ceramic, -6, 68, -23, 0, 0, 0, 'Probe connector (XH2.54)');
      mesh(g, box(6, 7.5, 5.8), M.ceramic, 6, 98, -23, 0, 0, 0, 'Gravity connector (PH2.0)');
      mesh(g, box(5, 5, 1.5), M.chip, 4, 80, -20.85, 0, 0, 0, 'LMV324');
      mesh(g, box(5, 4, 1.5), M.chip, -6, 86, -20.85, 0, 0, 0, 'CD4060');
      mesh(g, box(3, 3, 2), M.chip, 8, 70, -21.1, 0, 0, 0, 'Regulator');
    }

    // ---------------- Power & signal perfboard (on carrier panel C) ----------------
    {
      const g = part('perfboard');
      mesh(g, box(22, 28, 1.6), M.fr4, 0, 72, 18.8, 0, 0, 0, 'Perfboard');
      for (let i = 0; i < 8; i++) for (let j = 0; j < 10; j++)
        mesh(g, cylZ(0.55, 0.05), M.copper, -9 + i * 2.54, 60 + j * 2.54, 19.6);
      mesh(g, box(6.4, 9.8, 3.3), M.chip, -5, 79, 21.6, 0, 0, 0, 'LM358 (DIP-8)');
      mesh(g, box(8, 8, 0.8), M.pcbBlue, 5.5, 80, 21.5, 0, 0, 0, 'TPS62840 adapter');
      mesh(g, box(2, 1.5, 0.8), M.chip, 5.5, 80, 22.3, 0, 0, 0, 'TPS62840 (VSON-8)');
      mesh(g, box(2.5, 2, 1.2), M.grey, 5.5, 77, 22.5, 0, 0, 0, 'Inductor');
      mesh(g, box(12, 14, 1.2), M.pcbBlue, 0, 66, 20.2, 0, 0, 0, 'UV-C boost driver (not in PO)');
      mesh(g, box(4, 4, 2), M.grey, -3, 66, 21.8, 0, 0, 0, 'Boost inductor');
      mesh(g, box(2.5, 2.5, 1.2), M.chip, 3.5, 67, 21.4, 0, 0, 0, 'Boost IC');
    }

    // ---------------- TP4056 USB-C charger (top of panel C) ----------------
    {
      const g = part('tp4056');
      mesh(g, box(17, 28, 1.6), M.pcbBlue, 0, 105.5, 18.8, 0, 0, 0, 'PCB');
      mesh(g, box(9, 7.4, 3.2), M.steel, 0, 115.8, 21.2, 0, 0, 0, 'USB-C receptacle');
      mesh(g, box(5, 4, 1.5), M.chip, -3, 103.5, 20.35, 0, 0, 0, 'TP4056');
      mesh(g, box(3, 3, 1.2), M.chip, 4, 97.5, 20.2, 0, 0, 0, 'DW01 protection');
      for (const x of [-5, -3]) mesh(g, box(1.6, 0.8, 0.6), M.ceramic, x, 109.5, 19.9, 0, 0, 0, 'Status LED');
    }

    // ---------------- Wiring ----------------
    {
      const g = part('wires');
      // Halo ring -> ESP32: out under the cup floor, up the channel at the back, through the lid and carrier notches
      wire(g, [[-19, 4.8, 0], [-23, 4.85, 0], [-26.4, 4.9, 0], [-26.9, 5.6, 0], [-26.9, 8, 0], [-26.9, 50, 0], [-26.9, 56.6, 0], [-24.5, 61, 0], [-23.2, 64.5, -0.6]], M.wireGreen, 0.6);
      wire(g, [[-19, 4.8, 1.4], [-23, 4.85, 1.4], [-26.4, 4.9, 1.4], [-26.9, 5.6, 1.4], [-26.9, 8, 1.4], [-26.9, 50, 1.4], [-26.9, 56.6, 1.4], [-24.5, 61, 1.2], [-23.2, 64.5, 0.8]], M.wireRed, 0.6);
      // Flow sensor hall output -> ESP32, over the top of the rails
      wire(g, [[23, 86, 0], [24.5, 100, 8], [17, 108, 17], [0, 111, 24.6], [-12, 113, 21], [-22, 116, 19], [-24.5, 119.2, 14], [-23.3, 119.2, 11.4], [-22.9, 114, 11.4]], M.wireYellow, 0.6);
      // Battery -> TP4056, over the back plate and down the side of panel C
      wire(g, [[-17, 109, 3], [-15, 114, 8], [-12, 113.5, 19.5], [-11.6, 100, 20.6], [-6.5, 94, 20.0]], M.wireRed, 0.6);
      wire(g, [[-17, 109, -3], [-15.5, 114, 5], [-12.6, 113, 18.6], [-12.2, 99, 20.4], [-4, 93.5, 20.0]], M.wireBlack, 0.6);
      // Piezo -> LM358
      wire(g, [[-13.0, 96.3, 0], [-12.2, 99.5, 6], [-9.5, 101.5, 15.8], [-12.4, 96, 17.6], [-12.4, 86, 20.2], [-8.6, 82, 20.4]], M.wireBlack, 0.45);
    }

    // ---------------- Enclosure ----------------
    mesh(part('sleeve'), ring(31.75, 30.15, 96, 96), M.alu, 0, 8, 0, 0, 0, 0, 'Aluminium tube Ø63.5');
    mesh(part('topCap'), ring(13.5, 11.2, 0.5), M.rubber, 0, 123, 0, 0, 0, 0, 'Rubber washer (tap seal)');

    // ---------------- Basin tap (context only) ----------------
    if (opts.tap !== false) {
      const g = part('tap');
      mesh(g, cyl(14, 13.5), M.chrome, 0, 123.5, 0, 0, 0, 0, 'Spout end (M22 female)');
      const spout = new THREE.CatmullRomCurve3([
        new V3(0, 136, 0), new V3(0, 150, 0), new V3(-6, 166, 0), new V3(-30, 178, 0),
        new V3(-80, 182, 0), new V3(-130, 180, 0), new V3(-160, 174, 0)]);
      mesh(g, new THREE.TubeGeometry(spout, 96, 9.5, 24, false), M.chrome, 0, 0, 0, 0, 0, 0, 'Spout');
      mesh(g, cyl(25, 230), M.chrome, -170, -40, 0, 0, 0, 0, 'Tap body');
      mesh(g, cyl(27, 6), M.chrome, -170, 190, 0, 0, 0, 0, 'Tap top');
      const lever = mesh(g, box(70, 7, 14), M.chrome, -150, 202, 0, 0, 0, 0.18, 'Lever');
      lever.geometry.translate(10, 0, 0);
    }

    // ---------------- Laminar water stream (shown when water flows) ----------------
    {
      const stream = mesh(rootGroup, cyl(8.4, 170, 32), M.water, 0, -164.5, 0, 0, 0, 0, 'Laminar stream');
      stream.userData.water = true;
      anim.stream = stream;
    }

    return { root: rootGroup, parts, materials: M, anim };
  }

  // Shared loader: turns parts.json + STL bytes into placed geometries.
  // `fetchBytes(path)` returns an ArrayBuffer; `STLLoader` and `toCreasedNormals` come from three's addons.
  async function loadPrinted(THREE, STLLoader, toCreasedNormals, fetchBytes, base) {
    const manifest = JSON.parse(new TextDecoder().decode(await fetchBytes(base + 'parts.json')));
    const loader = new STLLoader();
    const out = {};
    await Promise.all(manifest.parts.map(async (p) => {
      let geo = loader.parse(await fetchBytes(base + p.file));
      geo.applyMatrix4(new THREE.Matrix4().fromArray(p.matrix));
      geo.deleteAttribute('normal');
      geo = toCreasedNormals(geo, THREE.MathUtils.degToRad(30));
      out[p.id] = geo;
    }));
    return out;
  }

  root.HydroTrackModel = { PARTS, BODY, SPEC, build, loadPrinted };
})(typeof globalThis !== 'undefined' ? globalThis : window);
