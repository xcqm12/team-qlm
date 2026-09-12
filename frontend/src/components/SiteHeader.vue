<template>
  <header class="header" :class="{ scrolled }">
    <div class="container header-inner">
      <router-link to="/" class="brand" @click="closeMenu">
        <img :src="site.logoUrl" :alt="site.siteName" class="brand-logo" />
        <span class="brand-text">
          <strong>{{ site.siteName }}</strong>
          <small>Seven Zero Meow</small>
        </span>
      </router-link>

      <nav class="nav" :class="{ open: menuOpen }">
        <router-link v-for="item in navItems" :key="item.to" :to="item.to" class="nav-link" @click="closeMenu">
          {{ item.label }}
        </router-link>
      </nav>

      <div class="actions">
        <form class="search" @submit.prevent="doSearch">
          <input v-model="keyword" class="search-input" type="search" placeholder="搜索项目 / 动态 / 文件" />
        </form>
        <button class="icon-btn" :title="theme === 'dark' ? '切换为浅色' : '切换为深色'" @click="toggleTheme">
          {{ theme === 'dark' ? '☀️' : '🌙' }}
        </button>
        <router-link v-if="auth.isLoggedIn" to="/admin" class="btn btn-primary btn-sm">后台</router-link>
        <router-link v-else to="/admin/login" class="btn btn-ghost btn-sm">登录</router-link>
        <button class="icon-btn menu-btn" title="菜单" @click="menuOpen = !menuOpen">☰</button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSiteStore } from '@/stores/site'
import { useAuthStore } from '@/stores/auth'
import { useTheme } from '@/composables/useTheme'

const site = useSiteStore()
const auth = useAuthStore()
const router = useRouter()
const { theme, toggleTheme } = useTheme()

const navItems = [
  { to: '/', label: '首页' },
  { to: '/about', label: '关于我们' },
  { to: '/projects', label: '项目作品' },
  { to: '/news', label: '新闻动态' },
  { to: '/files', label: '文件下载' },
  { to: '/contact', label: '联系我们' }
]

const keyword = ref('')
const menuOpen = ref(false)
const scrolled = ref(false)

const closeMenu = () => (menuOpen.value = false)

const doSearch = () => {
  const q = keyword.value.trim()
  if (!q) return
  router.push({ name: 'search', query: { q } })
  closeMenu()
}

const onScroll = () => (scrolled.value = window.scrollY > 8)

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', onScroll))
</script>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 60;
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  backdrop-filter: saturate(180%) blur(12px);
  border-bottom: 1px solid var(--border);
  transition: box-shadow 0.25s;
}
.header.scrolled {
  box-shadow: var(--shadow-sm);
}
.header-inner {
  height: var(--header-h);
  display: flex;
  align-items: center;
  gap: 18px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--ink);
  flex-shrink: 0;
}
.brand-logo {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  object-fit: contain;
  background: #fff;
  box-shadow: var(--shadow-sm);
}
.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}
.brand-text strong {
  font-size: 17px;
  letter-spacing: 0.5px;
}
.brand-text small {
  font-size: 10.5px;
  color: var(--muted);
  letter-spacing: 0.6px;
}
.nav {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}
.nav-link {
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--ink-2);
}
.nav-link:hover {
  background: var(--brand-soft);
  color: var(--brand-dark);
}
.nav-link.router-link-exact-active {
  background: var(--brand-soft);
  color: var(--brand-dark);
}
[data-theme='dark'] .nav-link.router-link-exact-active,
[data-theme='dark'] .nav-link:hover {
  color: var(--brand);
}
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.search-input {
  width: 190px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--ink);
  font-size: 13.5px;
  font-family: inherit;
  transition: width 0.25s, border-color 0.2s;
}
.search-input:focus {
  outline: none;
  width: 240px;
  border-color: var(--brand);
}
.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
  transition: all 0.2s;
}
.icon-btn:hover {
  border-color: var(--brand);
  transform: translateY(-1px);
}
.menu-btn {
  display: none;
}

@media (max-width: 1040px) {
  .nav {
    position: fixed;
    inset: var(--header-h) 0 auto 0;
    flex-direction: column;
    align-items: stretch;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: 12px 20px 20px;
    gap: 6px;
    display: none;
    box-shadow: var(--shadow);
  }
  .nav.open {
    display: flex;
  }
  .menu-btn {
    display: block;
  }
  .search-input {
    width: 130px;
  }
  .search-input:focus {
    width: 170px;
  }
  .brand-text small {
    display: none;
  }
}

@media (max-width: 560px) {
  .search {
    display: none;
  }
}
</style>
