/**
 * 自定义 Playground 渲染组件（Vue3 版，支持原始 SFC 在线编译运行）
 * --------------------------------------------------
 * 支持两种写法：
 *  1. 原始 SFC：`<template>` + `<script setup>` + `<style scoped>`（含 Element Plus、图标）
 *  2. 普通组件：`export default defineComponent({ setup() { return () => h(...) } })`（h 渲染函数）
 *
 * 实现：
 *  - SFC 用 `vue/compiler-sfc`（本地打包，动态导入）在浏览器端编译：compileScript(inlineTemplate)
 *    把 <template> 编译为 render 并内联；<style> 用 compileStyleAsync 处理（含 scoped）。
 *  - 编译产物经 @babel/standalone（自托管）转 commonjs，并将 import 重写为 __get_import，
 *    从而解析 include 中预打包的依赖（vue / element-plus / @element-plus/icons-vue）。
 *  - 取默认导出组件，用 createApp 挂载，并全局注册 Element Plus。
 *
 * 说明：浏览器端 babel 不含 @vue/babel-plugin-jsx，因此 SFC 内请使用 <template>（非 JSX）。
 */
import { Editor } from '@rspress/plugin-playground/web';
// @ts-expect-error 由 plugin-playground 注入的虚拟模块
import getImport from '_rspress_playground_imports';
import { useCallback, useEffect, useRef, useState } from 'react';
// Element Plus 组件样式（playground 预览需要）
import 'element-plus/dist/index.css';
// 「新标签页打开」复用与 iframe 预览相同的 CDN（自建 CDN）
import { cdnStyles, cdnScripts, cdnExternals } from './cdn';

/* ----------------------------- 加载 @babel/standalone（自托管，动态导入懒加载）----------------------------- */
let babelPromise: Promise<any> | null = null;
function getBabel(): Promise<any> {
  const w = window as any;
  if (w.Babel) return Promise.resolve(w.Babel);
  if (babelPromise) return babelPromise;
  babelPromise = (async () => {
    const mod: any = await import('@babel/standalone');
    const Babel = mod.default || mod;
    w.Babel = Babel;
    return Babel;
  })();
  return babelPromise;
}

/* ----------------------------- babel AST 辅助：把 import 重写为 __get_import ----------------------------- */
const ident = (name: string) => ({ type: 'Identifier', name });
const getImportCall = (pkg: string, isDefault = false) => ({
  type: 'CallExpression',
  callee: ident('__get_import'),
  arguments: [
    { type: 'StringLiteral', value: pkg },
    { type: 'BooleanLiteral', value: isDefault },
  ],
});
const varDecl = (idNode: any, init: any) => ({
  type: 'VariableDeclaration',
  declarations: [{ type: 'VariableDeclarator', id: idNode, init }],
  kind: 'const',
});
const objectPattern = (names: any[]) => ({
  type: 'ObjectPattern',
  properties: names.map((n) => {
    const [imp, local] = Array.isArray(n) ? n : [n, n];
    return {
      type: 'ObjectProperty',
      key: ident(imp),
      computed: false,
      shorthand: imp === local,
      value: ident(local),
    };
  }),
});

const importRewritePlugin = {
  visitor: {
    ImportDeclaration(path: any) {
      const pkg = path.node.source.value;
      const decls: any[] = [];
      const named: any[] = [];
      for (const s of path.node.specifiers) {
        if (s.type === 'ImportDefaultSpecifier') {
          decls.push(varDecl(ident(s.local.name), getImportCall(pkg, true)));
        } else if (s.type === 'ImportNamespaceSpecifier') {
          decls.push(varDecl(ident(s.local.name), getImportCall(pkg, false)));
        } else if (s.type === 'ImportSpecifier') {
          const impName =
            (s.imported && (s.imported.name || s.imported.value)) || s.local.name;
          named.push(impName !== s.local.name ? [impName, s.local.name] : s.local.name);
        }
      }
      if (named.length > 0) decls.push(varDecl(objectPattern(named), getImportCall(pkg)));
      path.replaceWithMultiple(decls);
    },
  },
};

function babelTransform(babel: any, code: string, language: string): string {
  const presets: any[] = [[babel.availablePresets.env, { modules: 'commonjs' }]];
  if (language === 'tsx' || language === 'ts') {
    presets.unshift([
      babel.availablePresets.typescript,
      { allExtensions: true, isTSX: language === 'tsx' },
    ]);
  }
  const result = babel.transform(code, {
    sourceType: 'module',
    presets,
    plugins: [importRewritePlugin],
  });
  return result.code;
}

/* ----------------------------- SFC 检测与编译 ----------------------------- */
function isSFC(code: string): boolean {
  return /<template[\s>]/.test(code) || /<script[\s>]/.test(code);
}

async function compileSFC(code: string): Promise<{ js: string; css: string }> {
  const sfc: any = await import('vue/compiler-sfc');
  const { descriptor, errors } = sfc.parse(code, { filename: 'App.vue' });
  if (errors && errors.length) throw errors[0];
  // scope id：compileScript 与 compileStyle 均会自动剥离 data-v- 前缀，保持一致即可匹配
  const scopeId = 'data-v-' + Math.random().toString(36).slice(2, 10);

  let js: string;
  const tplOnly = () => {
    if (!descriptor.template) throw new Error('SFC 必须包含 <template> 或 <script>');
    const tpl = sfc.compileTemplate({
      source: descriptor.template.content,
      filename: 'App.vue',
      id: scopeId,
    });
    return `${tpl.code}\nexport default { render };`;
  };
  if (descriptor.script || descriptor.scriptSetup) {
    // inlineTemplate：把 <template> 编译为 render 并内联进 <script setup> 产物，得到自完整组件
    try {
      const script = sfc.compileScript(descriptor, {
        id: scopeId,
        inlineTemplate: true,
        sourceMap: false,
      });
      js = script.content;
    } catch {
      // script 编译失败（如空 script）时回退为「仅模板」组件
      js = tplOnly();
    }
  } else {
    // 仅有 <template> 的 SFC
    js = tplOnly();
  }

  let css = '';
  for (const s of descriptor.styles || []) {
    const res = await sfc.compileStyleAsync({
      source: s.content,
      filename: 'App.vue',
      id: scopeId,
      scoped: !!s.scoped,
    });
    css += res.code + '\n';
  }
  return { js, css };
}

/* ----------------------------- 统一编译：源码 -> { 编译后 commonjs 代码, css } ----------------------------- */
async function compileToRunnable(code: string): Promise<{ compiled: string; css: string }> {
  let jsCode = code;
  let css = '';
  const sfcMode = isSFC(code);
  if (sfcMode) {
    const r = await compileSFC(code);
    jsCode = r.js;
    css = r.css;
  }
  const babel = await getBabel();
  // SFC 产物为编译后 JS（用 ts 预设兜底剥离类型）；普通代码按 tsx 处理
  const compiled = babelTransform(babel, jsCode, sfcMode ? 'ts' : 'tsx');
  return { compiled, css };
}

/* ----------------------------- 生成「新标签页」自包含预览 HTML ----------------------------- */
function buildPreviewHtml(compiled: string, css: string): string {
  // 防止内嵌代码中的 </script> 截断 HTML
  const safeCode = compiled.replace(/<\/script>/gi, '<\\/script>');
  const styleTag = css ? `<style>${css}</style>` : '';
  const links = cdnStyles.map(s => `<link rel="stylesheet" href="${s}">`).join('\n  ');
  const scripts = cdnScripts.map(s => `<script src="${s}"></script>`).join('\n  ');
  // __get_import：与主窗口相同的解析约定，但解析到新标签页的 CDN 全局
  const externalsMap = JSON.stringify(cdnExternals);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Playground 预览</title>
  ${links}
  ${scripts}
  ${styleTag}
  <style>
    html,body{margin:0}body{padding:16px;font-family:system-ui,-apple-system,sans-serif}
    #__err{color:#a12027;white-space:pre-wrap;padding:12px;background:#fff0f1;border:1px solid #ffd0d4}
  </style>
</head>
<body>
  <div id="app"></div>
  <script>
    var externals = ${externalsMap};
    function __get_import(name, isDefault){
      var globalName = externals[name];
      var v = globalName ? window[globalName] : undefined;
      if (v === undefined) throw new Error('未提供依赖：' + name + '（请检查 CDN）');
      return isDefault ? (v.default || v) : v;
    }
    try {
      var exports = {};
      ${safeCode}
      var comp = exports.default;
      if (!comp) throw new Error('请默认导出一个 Vue 组件');
      var Vue = window.Vue, EP = window.ElementPlus;
      var app = Vue.createApp(comp);
      var locale = window.ElementPlusLocaleZhCn;
      app.use(EP, locale ? { locale: locale } : undefined);
      var icons = window.ElementPlusIconsVue;
      if (icons) Object.keys(icons).forEach(function(k){ app.component(k, icons[k]); });
      app.mount('#app');
    } catch (e) {
      var el = document.getElementById('app');
      var pre = document.createElement('pre'); pre.id = '__err';
      pre.textContent = (e && e.stack) ? e.stack : String(e);
      el.replaceWith(pre);
    }
  </script>
</body>
</html>`;
}

/* 在新标签页打开当前代码的预览（主窗口编译，新标签页用 CDN 运行） */
async function openInNewTab(code: string): Promise<void> {
  const { compiled, css } = await compileToRunnable(code);
  const html = buildPreviewHtml(compiled, css);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/* ----------------------------- 操作图标 ----------------------------- */
const IconRefresh = (
  <svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="4">
    <path d="M38.837 18C36.4634 12.1363 30.7148 8 24 8C15.1634 8 8 15.1634 8 24C8 32.8366 15.1634 40 24 40C31.4554 40 37.7198 34.9009 39.4959 28M40 8V18H30" />
  </svg>
);
const IconExpand = (
  <svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="4">
    <path d="M33 6v9h9M15 6v9H6M33 42v-9h9M15 42v-9H6" />
  </svg>
);
const IconClose = (
  <svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="4">
    <path d="M8 8L40 40M40 8L8 40" />
  </svg>
);
const IconExternal = (
  <svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="4">
    <path d="M41 26v13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h13" />
    <path d="M28 6h14v14" />
    <path d="M41 6 22 25" />
  </svg>
);

/* ----------------------------- Vue 运行器：编译并挂载默认导出 ----------------------------- */
function VueRunner({
  code,
  showOps = true,
  onFullscreen,
  onOpenTab,
}: {
  code: string;
  showOps?: boolean;
  onFullscreen?: () => void;
  onOpenTab?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLStyleElement>(null);
  const appRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  // runId：点击「刷新」时自增，强制重新编译并重新挂载（重置响应式状态）
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const { compiled, css } = await compileToRunnable(code);
        if (cancelled) return;
        if (styleRef.current) styleRef.current.textContent = css;

        const runExports: any = {};
        // eslint-disable-next-line no-new-func
        const fn = new Function('__get_import', 'exports', compiled);
        fn(getImport, runExports);
        const comp = runExports.default;
        if (!comp)
          throw new Error('请提供一个 Vue 组件（SFC 默认导出，或 export default defineComponent(...)）');

        if (appRef.current) {
          appRef.current.unmount();
          appRef.current = null;
        }
        if (hostRef.current) {
          hostRef.current.innerHTML = '';
          const vueNS: any = getImport('vue');
          const createApp = vueNS?.createApp ?? vueNS?.default?.createApp;
          if (!createApp) throw new Error('无法加载 Vue，请检查 include 配置');
          const app = createApp(comp);
          // 全局注册 Element Plus（使 <el-button> 等可用）
          const EP: any =
            getImport('element-plus', true) ?? (getImport('element-plus') as any)?.default;
          if (EP) app.use(EP);
          appRef.current = app;
          app.mount(hostRef.current);
        }
        setError(null);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      }
    }, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [code, runId]);

  useEffect(() => () => appRef.current?.unmount(), []);

  return (
    <div className="rp-playground-runner">
      {showOps && (
        <div className="rp-pg-ops">
          <button
            type="button"
            className="rp-pg-ops__btn"
            title="重新运行"
            onClick={() => setRunId((n) => n + 1)}
          >
            {IconRefresh}
          </button>
          {onFullscreen && (
            <button
              type="button"
              className="rp-pg-ops__btn"
              title="全屏预览"
              onClick={onFullscreen}
            >
              {IconExpand}
            </button>
          )}
          {onOpenTab && (
            <button
              type="button"
              className="rp-pg-ops__btn"
              title="在新标签页打开"
              onClick={onOpenTab}
            >
              {IconExternal}
            </button>
          )}
        </div>
      )}
      <style ref={styleRef} />
      <div ref={hostRef} />
      {error && <pre className="rp-playground-error">{error}</pre>}
    </div>
  );
}

/* ----------------------------- Playground 外壳（React）----------------------------- */
export default function Playground(props: any) {
  const { code: codeProp, language } = props;
  const [code, setCode] = useState<string>(codeProp);
  const [fullscreen, setFullscreen] = useState(false);
  const onChange = useCallback((e?: string) => setCode(e || ''), []);
  const monacoLanguage =
    language === 'tsx' || language === 'ts' ? 'typescript' : 'javascript';

  // Esc 关闭全屏
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  return (
    <div className="rp-playground rp-playground-vertical rp-not-doc">
      {/* 代码区域在上 */}
      <Editor
        value={code}
        onChange={onChange}
        language={monacoLanguage}
        beforeMount={(monaco: any) => {
          monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: true,
            noSyntaxValidation: true,
            noSuggestionDiagnostics: true,
          });
        }}
      />
      {/* 组件渲染预览在下 */}
      <VueRunner
        code={code}
        onFullscreen={() => setFullscreen(true)}
        onOpenTab={() => {
          openInNewTab(code).catch(() => {});
        }}
      />

      {/* 全屏预览浮层：同一 document，复用已加载的 Vue + Element Plus + 样式 */}
      {fullscreen && (
        <div
          className="rp-pg-fullscreen"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFullscreen(false);
          }}
        >
          <div className="rp-pg-fullscreen__inner">
            <div className="rp-pg-fullscreen__bar">
              <span>全屏预览（Esc 或点击空白处关闭）</span>
              <button
                type="button"
                className="rp-pg-ops__btn"
                title="关闭"
                onClick={() => setFullscreen(false)}
              >
                {IconClose}
              </button>
            </div>
            <div className="rp-pg-fullscreen__body">
              <VueRunner code={code} showOps={false} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
