// Vỏ chạy kiểm thử giao diện: dựng CSDL thử, chạy backend cổng 3103, mở Chrome đã cài trên máy.
// Mỗi ca dùng một browser context riêng (localStorage sạch, chặn service worker).
// Các ca nằm trong tests/ui/cases/*.js và được tests/ui/all.test.js nạp — chỉ một tiến trình,
// một CSDL, một máy chủ cho cả lượt chạy.
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const { createTestDb } = require('../lib/testDb');

const PORT = 3103;
const BASE = `http://127.0.0.1:${PORT}`;
const DB_URL = process.env.UI_TEST_DB_URL || 'postgres://postgres:postgres@127.0.0.1:5432/vina_ui_claude';
const ART = path.join(__dirname, '..', 'ui-artifacts');

let db = null, server = null, browser = null;

function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', () => reject(new Error('Cổng ' + port + ' đang bị chiếm. Có thể lần chạy trước chưa tắt, hoặc bộ regression/bản kiểm tra tay đang chạy. Tắt tiến trình node đang giữ cổng rồi chạy lại.')));
    s.once('listening', () => s.close(() => resolve()));
    s.listen(port, '127.0.0.1');
  });
}

async function startApp() {
  await assertPortFree(PORT);
  db = createTestDb(DB_URL);
  db.setupAll();
  server = db.startServer({ port: PORT });
  await db.waitHealth(BASE);
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  } catch (e) {
    throw new Error('Không mở được Chrome (channel=chrome). Máy này cần Google Chrome; nếu không có, chạy "npx playwright install chromium" rồi bỏ tham số channel. Lỗi gốc: ' + e.message);
  }
}

async function stopApp() {
  if (browser) await browser.close();
  if (server) server.kill();
}

async function newPage(name) {
  const context = await browser.newContext({ baseURL: BASE, serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.__dialogs = [];
  page.on('dialog', async d => { page.__dialogs.push(d.message()); await d.accept(); });
  page.__name = name;
  await page.goto('/');
  return page;
}

// Khi một ca lỗi: lưu ảnh chụp + văn bản trang + nội dung hộp thoại để xem lại.
async function dump(page, name) {
  try {
    fs.mkdirSync(ART, { recursive: true });
    const slug = String(name).replace(/[^\w-]+/g, '_').slice(0, 60);
    await page.screenshot({ path: path.join(ART, slug + '.png'), fullPage: true });
    const text = await page.evaluate(() => document.body.innerText.slice(0, 20000));
    fs.writeFileSync(path.join(ART, slug + '.txt'),
      'HOP THOAI: ' + JSON.stringify(page.__dialogs) + '\n\n' + text, 'utf8');
  } catch (_) { /* lỗi khi chụp không được che lỗi thật của ca */ }
}

function uiTest(name, fn) {
  test(name, async () => {
    const page = await newPage(name);
    try {
      await fn(page);
    } catch (e) {
      await dump(page, name);
      throw e;
    } finally {
      await page.context().close();
    }
  });
}

async function loginViaApi(page, who, password = 'demo') {
  const res = await page.request.post(BASE + '/api/auth/login', { data: { username: who, password } });
  assert.equal(res.status(), 200, 'Không đăng nhập được bằng API: ' + who);
  const data = await res.json();
  await page.evaluate(a => localStorage.setItem('vina_supervision_auth', JSON.stringify(a)),
    { token: data.token, user: data.user, loggedAt: new Date().toISOString() });
  await page.reload();
  await page.waitForSelector('nav button[data-page="projects"]', { state: 'visible' });
  return data.user;
}

async function loginViaForm(page, who, password = 'demo') {
  await page.fill('#loginUsername', who);
  await page.fill('#loginPassword', password);
  await page.click('#loginButton');
}

async function openPage(page, dataPage) {
  await page.click(`nav button[data-page="${dataPage}"]`);
  await page.waitForSelector(`#${dataPage}.page.active`, { state: 'visible' });
}

async function navVisible(page, dataPage) {
  return page.locator(`nav button[data-page="${dataPage}"]`).isVisible();
}

function apiAs(token) {
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  const call = async (method, p, body) => {
    const res = await fetch(BASE + '/api' + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const ct = res.headers.get('content-type') || '';
    return { status: res.status, body: ct.includes('json') ? await res.json() : null };
  };
  return {
    get: (p) => call('GET', p),
    post: (p, b) => call('POST', p, b),
    patch: (p, b) => call('PATCH', p, b),
    del: (p, b) => call('DELETE', p, b)
  };
}

async function tokenOf(who, password = 'demo') {
  const res = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: who, password })
  });
  const data = await res.json();
  assert.ok(data.token, 'Không lấy được token của ' + who + ': ' + JSON.stringify(data));
  return data.token;
}

async function projectIdByContract(token, contractNo) {
  const list = (await apiAs(token).get('/projects')).body || [];
  const p = list.find(x => x.contract_no === contractNo);
  assert.ok(p, 'Không thấy công trình có số hợp đồng ' + contractNo);
  return p.id;
}

module.exports = { PORT, BASE, DB_URL, startApp, stopApp, uiTest, loginViaApi, loginViaForm, openPage, navVisible, apiAs, tokenOf, projectIdByContract };
