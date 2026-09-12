<template>
  <div class="admin">
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <router-link to="/" class="side-brand">
        <img :src="site.logoUrl" :alt="site.siteName" />
        <div>
          <strong>{{ site.siteName }}</strong>
          <small>管理后台</small>
        </div>
      </router-link>

      <nav class="side-nav">
        <router-link v-for="item in navItems" :key="item.to" :to="item.to" class="side-link" @click="sidebarOpen = false">
          <span class="ico">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
          <span v-if="item.badge" class="dot">{{ item.badge }}</span>
        </router-link>
      </nav>

      <div class="side-foot">
        <div class="user">
          <div class="avatar">{{ (auth.user?.displayName || auth.user?.username || 'A').slice(0, 1) }}</div>
          <div class="user-info">
            <strong>{{ auth.user?.displayName || auth.user?.username }}</strong>
            <small class="muted">{{ auth.user?.role }}</small>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm btn-block" @click="logout">退出登录</button>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <button class="icon-btn" @click="sidebarOpen = !sidebarOpen">☰</button>
        <h1 class="page-title">{{ currentTitle }}</h1>
        <div class="flex" style="gap: 8px">
          <router-link to="/" class="btn btn-ghost btn-sm">查看站点</router-link>
          <button class="icon-btn" :title="theme === 'dark' ? '切换为浅色' : '切换为深色'" @click="toggleTheme">
            {{ theme === 'dark' ? '☀️' : '🌙' }}
          </button>
        </div>
      </header>

      <div v-if="auth.jwtSecretIsDefault" class="warn-bar">
        ⚠️ 检测到 JWT_SECRET 仍为默认值，请在服务器 <code>backend/.env</code> 中修改后重启服务。
      </div>

      <div class="content">
        <router-view />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSiteStore } from '@/stores/site'
import { useTheme } from '@/composables/useTheme'
import { messageApi } from '@/api'

const auth = useAuthStore()
const site = useSiteStore()
const route = useRoute()
const router = useRouter()
const { theme, toggleTheme } = useTheme()

const sidebarOpen = ref(false)
const unread = ref(0)

const navItems = computed(() => [
  { to: '/admin/dashboard', label: '控制台', icon: '📊' },
  { to: '/admin/files', label: '文件管理', icon: '📁' },
  { to: '/admin/projects', label: '项目管理', icon: '🚀' },
  { to: '/admin/news', label: '动态管理', icon: '📰' },
  { to: '/admin/members', label: '成员管理', icon: '👥' },
  { to: '/admin/messages', label: '留言管理', icon: '✉️', badge: unread.value || undefined },
  { to: '/admin/settings', label: '站点设置', icon: '⚙️' }
])

const currentTitle = computed(() => (route.meta.title as string) || '控制台')

const logout = () => {
  auth.logout()
  router.replace('/admin/login')
}

onMounted(async () => {
  auth.ensureLoaded()
  try {
    const res = await messageApi.list({ status: 'new', pageSize: 1 })
    unread.value = res.data.unread || 0
  } catch {
    /* 忽略 */
  }
})
</script>

<style scoped>
.admin {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
  background: var(--bg);
}
.sidebar {
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 18px 14px;
  position: sticky;
  top: 0;
  height: 100vh;
}
.side-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px 18px;
  color: var(--ink);
}
.side-brand img {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: #fff;
}
.side-brand strong {
  display: block;
  font-size: 15px;
}
.side-brand small {
  font-size: 11px;
  color: var(--muted);
}
.side-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  overflow: auto;
}
.side-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  color: var(--ink-2);
  font-size: 14.5px;
  font-weight: 600;
}
.side-link:hover {
  background: var(--brand-soft);
  color: var(--brand-dark);
}
.side-link.router-link-active {
  background: linear-gradient(135deg, var(--brand), var(--accent));
  color: #fff;
}
.ico {
  font-size: 16px;
}
.dot {
  margin-left: auto;
  background: var(--danger);
  color: #fff;
  font-size: 11px;
  min-width: 20px;
  height: 20px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
}
.side-foot {
  border-top: 1px solid var(--border);
  padding-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.user {
  display: flex;
  align-items: center;
  gap: 10px;
}
.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--brand), var(--accent));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}
.user-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.user-info strong {
  font-size: 13.5px;
}
.user-info small {
  font-size: 11.5px;
}
.main {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.topbar {
  height: 60px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 22px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 40;
}
.page-title {
  font-size: 17px;
  margin: 0;
  flex: 1;
}
.topbar .icon-btn:first-child {
  display: none;
}
.icon-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
}
.warn-bar {
  padding: 10px 22px;
  background: rgba(240, 160, 32, 0.12);
  color: #a86a06;
  font-size: 13px;
  border-bottom: 1px solid var(--border);
}
.content {
  padding: 22px;
}

@media (max-width: 900px) {
  .admin {
    grid-template-columns: 1fr;
  }
  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    width: 240px;
    z-index: 80;
    transform: translateX(-105%);
    transition: transform 0.25s;
    box-shadow: var(--shadow-lg);
  }
  .sidebar.open {
    transform: none;
  }
  .topbar .icon-btn:first-child {
    display: block;
  }
  .content {
    padding: 14px;
  }
}
</style>
