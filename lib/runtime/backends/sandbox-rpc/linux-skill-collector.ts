import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import {
  MAX_SKILL_BUNDLE_BYTES,
  MAX_SKILL_BUNDLE_FILES,
  MAX_SKILL_FILE_BYTES,
  skillBundleManifestSchema,
} from "../../protocol/skill-bundle";

const execute = promisify(execFile);
// Fixed platform code only: never import or execute anything from the mounted catalog.
export const LINUX_SKILL_COLLECTOR = `
const { constants: c } = require('node:fs');
const { open, opendir } = require('node:fs/promises');
(async () => {
 const names = JSON.parse(process.argv[1]);
 let count=0, directories=0, total=0;
 const results=[];
 async function walk(dir, prefix, files) {
  if (++directories > 512) throw Error('runtime:sandbox-skills:directory-limit');
  const pinned='/proc/self/fd/'+dir.fd;
  for await (const {name} of await opendir(pinned)) {
   const relative=prefix ? prefix+'/'+name : name;
   if (relative.length>1024 || relative.split('/').some(p => ['.git','.pi','.agents','.ssh','node_modules','.env','auth.json','models.json','credentials.json'].includes(p.toLowerCase()) || p.toLowerCase().startsWith('.env.'))) throw Error('runtime:sandbox-skills:unsafe-path');
   const file=await open(pinned+'/'+name, c.O_RDONLY|c.O_NOFOLLOW|c.O_NONBLOCK);
   try {
    const before=await file.stat({bigint:true});
    if (before.isDirectory()) { await walk(file,relative,files); continue; }
    if (!before.isFile() || before.nlink!==1n) throw Error('runtime:sandbox-skills:unsupported-file');
    const size=Number(before.size);
    if (++count>512 || size>10485760 || (total+=size)>52428800) throw Error('runtime:sandbox-skills:byte-or-file-limit');
    const bytes=Buffer.alloc(size+1); let offset=0;
    while (offset<bytes.length) { const r=await file.read(bytes,offset,bytes.length-offset,offset); if (!r.bytesRead) break; offset+=r.bytesRead; }
    const after=await file.stat({bigint:true});
    if (offset!==size || before.size!==after.size || before.mtimeNs!==after.mtimeNs || before.ctimeNs!==after.ctimeNs || after.nlink!==1n) throw Error('runtime:sandbox-skills:source-changed');
    files.push({path:relative,base64:bytes.subarray(0,size).toString('base64')});
   } finally { await file.close(); }
  }
 }
 const root=await open('/catalog',c.O_RDONLY|c.O_DIRECTORY|c.O_NOFOLLOW);
 try {
  for (const name of names) {
   if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw Error('runtime:sandbox-skills:invalid-name');
   const dir=await open('/proc/self/fd/'+root.fd+'/'+name,c.O_RDONLY|c.O_DIRECTORY|c.O_NOFOLLOW);
   const files=[];
   try { await walk(dir,'',files); } finally { await dir.close(); }
   results.push(files);
  }
 } finally { await root.close(); }
 process.stdout.write(JSON.stringify(results));
})().catch(error=>{ console.error(error.message); process.exitCode=1; });
`;

/** macOS development only. The Linux VM performs nofollow/pinned-fd reads.
 * The catalog is the sole read-only bind; this is not a production collector.
 */
export async function collectSkillsInLinux(
  root: string,
  names: string[],
  image: string
) {
  if (process.platform !== "darwin" || process.env.NODE_ENV !== "development") {
    throw new Error("runtime:sandbox-skills:linux-required");
  }
  if (root.includes(",") || !image || image.startsWith("-")) {
    throw new Error("runtime:sandbox-skills:invalid-collector-config");
  }
  const container = `piwork-skill-snapshot-${randomUUID()}`;
  let stdout: string;
  try {
    ({ stdout } = await execute(
      "docker",
      [
        "run",
        "--rm",
        "--pull",
        "never",
        "--name",
        container,
        "--network",
        "none",
        "--read-only",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--pids-limit",
        "32",
        "--memory",
        "256m",
        "--cpus",
        "1",
        "--user",
        `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
        "--mount",
        `type=bind,src=${root},dst=/catalog,readonly`,
        "--entrypoint",
        "node",
        image,
        "-e",
        LINUX_SKILL_COLLECTOR,
        JSON.stringify(names),
      ],
      { maxBuffer: MAX_SKILL_BUNDLE_BYTES * 2 + 1024 * 1024, timeout: 30_000 }
    ));
  } catch (error) {
    // Kill the exact helper, including when the Docker client times out.
    try {
      await execute("docker", ["rm", "-f", container], { timeout: 10_000 });
    } catch (cleanupError) {
      if (!String(cleanupError).includes("No such container")) {
        throw new Error(
          `runtime:sandbox-skills:collector-cleanup-failed:${container}`,
          { cause: cleanupError }
        );
      }
    }
    throw new Error(
      "runtime:sandbox-skills:linux-collector-failed (请检查 Docker/Colima 和本地 pi-runtime 镜像)",
      { cause: error }
    );
  }
  const wire = JSON.parse(stdout) as { path: string; base64: string }[][];
  if (!Array.isArray(wire) || wire.length !== names.length) {
    throw new Error("runtime:sandbox-skills:invalid-collector-result");
  }
  let count = 0;
  let total = 0;
  return wire.map((files) => {
    if (!Array.isArray(files) || files.length > MAX_SKILL_BUNDLE_FILES) {
      throw new Error("runtime:sandbox-skills:count-limit");
    }
    return files.map((file) => {
      skillBundleManifestSchema.shape.files.element.shape.path.parse(file.path);
      if (
        typeof file.base64 !== "string" ||
        file.base64.length > Math.ceil(MAX_SKILL_FILE_BYTES / 3) * 4
      ) {
        throw new Error("runtime:sandbox-skills:byte-or-file-limit");
      }
      const bytes = Buffer.from(file.base64, "base64");
      count += 1;
      total += bytes.length;
      if (
        count > MAX_SKILL_BUNDLE_FILES ||
        bytes.length > MAX_SKILL_FILE_BYTES ||
        total > MAX_SKILL_BUNDLE_BYTES
      ) {
        throw new Error("runtime:sandbox-skills:byte-or-file-limit");
      }
      return { bytes, path: file.path };
    });
  });
}
