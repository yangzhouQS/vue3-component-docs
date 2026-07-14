/**
 * 自定义 Playground 渲染组件（Vue3 版）
 * --------------------------------------------------
 * 官方默认的 plugin-playground Runner 在浏览器中用 @babel/standalone 编译，
 * 并以 React.createElement 渲染默认导出 —— 因此默认只支持 React。
 *
 * 本文件替换默认渲染逻辑：
 *  1. 用 @babel/standalone 编译用户代码（typescript + env，不使用 react 预设）；
 *  2. 将 ESM import 重写为 __get_import，从而解析 include 中预打包的依赖（如 vue）；
 *  3. 取默认导出的 Vue 组件，用 createApp 挂载到预览容器。
 *
 * 说明：
 *  - 由于浏览器端 @babel/standalone 不含 @vue/babel-plugin-jsx，playground 中的 Vue 组件
 *    需使用 h() 渲染函数或 template 字符串，不能使用 JSX/TSX 语法。
 *  - createApp 取自 include 中预打包的「带编译器」版本（vue.esm-browser），因此 template 可在线编译。
 */
import { Editor } from '@rspress/plugin-playground/web';
// @ts-expect-error 由 plugin-playground 注入的虚拟模块
import getImport from '_rspress_playground_imports';
import { useCallback, useEffect, useRef, useState } from 'react';

/* ----------------------------- 加载 @babel/standalone（自托管，动态导入懒加载，无需 CDN）----------------------------- */
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

// 该插件在 env 预设的 commonjs 转换之前运行（plugin 先于 preset），
// 因此 import 会被替换为变量声明，不会生成 require()。
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

function compile(babel: any, code: string, language: string): string {
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

/* ----------------------------- Vue 运行器：编译并挂载默认导出 ----------------------------- */
function VueRunner({ code, language }: { code: string; language: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const babel = await getBabel();
        const compiled = compile(babel, code, language);
        if (cancelled) return;
        const runExports: any = {};
        // eslint-disable-next-line no-new-func
        const fn = new Function('__get_import', 'exports', compiled);
        fn(getImport, runExports);
        const comp = runExports.default;
        if (!comp) throw new Error('请默认导出一个 Vue 组件（export default ...）');
        if (appRef.current) {
          appRef.current.unmount();
          appRef.current = null;
        }
        if (hostRef.current) {
          hostRef.current.innerHTML = '';
          // createApp 取自 include 预打包的「带编译器」Vue，使 template 可在线编译
          const vueNS: any = getImport('vue');
          const createApp = vueNS?.createApp ?? vueNS?.default?.createApp;
          if (!createApp) throw new Error('无法加载 Vue（含模板编译器），请检查 pluginPlayground 的 include 配置');
          appRef.current = createApp(comp);
          appRef.current.mount(hostRef.current);
        }
        setError(null);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      }
    }, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [code, language]);

  useEffect(() => () => appRef.current?.unmount(), []);

  return (
    <div className="rp-playground-runner">
      <div ref={hostRef} />
      {error && <pre className="rp-playground-error">{error}</pre>}
    </div>
  );
}

/* ----------------------------- Playground 外壳（React） ----------------------------- */
export default function Playground(props: any) {
  const { code: codeProp, language } = props;
  const [code, setCode] = useState<string>(codeProp);
  const onChange = useCallback((e?: string) => setCode(e || ''), []);
  const monacoLanguage =
    language === 'tsx' || language === 'ts' ? 'typescript' : 'javascript';

  return (
    <div className="rp-playground rp-playground-horizontal rp-not-doc">
      <VueRunner code={code} language={language} />
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
