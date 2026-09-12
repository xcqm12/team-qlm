import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { siteApi, type SiteStats } from '@/api'

const DEFAULT_SETTINGS: Record<string, string> = {
  site_name: '七零喵团队',
  site_short_name: '七零喵',
  site_slogan: '你们的支持，我们的努力。',
  site_description: '由游戏爱好者与独立开发者组建的团队。',
  contact_email: 'qlm@qlm.org.cn',
  contact_address: '线上团队 · 全球合作',
  contact_hours: '工作日 10:00 - 19:00',
  founded_at: '2019-11-11'
}

export const useSiteStore = defineStore('site', () => {
  const settings = ref<Record<string, string>>({ ...DEFAULT_SETTINGS })
  const fileCategories = ref<string[]>(['工具软件', '模组资源', '文档资料', '图片素材', '其他'])
  const stats = ref<SiteStats | null>(null)
  const loaded = ref(false)
  const version = ref('')

  const siteName = computed(() => settings.value.site_name || DEFAULT_SETTINGS.site_name)
  const slogan = computed(() => settings.value.site_slogan || DEFAULT_SETTINGS.site_slogan)
  const logoUrl = computed(() => '/logo.png')

  const loadSettings = async () => {
    try {
      const data = await siteApi.settings()
      settings.value = { ...DEFAULT_SETTINGS, ...(data.settings || {}) }
      if (Array.isArray(data.fileCategories) && data.fileCategories.length) {
        fileCategories.value = data.fileCategories
      }
      version.value = data.version
    } catch (err) {
      console.warn('[site] 加载站点设置失败，使用默认值', err)
    } finally {
      loaded.value = true
    }
  }

  const loadStats = async () => {
    try {
      const data = await siteApi.stats()
      stats.value = data.stats
    } catch (err) {
      console.warn('[site] 加载统计失败', err)
    }
  }

  const refresh = async () => {
    await Promise.all([loadSettings(), loadStats()])
  }

  const applyDocumentMeta = () => {
    document.title = `${siteName.value} · ${slogan.value}`
    const desc = document.querySelector('meta[name="description"]')
    if (desc && settings.value.site_description) desc.setAttribute('content', settings.value.site_description)
  }

  return {
    settings,
    fileCategories,
    stats,
    loaded,
    version,
    siteName,
    slogan,
    logoUrl,
    loadSettings,
    loadStats,
    refresh,
    applyDocumentMeta
  }
})
