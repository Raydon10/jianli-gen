export const colors = [
  "#d1495b",
  "#0077b6",
  "#2a9d8f",
  "#f77f00",
  "#7b2cbf",
  "#457b9d",
  "#bc6c25",
  "#6a994e",
  "#d00000",
  "#5a189a"
];

export const imageIconSvg = `<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5z" fill="none" stroke="currentColor" stroke-width="1.8" />
  <path d="M7.2 15.2 10 12.4l2.2 2.2 2.2-2.8 2.6 3.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="9" cy="8.2" r="1.2" fill="currentColor" />
</svg>`;

export const demoFields = [
  { key: "姓名", value: "" },
  { key: "照片", type: "photo", value: "" },
  { key: "手机", value: "" },
  { key: "邮箱", value: "" },
  { key: "公司", value: "" }
];

export const demoMarkdown = `1. 先把完整简历粘贴到“脱敏简历”里，再在“隐私信息”中填写需要隐藏的真实内容。

2. 在“隐私信息”里填写你想脱敏的内容，字段名用来标记这段内容，比如“姓名”“手机”“邮箱”“公司”。

3. 例如，姓名填写“张三”后，简历里匹配到的“张三”会自动显示成“{{姓名}}”。

4. 确认无误后点击“保存”，隐私信息会加密保存，脱敏简历会提供给 Skill 使用。

5. 输入“/”可快速输入隐私字段。
`;

export const demoSamples = [
  {
    publicMarkdown: demoMarkdown,
    fields: demoFields
  }
];

export const defaultPrivateKeys = ["姓名", "照片", "手机", "邮箱", "公司"];
