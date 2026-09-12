<template>
  <div class="admin-files">
    <!-- 本地上传 -->
    <section class="card mb-16">
      <div class="card-body">
        <div class="flex-between mb-16">
          <h3>上传文件（保存到本站）</h3>
          <button class="btn btn-ghost btn-sm" @click="showUploader = !showUploader">
            {{ showUploader ? '收起' : '展开' }}
          </button>
        </div>
        <FileUploader v-if="showUploader" @uploaded="onUploaded" />
        <p v-else class="muted small">点击「展开」选择文件上传，成功后会自动刷新列表。</p>
      </div>
    </section>

    <!-- 第三方下载：全部自定义 -->
    <section class="card mb-16">
      <div class="card-body">
        <div class="flex-between mb-16">
          <div>
            <h3>添加第三方下载（文件不落本站 · 全部字段可自定义）</h3>
            <p class="muted small mt-0">
              任意 http(s) 地址皆可：GitHub Releases / CurseForge / Modrinth / 各类网盘 / 你自己的直链。
              平台名、图标、按钮文案、标签、置顶权重、是否新窗口、是否显示原链接、附加字段都能自己定。
            </p>
          </div>
          <button class="btn btn-ghost btn-sm" @click="showExternalForm = !showExternalForm">
            {{ showExternalForm ? '收起' : '展开' }}
          </button>
        </div>

        <form v-if="showExternalForm" class="external-form" @submit.prevent="createExternal">
          <div class="form-grid">
            <div class="field span-2">
              <label>文件名称 *</label>
              <input
                v-model="externalForm.originalName"
                class="input"
                required
                placeholder="如：团队站点源码 v1.0.0（GitHub Releases）"
              />
            </div>
            <div class="field span-2">
              <label>第三方下载链接 *</label>
              <div class="flex" style="gap: 8px">
                <input
                  v-model="externalForm.externalUrl"
                  class="input"
                  required
                  placeholder="https://github.com/xxxx/xxxxx/releases"
                  @blur="autoProvider"
                />
                <button
                  type="button"
                  class="btn btn-ghost btn-sm"
                  :disabled="checkingUrl"
                  @click="checkUrlNow(externalForm.externalUrl)"
                >
                  {{ checkingUrl ? '检测中…' : '🔍 检测链接' }}
                </button>
              </div>
              <div class="hint">
                {{ detectedProvider ? `识别到平台：${detectedProvider}（可改成任意名称）` : '必须是以 http:// 或 https:// 开头的完整地址' }}
              </div>
              <div v-if="urlCheck" class="check-result" :class="urlCheck.ok ? 'ok' : 'bad'">
                <strong>{{ urlCheck.ok ? '✅ 链接可达' : '❌ 链接异常' }}</strong>
                <span>{{ urlCheckSummary }}</span>
                <span v-if="urlCheckHops" class="muted">跳转 {{ urlCheckHops }} 次 → {{ urlCheck.finalUrl }}</span>
                <span class="muted">{{ urlCheck.latencyMs }}ms</span>
              </div>
            </div>

            <div class="field">
              <label>平台名称（自定义）</label>
              <input v-model="externalForm.provider" class="input" :placeholder="detectedProvider || '自动识别，可自定义'" />
            </div>
            <div class="field">
              <label>平台图标（emoji 或图片地址）</label>
              <input v-model="externalForm.providerIcon" class="input" :placeholder="detectedIcon || '🐙 / https://…/icon.png'" />
              <div class="hint">留空时自动用内置图标，失败则回退对方站点 favicon</div>
            </div>

            <div class="field">
              <label>按钮文案（自定义）</label>
              <input v-model="externalForm.buttonLabel" class="input" maxlength="12" placeholder="前往下载 / 去 Release 页 / 获取" />
            </div>
            <div class="field">
              <label>打开方式</label>
              <div class="checks">
                <label class="check"><input v-model="externalForm.openInNewTab" type="checkbox" /> 新窗口打开</label>
                <label class="check"><input v-model="externalForm.showUrl" type="checkbox" /> 卡片上显示原始链接</label>
              </div>
            </div>

            <div class="field">
              <label>标签（英文逗号分隔）</label>
              <input v-model="externalForm.tags" class="input" placeholder="官方,开源,MIT" />
            </div>
            <div class="field">
              <label>置顶权重（越大越靠前，0 为不置顶）</label>
              <input v-model.number="externalForm.sortOrder" class="input" type="number" min="0" />
            </div>

            <div class="field">
              <label>提取码 / 访问密码</label>
              <input v-model="externalForm.accessCode" class="input" placeholder="选填，如 abcd" />
            </div>
            <div class="field">
              <label>文件大小（显示用）</label>
              <input v-model="externalForm.sizeHint" class="input" placeholder="如 1.2 GB / 不定" />
            </div>

            <div class="field">
              <label>分类（可自定义）</label>
              <div class="flex" style="gap: 8px">
                <input v-model="externalForm.category" class="input" list="file-category-options" placeholder="第三方下载" />
                <button type="button" class="btn btn-ghost btn-sm" title="新增分类" @click="addCategory">＋</button>
              </div>
              <datalist id="file-category-options">
                <option v-for="c in site.fileCategories" :key="c" :value="c" />
              </datalist>
            </div>
            <div class="field">
              <label>版本号</label>
              <input v-model="externalForm.version" class="input" placeholder="如 v1.0.0" />
            </div>

            <div class="field span-2">
              <label>自定义字段（每行一个「键=值」，也支持 JSON）</label>
              <textarea
                v-model="externalForm.extrasText"
                class="textarea code"
                rows="3"
                placeholder="授权=MIT&#10;附件数=3&#10;兼容=1.19.x-1.21.x"
              ></textarea>
              <div class="hint">会原样展示在卡片上，适合放授权方式、校验值、适用范围等</div>
            </div>

            <div class="field span-2">
              <label>说明</label>
              <textarea v-model="externalForm.description" class="textarea" rows="2" placeholder="如：含源码压缩包与校验值，Release 页可直接下载"></textarea>
            </div>

            <div class="field">
              <label>可见性</label>
              <select v-model="externalForm.isPublic" class="select">
                <option value="1">公开（前台可见）</option>
                <option value="0">私有（仅后台）</option>
              </select>
            </div>
          </div>

          <div class="flex" style="justify-content: flex-end; gap: 8px">
            <button type="button" class="btn btn-ghost" @click="resetExternalForm">重置</button>
            <button type="submit" class="btn btn-primary" :disabled="creatingExternal">
              {{ creatingExternal ? '添加中…' : '添加第三方下载' }}
            </button>
          </div>
        </form>
        <p v-else class="muted small">点击「展开」填写外部下载地址；支持添加任意条数。</p>
      </div>
    </section>

    <!-- 列表 -->
    <section class="card">
      <div class="card-body">
        <div class="toolbar">
          <input v-model="keyword" class="input" placeholder="搜索文件名 / 说明 / 平台" @keyup.enter="reload(1)" />
          <select v-model="category" class="select" @change="reload(1)">
            <option value="">全部分类</option>
            <option v-for="c in categories" :key="c.name" :value="c.name">{{ c.name }}（{{ c.count }}）</option>
          </select>
          <select v-model="source" class="select" @change="reload(1)">
            <option value="">全部来源</option>
            <option value="local">本站文件</option>
            <option value="external">第三方下载</option>
          </select>
          <select v-model="sort" class="select" @change="reload(1)">
            <option value="newest">最新上传</option>
            <option value="pinned">置顶优先</option>
            <option value="downloads">下载最多</option>
            <option value="size">文件最大</option>
          </select>
          <button class="btn btn-primary btn-sm" @click="reload(1)">搜索</button>
          <button class="btn btn-ghost btn-sm" :disabled="checkingAll" @click="checkAllLinks">
            {{ checkingAll ? '检测中…' : '🔍 批量检测链接' }}
          </button>
          <button class="btn btn-danger btn-sm" :disabled="!selected.length" @click="batchDelete">
            批量删除{{ selected.length ? `（${selected.length}）` : '' }}
          </button>
        </div>

        <LoadingBlock v-if="loading" />
        <template v-else>
          <div class="table-wrap">
            <table v-if="items.length" class="table">
              <thead>
                <tr>
                  <th style="width: 36px"><input type="checkbox" :checked="allSelected" @change="toggleAll" /></th>
                  <th>文件</th>
                  <th>来源 / 平台</th>
                  <th>链接状态</th>
                  <th>分类</th>
                  <th>大小</th>
                  <th>下载</th>
                  <th>状态</th>
                  <th>上传时间</th>
                  <th style="width: 250px">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="file in items" :key="file.id">
                  <td><input v-model="selected" type="checkbox" :value="file.id" /></td>
                  <td>
                    <div class="fname">
                      <span class="ficon">{{ file.isExternal ? file.providerIcon || '🔗' : fileIcon(file.kind, file.ext) }}</span>
                      <div>
                        <strong class="text-clip" style="max-width: 240px; display: block" :title="file.originalName">
                          {{ file.originalName }}
                          <span v-if="file.isExternal && file.sortOrder > 0" class="pin-tag" title="已置顶">📌</span>
                        </strong>
                        <span class="small muted">
                          {{ file.version || '—' }}
                          <template v-if="!file.isExternal"> · SHA {{ file.sha256.slice(0, 8) }}</template>
                          <template v-if="file.isExternal && file.accessCode"> · 提取码 {{ file.accessCode }}</template>
                          <template v-if="file.isExternal && file.tags.length"> · {{ file.tags.join('/') }}</template>
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="badge" :class="file.isExternal ? 'badge-accent' : 'badge-muted'">
                      {{ file.isExternal ? file.provider || '第三方' : '本站' }}
                    </span>
                    <a
                      v-if="file.isExternal"
                      class="small ext-link text-clip"
                      :href="file.externalUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      :title="file.externalUrl"
                    >
                      {{ file.externalUrl }}
                    </a>
                  </td>
                  <td>
                    <template v-if="file.isExternal">
                      <span class="link-status" :class="statusClass(file)">
                        <span v-if="checkingId === file.id" class="spinner spinner-dark" style="width: 12px; height: 12px"></span>
                        <template v-else>{{ statusIcon(file) }} {{ statusText(file) }}</template>
                      </span>
                      <span v-if="file.linkCheck" class="small muted link-meta">
                        {{ file.linkCheck.latencyMs }}ms
                        <template v-if="statusHops(file)"> · {{ statusHops(file) }} 跳</template>
                        · {{ relativeTime(file.linkCheck.checkedAt) }}
                      </span>
                      <span v-else class="small muted link-meta">尚未检测</span>
                      <a
                        v-if="file.linkCheck && file.linkCheck.finalUrl && file.linkCheck.finalUrl !== file.externalUrl"
                        class="small ext-link text-clip"
                        :href="file.linkCheck.finalUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                        :title="`重定向至 ${file.linkCheck.finalUrl}`"
                      >
                        → {{ file.linkCheck.finalUrl }}
                      </a>
                    </template>
                    <span v-else class="muted small">—</span>
                  </td>
                  <td><span class="badge badge-muted">{{ file.category }}</span></td>
                  <td>{{ file.sizeText }}</td>
                  <td>{{ file.downloadCount }}</td>
                  <td>
                    <span class="badge" :class="file.isPublic ? 'badge-accent' : 'badge-muted'">
                      {{ file.isPublic ? '公开' : '私有' }}
                    </span>
                  </td>
                  <td class="muted small">{{ formatDate(file.createdAt) }}</td>
                  <td>
                    <div class="flex" style="gap: 6px; flex-wrap: wrap">
                      <button class="btn btn-ghost btn-sm" @click="edit(file)">编辑</button>
                      <button v-if="file.isExternal" class="btn btn-ghost btn-sm" :disabled="checkingId === file.id" @click="checkOne(file)">
                        检测
                      </button>
                      <a
                        class="btn btn-ghost btn-sm"
                        :href="file.downloadUrl"
                        :target="file.isExternal && file.openInNewTab ? '_blank' : undefined"
                        rel="noopener noreferrer"
                      >
                        {{ file.isExternal ? file.buttonLabel || '前往' : '下载' }}
                      </a>
                      <button v-if="!file.isExternal" class="btn btn-ghost btn-sm" @click="toExternal(file)">
                        转为外链
                      </button>
                      <button class="btn btn-danger btn-sm" @click="remove(file)">删除</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <EmptyState v-else emoji="📁" title="还没有文件" description="用上方「上传文件」或「添加第三方下载」添加内容" />
          </div>
          <Pagination :page="page" :total-pages="totalPages" :total="total" @change="reload" />
        </template>
      </div>
    </section>

    <!-- 编辑弹窗 -->
    <div v-if="editing" class="modal" @click.self="editing = null">
      <div class="modal-card card">
        <div class="card-body">
          <h3>编辑{{ editing.isExternal ? '第三方下载（全部可自定义）' : '文件' }}信息</h3>

          <div class="field">
            <label>显示名称</label>
            <input v-model="editForm.originalName" class="input" />
          </div>

          <template v-if="editing.isExternal">
            <div class="field">
              <label>第三方下载链接</label>
              <div class="flex" style="gap: 8px">
                <input v-model="editForm.externalUrl" class="input" placeholder="https://github.com/xxxx/xxxxx/releases" />
                <button
                  type="button"
                  class="btn btn-ghost btn-sm"
                  :disabled="checkingUrl"
                  @click="checkUrlNow(editForm.externalUrl)"
                >
                  {{ checkingUrl ? '检测中…' : '检测' }}
                </button>
              </div>
              <div v-if="urlCheck" class="check-result" :class="urlCheck.ok ? 'ok' : 'bad'">
                <strong>{{ urlCheck.ok ? '✅ 可达' : '❌ 异常' }}</strong>
                <span>{{ urlCheckSummary }}</span>
                <span v-if="urlCheckHops" class="muted">{{ urlCheckHops }} 次跳转</span>
              </div>
              <div v-if="editing.linkCheck" class="hint">
                上次检测：{{ editing.linkCheck.ok ? '可达' : '异常' }} · {{ relativeTime(editing.linkCheck.checkedAt) }}
                <template v-if="editing.linkCheck.error"> · {{ editing.linkCheck.error }}</template>
              </div>
            </div>
            <div class="two-col">
              <div class="field">
                <label>平台名称</label>
                <input v-model="editForm.provider" class="input" />
              </div>
              <div class="field">
                <label>平台图标</label>
                <input v-model="editForm.providerIcon" class="input" placeholder="emoji 或图片地址" />
              </div>
            </div>
            <div class="two-col">
              <div class="field">
                <label>按钮文案</label>
                <input v-model="editForm.buttonLabel" class="input" maxlength="12" />
              </div>
              <div class="field">
                <label>提取码</label>
                <input v-model="editForm.accessCode" class="input" />
              </div>
            </div>
            <div class="two-col">
              <div class="field">
                <label>文件大小（显示用）</label>
                <input v-model="editForm.sizeHint" class="input" />
              </div>
              <div class="field">
                <label>置顶权重</label>
                <input v-model.number="editForm.sortOrder" class="input" type="number" min="0" />
              </div>
            </div>
            <div class="field">
              <label>标签（英文逗号分隔）</label>
              <input v-model="editForm.tags" class="input" />
            </div>
            <div class="field">
              <label>自定义字段（每行「键=值」，也支持 JSON）</label>
              <textarea v-model="editForm.extrasText" class="textarea code" rows="3"></textarea>
            </div>
            <div class="checks mb-16">
              <label class="check"><input v-model="editForm.openInNewTab" type="checkbox" /> 新窗口打开</label>
              <label class="check"><input v-model="editForm.showUrl" type="checkbox" /> 显示原始链接</label>
            </div>
          </template>

          <div class="field">
            <label>分类</label>
            <div class="flex" style="gap: 8px">
              <input v-model="editForm.category" class="input" list="file-category-options" />
              <button type="button" class="btn btn-ghost btn-sm" @click="addCategory">＋</button>
            </div>
          </div>
          <div class="two-col">
            <div class="field">
              <label>版本</label>
              <input v-model="editForm.version" class="input" />
            </div>
            <div class="field">
              <label>可见性</label>
              <select v-model="editForm.isPublic" class="select">
                <option :value="true">公开（前台可见）</option>
                <option :value="false">私有（仅后台）</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label>说明</label>
            <textarea v-model="editForm.description" class="textarea" rows="3"></textarea>
          </div>

          <div class="flex" style="justify-content: flex-end; gap: 8px">
            <button class="btn btn-ghost" @click="editing = null">取消</button>
            <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fileApi, siteApi, type FileItem, type LinkCheckResult } from '@/api'
import { useSiteStore } from '@/stores/site'
import { useToast } from '@/composables/useToast'
import FileUploader from '@/components/FileUploader.vue'
import Pagination from '@/components/Pagination.vue'
import LoadingBlock from '@/components/LoadingBlock.vue'
import EmptyState from '@/components/EmptyState.vue'
import { fileIcon, formatDate, relativeTime } from '@/utils/format'

const site = useSiteStore()
const toast = useToast()

const items = ref<FileItem[]>([])
const categories = ref<{ name: string; count: number }[]>([])
const loading = ref(true)
const showUploader = ref(true)
const showExternalForm = ref(false)
const creatingExternal = ref(false)
const keyword = ref('')
const category = ref('')
const source = ref('')
const sort = ref('newest')
const page = ref(1)
const total = ref(0)
const totalPages = ref(1)
const selected = ref<number[]>([])
const editing = ref<FileItem | null>(null)
const saving = ref(false)

const LF = String.fromCharCode(10)

const extrasToText = (extras: Record<string, string> = {}) =>
  Object.entries(extras)
    .map(([key, value]) => `${key}=${value}`)
    .join(LF)

const emptyExternalForm = () => ({
  originalName: '',
  externalUrl: '',
  provider: '',
  providerIcon: '',
  buttonLabel: '',
  tags: '',
  accessCode: '',
  sizeHint: '',
  category: site.fileCategories.includes('第三方下载') ? '第三方下载' : '其他',
  version: '',
  description: '',
  isPublic: '1',
  sortOrder: 0,
  openInNewTab: true,
  showUrl: true,
  extrasText: ''
})
const externalForm = ref(emptyExternalForm())

const editForm = ref({
  originalName: '',
  category: '',
  version: '',
  description: '',
  isPublic: true,
  externalUrl: '',
  provider: '',
  providerIcon: '',
  buttonLabel: '',
  tags: '',
  accessCode: '',
  sizeHint: '',
  sortOrder: 0,
  openInNewTab: true,
  showUrl: true,
  extrasText: ''
})

const allSelected = computed(() => items.value.length > 0 && selected.value.length === items.value.length)

/* ---------------- 链接检测 ---------------- */
const checkingId = ref<number | null>(null)
const checkingAll = ref(false)
const checkingUrl = ref(false)
const urlCheck = ref<(LinkCheckResult & { summary?: string }) | null>(null)

const urlCheckSummary = computed(() => {
  const check = urlCheck.value
  if (!check) return ''
  if (check.ok) return `HTTP ${check.status}`
  return check.error || (check.status ? `HTTP ${check.status}` : '不可达')
})

/** 统一取跳转次数：落库字段为 hops，即时探测原始字段为 hopCount */
const urlCheckHops = computed(() => urlCheck.value?.hops || urlCheck.value?.hopCount || 0)
const statusHops = (file: FileItem) => file.linkCheck?.hops || file.linkCheck?.hopCount || 0

const statusIcon = (file: FileItem) => {
  const check = file.linkCheck
  if (!check) return '⚪'
  if (check.ok) return '✅'
  if (check.suspicious) return '⚠️'
  if (check.hops > 0) return '🔀'
  return '❌'
}

const statusText = (file: FileItem) => {
  const check = file.linkCheck
  if (!check) return '未检测'
  if (check.ok) return `可达 ${check.status}`
  if (check.suspicious) return `疑似风控 ${check.status}`
  if (check.error) return check.error.slice(0, 18)
  return check.status ? `HTTP ${check.status}` : '不可达'
}

const statusClass = (file: FileItem) => {
  const check = file.linkCheck
  if (!check) return 'unknown'
  if (check.ok) return 'ok'
  return check.suspicious ? 'warn' : 'bad'
}

/** 检测任意链接（表单预检，不落库） */
const checkUrlNow = async (url: string) => {
  const target = String(url || '').trim()
  if (!target) {
    toast.error('请先填写下载链接')
    return
  }
  checkingUrl.value = true
  urlCheck.value = null
  try {
    const res = await fileApi.checkUrl(target)
    urlCheck.value = { ...res.check, summary: res.summary }
    res.check.ok ? toast.success(`链接可达：${res.summary}`) : toast.error(`链接异常：${res.summary}`)
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    checkingUrl.value = false
  }
}

/** 检测并记录单条 */
const checkOne = async (file: FileItem) => {
  checkingId.value = file.id
  try {
    const res = await fileApi.checkOne(file.id)
    file.linkCheck = res.file.linkCheck
    res.check.ok ? toast.success(`${file.originalName}：${res.summary}`) : toast.error(`${file.originalName}：${res.summary}`)
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    checkingId.value = null
  }
}

/** 批量检测（只看缓存过期的，避免打扰第三方） */
const checkAllLinks = async () => {
  checkingAll.value = true
  try {
    const res = await fileApi.checkAll(true)
    const suspicious = res.summary.suspicious ?? 0
    if (res.checked === 0) {
      toast.info('所有链接的检测结果仍在有效期内，无需重复检测')
    } else if (res.summary.failed > 0) {
      toast.error(`检测 ${res.checked} 条：可达 ${res.summary.ok} · 疑似风控 ${suspicious} · 失效 ${res.summary.failed}`)
    } else {
      toast.success(`检测 ${res.checked} 条：可达 ${res.summary.ok}${suspicious ? ` · 疑似风控 ${suspicious}` : ''}`)
    }
    await reload(page.value)
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    checkingAll.value = false
  }
}

/** 与后端保持一致的前端侧平台识别（即时提示用，最终以后端为准） */
function guessProvider(url: string): string {
  const table: [RegExp, string][] = [
    [/github\.com$/i, 'GitHub'],
    [/gitlab\.com$/i, 'GitLab'],
    [/gitee\.com$/i, 'Gitee'],
    [/curseforge\.com$/i, 'CurseForge'],
    [/modrinth\.com$/i, 'Modrinth'],
    [/pan\.baidu\.com$/i, '百度网盘'],
    [/lanzou[a-z]?\.com$/i, '蓝奏云'],
    [/(aliyundrive|alipan)\.com$/i, '阿里云盘'],
    [/pan\.quark\.cn$/i, '夸克网盘'],
    [/123pan\.com$/i, '123 云盘'],
    [/onedrive\.live\.com$/i, 'OneDrive'],
    [/drive\.google\.com$/i, 'Google Drive'],
    [/mega\.nz$/i, 'MEGA'],
    [/mediafire\.com$/i, 'MediaFire'],
    [/sourceforge\.net$/i, 'SourceForge'],
    [/mc\.163\.com$/i, '网易我的世界'],
    [/weiyun\.com$/i, '腾讯微云'],
    [/itch\.io$/i, 'itch.io']
  ]
  try {
    const parsed = new URL(url)
    const host = parsed.hostname
    if (/github\.com$/i.test(host)) {
      if (/\/releases(\/|$)/i.test(parsed.pathname)) return 'GitHub Releases'
      if (/\/tags(\/|$)/i.test(parsed.pathname)) return 'GitHub Tags'
      if (/\/packages(\/|$)/i.test(parsed.pathname)) return 'GitHub Packages'
    }
    for (const [pattern, name] of table) if (pattern.test(host)) return name
    return host.replace(/^www\./, '')
  } catch {
    return ''
  }
}

const ICON_TABLE: Record<string, string> = {
  GitHub: '🐙',
  'GitHub Releases': '🐙',
  'GitHub Tags': '🐙',
  'GitHub Packages': '🐙',
  GitLab: '🦊',
  Gitee: '🅶',
  CurseForge: '🔥',
  Modrinth: '🧩',
  百度网盘: '☁️',
  蓝奏云: '📦',
  阿里云盘: '☁️',
  夸克网盘: '⚡',
  '123 云盘': '🔢',
  OneDrive: '🗂️',
  'Google Drive': '🟢',
  MEGA: 'Ⓜ️',
  MediaFire: '💠',
  SourceForge: '🧰',
  网易我的世界: '🎮',
  腾讯微云: '🐧',
  'itch.io': '🎲'
}

const detectedProvider = computed(() => guessProvider(externalForm.value.externalUrl))
const detectedIcon = computed(() => ICON_TABLE[detectedProvider.value] || '')

const autoProvider = () => {
  if (!externalForm.value.provider && detectedProvider.value) externalForm.value.provider = detectedProvider.value
  if (!externalForm.value.providerIcon && detectedIcon.value) externalForm.value.providerIcon = detectedIcon.value
}

/** 新增自定义分类：写回站点设置，后续所有地方都能选到 */
const addCategory = async () => {
  const name = window.prompt('新增文件分类名称（例如「GitHub 发布」「镜像站」）', '')
  if (!name) return
  const trimmed = name.trim().slice(0, 20)
  if (!trimmed) return
  if (site.fileCategories.includes(trimmed)) {
    toast.info('该分类已存在')
  } else {
    try {
      await siteApi.updateSettings({ file_categories: [...site.fileCategories, trimmed] })
      await site.refresh()
      toast.success(`已新增分类「${trimmed}」`)
    } catch (err: any) {
      toast.error(err.message)
      return
    }
  }
  if (editing.value) editForm.value.category = trimmed
  else externalForm.value.category = trimmed
}

const loadCategories = async () => {
  const res = await fileApi.categories().catch(() => null)
  if (res) categories.value = res.categories
}

const reload = async (target = 1) => {
  loading.value = true
  try {
    const res = await fileApi.list({
      page: target,
      pageSize: 15,
      scope: 'all',
      q: keyword.value,
      category: category.value,
      source: source.value,
      sort: sort.value
    })
    items.value = res.data.items
    total.value = res.data.total
    totalPages.value = res.data.totalPages
    page.value = res.data.page
    selected.value = []
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    loading.value = false
  }
}

const onUploaded = async () => {
  await Promise.all([loadCategories(), reload(1)])
}

const createExternal = async () => {
  autoProvider()
  creatingExternal.value = true
  try {
    const payload: Record<string, any> = { ...externalForm.value }
    payload.extras = externalForm.value.extrasText
    delete payload.extrasText
    const created = await fileApi.createExternal(payload as any)
    toast.success(`已添加：${created.provider || '第三方下载'}`)
    externalForm.value = emptyExternalForm()
    showExternalForm.value = false
    await Promise.all([loadCategories(), reload(1)])
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    creatingExternal.value = false
  }
}

const resetExternalForm = () => {
  externalForm.value = emptyExternalForm()
}

const toggleAll = () => {
  selected.value = allSelected.value ? [] : items.value.map((f) => f.id)
}

const edit = (file: FileItem) => {
  editing.value = file
  editForm.value = {
    originalName: file.originalName,
    category: file.category,
    version: file.version,
    description: file.description,
    isPublic: file.isPublic,
    externalUrl: file.externalUrl,
    provider: file.provider,
    providerIcon: file.providerIcon,
    buttonLabel: file.buttonLabel,
    tags: file.tags.join(','),
    accessCode: file.accessCode,
    sizeHint: file.sizeHint,
    sortOrder: file.sortOrder,
    openInNewTab: file.openInNewTab,
    showUrl: file.showUrl,
    extrasText: extrasToText(file.extras)
  }
}

const save = async () => {
  if (!editing.value) return
  saving.value = true
  try {
    if (editing.value.isExternal) {
      const { extrasText, ...rest } = editForm.value
      await fileApi.update(editing.value.id, { ...rest, extras: extrasText })
    } else {
      const { externalUrl, provider, providerIcon, buttonLabel, tags, accessCode, sizeHint, sortOrder, openInNewTab, showUrl, extrasText, ...local } =
        editForm.value
      await fileApi.update(editing.value.id, local)
    }
    toast.success('已保存')
    editing.value = null
    await reload(page.value)
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    saving.value = false
  }
}

/** 把已上传的本地文件改成第三方外链（会删除本地文件，需二次确认） */
const toExternal = async (file: FileItem) => {
  const url = window.prompt(
    `把「${file.originalName}」改为第三方下载链接。\n\n本地文件将被删除，请填写外部下载地址：`,
    ''
  )
  if (url === null) return
  const trimmed = url.trim()
  if (!/^https?:\/\/.+/i.test(trimmed)) {
    toast.error('请输入以 http:// 或 https:// 开头的完整地址')
    return
  }
  if (!confirm('确认转换？本地文件会被删除，且不可恢复。')) return
  try {
    await fileApi.makeExternal(file.id, { externalUrl: trimmed })
    toast.success('已改为第三方下载链接')
    await Promise.all([loadCategories(), reload(page.value)])
  } catch (err: any) {
    toast.error(err.message)
  }
}

const remove = async (file: FileItem) => {
  const label = file.isExternal ? '第三方下载条目' : '文件'
  if (!confirm(`确定删除${label}「${file.originalName}」？${file.isExternal ? '' : '此操作会同时删除磁盘文件，'}且不可恢复。`)) return
  try {
    await fileApi.remove(file.id)
    toast.success('已删除')
    await Promise.all([loadCategories(), reload(page.value)])
  } catch (err: any) {
    toast.error(err.message)
  }
}

const batchDelete = async () => {
  if (!selected.value.length) return
  if (!confirm(`确定删除选中的 ${selected.value.length} 个条目？`)) return
  try {
    await fileApi.batchRemove(selected.value)
    toast.success('批量删除完成')
    await Promise.all([loadCategories(), reload(1)])
  } catch (err: any) {
    toast.error(err.message)
  }
}

onMounted(async () => {
  await loadCategories()
  await reload(1)
})
</script>

<style scoped>
.toolbar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.toolbar .input {
  flex: 1;
  min-width: 180px;
}
.toolbar .select {
  width: 140px;
}
.table-wrap {
  overflow-x: auto;
}
.fname {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ficon {
  font-size: 20px;
}
.pin-tag {
  font-size: 12px;
}
.ext-link {
  display: block;
  max-width: 220px;
  margin-top: 4px;
}
.external-form {
  border-top: 1px dashed var(--border);
  padding-top: 16px;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}
.form-grid .span-2 {
  grid-column: span 2;
}
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.checks {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 4px;
}
.check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--ink-2);
}
.code {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 13px;
}
.link-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12.5px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}
.link-status.ok {
  background: rgba(23, 166, 115, 0.12);
  color: var(--success);
}
.link-status.bad {
  background: rgba(229, 72, 77, 0.12);
  color: var(--danger);
}
.link-status.warn {
  background: rgba(240, 160, 32, 0.14);
  color: #a86a06;
}
.link-status.unknown {
  background: var(--bg-alt);
  color: var(--muted);
}
.link-meta {
  display: block;
  margin-top: 2px;
}
.check-result {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-size: 13px;
}
.check-result.ok {
  background: rgba(23, 166, 115, 0.1);
  color: var(--success);
}
.check-result.bad {
  background: rgba(229, 72, 77, 0.1);
  color: var(--danger);
}
.modal {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(8, 15, 26, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.modal-card {
  width: min(640px, 100%);
  max-height: 90vh;
  overflow: auto;
}
h3 {
  font-size: 15.5px;
  margin: 0;
}

@media (max-width: 640px) {
  .form-grid .span-2 {
    grid-column: span 1;
  }
  .two-col {
    grid-template-columns: 1fr;
  }
}
</style>
