const assert = require('node:assert/strict');
const { uiTest, loginViaApi, openPage } = require('../helpers');

module.exports = function register() {
  uiTest('GD-13 mobile: dieu huong, noi dung va hop thoai nam gon trong man hinh', async page => {
    await loginViaApi(page, 'admin');
    await openPage(page, 'projects');

    const layout = await page.evaluate(() => {
      const nav = document.querySelector('aside');
      const main = document.querySelector('main');
      const nr = nav.getBoundingClientRect();
      const mr = main.getBoundingClientRect();
      return {
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        navBottomGap: Math.abs(window.innerHeight - nr.bottom),
        navWithinViewport: nr.left >= 0 && nr.right <= window.innerWidth + 1,
        mainWithinViewport: mr.left >= 0 && mr.right <= window.innerWidth + 1
      };
    });
    assert.equal(layout.viewportWidth, 390);
    assert.ok(layout.documentWidth <= layout.viewportWidth + 1, 'Trang bi tran ngang');
    assert.ok(layout.navBottomGap <= 1 && layout.navWithinViewport, 'Thanh dieu huong mobile khong bam day/man hinh');
    assert.ok(layout.mainWithinViewport, 'Noi dung chinh vuot khoi man hinh');
    const portraitLabels = await page.locator('nav button:visible .nav-label').allTextContents();
    assert.ok(portraitLabels.includes('Công trình') && portraitLabels.includes('Báo cáo ngày'), 'Dieu huong doc phai co ten ben canh/bene duoi bieu tuong');
    assert.equal(await page.locator('nav button[data-page="docs"]').count(), 0, 'Ho so khong con la mot muc dieu huong doc lap');
    assert.equal(await page.locator('header button', { hasText: 'Đổi mật khẩu' }).count(), 0, 'Doi mat khau khong nam ngoai dau trang');

    await page.click('#newProjectButton');
    await page.waitForSelector('#modal.show');
    const modal = await page.locator('#modal .modalbox').boundingBox();
    assert.ok(modal, 'Khong mo duoc hop thoai them cong trinh');
    assert.ok(modal.x >= 0 && modal.y >= 0, 'Hop thoai nam ngoai canh tren/trai');
    assert.ok(modal.x + modal.width <= 391, 'Hop thoai tran ngang');
    assert.ok(modal.y + modal.height <= 845, 'Hop thoai tran doc');

    await page.locator('#modal .modalbox > div button').first().click();
    await page.click('#mobileMoreButton');
    await page.locator('#mbody .mobile-more-grid button', { hasText: 'Thiết lập' }).click();
    await page.waitForSelector('#settings.page.active', { state: 'visible' });
    assert.ok(await page.locator('#settings button', { hasText: 'Đổi mật khẩu' }).isVisible(), 'Doi mat khau phai nam trong Thiet lap');

    await page.setViewportSize({ width: 844, height: 390 });
    await openPage(page, 'projects');
    const landscape = await page.evaluate(() => {
      const aside = document.querySelector('aside').getBoundingClientRect();
      const labels = [...document.querySelectorAll('nav button')]
        .filter(button => getComputedStyle(button).display !== 'none')
        .map(button => ({ text: button.querySelector('.nav-label')?.textContent?.trim(), visible: button.querySelector('.nav-label')?.getBoundingClientRect().width > 0 }));
      return { asideWidth: aside.width, labels };
    });
    assert.ok(landscape.asideWidth >= 180, 'Man hinh ngang phai co thanh ben du rong de hien ten');
    assert.ok(landscape.labels.every(item => item.text && item.visible), 'Man hinh ngang phai hien ten cua moi bieu tuong: ' + JSON.stringify(landscape.labels));

    await page.locator('#projectsTable button', { hasText: 'Chi tiết' }).first().click();
    assert.ok(await page.locator('#pdNewDocBtn').isVisible(), 'Chi tiet cong trinh phai co nut Khai bao ho so');
    assert.ok(await page.locator('#pdDocs').isVisible(), 'Ho so phai nam trong Chi tiet cong trinh');
    assert.deepEqual(page.__console, [], 'Co loi console tren giao dien mobile');
  }, { viewport: { width: 390, height: 844 } });
};
