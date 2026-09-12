<template>
  <article class="news-card card card-hover">
    <div class="card-body">
      <div class="head">
        <span class="badge">{{ item.category }}</span>
        <time class="small muted">{{ formatDate(item.published_at, false) }}</time>
      </div>
      <h3 class="title">
        <router-link :to="`/news/${item.slug}`">{{ item.title }}</router-link>
      </h3>
      <p class="muted small clamp-2 summary">{{ item.summary }}</p>
      <div class="footer small muted">
        <span>👁 {{ item.views }} 次浏览</span>
        <router-link class="read-more" :to="`/news/${item.slug}`">阅读全文 →</router-link>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { NewsItem } from '@/api'
import { formatDate } from '@/utils/format'

defineProps<{ item: NewsItem }>()
</script>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}
.title {
  font-size: 17px;
  margin-bottom: 8px;
}
.title a {
  color: var(--ink);
}
.title a:hover {
  color: var(--brand);
}
.summary {
  min-height: 42px;
}
.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}
.read-more {
  font-weight: 600;
}
</style>
