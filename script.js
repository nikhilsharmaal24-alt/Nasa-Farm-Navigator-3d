// script.js — Advanced UI + gameplay + education + backend integration

// Elements
const soilMoistureEl = document.getElementById('soil-moisture');
const soilPctEl = document.getElementById('soil-pct');
const rainfallEl = document.getElementById('rainfall');
const instructionsEl = document.getElementById('instructions');
const irrigateBtn = document.getElementById('irrigate-btn');
const donotIrrigateBtn = document.getElementById('donot-irrigate-btn');
const resultMessageEl = document.getElementById('result-message');
const cropEl = document.getElementById('crop');
const scoreEl = document.getElementById('score');
const roundEl = document.getElementById('round');
const totalRoundsEl = document.getElementById('total-rounds');
const factTextEl = document.getElementById('fact-text');
const learnMoreBtn = document.getElementById('learn-more');
const leaderboardList = document.getElementById('leaderboard-list');
const saveScoreBtn = document.getElementById('save-score');
const progressFill = document.getElementById('progress-fill');
const roundDisplay = document.getElementById('round-display');
const soilBarAfter = document.querySelector('.soil-bar::after'); // not used — we update inline

// Anim containers & sounds
const rainContainer = document.getElementById('rain-container');
const sparkleContainer = document.getElementById('sparkle-container');
const irrigateSound = document.getElementById('sound-irrigate');
const rainSound = document.getElementById('sound-rain');
const cheerSound = document.getElementById('sound-cheer');
const bgMusic = document.getElementById('bg-music');
const musicToggle = document.getElementById('music-toggle');

const helpBtn = document.getElementById('help-btn');
const helpModal = document.getElementById('help-modal');
const closeHelp = document.getElementById('close-help');

let score = 0;
let round = 1;
const totalRounds = 5;
totalRoundsEl.textContent = totalRounds;
roundEl.textContent = round;

let timer = 12; // seconds per round (adjust difficulty)
let timerInterval = null;
let simulatedData = { soil_moisture: 'low', soil_moisture_pct: 40, rainfall_forecast: 'none' };
let musicPlaying = false;
let leaderboardCache = [];

// ---------- helper: fetch backend endpoints ----------
async function apiGet(path) {
  try {
    const r = await fetch(path);
    if (!r.ok) throw new Error('Network');
    return await r.json();
  } catch (err) { return null; }
}

// fetch NASA data (from backend)
async function fetchNasaData() {
  const data = await apiGet('/api/nasa-data');
  if (data) simulatedData = data;
  else {
    simulatedData = {
      soil_moisture: Math.random() > 0.5 ? 'low' : 'high',
      soil_moisture_pct: Math.round(Math.random() * 100),
      rainfall_forecast: Math.random() > 0.5 ? 'none' : 'heavy'
    };
  }
}

// fetch NASA fact
async function fetchNasaFact() {
  const data = await apiGet('/api/nasa-fact');
  if (data && data.fact) factTextEl.textContent = data.fact;
  else factTextEl.textContent = "NASA monitors soil & precipitation from space — facts load when online.";
}

// fetch leaderboard
async function fetchLeaderboard() {
  const data = await apiGet('/api/leaderboard');
  if (Array.isArray(data)) {
    leaderboardCache = data;
    renderLeaderboard();
  } else {
    // show localStorage fallback
    const local = JSON.parse(localStorage.getItem('nasa_leaderboard') || '[]');
    leaderboardCache = local;
    renderLeaderboard();
  }
}

// save score to server (best-effort)
async function saveScoreToServer(player = 'You') {
  try {
    await fetch('/api/save-score', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ player, score })
    });
  } catch (err) {
    // fallback to localStorage
    const local = JSON.parse(localStorage.getItem('nasa_leaderboard') || '[]');
    local.push({ player, score, date: new Date().toISOString() });
    localStorage.setItem('nasa_leaderboard', JSON.stringify(local));
  }
}

// render leaderboard
function renderLeaderboard() {
  leaderboardList.innerHTML = '';
  if (!leaderboardCache.length) {
    leaderboardList.innerHTML = '<li>No scores yet</li>';
    return;
  }
  const top = leaderboardCache.slice(0,10);
  top.forEach(item => {
    const li = document.createElement('li');
    li.textContent = `${item.player} — ${item.score}`;
    leaderboardList.appendChild(li);
  });
}

// ---------- UI updates ----------
function updateUIFromData() {
  soilMoistureEl.textContent = simulatedData.soil_moisture === 'low' ? 'Low' : 'High';
  soilPctEl.textContent = `${simulatedData.soil_moisture_pct ?? 50}%`;
  rainfallEl.textContent = simulatedData.rainfall_forecast === 'heavy' ? 'Heavy' : 'None';

  // update soil bar width
  const pct = simulatedData.soil_moisture_pct ?? 50;
  const soilBar = document.querySelector('.soil-bar');
  if (soilBar) soilBar.style.setProperty('--pct', `${pct}%`);
  // we'll update using inline style
  const sbAfter = soilBar;
  // update CSS pseudo fallback: we'll place a direct inner overlay for width
  let overlay = document.getElementById('soil-overlay');
  if (!overlay) {
    overlay = document.createElement('div'); overlay.id = 'soil-overlay';
    overlay.style.position='absolute';
    overlay.style.left='12px';
    overlay.style.bottom='12px';
    overlay.style.height='12px';
    overlay.style.width = `calc(${pct}% - 24px)`;
    overlay.style.background='linear-gradient(90deg,#77decb,#00c6ff)';
    overlay.style.borderRadius='8px';
    overlay.style.zIndex='5';
    document.querySelector('.farm-card').appendChild(overlay);
  } else {
    overlay.style.width = `calc(${pct}% - 24px)`;
  }

  roundDisplay.textContent = `${round}/${totalRounds}`;
  progressFill.style.width = `${((round-1)/totalRounds)*100}%`;
  scoreEl.textContent = score;
}

// ---------- Animations ----------
function startRain() {
  rainContainer.innerHTML = '';
  for (let i=0;i<30;i++){
    const drop = document.createElement('div');
    drop.className='raindrop';
    drop.style.left = `${Math.random()*100}vw`;
    drop.style.animationDuration = `${0.7 + Math.random()}s`;
    rainContainer.appendChild(drop);
  }
  try { rainSound.currentTime=0; rainSound.play(); } catch(e){}
}
function stopRain(){ rainContainer.innerHTML=''; try{ rainSound.pause(); rainSound.currentTime=0 }catch(e){} }

function showSparkles(x,y){
  for(let i=0;i<6;i++){
    const s = document.createElement('div'); s.className='sparkle'; s.textContent='✨';
    const dx = (Math.random()*80)-40; const dy=(Math.random()*80)-40;
    s.style.left = `${x+dx}px`; s.style.top = `${y+dy}px`;
    sparkleContainer.appendChild(s);
    setTimeout(()=>s.remove(),900);
  }
}
function shakeCrop(){ cropEl.classList.add('shake'); setTimeout(()=>cropEl.classList.remove('shake'),600); }

// floating icons for visual interest
function showFloatingIcons(){
  const container = document.getElementById('floating-icons');
  container.innerHTML='';
  const icons = ['☀️','🌧️','🛰️','💧','🌱'];
  for(let i=0;i<8;i++){
    const el = document.createElement('div');
    el.textContent = icons[Math.floor(Math.random()*icons.length)];
    el.style.position='absolute';
    el.style.left = `${Math.random()*70+10}%`;
    el.style.top = `${Math.random()*70+5}%`;
    el.style.opacity = (0.2+Math.random()*0.6);
    el.style.transform = `scale(${0.8 + Math.random()*0.6})`;
    el.style.transition = `transform 4s ease-in-out`;
    container.appendChild(el);
    setInterval(()=>{ el.style.transform = `translateY(${(Math.random()*10)-5}px) scale(${0.9 + Math.random()*0.4})` }, 3000 + Math.random()*2000);
  }
}

// ---------- Gameplay ----------
async function startRound() {
  // reset
  resultMessageEl.textContent = '';
  cropEl.textContent = '❓';
  // fetch data & fact
  await fetchNasaData();
  await fetchNasaFact();
  updateUIFromData();
  showFloatingIcons();

  // rain effect
  if (simulatedData.rainfall_forecast === 'heavy') startRain();
  else stopRain();

  // start timer
  timer = 12; // or set by difficulty
  const timerEl = document.getElementById('timer') || (() => {
    const el = document.createElement('span'); el.id='timer'; el.textContent=timer; instructionsEl.appendChild(el); return el;
  })();
  timerEl.textContent = timer;
  clearInterval(timerInterval);
  timerInterval = setInterval(()=>{
    timer--;
    timerEl.textContent = timer;
    if (timer <= 0) {
      clearInterval(timerInterval);
      onTimeout();
    }
  },1000);
}

function onTimeout(){
  // treat as wrong (no action)
  resultMessageEl.textContent = '⏳ Time up! You missed the chance — crops affected.';
  resultMessageEl.style.color = '#b54';
  cropEl.textContent = '💀';
  shakeCrop();
  nextRound();
}

function evaluateIrrigate() {
  irrigateSound.currentTime=0; try{irrigateSound.play()}catch(e){}
  clearInterval(timerInterval);
  if (simulatedData.soil_moisture === 'low' && simulatedData.rainfall_forecast === 'none') {
    resultMessageEl.textContent = '✅ Correct — crops flourish!';
    resultMessageEl.style.color = 'green';
    cropEl.textContent = '🌱';
    const rect = cropEl.getBoundingClientRect();
    showSparkles(rect.left + rect.width/2, rect.top + rect.height/2);
    score += 1;
    achievement('Waterwise!');
  } else {
    resultMessageEl.textContent = '❌ Wrong — overwatering harms the crop.';
    resultMessageEl.style.color = 'red';
    cropEl.textContent = '💀';
    shakeCrop();
  }
  nextRound();
}

function evaluateDoNotIrrigate() {
  clearInterval(timerInterval);
  if (simulatedData.soil_moisture === 'high' || simulatedData.rainfall_forecast === 'heavy') {
    resultMessageEl.textContent = '✅ Correct — saved water & crop safe!';
    resultMessageEl.style.color = 'green';
    cropEl.textContent = '🌱';
    const rect = cropEl.getBoundingClientRect();
    showSparkles(rect.left + rect.width/2, rect.top + rect.height/2);
    score += 1;
    achievement('Eco Saver!');
  } else {
    resultMessageEl.textContent = '❌ Wrong — crop dried out.';
    resultMessageEl.style.color = 'red';
    cropEl.textContent = '💀';
    shakeCrop();
  }
  nextRound();
}

function achievement(text) {
  const el = document.getElementById('achievement');
  el.textContent = `🏅 ${text}`;
  setTimeout(()=>el.textContent='',1500);
}

function nextRound() {
  round++;
  progressFill.style.width = `${((round-1)/totalRounds)*100}%`;
  if (round > totalRounds) {
    endGame();
  } else {
    setTimeout(()=>startRound(), 1400);
  }
}

async function endGame() {
  clearInterval(timerInterval);
  document.getElementById('instructions').textContent = `🎉 Game Over — Score ${score}/${totalRounds}`;
  irrigateBtn.disabled=true; donotIrrigateBtn.disabled=true;
  try{cheerSound.currentTime=0; cheerSound.play();}catch(e){}
  // save to UI-local and backend
  await saveScoreToServer('Binary Brains'); // replace with actual player name
  await fetchLeaderboard();
  // show restart control
  const restartBtn = document.createElement('button'); restartBtn.className='primary restart-btn'; restartBtn.textContent='🔄 Play Again';
  restartBtn.onclick = ()=>{ score=0; round=1; irrigateBtn.disabled=false; donotIrrigateBtn.disabled=false; progressFill.style.width='0%'; roundEl.textContent=1; scoreEl.textContent=0; restartBtn.remove(); startRound();};
  resultMessageEl.appendChild(document.createElement('br'));
  resultMessageEl.appendChild(restartBtn);
}

// ---------- interactions ----------
irrigateBtn.addEventListener('click', evaluateIrrigate);
donotIrrigateBtn.addEventListener('click', evaluateDoNotIrrigate);
saveScoreBtn.addEventListener('click', async ()=>{
  await saveScoreToServer(prompt('Enter your name', 'Player'));
  await fetchLeaderboard();
});

musicToggle.addEventListener('click', ()=>{
  if (musicPlaying) { bgMusic.pause(); musicPlaying=false; musicToggle.textContent='🎵'; }
  else { try{ bgMusic.play(); }catch(e){} musicPlaying=true; musicToggle.textContent='🔇'; }
});

// help modal
helpBtn.addEventListener('click', ()=>{ helpModal.setAttribute('aria-hidden','false') });
closeHelp.addEventListener('click', ()=>{ helpModal.setAttribute('aria-hidden','true') });

// Learn more button — opens NASA fact modal or external link
learnMoreBtn.addEventListener('click', ()=> {
  window.open('https://earthdata.nasa.gov/', '_blank');
});

// init
async function init() {
  await fetchLeaderboard();
  await startRound();
}
document.addEventListener('DOMContentLoaded', init);
