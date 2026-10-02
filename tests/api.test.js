const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const ROOT_DIR = path.resolve(__dirname, '..');
const SERVER_SOURCE = path.join(ROOT_DIR, 'server.js');
const NODE_MODULES_SOURCE = path.join(ROOT_DIR, 'node_modules');
const TEST_ADMIN_PIN = 'synthetic-smoke-pin';

const SYNTHETIC_DB = {
  adminEmails: ['synthetic-admin@example.test'],
  users: [],
  squads: [],
  registrations: [],
  idpSettings: {
    activeDay: 1,
    activeGroupName: 'Synthetic Day 1',
    isReleased: false,
    roomId: 'SYNTHETIC-ROOM',
    roomPass: 'SYNTHETIC-PASS',
    matchTime: 'Synthetic Time'
  },
  leaderboard: {
    season: 'SYNTHETIC SEASON',
    isPublished: false,
    mvp: null,
    standings: []
  }
};

const USERS = [
  {
    username: 'captain_one',
    name: 'Captain One',
    email: 'captain.one@example.test',
    ign: 'CAPTAIN_ONE',
    uid: '900000001',
    phone: '+91 90000 00001'
  },
  {
    username: 'player_one',
    name: 'Player One',
    email: 'player.one@example.test',
    ign: 'PLAYER_ONE',
    uid: '900000002',
    phone: '+91 90000 00002'
  },
  {
    username: 'player_two',
    name: 'Player Two',
    email: 'player.two@example.test',
    ign: 'PLAYER_TWO',
    uid: '900000003',
    phone: '+91 90000 00003'
  },
  {
    username: 'player_three',
    name: 'Player Three',
    email: 'player.three@example.test',
    ign: 'PLAYER_THREE',
    uid: '900000004',
    phone: '+91 90000 00004'
  },
  {
    username: 'captain_two',
    name: 'Captain Two',
    email: 'captain.two@example.test',
    ign: 'CAPTAIN_TWO',
    uid: '900000005',
    phone: '+91 90000 00005'
  },
  {
    username: 'player_four',
    name: 'Player Four',
    email: 'player.four@example.test',
    ign: 'PLAYER_FOUR',
    uid: '900000006',
    phone: '+91 90000 00006'
  },
  {
    username: 'player_five',
    name: 'Player Five',
    email: 'player.five@example.test',
    ign: 'PLAYER_FIVE',
    uid: '900000007',
    phone: '+91 90000 00007'
  }
];

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const probe = http.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = address && typeof address === 'object' ? address.port : null;
      probe.close(error => {
        if (error) reject(error);
        else if (!port) reject(new Error('Could not obtain an available port'));
        else resolve(port);
      });
    });
  });
}

function request(port, requestPath, options = {}) {
  const method = options.method || 'GET';
  const payload = options.body === undefined ? null : JSON.stringify(options.body);
  const headers = { ...(options.headers || {}) };

  if (payload !== null) {
    headers['content-type'] = 'application/json';
    headers['content-length'] = Buffer.byteLength(payload);
  }

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: requestPath,
      method,
      headers,
      timeout: options.timeout || 3000
    }, response => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        raw += chunk;
      });
      response.on('end', () => {
        let body = raw;
        if (raw) {
          try {
            body = JSON.parse(raw);
          } catch {
            // Keep non-JSON responses available for a status assertion.
          }
        }
        resolve({ status: response.statusCode, headers: response.headers, body, raw });
      });
    });

    req.setTimeout(options.timeout || 3000, () => {
      req.destroy(new Error('HTTP request timed out'));
    });
    req.on('error', reject);
    if (payload !== null) req.write(payload);
    req.end();
  });
}

async function waitForServer(port) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const response = await request(port, '/api/health', { timeout: 500 });
      if (response.status === 200) return;
    } catch {
      // The child can take a moment to load Express and listen.
    }
    await delay(50);
  }
  throw new Error('Isolated server did not become ready');
}

function createFixture() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'express-api-smoke-'));
  const dataDir = path.join(tempDir, 'data');
  fs.mkdirSync(dataDir);

  // Only server.js is copied. The database is synthetic and is never sourced from
  // the project. The temporary working directory intentionally has no .env file.
  fs.copyFileSync(SERVER_SOURCE, path.join(tempDir, 'server.js'));
  fs.symlinkSync(NODE_MODULES_SOURCE, path.join(tempDir, 'node_modules'), 'dir');
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify(SYNTHETIC_DB, null, 2));

  let child = null;
  let port = null;

  async function stop() {
    const processToStop = child;
    child = null;
    if (!processToStop || processToStop.exitCode !== null) return;

    await new Promise(resolve => {
      let settled = false;
      const finish = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      processToStop.once('exit', finish);
      processToStop.kill('SIGTERM');
      setTimeout(() => {
        if (!settled) processToStop.kill('SIGKILL');
      }, 1500).unref();
    });
  }

  async function start() {
    port = await availablePort();
    child = spawn(process.execPath, [path.join(tempDir, 'server.js')], {
      cwd: tempDir,
      // Do not inherit arbitrary environment values or expose child logs. In
      // particular, this prevents a real ADMIN_PIN or .env from entering the run.
      env: {
        PATH: process.env.PATH || '',
        NODE_ENV: 'test',
        PORT: String(port),
        ADMIN_PIN: TEST_ADMIN_PIN,
        ADMIN_EMAILS: 'synthetic-admin@example.test'
      },
      stdio: 'ignore'
    });

    try {
      await waitForServer(port);
    } catch (error) {
      await stop();
      throw error;
    }
  }

  return {
    get port() {
      return port;
    },
    async start() {
      await start();
    },
    async restart() {
      await stop();
      await start();
    },
    async cleanup() {
      await stop();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

function adminHeaders() {
  return { 'x-admin-pin': TEST_ADMIN_PIN };
}

async function post(fixture, requestPath, body, headers = {}) {
  return request(fixture.port, requestPath, {
    method: 'POST',
    body,
    headers
  });
}

test('isolated Express API integration smoke suite', async t => {
  const fixture = createFixture();
  try {
    await fixture.start();
  } catch (error) {
    await fixture.cleanup();
    throw error;
  }
  t.after(async () => {
    await fixture.cleanup();
  });

  let squadId;
  let registration;

  await t.test('auth registration, duplicate, and login contracts', async () => {
    const invalid = await post(fixture, '/api/auth/register', { username: 'incomplete' });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.success, false);

    for (const user of USERS) {
      const created = await post(fixture, '/api/auth/register', user);
      assert.equal(created.status, 200);
      assert.equal(created.body.success, true);
      assert.equal(created.body.user.username, user.username);
    }

    const duplicate = await post(fixture, '/api/auth/register', USERS[0]);
    assert.equal(duplicate.status, 400);
    assert.equal(duplicate.body.success, false);
    assert.match(duplicate.body.message, /already registered/i);

    const login = await post(fixture, '/api/auth/login', { username: USERS[0].username });
    assert.equal(login.status, 200);
    assert.equal(login.body.success, true);
    assert.equal(login.body.user.email, USERS[0].email);
    assert.equal(login.body.isAdmin, false);

    const missingLogin = await post(fixture, '/api/auth/login', { username: 'not_registered' });
    assert.equal(missingLogin.status, 404);
    assert.equal(missingLogin.body.success, false);
  });

  await t.test('public squad list/search/my-squad and squad locking', async () => {
    const initialSquads = await request(fixture.port, '/api/squads');
    assert.equal(initialSquads.status, 200);
    assert.deepEqual(initialSquads.body.squads, []);
    assert.equal(initialSquads.body.total, 0);

    const searchBeforeSquad = await request(
      fixture.port,
      `/api/users/search?username=${encodeURIComponent('player_one')}`
    );
    assert.equal(searchBeforeSquad.status, 200);
    assert.equal(searchBeforeSquad.body.success, true);
    assert.equal(searchBeforeSquad.body.found, true);
    assert.equal(searchBeforeSquad.body.isLocked, false);

    const duplicatePlayers = await post(fixture, '/api/squads', {
      teamName: 'Rejected Duplicate Players',
      teamTag: 'dup',
      iglUsername: 'captain_one',
      playerUsernames: ['player_one', 'player_one', 'player_two']
    });
    assert.equal(duplicatePlayers.status, 400);
    assert.equal(duplicatePlayers.body.success, false);
    assert.match(duplicatePlayers.body.message, /duplicate players/i);

    const created = await post(fixture, '/api/squads', {
      teamName: 'Synthetic Smoke Squad',
      teamTag: 'smk',
      iglUsername: 'captain_one',
      playerUsernames: ['player_one', 'player_two', 'player_three']
    });
    assert.equal(created.status, 200);
    assert.equal(created.body.success, true);
    assert.equal(created.body.squad.teamTag, 'SMK');
    assert.equal(created.body.squad.players.length, 4);
    squadId = created.body.squad.squadId;

    const squads = await request(fixture.port, '/api/squads');
    assert.equal(squads.status, 200);
    assert.equal(squads.body.total, 1);
    assert.equal(squads.body.squads[0].teamName, 'Synthetic Smoke Squad');
    assert.equal(squads.body.squads[0].playerCount, 4);
    assert.equal(Object.hasOwn(squads.body.squads[0], 'players'), false);

    const mySquad = await request(
      fixture.port,
      `/api/squads/my?username=${encodeURIComponent('player_two')}`
    );
    assert.equal(mySquad.status, 200);
    assert.equal(mySquad.body.success, true);
    assert.equal(mySquad.body.squad.squadId, squadId);

    const searchAfterSquad = await request(
      fixture.port,
      `/api/users/search?username=${encodeURIComponent('player_one')}`
    );
    assert.equal(searchAfterSquad.status, 200);
    assert.equal(searchAfterSquad.body.isLocked, true);
    assert.equal(searchAfterSquad.body.squadName, 'Synthetic Smoke Squad');

    const reusePlayer = await post(fixture, '/api/squads', {
      teamName: 'Rejected Reuse Squad',
      teamTag: 'reuse',
      iglUsername: 'captain_two',
      playerUsernames: ['player_one', 'player_four', 'player_five']
    });
    assert.equal(reusePlayer.status, 400);
    assert.equal(reusePlayer.body.success, false);
    assert.match(reusePlayer.body.message, /already locked/i);
  });

  await t.test('tournament repeat registration and IDP lock/release', async () => {
    const firstRegistration = await post(fixture, '/api/tournaments/register', {
      squadId,
      tourneyId: 'synthetic-tournament'
    });
    assert.equal(firstRegistration.status, 200);
    assert.equal(firstRegistration.body.success, true);
    assert.equal(firstRegistration.body.registration.slotNumber, 1);
    registration = firstRegistration.body.registration;

    const repeatedRegistration = await post(fixture, '/api/tournaments/register', {
      squadId,
      tourneyId: 'synthetic-tournament'
    });
    assert.equal(repeatedRegistration.status, 200);
    assert.equal(repeatedRegistration.body.success, true);
    assert.equal(repeatedRegistration.body.isAlreadyRegistered, true);
    assert.equal(repeatedRegistration.body.registration.regId, registration.regId);

    const tournamentStatus = await request(fixture.port, '/api/tournaments/status');
    assert.equal(tournamentStatus.status, 200);
    assert.equal(tournamentStatus.body.filledSlots, 1);
    assert.equal(tournamentStatus.body.registrations.length, 1);

    const lockedSettings = await post(fixture, '/api/admin/idp', {
      activeDay: 1,
      roomId: 'SYNTHETIC-ROOM',
      roomPass: 'SYNTHETIC-PASS',
      matchTime: 'Synthetic Time',
      isReleased: false
    }, adminHeaders());
    assert.equal(lockedSettings.status, 200);
    assert.equal(lockedSettings.body.success, true);
    assert.equal(lockedSettings.body.idpSettings.isReleased, false);

    const lockedIdp = await request(
      fixture.port,
      `/api/idp?username=${encodeURIComponent('player_two')}`
    );
    assert.equal(lockedIdp.status, 200);
    assert.equal(lockedIdp.body.isReleased, false);
    assert.equal(lockedIdp.body.isAuthorized, false);
    assert.equal(lockedIdp.body.userSquad.teamName, 'Synthetic Smoke Squad');
    assert.equal(lockedIdp.body.credentials, null);

    const releasedSettings = await post(fixture, '/api/admin/idp', {
      activeDay: 1,
      roomId: 'SYNTHETIC-ROOM-RELEASED',
      roomPass: 'SYNTHETIC-PASS-RELEASED',
      matchTime: 'Synthetic Release Time',
      isReleased: true
    }, adminHeaders());
    assert.equal(releasedSettings.status, 200);
    assert.equal(releasedSettings.body.idpSettings.isReleased, true);

    const releasedIdp = await request(
      fixture.port,
      `/api/idp?username=${encodeURIComponent('player_two')}`
    );
    assert.equal(releasedIdp.status, 200);
    assert.equal(releasedIdp.body.isAuthorized, true);
    assert.deepEqual(releasedIdp.body.credentials, {
      roomId: 'SYNTHETIC-ROOM-RELEASED',
      roomPass: 'SYNTHETIC-PASS-RELEASED'
    });
  });

  await t.test('leaderboard unpublished and published retrieval', async () => {
    const initial = await request(fixture.port, '/api/leaderboard');
    assert.equal(initial.status, 200);
    assert.equal(initial.body.success, true);
    assert.equal(initial.body.leaderboard.isPublished, false);

    const leaderboard = {
      season: 'SYNTHETIC SEASON RESULTS',
      mvp: { username: 'player_one', score: 99 },
      standings: [{ rank: 1, teamName: 'Synthetic Smoke Squad', points: 99 }],
      isPublished: false
    };
    const unpublished = await post(
      fixture,
      '/api/admin/leaderboard',
      leaderboard,
      adminHeaders()
    );
    assert.equal(unpublished.status, 200);
    assert.equal(unpublished.body.success, true);
    assert.equal(unpublished.body.leaderboard.isPublished, false);

    const unpublishedReadback = await request(fixture.port, '/api/leaderboard');
    assert.equal(unpublishedReadback.status, 200);
    assert.equal(unpublishedReadback.body.leaderboard.isPublished, false);
    assert.deepEqual(unpublishedReadback.body.leaderboard.standings, leaderboard.standings);

    const published = await post(
      fixture,
      '/api/admin/leaderboard',
      { ...leaderboard, isPublished: true },
      adminHeaders()
    );
    assert.equal(published.status, 200);
    assert.equal(published.body.leaderboard.isPublished, true);

    const publishedReadback = await request(fixture.port, '/api/leaderboard');
    assert.equal(publishedReadback.status, 200);
    assert.equal(publishedReadback.body.leaderboard.isPublished, true);
    assert.deepEqual(publishedReadback.body.leaderboard.mvp, leaderboard.mvp);
    assert.deepEqual(publishedReadback.body.leaderboard.standings, leaderboard.standings);
  });

  await t.test('persists synthetic state across an isolated server restart', async () => {
    await fixture.restart();

    const health = await request(fixture.port, '/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.users, USERS.length);
    assert.equal(health.body.squads, 1);
    assert.equal(health.body.registrations, 1);

    const squadReadback = await request(
      fixture.port,
      `/api/squads/my?username=${encodeURIComponent('player_two')}`
    );
    assert.equal(squadReadback.status, 200);
    assert.equal(squadReadback.body.squad.squadId, squadId);

    const registrationReadback = await request(fixture.port, '/api/tournaments/status');
    assert.equal(registrationReadback.status, 200);
    assert.equal(registrationReadback.body.filledSlots, 1);
    assert.equal(registrationReadback.body.registrations[0].slotNumber, registration.slotNumber);

    const leaderboardReadback = await request(fixture.port, '/api/leaderboard');
    assert.equal(leaderboardReadback.status, 200);
    assert.equal(leaderboardReadback.body.leaderboard.isPublished, true);
    assert.equal(leaderboardReadback.body.leaderboard.season, 'SYNTHETIC SEASON RESULTS');
  });
});
