/** Conservative routing hint, NOT authorization. False positives only expose
 * the explicit platform tool whitelist, never shell/filesystem/extensions.
 */
const WEB =
  /联网|网页搜索|网络搜索|搜索|检索|查找|查一下|查询|最新|最近.{0,8}(新闻|消息|动态)|\b(web|search|news|latest|platform_web_search)\b/i;
const EXECUTION_OR_INTEGRATION =
  /执行|运行|调试|部署|安装|修改|脚本|终端|命令|工作区|浏览器|插件|技能|定时|每天|每周|每月|提醒|下载|附件|生成.{0,20}(文件|ppt|excel|pdf|word)|保存.{0,20}(文件|磁盘)|读取.{0,12}(文件|目录)|\b(run|execute|debug|deploy|install|script|shell|terminal|workspace|browser|plugin|package|mcp|skill|scheduled?|download|file|folder|directory|pdf|pptx?|xlsx?|docx?|csv)\b|\.(pdf|pptx?|xlsx?|docx?|csv)\b|(^|\s)\/\w+/i;

export function isLightweightWebRequest(input: {
  message: string;
  history: Array<{ role: string; text: string }>;
  attachmentCount: number;
}): boolean {
  if (
    input.attachmentCount > 0 ||
    !WEB.test(input.message) ||
    EXECUTION_OR_INTEGRATION.test(input.message)
  ) {
    return false;
  }
  // A search embedded in an execution follow-up must not reroute to host execution.
  return !input.history
    .slice(-2)
    .some(({ text }) => EXECUTION_OR_INTEGRATION.test(text));
}
