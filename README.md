# vue3-component-docs

基于 [Rspress](https://rspress.dev) 搭建的组件库文档站点，支持 **Vue3 + TSX + Less + Element Plus** 组件的预览与渲染。

组件示例通过 `@rspress/plugin-preview` 在独立的 iframe 沙箱中渲染，与文档站点样式完全隔离，Element Plus 已在预览环境全局注册。

## 特性

- 文档框架：Rspress v2（基于 Rspack，构建快）
- 组件预览：`@rspress/plugin-preview`（`iframe-follow` 模式 + 自定义入口）
- 组件渲染：Vue 3，同时支持 `.vue` 单文件组件与 `.tsx`
- TSX 支持：`@rsbuild/plugin-vue-jsx` + `@vue/babel-plugin-jsx`
- 样式预处理：`@rsbuild/plugin-less`（变量、嵌套、`@import`）
- UI 组件库：Element Plus（预览环境全局注册）
- 在线编辑：`@rspress/plugin-playground`（可选）

## 环境要求

- Node.js 20.19+ / 22.12+（推荐 20 或 22 LTS）
- pnpm 10+

## 快速开始

```bash
pnpm install     # 安装依赖
pnpm dev         # 启动开发服务器（默认 http://localhost:8080）
pnpm build       # 构建生产产物到 doc_build/
pnpm preview     # 本地预览生产产物
```

## 目录结构

```text
vue3-component-docs/
├── rspress.config.ts          # 站点 + 预览插件配置（核心）
├── doc/                       # 文档根目录（rspress root）
│   ├── public/logo.svg        # 静态资源
│   ├── _nav.json              # 顶部导航
│   ├── index.mdx              # 首页（Hero + Features）
│   ├── guide/                 # 指南
│   │   ├── _meta.json
│   │   ├── index.mdx
│   │   ├── installation.mdx
│   │   ├── quickstart.mdx
│   │   └── writing-demos.mdx
│   └── components/            # 组件文档 + 示例
│       ├── _meta.json
│       ├── index.mdx          # 组件总览
│       ├── button.mdx
│       ├── input.mdx
│       ├── alert.mdx
│       ├── card.mdx
│       └── _demo-*.{vue,tsx,less}  # 示例源码（_ 前缀不参与路由）
├── tsconfig.json
└── package.json
```

## 配置说明（rspress.config.ts）

预览插件的核心配置：

```ts
pluginPreview({
  defaultPreviewMode: 'iframe-follow',      // Vue 自定义入口仅在此模式可用
  previewLanguages: ['vue', 'tsx', 'jsx'],
  iframeOptions: {
    // 自定义入口：把示例挂载为 Vue 应用并全局注册 Element Plus
    customEntry: ({ demoPath }) => `
      import { createApp } from 'vue';
      import ElementPlus from 'element-plus';
      import 'element-plus/dist/index.css';
      import Demo from ${JSON.stringify(demoPath)};
      const app = createApp(Demo);
      app.use(ElementPlus);
      app.mount('#root');
    `,
    builderConfig: {
      tools: { rspack: { resolve: { alias: { '@': '<doc 根目录>' } } } },
      plugins: [
        pluginVue(),                                      // 编译 .vue
        pluginBabel({ include: /\.(?:jsx|tsx)$/ }),       // 为 vue-jsx 提供 Babel
        pluginVueJsx(),                                   // 编译 .tsx / .jsx
        pluginLess(),                                     // 编译 Less
      ],
    },
  },
}),
```

## 编写组件示例

在 `.mdx` 中为代码块声明 `preview="iframe-follow"` 即可预览。组件需默认导出。

**内联示例（tsx）：**

````mdx
```tsx preview="iframe-follow"
import { defineComponent, ref } from 'vue';
import { ElButton } from 'element-plus';

export default defineComponent({
  setup() {
    const count = ref(0);
    return () => (
      <ElButton type="primary" onClick={() => count.value++}>
        点击 {count.value}
      </ElButton>
    );
  },
});
```
````

**外部文件示例：**

````mdx
```vue file="./_demo-button.vue" preview="iframe-follow"

```
````

### .vue 与 .tsx 写法差异

| 写法 | 组件引用 | 说明 |
| --- | --- | --- |
| `.vue` | 模板中使用 `<el-button>`（kebab-case） | 依赖全局注册的 Element Plus |
| `.tsx` | JSX 中使用 `<ElButton>`（PascalCase）并显式 `import` | JSX 中仅 PascalCase 会解析为组件 |

> ⚠️ 在 TSX 中 `<el-button>` 会被当作原生 HTML 元素，不会解析为组件。请使用 `<ElButton>` 并显式导入。

### 关于示例中的相对导入

`@rspress/plugin-preview` 会把示例代码虚拟化到 `node_modules/.rspress/virtual-demo/`（扁平化重命名），因此**示例之间的相对路径同级文件引用（如 `import './x.less'`、Less 的 `@import './x.less'`）无法直接解析**。处理方式：

- `.vue` 示例：将 Less 变量直接写在 `<style lang="less">` 内（自包含）。
- `.tsx` 示例：通过 `@` 别名引用真实 Less 文件（`import '@/components/_demo-xx.less'`），该文件位于真实目录，其内部 `@import` 可正常解析。

## 部署

构建产物为纯静态文件，输出在 `doc_build/`，可部署到任意静态托管服务。

`rspress.config.ts` 中 `base` 通过环境变量 `BASE_PATH` 控制，部署到子路径时需设置。

### GitHub Pages

仓库内置 `.github/workflows/deploy.yml`，推送到 `main` 分支即自动构建并发布到 GitHub Pages（项目站点）。

如手动构建：

```bash
BASE_PATH=/<你的仓库名>/ pnpm build
# 将 doc_build/ 内容发布到 gh-pages 分支根目录
```

然后在仓库 **Settings → Pages** 中选择 `GitHub Actions` 作为来源。

> 注意：GitHub Pages 对 `~demo`（预览 iframe 资源）这种带 `~` 的扩展名省略路径的支持有限。若 iframe 预览无法加载，建议改用 Vercel / Netlify。

### Vercel / Netlify

- 构建命令：`pnpm build`
- 输出目录：`doc_build`
- `BASE_PATH` 留空（默认 `/`），自定义域名同理

两者均原生支持扩展名省略的 clean URL 与 `~` 路径，是组件库文档的推荐部署方式。

### Nginx

```nginx
server {
    listen 80;
    server_name docs.example.com;
    root /var/www/vue3-component-docs/doc_build;
    index index.html;

    # clean URL：/components/button -> /components/button.html
    location / {
        try_files $uri $uri.html $uri/ /index.html;
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
| @vue/babel-plugin-jsx | ^3.0.0 |
| vue | ^3.5.13 |
| element-plus | ^2.8.8 |
