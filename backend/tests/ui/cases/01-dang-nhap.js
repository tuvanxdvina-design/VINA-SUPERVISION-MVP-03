// Đăng nhập + hai ca bảo vệ chính bộ kiểm thử khỏi "xanh giả".
const assert = require('node:assert/strict');
const { uiTest, loginViaApi, loginViaForm, navVisible } = require('../helpers');

module.exports = function () {
  uiTest('HZ-01 mỗi ca có trạng thái trình duyệt sạch (không service worker, localStorage rỗng)', async (page) => {
    const state = await page.evaluate(() => ({
      sw: !!navigator.serviceWorker && !!navigator.serviceWorker.controller,
      keys: Object.keys(localStorage)
    }));
    assert.equal(state.sw, false, 'service worker phải bị chặn, nếu không ca sau có thể chạy trên bản cache cũ');
    assert.deepEqual(state.keys.filter(k => k.startsWith('vina')), [], 'localStorage phải sạch khi vào ca mới');
  });

  uiTest('HZ-02 hộp thoại confirm/alert của trình duyệt được tự động xử lý', async (page) => {
    await loginViaApi(page, 'thanhb');
    await page.evaluate(() => { window.confirm('kiểm tra hộp thoại'); });
    assert.ok(page.__dialogs.some(m => m.includes('kiểm tra hộp thoại')),
      'helper phải bắt được hộp thoại; nếu không, các ca bấm Duyệt/Xóa sẽ treo');
  });

  uiTest('GD-01 đăng nhập: sai mật khẩu bị chặn, đúng thì vào được app', async (page) => {
    await loginViaForm(page, 'hung', 'sai-mat-khau');
    await page.waitForFunction(() => (document.getElementById('loginError')?.textContent || '').trim().length > 0);
    assert.ok(await page.locator('#loginScreen').isVisible(), 'sai mật khẩu thì vẫn phải ở màn hình đăng nhập');
    // Thanh nav vẫn nằm trong DOM phía dưới, nhưng người dùng không thấy vì lớp đăng nhập phủ kín màn hình.
    const box = await page.locator('#loginScreen').boundingBox();
    const vp = page.viewportSize();
    assert.ok(box && box.width >= vp.width - 1 && box.height >= vp.height - 1,
      'màn hình đăng nhập phải phủ kín khung nhìn, không để lọt giao diện phía sau: ' + JSON.stringify(box));

    await page.fill('#loginPassword', 'demo');
    await page.click('#loginButton');
    await page.waitForFunction(() => {
      const auth = localStorage.getItem('vina_supervision_auth');
      const login = document.getElementById('loginScreen');
      const header = document.querySelector('header');
      return !!auth && login && getComputedStyle(login).display === 'none' && header && !header.hidden;
    });
    await page.waitForSelector('nav button[data-page="projects"]', { state: 'visible' });
    assert.equal(await page.locator('#buildBanner').count(), 0, 'không được có banner lệch phiên bản giữa index.html và máy chủ');
    assert.equal(await page.locator('#loginScreen').isVisible(), false, 'đăng nhập đúng thì màn hình đăng nhập phải biến mất');
    assert.equal(await navVisible(page, 'daily'), true, 'vào được app: thấy mục Nhật ký trên thanh nav');
  });
};
