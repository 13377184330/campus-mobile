import { createRouter, createWebHashHistory } from 'vue-router'
import { getToken } from './utils/auth'

/**
 * 使用 hash 路由：构建产物是纯静态文件挂在若依 /static/m/ 下，
 * history 模式刷新子路由（如 /static/m/home）会 404，hash 模式不需要任何服务端 rewrite。
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/home' },
    { path: '/login', name: 'login', component: () => import('./views/Login.vue') },
    { path: '/home', name: 'home', component: () => import('./views/Home.vue') },
    {
      path: '/score/:studentId',
      name: 'score',
      component: () => import('./views/Score.vue'),
      props: true
    },
    { path: '/:pathMatch(.*)*', redirect: '/home' }
  ]
})

router.beforeEach((to) => {
  const token = getToken()
  if (!token && to.name !== 'login') {
    return { name: 'login' }
  }
  if (token && to.name === 'login') {
    return { name: 'home' }
  }
  return true
})

export default router
