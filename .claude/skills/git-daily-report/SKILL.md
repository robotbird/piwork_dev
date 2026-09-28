# Git 每日报告生成器

通过 AI 自动生成每日代码提交、变更和项目的摘要报告。

## 功能特性

- **自动分析**：扫描最近的 git 提交记录
- **智能汇总**：使用 AI 识别提交模式和重要变更
- **格式化输出**：生成 Markdown 格式的日报
- **任务集成**：可与定时任务系统配合自动发送

## 使用方法

### 基础命令

```bash
# 生成今天的日报
! git-daily-report

# 指定日期范围
! git-daily-report --since=yesterday

# 生成周报（最近 7 天）
! git-daily-report --since=7days

# 导出到文件
! git-daily-report --output=daily-report.md
```

### 在定时任务中使用

创建一个定时任务每天早上 9 点生成并发送日报：

```typescript
// 定时任务配置
{
  taskType: "git_daily_report",
  prompt: "请分析昨天的 git 提交记录，生成一份详细的项目日报",
  schedule: {
    cron: "0 9 * * *",  // 每天早上 9 点
    timezone: "Asia/Shanghai"
  }
}
```

## 报告内容

生成的日报包含以下部分：

1. **概览统计**
   - 提交次数
   - 涉及文件数
   - 新增/修改/删除的代码行数

2. **主要变更**
   - 新功能开发
   - Bug 修复
   - 重构和优化

3. **关键提交详情**
   - 重要的 commit message
   - 相关文件变更摘要

4. **建议与提醒**
   - 需要关注的代码质量
   - 待完成的任务
   - 依赖更新提醒

## 自定义配置

可以通过环境变量调整报告风格：

```bash
export GIT_DAILY_REPORT_STYLE=concise  # 简洁模式
export GIT_DAILY_REPORT_STYLE=detailed  # 详细模式（默认）
export GIT_DAILY_REPORT_LANG=zh  # 中文（默认）
export GIT_DAILY_REPORT_LANG=en  # 英文
```

## 依赖

- Git CLI（必须安装在系统中）
- Node.js 18+
- TypeScript/ESM支持
