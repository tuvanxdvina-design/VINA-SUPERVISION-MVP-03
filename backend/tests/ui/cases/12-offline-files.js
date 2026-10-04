const assert = require('node:assert/strict');
const { uiTest } = require('../helpers');

module.exports = function register() {
  uiTest('GD-15 ngoại tuyến: tệp chờ nằm trong IndexedDB, không làm đầy localStorage', async page => {
    const result = await page.evaluate(async () => {
      const marker = 'VINA_OFFLINE_FILE_' + crypto.randomUUID();
      const file = new File([marker], 'bien-ban.txt', { type: 'text/plain' });
      const [id] = await queueOfflineFiles('test', 'owner-1', [{ file, kind: 'DOCUMENT', category: 'TEST' }]);
      const rows = await queuedFiles('test', 'owner-1');
      let localContainsFile = false;
      for (let i = 0; i < localStorage.length; i++) if ((localStorage.getItem(localStorage.key(i)) || '').includes(marker)) localContainsFile = true;
      const text = await rows[0].blob.text();
      await removeQueuedFile(id);
      return { count: rows.length, textMatches: text === marker, localContainsFile, afterRemove: await queuedFileCount('test', 'owner-1') };
    });
    assert.deepEqual(result, { count: 1, textMatches: true, localContainsFile: false, afterRemove: 0 });
    assert.deepEqual(page.__console, []);
  });
};
