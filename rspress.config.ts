import path from 'node:path';
import { createRequire } from 'node:module';
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

// 让 vue/compiler-sfc 在 web 与 SSR 中都使用「浏览器构建」，
// 避免 @vue/compiler-sfc 的 Node 构建（consolidate.js 依赖 velocityjs 等）被静态打包。
const sfcRequire = createRequire(require.resolve('vue/package.json'));
const sfcBrowserBuild = sfcRequire.resolve(
  '@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js',
);
const pluginSfcBrowser = () => ({
  name: 'vue-compiler-sfc-browser',
  builderConfig: {
    tools: {
      rspack(config: any) {
        config.resolve = config.resolve || {};
        const alias = config.resolve.alias;
        const add = (key: string, val: string) => {
          if (Array.isArray(alias)) {
            if (!alias.find((a: any) => a && a.name === key)) alias.push({ name: key, alias: val });
          } else {
            config.resolve.alias = config.resolve.alias || {};
            config.resolve.alias[key] = val;
          }
        };
        add('vue/compiler-sfc', sfcBrowserBuild);
        add('@vue/compiler-sfc', sfcBrowserBuild);
        // 屏蔽 @vue/compiler-sfc 浏览器构建中 scss/less/stylus 懒加载 require 产生的
        // "Critical dependency" 警告（运行时不会触发，仅用普通 CSS）。
        config.ignoreWarnings = [
          ...(Array.isArray(config.ignoreWarnings)
            ? config.ignoreWarnings
            : config.ignoreWarnings
              ? [config.ignoreWarnings]
              : []),
          { module: /@vue[\\/]compiler-sfc/ },
        ];
      },
    },
  },
});

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
        customEntry: mountVueDemo,
        devPort: 7888,
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
  ],
});
