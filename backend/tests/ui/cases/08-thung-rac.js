// Xóa = chuyển vào Thùng rác: bắt buộc có lý do, khôi phục được, chỉ Admin xóa vĩnh viễn.
const assert = require('node:assert/strict');
const { uiTest, waitForDialog, loginViaApi, openPage, tokenOf, apiAs, projectIdByContract } = require('../helpers');

async function taoNhatKyQuaApi(who, congViec, ngay, ca) {
  const token = await tokenOf(who);
  const api = apiAs(token);
  const pid = await projectIdByContract(token, '001');
  const created = await api.post('/daily-logs', { project_id: pid, log_date: ngay, shift: ca, work_summary: congViec });
  assert.ok([200, 201].includes(created.status), 'tạo nhật ký qua API: ' + JSON.stringify(created.body));
  return { id: created.body.id, api };
}

module.exports = function () {
  uiTest('GD-12 xóa phải có lý do, vào Thùng rác và khôi phục được', async (page) => {
    const congViec = 'GD-12 nhat ky se xoa';
    await taoNhatKyQuaApi('admin', congViec, '2026-09-26', 'CA2');

    await loginViaApi(page, 'admin');
    await openPage(page, 'daily');
    const row = () => page.locator('#logsTable tr', { hasText: congViec });
    await row().locator('button:has-text("Xóa")').first().click();
    await page.waitForSelector('#modal.show #delReason', { state: 'visible' });
    assert.equal(await page.locator('#mtitle').innerText(), 'Xóa nội dung');

    // Lý do rỗng → bị chặn, bản ghi vẫn còn
    await page.locator('#modal button.danger').first().click();
    assert.ok(await page.locator('#modal.show').isVisible(), 'lý do rỗng thì không được xóa');
    assert.ok((await page.locator('#delMsg').innerText()).includes('Nhập lý do xóa'), 'phải nhắc nhập lý do xóa');
    assert.ok((await page.locator('#logsTable').innerText()).includes(congViec), 'bản ghi vẫn còn khi chưa nhập lý do');

    // Có lý do → vào Thùng rác
    await page.fill('#delReason', 'Lập trùng nhật ký ca 2 ngày 26/09.');
    await page.locator('#modal button.danger').first().click();
    await page.waitForFunction(t => !(document.getElementById('logsTable')?.innerText || '').includes(t), congViec);

    await openPage(page, 'trash');
    await page.waitForFunction(t => (document.getElementById('trashBody')?.innerText || '').includes(t), congViec);
    const trash = await page.locator('#trashBody').innerText();
    assert.ok(trash.includes('Lập trùng nhật ký'), 'Thùng rác phải giữ lý do xóa: ' + trash.slice(0, 300));

    // Khôi phục → bản ghi trở lại danh sách nhật ký
    await page.locator('#trashBody tr', { hasText: congViec }).locator('button:has-text("Khôi phục")').first().click();
    await page.waitForFunction(t => !(document.getElementById('trashBody')?.innerText || '').includes(t), congViec);
    await waitForDialog(page, 'Đã khôi phục');
    assert.ok(!page.__dialogs.some(m => m.includes('Ctrl+F5')), 'khôi phục xong không được bắt người dùng tự tải lại trang');

    // Danh sách nhật ký phải tự hiện lại bản ghi, không cần tải lại trang.
    await openPage(page, 'daily');
    await page.waitForFunction(t => (document.getElementById('logsTable')?.innerText || '').includes(t), congViec);
  });

  uiTest('GD-12b nút Xóa vĩnh viễn chỉ Admin thấy', async (page) => {
    const congViec = 'GD-12b nhat ky da xoa';
    const { id, api } = await taoNhatKyQuaApi('admin', congViec, '2026-09-27', 'CA1');
    const del = await api.del(`/daily-logs/${id}`, { reason: 'Dựng dữ liệu cho ca kiểm thử.' });
    assert.ok([200, 204].includes(del.status), 'xóa qua API: ' + JSON.stringify(del.body));

    await loginViaApi(page, 'admin');
    await openPage(page, 'trash');
    await page.waitForFunction(t => (document.getElementById('trashBody')?.innerText || '').includes(t), congViec);
    assert.ok(await page.locator('#trashBody tr', { hasText: congViec }).locator('button:has-text("Xóa vĩnh viễn")').isVisible(),
      'Admin phải thấy nút Xóa vĩnh viễn');

    // Giám đốc: thấy Thùng rác và khôi phục được, nhưng không được xóa vĩnh viễn
    await loginViaApi(page, 'duong');
    await openPage(page, 'trash');
    await page.waitForFunction(t => (document.getElementById('trashBody')?.innerText || '').includes(t), congViec);
    assert.equal(await page.locator('#trashBody tr', { hasText: congViec }).locator('button:has-text("Xóa vĩnh viễn")').count(), 0,
      'chỉ Admin được xóa vĩnh viễn');
    assert.ok(await page.locator('#trashBody tr', { hasText: congViec }).locator('button:has-text("Khôi phục")').isVisible(),
      'Giám đốc vẫn phải khôi phục được');
  });
};
