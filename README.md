# 简历 Gen

一个保护隐私的简历生成 Skill。你可以把真实姓名、电话、邮箱、照片、公司名称等信息单独保存，只让 Skill 读取脱敏后的简历内容，再生成可预览、可导出的专业简历 PDF。

## 适合场景

- 用同一份简历内容生成不同风格的简历
- 根据 JD 改写简历，但保留真实经历和脱敏变量
- 不希望把隐私信息直接暴露在简历正文或对话里
- 需要在网页里预览简历，并导出为 PDF

## 安装

将这个仓库作为 Codex Skill 安装或放到本地 Skill 目录后，先安装网页应用依赖：

```bash
cd app
npm install
npm run build
```

从项目根目录启动本地服务：

```bash
node server/server.mjs
```

然后打开：

```text
http://127.0.0.1:8790
```

## 使用流程

1. 在网页里填写或粘贴 `Skill 读取的脱敏简历`。
2. 在 `隐私信息` 中保存姓名、照片、手机、邮箱、公司等真实信息。
3. 选择一个简历模板。
4. 让 Codex 使用 `$jianli-gen` 生成简历。
5. 回到网页点击 `查看最新`，预览满意后导出 PDF。

## 隐私说明

Skill 正常生成时只读取脱敏简历和模板，不读取隐私信息文件。隐私信息由本地网页应用在需要时处理，生成结果会保留 `{{姓名}}`、`{{手机}}` 这类变量或在本地预览时替换。

请不要把真实隐私信息直接写进脱敏简历正文。

## 更新

如果你通过 GitHub 安装这个 Skill，更新时拉取或重新安装仓库的最新版本即可。更新后建议重新启动本地服务，并开启一个新的 Codex 会话，让 Skill 元数据和说明重新加载。

```bash
git pull
npm --prefix app install
npm --prefix app run build
node server/server.mjs
```

## 仓库

[Raydon10/jianli-gen](https://github.com/Raydon10/jianli-gen)
