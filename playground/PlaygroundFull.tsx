/**
 * 全页可编辑 Playground（在新标签页打开时使用）
 * --------------------------------------------------
 * 左右布局使用 Element Plus 的 <el-splitter>（可拖动调整）。
 * 由于本页运行在 React（rspress 站点）中，而 el-splitter 是 Vue 组件：
 *  - 用 Vue createApp 挂载一个 el-splitter 外壳，两个 panel 内各放一个宿主 div；
 *  - 再用 ReactDOM.createRoot 把已有的 React「编辑器」「预览(VueRunner)」渲染进宿主 div；
 *  - 复用主 Playground 的编译管线，无需重复实现。
 * 代码经 localStorage（同源跨标签共享）从主窗口传入。
 */
import { Editor } from '@rspress/plugin-playground/web';
// @ts-expect-error 由 plugin-playground 注入的虚拟模块
import getImport from '_rspress_playground_imports';
import { VueRunner } from './Playground';
import { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const PG_CODE_KEY = '__rsplayground_code';

const disableDiag = (monaco: any) => {
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
    noSuggestionDiagnostics: true,
  });
};

export default function PlaygroundFull() {
  const [code, setCode] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const splitterAppRef = useRef<any>(null);
  const leftRootRef = useRef<Root | null>(null);
  const rightRootRef = useRef<Root | null>(null);

  // 从 localStorage 读取主窗口传入的代码
  useEffect(() => {
    try {
      setCode(localStorage.getItem(PG_CODE_KEY) || '');
    } catch {
      /* ignore */
    }
  }, []);

  // 挂载 el-splitter（Vue）外壳，并在其两个 panel 内建立 React root
  useEffect(() => {
    if (!containerRef.current) return;
    const Vue: any = getImport('vue');
    const EP: any = getImport('element-plus');
    const { ElSplitter, ElSplitterPanel } = EP;

    const app = Vue.createApp({
      render() {
        return Vue.h(
          ElSplitter,
          { style: 'height: 100%; width: 100%; border: 1px solid var(--rp-c-divider-light, #e5e5e5)' },
          {
            default: () => [
              Vue.h(
                ElSplitterPanel,
                { size: '50%' },
                { default: () => Vue.h('div', { class: 'pgfp-left', style: 'height:100%' }) },
              ),
              Vue.h(
                ElSplitterPanel,
                { min: 200 },
                { default: () => Vue.h('div', { class: 'pgfp-right', style: 'height:100%; overflow:auto' }) },
              ),
            ],
          },
        );
      },
    });
    app.mount(containerRef.current);
    splitterAppRef.current = app;

    const leftEl = containerRef.current.querySelector('.pgfp-left') as HTMLElement;
    const rightEl = containerRef.current.querySelector('.pgfp-right') as HTMLElement;
    leftRootRef.current = createRoot(leftEl);
    rightRootRef.current = createRoot(rightEl);

    return () => {
      splitterAppRef.current?.unmount();
      splitterAppRef.current = null;
      leftRootRef.current?.unmount();
      rightRootRef.current?.unmount();
      leftRootRef.current = null;
      rightRootRef.current = null;
    };
  }, []);

  // 代码变化时，重新渲染两个 React 子树
  useEffect(() => {
    leftRootRef.current?.render(
      <Editor
        value={code}
        onChange={(e?: string) => setCode(e || '')}
        language="typescript"
        beforeMount={disableDiag}
      />,
    );
    rightRootRef.current?.render(<VueRunner code={code} />);
  }, [code]);

  return (
    <div className="rp-pg-fullpage">
      <div className="rp-pg-fullpage__bar">
        Playground · 全页编辑（左代码 / 右预览，可拖动分隔条调整）
      </div>
      <div className="rp-pg-fullpage__body" ref={containerRef} />
    </div>
  );
}
