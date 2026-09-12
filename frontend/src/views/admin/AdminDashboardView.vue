<template>
  <div class="dashboard">
    <LoadingBlock v-if="loading" text="正在加载控制台数据…" />

    <template v-else>
      <div class="grid grid-4">
        <div v-for="card in cards" :key="card.label" class="card stat">
          <div class="card-body">
            <span class="ico">{{ card.icon }}</span>
            <div>
              <strong>{{ card.value }}</strong>
              <span class="muted small">{{ card.label }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="panels">
        <section class="card">
          <div class="card-body">
            <div class="flex-between mb-16">
              <h3>最近上传</h3>
              <router-link to="/admin/files" class="small">全部文件 →</router-link>
            </div>
            <table v-if="data.recentFiles?.length" class="table">
              <thead>
                <tr>
                  <th>文件名</th>
                  <th>分类</th>
                  <th>大小</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="file in data.recentFiles" :key="file.id">
                  <td class="text-clip" style="max-width: 260px">{{ file.original_name }}</td>
                  <td><span class="badge badge-muted">{{ file.category }}</span></td>
                  <td>{{ formatBytes(file.size) }}</td>
                  <td class="muted small">{{ formatDate(file.created_at) }}</td>
                </tr>
              </tbody>
            </table>
            <p v-else class="muted small">还没有上传任何文件。</p>
          </div>
        </section>

        <section class="card">
          <div class="card-body">
            <div class="flex-between mb-16">
              <h3>最新留言</h3>
              <router-link to="/admin/messages" class="small">全部留言 →</router-link>
            </div>
            <ul v-if="data.recentMessages?.length" class="msg-list">
              <li v-for="msg in data.recentMessages" :key="msg.id">
                <div class="msg-head">
                  <strong>{{ msg.name }}</strong>
                  <span class="badge" :class="msg.status === 'new' ? '' : 'badge-muted'">{{ statusText(msg.status) }}</span>
                </div>
                <span class="small muted">{{ msg.email }} · {{ formatDate(msg.created_at) }}</span>
              </li>
            </ul>
            <p v-else class="muted small">暂无留言。</p>
          </div>
        </section>

        <section class="card">
          <div class="card-body">
            <h3>运行环境</h3>
            <ul class="env-list">
              <li><span>后端版本</span><strong>{{ data.runtime?.version }}</strong></li>
              <li><span>Node.js</span><strong>{{ data.runtime?.node }}</strong></li>
              <li><span>运行模式</span><strong>{{ data.runtime?.env }}</strong></li>
              <li><span>运行时长</span><strong>{{ uptimeText }}</strong></li>
              <li><span>数据库</span><strong class="text-clip" :title="data.runtime?.dbFile">{{ data.runtime?.dbFile }}</strong></li>
              <li><span>上传目录</span><strong class="text-clip" :title="data.runtime?.uploadDir">{{ data.runtime?.uploadDir }}</strong></li>
              <li><span>单文件上限</span><strong>{{ data.runtime?.maxUploadSizeText }}</strong></li>
            </ul>
            <div class="flex mt-16" style="gap: 8px; flex-wrap: wrap">
              <button class="btn btn-ghost btn-sm" :disabled="busy" @click="cleanup">清理无主文件</button>
              <a class="btn btn-ghost btn-sm" href="/api/site/backup">下载数据库备份</a>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-body">
            <h3>操作日志</h3>
            <ul v-if="data.recentAudits?.length" class="audit-list">
              <li v-for="log in data.recentAudits" :key="log.id">
                <span class="badge badge-muted">{{ log.action }}</span>
                <span class="text-clip">{{ log.target }}</span>
                <span class="small muted">{{ log.username || 'system' }} · {{ formatDate(log.created_at) }}</span>
              </li>
            </ul>
            <p v-else class="muted small">暂无操作记录。</p>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { siteApi } from '@/api'
import LoadingBlock from '@/components/LoadingBlock.vue'
import { useToast } from '@/composables/useToast'
import { formatBytes, formatDate } from '@/utils/format'

const toast = useToast()
const loading = ref(true)
const busy = ref(false)
const data = ref<any>({ stats: {}, recentFiles: [], recentMessages: [], recentAudits: [], runtime: {} })

const cards = computed(() => {
  const stats = data.value.stats || {}
  return [
    { icon: '🚀', label: '项目作品', value: stats.project_count ?? 0 },
    { icon: '📰', label: '新闻动态', value: stats.news_count ?? 0 },
    { icon: '📁', label: '文件条目', value: stats.file_count ?? 0 },
    { icon: '💾', label: '本地文件占用', value: stats.fileSizeText || '0 B' },
    { icon: '🔗', label: '第三方下载', value: stats.external_file_count ?? 0 },
    { icon: '⬇️', label: '累计下载', value: stats.download_count ?? 0 },
    { icon: '👥', label: '团队成员', value: stats.member_count ?? 0 },
    { icon: '✉️', label: '未读留言', value: stats.unread_message_count ?? 0 },
    { icon: '🕒', label: '运行时长', value: uptimeText.value }
  ]
})

const uptimeText = computed(() => {
  const seconds = Number(data.value.runtime?.uptimeSeconds || 0)
  if (seconds < 60) return `${seconds} 秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时`
  return `${Math.floor(seconds / 86400)} 天`
})

const statusText = (status: string) =>
  ({ new: '未读', read: '已读', replied: '已回复', archived: '已归档' })[status] || status

const load = async () => {
  loading.value = true
  try {
    data.value = await siteApi.dashboard()
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    loading.value = false
  }
}

const cleanup = async () => {
  busy.value = true
  try {
    const res = await siteApi.cleanupOrphans()
    toast.success(`已清理 ${res.count} 个无主文件`)
    await load()
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.stat .card-body {
  display: flex;
  align-items: center;
  gap: 14px;
}
.stat .ico {
  font-size: 26px;
}
.stat strong {
  display: block;
  font-size: 22px;
  line-height: 1.2;
}
.panels {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
  gap: 18px;
}
.panels h3 {
  font-size: 15.5px;
  margin: 0;
}
.msg-list,
.audit-list,
.env-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 14px;
}
.msg-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.env-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--border);
}
.env-list span {
  color: var(--muted);
  font-size: 13px;
}
.env-list strong {
  font-size: 13px;
  max-width: 60%;
  text-align: right;
}
.audit-list li {
  display: flex;
  align-items: center;
  gap: 10px;
}

@media (max-width: 560px) {
  .panels {
    grid-template-columns: 1fr;
  }
}
</style>
