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
  { key: "姓名", value: "张明远" },
  { key: "年龄", value: "29" },
  { key: "手机", value: "13812345678" },
  { key: "邮箱", value: "mingyuan.zhang@example.com" },
  { key: "城市", value: "上海" },
  { key: "公司", value: "云启科技" }
];

export const demoMarkdown = `# 张明远

上海 | 13812345678 | mingyuan.zhang@example.com

## 求职目标

后端工程师，期望加入重视工程质量、系统稳定性和产品迭代效率的团队。

## 个人总结

29 岁，5 年后端开发经验，目前在云启科技负责订单系统和数据同步服务。熟悉 Java、Spring Boot、MySQL、Redis 和消息队列，关注高并发场景下的可观测性和故障恢复。

## 工作经历

### 云启科技｜后端工程师｜2021.06 - 至今

- 负责订单核心链路改造，将高峰期接口 P95 延迟从 680ms 降至 210ms。
- 设计库存同步任务的幂等机制，减少重复扣减和人工对账成本。
- 推动服务日志结构化，提升线上问题定位效率。

### 星河软件｜Java 开发工程师｜2019.07 - 2021.05

- 参与 CRM 客户画像模块开发，支持销售团队按行业、规模和活跃度筛选客户。
- 编写接口自动化测试，覆盖主要客户管理流程。

## 技能

- Java / Spring Boot / MySQL / Redis / Kafka
- REST API 设计、微服务治理、性能优化
- Git、Docker、Linux 基础运维`;

export const demoSamples = [
  {
    publicMarkdown: demoMarkdown,
    fields: demoFields
  },
  {
    publicMarkdown: `# 李薇

杭州 | 18600001111 | liwei@example.com

## 求职目标

前端工程师，关注设计实现一致性、性能和可维护性。

## 个人总结

6 年前端开发经验，熟悉组件化架构、设计系统和复杂表单交互。

## 工作经历

### 星图科技｜前端工程师｜2020.03 - 至今

- 搭建统一组件库，覆盖业务后台核心交互。
- 优化首屏加载和表单响应速度。
- 推动设计稿交付标准化。

## 技能

- TypeScript / React / CSS / Node.js
- 组件设计、性能优化、工程化`,
    fields: [
      { key: "姓名", value: "李薇" },
      { key: "年龄", value: "31" },
      { key: "手机", value: "18600001111" },
      { key: "邮箱", value: "liwei@example.com" },
      { key: "城市", value: "杭州" },
      { key: "公司", value: "星图科技" }
    ]
  },
  {
    publicMarkdown: `# 王浩

深圳 | 13900002222 | wanghao@example.com

## 求职目标

全栈工程师，偏向业务交付与系统整合。

## 个人总结

8 年开发经验，熟悉前后端联调、接口设计和多角色后台系统。

## 工作经历

### 云脉信息｜全栈工程师｜2018.09 - 至今

- 负责客户运营平台和审批流系统。
- 协调前后端接口协议与上线节奏。
- 支持核心页面性能优化与问题排查。

## 技能

- JavaScript / TypeScript / Vue / Node.js / PostgreSQL
- 接口设计、业务建模、系统联调`,
    fields: [
      { key: "姓名", value: "王浩" },
      { key: "年龄", value: "34" },
      { key: "手机", value: "13900002222" },
      { key: "邮箱", value: "wanghao@example.com" },
      { key: "城市", value: "深圳" },
      { key: "公司", value: "云脉信息" }
    ]
  }
];

export const defaultPrivateKeys = ["姓名", "手机", "邮箱"];
