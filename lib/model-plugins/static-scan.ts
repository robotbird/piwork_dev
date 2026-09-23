import { PluginPackageError } from "./contract";

/**
 * 源码静态扫描：在构建与加载之前拒绝危险构造（§6.1 第 4 步）。
 * 覆盖 Node 内置模块、动态加载、进程访问与环境变量读取。
 */
const FORBIDDEN_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\bchild_process\b/, reason: "child_process is not allowed" },
  { pattern: /\bworker_threads\b/, reason: "worker_threads is not allowed" },
  {
    pattern: /(^|[^.\w])fs(?=[\s/'"]|$)|node:fs|fs\/promises/,
    reason: "filesystem access is not allowed",
  },
  {
    pattern: /\bnode:os\b|\bos\.homedir\b/,
    reason: "os module access is not allowed",
  },
  { pattern: /\brequire\s*\(/, reason: "require() is not allowed" },
  { pattern: /\beval\s*\(/, reason: "eval() is not allowed" },
  { pattern: /new\s+Function\s*\(/, reason: "new Function() is not allowed" },
  {
    pattern: /(?<![\w.])import\s*\(/,
    reason: "dynamic import() is not allowed",
  },
  {
    pattern: /process\.env\b/,
    reason: "reading process.env is not allowed; use injected context",
  },
  {
    pattern: /process\.exit\b|process\.binding\b/,
    reason: "process control is not allowed",
  },
  {
    pattern: /__dirname|__filename/,
    reason: "filesystem paths are not allowed",
  },
  { pattern: /\bvm\b\s*\./, reason: "vm module is not allowed" },
];

export function staticScanSources(
  sources: Iterable<[path: string, text: string]>
): void {
  for (const [path, text] of sources) {
    for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
      if (pattern.test(text)) {
        throw new PluginPackageError(
          "static_scan_failed",
          `${path}: ${reason}`
        );
      }
    }
  }
}
