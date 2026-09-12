<template>
  <article class="file-card card card-hover" :class="{ external: file.isExternal, pinned: file.isExternal && file.sortOrder > 0 }">
    <div class="thumb" @click="onThumbClick">
      <img
        v-if="!file.isExternal && file.kind === 'image' && (file.thumbnailUrl || file.url)"
        :src="file.thumbnailUrl || file.url"
        :alt="file.originalName"
        loading="lazy"
      />
      <div v-else class="thumb-icon" :class="`kind-${file.kind}`">
        <!-- 自定义图标：图片地址 → img，emoji/文字 → 文本 -->
        <img v-if="file.isExternal && iconImage" :src="iconImage" class="icon-img" alt="" @error="iconFailed = true" />
        <span v-else>{{ icon }}</span>
        <small>{{ file.isExternal ? file.provider || host : file.ext ? file.ext.toUpperCase() : 'FILE' }}</small>
      </div>

      <span class="badge cat" :class="{ 'badge-source': file.isExternal }">
        {{ file.isExternal ? '第三方' : file.category }}
      </span>
      <span v-if="file.isExternal && showProviderBadge" class="badge badge-muted cat-right" :title="file.externalUrl">
        {{ file.provider || host }}
      </span>
      <span v-if="file.isExternal && file.sortOrder > 0" class="pin" title="已置顶">📌</span>
      <!-- 跳转前检测：仅当最近一次检测判定为异常时提示，正常时不打扰访客 -->
      <span v-if="linkWarning" class="link-warn" :title="linkWarning">⚠️ 链接可能失效</span>
    </div>

    <div class="card-body body">
      <h3 class="title text-clip" :title="file.originalName">{{ file.originalName }}</h3>

      <div v-if="file.tags.length" class="tags">
        <span v-for="tag in file.tags" :key="tag" class="badge badge-accent">{{ tag }}</span>
      </div>

      <p v-if="file.description" class="muted small desc clamp-2">{{ file.description }}</p>

      <div v-if="file.isExternal && file.accessCode" class="access">
        <span class="small muted">提取码</span>
        <code>{{ file.accessCode }}</code>
        <button class="mini" title="复制提取码" @click="copyCode">复制</button>
      </div>

      <dl v-if="extraEntries.length" class="extras">
        <div v-for="[key, value] in extraEntries" :key="key">
          <dt>{{ key }}</dt>
          <dd class="text-clip" :title="value">{{ value }}</dd>
        </div>
      </dl>

      <a
        v-if="file.isExternal && file.showUrl"
        class="raw-url small text-clip"
        :href="file.downloadUrl"
        target="_blank"
        rel="noopener noreferrer"
        :title="file.externalUrl"
      >
        {{ file.externalUrl }}
      </a>

      <div class="meta small muted">
        <span>{{ file.sizeText }}</span>
        <span>·</span>
        <span>{{ formatDate(file.createdAt, false) }}</span>
        <span v-if="file.version">· {{ file.version }}</span>
      </div>

      <div class="footer">
        <span class="small muted">下载 {{ file.downloadCount }} 次</span>
        <div class="flex" style="gap: 6px">
          <button v-if="!file.isExternal && file.kind !== 'other'" class="btn btn-ghost btn-sm" @click="emit('preview', file)">
            预览
          </button>
          <a
            class="btn btn-primary btn-sm"
            :href="file.downloadUrl"
            :target="file.isExternal && file.openInNewTab ? '_blank' : undefined"
            :rel="file.isExternal ? 'noopener noreferrer' : undefined"
          >
            {{ actionLabel }}
          </a>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FileItem } from '@/api'
import { copyText, faviconOf, fileIcon, formatDate, hostOf, isImageIcon } from '@/utils/format'
import { useToast } from '@/composables/useToast'

const props = defineProps<{ file: FileItem }>()
const emit = defineEmits<{ (e: 'preview', file: FileItem): void }>()

const toast = useToast()
const iconFailed = ref(false)

const host = computed(() => hostOf(props.file.externalUrl))
const iconImage = computed(() => {
  if (iconFailed.value) return ''
  const icon = props.file.providerIcon
  if (icon && isImageIcon(icon)) return icon
  if (icon) return ''
  // 未自定义图标时：用对方站点 favicon 兜底
  return faviconOf(props.file.externalUrl)
})
const icon = computed(() => {
  if (props.file.providerIcon && !isImageIcon(props.file.providerIcon) && !iconFailed.value) {
    return props.file.providerIcon
  }
  if (iconFailed.value && props.file.providerIcon) return props.file.providerIcon
  return props.file.isExternal ? '🔗' : fileIcon(props.file.kind, props.file.ext)
})

const showProviderBadge = computed(() => !!props.file.provider)
const extraEntries = computed(() => Object.entries(props.file.extras || {}).slice(0, 6))

/** 最近一次检测失败时的提示文案（风控类不算失效，不打扰访客） */
const linkWarning = computed(() => {
  const check = props.file.linkCheck
  if (!check || check.ok || check.suspicious) return ''
  const reason = check.error || (check.status ? `HTTP ${check.status}` : '不可达')
  return `最近检测：${reason}（${check.checkedAt}）`
})
const actionLabel = computed(() => {
  if (!props.file.isExternal) return '下载'
  const label = props.file.buttonLabel || '前往下载'
  return props.file.openInNewTab ? `${label} ↗` : label
})

/** 第三方条目点击缩略图直接跳转外部页面；本地文件走预览 */
const onThumbClick = () => {
  if (props.file.isExternal) {
    if (props.file.openInNewTab) {
      window.open(props.file.downloadUrl, '_blank', 'noopener,noreferrer')
    } else {
      window.location.href = props.file.downloadUrl
    }
    return
  }
  emit('preview', props.file)
}

const copyCode = async () => {
  const ok = await copyText(props.file.accessCode)
  ok ? toast.success(`提取码 ${props.file.accessCode} 已复制`) : toast.error('复制失败，请手动复制')
}
</script>

<style scoped>
.file-card {
  display: flex;
  flex-direction: column;
}
.file-card.external {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
}
.file-card.pinned {
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--brand) 35%, transparent), var(--shadow-sm);
}
.thumb {
  position: relative;
  height: 150px;
  background: linear-gradient(135deg, var(--brand-soft), var(--accent-soft));
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
}
.file-card.external .thumb {
  background: linear-gradient(135deg, var(--accent-soft), var(--brand-soft));
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.thumb-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-size: 40px;
}
.icon-img {
  width: 52px !important;
  height: 52px !important;
  object-fit: contain;
  border-radius: 12px;
  background: #fff;
  padding: 6px;
}
.thumb-icon small {
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--muted);
  font-weight: 700;
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cat {
  position: absolute;
  top: 10px;
  left: 10px;
  backdrop-filter: blur(6px);
}
.cat-right {
  position: absolute;
  top: 10px;
  right: 10px;
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.badge-source {
  background: var(--accent);
  color: #fff;
}
.pin {
  position: absolute;
  bottom: 8px;
  right: 10px;
  font-size: 15px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25));
}
.link-warn {
  position: absolute;
  bottom: 8px;
  left: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  color: #fff;
  background: rgba(229, 72, 77, 0.92);
  backdrop-filter: blur(4px);
}
.body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}
.title {
  font-size: 15.5px;
  margin: 0;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.desc {
  margin: 0;
  min-height: 36px;
}
.access {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
}
.access code {
  font-weight: 700;
  color: #0d8d7c;
  letter-spacing: 1px;
}
[data-theme='dark'] .access code {
  color: var(--accent);
}
.mini {
  margin-left: auto;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink-2);
  border-radius: 999px;
  font-size: 12px;
  padding: 2px 10px;
  cursor: pointer;
}
.mini:hover {
  border-color: var(--brand);
  color: var(--brand);
}
.extras {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12.5px;
}
.extras > div {
  display: flex;
  gap: 6px;
}
.extras dt {
  color: var(--muted);
  flex-shrink: 0;
}
.extras dd {
  margin: 0;
  min-width: 0;
  color: var(--ink-2);
}
.raw-url {
  display: block;
  color: var(--brand);
  font-size: 12px;
}
.meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.footer {
  margin-top: auto;
  padding-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-top: 1px solid var(--border);
}
</style>
