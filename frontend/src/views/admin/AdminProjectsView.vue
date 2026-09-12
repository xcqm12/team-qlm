<template>
  <div>
    <section class="card mb-16">
      <div class="card-body">
        <div class="flex-between">
          <h3>{{ editing ? `编辑项目 #${editing.id}` : '新建项目' }}</h3>
          <div class="flex" style="gap: 8px">
            <button v-if="editing" class="btn btn-ghost btn-sm" @click="resetForm">取消编辑</button>
            <button class="btn btn-primary btn-sm" :disabled="saving" @click="save">
              {{ saving ? '保存中…' : editing ? '保存修改' : '创建项目' }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <div class="editor-grid">
      <section class="card">
        <div class="card-body">
          <div class="field">
            <label>项目标题 *</label>
            <input v-model="form.title" class="input" placeholder="如：高级超高清屏幕录制工具" />
          </div>
          <div class="two-col">
            <div class="field">
              <label>分类</label>
              <input v-model="form.category" class="input" list="category-list" placeholder="其他" />
              <datalist id="category-list">
                <option v-for="c in categories" :key="c.name" :value="c.name" />
              </datalist>
            </div>
            <div class="field">
              <label>版本号</label>
              <input v-model="form.version" class="input" placeholder="v1.0.0" />
            </div>
          </div>
          <div class="field">
            <label>一句话简介</label>
            <textarea v-model="form.summary" class="textarea" rows="2"></textarea>
          </div>
          <div class="field">
            <label>正文（支持 Markdown）</label>
            <textarea v-model="form.content" class="textarea code" rows="14"></textarea>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-body">
          <div class="field">
            <label>标签（英文逗号分隔）</label>
            <input v-model="form.tags" class="input" placeholder="Minecraft,Forge,模组" />
          </div>
          <div class="field">
            <label>源码仓库地址</label>
            <input v-model="form.repoUrl" class="input" placeholder="https://github.com/..." />
          </div>
          <div class="field">
            <label>外部页面地址</label>
            <input v-model="form.externalUrl" class="input" placeholder="https://..." />
          </div>
          <div class="two-col">
            <div class="field">
              <label>状态</label>
              <select v-model="form.status" class="select">
                <option value="published">已发布</option>
                <option value="draft">草稿</option>
              </select>
            </div>
            <div class="field">
              <label>排序（越小越前）</label>
              <input v-model.number="form.sortOrder" class="input" type="number" />
            </div>
          </div>
          <div class="field">
            <label>封面文件</label>
            <select v-model="form.coverFileId" class="select">
              <option :value="null">不使用封面</option>
              <option v-for="f in imageFiles" :key="f.id" :value="f.id">{{ f.originalName }}</option>
            </select>
            <div class="hint">仅显示图片类文件，可先在「文件管理」上传封面图</div>
          </div>
        </div>
      </section>
    </div>

    <section class="card mt-24">
      <div class="card-body">
        <div class="toolbar">
          <input v-model="keyword" class="input" placeholder="搜索项目" @keyup.enter="reload(1)" />
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
                <th>版本</th>
                <th>状态</th>
                <th>浏览</th>
                <th>更新时间</th>
                <th style="width: 170px">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="project in items" :key="project.id">
                <td>
                  <strong>{{ project.title }}</strong>
                  <div class="small muted text-clip" style="max-width: 320px">{{ project.slug }}</div>
                </td>
                <td><span class="badge badge-muted">{{ project.category }}</span></td>
                <td>{{ project.version || '—' }}</td>
                <td>
                  <span class="badge" :class="project.status === 'published' ? 'badge-accent' : 'badge-muted'">
                    {{ project.status === 'published' ? '已发布' : '草稿' }}
                  </span>
                </td>
                <td>{{ project.views }}</td>
                <td class="muted small">{{ formatDate(project.updated_at) }}</td>
                <td>
                  <div class="flex" style="gap: 6px">
                    <router-link class="btn btn-ghost btn-sm" :to="`/projects/${project.slug}`">查看</router-link>
                    <button class="btn btn-ghost btn-sm" @click="edit(project)">编辑</button>
                    <button class="btn btn-danger btn-sm" @click="remove(project)">删除</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <EmptyState v-else emoji="🚀" title="还没有项目" />
        </div>
        <Pagination :page="page" :total-pages="totalPages" :total="total" @change="reload" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fileApi, projectApi, type FileItem, type Project } from '@/api'
import { useToast } from '@/composables/useToast'
import LoadingBlock from '@/components/LoadingBlock.vue'
import EmptyState from '@/components/EmptyState.vue'
import Pagination from '@/components/Pagination.vue'
import { formatDate } from '@/utils/format'

const toast = useToast()
const items = ref<Project[]>([])
const categories = ref<{ name: string; count: number }[]>([])
const files = ref<FileItem[]>([])
const loading = ref(true)
const saving = ref(false)
const editing = ref<Project | null>(null)
const keyword = ref('')
const showDraft = ref(true)
const page = ref(1)
const total = ref(0)
const totalPages = ref(1)

const emptyForm = () => ({
  title: '',
  category: '其他',
  version: '',
  summary: '',
  content: '',
  tags: '',
  repoUrl: '',
  externalUrl: '',
  status: 'published',
  sortOrder: 0,
  coverFileId: null as number | null
})

const form = ref(emptyForm())
const imageFiles = computed(() => files.value.filter((f) => f.kind === 'image'))

const reload = async (target = 1) => {
  loading.value = true
  try {
    const res = await projectApi.list({ page: target, pageSize: 12, q: keyword.value, scope: showDraft.value ? 'all' : undefined })
    items.value = res.data.items
    categories.value = res.data.categories
    total.value = res.data.total
    totalPages.value = res.data.totalPages
    page.value = res.data.page
  } finally {
    loading.value = false
  }
}

const loadFiles = async () => {
  const res = await fileApi.list({ pageSize: 100, scope: 'all' }).catch(() => null)
  if (res) files.value = res.data.items
}

const resetForm = () => {
  editing.value = null
  form.value = emptyForm()
}

const edit = (project: Project) => {
  editing.value = project
  form.value = {
    title: project.title,
    category: project.category,
    version: project.version,
    summary: project.summary,
    content: project.content,
    tags: project.tags,
    repoUrl: project.repo_url,
    externalUrl: project.external_url,
    status: project.status,
    sortOrder: project.sort_order,
    coverFileId: project.cover?.id ?? null
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const save = async () => {
  if (!form.value.title.trim()) {
    toast.error('请填写项目标题')
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      await projectApi.update(editing.value.id, { ...form.value })
      toast.success('项目已更新')
    } else {
      await projectApi.create({ ...form.value })
      toast.success('项目已创建')
    }
    resetForm()
    await reload(1)
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    saving.value = false
  }
}

const remove = async (project: Project) => {
  if (!confirm(`确定删除项目「${project.title}」？`)) return
  try {
    await projectApi.remove(project.id)
    toast.success('已删除')
    await reload(page.value)
  } catch (err: any) {
    toast.error(err.message)
  }
}

onMounted(async () => {
  await Promise.all([reload(1), loadFiles()])
})
</script>

<style scoped>
.editor-grid {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 18px;
  align-items: start;
}
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

@media (max-width: 1000px) {
  .editor-grid {
    grid-template-columns: 1fr;
  }
}
</style>
