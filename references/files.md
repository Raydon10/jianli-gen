# File Contract

Use these paths relative to the project root.

## Read

- `简历数据/脱敏简历/Skill读取的脱敏简历.md`
  - User-authored masked resume input for this Skill.
  - May contain variables such as `{{姓名}}`, `{{照片}}`, `{{手机}}`, `{{邮箱}}`, `{{公司}}`.
  - May contain tutorial comments starting with `//`; ignore those as instructions.

- `简历数据/简历模版/模板1.html`
- `简历数据/简历模版/模板2.html`
- `简历数据/简历模版/模板3.html`
  - Style references only.

## Write

- `简历数据/脱敏简历/Skill生成的简历.html`
  - The only generated resume output.
  - Overwrite this file on each generation.
  - The app watches this file and prompts the user with `查看最新`.

## Do Not Read For Normal Generation

- `简历数据/隐私信息/隐私信息.json`
- `简历数据/隐私信息/state.json`

These files may contain privacy state or encrypted/private data. The app handles privacy replacement in preview when the user unlocks locally.

## Local App API Names

The app uses:

- `GET/PUT /api/skill-masked-resume`
- `GET /api/skill-output`
- `GET /api/skill-output/meta`

For normal generation, prefer direct filesystem reads/writes over HTTP. Use HTTP only for troubleshooting the running app.
