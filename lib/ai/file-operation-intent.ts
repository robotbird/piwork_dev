// Conservative execution hint, not filesystem authorization. Shared by local
// classification and pure-web detection so search cannot hide a file operation.
const FILE_REFERENCE = String.raw`(?:文件|目录|磁盘|日志|[\w./\\-]+\.(?:txt|md|jsonl?|log|ya?ml|toml|xml|ini|csv)\b)`;
const FILE_OPERATION = new RegExp(
  String.raw`写入|写到|写进|存入|(?:保存|存储|读取|打开|创建|新建|修改|编辑|删除|重命名|追加|覆盖|写)[^\n]{0,64}${FILE_REFERENCE}|\b(?:write|save|read|open|create|edit|delete|rename|append|overwrite)\b[^\n]{0,64}${FILE_REFERENCE}`,
  "i"
);

export function hasWorkspaceFileIntent(text: string): boolean {
  return FILE_OPERATION.test(text);
}
