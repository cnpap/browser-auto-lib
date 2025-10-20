/// <reference types="svelte" />
/// <reference types="vite/client" />

// 让 TypeScript 在 .ts 文件中正确识别对 .svelte 组件的导入
declare module "*.svelte" {
  import type { ComponentType } from "svelte";

  const component: ComponentType;
  export default component;
}
