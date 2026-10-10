---
name: sandbox-script
description: Generate a small report by executing a bundled Node script and reading its assets and references.
---

Read references/usage.txt relative to this Skill directory. Run `node <this-skill-directory>/scripts/report.mjs` from the workspace. The script reads assets/value.txt and references/usage.txt and creates skill-result.txt in the current working directory. Read back that output. Deliver it with deliver_file when a download is requested. Do not install dependencies.
