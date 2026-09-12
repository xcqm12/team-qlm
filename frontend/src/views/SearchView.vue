<template>
  <div class="page container">
    <div class="section-head">
      <div>
        <h1>搜索结果</h1>
        <p class="sub">关键词：<strong>{{ keyword }}</strong></p>
      </div>
    </div>

    <LoadingBlock v-if="loading" />
    <template v-else>
      <section v-if="result.projects?.length" class="block">
        <h2 class="group-title">项目作品</h2>
        <div class="result-list">
          <router-link v-for="item in result.projects" :key="item.id" class="result card" :to="`/projects/${item.slug}`">
            <strong>{{ item.title }}</strong>
            <span class="small muted">{{ item.category }} · {{ item.version }}</span>
            <p class="small clamp-2">{{ item.summary }}</p>
          </router-link>
        </div>
      </section>

      <section v-if="result.news?.length" class="block">
        <h2 class="group-title">新闻动态</h2>
        <div class="result-list">
          <router-link v-for="item in result.news" :key="item.id" class="result card" :to="`/news/${item.slug}`">
            <strong>{{ item.title }}</strong>
            <span class="small muted">{{ formatDate(item.published_at, false) }}</span>
            <p class="small clamp-2">{{ item.summary }}</p>
          </router-link>
        </div>
      </section>

      <section v-if="result.files?.length" class="block">
        <h2 class="group-title">文件</h2>
        <div class="result-list">
          <a v-for="item in result.files" :key="item.id" class="result card" :href="`/api/files/${item.id}/download`">
            <strong>{{ item.original_name }}</strong>
            <span class="small muted">{{ item.category }} · {{ formatBytes(item.size) }}</span>
          </a>
        </div>
      </section>

      <EmptyState v-if="isEmpty" emoji="🔍" title="没有找到相关内容" description="试试更换关键词，或浏览项目与动态页面" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { siteApi } from '@/api'
import LoadingBlock from '@/components/LoadingBlock.vue'
import EmptyState from '@/components/EmptyState.vue'
import { formatBytes, formatDate } from '@/utils/format'

const route = useRoute()
const loading = ref(true)
const keyword = ref('')
const result = ref<any>({ projects: [], news: [], files: [] })

const isEmpty = computed(
  () => !result.value.projects?.length && !result.value.news?.length && !result.value.files?.length
)

const load = async () => {
  keyword.value = String(route.query.q || '')
  if (!keyword.value) {
    result.value = { projects: [], news: [], files: [] }
    loading.value = false
    return
  }
  loading.value = true
  try {
    const data = await siteApi.search(keyword.value)
    result.value = data
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => route.query.q, load)
</script>

<style scoped>
.block {
  margin-bottom: 32px;
}
.group-title {
  font-size: 18px;
  margin-bottom: 14px;
  padding-left: 10px;
  border-left: 4px solid var(--brand);
}
.result-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}
.result {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  color: var(--ink);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  transition: all 0.2s;
}
.result:hover {
  border-color: var(--brand);
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}
.result p {
  margin: 0;
  color: var(--ink-2);
}
</style>
