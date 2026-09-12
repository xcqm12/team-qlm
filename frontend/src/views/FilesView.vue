<template>
  <div class="page container">
    <div class="section-head">
      <div>
        <h1>文件下载</h1>
        <p class="sub">
          共 {{ total }} 个条目 · 本站 {{ sources.local }} 个（{{ summary.sizeText || '0 B' }}）· 第三方
          {{ sources.external }} 个 · 累计下载 {{ summary.downloads || 0 }} 次
        </p>
      </div>
    </div>

    <div class="source-tabs">
      <button
        v-for="tab in sourceTabs"
        :key="tab.value"
        class="source-tab"
        :class="{ active: source === tab.value }"
        @click="selectSource(tab.value)"
      >
        <span class="ico">{{ tab.icon }}</span>
        {{ tab.label }}
        <span class="count">{{ tab.count }}</span>
      </button>
      <span class="tip small muted">
        第三方条目由网盘 / 平台 / Release 页提供文件，地址与按钮文案均可在后台自定义
      </span>
    </div>

    <div class="toolbar">
      <input v-model="keyword" class="input" placeholder="搜索文件名 / 说明 / 版本 / 平台" @keyup.enter="reload(1)" />
      <select v-model="category" class="select" @change="reload(1)">
        <option value="">全部分类</option>
        <option v-for="c in categories" :key="c.name" :value="c.name">{{ c.name }}（{{ c.count }}）</option>
      </select>
      <select v-model="kind" class="select" @change="reload(1)">
        <option value="">全部类型</option>
        <option value="link">第三方链接</option>
        <option value="image">图片</option>
        <option value="video">视频</option>
        <option value="archive">压缩包</option>
        <option value="document">文档</option>
      </select>
      <select v-model="sort" class="select" @change="reload(1)">
        <option value="newest">最新上传</option>
        <option value="pinned">置顶优先</option>
        <option value="downloads">下载最多</option>
        <option value="size">文件最大</option>
        <option value="name">按名称</option>
      </select>
      <button class="btn btn-primary btn-sm" @click="reload(1)">搜索</button>
    </div>

    <LoadingBlock v-if="loading" text="正在读取文件列表…" />
    <template v-else>
      <div v-if="items.length" class="grid grid-4">
        <FileCard v-for="file in items" :key="file.id" :file="file" @preview="preview = $event" />
      </div>
      <EmptyState v-else emoji="📁" title="没有找到文件" description="调整筛选条件，或等待管理员上传新文件 / 添加第三方下载" />
      <Pagination :page="page" :total-pages="totalPages" :total="total" @change="reload" />
    </template>

    <ImageLightbox :file="preview" @close="preview = null" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fileApi, type FileItem } from '@/api'
import FileCard from '@/components/FileCard.vue'
import Pagination from '@/components/Pagination.vue'
import LoadingBlock from '@/components/LoadingBlock.vue'
import EmptyState from '@/components/EmptyState.vue'
import ImageLightbox from '@/components/ImageLightbox.vue'

const items = ref<FileItem[]>([])
const categories = ref<{ name: string; count: number }[]>([])
const summary = ref<{ sizeText?: string; downloads?: number }>({})
const sources = ref({ all: 0, local: 0, external: 0 })
const loading = ref(true)
const keyword = ref('')
const category = ref('')
const kind = ref('')
const source = ref<'' | 'local' | 'external'>('')
const sort = ref('newest')
const page = ref(1)
const total = ref(0)
const totalPages = ref(1)
const preview = ref<FileItem | null>(null)

const sourceTabs = computed(() => [
  { value: '' as const, label: '全部', icon: '📚', count: sources.value.all },
  { value: 'local' as const, label: '本站文件', icon: '💾', count: sources.value.local },
  { value: 'external' as const, label: '第三方下载', icon: '🔗', count: sources.value.external }
])

const selectSource = (value: '' | 'local' | 'external') => {
  source.value = value
  reload(1)
}

const reload = async (target = 1) => {
  loading.value = true
  try {
    const res = await fileApi.list({
      page: target,
      pageSize: 12,
      q: keyword.value,
      category: category.value,
      kind: kind.value,
      source: source.value,
      sort: sort.value
    })
    items.value = res.data.items
    summary.value = res.data.summary || {}
    total.value = res.data.total
    totalPages.value = res.data.totalPages
    page.value = res.data.page
  } finally {
    loading.value = false
  }
}

const loadFacets = async () => {
  const res = await fileApi.categories().catch(() => null)
  if (!res) return
  categories.value = res.categories
  if (res.sources) sources.value = res.sources
}

onMounted(async () => {
  await Promise.all([loadFacets(), reload(1)])
})
</script>

<style scoped>
.source-tabs {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.source-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink-2);
  font-size: 14px;
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.source-tab:hover {
  border-color: var(--brand);
  color: var(--brand);
}
.source-tab.active {
  background: linear-gradient(135deg, var(--brand), var(--accent));
  border-color: transparent;
  color: #fff;
  box-shadow: 0 8px 20px rgba(18, 136, 240, 0.24);
}
.source-tab .count {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--bg-alt);
  color: var(--muted);
}
.source-tab.active .count {
  background: rgba(255, 255, 255, 0.24);
  color: #fff;
}
.tip {
  margin-left: auto;
}
.toolbar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 22px;
  padding: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.toolbar .input {
  flex: 1;
  min-width: 200px;
}
.toolbar .select {
  width: 160px;
}

@media (max-width: 720px) {
  .tip {
    margin-left: 0;
    width: 100%;
  }
  .toolbar .select {
    width: 100%;
  }
}
</style>
