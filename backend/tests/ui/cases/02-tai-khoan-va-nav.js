// Tài khoản mới bị buộc đổi mật khẩu; thanh nav hiện theo vai trò và quyền.
const assert = require('node:assert/strict');
const { uiTest, loginViaApi, loginViaForm, navVisible, tokenOf, apiAs } = require('../helpers');

module.exports = function () {
  uiTest('GD-02 tài khoản mới bị buộc đổi mật khẩu ban đầu, không bỏ qua được', async (page) => {
    const admin = apiAs(await tokenOf('admin'));
    const created = await admin.post('/users', { username: 'gd02.moi', full_name: 'Ca GD02', password: 'TamThoi123', role_name: 'ENGINEER' });
    assert.ok([200, 201].includes(created.status), 'tạo được tài khoản thử: ' + JSON.stringify(created.body));

    await loginViaForm(page, 'gd02.moi', 'TamThoi123');
    await page.waitForSelector('#modal.show', { state: 'visible' });
    assert.equal(await page.locator('#mtitle').innerText(), 'Đổi mật khẩu ban đầu');

    // Không đóng được: gọi closeModal như khi người dùng bấm ra ngoài / bấm Esc
    await page.evaluate(() => window.closeModal && window.closeModal());
    assert.ok(await page.locator('#modal.show').isVisible(), 'modal buộc đổi mật khẩu không được đóng khi chưa đổi');

    const body = await page.locator('#mbody').innerText();
    assert.ok(body.includes('mật khẩu ban đầu') || body.includes('mật khẩu tạm'), 'phải giải thích vì sao bị buộc đổi: ' + body.slice(0, 200));
    assert.ok(await page.locator('#mbody >> text="Đăng xuất"').isVisible(), 'phải có đường thoát: nút Đăng xuất');
  });

  uiTest('GD-03 thanh nav hiện đúng theo vai trò và quyền', async (page) => {
    // tuan: chưa được phân công công trình nào
    await loginViaApi(page, 'tuan');
    assert.equal(await navVisible(page, 'inbox'), false, 'người không có quyền Duyệt ở đâu cả thì không thấy "Việc cần duyệt"');
    assert.equal(await navVisible(page, 'trash'), false, 'người không có quyền Xóa thì không thấy "Thùng rác"');

    // hung: TVGS trưởng tại công trình 001 → có quyền duyệt
    await loginViaApi(page, 'hung');
    assert.equal(await navVisible(page, 'inbox'), true, 'Trưởng TVGS phải thấy "Việc cần duyệt"');

    // admin: thấy đủ
    await loginViaApi(page, 'admin');
    assert.equal(await navVisible(page, 'inbox'), true, 'Admin phải thấy "Việc cần duyệt"');
    assert.equal(await navVisible(page, 'trash'), true, 'Admin phải thấy "Thùng rác"');
    assert.equal(await navVisible(page, 'settings'), true, 'Admin phải thấy "Thiết lập"');

    // duong: Giám đốc (quản trị cấp công ty)
    await loginViaApi(page, 'duong');
    assert.equal(await navVisible(page, 'inbox'), true, 'Giám đốc phải thấy "Việc cần duyệt"');
    assert.equal(await navVisible(page, 'trash'), true, 'Giám đốc phải thấy "Thùng rác"');
  });
};
