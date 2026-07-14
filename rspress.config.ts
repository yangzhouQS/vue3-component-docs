import path from 'node:path';
import { defineConfig } from '@rspress/core';
import { pluginPreview } from '@rspress/plugin-preview';
import { pluginPlayground } from '@rspress/plugin-playground';
import { pluginVue } from '@rsbuild/plugin-vue';
import { pluginVueJsx } from '@rsbuild/plugin-vue-jsx';
import { pluginBabel } from '@rsbuild/plugin-babel';
import { pluginLess } from '@rsbuild/plugin-less';
import { cdnStyles, cdnScripts, cdnExternals } from './playground/cdn';
import { pluginSfcBrowser } from './playground/plugins/plugin-sfc-browser';
import { pluginPlaygroundFull } from './playground/plugins/plugin-playground-full';

// 站点 base 前缀：rspress 的 base 与「新标签页打开」构造 URL 共用同一个值
// 优先用环境变量 BASE_PATH，否则用下方默认值（部署到子路径时改这里）
const SITE_BASE = (() => {
  const b = process.env.BASE_PATH || '/vue-node-docs/';
  return b.endsWith('/') ? b : b + '/';
})();

const mountVueDemo = ({ demoPath }: { demoPath: string }): string =>
  [
    "import { createApp } from 'vue';",
    "import ElementPlus from 'element-plus';",
    `import Demo from ${JSON.stringify(demoPath)};`,
    '',
    'const app = createApp(Demo);',
    '// Element Plus 组件样式由 CDN <link>(yun-que.css) 提供；vue / element-plus 等也由 CDN 全局注入',
    'const g = typeof window !== "undefined" ? window : globalThis;',
    'const locale = g.ElementPlusLocaleZhCn;',
    'app.use(ElementPlus, locale ? { locale } : undefined);',
    '// 图标全局注册（CDN 提供 ElementPlusIconsVue）',
    'const icons = g.ElementPlusIconsVue;',
    'if (icons) Object.keys(icons).forEach(k => app.component(k, icons[k]));',
    'app.mount("#root");',
  ].join('\n');

const previewExternals = cdnExternals;
const previewHtmlTags = [
  ...cdnStyles.map(href => ({ tag: 'link', head: true, attrs: { rel: 'stylesheet', href } })),
  ...cdnScripts.map(src => ({ tag: 'script', head: true, attrs: { src } })),
];

export default defineConfig({
  root: path.join(import.meta.dirname, 'doc'),
  title: 'Vue3 组件库文档',
  base: SITE_BASE,
  description: '基于 Rspress 的 Vue3 + TSX + Less + Element Plus 组件库文档',
  // lang: 'zh-CN',
  icon: '/logo.svg',
  themeConfig: {
    logo: '/logo.svg',
    socialLinks: [
      {
        icon: 'github',
        mode: 'link',
        content: 'https://github.com/yangzhouQS/vue3-component-docs',
      },
    ],
    footer: {
      message: '基于 Rspress + Vue3 + Element Plus 构建',
      copyright: 'Copyright © 2026 vue3-component-docs',
    },
  },
  plugins: [
    pluginPreview({
      defaultPreviewMode: 'iframe-follow',
      previewLanguages: ['vue', 'tsx', 'jsx'],
      iframeOptions: {
        customEntry: mountVueDemo,
        devPort: 7888,
        builderConfig: {
          output: {
            // 将 vue/element-plus 等排除出 bundle，改由 CDN 全局提供
            externals: previewExternals,
          },
          html: {
            // 注入 CDN 样式与脚本（vue 必须在 element-plus 之前加载）
            tags: previewHtmlTags,
          },
          tools: {
            rspack: {
              resolve: {
                alias: {
                  '@': path.join(import.meta.dirname, 'doc'),
                },
              },
            },
          },
          plugins: [
            pluginVue(),
            pluginBabel({ include: /\.(?:jsx|tsx)$/ }),
            pluginVueJsx(),
            pluginLess(),
          ],
          dev:{
            hmr: false
          }
        },
      },
    }),
    pluginPlayground({
      render: path.join(import.meta.dirname, 'playground', 'Playground.tsx'),
      // 预打包依赖：使用默认 vue 入口，使 element-plus 内部 import 'vue' 与 createApp 共享同一实例
      include: ['vue', 'element-plus', '@element-plus/icons-vue'],
      monacoLoader: {
        // Monaco 编辑器本地化（中文）
        'vs/nls': { availableLanguages: { '*': 'zh-cn' } },
        paths: {
          // 国内 CDN（阿里云），加载快；如需切换可改这里
          vs: 'https://g.alicdn.com/code/lib/monaco-editor/0.52.0/min/vs',
        },
      },
    }),
    pluginSfcBrowser(),
    pluginPlaygroundFull({ base: SITE_BASE }),
  ],
});
