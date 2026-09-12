<template>
  <teleport to="body">
    <transition name="fade">
      <div v-if="file" class="lightbox" @click.self="close">
        <div class="panel">
          <header class="head">
            <div class="info">
              <strong class="text-clip">{{ file.originalName }}</strong>
              <span class="small muted">{{ file.sizeText }} · {{ file.category }}</span>
            </div>
            <div class="flex" style="gap: 8px">
              <a class="btn btn-primary btn-sm" :href="file.downloadUrl">下载</a>
              <button class="icon-btn" title="关闭" @click="close">✕</button>
            </div>
          </header>

          <div class="stage" @click.self="close">
            <img v-if="file.kind === 'image'" :src="file.url" :alt="file.originalName" />
            <video v-else-if="file.kind === 'video'" :src="file.url" controls autoplay />
            <audio v-else-if="file.kind === 'audio'" :src="file.url" controls autoplay />
            <iframe v-else-if="file.kind === 'pdf'" :src="`/api/files/${file.id}/preview`" title="PDF 预览"></iframe>
            <pre v-else-if="file.kind === 'text'" class="text-preview">{{ textContent || '加载中…' }}</pre>
            <div v-else class="unknown">
              <div class="big-icon">📦</div>
              <p class="muted">该类型暂不支持在线预览，请直接下载查看。</p>
            </div>
          </div>

          <footer class="foot small muted">
            <span v-if="file.description">{{ file.description }}</span>
            <span v-if="file.sha256" class="text-clip" :title="file.sha256">SHA256: {{ file.sha256.slice(0, 24) }}…</span>
          </footer>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { FileItem } from '@/api'

const props = defineProps<{ file: FileItem | null }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const textContent = ref('')

watch(
  () => props.file,
  async (file) => {
    textContent.value = ''
    if (file && file.kind === 'text') {
      try {
        const res = await fetch(`/api/files/${file.id}/preview`)
        textContent.value = (await res.text()).slice(0, 20000)
      } catch {
        textContent.value = '文本内容加载失败，请下载后查看。'
      }
    }
  }
)

const close = () => emit('close')
</script>

<style scoped>
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(8, 15, 26, 0.72);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.panel {
  width: min(1100px, 100%);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}
.info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.stage {
  flex: 1;
  overflow: auto;
  background: var(--bg-alt);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
}
.stage img,
.stage video {
  max-width: 100%;
  max-height: 68vh;
  object-fit: contain;
}
.stage iframe {
  width: 100%;
  height: 68vh;
  border: 0;
  background: #fff;
}
.stage audio {
  width: min(560px, 90%);
}
.text-preview {
  width: 100%;
  max-height: 68vh;
  margin: 0;
  padding: 18px;
  overflow: auto;
  background: var(--surface);
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-word;
}
.unknown {
  padding: 48px;
  text-align: center;
}
.big-icon {
  font-size: 54px;
  margin-bottom: 10px;
}
.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 18px;
  border-top: 1px solid var(--border);
  flex-wrap: wrap;
}
.icon-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
