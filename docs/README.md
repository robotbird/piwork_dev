# 项目文档导航

本文档目录按**当前实现**、**开发规范**、**设计与规划**、**历史研究**区分。功能状态以代码与 `package.json` 为准；规划文档不能当作已经上线的能力。

| 文档 | 用途 | 状态 |
| --- | --- | --- |
| [项目架构](architecture.md) | 模块职责、运行链路、数据边界、当前状态 | 当前实现；新开发先读 |
| [聊天业务链路与 RPC](rpc-business-flow.md) | 从用户输入到模型回复；RPC 与 HTTP、Provider 的关系 | 当前实现与已实现适配器分开说明 |
| [平台与 Runtime 演进架构](platform-runtime-roadmap.md) | Web → Worker/Sandbox → 未来 Desktop 的目标边界与分期 | 目标架构；含现有代码映射和验收条件 |
| [开发与测试](development.md) | 目录约定、测试位置和验证命令 | 当前规范 |
| [运行手册](operations.md) | 本地/单机启动顺序与命令、健康检查、日常维护、已知故障处置 | 当前实现；组件/配置变化时同步维护 |
| [Pi Package 与 Runtime 架构](pi-plugin-support-research.md) | Package、RPC、Sandbox 的分阶段目标设计 | 含已实现步骤与后续规划；逐节核对状态 |
| [Pi Durable 评估与采用门禁](pi-durable-evaluation.md) | 恢复/提交去重/replay 边界、现原型差口、Worker 内试点与升级回滚门禁 | 评估与计划；现原型不提供生产耐久执行承诺 |
| [OpenSandbox 接入 Spec](opensandbox-integration-spec.md) | SandboxProvider 分阶段接入、选型审计与安全基线映射 | Phase 0–4 完整落地；Phase 5 MVP 落地（路由矩阵 + 冷启动达标，未落地项见 §6）；契约 §7 为落地版；含对外部分析的逐条裁决 |
| [千人企业 MVP 与沙箱执行面实施方案](sandbox-execution-surface-design.md) | 工具级沙箱、运行契约、私有交付/幂等、预算/reaper、安全、单 Worker、Durable 试点；含工作包/验收/回滚 | 已开始基础组件实现，未接生产；先 P0–P3，再生产 Durable 试点 |
| [Runtime 基础实施记录](runtime-foundation-implementation.md) | DTO/状态/lazy/限额文件、tools 后端适配/私有交付、MVP 1～9 进度与验证 | 协议适配与 Docker 契约已落地；生产账本/权限/治理/Worker 等仍待完成，不做容量测试 |
| [模型供应商插件架构](model-provider-plugin-architecture.md) | 插件方案与设计背景 | 原始草案，部分版本和阶段描述已过时；以项目架构和代码为准 |
| [Skill 执行安全方案](security/skill-execution-security-plan.md) | 威胁模型与安全目标 | 规划；文件头说明已被后续设计取代的部分 |
| [界面设计规范](design-system/openai-unified-interface/design-spec.md) | 界面参考及 token | 设计资料 |
| [Pi 插件调研 v1.7](archive/pi-plugin-research-v1.7.md) | 历史研究、实验和迁移证据 | 归档；旧版本陈述不可直接套用 |

根目录的 `DESIGN.md` 是现有视觉设计规范，`design-qa.md` 是界面验收记录；二者保留在原位并从这里索引。项目入口见 [README](../README.md)，后续编码规则见 [AGENTS.md](../AGENTS.md)。

更新规则：改动跨模块调用、状态归属或持久化边界时，同步更新 `architecture.md`；改动目录或测试命令时，同步更新 `development.md` 与 `AGENTS.md`；改动组件、端口、启动命令或运行配置时，同步更新 `operations.md`。研究草案若与实现不一致，应加状态说明，保留历史判断，不静默改写为已实现。
