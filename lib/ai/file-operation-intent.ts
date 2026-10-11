// Conservative execution hint, not filesystem authorization. Shared by local
// classification and pure-web detection so search cannot hide a file operation.
const FILE_REFERENCE = String.raw`(?:文件|目录|磁盘|日志|[\w./\\-]+\.(?:txt|md|jsonl?|log|ya?ml|toml|xml|ini|csv|pdf|pptx?|xlsx?|docx?)\b)`;
const FILE_OPERATION = new RegExp(
  String.raw`写入|写到|写进|存入|(?:保存|存储|读取|打开|创建|新建|修改|编辑|删除|重命名|追加|覆盖|写)[^\n]{0,64}${FILE_REFERENCE}|\b(?:write|save|read|open|create|edit|delete|rename|append|overwrite)\b[^\n]{0,64}${FILE_REFERENCE}`,
  "i"
);

export function hasWorkspaceFileIntent(text: string): boolean {
  return FILE_OPERATION.test(text) || hasFileOutputIntent(text);
}

const OUTPUT_FORMAT =
  "(?:excel|xlsx?|word|docx?|powerpoint|pptx?|pdf|csv)(?![a-z])|电子表格|表格文件|工作簿|可下载(?:的)?(?:文件|附件)|文件|附件";
const OUTPUT_ACTION = String.raw`生成|输出|导出|保存|另存|整理成|转换成|转成|制作|做成|\b(?:generate|export|save|create|convert|produce|output)\b`;
const FILE_OUTPUT = new RegExp(
  String.raw`(?:${OUTPUT_ACTION})[^\n。；;!?！？]{0,96}(?:${OUTPUT_FORMAT})`,
  "i"
);
const FORMAT_OUTPUT = new RegExp(
  String.raw`(?:${OUTPUT_FORMAT})\s*(?:格式)?\s*(?:输出|导出|保存)`,
  "i"
);
const INFORMATIONAL =
  /^(?:(?:请|帮我)\s*)?(?:解释|介绍|说明|如何|怎么|怎样|explain\b|describe\b|what\b|how\b)|(?:如何|怎么|怎样).{0,12}(?:生成|输出|导出|保存|转换)/i;
const NEGATED_OUTPUT =
  /(?:不要|不用|无需|不需要|不必|别).{0,12}(?:生成|输出|导出|保存|制作)|\b(?:do not|don't|no need to)\b/i;
const INLINE_OUTPUT =
  /(?:只|仅).{0,12}(?:文本|文字|markdown|代码|脚本|聊天)|(?:csv|excel|xlsx|pdf).{0,4}(?:文本|内容|示例|代码)|\b(?:only|just)\b.{0,20}\b(?:text|code|example)\b/i;
const FILE_FOLLOW_UP =
  /^(?:请|帮我)?\s*(?:继续|接着|按刚才|按上述|按之前|照刚才|同样|再来|重新生成|再生成)|\b(?:continue|same format|try again|regenerate)\b/i;

/** 明确交付文件的动作，不把格式名称、教程或仅输出文本视为文件生成。 */
export function hasFileOutputIntent(text: string): boolean {
  return text
    .split(/[，,。；;!?！？\n]/)
    .some(
      (clause) =>
        !INFORMATIONAL.test(clause.trim()) &&
        !NEGATED_OUTPUT.test(clause) &&
        !INLINE_OUTPUT.test(clause) &&
        (FILE_OUTPUT.test(clause) || FORMAT_OUTPUT.test(clause))
    );
}

export type FileExecutionRule =
  | "file-output"
  | "workspace-file"
  | "file-follow-up";

/** 路由提示，不是授权；仅用最近用户请求判断省略文件格式的续问。 */
export function fileExecutionRule(input: {
  message: string;
  history: Array<{ role: string; text: string }>;
}): FileExecutionRule | null {
  if (hasFileOutputIntent(input.message)) {
    return "file-output";
  }
  if (FILE_OPERATION.test(input.message)) {
    return "workspace-file";
  }
  if (
    FILE_FOLLOW_UP.test(input.message.trim()) &&
    input.history
      .slice(-6)
      .filter((item) => item.role === "user")
      .slice(-1)
      .some(
        (item) =>
          hasFileOutputIntent(item.text) || FILE_OPERATION.test(item.text)
      )
  ) {
    return "file-follow-up";
  }
  return null;
}
