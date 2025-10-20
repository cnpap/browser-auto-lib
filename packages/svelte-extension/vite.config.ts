import path from "node:path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

// 专用于浏览器插件内容脚本的构建：输出单文件 content.js 到主库目录
export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: path.resolve(__dirname, "../../src/browser/extension"),
    emptyOutDir: false, // 不清空整个扩展目录，仅覆盖生成文件
    rollupOptions: {
      input: path.resolve(__dirname, "src/content.ts"),
      output: {
        format: "iife",
        entryFileNames: "content.js",
        inlineDynamicImports: true,
      },
    },
    sourcemap: false,
    minify: "esbuild",
  },
});
