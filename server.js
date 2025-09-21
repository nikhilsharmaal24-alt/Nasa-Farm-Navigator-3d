// server.js
// Advanced backend with optional MongoDB leaderboard
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- In-memory / persistent store (optional MongoDB) ----------
let leaderboard = []; // fallback in-memory

// Optional MongoDB support - enable by setting MONGODB_URI env variable
const MONGODB_URI = process.env.MONGODB_URI || '';

let useDb = false;
let dbClient = null;
let dbCollection = null;

async function initDb() {
  if (!MONGODB_URI) return;
  try {
    const { MongoClient } = require('mongodb');
    dbClient = new MongoClient(MONGODB_URI);
    await dbClient.connect();
    const db = dbClient.db(process.env.MONGODB_DB || 'nasa_farm');
    dbCollection = db.collection('leaderboard');
    useDb = true;
    console.log('✅ Connected to MongoDB for leaderboard persistence');
  } catch (err) {
    console.warn('⚠️ MongoDB connection failed — using in-memory leaderboard. Error:', err.message);
  }
}
initDb();

// ---------- Simulated NASA facts & data ----------
const nasaFacts = [
  "🛰️ SMAP (Soil Moisture Active Passive) provides global soil moisture maps from space.",
  "🌧️ GPM (Global Precipitation Measurement) tracks rainfall intensity and helps forecast floods.",
  "📡 NASA satellites combined with models help predict drought and irrigation needs.",
  "🌱 NASA Earth science supports precision agriculture to maximize yield and save water.",
  "🔬 NASA partners with researchers to develop soil and water monitoring tools for farmers."
];

// Endpoint: random fact
app.get('/api/nasa-fact', (req, res) => {
  const fact = nasaFacts[Math.floor(Math.random() * nasaFacts.length)];
  res.json({ fact });
});

// Endpoint: simulated nasa data (can be replaced by real API calls)
app.get('/api/nasa-data', (req, res) => {
  // enhance data with numeric value to show percent moisture
  const soil_moisture_level = Math.random() * 100; // 0 - 100 %
  const soil = soil_moisture_level < 45 ? 'low' : 'high'; // threshold
  const rain_value = Math.random();
  const rain = rain_value < 0.5 ? 'none' : 'heavy';
  res.json({
    soil_moisture: soil,
    soil_moisture_pct: Math.round(soil_moisture_level),
    rainfall_forecast: rain
  });
});

// Endpoint: save score
app.post('/api/save-score', async (req, res) => {
  const { player = 'Anonymous', score = 0 } = req.body;
  const entry = { player, score: Number(score), date: new Date().toISOString() };

  if (useDb && dbCollection) {
    try {
      await dbCollection.insertOne(entry);
    } catch (err) {
      console.warn('DB insert failed:', err.message);
      leaderboard.push(entry);
    }
  } else {
    leaderboard.push(entry);
    // Keep top 50 in memory
    leaderboard = leaderboard.sort((a,b)=>b.score-a.score).slice(0,50);
  }
  res.json({ message: 'Score saved', entry });
});

// Endpoint: leaderboard
app.get('/api/leaderboard', async (req, res) => {
  if (useDb && dbCollection) {
    try {
      const top = await dbCollection.find().sort({ score: -1 }).limit(20).toArray();
      return res.json(top);
    } catch (err) {
      console.warn('DB read failed:', err.message);
    }
  }
  // fallback to in-memory
  res.json(leaderboard.slice(0,20));
});

// Serve SPA fallback
app.get('*', (req,res) => {
  res.sendFile(path.join(__dirname,'public','index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  if (!MONGODB_URI) {
    console.log('ℹ️ Running without MongoDB. To enable persistence set MONGODB_URI and MONGODB_DB env vars.');
  }
});
