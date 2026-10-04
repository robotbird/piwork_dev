# 登录页设计验收

final result: passed

## 参考与证据

- 设计稿：`/var/folders/9b/8y0kwpzj4h1_wzryl7kzmbfm0000gn/T/codex-clipboard-7a3b297c-7dc4-48ab-b6b3-fce9d78c5d59.png`
- Logo：`/var/folders/9b/8y0kwpzj4h1_wzryl7kzmbfm0000gn/T/codex-clipboard-a47daf8b-c320-49cf-b165-0bc49aabb56f.png`
- 桌面：`.next/login-design-qa/desktop.png`，CSS viewport / source / screenshot 均为 1672 × 941，1×，无需密度归一化。
- 手机：`.next/login-design-qa/mobile.png`，390 × 844，1×。
- 状态：中文、未登录、浅色、空表单、无焦点。浏览器：Codex In-app Browser，http://localhost:3000/login。
- 最终设计稿与桌面截图已在同一图像比较输入中打开对照。全图中的文案、标志与输入框清晰可读，无需额外局部裁剪。

## 检查结果

- 字体与层级：复用项目字体；品牌、欢迎标题、说明、标签分级清楚，中文无截断。
- 布局：桌面保留 580px 左栏、384px 表单与右侧能力环绕图；手机单列表单，实测 scrollWidth = innerWidth = 390，无横向溢出。短桌面视口允许纵向滚动。
- 颜色：白底、浅蓝展示区、蓝色线性图标、黑色登录按钮，输入框提供蓝色键盘焦点样式。
- 资产：按用户明确要求使用 SVG；Pi 三色标志以图片 2 为准，覆盖图片 1 中的透视标志；能力图标使用现有 lucide-react SVG 图标。
- 文案：中英文消息齐全，能力标签显示技能/模型/工具/沙箱，无未解析翻译键。
- 交互：密码显示与隐藏切换正常；登录→注册→登录均可导航；首次错误凭据提交显示“邮箱或密码错误！”；提交中按钮禁用，完成后恢复。
- 控制台：修正开发期间语法错误后，再次刷新与最终交互无新增 error。历史 HMR 编译日志不作为最终页面错误。
- 静态检查：变更 TSX 与现有鉴权测试文件的 Biome check 通过；tsc --noEmit 通过；git diff --check 通过。
- 未运行完整鉴权 E2E 套件，也未使用真实账户验证成功登录。既有登录 E2E 的中文标题断言已同步。

## 对照迭代

1. 首版发现技能卡显示翻译键（P2）及左栏整体偏低（P2）。修正翻译键并调整纵向位置。
2. 编译检查发现条件渲染替换产生语法错误，已修正；Biome、TypeScript 与浏览器刷新均通过。
3. 调整右侧纵向位置与表单文案字号，重新截取桌面及手机页面并与设计稿对照，无剩余 P0/P1/P2。

## 明确的产品约束与细微差异

- 项目仅有邮箱密码登录，未添加无后端支持的 SSO 控件。
- Logo 按图片 2 保持平面几何结构；右侧底座仍为 SVG 层叠呈现。
- P3：原图中的精细光照、品牌字形与 SVG 底座的质感有轻微差异；本次为参考设计优化，不声明像素级复刻。

## 实现边界

本次仅修改 UI 与对应消息、现有测试断言；不涉及 Pi SDK API、agent loop、Runtime、数据库或身份权限边界。已确认 package.json 的 Pi 主包为 1.0.0，并阅读 docs/architecture.md 与 docs/development.md。
