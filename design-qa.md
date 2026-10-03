# Sandbox MVP 设计验收

最终结果：通过（本次 MVP 范围）。

参考：用户提供的 Sandbox 列表与详情设计稿。桌面按 1672×941 与参考图并排检查；移动端按 375×812 检查。

- 列表包含搜索、四类状态筛选、选中行、资源额度、到期时间和详情入口。
- 桌面右侧详情展示基本信息、运行配置、安全基线及固定底部操作；移动端使用全屏详情，长 ID 换行或截断，内容可滚动。
- 续期成功已在浏览器核验；销毁确认与取消、只读任务入口已核验。真实销毁、暂停状态、续期及管理员权限通过 HTTP 集成验证。
- 状态每 10 秒向 Provider 核验；服务不可用显示同步失败，不伪造销毁状态。
- 沿用项目现有侧栏、字体、组件和真实 ID；CPU/内存展示配置额度，尚不展示实时用量。OpenSandbox 安全信息按实际能力展示。

范围内未发现阻断功能或布局的问题。OpenSandbox 真实服务验收仍需配置连接地址和密钥。

验收截图：

- 桌面：`/Users/robotbird/.codex/visualizations/2026/10/03/01a0ff87-b31c-74a2-aefc-220e5b3e6c10/sandbox-mvp-desktop.jpg`
- 手机：`/Users/robotbird/.codex/visualizations/2026/10/03/01a0ff87-b31c-74a2-aefc-220e5b3e6c10/sandbox-mvp-mobile.jpg`
