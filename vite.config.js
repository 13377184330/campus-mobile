import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * 生产挂载路径必须是 /static/m/，不能是 /m/。
 *
 * 原因：若依 SecurityConfig 只对 GET /static/**（以及 /、/index.html、/*.html）放行匿名访问，
 * /m/** 会命中 anyRequest().authenticated()，浏览器直接 GET 首页就会被挡在登录之外。
 * 在「后端零改动」的前提下，构建产物只能落在 classpath:static/static/m/ 下 → 访问 URL 为 /static/m/。
 */
export default defineConfig({
  base: process.env.VITE_BASE || '/static/m/',
  plugins: [vue()],
  server: {
    port: 5180,
    host: true,
    proxy: {
      // 开发态：/api/** 代理到本地 9090 后端并去掉前缀，避免跨域
      '/api': {
        target: 'http://localhost:9090',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '')
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1200
  }
})
