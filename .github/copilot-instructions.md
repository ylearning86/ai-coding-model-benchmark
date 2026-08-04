# Benchmark repository instructions

- Treat `trials/A` and `trials/R1` through `trials/R4` as immutable benchmark outputs. Do not fix, format, upgrade, or refactor them unless the user explicitly requests a new experiment.
- Record newly discovered behavior in `runs/` and `evaluation/` instead of modifying generated trial code.
- Use `evidence/capture-R*-*.png`, `evidence/browser-metrics.json`, and `evidence/browser-validation.json` as the authoritative browser evidence.
- Keep model-generation AI Credit separate from evaluation, review, Code Quality, and Autofix Credit.
- Avoid duplicate scoring deductions when multiple tools report the same root cause.
- Preserve the blind IDs until a section explicitly reveals the model mapping.
- Run all four matrix jobs and CodeQL after changing workflow or evaluation logic.
- Do not commit `node_modules`, `dist`, logs, credentials, or raw screenshots superseded by authoritative evidence.
- Cite official documentation for GitHub product availability, licensing, billing, and security behavior.
- Write benchmark and blog documentation in Japanese, conclusion first, with the verification date and single-run limitations clearly stated.