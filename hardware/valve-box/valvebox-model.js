// ====================================================================
//  HydroTrack valve box — 3D scene: the printed box with its real parts,
//  the motorised ¾" ball valve on the main pipe, fittings and cables.
//  Units: mm. Y up, Z out of the wall. Box parts sit where
//  print/layout.json says (written by print/make_box_parts.py).
// ====================================================================
(function (root) {
  const BOX_AT = [-80, 30, 0];           // where the box hangs on the wall
  const PIPE = { y: 215, z: 42, od: 22.2 }; // ¾" CPVC main pipe (22.2 mm OD)
  const VX = 60;                          // valve centre along the pipe

  const PARTS = [
    // ---------------- Valve box (printed) ----------------
    { id: 'body', name: 'Box body (printed)', group: 'Valve box', printed: true, size: '100.8 × 116.8 × 37 mm', source: 'designed', explode: [0, 0, -18],
      note: 'File 01_box_body.stl, white PETG, printed back down. Keyholes on the back hang it on two wall screws. The cable gland and DC jack are in the bottom wall, so water drips off the cables instead of running in.' },
    { id: 'cover', name: 'Front cover (printed)', group: 'Valve box', printed: true, shell: true, size: '100.8 × 116.8 × 9.4 mm', source: 'designed', explode: [0, 0, 78],
      note: 'File 02_box_cover.stl, printed face down. A skirt fits inside the body’s rim to keep splashes out; four M3 screws hold it.' },
    { id: 'halo', name: 'Halo ring (printed)', group: 'Valve box', printed: true, size: 'Ø36.6 × 4.3 mm, natural PETG', source: 'designed', explode: [0, 0, 104],
      note: 'File 03_halo_ring.stl in natural (clear) PETG. Glows blue when water is on, amber while an alert waits, red when the valve is shut.' },
    { id: 'button', name: 'Button cap (printed)', group: 'Valve box', printed: true, size: 'Ø20.6 × 4.2 mm', source: 'designed', explode: [0, 0, 124],
      note: 'File 04_button_cap.stl. Press to close or open the water by hand, even with no phone or Wi-Fi.' },
    // ---------------- Electronics ----------------
    { id: 'esp32', name: 'ESP32 DevKit V1 (30-pin)', group: 'Electronics', size: '51.4 × 28.3 mm (MEASURE)', source: 'listing', price: '₹400–600', explode: [0, 0, 40],
      note: 'The gateway: Wi-Fi to your phone, ESP-NOW to the tap devices. Mounted pins up on four corner posts, so every connection is a plug-in jumper wire, no soldering.' },
    { id: 'relay', name: '2-channel 5 V relay module', group: 'Electronics', size: '51 × 38 × 18.5 mm', source: 'listing', price: '₹100–150', explode: [0, 0, 32],
      note: 'Switches the valve. Channel 1 drives the valve’s control wire; channel 2 is ready for 3-wire valves that need separate open and close wires. Screwed to four standoffs.' },
    { id: 'buck', name: 'MP1584 step-down 12 V → 5 V', group: 'Electronics', size: '22 × 17 × 4 mm', source: 'listing', price: '₹60', explode: [0, 0, 22],
      note: 'Makes 5 V for the ESP32, the relay coils and the LED ring from the same 12 V adapter. Set it to 5.0 V with a multimeter before connecting.' },
    { id: 'term', name: '5-way screw terminal block', group: 'Electronics', size: '25.4 × 8 × 11 mm', source: 'listing', price: '₹20', explode: [0, 0, 22],
      note: 'Where the valve’s five wires land: 12 V, ground, control, and the two position-feedback wires.' },
    { id: 'btnModule', name: 'Button + 8-LED ring board', group: 'Electronics', size: '34 × 34 mm perfboard', source: 'designed', price: '₹120', explode: [0, 0, 60],
      note: 'A 12 × 12 mm push switch in the middle of a WS2812B 8-LED ring, on a small perfboard screwed to two posts on the cover.' },
    { id: 'jack', name: 'DC jack 5.5 × 2.1 mm', group: 'Electronics', size: 'Panel mount, Ø8 hole', source: 'listing', price: '₹20', explode: [0, -24, 0],
      note: 'The 12 V adapter plugs in here, from below. Only safe low voltage goes inside the box: no 230 V.' },
    { id: 'gland', name: 'PG7 cable gland', group: 'Electronics', size: 'For a Ø3–6.5 mm cable', source: 'listing', price: '₹20', explode: [0, -30, 0],
      note: 'Seals the valve cable where it enters. Leave a drip loop below the box.' },
    { id: 'wires', name: 'Internal wiring', group: 'Electronics', size: 'Jumper wires + 22 AWG', source: 'designed', explode: [0, 0, 0],
      note: 'Valve wires to the terminals and relay, 12 V to the step-down board, 5 V to the ESP32, jumpers from the ESP32 to the relay, LED ring and button. Every run is checked against every part.' },
    // ---------------- Plumbing ----------------
    { id: 'valve', name: 'Motorised ball valve ¾" (DN20)', group: 'Plumbing', size: 'About 73 × 62 × 103 mm (MEASURE)', source: 'listing', price: '₹1,200–2,500', explode: [0, 46, 0],
      note: 'Brass ball valve with a 12 V actuator (CR05-type, 5 wires) and a manual-override knob. Turns 90° in about 5 seconds and then cuts its own motor power. Female G¾ threads both ends.' },
    { id: 'fittings', name: 'CPVC ¾" MTA adapters + union', group: 'Plumbing', size: '¾" brass male thread', source: 'listing', price: '₹150–300', explode: [0, 28, 0],
      note: 'Male threaded adapters solvent-welded onto the CPVC pipe and screwed into the valve with PTFE tape. The union lets you take the valve out without cutting the pipe.' },
    { id: 'pipe', name: 'Main pipe (¾" CPVC)', group: 'Plumbing', context: true, size: 'Ø22.2 mm', source: 'listing', explode: [0, 0, 0],
      note: 'The house’s main supply, after the meter or tank outlet. Arrows show water flowing.' },
    { id: 'cable', name: 'Valve cable + 12 V adapter', group: 'Plumbing', size: '5-core cable, 12 V 1 A adapter', source: 'listing', price: '₹200–300', explode: [0, 0, 0],
      note: 'The valve’s cable runs down behind the pipe to the box with a drip loop. The 12 V adapter plugs into a normal wall socket.' },
    { id: 'wall', name: 'Wall (for scale)', group: 'Plumbing', context: true, size: '', source: 'designed', explode: [0, 0, 0], note: 'Not part of the product.' },
  ];

  function materials(THREE) {
    const P = (o) => new THREE.MeshPhysicalMaterial(o);
    return {
      shell: P({ name: 'PETG white', color: 0xf1efe9, roughness: 0.6, clearcoat: 0.15, clearcoatRoughness: 0.6 }),
      petg: P({ name: 'PETG white', color: 0xe9ebe8, roughness: 0.5 }),
      haloMat: P({ name: 'Natural PETG halo', color: 0x9aa6ab, roughness: 0.5, transparent: true, opacity: 0.93, emissive: 0x2a55ff, emissiveIntensity: 1.2 }),
      haloLed: P({ name: 'LED lens', color: 0xffffff, emissive: 0x2a55ff, emissiveIntensity: 2.2 }),
      brass: P({ name: 'Brass', color: 0xcaa24c, metalness: 1, roughness: 0.3 }),
      chrome: P({ name: 'Chrome', color: 0xe6e8ea, metalness: 1, roughness: 0.1 }),
      steel: P({ name: 'Steel', color: 0xb9bdc1, metalness: 1, roughness: 0.3 }),
      actuator: P({ name: 'Actuator plastic', color: 0x2c3136, roughness: 0.5 }),
      knob: P({ name: 'Override knob', color: 0xd94c2a, roughness: 0.45 }),
      cpvc: P({ name: 'CPVC', color: 0xe9dcbc, roughness: 0.55 }),
      black: P({ name: 'Black plastic', color: 0x1b1d20, roughness: 0.55 }),
      grey: P({ name: 'Grey plastic', color: 0x8b9095, roughness: 0.55 }),
      pcbBlue: P({ name: 'PCB blue', color: 0x1f4c98, roughness: 0.55 }),
      pcbBlack: P({ name: 'PCB black', color: 0x1c2226, roughness: 0.6 }),
      pcbGreen: P({ name: 'PCB green', color: 0x1f6b3a, roughness: 0.55 }),
      fr4: P({ name: 'FR4', color: 0xc2a76e, roughness: 0.7 }),
      relayBlue: P({ name: 'Relay body', color: 0x2a62c9, roughness: 0.4 }),
      termGreen: P({ name: 'Terminal block', color: 0x2f8a52, roughness: 0.5 }),
      termBlue: P({ name: 'Terminal block', color: 0x2a6fd6, roughness: 0.5 }),
      chip: P({ name: 'IC', color: 0x202224, roughness: 0.45 }),
      gold: P({ name: 'Gold', color: 0xd7b25a, metalness: 1, roughness: 0.3 }),
      ceramic: P({ name: 'Ceramic', color: 0xf1efe8, roughness: 0.4 }),
      wall: P({ name: 'Wall', color: 0xdedbd4, roughness: 0.95 }),
      socket: P({ name: 'Switch plate', color: 0xf5f4f0, roughness: 0.5 }),
      wire_red: P({ name: 'Wire red', color: 0xc8312b, roughness: 0.5 }),
      wire_black: P({ name: 'Wire black', color: 0x222222, roughness: 0.5 }),
      wire_yellow: P({ name: 'Wire yellow', color: 0xe3b62a, roughness: 0.5 }),
      wire_green: P({ name: 'Wire green', color: 0x2f9a52, roughness: 0.5 }),
      wire_blue: P({ name: 'Wire blue', color: 0x2f6bd0, roughness: 0.5 }),
      wire_grey: P({ name: 'Cable grey', color: 0x9a9fa5, roughness: 0.6 }),
      flow: new THREE.MeshBasicMaterial({ name: 'Flow arrow', color: 0x3d7bff, transparent: true, opacity: 0.85 }),
    };
  }

  const PRINTED_MATERIAL = { body: 'shell', cover: 'shell', halo: 'haloMat', button: 'shell' };

  function build(THREE, opts) {
    const L = opts.layout, printed = opts.printed || {};
    const M = materials(THREE);
    const V3 = THREE.Vector3, TAU = Math.PI * 2;
    const rootGroup = new THREE.Group(); rootGroup.name = 'HydroTrack valve box';
    const boxGroup = new THREE.Group(); boxGroup.name = 'Valve box'; boxGroup.position.set(...BOX_AT); rootGroup.add(boxGroup);
    const parts = {};
    const anim = {};
    const part = (id, parent) => {
      const meta = PARTS.find((p) => p.id === id);
      const g = new THREE.Group(); g.name = meta.name; g.userData.partId = id;
      (parent || rootGroup).add(g); parts[id] = g;
      if (printed[id]) { const m = new THREE.Mesh(printed[id], M[PRINTED_MATERIAL[id]]); m.name = meta.name + ' (STL)'; g.add(m); }
      return g;
    };
    const mesh = (g, geo, mat, x, y, z, rx, ry, rz, name) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.rotation.set(rx || 0, ry || 0, rz || 0);
      if (name) m.name = name; g.add(m); return m;
    };
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const cylY = (r, h, seg) => new THREE.CylinderGeometry(r, r, h, seg || 32);                                     // centred, along Y
    const cylX = (r, h, seg) => { const g = new THREE.CylinderGeometry(r, r, h, seg || 32); g.rotateZ(Math.PI / 2); return g; };
    const cylZ = (r, h, seg) => { const g = new THREE.CylinderGeometry(r, r, h, seg || 32); g.rotateX(Math.PI / 2); return g; };
    const hexX = (af, h) => { const g = new THREE.CylinderGeometry(af / Math.sqrt(3), af / Math.sqrt(3), h, 6); g.rotateZ(Math.PI / 2); return g; };
    const tube = (g, pts, mat, r, name) => mesh(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new V3(...p)), false, 'centripetal'),
      Math.max(32, pts.length * 10), r, 8, false), mat, 0, 0, 0, 0, 0, 0, name);
    const rrectShape = (w, h, r) => { const s = new THREE.Shape(); const x = -w / 2, y = -h / 2;
      s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
      s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
      s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; };
    const rbox = (w, h, d, r) => { const g = new THREE.ExtrudeGeometry(rrectShape(w, h, r), { depth: d, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1.2, bevelSegments: 3 }); g.translate(0, 0, -d / 2); return g; };

    // ---------------- Printed box parts ----------------
    for (const id of ['body', 'cover', 'halo', 'button']) part(id, boxGroup);

    // ---------------- ESP32 DevKit V1, pins up (module faces the back plate) ----------------
    {
      const g = part('esp32', boxGroup), E = L.ESP, x0 = L.ESP_X0, y0 = L.ESP_Y0, z = L.Z_ESP;
      const cx = x0 + E.w / 2, cy = y0 + E.l / 2;
      mesh(g, box(E.w, E.l, E.pcb), M.pcbBlack, cx, cy, z + E.pcb / 2, 0, 0, 0, 'PCB');
      mesh(g, box(18, 25.5, 3.1), M.steel, cx, y0 + E.l - 14, z - 1.55, 0, 0, 0, 'ESP-WROOM-32 (underneath)');
      mesh(g, box(8, 5.5, 3), M.steel, cx, y0 + 2.2, z - 1.5, 0, 0, 0, 'Micro-USB');
      for (const side of [0.4 + 1.25, E.w - 0.4 - 1.25]) {
        mesh(g, box(2.5, 38.1, 2.5), M.black, x0 + side, y0 + 25.5, z + E.pcb + 1.25, 0, 0, 0, 'Header');
        for (let i = 0; i < 15; i++) mesh(g, box(0.64, 0.64, 6), M.gold, x0 + side, y0 + 7.7 + i * 2.54, z + E.pcb + 5.5, 0, 0, 0, 'Pin');
      }
      // jumper housings on the pins that are used
      const used = [[0, 1], [0, 4], [0, 7], [0, 10], [1, 2], [1, 5], [1, 8], [1, 12], [1, 14]];
      for (const [s, i] of used) mesh(g, box(2.5, 2.5, 14), M.black, x0 + (s ? E.w - 1.65 : 1.65), y0 + 7.7 + i * 2.54, z + E.pcb + 8.5 + 7, 0, 0, 0, 'Jumper');
    }
    // ---------------- 2-channel relay module ----------------
    {
      const g = part('relay', boxGroup), R = L.RELAY, [rx, ry] = L.RELAY_C, z = L.Z_RELAY, zp = z + R.pcb;
      mesh(g, box(R.w, R.l, R.pcb), M.pcbBlue, rx, ry, z + R.pcb / 2, 0, 0, 0, 'PCB');
      for (const dx of [-9, 9]) mesh(g, box(15, 19, 15.5), M.relayBlue, rx + dx, ry + 2, zp + 7.75, 0, 0, 0, 'Relay 5 V 10 A');
      for (const dx of [-9.5, 9.5]) mesh(g, box(15, 7.5, 10), M.termBlue, rx + dx, ry - R.l / 2 + 4, zp + 5, 0, 0, 0, 'Screw terminal (COM/NO/NC)');
      mesh(g, box(10.2, 2.5, 8.5), M.black, rx, ry + R.l / 2 - 2.5, zp + 4.25, 0, 0, 0, 'Input header');
      for (let i = 0; i < 4; i++) mesh(g, box(2.5, 2.5, 14), M.black, rx - 3.8 + i * 2.54, ry + R.l / 2 - 2.5, zp + 8.5 + 7, 0, 0, 0, 'Jumper');
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(g, cylZ(2.6, 1.6, 16), M.steel, rx + sx * R.hole_dx / 2, ry + sy * R.hole_dy / 2, zp + 0.8, 0, 0, 0, 'M3 screw');
    }
    {
      const g = part('buck', boxGroup), [bx, by] = L.BUCK_C, B = L.BUCK;
      mesh(g, box(B.w, B.l, 1.2), M.pcbGreen, bx, by, 0.6, 0, 0, 0, 'PCB');
      mesh(g, box(5, 5, 2.6), M.grey, bx - 3, by, 2.5, 0, 0, 0, 'Inductor');
      mesh(g, box(3, 3, 1.2), M.chip, bx + 4, by + 3, 1.8, 0, 0, 0, 'MP1584');
      mesh(g, cylZ(1.4, 2, 12), M.ceramic, bx + 7, by - 4, 2.2, 0, 0, 0, 'Trim pot');
    }
    {
      const g = part('term', boxGroup), T = L.TERM;
      mesh(g, box(T.w, T.l, T.h), M.termGreen, L.TERM_X0 + T.w / 2, L.TERM_Y0 + T.l / 2, T.h / 2, 0, 0, 0, 'Terminal block');
      for (let i = 0; i < 5; i++) mesh(g, cylZ(1.4, 1, 12), M.steel, L.TERM_X0 + 2.54 + i * 5.08, L.TERM_Y0 + T.l / 2, T.h + 0.3, 0, 0, 0, 'Screw');
    }
    {
      const g = part('btnModule', boxGroup), [hx, hy] = L.HALO_C, zb = L.Z_BTNPCB, RG = L.RING8;
      mesh(g, box(34, 34, 1.6), M.fr4, hx, hy, zb - 0.8, 0, 0, 0, 'Perfboard');
      const ringShape = new THREE.Shape(); ringShape.absarc(0, 0, RG.od / 2, 0, TAU, false);
      const hole = new THREE.Path(); hole.absarc(0, 0, RG.id / 2, 0, TAU, true); ringShape.holes.push(hole);
      mesh(g, new THREE.ExtrudeGeometry(ringShape, { depth: RG.pcb, bevelEnabled: false, curveSegments: 48 }), M.pcbBlack, hx, hy, zb, 0, 0, 0, 'WS2812B 8-LED ring');
      for (let i = 0; i < RG.n; i++) {
        const a = (i / RG.n) * TAU, x = hx + 12.5 * Math.cos(a), y = hy + 12.5 * Math.sin(a);
        mesh(g, box(5, 5, RG.led), M.ceramic, x, y, zb + RG.pcb + RG.led / 2, 0, 0, a, 'LED');
        mesh(g, box(3.6, 3.6, 0.1), M.haloLed, x, y, zb + RG.pcb + RG.led + 0.05, 0, 0, a, 'LED lens');
      }
      mesh(g, box(12, 12, 3.5), M.black, hx, hy, zb + 1.75, 0, 0, 0, 'Tactile switch 12 × 12');
      mesh(g, cylZ(3.5, 1.5, 24), M.grey, hx, hy, zb + 4.25, 0, 0, 0, 'Plunger');
    }
    {
      const g = part('jack', boxGroup), J = L.JACK, o = L.OUT;
      mesh(g, cylY(J.body_d / 2, J.body_l), M.black, L.JACK_X, J.body_l / 2, L.JACK_Z, 0, 0, 0, 'Jack body');
      mesh(g, cylY(J.nut_d / 2, 2.5), M.steel, L.JACK_X, o[2] - 1.25, L.JACK_Z, 0, 0, 0, 'Nut');
      mesh(g, cylY(5.5, 12), M.black, L.JACK_X, o[2] - 9, L.JACK_Z, 0, 0, 0, 'Adapter plug');
    }
    {
      const g = part('gland', boxGroup), G = L.GLAND, o = L.OUT;
      mesh(g, cylY(G.nut_d / 2, G.nut_t, 6), M.grey, L.GLAND_X, G.nut_t / 2, L.GLAND_Z, 0, 0, 0, 'Lock nut');
      mesh(g, cylY(G.body_d / 2, 6, 6), M.grey, L.GLAND_X, o[2] - 3, L.GLAND_Z, 0, 0, 0, 'Gland hex');
      mesh(g, new THREE.CylinderGeometry(4.5, 7, 8, 24), M.grey, L.GLAND_X, o[2] - 10, L.GLAND_Z, 0, 0, 0, 'Gland dome');
    }
    {
      const g = part('wires', boxGroup);
      for (const [name, w] of Object.entries(L.WIRES)) tube(g, w.pts, M['wire_' + w.color] || M.wire_black, w.r, name);
    }

    // ---------------- Wall, pipe, fittings, valve ----------------
    {
      const g = part('wall');
      mesh(g, box(760, 520, 6), M.wall, -20, 110, L.OUT[4] - 3, 0, 0, 0, 'Wall');
      mesh(g, box(86, 86, 8), M.socket, 60, -40, L.OUT[4] + 4, 0, 0, 0, 'Wall socket plate');
      mesh(g, box(48, 54, 30), M.black, 60, -44, L.OUT[4] + 23, 0, 0, 0, '12 V 1 A adapter');
    }
    const PY = PIPE.y, PZ = PIPE.z, PR = PIPE.od / 2;
    {
      const g = part('pipe');
      mesh(g, cylX(PR, 255, 40), M.cpvc, -127.5, PY, PZ, 0, 0, 0, 'Pipe (supply side)');
      mesh(g, cylX(PR, 18, 40), M.cpvc, 134, PY, PZ, 0, 0, 0, 'Pipe stub');
      mesh(g, cylX(PR, 208, 40), M.cpvc, 276, PY, PZ, 0, 0, 0, 'Pipe (house side)');
      for (const x of [-210, 330]) { mesh(g, box(14, 30, PZ + PR + 3 - L.OUT[4]), M.grey, x, PY, (PZ + PR + 3 + L.OUT[4]) / 2, 0, 0, 0, 'Pipe clamp'); }
      // flow arrows on the front of the pipe (animated)
      const arrowShape = new THREE.Shape(); arrowShape.moveTo(-4, -5); arrowShape.lineTo(4, 0); arrowShape.lineTo(-4, 5); arrowShape.lineTo(-1.5, 0); arrowShape.closePath();
      const ag = new THREE.ShapeGeometry(arrowShape);
      anim.arrows = [];
      for (let i = 0; i < 18; i++) { const a = mesh(g, ag, M.flow, 0, PY, PZ + PR + 0.4); a.userData.flow = true; anim.arrows.push(a); }
    }
    {
      const g = part('fittings');
      // left MTA: socket over pipe, brass hex, thread into valve
      mesh(g, cylX(14.5, 26, 32), M.cpvc, VX - 31 - 12 - 13, PY, PZ, 0, 0, 0, 'MTA socket (CPVC)');
      mesh(g, hexX(30, 9), M.brass, VX - 31 - 6 - 1.5, PY, PZ, 0, 0, 0, 'MTA brass hex');
      // right MTA + union
      mesh(g, hexX(30, 9), M.brass, VX + 31 + 6 + 1.5, PY, PZ, 0, 0, 0, 'MTA brass hex');
      mesh(g, cylX(14.5, 26, 32), M.cpvc, VX + 31 + 12 + 13, PY, PZ, 0, 0, 0, 'MTA socket (CPVC)');
      mesh(g, cylX(14.5, 10, 32), M.cpvc, 146, PY, PZ, 0, 0, 0, 'Union tail');
      mesh(g, cylX(20, 14, 8), M.cpvc, 158, PY, PZ, 0, 0, 0, 'Union nut');
      mesh(g, cylX(14.5, 10, 32), M.cpvc, 170, PY, PZ, 0, 0, 0, 'Union tail');
    }
    {
      const g = part('valve');
      for (const s of [-1, 1]) mesh(g, hexX(32, 13), M.brass, VX + s * 24.5, PY, PZ, 0, 0, 0, 'G¾ female end');
      mesh(g, cylX(20, 36, 40), M.brass, VX, PY, PZ, 0, 0, 0, 'Ball housing');
      mesh(g, cylY(8, 10, 24), M.brass, VX, PY + 22, PZ, 0, 0, 0, 'Stem neck');
      mesh(g, box(56, 3, 48), M.steel, VX, PY + 28.5, PZ, 0, 0, 0, 'Mounting bracket');
      mesh(g, rbox(73, 62, 52, 6), M.actuator, VX, PY + 30 + 28, PZ, -Math.PI / 2, 0, 0, 'Actuator (12 V, CR05)');
      // rotating ball (visible in X-ray) and override knob with indicator
      const ball = new THREE.Group(); ball.position.set(VX, PY, PZ); g.add(ball);
      const sphere = new THREE.SphereGeometry(15, 32, 20);
      mesh(ball, sphere, M.chrome, 0, 0, 0, 0, 0, 0, 'Ball');
      mesh(ball, cylX(8.6, 31, 24), M.black, 0, 0, 0, 0, 0, 0, 'Ball bore');
      const knob = new THREE.Group(); knob.position.set(VX, PY + 87, PZ); g.add(knob);
      mesh(knob, cylY(11, 7, 32), M.knob, 0, 0, 0, 0, 0, 0, 'Manual override knob');
      mesh(knob, box(18, 1, 3.2), M.ceramic, 0, 3.6, 0, 0, 0, 0, 'Position indicator');
      mesh(g, cylX(4, 8, 16), M.black, VX - 40, PY + 44, PZ, 0, 0, 0, 'Cable gland');
      anim.ball = ball; anim.knob = knob;
    }
    {
      const g = part('cable'), bx = BOX_AT[0], by = BOX_AT[1], o = L.OUT;
      const glandEnd = [bx + L.GLAND_X, by + o[2] - 14, L.GLAND_Z], jackEnd = [bx + L.JACK_X, by + o[2] - 15, L.JACK_Z];
      tube(g, [[VX - 44, PY + 44, PZ], [VX - 56, PY + 40, PZ - 6], [VX - 80, PY + 22, 20], [VX - 96, PY - 2, 16], [VX - 112, PY - 30, 16],
        [-138, 140, 16], [-142, 60, 16], [-136, 8, 15], [-118, -6, 14], [glandEnd[0], glandEnd[1] - 8, glandEnd[2]], glandEnd], M.wire_grey, 3.0, 'Valve cable');
      tube(g, [[60, -30, L.OUT[4] + 24], [30, -26, 20], [jackEnd[0] + 4, jackEnd[1] - 14, jackEnd[2]], jackEnd], M.wire_black, 2.0, '12 V cable');
    }
    anim.PIPE = PIPE; anim.VX = VX;
    return { root: rootGroup, boxGroup, parts, materials: M, anim, layout: L };
  }

  async function loadAssets(THREE, STLLoader, toCreasedNormals, fetchBytes, base) {
    const text = async (p) => new TextDecoder().decode(await fetchBytes(base + p));
    const manifest = JSON.parse(await text('parts.json'));
    const layout = JSON.parse(await text('layout.json'));
    const loader = new STLLoader(); const printed = {};
    await Promise.all(manifest.parts.map(async (p) => {
      let geo = loader.parse(await fetchBytes(base + p.file));
      geo.applyMatrix4(new THREE.Matrix4().fromArray(p.matrix)); geo.deleteAttribute('normal');
      printed[p.id] = toCreasedNormals(geo, THREE.MathUtils.degToRad(30));
    }));
    return { printed, layout };
  }

  root.HydroTrackValve = { PARTS, BOX_AT, PIPE, VX, build, loadAssets };
})(typeof globalThis !== 'undefined' ? globalThis : window);
