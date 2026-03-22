// ============================================================
// archaiology.org — Maya Procedural Reconstruction Engine v1
// Three.js r128 — parametric scene generator
// Culture: Maya (Classic period) — expands to other cultures
// ============================================================

const ArchaiologyEngine = (function() {

  // ── Material palette by culture ───────────────────────────
  const PALETTES = {
    maya: {
      limestone:  0xd4c5a0,
      stucco:     0xe8dfc0,
      jungle:     0x3a5c2a,
      jungle_dark:0x2a4020,
      earth:      0x8b6914,
      shadow:     0x4a3820,
      sky_day:    0x87ceeb,
      sky_dawn:   0xff8c42,
      water:      0x4a7fa5,
    },
    mesopotamian: {
      limestone:  0xc8b87a,
      brick:      0xa0704a,
      earth:      0x8b7355,
      sky_day:    0x9dc4e0,
      water:      0x4a90a4,
    },
    roman: {
      marble:     0xf0ece0,
      tufa:       0xc8b89a,
      brick:      0xb07060,
      sky_day:    0x87ceeb,
    },
  };

  // ── Structure builders ────────────────────────────────────

  function buildPyramid(scene, THREE, opts = {}) {
    const {
      x = 0, z = 0,
      base = 5, height = 4,
      steps = 4,
      palette,
      hasSanctuary = true,
      hasRoofComb  = false,
    } = opts;

    const mat = new THREE.MeshLambertMaterial({ color: palette.limestone });
    const shadowMat = new THREE.MeshLambertMaterial({ color: palette.shadow });
    const group = new THREE.Group();

    // Stepped platform tiers
    for (let i = 0; i < steps; i++) {
      const t       = i / steps;
      const tierW   = base * (1 - t * 0.65);
      const tierH   = height / steps;
      const tierY   = i * tierH;
      const geo     = new THREE.BoxGeometry(tierW, tierH, tierW);
      const mesh    = new THREE.Mesh(geo, i % 2 === 0 ? mat : shadowMat);
      mesh.position.set(0, tierY + tierH / 2, 0);
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
    }

    // Staircase on front face
    const stairCount = steps * 3;
    for (let s = 0; s < stairCount; s++) {
      const sw  = base * 0.18;
      const sh  = (height / stairCount) * 0.8;
      const sd  = base * 0.06;
      const sy  = s * (height / stairCount) + sh / 2;
      const sz  = (base / 2) * (1 - (s / stairCount) * 0.65) + sd / 2;
      const geo = new THREE.BoxGeometry(sw, sh, sd);
      const m   = new THREE.Mesh(geo, shadowMat);
      m.position.set(0, sy, sz);
      group.add(m);
    }

    // Sanctuary on top
    if (hasSanctuary) {
      const topW  = base * 0.22;
      const topH  = height * 0.25;
      const topY  = height + topH / 2;
      const sGeo  = new THREE.BoxGeometry(topW, topH, topW * 0.8);
      const sM    = new THREE.Mesh(sGeo, mat);
      sM.position.set(0, topY, 0);
      sM.castShadow = true;
      group.add(sM);

      // Doorway void (dark box in front)
      const dGeo = new THREE.BoxGeometry(topW * 0.35, topH * 0.6, topW * 0.1);
      const dM   = new THREE.Mesh(dGeo,
        new THREE.MeshLambertMaterial({ color: 0x1a1410 }));
      dM.position.set(0, topY - topH * 0.1, topW * 0.41);
      group.add(dM);

      // Roof comb
      if (hasRoofComb) {
        const rcH   = topH * 1.4;
        const rcGeo = new THREE.BoxGeometry(topW * 0.15, rcH, topW * 0.08);
        const rcM   = new THREE.Mesh(rcGeo, shadowMat);
        rcM.position.set(0, topY + topH / 2 + rcH / 2, 0);
        rcM.castShadow = true;
        group.add(rcM);
        // Lattice cutouts (decorative)
        for (let r = 0; r < 3; r++) {
          const hGeo = new THREE.BoxGeometry(topW * 0.2, rcH * 0.08, topW * 0.12);
          const hM   = new THREE.Mesh(hGeo,
            new THREE.MeshLambertMaterial({ color: 0x1a1410 }));
          hM.position.set(0, topY + topH / 2 + rcH * (0.2 + r * 0.28), 0);
          group.add(hM);
        }
      }
    }

    group.position.set(x, 0, z);
    scene.add(group);
    return group;
  }

  function buildPlatform(scene, THREE, opts = {}) {
    const { x=0, z=0, w=8, h=0.6, d=8, palette } = opts;
    const geo  = new THREE.BoxGeometry(w, h, d);
    const mat  = new THREE.MeshLambertMaterial({ color: palette.limestone });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, h/2, z);
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  function buildStela(scene, THREE, opts = {}) {
    const { x=0, z=0, h=1.8, palette } = opts;
    const geo  = new THREE.BoxGeometry(0.18, h, 0.08);
    const mat  = new THREE.MeshLambertMaterial({ color: palette.shadow });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, h/2, z);
    mesh.castShadow = true;
    scene.add(mesh);
  }

  function buildPalace(scene, THREE, opts = {}) {
    const { x=0, z=0, w=6, h=1.2, d=3, palette } = opts;
    const group = new THREE.Group();
    // Base platform
    const baseGeo = new THREE.BoxGeometry(w, 0.5, d);
    const baseMat = new THREE.MeshLambertMaterial({ color: palette.earth });
    const base    = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.25;
    group.add(base);
    // Rooms
    const roomW = w / 3;
    for (let i = 0; i < 3; i++) {
      const rGeo = new THREE.BoxGeometry(roomW * 0.9, h, d * 0.85);
      const rMat = new THREE.MeshLambertMaterial({
        color: i % 2 === 0 ? palette.limestone : palette.stucco });
      const r    = new THREE.Mesh(rGeo, rMat);
      r.position.set(-w/2 + roomW*(i+0.5), 0.5+h/2, 0);
      r.castShadow = r.receiveShadow = true;
      group.add(r);
    }
    group.position.set(x, 0, z);
    scene.add(group);
  }

  function buildTree(scene, THREE, opts = {}) {
    const { x=0, z=0, h=2.5, palette } = opts;
    const group   = new THREE.Group();
    const trunkGeo= new THREE.CylinderGeometry(0.08, 0.12, h*0.5, 6);
    const trunkMat= new THREE.MeshLambertMaterial({ color: palette.earth });
    const trunk   = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = h*0.25;
    group.add(trunk);
    // Canopy — two sphere layers
    [0, 0.4].forEach((yo, i) => {
      const r    = 0.7 - i * 0.15;
      const cGeo = new THREE.SphereGeometry(r, 8, 6);
      const cMat = new THREE.MeshLambertMaterial({
        color: i===0 ? palette.jungle : palette.jungle_dark });
      const c    = new THREE.Mesh(cGeo, cMat);
      c.position.y = h*0.5 + r*0.5 + yo;
      c.castShadow = true;
      group.add(c);
    });
    group.position.set(x, 0, z);
    scene.add(group);
  }

  function buildGround(scene, THREE, palette, size=60) {
    const geo  = new THREE.PlaneGeometry(size, size);
    const mat  = new THREE.MeshLambertMaterial({ color: palette.jungle_dark });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    scene.add(mesh);
    // Plaza stone area
    const plazaGeo = new THREE.PlaneGeometry(18, 18);
    const plazaMat = new THREE.MeshLambertMaterial({ color: palette.earth });
    const plaza    = new THREE.Mesh(plazaGeo, plazaMat);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.01;
    scene.add(plaza);
  }

  function buildSky(scene, THREE, palette) {
    scene.background = new THREE.Color(palette.sky_day);
    scene.fog = new THREE.Fog(palette.sky_day, 40, 80);
  }

  // ── Main scene builder ────────────────────────────────────
  function buildMayaScene(THREE, scene, params = {}) {
    const p       = PALETTES.maya;
    const {
      structures  = [],
      scale       = "medium",
      period      = "Classic",
    } = params;

    buildSky(scene, THREE, p);
    buildGround(scene, THREE, p);
    buildPlatform(scene, THREE, { x:0, z:0, w:20, h:0.4, d:20, palette:p });

    // Determine layout from structures array or use defaults
    const hasPyramid  = structures.some(s => s.type === "pyramid")   || true;
    const hasRoofComb = structures.some(s => s.notable?.includes?.("roof comb")) || period === "Classic";
    const stelaeCount = structures.find(s => s.type === "stela")?.count ?? 4;
    const hasPalace   = structures.some(s => s.type === "palace")    || scale !== "small";

    // Central pyramid (Temple I style)
    if (hasPyramid) {
      buildPyramid(scene, THREE, {
        x:0, z:-4, base:5.5, height:5.5, steps:9,
        palette:p, hasSanctuary:true, hasRoofComb,
      });
    }

    // Secondary pyramid (Temple II)
    buildPyramid(scene, THREE, {
      x:0, z:5, base:4, height:4, steps:7,
      palette:p, hasSanctuary:true, hasRoofComb: false,
    });

    // Acropolis / palace complex north
    if (hasPalace) {
      buildPalace(scene, THREE, { x:-2, z:-10, w:9, h:1.4, d:4, palette:p });
    }

    // North Acropolis platform
    buildPlatform(scene, THREE, { x:0, z:-11, w:12, h:1.2, d:6, palette:p });

    // Stelae in plaza
    const stelaePositions = [
      [-3,1],[3,1],[-3,3],[3,3],[-1.5,0],[1.5,0],[0,2]
    ].slice(0, stelaeCount);
    stelaePositions.forEach(([sx,sz]) =>
      buildStela(scene, THREE, { x:sx, z:sz, h:1.6+Math.random()*0.6, palette:p }));

    // Jungle border trees
    const treeRing = 16;
    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 2;
      const r     = treeRing + Math.random() * 6;
      const jitter= (Math.random() - 0.5) * 3;
      buildTree(scene, THREE, {
        x: Math.cos(angle) * r + jitter,
        z: Math.sin(angle) * r + jitter,
        h: 2 + Math.random() * 2,
        palette: p,
      });
    }

    // Scatter small jungle trees inside
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r     = 10 + Math.random() * 5;
      buildTree(scene, THREE, {
        x: Math.cos(angle)*r, z: Math.sin(angle)*r,
        h: 1.5 + Math.random(), palette: p,
      });
    }
  }

  // ── Culture router ────────────────────────────────────────
  function buildScene(THREE, scene, sceneParams) {
    const culture = (sceneParams?.culture ?? "maya").toLowerCase();
    if (culture === "maya" || culture === "mesoamerica") {
      buildMayaScene(THREE, scene, sceneParams);
    } else {
      // Fallback: generic mound site for unknown cultures
      buildMayaScene(THREE, scene, sceneParams);
    }
  }

  return { buildScene, PALETTES };
})();
