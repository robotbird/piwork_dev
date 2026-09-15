---
name: "weekly-report"
description: "Generate a structured weekly work report (周报) from the user's raw input of the week's work items. Use when the user asks to write, draft, or polish a weekly report, work summary, or 周报 based on notes, bullet points, or a casual description of what they did."
---

# Weekly Report Generator (周报生成)

Turn the user's raw, unstructured input about their week into a clean, professional weekly report.

## When to use
- User says: "帮我写周报", "根据这些内容写周报", "生成周报", "写个周报"
- User provides notes, bullet points, chat logs, or a casual description of their week's work.

## Workflow

1. **Parse the input.** Extract and classify every work item into:
   - 已完成 (Completed) — finished this week
   - 进行中 (In progress) — started but not finished
   - 下周计划 (Next week plan) — follow-ups and upcoming work
   - 问题与风险 (Issues & risks) — blockers, dependencies, delays

   If the user's input mixes categories, infer the category from tense and wording (past tense → 已完成; 正在/继续 → 进行中; 计划/准备 → 下周计划; 遇到/阻塞 → 问题与风险).

2. **Fill gaps with reasonable assumptions.** Do NOT ask clarifying questions unless the input is completely empty. If a section has no content, write "无" or omit it depending on relevance. If scope is unclear, ask only one focused question when truly necessary.

3. **Write the report** using this default template (adjust section names if the user specifies a format):

```
# 周报（{起止日期或第X周}）

## 一、本周工作总结
1. 【项目/事项】具体成果 + 量化数据（如：完成了X，提升了Y%）
2. ...

## 二、进行中的工作
1. 【事项】当前进度（约X%），预计完成时间
2. ...

## 三、问题与风险
1. 【问题】影响 + 需要的支持/资源
2. ...

## 四、下周工作计划
1. 【事项】目标 + 预期产出
2. ...
```

## Writing rules
- **成果导向**: Convert activities into outcomes. "开了三次会" → "推进了X方案评审，完成决策对齐".
- **量化**: Add numbers, percentages, dates, or scope whenever inferable from input. If not inferable, keep it qualitative rather than inventing fake data.
- **简洁**: Each item one line, start with a verb (完成/推进/优化/定位/输出/落地).
- **专业中性**: No first-person filler like "我觉得", no emotional language.
- **不编造关键事实**: Never fabricate concrete numbers, names, or dates that the user did not provide. Mark placeholders as `【待补充】` if a critical fact is missing.

## Output
- Return the report in Markdown, ready to copy-paste.
- Keep it tight: 5–12 items total unless the user provides a lot of material.
- If the user gives a specific format or template, follow theirs instead of the default.
