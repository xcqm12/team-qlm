<template>
  <div class="page container center not-found">
    <img :src="site.logoUrl" :alt="site.siteName" class="logo" />
    <h1>404</h1>
    <p class="muted">找不到这个页面，可能它已经被移动或删除了。</p>
    <div class="flex" style="justify-content: center; gap: 10px">
      <router-link to="/" class="btn btn-primary">返回首页</router-link>
      <router-link to="/files" class="btn btn-ghost">文件下载</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSiteStore } from '@/stores/site'
const site = useSiteStore()
</script>

<style scoped>
.not-found {
  padding: 80px 20px;
}
.logo {
  width: 96px;
  border-radius: 20px;
  background: #fff;
  box-shadow: var(--shadow-sm);
}
.not-found h1 {
  font-size: 68px;
  margin: 16px 0 6px;
  background: linear-gradient(135deg, var(--brand), var(--accent));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
</style>
