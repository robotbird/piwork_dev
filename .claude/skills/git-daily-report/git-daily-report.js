#!/usr/bin/env node

/**
 * Git 每日报告生成器
 *
 * 用法:
 *   node git-daily-report.js [选项]
 *
 * 选项:
 *   --since=<日期>      起始日期 (默认：昨天)
 *                      支持格式：YYYY-MM-DD, yesterday, last_week, Ndays
 *   --output=<文件>     输出到文件 (默认：stdout)
 *   --lang=<语言>       报告语言 (zh|en, 默认：zh)
 *   --style=<风格>      报告风格 (concise|detailed, 默认：detailed)
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    since: 'yesterday',
    output: null,
    lang: 'zh',
    style: 'detailed'
  };

  for (const arg of args) {
    if (arg.startsWith('--since=')) {
      options.since = arg.split('=')[1];
    } else if (arg.startsWith('--output=')) {
      options.output = arg.split('=')[1];
    } else if (arg.startsWith('--lang=')) {
      options.lang = arg.split('=')[1];
    } else if (arg.startsWith('--style=')) {
      options.style = arg.split('=')[1];
    }
  }

  return options;
}

// 获取日期字符串
function getDateSince(sinceStr) {
  if (sinceStr === 'yesterday') {
    const today = new Date();
    today.setDate(today.getDate() - 1);
    return today.toISOString().split('T')[0];
  }

  if (sinceStr.endsWith('days')) {
    const days = parseInt(sinceStr.replace('days', ''));
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }

  if (sinceStr === 'last_week') {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(today);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().split('T')[0];
  }

  // 直接使用传入的日期
  return sinceStr;
}

// 获取 git 日志
function getGitLog(sinceDate) {
  try {
    const cmd = `git log --since="${sinceDate}" --pretty=format:"%h|%an|%ad|%s" --date=short --numstat`;
    const output = execSync(cmd, { encoding: 'utf-8' });
    return parseGitLog(output);
  } catch (error) {
    console.error('获取 git 日志失败:', error.message);
    return [];
  }
}

// 解析 git 日志
function parseGitLog(logOutput) {
  const commits = [];
  let currentCommit = null;

  const lines = logOutput.split('\n');
  for (const line of lines) {
    if (line.includes('|') && line.split('|').length === 4) {
      // 新的 commit
      if (currentCommit) {
        commits.push(currentCommit);
      }
      const [hash, author, date, message] = line.split('|');
      currentCommit = { hash, author, date, message, changes: [] };
    } else if (line.trim() && currentCommit) {
      // 文件变更统计
      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        const added = parts[0] === '-' ? 0 : parseInt(parts[0]);
        const removed = parts[1] === '-' ? 0 : parseInt(parts[1]);
        const file = parts.slice(2).join(' ');
        currentCommit.changes.push({ file, added, removed });
      }
    }
  }

  if (currentCommit) {
    commits.push(currentCommit);
  }

  return commits;
}

// 生成报告（中文）
function generateChineseReport(commits) {
  const today = new Date().toISOString().split('T')[0];

  // 统计信息
  let totalCommits = commits.length;
  let totalAdded = 0;
  let totalRemoved = 0;
  const files = new Set();
  const categories = {
    features: [],
    fixes: [],
    refactor: [],
    other: []
  };

  // 分类提交
  for (const commit of commits) {
    const msg = commit.message.toLowerCase();

    if (msg.includes('feat') || msg.includes('feature') || msg.includes('添加') || msg.includes('新增')) {
      categories.features.push(commit);
    } else if (msg.includes('fix') || msg.includes('bug') || msg.includes('修复') || msg.includes('解决')) {
      categories.fixes.push(commit);
    } else if (msg.includes('refactor') || msg.includes('重构') || msg.includes('优化') || msg.includes('improve')) {
      categories.refactor.push(commit);
    } else {
      categories.other.push(commit);
    }

    // 统计文件变更
    for (const change of commit.changes) {
      totalAdded += change.added;
      totalRemoved += change.removed;
      files.add(change.file);
    }
  }

  // 构建报告
  let report = `## 📊 ${today} Git 每日报告\n\n`;

  report += `### 📈 概览\n`;
  report += `- **提交次数**: ${totalCommits}\n`;
  report += `- **涉及文件**: ${files.size}\n`;
  report += `- **新增代码**: ${totalAdded} 行\n`;
  report += `- **删除代码**: ${totalRemoved} 行\n\n`;

  // 功能开发
  if (categories.features.length > 0) {
    report += `### ✨ 新功能开发\n\n`;
    for (const commit of categories.features) {
      report += `- \`${commit.hash}\` ${commit.message}\n`;
    }
    report += `\n`;
  }

  // Bug 修复
  if (categories.fixes.length > 0) {
    report += `### 🐛 Bug 修复\n\n`;
    for (const commit of categories.fixes) {
      report += `- \`${commit.hash}\` ${commit.message}\n`;
    }
    report += `\n`;
  }

  // 重构优化
  if (categories.refactor.length > 0) {
    report += `### 🔧 重构和优化\n\n`;
    for (const commit of categories.refactor) {
      report += `- \`${commit.hash}\` ${commit.message}\n`;
    }
    report += `\n`;
  }

  // 其他变更
  if (categories.other.length > 0) {
    report += `### 📝 其他变更\n\n`;
    for (const commit of categories.other.slice(0, 5)) {  // 只显示前 5 个
      report += `- \`${commit.hash}\` ${commit.message}\n`;
    }
    if (categories.other.length > 5) {
      report += `- ... 还有 ${categories.other.length - 5} 个提交\n`;
    }
    report += `\n`;
  }

  // 热门文件
  const fileStats = {};
  for (const commit of commits) {
    for (const change of commit.changes) {
      if (!fileStats[change.file]) {
        fileStats[change.file] = { added: 0, removed: 0 };
      }
      fileStats[change.file].added += change.added;
      fileStats[change.file].removed += change.removed;
    }
  }

  const sortedFiles = Object.entries(fileStats)
    .sort((a, b) => (b[1].added + b[1].removed) - (a[1].added + a[1].removed))
    .slice(0, 5);

  if (sortedFiles.length > 0) {
    report += `### 📁 高频变更文件\n\n`;
    for (const [file, stats] of sortedFiles) {
      report += `- \`${file}\`: +${stats.added} / -${stats.removed}\n`;
    }
    report += `\n`;
  }

  return report;
}

// 生成报告（英文）
function generateEnglishReport(commits) {
  const today = new Date().toISOString().split('T')[0];

  let totalCommits = commits.length;
  let totalAdded = 0;
  let totalRemoved = 0;
  const files = new Set();
  const categories = {
    features: [],
    fixes: [],
    refactor: [],
    other: []
  };

  for (const commit of commits) {
    const msg = commit.message.toLowerCase();

    if (msg.includes('feat') || msg.includes('feature')) {
      categories.features.push(commit);
    } else if (msg.includes('fix') || msg.includes('bug')) {
      categories.fixes.push(commit);
    } else if (msg.includes('refactor') || msg.includes('improve')) {
      categories.refactor.push(commit);
    } else {
      categories.other.push(commit);
    }

    for (const change of commit.changes) {
      totalAdded += change.added;
      totalRemoved += change.removed;
      files.add(change.file);
    }
  }

  let report = `## 📊 ${today} Git Daily Report\n\n`;

  report += `### 📈 Overview\n`;
  report += `- **Commits**: ${totalCommits}\n`;
  report += `- **Files Changed**: ${files.size}\n`;
  report += `- **Lines Added**: ${totalAdded}\n`;
  report += `- **Lines Removed**: ${totalRemoved}\n\n`;

  if (categories.features.length > 0) {
    report += `### ✨ New Features\n\n`;
    for (const commit of categories.features) {
      report += `- \`${commit.hash}\` ${commit.message}\n`;
    }
    report += `\n`;
  }

  if (categories.fixes.length > 0) {
    report += `### 🐛 Bug Fixes\n\n`;
    for (const commit of categories.fixes) {
      report += `- \`${commit.hash}\` ${commit.message}\n`;
    }
    report += `\n`;
  }

  if (categories.refactor.length > 0) {
    report += `### 🔧 Refactoring & Improvements\n\n`;
    for (const commit of categories.refactor) {
      report += `- \`${commit.hash}\` ${commit.message}\n`;
    }
    report += `\n`;
  }

  if (categories.other.length > 0) {
    report += `### 📝 Other Changes\n\n`;
    for (const commit of categories.other.slice(0, 5)) {
      report += `- \`${commit.hash}\` ${commit.message}\n`;
    }
    report += `\n`;
  }

  const fileStats = {};
  for (const commit of commits) {
    for (const change of commit.changes) {
      if (!fileStats[change.file]) {
        fileStats[change.file] = { added: 0, removed: 0 };
      }
      fileStats[change.file].added += change.added;
      fileStats[change.file].removed += change.removed;
    }
  }

  const sortedFiles = Object.entries(fileStats)
    .sort((a, b) => (b[1].added + b[1].removed) - (a[1].added + a[1].removed))
    .slice(0, 5);

  if (sortedFiles.length > 0) {
    report += `### 📁 Most Modified Files\n\n`;
    for (const [file, stats] of sortedFiles) {
      report += `- \`${file}\`: +${stats.added} / -${stats.removed}\n`;
    }
  }

  return report;
}

// 主函数
function main() {
  const options = parseArgs();

  console.log(`🔍 正在分析 Git 提交记录...`);
  console.log(`   起始日期：${options.since}`);
  console.log(`   语言：${options.lang}`);
  console.log(`   风格：${options.style}\n`);

  const sinceDate = getDateSince(options.since);
  const commits = getGitLog(sinceDate);

  if (commits.length === 0) {
    console.log('📭 没有找到相关的提交记录');
    return;
  }

  console.log(`✅ 找到 ${commits.length} 个提交\n`);

  const report = options.lang === 'en'
    ? generateEnglishReport(commits)
    : generateChineseReport(commits);

  if (options.output) {
    writeFileSync(options.output, report);
    console.log(`📄 报告已保存到：${options.output}`);
  } else {
    console.log(report);
  }
}

main();
