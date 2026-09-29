/**
 * INSANE POWER ESPORTS - FULL STACK BACKEND SERVER v2.1
 * Express REST API + JSON Database Persistence + Google OAuth + 48-Slot IDP Security Engine
 * Enhanced: Admin PIN auth, all-squads API, leaderboard sync, CORS hardening, health check
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || 'IP2026';

// Middlewares
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname)));

// ==================== DATABASE ====================
const DB_FILE = path.join(__dirname, 'data', 'db.json');

const INITIAL_DB = {
  adminEmails: [
    "akshithreddypalvai2005@gmail.com"
  ],
  users: [
    { id: "u_admin_1", username: "akshith_admin", name: "Akshith Reddy", email: "akshithreddypalvai2005@gmail.com", ign: "IP・AKSHITH", uid: "1000000001", phone: "+91 98765 00000", authProvider: "google", role: "Organizer / Head Admin", createdAt: new Date().toISOString() },
    { id: "u_1", username: "thunder_igl", name: "Sameer Sheikh", email: "thunder@gmail.com", ign: "IP・THUNDER", uid: "1948201948", phone: "+91 98765 43210", authProvider: "local", role: "Captain / IGL", createdAt: new Date().toISOString() },
    { id: "u_2", username: "viper_sniper", name: "Aditya Nair", email: "viper@gmail.com", ign: "IP・VIPER", uid: "2048192847", phone: "+91 98765 43211", authProvider: "local", role: "Sniper", createdAt: new Date().toISOString() },
    { id: "u_3", username: "blaze_rusher", name: "Rohan Varma", email: "blaze@gmail.com", ign: "IP・BLAZE", uid: "1829471928", phone: "+91 98765 43212", authProvider: "local", role: "Entry Rusher", createdAt: new Date().toISOString() },
    { id: "u_4", username: "shadow_ff", name: "Dev Singhania", email: "shadow@gmail.com", ign: "IP・SHADOW", uid: "2291847192", phone: "+91 98765 43213", authProvider: "local", role: "Support", createdAt: new Date().toISOString() },
    { id: "u_5", username: "cyborg_sub", name: "Kabir Khan", email: "cyborg@gmail.com", ign: "IP・CYBORG", uid: "2819472910", phone: "+91 98765 43214", authProvider: "local", role: "Substitute", createdAt: new Date().toISOString() }
  ],
  squads: [],
  registrations: [],
  idpSettings: {
    activeDay: 1,
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

function getAdminEmails() {
  const db = getDatabase();
  const dbEmails = Array.isArray(db.adminEmails) ? db.adminEmails : [];
  const envEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  const set = new Set([
    'akshithreddypalvai2005@gmail.com',
    ...dbEmails.map(e => e.toLowerCase().trim()),
    ...envEmails
  ]);
  return Array.from(set);
}

function isEmailAdmin(email) {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}

function getDatabase() {
  if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DB, null, 2));
    return INITIAL_DB;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const db = JSON.parse(raw);
    // Ensure all keys exist (migration-safe)
    if (!db.squads) db.squads = [];
    if (!db.registrations) db.registrations = [];
    if (!db.idpSettings) db.idpSettings = INITIAL_DB.idpSettings;
    if (!db.leaderboard) db.leaderboard = INITIAL_DB.leaderboard;
    return db;
  } catch (err) {
    console.error('⚠️  Error reading database, returning seed:', err.message);
    return JSON.parse(JSON.stringify(INITIAL_DB));
  }
}

function saveDatabase(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error('⚠️  Error writing database:', err.message);
    return false;
  }
}

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
  const db = getDatabase();
  res.json({
    status: 'OK',
    version: '2.1.0',
    uptime: Math.round(process.uptime()),
    users: db.users.length,
    squads: db.squads.length,
    registrations: db.registrations.length
  });
});

// ==================== AUTH REST APIS ====================

// 1. Regular Player Registration
app.post('/api/auth/register', (req, res) => {
  const { username, name, email, ign, uid, phone } = req.body;

  if (!username || !name || !ign || !uid || !phone) {
    return res.status(400).json({ success: false, message: 'All mandatory fields are required (username, name, IGN, UID, phone)' });
  }

  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (cleanUsername.length < 3) {
    return res.status(400).json({ success: false, message: 'Username must be at least 3 characters (letters, numbers, underscores only)' });
  }

  const cleanUid = uid.trim().replace(/\D/g, '');
  if (cleanUid.length < 6) {
    return res.status(400).json({ success: false, message: 'Free Fire UID must be at least 6 digits' });
  }

  const db = getDatabase();

  if (db.users.some(u => u.username.toLowerCase() === cleanUsername)) {
    return res.status(400).json({ success: false, message: `Username @${cleanUsername} is already registered. Please choose another.` });
  }

  if (db.users.some(u => u.uid === cleanUid)) {
    return res.status(400).json({ success: false, message: `Free Fire UID ${cleanUid} is already linked to another account.` });
  }

  const newUser = {
    id: `u_${Date.now()}`,
    username: cleanUsername,
    name: name.trim(),
    email: email ? email.trim().toLowerCase() : `${cleanUsername}@insanepower.in`,
    ign: ign.trim(),
    uid: cleanUid,
    phone: phone.trim(),
    authProvider: 'local',
    role: 'Player',
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  saveDatabase(db);

  return res.json({ success: true, user: newUser, message: `Welcome @${cleanUsername}! Registration successful.` });
});

// 2. Regular Player / Admin Login (by username or email)
app.post('/api/auth/login', (req, res) => {
  const input = (req.body.username || req.body.email || '').trim().toLowerCase();
  if (!input) {
    return res.status(400).json({ success: false, message: 'Username or Email is required' });
  }

  const db = getDatabase();
  const user = db.users.find(u => 
    u.username.toLowerCase() === input || 
    (u.email && u.email.toLowerCase() === input)
  );

  if (!user) {
    return res.status(404).json({ success: false, message: `Account "${input}" not found. Please create an account first!` });
  }

  const isAdmin = isEmailAdmin(user.email);
  return res.json({ 
    success: true, 
    user, 
    isAdmin,
    message: `Welcome back, ${user.name || user.ign}!${isAdmin ? ' [Admin Access]' : ''}` 
  });
});

// 3. Google Sign-In / OAuth Handler
app.post('/api/auth/google', (req, res) => {
  const { googleId, name, email, photoUrl, ign, uid, phone, username } = req.body;

  if (!email || !name) {
    return res.status(400).json({ success: false, message: 'Invalid Google payload — email and name required' });
  }

  const db = getDatabase();
  let user = db.users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());

  if (user) {
    // Update photo if provided
    if (photoUrl && !user.photoUrl) {
      user.photoUrl = photoUrl;
      saveDatabase(db);
    }
    return res.json({ success: true, user, isNew: false, message: `Welcome back, ${user.name}!` });
  }

  // New Google user — needs IGN & UID to complete profile
  if (!ign || !uid) {
    const suggestedUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().slice(0, 15);
    return res.json({
      success: true,
      needsProfileCompletion: true,
      suggestedUsername,
      name,
      email,
      photoUrl: photoUrl || ''
    });
  }

  const cleanUsername = (username || email.split('@')[0]).trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  
  // Ensure username uniqueness
  let finalUsername = cleanUsername;
  let counter = 1;
  while (db.users.some(u => u.username === finalUsername)) {
    finalUsername = `${cleanUsername}${counter++}`;
  }

  const newUser = {
    id: `u_g_${Date.now()}`,
    username: finalUsername,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    photoUrl: photoUrl || '',
    ign: ign.trim(),
    uid: uid.trim().replace(/\D/g, ''),
    phone: phone ? phone.trim() : '+91 00000 00000',
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
      phone: player.phone,
      role: player.role
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

// Get All Squads (Public list with limited info)
app.get('/api/squads', (req, res) => {
  const db = getDatabase();
  const publicSquads = db.squads.map(s => ({
    squadId: s.squadId,
    teamName: s.teamName,
    teamTag: s.teamTag,
    iglUsername: s.iglUsername,
    playerCount: s.players.length,
    createdAt: s.createdAt
  }));
  return res.json({ success: true, squads: publicSquads, total: publicSquads.length });
});

// Create & Lock Permanent Squad
app.post('/api/squads', (req, res) => {
  const { teamName, teamTag, iglUsername, playerUsernames } = req.body;

  if (!teamName || !teamTag || !iglUsername || !Array.isArray(playerUsernames) || playerUsernames.length < 3) {
    return res.status(400).json({ success: false, message: 'Team Name, Tag, IGL username, and at least 3 teammates are required' });
  }

  const cleanTeamName = teamName.trim();
  const cleanTeamTag = teamTag.trim().toUpperCase().slice(0, 5);
  const cleanIgl = iglUsername.trim().toLowerCase();
  const cleanPlayers = playerUsernames.map(u => u.trim().toLowerCase()).filter(Boolean);

  const db = getDatabase();

  // Check if IGL is already in a squad
  const iglInSquad = db.squads.find(s => s.iglUsername.toLowerCase() === cleanIgl || s.players.some(p => p.username.toLowerCase() === cleanIgl));
  if (iglInSquad) {
    return res.status(400).json({ success: false, message: `You (@${cleanIgl}) are already locked to squad "${iglInSquad.teamName}"` });
  }

  // Check for duplicate team names
  if (db.squads.some(s => s.teamName.toLowerCase() === cleanTeamName.toLowerCase())) {
    return res.status(400).json({ success: false, message: `Team name "${cleanTeamName}" is already taken. Please choose another.` });
  }

  const allUsernames = [cleanIgl, ...cleanPlayers];
  const uniqueUsernames = [...new Set(allUsernames)];
  if (uniqueUsernames.length !== allUsernames.length) {
    return res.status(400).json({ success: false, message: 'Duplicate players detected! All team members must be distinct players.' });
  }

  // Verify all users exist and are free
  const squadPlayers = [];
  for (const uName of allUsernames) {
    const userObj = db.users.find(u => u.username.toLowerCase() === uName);
    if (!userObj) {
      return res.status(400).json({ success: false, message: `Player @${uName} is not registered on the website. They must sign up first.` });
    }

    // Check if already in another squad
    const inSquad = db.squads.find(s => s.players.some(p => p.username.toLowerCase() === uName));
    if (inSquad) {
      return res.status(400).json({ success: false, message: `Player @${uName} is already locked to squad "${inSquad.teamName}"` });
    }

    squadPlayers.push({
      role: uName === cleanIgl ? 'Captain / IGL' : 'Player',
      username: userObj.username,
      name: userObj.name,
      ign: userObj.ign,
      uid: userObj.uid,
      phone: userObj.phone
    });
  }

  const newSquad = {
    squadId: `SQ-${Date.now().toString().slice(-6)}`,
    teamName: cleanTeamName,
    teamTag: cleanTeamTag,
    iglUsername: cleanIgl,
    captainPhone: squadPlayers[0].phone,
    createdAt: new Date().toLocaleDateString('en-IN'),
    players: squadPlayers
  };

  db.squads.push(newSquad);
  saveDatabase(db);

  return res.json({ success: true, squad: newSquad, message: `Permanent Squad "${cleanTeamName}" locked successfully!` });
});

// ==================== 48-SLOT TOURNAMENT REGISTRATION ====================

// 1-Click Register Squad for 48 Slots
app.post('/api/tournaments/register', (req, res) => {
  const { squadId, tourneyId } = req.body;
  if (!squadId) {
    return res.status(400).json({ success: false, message: 'squadId is required' });
  }

  const db = getDatabase();

  const squad = db.squads.find(s => s.squadId === squadId);
  if (!squad) {
    return res.status(404).json({ success: false, message: 'Squad not found. Please create your squad first.' });
  }

  const existing = db.registrations.find(r => r.squadId === squadId);
  if (existing) {
    return res.json({ success: true, isAlreadyRegistered: true, registration: existing, message: `Squad "${squad.teamName}" is already registered at Slot #${existing.slotNumber}` });
  }

  if (db.registrations.length >= 48) {
    return res.status(400).json({ success: false, message: 'All 48 slots are completely filled for Season 12! Registration is closed.' });
  }

  const assignedSlot = db.registrations.length + 1;
  let assignedGroup, groupIndex, matchDay;

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
    groupIndex,
    matchDay,
    registeredAt: new Date().toLocaleString('en-IN'),
    status: 'CONFIRMED'
  };

  db.registrations.push(newReg);
  saveDatabase(db);

  return res.json({ success: true, registration: newReg, message: `Slot #${assignedSlot} confirmed! Your squad is in ${assignedGroup}` });
});

// Get Tournament Status & Registered Teams
app.get('/api/tournaments/status', (req, res) => {
  const db = getDatabase();
  return res.json({
    success: true,
    totalSlots: 48,
    filledSlots: db.registrations.length,
    slotsRemaining: 48 - db.registrations.length,
    registrations: db.registrations.map(r => ({
      regId: r.regId,
      teamName: r.teamName,
      teamTag: r.teamTag,
      captainIgn: r.captainIgn,
      iglUsername: r.iglUsername,
      slotNumber: r.slotNumber,
      group: r.group,
      groupIndex: r.groupIndex,
      matchDay: r.matchDay,
      registeredAt: r.registeredAt,
      status: r.status
    }))
  });
});

// ==================== DAY-WISE IDP SECURITY API ====================

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
    userSquad = db.registrations.find(r =>
      r.iglUsername.toLowerCase() === username ||
      r.players.some(p => p.username.toLowerCase() === username)
    );
    if (userSquad && userSquad.groupIndex === idp.activeDay && idp.isReleased) {
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
    userSquad: userSquad ? {
      teamName: userSquad.teamName,
      teamTag: userSquad.teamTag,
      slotNumber: userSquad.slotNumber,
      group: userSquad.group,
      groupIndex: userSquad.groupIndex,
      matchDay: userSquad.matchDay,
      regId: userSquad.regId
    } : null,
    // Only reveal room credentials if authorized Captain/Player AND released
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

// Middleware: verify admin by authorized Email OR admin PIN
function requireAdminAuth(req, res, next) {
  const email = (
    req.headers['x-admin-email'] ||
    req.body?.adminEmail ||
    req.query?.adminEmail ||
    ''
  ).trim().toLowerCase();

  const pin = req.headers['x-admin-pin'] || req.body?.adminPin || req.query?.adminPin;

  // Check email authorization OR pin authorization
  if (isEmailAdmin(email) || (pin && pin === ADMIN_PIN)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Unauthorized: Admin portal is restricted to authorized emails (e.g. akshithreddypalvai2005@gmail.com) or valid PIN.'
  });
}

// 1. Check if email is an authorized admin
app.get('/api/admin/check', (req, res) => {
  const email = (req.query.email || '').trim().toLowerCase();
  const isAdmin = isEmailAdmin(email);
  return res.json({
    success: true,
    isAdmin,
    email
  });
});

// 2. Get list of authorized admin emails
app.get('/api/admin/emails', (req, res) => {
  return res.json({
    success: true,
    emails: getAdminEmails()
  });
});

// 3. Add a new authorized admin email
app.post('/api/admin/emails', requireAdminAuth, (req, res) => {
  const { newEmail } = req.body;
  if (!newEmail || !newEmail.includes('@')) {
    return res.status(400).json({ success: false, message: 'Valid email address required' });
  }

  const cleanEmail = newEmail.trim().toLowerCase();
  const db = getDatabase();
  if (!Array.isArray(db.adminEmails)) {
    db.adminEmails = ['akshithreddypalvai2005@gmail.com'];
  }

  if (!db.adminEmails.map(e => e.toLowerCase()).includes(cleanEmail)) {
    db.adminEmails.push(cleanEmail);
    saveDatabase(db);
  }

  return res.json({
    success: true,
    message: `Admin email "${cleanEmail}" added successfully!`,
    emails: getAdminEmails()
  });
});

// 4. Remove an authorized admin email
app.delete('/api/admin/emails/:email', requireAdminAuth, (req, res) => {
  const targetEmail = decodeURIComponent(req.params.email).trim().toLowerCase();
  if (targetEmail === 'akshithreddypalvai2005@gmail.com') {
    return res.status(400).json({ success: false, message: 'Cannot remove primary organizer email' });
  }

  const db = getDatabase();
  if (Array.isArray(db.adminEmails)) {
    db.adminEmails = db.adminEmails.filter(e => e.toLowerCase() !== targetEmail);
    saveDatabase(db);
  }

  return res.json({
    success: true,
    message: `Admin email "${targetEmail}" removed.`,
    emails: getAdminEmails()
  });
});

// Update IDP Settings (Admin)
app.post('/api/admin/idp', requireAdminAuth, (req, res) => {
  const { activeDay, roomId, roomPass, matchTime, isReleased } = req.body;
  const db = getDatabase();

  db.idpSettings = {
    activeDay: parseInt(activeDay) || db.idpSettings.activeDay,
    activeGroupName: {1:"Day 1 - Group A",2:"Day 2 - Group B",3:"Day 3 - Group C",4:"Day 4 - Group D"}[parseInt(activeDay)] || db.idpSettings.activeGroupName,
    roomId: (roomId || '').trim() || db.idpSettings.roomId,
    roomPass: (roomPass || '').trim() || db.idpSettings.roomPass,
    matchTime: (matchTime || '').trim() || db.idpSettings.matchTime,
    isReleased: isReleased === true || isReleased === 'true'
  };

  saveDatabase(db);
  return res.json({ success: true, idpSettings: db.idpSettings, message: 'IDP settings updated and live!' });
});

// Get Standings / Leaderboard
app.get('/api/leaderboard', (req, res) => {
  const db = getDatabase();
  return res.json({ success: true, leaderboard: db.leaderboard });
});

// Admin Update Leaderboard
app.post('/api/admin/leaderboard', requireAdminAuth, (req, res) => {
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

// Admin – Get all registrations with full player details
app.get('/api/admin/registrations', requireAdminAuth, (req, res) => {
  const db = getDatabase();
  return res.json({ success: true, registrations: db.registrations, total: db.registrations.length });
});

// Admin – Get all users
app.get('/api/admin/users', requireAdminAuth, (req, res) => {
  const db = getDatabase();
  return res.json({ success: true, users: db.users, total: db.users.length });
});

// Admin – Reset a squad (emergency use)
app.delete('/api/admin/squads/:squadId', requireAdminAuth, (req, res) => {
  const { squadId } = req.params;
  const db = getDatabase();

  const squadIndex = db.squads.findIndex(s => s.squadId === squadId);
  if (squadIndex === -1) {
    return res.status(404).json({ success: false, message: 'Squad not found' });
  }

  const deletedSquad = db.squads.splice(squadIndex, 1)[0];
  // Also remove their registration
  db.registrations = db.registrations.filter(r => r.squadId !== squadId);
  saveDatabase(db);

  return res.json({ success: true, message: `Squad "${deletedSquad.teamName}" and its registration removed.` });
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
        filledSlots,
        slotsRemaining: 48 - filledSlots,
        prizePool: "₹1,000 INR (1K)",
        entryFee: "FREE (100% Slot Pass)",
        status: filledSlots >= 48 ? "REGISTRATION CLOSED" : "REGISTRATION OPEN",
        schedule: "Thu-Sun @ 6:00 PM IST"
      }
    ]
  });
});

// Serve frontend SPA fallback for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    res.status(404).json({ success: false, message: 'API endpoint not found' });
  }
});

// Start Server with port fallback
function startServer(portToTry) {
  const server = app.listen(portToTry, () => {
    console.log(`\n⚡ INSANE POWER ESPORTS Server v2.1 — http://localhost:${portToTry}`);
    console.log(`📁 Database: ${DB_FILE}`);
    console.log(`🔑 Admin PIN: ${ADMIN_PIN} (set ADMIN_PIN env var to change)`);
    console.log(`\n✅ API Endpoints Ready:`);
    console.log(`   GET  /api/health`);
    console.log(`   POST /api/auth/register | /api/auth/login | /api/auth/google`);
    console.log(`   GET  /api/users/search?username=...`);
    console.log(`   GET  /api/squads | GET /api/squads/my | POST /api/squads`);
    console.log(`   GET  /api/tournaments | POST /api/tournaments/register | GET /api/tournaments/status`);
    console.log(`   GET  /api/idp?username=...`);
    console.log(`   GET  /api/leaderboard`);
    console.log(`   POST /api/admin/idp | POST /api/admin/leaderboard [PIN required]\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️  Port ${portToTry} in use. Trying port ${portToTry + 1}...`);
      startServer(portToTry + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(Number(PORT) || 3000);
