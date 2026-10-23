/* ===== Interactive 3D effort scene: each week is a tower beside a road; storeys = research / teaching / admin / other hours ===== */
window.City3D = (() => {
  let R = null, scene, camera, world, road, ground, kerbs = [], dashes = [], car, host = null, labelLayer = null, raf = 0, ro = null;
  let towers = [], weeks = [], hoverTip = null, built = false;
  const cam = { theta: 0.42, phi: 1.1, dist: 31, target: null, auto: true };
  const drag = { on: false, x: 0, y: 0, moved: 0 };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
  const col = n => new THREE.Color(tok(n));
  function supported() { try { return !!window.THREE && !!document.createElement('canvas').getContext('webgl'); } catch (e) { return false; } }
  const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: .7, metalness: .08 });

  function init() {
    R = new THREE.WebGLRenderer({ antialias: true });
    R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, 1.6, .1, 400);
    scene.add(new THREE.HemisphereLight(0xdbe9ff, 0x050a14, .85));
    const sun = new THREE.DirectionalLight(0xcfe3ff, .75); sun.position.set(-8, 14, 6); scene.add(sun);
    road = new THREE.Mesh(new THREE.PlaneGeometry(7, 120), mat(0x222222)); road.rotation.x = -Math.PI / 2; scene.add(road);
    ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), mat(0x111111)); ground.rotation.x = -Math.PI / 2; ground.position.y = -.01; scene.add(ground);
    [-3.5, 3.5].forEach(x => { const k = new THREE.Mesh(new THREE.BoxGeometry(.18, .14, 120), mat(0x333333)); k.position.set(x, .07, 0); scene.add(k); kerbs.push(k); });
    for (let i = 0; i < 30; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(.12, .02, 1.4), new THREE.MeshBasicMaterial({ color: 0x666666 })); d.position.set(0, .02, 0); scene.add(d); dashes.push(d); }
    // a small ego vehicle that drives the timeline
    car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, .55, 3), mat(0x3d8bff)); body.position.y = .45; car.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.25, .45, 1.5), mat(0x0e1a30)); cabin.position.set(0, .93, -.15); car.add(cabin);
    [-.5, .5].forEach(x => { const l = new THREE.Mesh(new THREE.BoxGeometry(.3, .12, .05), new THREE.MeshBasicMaterial({ color: 0xbfe0ff })); l.position.set(x, .5, -1.53); car.add(l); });
    car.userData.bb = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.9, 1.5, 3.4)), new THREE.LineBasicMaterial({ color: 0x4ea8ff }));
    car.userData.bb.position.y = .75; car.add(car.userData.bb);
    scene.add(car);
    world = new THREE.Group(); scene.add(world);
    const el = R.domElement; el.setAttribute('aria-label', 'Interactive 3D view of weekly hours. Drag to orbit, scroll or use the buttons to zoom.'); el.setAttribute('role', 'img');
    el.addEventListener('pointerdown', e => { drag.on = true; drag.x = e.clientX; drag.y = e.clientY; drag.moved = 0; cam.auto = false; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => {
      if (drag.on) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
        cam.theta -= dx * .008; cam.phi = Math.min(1.45, Math.max(.35, cam.phi - dy * .006)); hideTip(); return; }
      pick(e);
    });
    el.addEventListener('pointerup', e => { drag.on = false; try { el.releasePointerCapture(e.pointerId); } catch (x) {} });
    el.addEventListener('pointerleave', hideTip);
    el.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
    ro = new ResizeObserver(resize);
  }
  function zoom(f) { cam.dist = Math.min(70, Math.max(10, cam.dist * f)); cam.auto = false; }
  function reset() { Object.assign(cam, { theta: 0.42, phi: 1.1, dist: 31, auto: !reduce }); }
  function recolor() {
    if (!R) return;
    scene.background = col('--scene-bg'); scene.fog = new THREE.FogExp2(col('--scene-bg'), .016);
    road.material.color = col('--scene-road'); ground.material.color = col('--scene-ground');
    kerbs.forEach(k => k.material.color = col('--scene-edge')); dashes.forEach(d => d.material.color = col('--scene-mark'));
    car.children[0].material.color = col('--accent'); car.userData.bb.material.color = col('--accent');
    if (built) build(weeks);
  }
  function clearWorld() { while (world.children.length) { const c = world.children.pop(); c.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); } towers = []; if (labelLayer) labelLayer.innerHTML = ''; }
  const KINDS = ['research', 'teaching', 'admin', 'other'];
  function build(ws) {
    weeks = ws; clearWorld(); built = true;
    const n = ws.length, gap = 4.2, max = Math.max(1, ...ws.map(w => w.total));
    const scale = 6.5 / Math.max(max, 4); // tallest tower ≈ 9 units, small weeks stay readable
    const zOf = i => (n - 1 - i) * -gap + 6; // latest week nearest the camera
    const edgeMat = new THREE.LineBasicMaterial({ color: col('--scene-edge'), transparent: true, opacity: .8 });
    ws.forEach((w, i) => {
      const g = new THREE.Group(); const z = zOf(i); const side = 5.6;
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.6, .12, 2.6), mat(col('--scene-build'))); plinth.position.y = .06; g.add(plinth);
      let y = .12;
      KINDS.forEach(k => { const h = w[k] * scale; if (h <= 0) return;
        const m = new THREE.Mesh(new THREE.BoxGeometry(2, h, 2), new THREE.MeshStandardMaterial({ color: col('--s-' + k), roughness: .45, metalness: .15, emissive: col('--s-' + k), emissiveIntensity: .12 }));
        m.position.y = y + h / 2; y += h; m.userData.tip = { w, k }; g.add(m);
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .18 })); e.position.copy(m.position); g.add(e); });
      if (w.total <= 0) { const ghost = new THREE.Mesh(new THREE.BoxGeometry(2, .06, 2), new THREE.MeshBasicMaterial({ color: col('--scene-edge') })); ghost.position.y = .15; ghost.userData.tip = { w, k: null }; g.add(ghost); }
      g.position.set(side, 0, z); world.add(g);
      // a city block on the far side for depth
      const bh = .5 + ((i * 7919) % 4) * .45;
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, bh, 2.6), new THREE.MeshStandardMaterial({ color: col('--scene-build'), roughness: .9, transparent: true, opacity: .55 })); b.position.set(-6.5, bh / 2, z); world.add(b);
      const be = new THREE.LineSegments(new THREE.EdgesGeometry(b.geometry), edgeMat); be.position.copy(b.position); world.add(be);
      const top = new THREE.Vector3(side, Math.max(y, .3) + .45, z);
      let lbl = null;
      if (labelLayer && (w.total > 0 || i === n - 1)) { lbl = document.createElement('span'); lbl.className = 'lbl3d' + (i === n - 1 ? ' on' : ''); lbl.textContent = (i === n - 1 ? 'This week · ' : C.fmtShort(w.start) + ' · ') + fmtH(w.total) + ' h'; labelLayer.appendChild(lbl); }
      towers.push({ g, top, lbl, z, w });
      if (i === n - 1 && w.total > 0) { const box = new THREE.Box3().setFromObject(g); const sz = box.getSize(new THREE.Vector3()).addScalar(.4); const bb = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(sz.x, sz.y, sz.z)), new THREE.LineBasicMaterial({ color: col('--accent') })); bb.position.copy(box.getCenter(new THREE.Vector3())); world.add(bb); }
    });
    const len = n * gap + 20; road.scale.y = len / 120; road.position.z = (zOf(0) + zOf(n - 1)) / 2; kerbs.forEach(k => { k.scale.z = len / 120; k.position.z = road.position.z; });
    dashes.forEach((d, i) => { d.position.z = 8 - i * 3.6; d.visible = d.position.z > zOf(0) - 6; });
    cam.target = new THREE.Vector3(3.5, 2.8, zOf(n - 1) - 11);
    car.userData.z0 = zOf(0) - 4; car.userData.z1 = zOf(n - 1) + 2;
  }
  function resize() { if (!host || !R) return; const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; R.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  const ray = () => new THREE.Raycaster();
  function pick(e) {
    const r = R.domElement.getBoundingClientRect(); const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const rc = ray(); rc.setFromCamera(v, camera);
    const hit = rc.intersectObjects(world.children, true).find(h => h.object.userData.tip);
    const tip = document.getElementById('tip'); if (!tip) return;
    if (!hit) { hideTip(); return; }
    const { w, k } = hit.object.userData.tip;
    tip.textContent = 'Week of ' + C.fmtDate(w.start) + '\nTotal ' + fmtH(w.total) + ' h' + (k ? '\n' + KIND_LABEL[k] + ': ' + fmtH(w[k]) + ' h' : '\nNo sessions logged') + KINDS.filter(x => x !== k && w[x]).map(x => '\n' + KIND_LABEL[x] + ': ' + fmtH(w[x]) + ' h').join('');
    tip.hidden = false; tip.style.left = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8) + 'px'; tip.style.top = Math.min(e.clientY + 14, innerHeight - tip.offsetHeight - 8) + 'px'; hoverTip = true;
  }
  function hideTip() { if (hoverTip) { const t = document.getElementById('tip'); if (t) t.hidden = true; hoverTip = false; } }
  let t0 = performance.now();
  function frame(now) {
    raf = 0; if (!host || !host.isConnected) return;
    const dt = Math.min(.05, (now - t0) / 1000); t0 = now;
    if (cam.auto && !reduce) cam.theta = 0.42 + Math.sin(now / 9000) * .3;
    const tg = cam.target || new THREE.Vector3();
    camera.position.set(tg.x + cam.dist * Math.sin(cam.phi) * Math.sin(cam.theta), tg.y + cam.dist * Math.cos(cam.phi), tg.z + cam.dist * Math.sin(cam.phi) * Math.cos(cam.theta));
    camera.lookAt(tg);
    if (!reduce && car.userData.z0 !== undefined) { const L = car.userData.z1 - car.userData.z0; const p = ((now / 1000) * 3.2) % Math.abs(L); car.position.set(-1.6, 0, car.userData.z0 + Math.sign(L) * p); car.rotation.y = L < 0 ? 0 : Math.PI; }
    else if (car.userData.z1 !== undefined) car.position.set(-1.6, 0, car.userData.z1);
    R.render(scene, camera);
    // project labels
    const W = host.clientWidth, H = host.clientHeight; const v = new THREE.Vector3();
    for (const t of towers) { if (!t.lbl) continue; v.copy(t.top).project(camera); const vis = v.z < 1 && v.x > -1.1 && v.x < 1.1 && v.y > -1.1 && v.y < 1.1;
      t.lbl.style.display = vis ? '' : 'none'; if (vis) { t.lbl.style.left = ((v.x + 1) / 2 * W) + 'px'; t.lbl.style.top = ((1 - v.y) / 2 * H) + 'px'; t.lbl.style.opacity = String(Math.max(.25, Math.min(1, 1.6 - (camera.position.distanceTo(t.top) / 55)))); } }
    if (!document.hidden) raf = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && host && host.isConnected && !raf) raf = requestAnimationFrame(frame); });
  function mount(el, ws) {
    if (!supported()) return false;
    try { if (!R) { init(); reset(); } } catch (e) { console.warn('3D unavailable', e); R = null; return false; }
    if (host && host !== el) ro.unobserve(host);
    host = el; labelLayer = el.querySelector('.lbl-layer');
    el.prepend(R.domElement); ro.observe(el);
    recolor(); build(ws); resize();
    if (!raf) { t0 = performance.now(); raf = requestAnimationFrame(frame); }
    return true;
  }
  function fallback(el, ws) { const box = el.querySelector('.stage-2d-host'); if (box) { box.hidden = false; box.innerHTML = weeklyChart(ws); } el.classList.add('flat'); }
  function pause() { if (raf) cancelAnimationFrame(raf); raf = 0; hideTip(); }
  return { mount, fallback, pause, recolor, zoom, reset, supported };
})();
