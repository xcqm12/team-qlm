import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { getToken } from '@/api/client'
import { useSiteStore } from '@/stores/site'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('@/views/HomeView.vue'), meta: { title: '首页' } },
  { path: '/about', name: 'about', component: () => import('@/views/AboutView.vue'), meta: { title: '关于我们' } },
  { path: '/projects', name: 'projects', component: () => import('@/views/ProjectsView.vue'), meta: { title: '项目作品' } },
  {
    path: '/projects/:slug',
    name: 'project-detail',
    component: () => import('@/views/ProjectDetailView.vue'),
    meta: { title: '项目详情' }
  },
  { path: '/news', name: 'news', component: () => import('@/views/NewsView.vue'), meta: { title: '新闻动态' } },
  {
    path: '/news/:slug',
    name: 'news-detail',
    component: () => import('@/views/NewsDetailView.vue'),
    meta: { title: '新闻详情' }
  },
  { path: '/files', name: 'files', component: () => import('@/views/FilesView.vue'), meta: { title: '文件下载' } },
  { path: '/contact', name: 'contact', component: () => import('@/views/ContactView.vue'), meta: { title: '联系我们' } },
  { path: '/search', name: 'search', component: () => import('@/views/SearchView.vue'), meta: { title: '搜索' } },

  {
    path: '/admin/login',
    name: 'admin-login',
    component: () => import('@/views/admin/AdminLoginView.vue'),
    meta: { title: '后台登录', layout: 'blank' }
  },
  {
    path: '/admin',
    component: () => import('@/views/admin/AdminLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/admin/dashboard' },
      { path: 'dashboard', name: 'admin-dashboard', component: () => import('@/views/admin/AdminDashboardView.vue'), meta: { title: '控制台' } },
      { path: 'files', name: 'admin-files', component: () => import('@/views/admin/AdminFilesView.vue'), meta: { title: '文件管理' } },
      { path: 'projects', name: 'admin-projects', component: () => import('@/views/admin/AdminProjectsView.vue'), meta: { title: '项目管理' } },
      { path: 'news', name: 'admin-news', component: () => import('@/views/admin/AdminNewsView.vue'), meta: { title: '动态管理' } },
      { path: 'members', name: 'admin-members', component: () => import('@/views/admin/AdminMembersView.vue'), meta: { title: '成员管理' } },
      { path: 'messages', name: 'admin-messages', component: () => import('@/views/admin/AdminMessagesView.vue'), meta: { title: '留言管理' } },
      { path: 'settings', name: 'admin-settings', component: () => import('@/views/admin/AdminSettingsView.vue'), meta: { title: '站点设置' } }
    ]
  },

  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue'), meta: { title: '页面不存在' } }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to, from, saved) => saved || { top: 0, behavior: 'smooth' }
})

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !getToken()) {
    return { name: 'admin-login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'admin-login' && getToken()) {
    return { name: 'admin-dashboard' }
  }
  return true
})

router.afterEach((to) => {
  const site = useSiteStore()
  const title = (to.meta.title as string) || ''
  document.title = title ? `${title} · ${site.siteName}` : `${site.siteName} · ${site.slogan}`
})

export default router
