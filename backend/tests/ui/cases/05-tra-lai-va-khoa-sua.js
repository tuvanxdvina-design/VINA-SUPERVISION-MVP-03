// Trả lại nhật ký phải có ý kiến; nhật ký đã duyệt thì người lập không sửa được, Admin sửa được.
// Nhật ký bị trả lại quay về trạng thái Nháp kèm chip "↩ Bị trả lại — cần sửa" (returnedChip).
const assert = require('node:assert/strict');
const { uiTest, loginViaApi, openPage, tokenOf, apiAs, projectIdByContract } = require('../helpers');

// Dựng sẵn một nhật ký đã gửi duyệt bằng API (nhanh, không phụ thuộc ca khác).
async function nhatKyDaGui(congViec, ngay, ca = 'CA1') {
  const token = await tokenOf('thanhb');
  const api = apiAs(token);
  const pid = await projectIdByContract(token, '001');
  const created = await api.post('/daily-logs', { project_id: pid, log_date: ngay, shift: ca, work_summary: congViec });
  assert.ok([200, 201].includes(created.status), 'tạo nhật ký qua API: ' + JSON.stringify(created.body));
  const id = created.body.id;
  const sent = await api.post(`/daily-logs/${id}/submit`, {});
  assert.ok([200, 204].includes(sent.status), 'gửi duyệt qua API: ' + JSON.stringify(sent.body));
  return { id, congViec };
}

module.exports = function () {
  uiTest('GD-08 trả lại nhật ký bắt buộc có ý kiến, người lập thấy chip bị trả', async (page) => {
    const { congViec } = await nhatKyDaGui('GD-08 lap trung ca 1', '2026-09-22', 'CA2');

    await loginViaApi(page, 'hung');
    await openPage(page, 'daily');
    const row = () => page.locator('#logsTable tr', { hasText: congViec });
    await row().locator('text="Trả lại"').first().click();
    await page.waitForSelector('#modal.show #rvComment', { state: 'visible' });

    // Nút trả lại là "↩ Yêu cầu chỉnh sửa, bổ sung" (class danger); .primary là "✔ Phê duyệt".
    const nutTraLai = () => page.locator('#modal button.danger').first();

    // Bấm trả lại khi chưa nhập ý kiến → phải bị chặn, trạng thái không đổi
    await nutTraLai().click();
    assert.ok(await page.locator('#modal.show').isVisible(), 'chưa nhập ý kiến thì không được trả lại');
    assert.ok((await row().innerText()).includes('Chờ duyệt'), 'trạng thái không được đổi khi ý kiến rỗng: ' + (await row().innerText()));

    // Nhập ý kiến rồi trả lại
    await page.fill('#rvComment', 'Thiếu khối lượng bê tông, bổ sung rồi gửi lại.');
    await nutTraLai().click();
    await page.waitForSelector('#modal.show', { state: 'hidden' });

    await loginViaApi(page, 'thanhb');
    await openPage(page, 'daily');
    const mine = await page.locator('#logsTable tr', { hasText: congViec }).innerText();
    assert.ok(/Bị trả lại/.test(mine), 'người lập phải thấy chip bị trả lại: ' + mine);

    // Bị trả lại thì sửa được, và phải đọc được ý kiến của người duyệt trong modal sửa
    await page.locator('#logsTable tr', { hasText: congViec }).locator('text="Sửa"').first().click();
    await page.waitForSelector('#modal.show #lwork', { state: 'visible' });
    assert.ok((await page.locator('#mbody').innerText()).includes('Thiếu khối lượng'),
      'ý kiến của người duyệt phải hiện khi người lập mở lại nhật ký bị trả');
  });

  uiTest('GD-09 nhật ký đã duyệt: người lập không sửa được, Admin sửa được', async (page) => {
    const congViec = 'GD-09 lap cot truc B';
    const { id } = await nhatKyDaGui(congViec, '2026-09-23', 'CA2');
    const approved = await apiAs(await tokenOf('hung')).post(`/daily-logs/${id}/approve`, {});
    assert.ok([200, 204].includes(approved.status), 'duyệt qua API: ' + JSON.stringify(approved.body));

    await loginViaApi(page, 'thanhb');
    await openPage(page, 'daily');
    const row = page.locator('#logsTable tr', { hasText: congViec });
    assert.ok((await row.innerText()).includes('Đã duyệt'), 'nhật ký phải ở trạng thái Đã duyệt: ' + (await row.innerText()));
    assert.equal(await row.locator('text="Sửa"').count(), 0, 'người lập không được sửa nhật ký đã duyệt');

    await loginViaApi(page, 'admin');
    await openPage(page, 'daily');
    const adminRow = page.locator('#logsTable tr', { hasText: congViec });
    await adminRow.locator('text="Sửa"').first().click();
    await page.waitForSelector('#modal.show #lwork', { state: 'visible' });
    await page.fill('#lwork', congViec + ' (Admin sua)');
    await page.click('#modal >> text="Lưu thay đổi"');
    await page.waitForSelector('#modal.show', { state: 'hidden' });
    await page.waitForFunction(() => (document.getElementById('logsTable')?.innerText || '').includes('(Admin sua)'));
  });
};
