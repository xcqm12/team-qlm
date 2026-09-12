<template>
  <div class="home">
    <!-- Hero -->
    <section class="hero">
      <div class="container hero-inner">
        <div class="hero-text fade-up">
          <span class="badge badge-accent">Seven Zero Meow · 成立于 {{ site.settings.founded_at || '2019-11-11' }}</span>
          <h1>{{ site.siteName }}</h1>
          <p class="slogan">{{ site.slogan }}</p>
          <p class="desc">{{ site.settings.site_description }}</p>
          <div class="hero-actions">
            <router-link to="/projects" class="btn btn-primary">浏览项目</router-link>
            <router-link to="/files" class="btn btn-ghost">文件下载</router-link>
            <router-link to="/about" class="btn btn-ghost">了解团队</router-link>
          </div>
          <dl class="stats">
            <div>
              <dt>{{ stats.project_count ?? 0 }}</dt>
              <dd>项目作品</dd>
            </div>
            <div>
              <dt>{{ stats.member_count ?? 0 }}</dt>
              <dd>团队成员</dd>
            </div>
            <div>
              <dt>{{ stats.file_count ?? 0 }}</dt>
              <dd>可下载文件</dd>
            </div>
            <div>
              <dt>{{ stats.download_count ?? 0 }}</dt>
              <dd>累计下载</dd>
            </div>
          </dl>
        </div>
        <div class="hero-art fade-up">
          <img :src="site.logoUrl" :alt="site.siteName" class="hero-logo" />
        </div>
      </div>
    </section>

    <!-- 精选项目 -->
    <section class="container block">
      <div class="section-head">
        <div>
          <h2>精选项目</h2>
          <p class="sub">团队发布的优秀作品</p>
        </div>
        <router-link to="/projects" class="btn btn-ghost btn-sm">全部项目 →</router-link>
      </div>

      <LoadingBlock v-if="loadingProjects" />
      <div v-else-if="projects.length" class="grid grid-2">
        <ProjectCard v-for="project in projects" :key="project.id" :project="project" />
      </div>
      <EmptyState v-else title="暂无项目" description="项目上线后会在这里展示" />
    </section>

    <!-- 最新动态 -->
    <section class="container block">
      <div class="section-head">
        <div>
          <h2>最新动态</h2>
          <p class="sub">团队最新新闻与资讯</p>
        </div>
        <router-link to="/news" class="btn btn-ghost btn-sm">全部动态 →</router-link>
      </div>

      <LoadingBlock v-if="loadingNews" />
      <div v-else-if="news.length" class="grid grid-3">
        <NewsCard v-for="item in news" :key="item.id" :item="item" />
      </div>
      <EmptyState v-else title="暂无动态" />
    </section>

    <!-- 文件下载快捷入口 -->
    <section class="container block">
      <div class="download-band">
        <div>
          <h2>文件下载中心</h2>
          <p class="muted">
            模组、工具与文档统一存放，支持在线预览与断点下载，并提供第三方网盘 / 平台下载入口。当前共
            <strong>{{ stats.file_count ?? 0 }}</strong> 个条目（本站 <strong>{{ stats.local_file_count ?? 0 }}</strong> 个 ·
            第三方 <strong>{{ stats.external_file_count ?? 0 }}</strong> 个），本站文件占用
            <strong>{{ stats.fileSizeText || '0 B' }}</strong>。
          </p>
        </div>
        <router-link to="/files" class="btn btn-primary">前往下载中心</router-link>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { newsApi, projectApi, type NewsItem, type Project, type SiteStats } from '@/api'
import { useSiteStore } from '@/stores/site'
import ProjectCard from '@/components/ProjectCard.vue'
import NewsCard from '@/components/NewsCard.vue'
import LoadingBlock from '@/components/LoadingBlock.vue'
import EmptyState from '@/components/EmptyState.vue'

const site = useSiteStore()
const projects = ref<Project[]>([])
const news = ref<NewsItem[]>([])
const loadingProjects = ref(true)
const loadingNews = ref(true)

const stats = computed<Partial<SiteStats>>(() => site.stats || {})

onMounted(async () => {
  site.loadStats()
  try {
    const data = await projectApi.list({ pageSize: 4 })
    projects.value = data.data.items
  } finally {
    loadingProjects.value = false
  }
  try {
    const data = await newsApi.list({ pageSize: 4 })
    news.value = data.data.items
  } finally {
    loadingNews.value = false
  }
})
</script>

<style scoped>
.hero {
  background: radial-gradient(circle at 12% 20%, var(--brand-soft), transparent 55%),
    radial-gradient(circle at 88% 10%, var(--accent-soft), transparent 50%), var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 64px 0 56px;
}
.hero-inner {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  align-items: center;
  gap: 40px;
}
.hero-text h1 {
  font-size: clamp(32px, 5vw, 52px);
  margin: 14px 0 6px;
  letter-spacing: 2px;
}
.slogan {
  font-size: 19px;
  color: var(--brand-dark);
  font-weight: 600;
  margin-bottom: 12px;
}
[data-theme='dark'] .slogan {
  color: var(--brand);
}
.desc {
  color: var(--ink-2);
  max-width: 560px;
}
.hero-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin: 22px 0 30px;
}
.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(70px, 1fr));
  gap: 16px;
  margin: 0;
  padding-top: 20px;
  border-top: 1px dashed var(--border);
}
.stats dt {
  font-size: 26px;
  font-weight: 800;
  color: var(--brand);
  line-height: 1.1;
}
.stats dd {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--muted);
}
.hero-art {
  display: flex;
  justify-content: center;
}
.hero-logo {
  width: min(320px, 80%);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  background: #fff;
  animation: float 6s ease-in-out infinite;
}
@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-12px);
  }
}
.block {
  margin-top: 54px;
}
.download-band {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 28px 32px;
  border-radius: var(--radius-lg);
  background: linear-gradient(120deg, var(--brand-soft), var(--accent-soft));
  border: 1px solid var(--border);
  flex-wrap: wrap;
}
.download-band h2 {
  margin-bottom: 6px;
}
.download-band p {
  margin: 0;
}

@media (max-width: 900px) {
  .hero-inner {
    grid-template-columns: 1fr;
    text-align: center;
  }
  .hero-art {
    order: -1;
  }
  .hero-actions {
    justify-content: center;
  }
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
