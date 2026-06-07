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

export const demoMarkdown = `// 在这里输入或粘贴你想脱敏且用于 AI 参考的简历，在右侧“隐私信息”模块对相关信息进行脱敏，字段值会进行加密，任何人无法读取。
// 例如：在右侧填写真实姓名后，这里使用 {{姓名}}；保存后 Skill 只能读取脱敏变量。

# {{姓名}}

{{照片}}

{{手机}} | {{邮箱}}

## 求职目标

应聘 AI 布道师，负责 AI 产品宣讲、客户演示、用户培训和落地案例沉淀。

## 个人总结

我擅长把复杂的 AI 能力转化为业务团队听得懂、能执行的工作流，曾在 {{公司}} 负责 AI 产品培训、场景演示和客户落地支持。

## 工作经历

### AI 产品布道 / 客户培训

- 设计 AI 产品演示脚本，帮助销售、客户成功和业务团队快速理解产品价值。
- 面向企业客户组织培训，讲解提示词、工作流和知识库等核心能力。
- 收集一线用户反馈，整理成产品优化建议和模板案例。
- 将典型业务场景沉淀为可复用的演示材料和操作指南。

## 项目经历

### 企业 AI 助手落地示例

- 梳理客服、销售、运营等岗位的高频任务，设计 AI 使用路径。
- 将复杂功能拆解成简单步骤，降低非技术用户的上手门槛。
- 输出培训文档、演示视频脚本和内部推广材料。

## 技能

- AI 产品演示与培训
- 业务场景梳理
- 提示词设计
- 用户反馈整理
- 案例写作与内容表达`;

export const demoSamples = [
  {
    publicMarkdown: demoMarkdown,
    fields: demoFields
  }
];

export const defaultPrivateKeys = ["姓名", "照片", "手机", "邮箱", "公司"];
