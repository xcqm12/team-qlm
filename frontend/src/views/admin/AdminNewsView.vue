<template>
  <div>
    <section class="card mb-16">
      <div class="card-body">
        <div class="flex-between mb-16">
          <h3>{{ editing ? `编辑动态 #${editing.id}` : '发布新动态' }}</h3>
          <div class="flex" style="gap: 8px">
            <button v-if="editing" class="btn btn-ghost btn-sm" @click="resetForm">取消编辑</button>
            <button class="btn btn-primary btn-sm" :disabled="saving" @click="save">
              {{ saving ? '保存中…' : editing ? '保存修改' : '发布动态' }}
            </button>
          </div>
        </div>

        <div class="two-col">
          <div class="field">
            <label>标题 *</label>
            <input v-model="form.title" class="input" placeholder="如：工作室更名公告" />
          </div>
          <div class="field">
            <label>分类</label>
            <input v-model="form.category" class="input" placeholder="动态 / 公告 / 更新" />
          </div>
        </div>
        <div class="two-col">
          <div class="field">
            <label>发布时间</label>
            <input v-model="form.publishedAt" class="input" type="datetime-local" />
          </div>
          <div class="field">
            <label>状态</label>
            <select v-model="form.status" class="select">
              <option value="published">已发布</option>
              <option value="draft">草稿</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label>摘要</label>
          <textarea v-model="form.summary" class="textarea" rows="2"></textarea>
        </div>
        <div class="field">
          <label>正文（支持 Markdown）</label>
          <textarea v-model="form.content" class="textarea code" rows="12"></textarea>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-body">
        <div class="toolbar">
          <input v-model="keyword" class="input" placeholder="搜索标题" @keyup.enter="reload(1)" />
          <label class="flex small muted" style="gap: 6px">
            <input v-model="showDraft" type="checkbox" @change="reload(1)" /> 包含草稿
          </label>
          <button class="btn btn-primary btn-sm" @click="reload(1)">搜索</button>
        </div>

        <LoadingBlock v-if="loading" />
        <div v-else class="table-wrap">
          <table v-if="items.length" class="table">
            <thead>
              <tr>
                <th>标题</th>
                <th>分类</th>
                <th>状态</th>
                <th>浏览</th>
                <th>发布时间</th>
                <th style="width: 170px">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in items" :key="item.id">
                <td>
                  <strong>{{ item.title }}</strong>
                  <div class="small muted">{{ item.slug }}</div>
                </td>
                <td><span class="badge badge-muted">{{ item.category }}</span></td>
                <td>
                  <span class="badge" :class="item.status === 'published' ? 'badge-accent' : 'badge-muted'">
                    {{ item.status === 'published' ? '已发布' : '草稿' }}
                  </span>
                </td>
                <td>{{ item.views }}</td>
                <td class="muted small">{{ formatDate(item.published_at) }}</td>
                <td>
                  <div class="flex" style="gap: 6px">
                    <router-link class="btn btn-ghost btn-sm" :to="`/news/${item.slug}`">查看</router-link>
                    <button class="btn btn-ghost btn-sm" @click="edit(item)">编辑</button>
                    <button class="btn btn-danger btn-sm" @click="remove(item)">删除</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <EmptyState v-else emoji="📰" title="还没有动态" />
        </div>
        <Pagination :page="page" :total-pages="totalPages" :total="total" @change="reload" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { newsApi, type NewsItem } from '@/api'
import { useToast } from '@/composables/useToast'
import LoadingBlock from '@/components/LoadingBlock.vue'
import EmptyState from '@/components/EmptyState.vue'
import Pagination from '@/components/Pagination.vue'
import { formatDate } from '@/utils/format'

const toast = useToast()
const items = ref<NewsItem[]>([])
const loading = ref(true)
const saving = ref(false)
const editing = ref<NewsItem | null>(null)
const keyword = ref('')
const showDraft = ref(true)
const page = ref(1)
const total = ref(0)
const totalPages = ref(1)

const nowLocal = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const emptyForm = () => ({
  title: '',
  category: '动态',
  summary: '',
  content: '',
  status: 'published',
  publishedAt: nowLocal()
})

const form = ref(emptyForm())

const reload = async (target = 1) => {
  loading.value = true
  try {
    const res = await newsApi.list({ page: target, pageSize: 12, q: keyword.value, scope: showDraft.value ? 'all' : undefined })
    items.value = res.data.items
    total.value = res.data.total
    totalPages.value = res.data.totalPages
    page.value = res.data.page
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  editing.value = null
  form.value = emptyForm()
}

const edit = (item: NewsItem) => {
  editing.value = item
  const value = String(item.published_at || '').replace(' ', 'T').slice(0, 16)
  form.value = {
    title: item.title,
    category: item.category,
    summary: item.summary,
    content: item.content,
    status: item.status,
    publishedAt: value || nowLocal()
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const save = async () => {
  if (!form.value.title.trim()) {
    toast.error('请填写标题')
    return
  }
  saving.value = true
  const payload = { ...form.value, publishedAt: form.value.publishedAt.replace('T', ' ') + ':00' }
  try {
    if (editing.value) {
      await newsApi.update(editing.value.id, payload)
      toast.success('动态已更新')
    } else {
      await newsApi.create(payload)
      toast.success('动态已发布')
    }
    resetForm()
    await reload(1)
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    saving.value = false
  }
}

const remove = async (item: NewsItem) => {
  if (!confirm(`确定删除「${item.title}」？`)) return
  try {
    await newsApi.remove(item.id)
    toast.success('已删除')
    await reload(page.value)
  } catch (err: any) {
    toast.error(err.message)
  }
}

onMounted(() => reload(1))
</script>

<style scoped>
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.code {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 13px;
}
.toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.toolbar .input {
  flex: 1;
  min-width: 180px;
}
.table-wrap {
  overflow-x: auto;
}
</style>
