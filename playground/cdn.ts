// CDN 依赖（自建 CDN），供 iframe 预览与 playground「新标签页打开」共用
export const CDN = 'https://cdn.yearrow.com/files';

export const cdnStyles = [
  `${CDN}/@cs/element-plus-ui/0.2.5/theme/yun-que.css`,
];

// 顺序重要：vue 必须在 element-plus 之前加载
export const cdnScripts = [
  `${CDN}/vue/3.4.34/vue.global.js`,
  `${CDN}/vue-router/4.2.5/vue-router.global.js`,
  `${CDN}/element-plus/2.13.7/index.full.min.js`,
  `${CDN}/element-plus/2.13.7/locale/zh-cn.min.js`,
  `${CDN}/@element-plus/icons-vue/2.3.1/global.iife.min.js`,
  `${CDN}/axios/1.7.0/axios.min.js`,
  `${CDN}/decimal.js/10.4.3/decimal.js`,
];

// 模块名 -> CDN 暴露的全局变量名
export const cdnExternals: Record<string, string> = {
  vue: 'Vue',
  'vue-router': 'VueRouter',
  'element-plus': 'ElementPlus',
  '@element-plus/icons-vue': 'ElementPlusIconsVue',
  axios: 'axios',
  'decimal.js': 'Decimal',
};
