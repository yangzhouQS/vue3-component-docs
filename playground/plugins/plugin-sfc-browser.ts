import { createRequire } from 'node:module';

/**
 * Rspress 插件：让 `vue/compiler-sfc` 在 Web 与 SSR 构建中都使用「浏览器构建」。
 *
 * 背景：在浏览器端用 `vue/compiler-sfc` 编译 SFC 时，若 rsbuild 解析到
 * `@vue/compiler-sfc` 的 Node 构建（含 consolidate.js 对 velocityjs/dustjs 等模板引擎的
 * 懒加载 require），打包会报 `Module not found` 或大量 `Critical dependency` 警告。
 * 本插件把 `vue/compiler-sfc` 与 `@vue/compiler-sfc` 别名到浏览器构建（esm-browser），
 * 并屏蔽这些无害警告。
 *
 * 复用：任意安装了 `vue` 的 Rspress 项目，直接 `import { pluginSfcBrowser } from '...'`
 * 并加入 `plugins` 即可，无需任何参数。
 */
export function pluginSfcBrowser() {
  // 通过 vue 的依赖树定位 @vue/compiler-sfc 的浏览器构建文件（项目无关）
  const projectReq = createRequire(import.meta.url);
  const vueReq = createRequire(projectReq.resolve('vue/package.json'));
  const sfcBrowserBuild = vueReq.resolve(
    '@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js',
  );

  return {
    name: 'vue-compiler-sfc-browser',
    builderConfig: {
      tools: {
        rspack(config: any) {
          config.resolve = config.resolve || {};
          const alias = config.resolve.alias;

          const addAlias = (key: string, val: string) => {
            if (Array.isArray(alias)) {
              if (!alias.find((a: any) => a && a.name === key)) {
                alias.push({ name: key, alias: val });
              }
            } else {
              config.resolve.alias = config.resolve.alias || {};
              config.resolve.alias[key] = val;
            }
          };

          addAlias('vue/compiler-sfc', sfcBrowserBuild);
          addAlias('@vue/compiler-sfc', sfcBrowserBuild);

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
  };
}
