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
  if (descriptor.script || descriptor.scriptSetup) {
    // inlineTemplate：把 <template> 编译为 render 并内联进 <script setup> 产物，得到自完整组件
    const script = sfc.compileScript(descriptor, {
      id: scopeId,
      inlineTemplate: true,
      sourceMap: false,
    });
    js = script.content;
  } else {
    // 仅有 <template> 的 SFC：单独编译模板，组装为 { render } 组件
    if (!descriptor.template) throw new Error('SFC 必须包含 <template> 或 <script>');
    const tpl = sfc.compileTemplate({
      source: descriptor.template.content,
      filename: 'App.vue',
      id: scopeId,
    });
    js = `${tpl.code}\nexport default { render };`;
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

/* ----------------------------- Vue 运行器：编译并挂载默认导出 ----------------------------- */
function VueRunner({ code }: { code: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLStyleElement>(null);
  const appRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
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
  }, [code]);

  useEffect(() => () => appRef.current?.unmount(), []);

  return (
    <div className="rp-playground-runner">
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
  const onChange = useCallback((e?: string) => setCode(e || ''), []);
  const monacoLanguage =
    language === 'tsx' || language === 'ts' ? 'typescript' : 'javascript';

  return (
    <div className="rp-playground rp-playground-horizontal rp-not-doc">
      <VueRunner code={code} />
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
    </div>
  );
}
