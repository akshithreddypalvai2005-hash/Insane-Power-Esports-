/**
 * INSANE POWER ESPORTS - FULL STACK BACKEND SERVER
 * Express REST API + JSON Database Persistence + Google OAuth + 48-Slot IDP Security Engine
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname)));

// Database File Path
const DB_FILE = path.join(__dirname, 'data', 'db.json');

// Ensure data folder & database file exist with initial schema
function getDatabase() {
  if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const initialDb = {
      users: [
        {
          id: "u_1",
          username: "thunder_igl",
          name: "Sameer Sheikh",
          email: "thunder@gmail.com",
          ign: "IP・THUNDER",
          uid: "1948201948",
          phone: "+91 98765 43210",
          authProvider: "local",
          role: "Captain / IGL",
          createdAt: new Date().toISOString()
        },
        {
          id: "u_2",
          username: "viper_sniper",
          name: "Aditya Nair",
          email: "viper@gmail.com",
          ign: "IP・VIPER",
          uid: "2048192847",
          phone: "+91 98765 43211",
          authProvider: "local",
          role: "Sniper",
          createdAt: new Date().toISOString()
        },
        {
          id: "u_3",
          username: "blaze_rusher",
          name: "Rohan Varma",
          email: "blaze@gmail.com",
          ign: "IP・BLAZE",
          uid: "1829471928",
          phone: "+91 98765 43212",
          authProvider: "local",
          role: "Entry Rusher",
          createdAt: new Date().toISOString()
        },
        {
          id: "u_4",
          username: "shadow_ff",
          name: "Dev Singhania",
          email: "shadow@gmail.com",
          ign: "IP・SHADOW",
          uid: "2291847192",
          phone: "+91 98765 43213",
          authProvider: "local",
          role: "Support",
          createdAt: new Date().toISOString()
        },
        {
          id: "u_5",
          username: "cyborg_sub",
          name: "Kabir Khan",
          email: "cyborg@gmail.com",
          ign: "IP・CYBORG",
          uid: "2819472910",
          phone: "+91 98765 43214",
          authProvider: "local",
          role: "Substitute",
          createdAt: new Date().toISOString()
        }
      ],
      squads: [],
      registrations: [],
      idpSettings: {
        activeDay: 1, // 1 = Day 1 (Group A), 2 = Day 2 (Group B), 3 = Day 3 (Group C), 4 = Day 4 (Group D)
        activeGroupName: "Day 1 - Group A (Slots 1 - 12)",
        isReleased: true,
        roomId: "8492019",
        roomPass: "IP777",
        matchTime: "6:00 PM IST"
      },
      leaderboard: {
        season: "FREE FIRE WEEKLY WARS - SEASON 12 FINALS",
        isPublished: false,
        mvp: null,
        standings: []
      }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2));
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading database file:', err);
    return { users: [], squads: [], registrations: [], idpSettings: {}, leaderboard: {} };
  }
}

function saveDatabase(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error('Error writing to database file:', err);
    return false;
  }
}

// ==================== AUTH REST APIS ====================

// 1. Regular Player Registration
app.post('/api/auth/register', (req, res) => {
  const { username, name, email, ign, uid, phone } = req.body;

  if (!username || !name || !ign || !uid || !phone) {
    return res.status(400).json({ success: false, message: 'All mandatory fields are required' });
  }

  const cleanUsername = username.trim().toLowerCase();
  const db = getDatabase();

  if (db.users.some(u => u.username.toLowerCase() === cleanUsername)) {
    return res.status(400).json({ success: false, message: `Username @${cleanUsername} is already registered` });
  }

  if (db.users.some(u => u.uid === uid.trim())) {
    return res.status(400).json({ success: false, message: `Free Fire UID ${uid} is already bound to another account` });
  }

  const newUser = {
    id: `u_${Date.now()}`,
    username: cleanUsername,
    name: name.trim(),
    email: email ? email.trim() : `${cleanUsername}@insanepower.in`,
    ign: ign.trim(),
    uid: uid.trim(),
    phone: phone.trim(),
    authProvider: 'local',
    role: 'Player',
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  saveDatabase(db);

  return res.json({ success: true, user: newUser, message: 'Registration successful!' });
});

// 2. Regular Player Login
app.post('/api/auth/login', (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required' });
  }

  const cleanUsername = username.trim().toLowerCase();
  const db = getDatabase();
  const user = db.users.find(u => u.username.toLowerCase() === cleanUsername);

  if (!user) {
    return res.status(404).json({ success: false, message: `User @${cleanUsername} not found. Please create an account!` });
  }

  return res.json({ success: true, user, message: 'Logged in successfully!' });
});

// 3. Google Sign-In / OAuth Handler
app.post('/api/auth/google', (req, res) => {
  const { googleId, name, email, photoUrl, ign, uid, phone } = req.body;

  if (!email || !name) {
    return res.status(400).json({ success: false, message: 'Invalid Google payload' });
  }

  const db = getDatabase();
  let user = db.users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());

  if (user) {
    // Existing Google User Login
    return res.json({ success: true, user, isNew: false, message: `Welcome back, ${user.name}!` });
  }

  // Need IGN & UID to complete profile if registering via Google
  if (!ign || !uid) {
    // Generate suggested username from email
    const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().slice(0, 15);
    return res.json({
      success: true,
      needsProfileCompletion: true,
      suggestedUsername: baseUsername,
      name,
      email,
      photoUrl
    });
  }

  // Complete Google Signup
  const cleanUsername = (req.body.username || email.split('@')[0]).trim().toLowerCase();

  const newUser = {
    id: `u_g_${Date.now()}`,
    username: cleanUsername,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    photoUrl: photoUrl || '',
    ign: ign.trim(),
    uid: uid.trim(),
    phone: phone ? phone.trim() : '+91 98765 00000',
    authProvider: 'google',
    role: 'Player',
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  saveDatabase(db);

  return res.json({ success: true, user: newUser, isNew: true, message: 'Google account linked and profile created!' });
});

// 4. Live Player Username Search (For IGL Squad Builder)
app.get('/api/users/search', (req, res) => {
  const username = (req.query.username || '').trim().toLowerCase();
  if (!username) {
    return res.status(400).json({ success: false, message: 'Username query parameter required' });
  }

  const db = getDatabase();
  const player = db.users.find(u => u.username.toLowerCase() === username);

  if (!player) {
    return res.json({ success: false, found: false, message: `User @${username} is not registered on the website` });
  }

  // Check if player is already locked in another squad
  const existingSquad = db.squads.find(s => s.players.some(p => p.username.toLowerCase() === username));
  if (existingSquad) {
    return res.json({
      success: true,
      found: true,
      isLocked: true,
      squadName: existingSquad.teamName,
      message: `@${username} is already locked in squad "${existingSquad.teamName}"`
    });
  }

  return res.json({
    success: true,
    found: true,
    isLocked: false,
    player: {
      username: player.username,
      name: player.name,
      ign: player.ign,
      uid: player.uid,
      phone: player.phone
    }
  });
});

// ==================== PERMANENT SQUADS APIS ====================

// Get Squad of Current User
app.get('/api/squads/my', (req, res) => {
  const username = (req.query.username || '').trim().toLowerCase();
  if (!username) {
    return res.status(400).json({ success: false, message: 'Username required' });
  }

  const db = getDatabase();
  const squad = db.squads.find(s => s.iglUsername.toLowerCase() === username || s.players.some(p => p.username.toLowerCase() === username));

  return res.json({ success: true, squad: squad || null });
});

// Create & Lock Permanent Squad
app.post('/api/squads', (req, res) => {
  const { teamName, teamTag, iglUsername, playerUsernames } = req.body;

  if (!teamName || !teamTag || !iglUsername || !Array.isArray(playerUsernames) || playerUsernames.length < 3) {
    return res.status(400).json({ success: false, message: 'Team Name, Tag, IGL, and at least 3 teammates required' });
  }

  const db = getDatabase();
  const allUsernames = [iglUsername.toLowerCase(), ...playerUsernames.map(u => u.toLowerCase())];

  // Verify all users exist
  const squadPlayers = [];
  for (const uName of allUsernames) {
    const userObj = db.users.find(u => u.username.toLowerCase() === uName);
    if (!userObj) {
      return res.status(400).json({ success: false, message: `Player @${uName} is not registered` });
    }

    // Check if already in another squad
    const inSquad = db.squads.find(s => s.players.some(p => p.username.toLowerCase() === uName));
    if (inSquad) {
      return res.status(400).json({ success: false, message: `Player @${uName} is already locked to squad "${inSquad.teamName}"` });
    }

    squadPlayers.push({
      role: uName === iglUsername.toLowerCase() ? 'Captain / IGL' : 'Player',
      username: userObj.username,
      name: userObj.name,
      ign: userObj.ign,
      uid: userObj.uid,
      phone: userObj.phone
    });
  }

  const newSquad = {
    squadId: `SQ-${Date.now().toString().slice(-6)}`,
    teamName: teamName.trim(),
    teamTag: teamTag.trim().toUpperCase(),
    iglUsername: iglUsername.trim().toLowerCase(),
    captainPhone: squadPlayers[0].phone,
    createdAt: new Date().toLocaleDateString(),
    players: squadPlayers
  };

  db.squads.push(newSquad);
  saveDatabase(db);

  return res.json({ success: true, squad: newSquad, message: `Permanent Squad "${teamName}" locked successfully!` });
});

// ==================== 48-SLOT TOURNAMENT REGISTRATION ====================

// 1-Click Register Squad for 48 Slots
app.post('/api/tournaments/register', (req, res) => {
  const { squadId, tourneyId } = req.body;
  const db = getDatabase();

  const squad = db.squads.find(s => s.squadId === squadId);
  if (!squad) {
    return res.status(404).json({ success: false, message: 'Squad not found' });
  }

  const existing = db.registrations.find(r => r.squadId === squadId);
  if (existing) {
    return res.json({ success: true, isAlreadyRegistered: true, registration: existing, message: 'Squad is already registered' });
  }

  if (db.registrations.length >= 48) {
    return res.status(400).json({ success: false, message: 'All 48 slots are completely filled for Season 12!' });
  }

  const assignedSlot = db.registrations.length + 1;
  let assignedGroup = "";
  let groupIndex = 1;
  let matchDay = "";

  if (assignedSlot <= 12) {
    assignedGroup = "Day 1 - Group A (Slots 1-12)";
    groupIndex = 1;
    matchDay = "Thursday @ 6:00 PM IST";
  } else if (assignedSlot <= 24) {
    assignedGroup = "Day 2 - Group B (Slots 13-24)";
    groupIndex = 2;
    matchDay = "Friday @ 6:00 PM IST";
  } else if (assignedSlot <= 36) {
    assignedGroup = "Day 3 - Group C (Slots 25-36)";
    groupIndex = 3;
    matchDay = "Saturday @ 6:00 PM IST";
  } else {
    assignedGroup = "Day 4 - Group D (Slots 37-48)";
    groupIndex = 4;
    matchDay = "Sunday @ 6:00 PM IST";
  }

  const newReg = {
    regId: `FF-${Date.now().toString().slice(-6)}`,
    squadId: squad.squadId,
    tourneyId: tourneyId || 'ww-ff-12',
    tourneyName: 'FREE FIRE MAX WEEKLY WARS - SEASON 12',
    teamName: squad.teamName,
    teamTag: squad.teamTag,
    iglUsername: squad.iglUsername,
    captainIgn: squad.players[0].ign,
    captainUid: squad.players[0].uid,
    captainPhone: squad.captainPhone,
    players: squad.players,
    slotNumber: assignedSlot,
    group: assignedGroup,
    groupIndex: groupIndex,
    matchDay: matchDay,
    registeredAt: new Date().toLocaleString(),
    status: 'CONFIRMED'
  };

  db.registrations.push(newReg);
  saveDatabase(db);

  return res.json({ success: true, registration: newReg, message: `Slot #${assignedSlot} booked! Assigned to ${assignedGroup}` });
});

// Get Tournament Status & Registered Teams
app.get('/api/tournaments/status', (req, res) => {
  const db = getDatabase();
  return res.json({
    success: true,
    totalSlots: 48,
    filledSlots: db.registrations.length,
    registrations: db.registrations
  });
});

// ==================== DAY-WISE IDP SECURITY API ====================

// Get IDP Data with Permission Verification
app.get('/api/idp', (req, res) => {
  const username = (req.query.username || '').trim().toLowerCase();
  const db = getDatabase();
  const idp = db.idpSettings;

  const dayNames = {
    1: "Day 1 - Group A (Slots 1-12)",
    2: "Day 2 - Group B (Slots 13-24)",
    3: "Day 3 - Group C (Slots 25-36)",
    4: "Day 4 - Group D (Slots 37-48)"
  };

  const activeDaySquads = db.registrations.filter(r => r.groupIndex === idp.activeDay);

  let isAuthorized = false;
  let userSquad = null;

  if (username) {
    userSquad = db.registrations.find(r => r.iglUsername.toLowerCase() === username || r.players.some(p => p.username.toLowerCase() === username));
    if (userSquad && userSquad.groupIndex === idp.activeDay) {
      isAuthorized = true;
    }
  }

  return res.json({
    success: true,
    activeDay: idp.activeDay,
    activeGroupName: dayNames[idp.activeDay] || `Day ${idp.activeDay}`,
    matchTime: idp.matchTime,
    isReleased: idp.isReleased,
    isAuthorized,
    userSquad: userSquad || null,
    // Only reveal room credentials if authorized Captain
    credentials: isAuthorized ? {
      roomId: idp.roomId,
      roomPass: idp.roomPass
    } : null,
    todaySquads: activeDaySquads.map(s => ({
      slotNumber: s.slotNumber,
      teamName: s.teamName,
      teamTag: s.teamTag,
      captainIgn: s.captainIgn,
      iglUsername: s.iglUsername
    }))
  });
});

// ==================== ADMIN PORTAL APIS ====================

// Update IDP Settings
app.post('/api/admin/idp', (req, res) => {
  const { activeDay, roomId, roomPass, matchTime, isReleased } = req.body;
  const db = getDatabase();

  db.idpSettings = {
    activeDay: parseInt(activeDay) || 1,
    roomId: roomId || db.idpSettings.roomId,
    roomPass: roomPass || db.idpSettings.roomPass,
    matchTime: matchTime || db.idpSettings.matchTime,
    isReleased: isReleased === true || isReleased === 'true'
  };

  saveDatabase(db);
  return res.json({ success: true, idpSettings: db.idpSettings, message: 'IDP settings updated and broadcasted!' });
});

// Get Standings / Leaderboard
app.get('/api/leaderboard', (req, res) => {
  const db = getDatabase();
  return res.json({ success: true, leaderboard: db.leaderboard });
});

// Admin Update Leaderboard
app.post('/api/admin/leaderboard', (req, res) => {
  const { season, mvp, standings, isPublished } = req.body;
  const db = getDatabase();

  db.leaderboard = {
    season: season || 'FREE FIRE WEEKLY WARS - SEASON 12 FINALS',
    isPublished: isPublished !== false,
    mvp: mvp || null,
    standings: Array.isArray(standings) ? standings : []
  };

  saveDatabase(db);
  return res.json({ success: true, leaderboard: db.leaderboard, message: 'Points table published live!' });
});

// Get Active Tournaments
app.get('/api/tournaments', (req, res) => {
  const db = getDatabase();
  const filledSlots = db.registrations.length;
  return res.json({
    success: true,
    tournaments: [
      {
        id: "ww-ff-12",
        title: "Free Fire MAX Weekly Wars (Season 12)",
        game: "Free Fire MAX",
        mode: "Battle Royale (Squad 4v4)",
        format: "48 Slots / 4 Match Days (12 Teams / Day)",
        totalSlots: 48,
        filledSlots: filledSlots,
        prizePool: "₹1,000 INR (1K)",
        entryFee: "FREE (100% Slot Pass)",
        status: filledSlots >= 48 ? "REGISTRATION CLOSED" : "REGISTRATION OPEN"
      }
    ]
  });
});

// Serve frontend SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server with dynamic fallback if port is in use
function startServer(portToTry) {
  const server = app.listen(portToTry, () => {
    console.log(`⚡ INSANE POWER ESPORTS Server running at http://localhost:${portToTry}`);
    console.log(`📁 Database active at ${DB_FILE}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️ Port ${portToTry} in use. Attempting port ${portToTry + 1}...`);
      startServer(portToTry + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(Number(PORT) || 3000);

