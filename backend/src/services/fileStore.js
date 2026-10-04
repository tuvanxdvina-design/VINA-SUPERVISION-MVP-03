const fs = require('fs/promises');
const path = require('path');
const { createHash, randomUUID } = require('crypto');

const root = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads'));

async function put(buffer) {
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const storageKey = path.join('files', sha256.slice(0, 2), sha256);
  const destination = path.join(root, storageKey);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const temporary = destination + '.' + randomUUID() + '.tmp';
  try {
    await fs.writeFile(temporary, buffer, { flag: 'wx' });
    try { await fs.rename(temporary, destination); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      await fs.unlink(temporary).catch(() => {});
    }
  } catch (error) {
    await fs.unlink(temporary).catch(() => {});
    throw error;
  }
  return { sha256, storageKey: storageKey.replace(/\\/g, '/') };
}

async function get(storageKey) {
  if (!/^files\/[0-9a-f]{2}\/[0-9a-f]{64}$/.test(storageKey || '')) return null;
  return fs.readFile(path.join(root, ...storageKey.split('/')));
}

module.exports = { put, get, root };
