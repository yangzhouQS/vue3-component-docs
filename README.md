# vue3-component-docs

基于 [Rspress](https://rspress.dev) 搭建的 Vue3 组件库文档站点，支持 **Vue3 + TSX + Less + Element Plus** 组件的「只读渲染预览」与「在线可编辑运行」。

提供两种组件示例模式：

- **`preview="iframe-follow"`**：在 iframe 沙箱中完整渲染（支持 TSX/JSX、Less、Element Plus），代码只读。
- **`playground`**：浏览器端在线编译运行，**代码可实时编辑**，支持原始 SFC（`<template>` + `<script setup>` + `<style scoped>`）。

## 特性

- 文档框架：Rspress v2（基于 Rspack，构建快）
- **只读预览**：`@rspress/plugin-preview`（iframe-follow + 自定义入口），样式与站点隔离
- **在线编辑运行**：自定义 `@rspress/plugin-playground` 渲染器，支持原始 Vue SFC、`h()` 写法，Element Plus + 图标本地预打包
- **预览操作栏**：刷新（重新运行）、全屏预览、在新标签页打开
- **全页可编辑 Playground**：`/playground-full` 路由，`el-splitter` 左右分栏（可拖动调整），左编辑器 / 右预览
- **iframe 预览依赖走自建 CDN**：vue / element-plus / 图标等通过 `externals` 排除出 bundle，运行时由 CDN 注入，加载更快
- 样式预处理：Less（变量、嵌套、`@import`）
- 站点 base 前缀可配置（子路径部署友好）
- 两个可复用插件：`pluginSfcBrowser`、`pluginPlaygroundFull`

## 环境要求

- Node.js 20.19+ / 22.12+（推荐 20 或 22 LTS）
- pnpm 10+

## 快速开始

```bash
pnpm install     # 安装依赖
pnpm dev         # 启动开发服务器（默认 http://localhost:3200）
pnpm build       # 构建生产产物到 doc_build/
pnpm preview     # 本地预览生产产物
```

## 目录结构

```text
vue3-component-docs/
├── rspress.config.ts                # 站点配置（base、CDN、插件装配）
├── playground/                      # 自定义 Playground 实现
│   ├── cdn.ts                       # CDN 地址 / externals（iframe 预览 + 新标签页共用）
│   ├── Playground.tsx               # 在线编辑渲染器（Vue3 SFC 编译 + 挂载 + 操作栏 + 新标签页）
│   ├── PlaygroundFull.tsx           # 全页可编辑 Playground（el-splitter 左右分栏）
│   └── plugins/                     # 可复用 Rspress 插件
│       ├── plugin-sfc-browser.ts    # 让 vue/compiler-sfc 使用浏览器构建
│       └── plugin-playground-full.ts# 注入 __PG_BASE__（新标签页 base 前缀）
├── theme/                           # 主题覆盖
│   ├── index.tsx                    # 复用默认主题 + 注入 global.css
│   └── global.css                   # 布局覆盖（preview 上下布局、playground 操作栏 / 全屏 / 全页样式）
├── doc/                             # 文档根目录（rspress root）
│   ├── public/logo.svg
│   ├── _nav.json
│   ├── index.mdx                    # 首页
│   ├── playground-full.mdx          # 全页 Playground 路由页
│   ├── guide/                       # 指南
│   └── components/                  # 组件文档 + 示例（_demo-*.{vue,tsx,less}）
├── .github/workflows/deploy.yml     # GitHub Pages 自动部署
├── tsconfig.json
└── package.json
```

## 两种示例模式

### 1. 只读预览 `preview="iframe-follow"`

完整渲染（TSX/JSX、Less、Element Plus），代码只读。组件需默认导出。

````mdx
```vue file="./_demo-button.vue" preview="iframe-follow"

```
````

### 2. 在线编辑 `playground`

代码可实时编辑。代码块语言须为 `tsx`（playground 仅识别 `jsx`/`tsx`），内容可为原始 SFC。

````mdx
```tsx playground
<template>
  <div style="padding: 16px">
    <el-button type="primary" @click="count++">点击 {{ count }}</el-button>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
const count = ref(0);
</script>
```
````

外部 `.vue` 文件同样可在线编辑（语言仍写 `tsx`，样式用普通 `<style>`，不可用 `lang="less"`）：

````mdx
```tsx file="./_demo-button-play.vue" playground

```
````

#### playground 操作栏

预览区右上角提供三个操作：

- 🔄 **刷新**：重新编译并重新挂载（重置响应式状态）
- ⛶ **全屏预览**：页内全屏浮层放大查看（Esc / 点空白关闭）
- ↗ **在新标签页打开**：打开 `/playground-full`，得到**全页可编辑**的 Playground（`el-splitter` 左右分栏，可拖动调整，左改右预览）

> playground 在浏览器端用 `@babel/standalone` + `vue/compiler-sfc` 实时编译。**不支持 JSX/TSX 语法**（浏览器端无 `@vue/babel-plugin-jsx`），需用 `<template>`（SFC）或 `h()` 渲染函数。需要 JSX 预览时请用 `preview="iframe-follow"`。

## 配置说明（rspress.config.ts）

```ts
// 站点 base 前缀：rspress 的 base 与「新标签页打开」共用同一值
const SITE_BASE = (() => {
  const b = process.env.BASE_PATH || '/vue-node-docs/';
  return b.endsWith('/') ? b : b + '/';
})();

export default defineConfig({
  root: path.join(import.meta.dirname, 'doc'),
  base: SITE_BASE,
  plugins: [
    // 1) 只读预览：iframe 沙箱，CDN 注入 vue/element-plus（externals 排除出 bundle）
    pluginPreview({
      defaultPreviewMode: 'iframe-follow',
      previewLanguages: ['vue', 'tsx', 'jsx'],
      iframeOptions: {
        customEntry: mountVueDemo,
        builderConfig: {
          output: { externals: previewExternals },        // CDN 全局提供
          html: { tags: previewHtmlTags },                // 注入 CDN <link>/<script>
          plugins: [pluginVue(), pluginBabel(...), pluginVueJsx(), pluginLess()],
        },
      },
    }),
    // 2) 在线编辑：自定义 Vue3 渲染器（playground/Playground.tsx）
    pluginPlayground({
      render: path.join(import.meta.dirname, 'playground/Playground.tsx'),
      include: ['vue', 'element-plus', '@element-plus/icons-vue'], // 本地预打包
      monacoLoader: { paths: { vs: '<Monaco CDN>' } },             // 国内 CDN
    }),
    // 3) 让 vue/compiler-sfc 使用浏览器构建（可复用插件）
    pluginSfcBrowser(),
    // 4) 注入新标签页的 base 前缀（可复用插件）
    pluginPlaygroundFull({ base: SITE_BASE }),
  ],
});
```

### CDN 依赖（iframe 预览）

iframe 预览的 vue / element-plus / 图标 / vue-router / axios / decimal.js 等统一在 `playground/cdn.ts` 配置：

- 通过 `externals` 排除出 bundle（`~demo` 总 JS 仅约几十 KB）；
- 运行时由 CDN `<script>` 注入全局（vue 必须在 element-plus 之前加载，保证单一 Vue 实例）；
- 主题样式来自 CDN（非 element-plus 默认 css）。

换源只需改 `cdn.ts` 中的 `CDN` / `cdnScripts` / `cdnStyles`。

## 可复用插件（`playground/plugins/`）

| 插件 | 作用 | 复用方式 |
| --- | --- | --- |
| `pluginSfcBrowser()` | 让 `vue/compiler-sfc` 使用浏览器构建，避免 Node 构建（consolidate.js）被打包，并屏蔽相关警告 | 任意装了 `vue` 的 Rspress 项目，加入 `plugins` 即可，无需参数 |
| `pluginPlaygroundFull({ base })` | 注入全局 `__PG_BASE__`（站点 base 前缀），供「新标签页打开」拼接 `/playground-full` 地址 | 传入你项目的 base |

## 关于示例中的相对导入（preview 模式）

`@rspress/plugin-preview` 会把示例虚拟化到 `node_modules/.rspress/virtual-demo/`（扁平化），因此**同级文件的相对引用（如 `import './x.less'`、Less 的 `@import`）无法解析**。处理方式：

- `.vue` 示例：Less 变量直接写在 `<style lang="less">` 内（自包含）。
- `.tsx` 示例：通过 `@` 别名引用真实 Less 文件（`import '@/components/_demo-xx.less'`）。

## 部署

构建产物为纯静态文件，输出在 `doc_build/`，可部署到任意静态托管服务。`base` 由 `SITE_BASE`（`process.env.BASE_PATH` 或 `rspress.config.ts` 默认值）控制。

### GitHub Pages

内置 `.github/workflows/deploy.yml`，推送到 `main` 即自动构建发布。手动构建：

```bash
BASE_PATH=/<你的仓库名>/ pnpm build
```

> GitHub Pages 对带 `~` 的扩展名省略路径（`~demo`）支持有限，若 iframe 预览无法加载，建议用 Vercel / Netlify。

### Vercel / Netlify

- 构建命令：`pnpm build`
- 输出目录：`doc_build`
- 根路径或自定义域名：`BASE_PATH=/`

### Nginx

```nginx
server {
    listen 80;
    server_name docs.example.com;
    root /var/www/vue3-component-docs/doc_build;
    index index.html;
    location / {
        try_files $uri $uri.html $uri/ /index.html;   # clean URL
    }
}
```

## 技术栈版本

| 依赖 | 版本 |
| --- | --- |
| @rspress/core | ^2.0.17 |
| @rspress/plugin-preview | 2.0.17 |
| @rspress/plugin-playground | 2.0.17 |
| @rsbuild/core | ~2.1.5 |
| @rsbuild/plugin-vue | 2.0.1 |
| @rsbuild/plugin-vue-jsx | 2.0.1 |
| @rsbuild/plugin-babel | ~2.0.1 |
| @rsbuild/plugin-less | 2.0.1 |
| @rsbuild/plugin-react | 2.1.0 |
| @babel/standalone | 7.22.20 |
| @vue/babel-plugin-jsx | ^3.0.0 |
| vue | ^3.5.39 |
| element-plus | ^2.14.3 |
| @element-plus/icons-vue | ^2.3.2 |
