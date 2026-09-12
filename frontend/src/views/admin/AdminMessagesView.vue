<template>
  <div>
    <section class="card">
      <div class="card-body">
        <div class="toolbar">
          <select v-model="status" class="select" @change="reload(1)">
            <option value="">全部留言</option>
            <option value="new">未读（{{ unread }}）</option>
            <option value="read">已读</option>
            <option value="replied">已回复</option>
            <option value="archived">已归档</option>
          </select>
          <button class="btn btn-ghost btn-sm" @click="reload(1)">刷新</button>
        </div>

        <LoadingBlock v-if="loading" />
        <div v-else class="msg-grid">
          <article v-for="msg in items" :key="msg.id" class="card msg" :class="{ unread: msg.status === 'new' }">
            <div class="card-body">
              <div class="msg-head">
                <div>
                  <strong>{{ msg.name }}</strong>
                  <a class="small" :href="`mailto:${msg.email}`">{{ msg.email }}</a>
                </div>
                <span class="badge" :class="msg.status === 'new' ? '' : 'badge-muted'">{{ statusText(msg.status) }}</span>
              </div>
              <p v-if="msg.subject" class="small muted">主题：{{ msg.subject }}</p>
              <p class="content">{{ msg.content }}</p>
              <div class="flex-between">
                <span class="small muted">{{ formatDate(msg.created_at) }}</span>
                <div class="flex" style="gap: 6px">
                  <select class="select small-select" :value="msg.status" @change="setStatus(msg, ($event.target as HTMLSelectElement).value)">
                    <option value="new">未读</option>
                    <option value="read">已读</option>
                    <option value="replied">已回复</option>
                    <option value="archived">已归档</option>
                  </select>
                  <a class="btn btn-ghost btn-sm" :href="`mailto:${msg.email}?subject=回复：${encodeURIComponent(msg.subject || '您的留言')}`">
                    回复
                  </a>
                  <button class="btn btn-danger btn-sm" @click="remove(msg)">删除</button>
                </div>
              </div>
            </div>
          </article>
        </div>

        <EmptyState v-if="!loading && !items.length" emoji="✉️" title="暂无留言" />
        <Pagination :page="page" :total-pages="totalPages" :total="total" @change="reload" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { messageApi, type Message } from '@/api'
import { useToast } from '@/composables/useToast'
import LoadingBlock from '@/components/LoadingBlock.vue'
import EmptyState from '@/components/EmptyState.vue'
import Pagination from '@/components/Pagination.vue'
import { formatDate } from '@/utils/format'

const toast = useToast()
const items = ref<Message[]>([])
const loading = ref(true)
const status = ref('')
const unread = ref(0)
const page = ref(1)
const total = ref(0)
const totalPages = ref(1)

const statusText = (value: string) =>
  ({ new: '未读', read: '已读', replied: '已回复', archived: '已归档' })[value] || value

const reload = async (target = 1) => {
  loading.value = true
  try {
    const res = await messageApi.list({ status: status.value, page: target, pageSize: 10 })
    items.value = res.data.items
    unread.value = res.data.unread || 0
    total.value = res.data.total
    totalPages.value = res.data.totalPages
    page.value = res.data.page
  } finally {
    loading.value = false
  }
}

const setStatus = async (msg: Message, value: string) => {
  try {
    await messageApi.updateStatus(msg.id, value)
    msg.status = value as Message['status']
    toast.success('状态已更新')
    await reload(page.value)
  } catch (err: any) {
    toast.error(err.message)
  }
}

const remove = async (msg: Message) => {
  if (!confirm(`确定删除来自「${msg.name}」的留言？`)) return
  try {
    await messageApi.remove(msg.id)
    toast.success('已删除')
    await reload(page.value)
  } catch (err: any) {
    toast.error(err.message)
  }
}

onMounted(() => reload(1))
</script>

<style scoped>
.toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}
.toolbar .select {
  width: 200px;
}
.msg-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}
.msg.unread {
  border-left: 4px solid var(--brand);
}
.msg-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}
.msg-head a {
  display: block;
}
.content {
  color: var(--ink-2);
  font-size: 14.5px;
  white-space: pre-wrap;
  margin-bottom: 14px;
}
.small-select {
  width: 96px;
  padding: 5px 8px;
  font-size: 13px;
}
</style>
