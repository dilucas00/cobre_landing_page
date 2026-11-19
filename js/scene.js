/* Cobre — a vitrola 3D (three.js), feita por código, e a câmera guiada pelo scroll.
   Script comum + import() dinâmico: funciona até abrindo o arquivo direto do disco (file://),
   onde <script type="module" src> é bloqueado. O importmap no HTML resolve 'three'. */
(async () => {
'use strict';
const { gsap, ScrollTrigger } = window;
const { story, sections, reduce, isMob, TAU } = window.Cobre;
const THREE = await import('three');
const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
const { RoundedBoxGeometry } = await import('three/addons/geometries/RoundedBoxGeometry.js');

/* ===================== renderer ===================== */
const canvas = document.getElementById('stage');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (err) {
  document.documentElement.classList.add('no-webgl');
}
if (renderer) await buildScene();

async function buildScene() {
  let CW = canvas.clientWidth || innerWidth, CH = canvas.clientHeight || innerHeight;   // o canvas tem altura fixa (100lvh)
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMob() ? 1.5 : 1.75));
  renderer.setSize(CW, CH, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(isMob() ? 38 : 30, CW / CH, 0.1, 100);

  /* ---------- luz: chave quente, contraluz de cobre ---------- */
  scene.add(new THREE.HemisphereLight(0xffeedd, 0x0a0908, 0.25));
  const key = new THREE.DirectionalLight(0xffe2c4, 2.4);
  key.position.set(3.5, 7, 3);
  key.castShadow = true;
  key.shadow.mapSize.setScalar(isMob() ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
  key.shadow.bias = -0.0004;
  key.shadow.radius = 4;
  scene.add(key);
  const rim = new THREE.SpotLight(0xe6a06a, 60, 20, 0.6, 0.6, 1.6);
  rim.position.set(-4.5, 3.2, -4.5);
  scene.add(rim);
  const under = new THREE.PointLight(0xc9773f, 6, 6, 2);   /* brilho de válvula sob a base */
  under.position.set(0, -0.05, 2.2);
  scene.add(under);

  /* ---------- materiais ---------- */
  const M = {
    plinth: new THREE.MeshPhysicalMaterial({ color: 0x0d0c0b, roughness: 0.55, clearcoat: 0.4, clearcoatRoughness: 0.32, envMapIntensity: 0.3 }),
    copper: new THREE.MeshPhysicalMaterial({ color: 0xc9773f, metalness: 1, roughness: 0.26, clearcoat: 0.35 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: 0x1f1c1a, metalness: 0.85, roughness: 0.4, envMapIntensity: 0.6 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xd8d4cf, metalness: 1, roughness: 0.14 }),
    mat: new THREE.MeshStandardMaterial({ color: 0x1a1816, roughness: 0.95 }),
    led: new THREE.MeshStandardMaterial({ color: 0x6fb5a5, emissive: 0x6fb5a5, emissiveIntensity: 2.5 }),
  };
  const mesh = (geo, mat, x = 0, y = 0, z = 0, shadow = true) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    m.castShadow = shadow; m.receiveShadow = true; return m;
  };

  /* ---------- vitrola ---------- */
  const deck = new THREE.Group(); scene.add(deck);
  deck.add(mesh(new RoundedBoxGeometry(5, 0.4, 3.8, 6, 0.08), M.plinth, 0, 0.2, 0));
  deck.add(mesh(new THREE.BoxGeometry(4.86, 0.03, 0.02), M.copper, 0, 0.3, 1.905, false));        // filete de cobre
  [[-2.1, -1.55], [2.1, -1.55], [-2.1, 1.55], [2.1, 1.55]].forEach(([x, z]) => {
    deck.add(mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.1, 40), M.darkMetal, x, -0.05, z));
    deck.add(mesh(new THREE.TorusGeometry(0.27, 0.012, 8, 48), M.copper, x, -0.005, z).rotateX(Math.PI / 2));
  });
  // controles: botão de cobre, seletor 33/45, LED de pátina ("tocando")
  deck.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 48), M.copper, -2.05, 0.44, 1.45));
  deck.add(mesh(new THREE.BoxGeometry(0.22, 0.03, 0.12), M.chrome, -1.62, 0.415, 1.5));
  deck.add(mesh(new THREE.BoxGeometry(0.22, 0.03, 0.12), M.darkMetal, -1.34, 0.415, 1.5));
  deck.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 24), M.led, -1.05, 0.403, 1.5, false));  // LED embutido

  // prato
  const C = new THREE.Vector3(-0.45, 0, 0);                    // centro do disco no plano
  deck.add(mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 64), M.darkMetal, C.x, 0.43, C.z));
  deck.add(mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.09, 160), [M.copper, M.mat, M.darkMetal], C.x, 0.47, C.z));

  // disco + selo (giram juntos)
  const disc = new THREE.Group(); disc.position.set(C.x, 0.515, C.z); deck.add(disc);
  const { bump, rough } = grooveMaps();
  const vinyl = new THREE.MeshPhysicalMaterial({
    color: 0x060505, roughness: 1, roughnessMap: rough, bumpMap: bump, bumpScale: 0.6,
    clearcoat: 1, clearcoatRoughness: 0.18, metalness: 0.1, envMapIntensity: 0.45
  });
  const vinylEdge = new THREE.MeshStandardMaterial({ color: 0x0a0909, roughness: 0.4 });
  disc.add(mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.018, 200), [vinylEdge, vinyl, vinylEdge], 0, 0.009, 0));
  await document.fonts.ready;
  const label = mesh(new THREE.CircleGeometry(0.53, 96), new THREE.MeshPhysicalMaterial({
    map: labelTexture(), roughness: 0.5, metalness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.3
  }), 0, 0.0195, 0, false);
  label.rotation.x = -Math.PI / 2;
  disc.add(label);
  disc.add(mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.1, 24), M.chrome, 0, 0.05, 0));

  // braço
  const P = new THREE.Vector3(1.75, 0, -1.15), L = 2.45;
  deck.add(mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.1, 64), M.darkMetal, P.x, 0.45, P.z));
  deck.add(mesh(new THREE.TorusGeometry(0.29, 0.012, 8, 64), M.copper, P.x, 0.5, P.z).rotateX(Math.PI / 2));
  deck.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 32), M.chrome, P.x, 0.58, P.z));
  deck.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 16), M.darkMetal, P.x, 0.5, 0.95));  // descanso
  deck.add(mesh(new THREE.BoxGeometry(0.14, 0.04, 0.05), M.darkMetal, P.x, 0.62, 0.95));
  const yaw = new THREE.Group(); yaw.position.set(P.x, 0.66, P.z); deck.add(yaw);
  const lift = new THREE.Group(); yaw.add(lift);
  // tubo contínuo do contrapeso até a junção com o headshell (sem folga)
  const ARM_END = 2.12;
  const tube = mesh(new THREE.CylinderGeometry(0.028, 0.028, ARM_END + 0.4, 24), M.copper, 0, 0, (ARM_END - 0.4) / 2);
  tube.rotation.x = Math.PI / 2; lift.add(tube);
  const cw = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 40), M.chrome, 0, 0, -0.55); cw.rotation.x = Math.PI / 2; lift.add(cw);
  lift.add(mesh(new THREE.SphereGeometry(0.07, 24, 24), M.darkMetal, 0, 0, 0));
  // headshell articulado NA PONTA do tubo: o ângulo de offset gira em torno da junção, então ele nunca se solta
  const head = new THREE.Group(); head.position.set(0, 0, ARM_END); head.rotation.y = -0.38; lift.add(head);
  const collar = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.09, 24), M.chrome, 0, 0, 0.01); collar.rotation.x = Math.PI / 2; head.add(collar);
  head.add(mesh(new THREE.BoxGeometry(0.06, 0.03, 0.08), M.darkMetal, 0, -0.022, 0.06));          // pescoço
  head.add(mesh(new THREE.BoxGeometry(0.17, 0.025, 0.3), M.darkMetal, 0, -0.035, 0.22));          // headshell
  head.add(mesh(new THREE.BoxGeometry(0.11, 0.065, 0.14), M.copper, 0, -0.08, 0.25));             // cápsula
  const needle = mesh(new THREE.ConeGeometry(0.008, 0.03, 10), M.chrome, 0, -0.112, 0.29, false);
  needle.rotation.x = Math.PI; head.add(needle);                                                    // agulha
  head.add(mesh(new THREE.BoxGeometry(0.02, 0.012, 0.12), M.chrome, 0.1, -0.03, 0.4));            // dedal
  const stylusTip = new THREE.Object3D(); stylusTip.position.set(0, -0.14, 0.29); head.add(stylusTip);

  // chão que só recebe sombra
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.5 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.1; ground.receiveShadow = true; scene.add(ground);

  /* ---------- geometria do braço: ângulo para cada raio do disco ---------- */
  // varre o arco do braço e acha onde a PONTA REAL da agulha cruza o raio r (inclui o offset do headshell)
  const tip = new THREE.Vector3();
  function yawFor(r) {
    let found = -1.6;
    for (let a = 0; a > -1.6; a -= 0.001) {
      yaw.rotation.y = a; yaw.updateMatrixWorld(true);
      stylusTip.getWorldPosition(tip);
      if (Math.hypot(tip.x - C.x, tip.z - C.z) <= r) { found = a; break; }
    }
    yaw.rotation.y = 0; yaw.updateMatrixWorld(true);
    return found;
  }

  /* ---------- câmera: um enquadramento por faixa ----------
     p = posição, t = alvo, r = raio da agulha (null = braço no descanso), up = braço erguido */
  const KF = [
    { p: [2.1, 2.9, 5.6],     t: [-1.85, 0.25, 0.45], r: null, up: 1, o: 0 },   // 01 início: vitrola à direita, texto à esquerda
    { p: [1.1, 8.4, 0.9],     t: [-1.6, 0.4, 0.05],   r: 1.44, up: 1, o: 0 },   // 02 sobre: vista de cima
    { p: [2.05, 0.95, 2.55],  t: [0.55, 0.5, 0.45],   r: 1.44, up: 0 },   // 03 recursos: agulha desce (close)
    { p: [-3.3, 1.5, 2.6],    t: [-0.05, 0.45, 0.1],  r: 1.32, up: 0 },   // 04 biblioteca
    { p: [-0.9, 1.05, 3.1],   t: [-0.1, 0.55, -0.1],  r: 1.2,  up: 0 },   // 05 capas: rasante frontal
    { p: [3.2, 2.7, 2.3],     t: [-0.9, 0.4, -0.1],   r: 1.08, up: 0 },   // 06 letras
    { p: [0.55, 0.78, 1.55],  t: [-0.75, 0.5, -0.25], r: 0.96, up: 0 },   // 07 áudio: macro nos sulcos
    { p: [-3.9, 3.3, -1.9],   t: [-0.1, 0.4, 0.2],    r: 0.85, up: 0 },   // 08 visual: contraluz
    { p: [0.3, 4.6, 3.9],     t: [-0.9, 0.3, 0],      r: 0.74, up: 0 },   // 09 extras
    { p: [3.8, 2.2, 3.6],     t: [-0.5, 0.4, -0.1],   r: 0.64, up: 0 },   // 10 como funciona
    { p: [0, 4.4, 8.2],       t: [0, 0.2, -0.2],      r: null, up: 1 },   // 11 downloads: a vitrola inteira
  ].map((k, i) => ({
    px: k.p[0], py: k.p[1], pz: k.p[2], tx: k.t[0], ty: k.t[1], tz: k.t[2],
    yaw: k.r ? yawFor(k.r) : 0.04, up: k.up,
    // desloca o quadro para o lado oposto ao texto: a vitrola nunca fica atrás das letras
    off: k.o ?? ({ l: -0.14, r: 0.14, c: 0 })[sections[i].dataset.side]
  }));

  const st = { ...KF[0], spin: 0 };
  const intro = { k: reduce ? 0 : 1 };
  const par = { x: 0, y: 0 };
  const TURNS = 9;
  let tl;

  function buildTimeline() {
    if (tl) { tl.scrollTrigger && tl.scrollTrigger.kill(); tl.kill(); }
    if (reduce) return;
    const vh = innerHeight, total = Math.max(1, story.offsetHeight - vh);
    const times = sections.map(s => gsap.utils.clamp(0, total, s.offsetTop + s.offsetHeight / 2 - vh / 2));
    times[0] = 0; times[times.length - 1] = total;
    Object.assign(st, KF[0], { spin: 0 });
    tl = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      scrollTrigger: { trigger: story, start: 'top top', end: 'bottom bottom', scrub: 1.2, invalidateOnRefresh: false }
    });
    tl.to(st, { spin: TURNS * TAU, ease: 'none', duration: total }, 0);
    for (let k = 1; k < KF.length; k++) {
      const a = times[k - 1], b = times[k], hold = Math.min(vh * 0.16, (b - a) * 0.22);
      tl.to(st, { ...KF[k], duration: Math.max(1, b - a - hold * 2) }, a + hold);
    }
  }
  buildTimeline();

  let rT, lastW = innerWidth;
  addEventListener('resize', () => {
    CW = canvas.clientWidth || innerWidth; CH = canvas.clientHeight || innerHeight;
    camera.aspect = CW / CH; camera.fov = isMob() ? 38 : 30; camera.updateProjectionMatrix();
    renderer.setSize(CW, CH, false);
    if (innerWidth === lastW) return;            // só a barra do navegador mexeu: nada para reconstruir
    lastW = innerWidth;
    clearTimeout(rT); rT = setTimeout(() => { buildTimeline(); ScrollTrigger.refresh(); }, 250);
  });

  if (!reduce) {
    gsap.to(intro, { k: 0, duration: 2.6, ease: 'power3.out' });
    const qx = gsap.quickTo(par, 'x', { duration: 1.4, ease: 'power3' });
    const qy = gsap.quickTo(par, 'y', { duration: 1.4, ease: 'power3' });
    addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; qx(e.clientX / innerWidth - 0.5); qy(e.clientY / innerHeight - 0.5); });
  }

  const devCh = new URLSearchParams(location.search).get('ch');    // teste: ?dev&ch=N vai direto ao capítulo N
  if (devCh) {
    document.documentElement.style.scrollBehavior = 'auto';
    const s = sections[+devCh];
    scrollTo(0, s.offsetTop + s.offsetHeight / 2 - innerHeight / 2);
  }

  /* ---------- quadro a quadro ---------- */
  const tgt = new THREE.Vector3(), pos = new THREE.Vector3();
  let idle = 0, last = performance.now(), first = true;
  gsap.ticker.add(() => {
    const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05); last = now;
    const playing = 1 - st.up;
    if (!reduce) idle += dt * 0.5 * playing;                 // gira sozinho enquanto a agulha está no disco
    disc.rotation.y = -(st.spin + idle);
    yaw.rotation.y = st.yaw;
    lift.rotation.x = -0.075 * st.up;
    M.led.emissiveIntensity = 0.25 + 0.75 * playing;
    under.intensity = 3 + 5 * playing;

    tgt.set(st.tx, st.ty, st.tz);
    const mob = isMob();
    let pull = 1;                                  // retrato: afasta a câmera até o campo horizontal lembrar o do desktop
    if (mob) {
      const half = Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect);
      pull = Math.min(2.2, Math.max(1, Math.pow(Math.tan(0.4) / Math.tan(half), 0.85)));
    }
    pos.set(st.px, st.py, st.pz).sub(tgt).multiplyScalar((1 + intro.k * 0.8) * pull).add(tgt);
    pos.x += par.x * 0.35; pos.y -= par.y * 0.2;
    camera.position.copy(pos);
    camera.lookAt(tgt);
    // desktop: desloca para o lado oposto ao texto. celular: sobe a vitrola para a metade de cima
    camera.setViewOffset(CW, CH, mob ? 0 : st.off * CW, mob ? CH * 0.2 : 0, CW, CH);
    renderer.render(scene, camera);
    if (first) { first = false; canvas.classList.add('ready'); }
  });

  /* ---------- texturas geradas ---------- */
  function grooveMaps() {
    const S = isMob() ? 1024 : 2048, R = S / 2, inner = 0.36 * R, outer = 0.985 * R, tracks = 11;
    const gaps = Array.from({ length: tracks - 1 }, (_, i) => outer - 18 - (outer - inner - 30) * ((i + 1) / tracks));
    const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return [c, c.getContext('2d')]; };
    const [bc, b] = mk(), [rc, r] = mk();
    b.fillStyle = '#808080'; b.fillRect(0, 0, S, S);
    r.fillStyle = '#4a4a4a'; r.fillRect(0, 0, S, S);
    for (let rad = inner; rad < outer; rad += 1.5) {
      const gap = gaps.some(g => Math.abs(rad - g) < 7), lead = rad > outer - 18;
      b.strokeStyle = gap || lead ? '#808080' : (Math.round(rad / 1.5) % 2 ? '#a0a0a0' : '#5a5a5a');
      b.lineWidth = 1; b.beginPath(); b.arc(R, R, rad, 0, TAU); b.stroke();
      if (gap || lead) { r.strokeStyle = '#1a1a1a'; r.lineWidth = 1.6; r.beginPath(); r.arc(R, R, rad, 0, TAU); r.stroke(); }
    }
    const tex = c => { const t = new THREE.CanvasTexture(c); t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };
    return { bump: tex(bc), rough: tex(rc) };
  }

  function labelTexture() {
    const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'); g.translate(S / 2, S / 2);
    const grd = g.createRadialGradient(-140, -170, 30, 0, 0, 512);
    grd.addColorStop(0, '#e6a06a'); grd.addColorStop(0.45, '#c9773f'); grd.addColorStop(1, '#7a3714');
    g.fillStyle = grd; g.beginPath(); g.arc(0, 0, 512, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(18,17,16,.35)'; g.lineWidth = 3;
    [470, 340].forEach(rr => { g.beginPath(); g.arc(0, 0, rr, 0, TAU); g.stroke(); });
    // símbolo do Cobre (geometria idêntica ao SVG oficial, em escala)
    const s = 1.9, ink = '#121110';
    g.strokeStyle = ink; g.lineCap = 'round';
    g.lineWidth = 18 * s; g.beginPath(); g.arc(0, 0, 82 * s, -38 * Math.PI / 180, 38 * Math.PI / 180, true); g.stroke();
    g.lineWidth = 8 * s;
    [[-46, 22], [-23, 41], [0, 58], [23, 32], [46, 18]].forEach(([x, h]) => {
      g.beginPath(); g.moveTo(x * s, -(h - 4) * s); g.lineTo(x * s, (h - 4) * s); g.stroke();
    });
    // texto circular
    const txt = 'COBRE · SUA MÚSICA, DO SEU JEITO · LADO A · 33⅓ RPM · ';
    g.fillStyle = 'rgba(18,17,16,.82)'; g.font = '500 30px "JetBrains Mono", monospace'; g.textAlign = 'center';
    const step = TAU / txt.length;
    [...txt].forEach((ch, i) => { g.save(); g.rotate(i * step); g.fillText(ch, 0, -405); g.restore(); });
    g.fillStyle = '#121110'; g.beginPath(); g.arc(0, 0, 16, 0, TAU); g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }
}
})();
