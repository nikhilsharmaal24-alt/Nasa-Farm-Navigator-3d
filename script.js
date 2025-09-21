// game.js - NASA Farm Navigator 3D (enhanced)
// Requires: three.js and OrbitControls loaded in HTML

let scene, camera, renderer, controls;
let player, wheels = [], crops = [], birds = [];
let particles = null;
let clock = new THREE.Clock();
let keys = {};
let level = 1, score = 0, maxLevel = 10;
let playing = false;
let energy = 100;
let container = document.getElementById('container');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const levelEl = document.getElementById('level');
const scoreEl = document.getElementById('score');
const energyEl = document.getElementById('energy');
const messageEl = document.getElementById('message');

// camera shake params
let shakeStrength = 0;
let lastCollectTime = 0;

init();

function init(){
  // renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.setClearColor(0x071826, 1);
  container.appendChild(renderer.domElement);

  // scene
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x071826, 0.0007);

  // camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2500);
  camera.position.set(0, 60, 150);

  // controls (kept for dev; but camera is controlled programmatically)
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enabled = false;

  // lights
  const hemi = new THREE.HemisphereLight(0xbfe8ff, 0x0b1b2b, 0.6);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(120, 200, 80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -300;
  sun.shadow.camera.right = 300;
  sun.shadow.camera.top = 200;
  sun.shadow.camera.bottom = -200;
  scene.add(sun);

  // subtle rim light
  const rim = new THREE.DirectionalLight(0x99d9ff, 0.25);
  rim.position.set(-100, 80, -200);
  scene.add(rim);

  // ground
  const groundGeo = new THREE.PlaneGeometry(1400, 1400, 64, 64);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x234f2a, roughness: 0.95 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // painted dirt paths (visual)
  for (let i = 0; i < 8; i++){
    const path = new THREE.Mesh(new THREE.PlaneGeometry(1400, 40), new THREE.MeshStandardMaterial({ color: 0x2f3b1f, roughness: 1 }));
    path.rotation.x = -Math.PI/2;
    path.position.z = -300 + i * 80;
    path.receiveShadow = true;
    scene.add(path);
  }

  // water strip
  const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 24), new THREE.MeshStandardMaterial({
    color: 0x0fa3ff, metalness: 0.2, roughness: 0.35, transparent: true, opacity: 0.85
  }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(-200, 0.2, -120);
  scene.add(water);

  // player / rover
  createPlayer();

  // particles system (for collection)
  createParticlePool();

  // event listeners
  window.addEventListener('resize', onWindowResize);
  document.addEventListener('keydown', e => keys[e.code] = true);
  document.addEventListener('keyup', e => keys[e.code] = false);

  startBtn.addEventListener('click', onStart);
  resetBtn.addEventListener('click', onReset);

  // initial UI
  updateUI();
  render(); // render single frame
}

function createPlayer(){
  const group = new THREE.Group();

  // body
  const bodyGeo = new THREE.BoxGeometry(10, 4, 16);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe6eef2, metalness: 0.2, roughness: 0.4 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.position.y = 6;
  group.add(body);

  // cabin
  const cabGeo = new THREE.BoxGeometry(8, 3, 6);
  const cabMat = new THREE.MeshStandardMaterial({ color: 0x1e88ff, emissive: 0x003366, emissiveIntensity: 0.15 });
  const cab = new THREE.Mesh(cabGeo, cabMat);
  cab.position.set(0, 8, -1);
  cab.castShadow = true;
  group.add(cab);

  // solar panel (animated tilt)
  const panelGeo = new THREE.BoxGeometry(12, 0.4, 6);
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x0a4c6e, metalness: 0.6, roughness: 0.3 });
  const panel = new THREE.Mesh(panelGeo, panelMat);
  panel.position.set(0, 10.2, 4);
  panel.castShadow = false;
  group.add(panel);

  // wheels
  const wheelGeo = new THREE.CylinderGeometry(2.2, 2.2, 1.6, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8, metalness: 0.2 });
  const offsets = [
    [-5.3, 3, 6], [5.3, 3, 6],
    [-5.3, 3, -6], [5.3, 3, -6]
  ];
  for (let i = 0; i < 4; i++){
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.castShadow = true;
    w.position.set(offsets[i][0], offsets[i][1], offsets[i][2]);
    group.add(w);
    wheels.push(w);
  }

  // tiny antenna
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  ant.position.set(0, 13, -8);
  group.add(ant);

  group.position.set(0, 0, 60);
  player = group;
  player.userData = { speed: 0, forward: 0, turning: 0, panel };
  scene.add(player);
}

function createParticlePool(){
  // Points used for quick burst on collect
  const max = 200;
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(max * 3);
  const colors = new Float32Array(max * 3);
  const sizes = new Float32Array(max);
  for (let i = 0; i < max * 3; i++){ positions[i] = 0; colors[i] = 1; }
  for (let i = 0; i < max; i++) sizes[i] = 0;

  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
  geom.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.PointsMaterial({ size: 2.5, vertexColors: true, transparent: true });
  particles = new THREE.Points(geom, mat);
  particles.userData = { max, pool: [] };
  scene.add(particles);
}

function spawnCrops(n = 8){
  const spread = 420;
  for (let i = 0; i < n; i++){
    const geo = new THREE.ConeGeometry(2.6, 6.2, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0x66ff88, roughness: 0.7 });
    const crop = new THREE.Mesh(geo, mat);
    crop.castShadow = true;
    crop.position.set((Math.random() - 0.5) * spread, 3.1, (Math.random() - 0.5) * spread);
    crop.userData = { swayPhase: Math.random() * Math.PI * 2 };
    scene.add(crop);
    crops.push(crop);
  }
}

function spawnBirds(n = 3){
  for (let i = 0; i < n; i++){
    const body = new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 8), new THREE.MeshStandardMaterial({ color: 0xff6b6b, emissive: 0x220000 }));
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.3, 1.6), new THREE.MeshStandardMaterial({ color: 0xff9b9b }));
    const wingR = wingL.clone();

    body.add(wingL);
    body.add(wingR);
    wingL.position.set(-2.4, 0, 0);
    wingR.position.set(2.4, 0, 0);

    const x = (Math.random() - 0.5) * 400;
    const z = (Math.random() - 0.5) * 400;
    const y = 25 + Math.random() * 40;
    const bird = new THREE.Group();
    bird.add(body);
    bird.position.set(x, y, z);
    bird.userData = { baseY: y, speed: 6 + Math.random() * 6, dir: Math.random() < 0.5 ? 1 : -1, flapPhase: Math.random() * Math.PI * 2 };
    birds.push(bird);
    scene.add(bird);
  }
}

function resetLevel(){
  // remove previous
  crops.forEach(c => scene.remove(c));
  birds.forEach(b => scene.remove(b));
  crops = []; birds = [];

  // spawn
  spawnCrops(6 + level * 3);
  spawnBirds(2 + Math.min(level, 7));
  showMessage(`Level ${level} — Clear the crops!`);
}

function onStart(){
  if (!playing){
    playing = true;
    score = 0;
    level = 1;
    energy = 100;
    lastCollectTime = performance.now();
    updateUI();
    resetLevel();
    animate();
  }
}

function onReset(){
  // remove objects
  crops.forEach(c => scene.remove(c));
  birds.forEach(b => scene.remove(b));
  crops = []; birds = [];
  score = 0; level = 1; energy = 100; playing = false;
  updateUI();
  showMessage('Game reset. Click Start to play!');
}

function updateUI(){
  levelEl.innerText = level;
  scoreEl.innerText = score;
  energyEl.innerText = Math.max(0, Math.round(energy));
}

function showMessage(txt, ttl = 2500){
  messageEl.innerText = txt || '';
  if (ttl > 0) {
    setTimeout(() => { if (messageEl.innerText === txt) messageEl.innerText = ''; }, ttl);
  }
}

// core loop
function animate(){
  if (!playing) return;
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  update(dt);
  render();
}

function update(dt){
  // player control: smooth acceleration
  const maxSpeed = 60 + level * 4;
  const accel = 80;
  let moveForward = 0;
  if (keys['ArrowUp'] || keys['KeyW']) moveForward = 1;
  if (keys['ArrowDown'] || keys['KeyS']) moveForward = -0.6;
  // turning
  let turn = 0;
  if (keys['ArrowLeft'] || keys['KeyA']) turn = 1;
  if (keys['ArrowRight'] || keys['KeyD']) turn = -1;

  // update speed & turning state
  player.userData.speed += (moveForward * maxSpeed - player.userData.speed) * Math.min(1, accel * dt / maxSpeed);
  player.userData.turning = turn;

  // apply movement
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
  player.position.addScaledVector(forward, player.userData.speed * dt);

  // turning rotates the player
  player.rotation.y += turn * 1.5 * dt * (0.6 + Math.abs(player.userData.speed) / maxSpeed);

  // wheel rotation visual based on speed
  const wheelRot = (player.userData.speed * dt) / 0.8;
  wheels.forEach(w => w.rotation.x -= wheelRot);

  // panel gentle animation
  player.userData.panel.rotation.x = Math.sin(performance.now() * 0.002) * 0.06;

  // crops sway animation
  const t = performance.now() * 0.001;
  crops.forEach(c => {
    c.rotation.z = Math.sin(t * 2 + c.userData.swayPhase) * 0.12;
    c.position.y = 2.9 + Math.sin(t * 1.4 + c.userData.swayPhase) * 0.12;
  });

  // birds movement & flap
  birds.forEach(b => {
    b.userData.flapPhase += dt * 12;
    const body = b.children[0];
    const wingL = body.children[0], wingR = body.children[1];
    const flap = Math.sin(b.userData.flapPhase) * 0.8 + 1.2;
    wingL.scale.y = 0.5 + Math.abs(Math.sin(b.userData.flapPhase)) * 1.4;
    wingR.scale.y = wingL.scale.y;
    // simple horizontal patrol
    b.position.x += b.userData.speed * 0.02 * b.userData.dir;
    b.position.y = b.userData.baseY + Math.sin(performance.now() * 0.002 + b.userData.flapPhase) * 3;
    // wrap around
    if (b.position.x > 700) b.position.x = -700;
    if (b.position.x < -700) b.position.x = 700;
  });

  // collisions: player <-> crops
  for (let i = crops.length - 1; i >= 0; i--){
    const c = crops[i];
    const dist = player.position.distanceTo(c.position);
    if (dist < 8){
      // collect
      collectCrop(c);
      crops.splice(i, 1);
    }
  }

  // collisions: player <-> birds
  for (let i = 0; i < birds.length; i++){
    const b = birds[i];
    const dist = player.position.distanceTo(b.position);
    if (dist < 10){
      // hit
      onBirdHit();
    }
  }

  // level progress
  if (crops.length === 0){
    level++;
    if (level > maxLevel){
      showMessage(`🎉 You completed all levels! Score: ${score}`, 6000);
      playing = false;
    } else {
      showMessage(`Level up! ${level}`, 2000);
      resetLevel();
    }
  }

  // energy drain slowly when moving
  if (Math.abs(player.userData.speed) > 2){
    energy -= 6 * dt;
    energy = Math.max(0, energy);
    if (energy === 0){
      showMessage('Energy depleted! Press Reset to restart.', 3000);
      playing = false;
    }
  }

  // particle TTL decay (simple)
  updateParticles(dt);

  // camera smoothing and optional shake
  const camTarget = new THREE.Vector3(player.position.x, player.position.y + 34, player.position.z + 92);
  camera.position.lerp(camTarget, 0.12);
  camera.lookAt(new THREE.Vector3(player.position.x, player.position.y + 6, player.position.z));

  // shake
  if (shakeStrength > 0.01){
    const s = shakeStrength;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
    shakeStrength *= 0.92;
  }

  // update UI
  updateUI();
}

function collectCrop(crop){
  // show burst
  burstParticles(crop.position, 80, 0x9effa6);
  // reward
  score += 12 + Math.floor(level * 1.5);
  // small energy boost
  energy = Math.min(120, energy + 6);
  lastCollectTime = performance.now();
}

function onBirdHit(){
  // shake camera, small penalty
  shakeStrength = Math.max(shakeStrength, 3.6 + level * 0.6);
  score = Math.max(0, score - 8);
  energy = Math.max(0, energy - 12);
  showMessage('Hit by bird! -8 score', 1200);
}

function burstParticles(pos, count = 50, hex = 0xffffff){
  // write into particle buffer for quick bursts
  if (!particles) return;
  const geom = particles.geometry;
  const positions = geom.attributes.position.array;
  const colors = geom.attributes.customColor.array;
  const sizes = geom.attributes.size.array;
  const max = particles.userData.max;
  const now = performance.now() * 0.001;
  let spawned = 0;
  for (let i = 0; i < max && spawned < count; i++){
    const si = i * 3;
    if (sizes[i] <= 0.001){ // free slot
      // random velocity
      positions[si] = pos.x + (Math.random() - 0.5) * 4;
      positions[si + 1] = pos.y + (Math.random() - 0.5) * 4;
      positions[si + 2] = pos.z + (Math.random() - 0.5) * 4;
      // color
      const c = new THREE.Color(hex);
      colors[si] = c.r;
      colors[si + 1] = c.g;
      colors[si + 2] = c.b;
      sizes[i] = 3 + Math.random() * 3;
      // store velocity in userData pool
      particles.userData.pool[i] = {
        vel: new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() * 6) + 2, (Math.random() - 0.5) * 8),
        ttl: 0.9 + Math.random() * 0.7
      };
      spawned++;
    }
  }
  geom.attributes.position.needsUpdate = true;
  geom.attributes.customColor.needsUpdate = true;
  geom.attributes.size.needsUpdate = true;
}

function updateParticles(dt){
  if (!particles) return;
  const geom = particles.geometry;
  const positions = geom.attributes.position.array;
  const colors = geom.attributes.customColor.array;
  const sizes = geom.attributes.size.array;
  const pool = particles.userData.pool;
  const max = particles.userData.max;

  for (let i = 0; i < max; i++){
    if (sizes[i] > 0.001 && pool[i]){
      const si = i * 3;
      // lifetime decay
      pool[i].ttl -= dt;
      // apply velocity
      positions[si] += pool[i].vel.x * dt;
      positions[si + 1] += pool[i].vel.y * dt;
      positions[si + 2] += pool[i].vel.z * dt;
      // gravity
      pool[i].vel.y -= 18 * dt;
      // shrink
      sizes[i] *= 0.95;
      if (pool[i].ttl <= 0 || sizes[i] < 0.2){
        sizes[i] = 0;
        pool[i] = null;
        // fade color to black (optional)
        colors[si] = colors[si + 1] = colors[si + 2] = 0;
      }
    }
  }
  geom.attributes.position.needsUpdate = true;
  geom.attributes.size.needsUpdate = true;
  geom.attributes.customColor.needsUpdate = true;
}

function onWindowResize(){
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function render(){
  renderer.render(scene, camera);
}

// Start an initial render loop when game playing
function animateStarter(){
  // always animate scene while idle for ambience
  requestAnimationFrame(animateStarter);
  const dt = Math.min(0.05, clock.getDelta());
  // small ambient motion for panels
  if (player && player.userData && player.userData.panel) {
    player.userData.panel.rotation.x = Math.sin(performance.now() * 0.0012) * 0.04;
  }
  // birds idle flap if not started
  birds.forEach(b => {
    if (!b.userData) return;
    b.userData.flapPhase += dt * 8;
    const body = b.children[0];
    const wingL = body.children[0], wingR = body.children[1];
    wingL.scale.y = 0.6 + Math.abs(Math.sin(b.userData.flapPhase)) * 0.7;
    wingR.scale.y = wingL.scale.y;
    b.position.y = b.userData.baseY + Math.sin(performance.now() * 0.001 + b.userData.flapPhase) * 2;
  });
  // gentle render
  renderer.render(scene, camera);
}

// kick off background ambient birds/camera when not playing
animateStarter();

// helper: small demo content when idle
(function idlePopulate(){
  // only add crops & birds visually for idle view
  spawnCrops(12);
  spawnBirds(5);
})();

