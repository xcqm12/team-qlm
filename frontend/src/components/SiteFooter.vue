<template>
  <footer class="footer">
    <div class="container footer-grid">
      <div class="col brand-col">
        <div class="brand">
          <img :src="site.logoUrl" :alt="site.siteName" class="logo" />
          <div>
            <strong>{{ site.siteName }}</strong>
            <p class="muted small">{{ site.slogan }}</p>
          </div>
        </div>
        <p class="muted small desc">{{ site.settings.site_description }}</p>
      </div>

      <div class="col">
        <h4>联系方式</h4>
        <ul class="list">
          <li>邮箱：<a :href="`mailto:${site.settings.contact_email}`">{{ site.settings.contact_email }}</a></li>
          <li>地址：{{ site.settings.contact_address }}</li>
          <li>时间：{{ site.settings.contact_hours }}</li>
          <li v-if="site.settings.founded_at">成立：{{ site.settings.founded_at }}</li>
        </ul>
      </div>

      <div class="col">
        <h4>发布平台</h4>
        <ul class="list">
          <li><a :href="site.settings.platform_mc" target="_blank" rel="noopener">网易我的世界 →</a></li>
          <li><a :href="site.settings.platform_curseforge" target="_blank" rel="noopener">CurseForge →</a></li>
          <li><a :href="site.settings.platform_modrinth" target="_blank" rel="noopener">Modrinth →</a></li>
          <li><a :href="site.settings.platform_github" target="_blank" rel="noopener">GitHub →</a></li>
        </ul>
      </div>

      <div class="col">
        <h4>快速导航</h4>
        <ul class="list">
          <li><router-link to="/projects">项目作品</router-link></li>
          <li><router-link to="/news">新闻动态</router-link></li>
          <li><router-link to="/files">文件下载</router-link></li>
          <li><router-link to="/contact">联系我们</router-link></li>
        </ul>
      </div>
    </div>

    <div class="bottom">
      <div class="container bottom-inner">
        <span>© 2019-{{ year }} {{ site.siteName }} · {{ site.settings.footer_note }}</span>
        <span class="flex" style="gap: 16px">
          <a v-if="site.settings.icp" href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">
            {{ site.settings.icp }}
          </a>
          <router-link to="/admin/login">后台管理</router-link>
        </span>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSiteStore } from '@/stores/site'

const site = useSiteStore()
const year = computed(() => new Date().getFullYear())
</script>

<style scoped>
.footer {
  margin-top: 56px;
  background: var(--surface);
  border-top: 1px solid var(--border);
}
.footer-grid {
  display: grid;
  grid-template-columns: 1.6fr 1fr 1fr 1fr;
  gap: 32px;
  padding: 40px 20px 28px;
}
.col h4 {
  font-size: 14px;
  margin-bottom: 12px;
  color: var(--ink);
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.logo {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  object-fit: contain;
  background: #fff;
}
.brand strong {
  font-size: 16px;
}
.desc {
  max-width: 320px;
  margin: 0;
}
.list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  color: var(--ink-2);
}
.bottom {
  border-top: 1px solid var(--border);
  padding: 16px 0;
  font-size: 13px;
  color: var(--muted);
}
.bottom-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

@media (max-width: 900px) {
  .footer-grid {
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
}
@media (max-width: 560px) {
  .footer-grid {
    grid-template-columns: 1fr;
  }
}
</style>
