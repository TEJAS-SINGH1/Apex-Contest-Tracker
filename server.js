import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json());

// Initialize Database File if not exists
const DEFAULT_DB = {
  settings: {
    cfHandle: '',
    leetcodeHandle: '',
    codechefHandle: '',
    atcoderHandle: '',
    leetcodeRating: 1500,
    codechefRating: 1400,
    atcoderRating: 1200,
    notify: true,
    sound: true
  },
  problems: [],
  watchlist: [],
  performanceLogs: [],
  goals: [],
  customContests: []
};

function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    writeDB(DEFAULT_DB);
    return DEFAULT_DB;
  }
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error('Error reading db.json, resetting to default', e);
    return DEFAULT_DB;
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing to db.json', e);
  }
}

// ================= USER STORAGE API ROUTES =================

// 1. Get entire state
app.get('/api/user', (req, res) => {
  res.json(readDB());
});

// 2. Full Sync (Batch update)
app.post('/api/user/sync', (req, res) => {
  const db = readDB();
  const { settings, problems, watchlist, performanceLogs, goals, customContests } = req.body;
  
  if (settings) db.settings = settings;
  if (problems) db.problems = problems;
  if (watchlist) db.watchlist = watchlist;
  if (performanceLogs) db.performanceLogs = performanceLogs;
  if (goals) db.goals = goals;
  if (customContests) db.customContests = customContests;

  writeDB(db);
  res.json({ success: true, db });
});

// 3. Save settings
app.post('/api/user/settings', (req, res) => {
  const db = readDB();
  db.settings = { ...db.settings, ...req.body };
  writeDB(db);
  res.json({ success: true, settings: db.settings });
});

// 4. Save problems list
app.post('/api/user/problems', (req, res) => {
  const db = readDB();
  db.problems = req.body;
  writeDB(db);
  res.json({ success: true, count: db.problems.length });
});

// 5. Save watchlist
app.post('/api/user/watchlist', (req, res) => {
  const db = readDB();
  db.watchlist = req.body;
  writeDB(db);
  res.json({ success: true, count: db.watchlist.length });
});

// 6. Save performance logs
app.post('/api/user/logs', (req, res) => {
  const db = readDB();
  db.performanceLogs = req.body;
  writeDB(db);
  res.json({ success: true, count: db.performanceLogs.length });
});

// 7. Save custom goals
app.post('/api/user/goals', (req, res) => {
  const db = readDB();
  db.goals = req.body;
  writeDB(db);
  res.json({ success: true, count: db.goals.length });
});

// 8. Save custom contests
app.post('/api/user/custom-contests', (req, res) => {
  const db = readDB();
  db.customContests = req.body;
  writeDB(db);
  res.json({ success: true, count: db.customContests.length });
});


// ================= COMPETITIVE PROGRAMMING API PROXIES =================

// Proxy LeetCode User profile details
app.get('/api/proxy/leetcode/user/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const response = await fetch(`https://alfa-leetcode-api.onrender.com/${username}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch LeetCode user details', message: err.message });
  }
});

// Proxy LeetCode User accepted submissions (limit 20)
app.get('/api/proxy/leetcode/submissions/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const response = await fetch(`https://alfa-leetcode-api.onrender.com/${username}/acSubmission?limit=20`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch LeetCode submissions list', message: err.message });
  }
});

// Proxy LeetCode User contest rating history
app.get('/api/proxy/leetcode/history/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const response = await fetch(`https://alfa-leetcode-api.onrender.com/${username}/contest/history`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch LeetCode history logs', message: err.message });
  }
});

// Proxy LeetCode Daily Challenge POTD
app.get('/api/proxy/leetcode/potd', async (req, res) => {
  try {
    const response = await fetch('https://alfa-leetcode-api.onrender.com/daily');
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch LeetCode daily POTD details', message: err.message });
  }
});

// Proxy CodeChef User details
app.get('/api/proxy/codechef/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const response = await fetch(`https://codechef-api.vercel.app/handle/${username}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch CodeChef user details', message: err.message });
  }
});

// Proxy AtCoder contest history list (bypassing CORS)
app.get('/api/proxy/atcoder/history/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const response = await fetch(`https://atcoder.jp/users/${username}/history/json`);
    if (!response.ok) throw new Error('AtCoder history returned non-200');
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch AtCoder user history logs', message: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n=============================================`);
  console.log(`🚀 Apex Contest Tracker Backend Running!`);
  console.log(`📡 Server listening on port ${PORT}`);
  console.log(`📂 DB File: ${DB_PATH}`);
  console.log(`=============================================\n`);
});
