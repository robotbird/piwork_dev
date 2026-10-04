/** Fixed CJS helper shipped by argv to the sandbox's Node runtime. Never stored
 * in model-writable workspace. Linux /proc/self/fd pins traversed directories;
 * O_NOFOLLOW/O_NONBLOCK rejects links and blocking special files. No host APIs.
 */
export const REMOTE_FILES_SCRIPT = String.raw`
const fs = require('node:fs/promises');
const C = require('node:fs').constants;
const path = require('node:path');
const crypto = require('node:crypto');
const input = JSON.parse(process.argv[1]);
let parent;
let temporary;
let committed = false;
const fail = (code, message) => { const e = new Error(message); e.code = code; throw e; };
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const anchored = process.platform === 'linux';
async function directory(base, name, create) {
  const target = path.join(base, name);
  if (create) {
    try { await fs.mkdir(target, {mode: 0o700}); }
    catch (e) { if (e.code !== 'EEXIST') throw e; }
  }
  return fs.open(target, C.O_RDONLY | C.O_DIRECTORY | C.O_NOFOLLOW);
}
async function getParent(create) {
  if (!anchored && !input.allowUnanchoredTestPaths) fail('UNSUPPORTED', 'Linux anchored filesystem is required');
  const root = path.resolve(input.root);
  const target = path.resolve(root, input.path);
  const rel = path.relative(root, target);
  if (!rel || rel === '..' || rel.startsWith('../') || path.isAbsolute(rel) || rel.includes('\0')) fail('PATH_ESCAPE', 'Path must name a workspace file');
  const segments = rel.split('/');
  if (segments.some(s => !s || s === '.' || s === '..')) fail('PATH_ESCAPE', 'Invalid path');
  let opened = await fs.open(root, C.O_RDONLY | C.O_DIRECTORY | C.O_NOFOLLOW);
  let lexical = root;
  try {
    for (const segment of segments.slice(0, -1)) {
      const base = anchored ? '/proc/self/fd/' + opened.fd : lexical;
      const next = await directory(base, segment, create);
      await opened.close();
      opened = next;
      lexical = path.join(lexical, segment);
    }
    return { fd: opened, base: anchored ? '/proc/self/fd/' + opened.fd : lexical, name: segments[segments.length - 1] };
  } catch (e) { await opened.close(); throw e; }
}
async function openRegular(target) {
  const file = await fs.open(target, C.O_RDONLY | C.O_NOFOLLOW | C.O_NONBLOCK);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.nlink !== 1) fail('UNSAFE_FILE', 'Only regular, non-hardlinked files are allowed');
    return { file, stat };
  } catch (e) { await file.close(); throw e; }
}
async function readLimited(target, maxBytes) {
  const {file, stat} = await openRegular(target);
  try {
    if (stat.size > maxBytes) fail('LIMIT', 'File exceeds transfer limit; use sandbox bash to split it');
    const chunks = [];
    let total = 0;
    while (true) {
      const buffer = Buffer.alloc(Math.min(65536, maxBytes - total + 1));
      const {bytesRead} = await file.read(buffer, 0, buffer.length, null);
      if (!bytesRead) break;
      total += bytesRead;
      if (total > maxBytes) fail('LIMIT', 'File grew beyond transfer limit');
      chunks.push(buffer.subarray(0, bytesRead));
    }
    const after = await file.stat();
    if (stat.size !== after.size || stat.mtimeMs !== after.mtimeMs || total !== after.size) fail('CONFLICT', 'File changed during read');
    return Buffer.concat(chunks, total);
  } finally { await file.close(); }
}
async function readInput(size) {
  if (size === 0) return Buffer.alloc(0);
  return new Promise((resolve, reject) => {
    const chunks = [];
    let count = 0;
    const onData = chunk => {
      count += chunk.length;
      if (count > size) { cleanup(); reject(new Error('Input exceeds declared size')); return; }
      chunks.push(chunk);
      if (count === size) { cleanup(); process.stdin.pause(); resolve(Buffer.concat(chunks, size)); }
    };
    const onEnd = () => { cleanup(); reject(new Error('Input was truncated')); };
    const cleanup = () => { process.stdin.off('data', onData); process.stdin.off('end', onEnd); };
    process.stdin.on('data', onData);
    process.stdin.once('end', onEnd);
  });
}
async function main() {
  if (!['read','stat','write'].includes(input.action)) fail('INVALID', 'Unsupported action');
  if (input.action !== 'stat' && (!Number.isSafeInteger(input.maxBytes) || input.maxBytes <= 0 || input.maxBytes > 50*1024*1024)) fail('LIMIT', 'Invalid limit');
  try { parent = await getParent(input.action === 'write'); }
  catch(e) { if (input.action === 'stat' && e.code === 'ENOENT') return {ok:true, missing:true}; throw e; }
  const target = path.join(parent.base, parent.name);
  if (input.action === 'stat') {
    let opened;
    try { opened = await openRegular(target); }
    catch(e) { if (e.code === 'ENOENT') return {ok:true, missing:true}; throw e; }
    try { return {ok:true, size:opened.stat.size}; }
    finally { await opened.file.close(); }
  }
  if (input.action === 'read') {
    const content = await readLimited(target, input.maxBytes);
    return {ok:true, content:content.toString('base64'), sha256:hash(content)};
  }
  if (!Number.isSafeInteger(input.size) || input.size < 0 || input.size > input.maxBytes) fail('LIMIT','Write exceeds limit');
  if (input.expectedSha256 !== null && !/^[a-f0-9]{64}$/.test(input.expectedSha256)) fail('INVALID', 'Invalid precondition');
  const content = await readInput(input.size);
  temporary = path.join(parent.base, '.piwork-write-' + crypto.randomUUID());
  const file = await fs.open(temporary, 'wx', 0o600);
  try { await file.writeFile(content); await file.sync(); }
  finally { await file.close(); }
  if (input.expectedSha256 === null) {
    // link publishes a new target without overwriting a competing creation.
    try { await fs.link(temporary, target); }
    catch(e) { if (e.code === 'EEXIST') fail('CONFLICT','File appeared since read'); throw e; }
    committed = true;
    await fs.unlink(temporary);
  } else {
    let current;
    try { current = await readLimited(target, input.maxBytes); }
    catch(e) { if (e.code === 'ENOENT') fail('CONFLICT','File disappeared since read'); throw e; }
    if (hash(current) !== input.expectedSha256) fail('CONFLICT','File changed since read; read it again');
    await fs.rename(temporary, target);
    committed = true;
  }
  temporary = undefined;
  await parent.fd.sync();
  return {ok:true};
}
(async () => {
  let reply;
  try { reply = await main(); }
  catch(e) { reply = {ok:false, code:e.code || 'FILE_ERROR', message:String(e.message).slice(0,512), phase:committed ? 'outcome_unknown':'completed'}; }
  finally {
    if (temporary) await fs.unlink(temporary).catch(() => {});
    if (parent) await parent.fd.close().catch(() => {});
  }
  process.stdout.write(JSON.stringify(reply), () => process.exit(0));
})();
`;
