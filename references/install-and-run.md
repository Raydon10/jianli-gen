# Install And Run

Use this when the user asks about installation, first use, or startup.

## After GitHub Skill Installation

1. Install app dependencies:
   - `cd app`
   - `npm install`
   - `npm run build`
2. Start the local server from the project root:
   - `node server/server.mjs`
3. Open the app:
   - `http://127.0.0.1:8790`

## First User Setup

Tell the user:

1. Open the browser app.
2. In `Skill 读取的脱敏简历`, enter or paste the resume that Skill should reference.
3. In `隐私信息`, fill private fields such as name, photo, phone, email, company.
4. Save before asking the Skill to generate.
5. Optionally choose a resume template visually in the app, then mention the template name when asking the Skill.

## Important

- The Skill must not open or inspect the browser page.
- If the input file is empty, ask the user to finish setup in the app and save.
- The generated output appears in the app after `Skill生成的简历.html` changes.
