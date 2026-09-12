<template>
  <div class="uploader">
    <div
      class="dropzone"
      :class="{ dragging, uploading }"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
      @click="pick"
    >
      <input ref="inputRef" type="file" multiple hidden @change="onSelect" />
      <div class="icon">📤</div>
      <p class="title">把文件拖到这里，或点击选择文件</p>
      <p class="hint">
        支持批量上传 · 单文件上限 {{ maxSizeText }} · 允许类型：压缩包 / 程序 / 文档 / 图片 / 音视频 / 游戏资源
      </p>
    </div>

    <div class="options">
      <div class="field">
        <label>文件分类</label>
        <select v-model="form.category" class="select">
          <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>
      <div class="field">
        <label>版本号（可选）</label>
        <input v-model="form.version" class="input" placeholder="如 v1.5.0" />
      </div>
      <div class="field">
        <label>公开下载</label>
        <select v-model="form.isPublic" class="select">
          <option :value="'1'">公开（前端可见）</option>
          <option :value="'0'">仅后台可见</option>
        </select>
      </div>
    </div>

    <div class="field">
      <label>文件说明（可选）</label>
      <textarea v-model="form.description" class="textarea" rows="2" placeholder="一句话说明这个文件的用途"></textarea>
    </div>

    <ul v-if="queue.length" class="queue">
      <li v-for="(item, index) in queue" :key="item.key" class="queue-item">
        <span class="name text-clip">{{ item.name }}</span>
        <span class="small muted">{{ formatBytes(item.size) }}</span>
        <span class="status" :class="item.status">
          {{ item.status === 'pending' ? '等待' : item.status === 'uploading' ? `${item.percent}%` : item.status === 'done' ? '完成' : '失败' }}
        </span>
        <button v-if="item.status === 'pending'" class="rm" @click="queue.splice(index, 1)">✕</button>
      </li>
    </ul>

    <div class="flex-between mt-16">
      <span class="small muted">{{ queue.length ? `已选择 ${queue.length} 个文件` : '未选择文件' }}</span>
      <div class="flex" style="gap: 8px">
        <button v-if="queue.length" class="btn btn-ghost btn-sm" :disabled="uploading" @click="queue = []">清空</button>
        <button class="btn btn-primary" :disabled="!queue.length || uploading" @click="startUpload">
          <span v-if="uploading" class="spinner"></span>
          {{ uploading ? '上传中…' : '开始上传' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { fileApi } from '@/api'
import { useSiteStore } from '@/stores/site'
import { useToast } from '@/composables/useToast'
import { formatBytes } from '@/utils/format'

const site = useSiteStore()
const toast = useToast()
const emit = defineEmits<{ (e: 'uploaded', files: any[]): void }>()

const inputRef = ref<HTMLInputElement>()
const dragging = ref(false)
const uploading = ref(false)
const queue = ref<{ key: string; file: File; name: string; size: number; status: string; percent: number }[]>([])

const form = ref({ category: site.fileCategories[0] || '其他', version: '', isPublic: '1', description: '' })
const categories = computed(() => site.fileCategories)
const maxSizeText = '200 MB'

const pick = () => inputRef.value?.click()

const addFiles = (files: FileList | File[]) => {
  for (const file of Array.from(files)) {
    queue.value.push({
      key: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      name: file.name,
      size: file.size,
      status: 'pending',
      percent: 0
    })
  }
}

const onSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files) addFiles(target.files)
  target.value = ''
}

const onDrop = (event: DragEvent) => {
  dragging.value = false
  if (event.dataTransfer?.files) addFiles(event.dataTransfer.files)
}

const startUpload = async () => {
  const pending = queue.value.filter((item) => item.status === 'pending')
  if (!pending.length) return
  uploading.value = true
  const uploadedAny: any[] = []

  for (const item of pending) {
    item.status = 'uploading'
    item.percent = 0
    const formData = new FormData()
    formData.append('file', item.file, item.name)
    formData.append('category', form.value.category)
    formData.append('version', form.value.version)
    formData.append('description', form.value.description)
    formData.append('isPublic', form.value.isPublic)
    try {
      const res: any = await fileApi.upload(formData, (percent) => (item.percent = percent))
      item.status = 'done'
      item.percent = 100
      const files = Array.isArray(res?.data) ? res.data : res?.files || [res?.data].filter(Boolean)
      uploadedAny.push(...files)
      toast.success(`${item.name} 上传成功`)
    } catch (err: any) {
      item.status = 'error'
      toast.error(`${item.name} 上传失败：${err.message}`)
    }
  }

  uploading.value = false
  queue.value = queue.value.filter((item) => item.status !== 'done')
  if (uploadedAny.length) emit('uploaded', uploadedAny)
}
</script>

<style scoped>
.uploader {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  background: var(--surface);
}
.dropzone {
  border: 2px dashed var(--border);
  border-radius: var(--radius);
  padding: 30px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.22s;
  background: var(--surface-2);
}
.dropzone.dragging,
.dropzone:hover {
  border-color: var(--brand);
  background: var(--brand-soft);
}
.dropzone.uploading {
  opacity: 0.7;
  pointer-events: none;
}
.dropzone .icon {
  font-size: 36px;
}
.dropzone .title {
  margin: 8px 0 4px;
  font-weight: 600;
  color: var(--ink);
}
.options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
  margin: 18px 0 0;
}
.queue {
  list-style: none;
  padding: 0;
  margin: 14px 0 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 220px;
  overflow: auto;
}
.queue-item {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  font-size: 13.5px;
}
.name {
  min-width: 0;
}
.status {
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
}
.status.done {
  color: var(--success);
}
.status.error {
  color: var(--danger);
}
.status.uploading {
  color: var(--brand);
}
.rm {
  border: none;
  background: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 13px;
}
</style>
