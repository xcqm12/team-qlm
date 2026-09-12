<template>
  <div class="page container">
    <LoadingBlock v-if="loading" text="正在加载项目详情…" />
    <EmptyState v-else-if="!project" emoji="🚧" title="项目不存在" description="该项目可能已被移除">
      <router-link to="/projects" class="btn btn-primary mt-16">返回项目列表</router-link>
    </EmptyState>

    <template v-else>
      <nav class="crumbs small muted">
        <router-link to="/">首页</router-link> /
        <router-link to="/projects">项目作品</router-link> /
        <span>{{ project.title }}</span>
      </nav>

      <header class="detail-head card">
        <div class="card-body head-body">
          <div class="head-main">
            <div class="flex flex-wrap" style="gap: 8px">
              <span class="badge">{{ project.category }}</span>
              <span v-if="project.version" class="badge badge-accent">{{ project.version }}</span>
              <span v-if="project.status !== 'published'" class="badge badge-muted">未发布</span>
            </div>
            <h1>{{ project.title }}</h1>
            <p class="muted">{{ project.summary }}</p>
            <div class="flex flex-wrap small muted" style="gap: 14px">
              <span>👁 {{ project.views }} 次浏览</span>
              <span>🕒 更新于 {{ formatDate(project.updated_at, false) }}</span>
              <span v-if="project.tags">🏷 {{ project.tags }}</span>
            </div>
            <div class="flex flex-wrap mt-16" style="gap: 10px">
              <a v-if="downloadFiles.length" class="btn btn-primary" :href="downloadFiles[0].downloadUrl">
                下载最新版本
              </a>
              <a v-if="project.repo_url" class="btn btn-ghost" :href="project.repo_url" target="_blank" rel="noopener">
                源码仓库
              </a>
              <a v-if="project.external_url" class="btn btn-ghost" :href="project.external_url" target="_blank" rel="noopener">
                外部页面
              </a>
            </div>
          </div>
          <div v-if="project.cover" class="head-cover">
            <img :src="project.cover.thumbnailUrl || project.cover.url" :alt="project.title" />
          </div>
        </div>
      </header>

      <div class="detail-grid">
        <article class="card">
          <div class="card-body">
            <MarkdownContent :content="project.content" />
          </div>
        </article>

        <aside class="side">
          <section class="card">
            <div class="card-body">
              <h3>相关文件</h3>
              <p v-if="!files.length" class="muted small">该项目暂未上传下载文件。</p>
              <ul v-else class="file-list">
                <li v-for="file in files" :key="file.id">
                  <div class="file-info">
                    <strong class="text-clip">{{ file.originalName }}</strong>
                    <span class="small muted">
                      {{ file.sizeText }} · 下载 {{ file.downloadCount }} 次
                      <template v-if="file.isExternal"> · 第三方{{ file.provider ? ' · ' + file.provider : '' }}</template>
                    </span>
                    <span v-if="file.isExternal && file.accessCode" class="small muted">
                      提取码：<code>{{ file.accessCode }}</code>
                    </span>
                  </div>
                  <a
                    class="btn btn-ghost btn-sm"
                    :href="file.downloadUrl"
                    :target="file.isExternal ? '_blank' : undefined"
                    :rel="file.isExternal ? 'noopener noreferrer' : undefined"
                  >
                    {{ file.isExternal ? '前往 ↗' : '下载' }}
                  </a>
                </li>
              </ul>
            </div>
          </section>

          <section class="card">
            <div class="card-body">
              <h3>更多项目</h3>
              <ul class="more-list">
                <li v-for="item in others" :key="item.id">
                  <router-link :to="`/projects/${item.slug}`">
                    <strong>{{ item.title }}</strong>
                    <span class="small muted">{{ item.category }} · {{ item.version || '—' }}</span>
                  </router-link>
                </li>
                <li v-if="!others.length" class="muted small">暂无其他项目</li>
              </ul>
            </div>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { projectApi, type FileItem, type Project } from '@/api'
import MarkdownContent from '@/components/MarkdownContent.vue'
import LoadingBlock from '@/components/LoadingBlock.vue'
import EmptyState from '@/components/EmptyState.vue'
import { formatDate } from '@/utils/format'

const route = useRoute()
const project = ref<Project | null>(null)
const files = ref<FileItem[]>([])
const others = ref<Project[]>([])
const loading = ref(true)

const downloadFiles = computed(() => files.value)

const load = async () => {
  loading.value = true
  project.value = null
  try {
    const res = await projectApi.detail(String(route.params.slug))
    project.value = res.project
    files.value = res.files
    document.title = `${res.project.title} · 项目作品`
    const list = await projectApi.list({ pageSize: 6 })
    others.value = list.data.items.filter((item) => item.slug !== String(route.params.slug)).slice(0, 5)
  } catch {
    project.value = null
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => route.params.slug, load)
</script>

<style scoped>
.crumbs {
  margin-bottom: 14px;
}
.detail-head {
  margin-bottom: 22px;
}
.head-body {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 24px;
}
.head-main h1 {
  font-size: clamp(24px, 3.6vw, 34px);
  margin: 12px 0 8px;
}
.head-cover img {
  width: 100%;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 22px;
  align-items: start;
}
.side {
  display: flex;
  flex-direction: column;
  gap: 18px;
  position: sticky;
  top: calc(var(--header-h) + 16px);
}
.side h3 {
  font-size: 15px;
  margin-bottom: 12px;
}
.file-list,
.more-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.file-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
}
.file-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  font-size: 14px;
}
.more-list a {
  display: flex;
  flex-direction: column;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--ink);
}
.more-list a:hover {
  background: var(--brand-soft);
  color: var(--brand-dark);
}

@media (max-width: 980px) {
  .head-body,
  .detail-grid {
    grid-template-columns: 1fr;
  }
  .side {
    position: static;
  }
}
</style>
