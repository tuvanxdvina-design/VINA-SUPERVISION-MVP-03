const assert = require('node:assert/strict');
const { uiTest, loginViaApi, openPage } = require('../helpers');

module.exports = function register() {
  uiTest('GD-14 PWA: manifest, bieu tuong va luong cai dat san sang', async page => {
    const manifestLink = await page.getAttribute('link[rel="manifest"]', 'href');
    assert.ok(manifestLink, 'Trang chưa khai báo manifest');

    const response = await page.request.get(new URL(manifestLink, page.url()).href);
    assert.equal(response.status(), 200, 'Không tải được manifest');
    assert.match(response.headers()['content-type'] || '', /application\/manifest\+json/);
    const manifest = await response.json();
    assert.equal(manifest.name, 'VINA-SUPERVISION');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.start_url, '/');
    assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
    assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));

    for (const icon of manifest.icons) {
      const iconResponse = await page.request.get(new URL(icon.src, page.url()).href);
      assert.equal(iconResponse.status(), 200, 'Không tải được biểu tượng ' + icon.src);
      assert.match(iconResponse.headers()['content-type'] || '', /^image\/png/);
    }

    await loginViaApi(page, 'admin');
    await openPage(page, 'settings');
    assert.equal(await page.locator('#installAppButton').isVisible(), true, 'Thiếu nút cài ứng dụng');
    await page.click('#installAppButton');
    await page.waitForSelector('#modal.show');
    assert.match(await page.locator('#mbody').innerText(), /Cài đặt ứng dụng|Thêm vào màn hình chính/i);
    assert.deepEqual(page.__console, [], 'Có lỗi console trong luồng cài ứng dụng');
  });
};
