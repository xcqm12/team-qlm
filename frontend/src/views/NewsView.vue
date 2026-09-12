<template>
  <div class="page container">
    <div class="section-head">
      <div>
        <h1>新闻动态</h1>
        <p class="sub">团队最新新闻与资讯，共 {{ total }} 条</p>
      </div>
      <div class="filter-bar">
        <input v-model="keyword" class="input" placeholder="搜索标题" @keyup.enter="reload(1)" />
        <button class="btn btn-primary btn-sm" @click="reload(1)">搜索</button>
      </div>
    </div>

    <LoadingBlock v-if="loading" />
    <template v-else>
      <div v-if="items.length" class="grid grid-3">
        <NewsCard v-for="item in items" :key="item.id" :item="item" />
      </div>
      <EmptyState v-else emoji="📰" title="暂无动态" />
      <Pagination :page="page" :total-pages="totalPages" :total="total" @change="reload" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { newsApi, type NewsItem } from '@/api'
import NewsCard from '@/components/NewsCard.vue'
import Pagination from '@/components/Pagination.vue'
import LoadingBlock from '@/components/LoadingBlock.vue'
import EmptyState from '@/components/EmptyState.vue'

const items = ref<NewsItem[]>([])
const loading = ref(true)
const keyword = ref('')
const page = ref(1)
const total = ref(0)
const totalPages = ref(1)

const reload = async (target = 1) => {
  loading.value = true
  try {
    const res = await newsApi.list({ page: target, pageSize: 9, q: keyword.value })
    items.value = res.data.items
    total.value = res.data.total
    totalPages.value = res.data.totalPages
    page.value = res.data.page
  } finally {
    loading.value = false
  }
}

onMounted(() => reload(1))
</script>

<style scoped>
.filter-bar {
  display: flex;
  gap: 10px;
}
.filter-bar .input {
  width: 220px;
}
</style>
