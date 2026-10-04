// Optional real-browser smoke suite. No application dependency is required:
// NODE_PATH=/path/to/playwright/node_modules node --test tests/motion.browser.cjs
// Uses the real Express server with a disposable database; never reads .env or data/db.json.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function until(predicate, label) {
  for (let tries = 0; tries < 300; tries++) {
    if (await predicate()) return;
    await sleep(50);
  }
  throw new Error(`Timed out: ${label}`);
}

async function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ip-motion-'));
  fs.copyFileSync(path.join(ROOT, 'server.js'), path.join(directory, 'server.js'));
  for (const name of ['index.html', 'css', 'js', 'assets', 'node_modules']) {
    fs.symlinkSync(path.join(ROOT, name), path.join(directory, name));
  }
  fs.mkdirSync(path.join(directory, 'data'));
  fs.writeFileSync(path.join(directory, 'data/db.json'), JSON.stringify({
    users: [], squads: [], registrations: [], adminEmails: ['motion@example.test'],
    idpSettings: { activeDay: 1, isReleased: false, roomId: '', roomPass: '' },
    leaderboard: { isPublished: false, standings: [], mvp: null }
  }));
  const probe = http.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: directory, stdio: 'ignore',
    env: { PATH: process.env.PATH, PORT: String(port), NODE_ENV: 'test', ADMIN_PIN: 'motion-test-only' }
  });
  const base = `http://127.0.0.1:${port}`;
  const stop = async () => {
    if (child.exitCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill();
      await exited;
    }
    fs.rmSync(directory, { recursive: true, force: true });
  };
  try {
    await until(async () => {
      try { return (await fetch(`${base}/api/health`)).ok; } catch { return false; }
    }, 'server start');
  } catch (error) { await stop(); throw error; }
  return { base, stop };
}

test('simple motion and unchanged real user flows', { timeout: 180000 }, async t => {
  const server = await fixture();
  t.after(server.stop);
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const contexts = [];
  const failures = [];
  async function open(options = {}, beforeLoad) {
    const context = await browser.newContext(options);
    contexts.push(context);
    if (beforeLoad) await context.addInitScript(beforeLoad);
    const page = await context.newPage();
    page.on('pageerror', error => failures.push(error.message));
    page.on('console', message => { if (message.type() === 'error') failures.push(message.text()); });
    await page.goto(server.base, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('#hero-event-status').textContent === 'REGISTRATION OPEN');
    return page;
  }
  t.after(async () => { for (const context of contexts) await context.close(); });
  const visible = (page, selector) => page.locator(selector).evaluate(el => !el.classList.contains('hidden'));
  const css = (page, selector, property) => page.locator(selector).first().evaluate((el, property) => getComputedStyle(el)[property], property);
  const scroll = (page, selector) => page.locator(selector).first().evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' }));
  let desktop;

  await t.test('desktop reveals, hover, active underline, route/history and modals', async () => {
    desktop = await open({ viewport: { width: 1440, height: 900 } });
    assert.equal(await desktop.locator('canvas, .hero-particles').count(), 0);
    assert.equal(await css(desktop, '.hero-title', 'animationName'), 'motionFadeUp');
    assert.ok(parseFloat(await css(desktop, '.hero-description', 'animationDelay')) > parseFloat(await css(desktop, '.hero-title', 'animationDelay')));
    assert.equal(await desktop.evaluate(() => window.scrollY), 0, 'home does not auto-scroll to Community');
    assert.equal(await css(desktop, '.hero-console', 'animationName'), 'none');
    assert.equal(await desktop.evaluate(() => document.getAnimations().filter(animation => animation.effect?.getTiming().iterations === Infinity).length), 0);
    await scroll(desktop, '.metric-card');
    await until(async () => await css(desktop, '.metric-card', 'opacity') === '1', 'metrics reveal');
    await desktop.locator('.metric-card').first().hover();
    await sleep(280);
    assert.equal(await css(desktop, '.metric-card', 'transform'), 'matrix(1, 0, 0, 1, 0, -4)');
    assert.ok((await desktop.locator('.metric-value').allTextContents()).includes('₹1K'), 'counters never rewrite authoritative text');
    const firstUnderline = await css(desktop, '.nav-active-indicator', 'transform');
    await desktop.locator('.desktop-nav [data-route="wars"]').click();
    await until(() => visible(desktop, '#view-wars'), 'wars route');
    await sleep(350);
    assert.notEqual(await css(desktop, '.nav-active-indicator', 'transform'), firstUnderline);
    assert.equal(await css(desktop, '#view-wars', 'animationDuration'), '0.28s');
    await desktop.locator('#wars-list-container [aria-label="View tournament details"]').click();
    await sleep(100);
    assert.equal(await visible(desktop, '#tournament-details-modal'), true);
    const scale = await css(desktop, '#tournament-details-modal .modal-dialog', 'transform');
    assert.notEqual(scale, 'none', 'existing card reset must not suppress modal scale');
    await sleep(300);
    await desktop.locator('#tournament-modal-body').getByRole('button', { name: 'Proceed to Registration' }).click();
    await sleep(300);
    assert.equal(await visible(desktop, '#view-register'), true);
    assert.equal(await visible(desktop, '#tournament-details-modal'), false);
    await desktop.goBack();
    await until(() => visible(desktop, '#view-wars'), 'browser back');
    await desktop.evaluate(() => { openAuthModal(); closeAuthModal(); });
    await sleep(300);
    assert.equal(await visible(desktop, '#auth-modal'), false, 'stale open frame must be cancelled');
    await desktop.evaluate(() => { openAuthModal(); closeAuthModal(); openAuthModal(); });
    await until(async () => await css(desktop, '#auth-modal', 'opacity') === '1', 'modal reopen settles');
    assert.equal(await desktop.locator('#auth-modal').evaluate(el => el.inert), false);
    await desktop.keyboard.press('Escape');
    await sleep(300);
    assert.equal(await visible(desktop, '#auth-modal'), false);
  });

  await t.test('mobile menu, rapid toggles, navigation and viewport widths', async () => {
    const mobile = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await mobile.locator('#mobile-menu-btn').tap();
    await until(async () => await css(mobile, '#mobile-menu', 'opacity') === '1', 'menu entrance settles');
    await mobile.locator('#mobile-menu [data-route="wars"]').tap();
    await sleep(300);
    assert.equal(await visible(mobile, '#view-wars'), true);
    assert.equal(await visible(mobile, '#mobile-menu'), false);
    await mobile.evaluate(() => { const btn = document.querySelector('#mobile-menu-btn'); btn.click(); btn.click(); });
    await sleep(300);
    assert.equal(await visible(mobile, '#mobile-menu'), false);
    await mobile.locator('#mobile-menu-btn').tap();
    await sleep(300);
    await mobile.locator('#mobile-menu').getByRole('button', { name: 'Enter The Arena' }).tap();
    await sleep(300);
    assert.equal(await visible(mobile, '#mobile-menu'), false);
    assert.equal(await visible(mobile, '#view-register'), true);
    for (const width of [360, 390, 768]) {
      await mobile.setViewportSize({ width, height: 844 });
      await mobile.evaluate(() => document.querySelector('[data-route="home"]').click());
      await sleep(350);
      assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `no horizontal overflow at ${width}px`);
      await scroll(mobile, '#weekly-wars-container');
      await sleep(650);
      assert.equal(await css(mobile, '#weekly-wars-container .weekly-war-card', 'opacity'), '1');
    }
  });

  await t.test('API refresh and newly published leaderboard rows reveal correctly', async () => {
    await desktop.locator('.desktop-nav [data-route="home"]:not([data-scroll-target])').click();
    const response = await fetch(`${server.base}/api/admin/leaderboard`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-pin': 'motion-test-only' },
      body: JSON.stringify({ isPublished: true, season: 'Motion test', mvp: null,
        standings: [1, 2, 3].map(rank => ({ rank, team: `Test Squad ${rank}`, matches: 4, booyahs: 1, placePts: 12, killPts: 10, totalPts: 22 })) })
    });
    assert.equal(response.ok, true);
    await scroll(desktop, '#refresh-arena');
    await desktop.locator('#refresh-arena').click();
    await until(async () => !(await desktop.locator('#refresh-arena').isDisabled()), 'API refresh complete');
    await scroll(desktop, '#match-schedule-feed');
    await until(async () => await css(desktop, '.match-day-card', 'opacity') === '1', 'refreshed match cards reveal');
    assert.equal(await css(desktop, '#match-schedule-feed', 'opacity'), '1', 'API container must not hide its revealed children');
    await desktop.locator('.desktop-nav [data-route="leaderboard"]').click();
    assert.equal(await desktop.locator('.leaderboard-row').count(), 3);
    await until(async () => await css(desktop, '.leaderboard-row', 'opacity') === '1', 'leaderboard reveal settles');
    assert.equal(await desktop.locator('.leaderboard-row').first().innerText().then(text => text.includes('Test Squad 1')), true);
    const delays = await desktop.locator('.leaderboard-row').evaluateAll(rows => rows.map(row => row.style.getPropertyValue('--reveal-delay')));
    assert.deepEqual(delays, ['0ms', '55ms', '110ms']);
  });

  await t.test('real signup/login, squad creation, tournament registration and pass', async () => {
    await desktop.locator('.desktop-nav [data-route="register"]').click();
    for (let index = 0; index < 4; index++) {
      await desktop.locator('#header-auth-container').getByRole('button', { name: /Player Login/ }).click();
      await desktop.locator('#auth-tab-signup').click();
      for (const [field, value] of Object.entries({ username: `motion_${index}`, name: `Motion Player ${index}`, ign: `MOTION${index}`, uid: `88000000${index}`, phone: '+91 90000 00000' })) {
        await desktop.locator(`#signup-${field}`).fill(value);
      }
      await desktop.locator('#auth-signup-form [type="submit"]').click();
      await until(async () => !(await visible(desktop, '#auth-modal')), 'signup complete');
      await desktop.locator('#header-auth-container [title="Logout"]').click();
    }
    await desktop.locator('#header-auth-container').getByRole('button', { name: /Player Login/ }).click();
    await desktop.locator('#auth-tab-login').click();
    await desktop.locator('#login-username').fill('motion_0');
    await desktop.locator('#auth-login-form [type="submit"]').click();
    await until(async () => !(await visible(desktop, '#auth-modal')), 'login complete');
    await desktop.locator('#squad-team-name').fill('Motion Test Squad');
    await desktop.locator('#squad-team-tag').fill('MTS');
    for (let index = 1; index <= 3; index++) {
      await desktop.locator(`#p${index + 1}-username`).fill(`motion_${index}`);
      await desktop.locator(`#p${index + 1}-status`).getByText(/Verified:/).waitFor();
    }
    await desktop.locator('#create-squad-form [type="submit"]').click();
    await desktop.getByRole('button', { name: /1-Click Register Squad/ }).click();
    await desktop.locator('#printable-pass').waitFor();
    await until(async () => await css(desktop, '#pass-modal', 'opacity') === '1', 'pass entrance settles');
    const status = await fetch(`${server.base}/api/tournaments/status`).then(response => response.json());
    assert.equal(status.filledSlots, 1);
    assert.equal(status.registrations[0].teamName, 'Motion Test Squad');
    await desktop.keyboard.press('Escape');
    await sleep(300);
    assert.equal(await visible(desktop, '#pass-modal'), false);
  });

  await t.test('reduced motion, live preference changes and observer-free fallback', async () => {
    const reduced = await open({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    assert.equal(await css(reduced, '.hero-title', 'animationName'), 'none');
    assert.equal(await reduced.locator('.motion-pending').count(), 0);
    assert.equal(await reduced.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'auto');
    await reduced.locator('#mobile-menu-btn').click();
    assert.equal(await css(reduced, '#mobile-menu', 'opacity'), '1');
    await reduced.locator('#mobile-menu-btn').click();
    assert.equal(await visible(reduced, '#mobile-menu'), false);
    const fallback = await open({ viewport: { width: 1440, height: 900 } }, () => { delete window.IntersectionObserver; });
    assert.equal(await fallback.locator('.motion-pending').count(), 0);
    const live = await open({ viewport: { width: 1440, height: 900 } });
    assert.ok(await live.locator('.motion-pending').count() > 0);
    await live.emulateMedia({ reducedMotion: 'reduce' });
    await until(async () => await live.locator('.motion-pending').count() === 0, 'live reduced motion preference');
    assert.equal(await css(live, '.hero-title', 'animationName'), 'none');
  });

  await t.test('no browser JavaScript or console errors', () => assert.deepEqual(failures, []));
});
