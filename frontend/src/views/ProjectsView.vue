<template>
  <div class="page container">
    <div class="section-head">
      <div>
        <h1>项目作品</h1>
        <p class="sub">团队发布的游戏与软件作品，共 {{ total }} 个项目</p>
      </div>
      <div class="filter-bar">
        <input v-model="keyword" class="input" placeholder="搜索项目名称 / 标签" @keyup.enter="reload(1)" />
        <select v-model="category" class="select" @change="reload(1)">
          <option value="">全部分类</option>
          <option v-for="item in categories" :key="item.name" :value="item.name">
            {{ item.name }}（{{ item.count }}）
          </option>
        </select>
        <button class="btn btn-primary btn-sm" @click="reload(1)">搜索</button>
      </div>
    </div>

    <LoadingBlock v-if="loading" />
    <template v-else>
      <div v-if="items.length" class="grid grid-2">
        <ProjectCard v-for="project in items" :key="project.id" :project="project" />
      </div>
      <EmptyState v-else emoji="🔍" title="没有匹配的项目" description="换个关键词或分类试试" />
      <Pagination :page="page" :total-pages="totalPages" :total="total" @change="reload" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { projectApi, type Project } from '@/api'
import ProjectCard from '@/components/ProjectCard.vue'
import Pagination from '@/components/Pagination.vue'
import LoadingBlock from '@/components/LoadingBlock.vue'
import EmptyState from '@/components/EmptyState.vue'

const items = ref<Project[]>([])
const categories = ref<{ name: string; count: number }[]>([])
const loading = ref(true)
const keyword = ref('')
const category = ref('')
const page = ref(1)
const total = ref(0)
const totalPages = ref(1)

const reload = async (target = 1) => {
  loading.value = true
  try {
    const res = await projectApi.list({ page: target, pageSize: 8, q: keyword.value, category: category.value })
    items.value = res.data.items
    categories.value = res.data.categories
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
  flex-wrap: wrap;
  align-items: center;
}
.filter-bar .input {
  width: 220px;
}
.filter-bar .select {
  width: 180px;
}
</style>
