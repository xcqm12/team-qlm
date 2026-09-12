<template>
  <div class="page container">
    <LoadingBlock v-if="loading" />
    <EmptyState v-else-if="!item" emoji="📰" title="新闻不存在">
      <router-link to="/news" class="btn btn-primary mt-16">返回动态列表</router-link>
    </EmptyState>

    <template v-else>
      <nav class="crumbs small muted">
        <router-link to="/">首页</router-link> / <router-link to="/news">新闻动态</router-link> /
        <span>{{ item.title }}</span>
      </nav>

      <article class="card">
        <div class="card-body">
          <header class="head">
            <span class="badge">{{ item.category }}</span>
            <h1>{{ item.title }}</h1>
            <div class="flex flex-wrap small muted" style="gap: 14px">
              <time>📅 {{ formatDate(item.published_at) }}</time>
              <span>👁 {{ item.views }} 次浏览</span>
            </div>
          </header>
          <img v-if="item.cover" class="cover" :src="item.cover.url" :alt="item.title" />
          <p class="lead">{{ item.summary }}</p>
          <MarkdownContent :content="item.content" />
        </div>
      </article>

      <div class="flex-between mt-24">
        <router-link to="/news" class="btn btn-ghost">← 返回动态列表</router-link>
        <router-link to="/contact" class="btn btn-primary">联系我们</router-link>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { newsApi, type NewsItem } from '@/api'
import MarkdownContent from '@/components/MarkdownContent.vue'
import LoadingBlock from '@/components/LoadingBlock.vue'
import EmptyState from '@/components/EmptyState.vue'
import { formatDate } from '@/utils/format'

const route = useRoute()
const item = ref<NewsItem | null>(null)
const loading = ref(true)

const load = async () => {
  loading.value = true
  try {
    const res = await newsApi.detail(String(route.params.slug))
    item.value = res.news
    document.title = `${res.news.title} · 新闻动态`
  } catch {
    item.value = null
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
.head h1 {
  font-size: clamp(22px, 3.4vw, 30px);
  margin: 12px 0 10px;
}
.cover {
  width: 100%;
  border-radius: var(--radius-sm);
  margin: 8px 0 20px;
}
.lead {
  padding: 14px 16px;
  border-left: 4px solid var(--brand);
  background: var(--brand-soft);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  color: var(--ink-2);
}
</style>
