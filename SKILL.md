---
name: 简历 Gen
description: 保护隐私的简历 Skill。隐私信息加密管理，轻松生成专业简历。
---

# Jianli Gen

Generate the latest resume HTML for the Jianli Gen local app. The app stores user input in files; this Skill must work through those files and never inspect the browser UI.

## Privacy Boundary

- Do not use browser, Chrome, screenshot, or DOM tools to inspect the Jianli Gen page.
- Do not ask to unlock privacy information.
- Do not read `简历数据/隐私信息/隐私信息.json` unless the user explicitly asks for file troubleshooting. Never decrypt or infer private values.
- Generate from `简历数据/脱敏简历/Skill读取的脱敏简历.md`, which should contain masked variables such as `{{姓名}}`.
- Preserve masked variables in output. Do not replace `{{字段名}}` with guessed personal data.

## Normal Flow

1. Locate the project root. If needed, read `references/files.md`.
2. If first use or setup is requested, read `references/install-and-run.md`.
3. Ensure the local app is available or tell the user to open it and fill:
   - `Skill 读取的脱敏简历`
   - `隐私信息`
   - a template choice if desired
4. Read `简历数据/脱敏简历/Skill读取的脱敏简历.md`.
5. If the file is missing or empty, stop and tell the user to open the browser app, enter or paste the resume, save it, then ask again.
6. Choose a template:
   - Use the user-specified template when provided.
   - Otherwise use `简历数据/简历模版/模板1.html` as the default style reference.
   - For template details or management, read `references/templates.md`.
7. Generate a complete standalone A4-ready HTML resume.
8. Write only the latest output to `简历数据/脱敏简历/Skill生成的简历.html`.
9. Tell the user to return to the browser app and click `查看最新` if it appears, then preview/export there.

## Generation Rules

- Treat `Skill读取的脱敏简历.md` as the source of truth for resume content.
- Use the selected template only as style/layout reference; do not copy example personal content from templates.
- Keep all masked variables exactly as written, including photo variables like `{{照片}}`.
- If the masked resume contains `//` tutorial notes, ignore them in the final resume unless they clearly belong to resume content.
- Output must be a full HTML document with inline CSS and A4 dimensions suitable for the app preview.
- Prefer clean, professional resume language. Preserve the user's role target and facts from the masked resume.
- Generate one latest file only; do not create history files.

## Validation

After writing `Skill生成的简历.html`:

- Confirm the file exists and is non-empty.
- Confirm it contains a full HTML document.
- Confirm obvious masked variables are preserved.
- Do not open the browser to verify privacy-sensitive rendering.

## Low-Frequency References

- Installation and local app startup: `references/install-and-run.md`
- File contract and paths: `references/files.md`
- Template selection, creation, deletion: `references/templates.md`
