# 附件上传大小配置

日期：2026-10-13。状态：已实现并验证，本地开发数据库已迁移，未部署生产。

## 需求与范围

管理员在后台「通用设置」管理全平台单文件上传大小上限。默认 100 MB，可设为 1–100 的整数；MB 在现有文件链路中按 1024 × 1024 字节计算。配置覆盖聊天附件上传、文档库上传、项目资料上传。普通成员只能读取公开限额，不能修改。

配置只约束新上传，不追溯禁止已有文件的查看、下载、聊天选择。项目从文档库导入会调用 sources 新上传入口，因此按最新限额校验。图片合计 8 MB、最多 5 张、项目提取文本单份 2 MiB/总计 8 MiB、非生产 Durable 附件单份 20 MB/合计 50 MB 等处理限制保持不变；上传成功不代表所有处理路径都支持同等大小。

## 界面与交互

2026-10-13 按用户当前 Chrome 中的 ChatGPT 账户设置页（https://chatgpt.com/settings/account）调整：主内容最大宽度 768px，页面标题 24px/32px、分组标题 16px/24px、行标签/控件 14px/20px、辅助文案 12px/20px。语言与外观合并为「界面偏好」分组，使用轻边框、组内分隔线与紧凑设置行；桌面标签在左、控件在右，窄屏上下排列。沿用项目字体与语义 token。

字段「单个文件大小上限」，按用户要求移除适用范围和处理限额两段说明，不再在表单显示。范围提示保留为输入框的无障碍说明，非法值时显示可见错误。控件有明确 label、关联说明和错误信息；仅整数 1–100，空值/0/小数/超限均拒绝。数字控件右侧并排「保存更改」；无修改、加载或保存中禁用。加载失败显示可重试错误，不把默认值伪装成已保存值。保存失败保留输入；成功更新当前值，Toast 提示对新上传生效。

用户上传页面从公开限额接口读取提示，共享 hook 每 30 秒及重新聚焦时重新获取；保存方同步更新本地缓存，服务端新请求直接读数据库。前端可预检文件大小，服务端始终按最新数据库配置检查；旧页面缓存或在途请求不会绕过服务端限额。配置加载失败时不使用一个猜测限额阻断合法文件，可继续由服务端校验，并避免展示虚假数值。

## 持久化与接口

- 新增 UploadSettings 单例（id=default），maxFileSizeMB、updatedAt、updatedBy；updatedBy 关联 User，删除用户置空。记录最后修改信息，不宣称不可变审计。
- lib/uploads/settings.ts 持有纯 schema/默认值/字节转换；lib/db/upload-settings-queries.ts 复用 getDb()，读取/原子 upsert。不缓存数据库策略；无配置行才使用默认 100，数据库故障或非法存量拒绝，不能静默回退。
- GET/PATCH /api/admin/upload-settings：复用 requireAdminRole，仅正式启用管理员；PATCH 严格校验，400 非法值、503 存储故障；不向普通成员暴露修改信息。
- GET /api/upload-settings：正式启用成员读取 maxFileSizeMB，private/no-store。
- /api/files/upload 与 /api/projects/:id/sources 在身份/归属验证后、读取 multipart 字节前取得策略，超限返回含实际限额的国际化错误；读取故障 503。
- 既有 LibraryItem attachment 选择及 Runtime 下载仍使用部署硬上限 100 MB，避免降低上传配置后旧文件突然失效。不新增 Pi 工具、loop 或 RuntimeSpec 字段。

## 部署上限

Next.js 16.2.10 experimental.proxyClientMaxBodySize 固定 128mb，为最大 100 MiB 文件和 multipart 封装留余量。后台不修改此启动配置，也不允许填写超过 100 MB。外部反向代理必须支持相同请求体；上线需要迁移及重启，不代表本轮已部署。

## 官方依据

[Next.js 官方 proxyClientMaxBodySize 文档](https://nextjs.org/docs/app/api-reference/config/next-config-js/proxyClientMaxBodySize)及已安装 dist/server/config-shared.d.ts/config.js 确认 10 MB 默认值、新参数及单位解析。Pi 包版本为 1.2.0；已核对安装包 docs/sdk.md 和 docs/message-types.md，此功能仅平台上传准入，不改变官方 prompt/images、工具执行、RPC 或 Durable 调度行为。

## 验收

1. 默认值、1/100 边界、非整数/非数字/额外字段拒绝。
2. 独立数据库 schema 验证默认读取、upsert、修改人/时间、热读取及存储故障传播。
3. 独立 Next/身份/schema HTTP 验证管理员保存、成员/禁用身份拒绝、普通成员读取；聊天/文档库/项目超限拒绝，既有文件在降低配置后仍可下载及选择。
4. 浏览器验证加载、保存、非法值、失败保留、窄屏布局；不调用真实模型，不修改日常项目或全平台现有配置。
5. 保留超过 10 MB 的 multipart 回归，验证请求不会再被 Proxy 截断；不做容量测试。

## 实施与验证结果

已实现上述界面、单例存储、权限 API、动态上传校验与国际化提示。语言/外观设置行同时补齐移动端上下排列，避免控件挤压。通用上传准入与 Durable 处理上限分离，新增回归验证下载/水合参数仍保持原有边界。

2026-10-13：29 项相关单元/独立 DB/国际化测试通过；独立 Next HTTP 回归通过，包含旧 10 MiB 截断、100 MiB + 1 字节拒绝、管理员/成员/禁用身份、即时降额、精确 1 MiB 边界、已有文件访问、DB 故障 503。Chromium 验证加载、非法值、保存、保存失败保留输入、加载失败重试及 390px 布局通过。类型与 Biome 检查通过。截图在 artifacts/upload-settings-qa/desktop.png、mobile.png。

迁移 0023 已应用到本地 localhost/piwork 开发数据库；未修改生产配置、未部署生产，不含真实模型或容量验收。HTTP 夹具使用 IPv4 请求、localhost 浏览器、独立 schema/Next dist/上传目录，禁用定时调度和外部 Blob 写入；临时构建放在忽略的 .next 下，成功清理自己的夹具，失败日志保留。

界面精简仅修改布局、字体与展示文案；上传准入、默认值、权限、持久化、已有文件访问和 Runtime 处理规则保持原行为。参考截图含账户信息，仅存本机临时目录，不纳入仓库。此处样式数值来自参考截图与项目规范，不声明逐项读取 ChatGPT computed style 或完整像素克隆。
