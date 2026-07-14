import path from 'node:path';
import { defineConfig } from '@rspress/core';
import { pluginPreview } from '@rspress/plugin-preview';
import { pluginPlayground } from '@rspress/plugin-playground';
import { pluginVue } from '@rsbuild/plugin-vue';
import { pluginVueJsx } from '@rsbuild/plugin-vue-jsx';
import { pluginBabel } from '@rsbuild/plugin-babel';
import { pluginLess } from '@rsbuild/plugin-less';

const mountVueDemo = ({ demoPath }: { demoPath: string }): string =>
  [
    "import { createApp } from 'vue';",
    "import ElementPlus from 'element-plus';",
    "import 'element-plus/dist/index.css';",
    `import Demo from ${JSON.stringify(demoPath)};`,
    '',
    'const app = createApp(Demo);',
    'app.use(ElementPlus);',
    'app.mount("#root");',
  ].join('\n');

export default defineConfig({
  root: path.join(import.meta.dirname, 'doc'),
  title: 'Vue3 组件库文档',
  description: '基于 Rspress 的 Vue3 + TSX + Less + Element Plus 组件库文档',
  // lang: 'zh-CN',
  base: process.env.BASE_PATH || '/',
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
        devPort: 7900,
        customEntry: mountVueDemo,
        builderConfig: {
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
        },
      },
    }),
    pluginPlayground(),
  ],
});
