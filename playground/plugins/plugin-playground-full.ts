/**
 * Rspress 插件：为「在新标签页打开全页 Playground」注入站点 base 前缀。
 *
 * 它通过 `source.define` 注入全局常量 `__PG_BASE__`（站点 base 路径），
 * 供主窗口的 `openInNewTab` 拼接出正确的 `/playground-full` 路由地址，
 * 使该功能在子路径部署（如 `/vue-node-docs/`）下也能定位到正确页面。
 *
 * 复用：传入你项目的 base 前缀。
 * @example
 *   pluginPlaygroundFull({ base: '/vue-node-docs/' })
 *   pluginPlaygroundFull({ base: process.env.BASE_PATH || '/' })
 */
export function pluginPlaygroundFull(options: { base: string }) {
  const base = options.base.endsWith('/') ? options.base : `${options.base}/`;
  return {
    name: 'playground-full',
    builderConfig: {
      source: {
        define: {
          __PG_BASE__: JSON.stringify(base),
        },
      },
    },
  };
}
