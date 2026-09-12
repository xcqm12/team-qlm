<template>
  <div class="page container">
    <div class="section-head">
      <div>
        <h1>联系我们</h1>
        <p class="sub">欢迎与我们交流合作</p>
      </div>
    </div>

    <div class="contact-grid">
      <section class="card">
        <div class="card-body">
          <h2>联系方式</h2>
          <p class="muted small">期待与您的合作</p>

          <ul class="info-list">
            <li>
              <span class="ico">✉️</span>
              <div>
                <span class="label">EMAIL</span>
                <a :href="`mailto:${site.settings.contact_email}`">{{ site.settings.contact_email }}</a>
              </div>
            </li>
            <li>
              <span class="ico">📍</span>
              <div>
                <span class="label">地址</span>
                <strong>{{ site.settings.contact_address }}</strong>
              </div>
            </li>
            <li>
              <span class="ico">🕒</span>
              <div>
                <span class="label">工作时间</span>
                <strong>{{ site.settings.contact_hours }}</strong>
              </div>
            </li>
            <li v-if="site.settings.founded_at">
              <span class="ico">🎂</span>
              <div>
                <span class="label">成立日期</span>
                <strong>{{ site.settings.founded_at }}</strong>
              </div>
            </li>
          </ul>

          <div class="divider"></div>
          <h3>关注平台</h3>
          <div class="platforms">
            <a v-for="p in platforms" :key="p.name" :href="p.url" target="_blank" rel="noopener" class="platform">
              <span>{{ p.icon }}</span>{{ p.name }}
            </a>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-body">
          <h2>给我们留言</h2>
          <p class="muted small">有任何问题或建议，欢迎留言告诉我们</p>

          <form @submit.prevent="submit">
            <div class="field">
              <label>您的称呼 *</label>
              <input v-model="form.name" class="input" required maxlength="60" placeholder="怎么称呼您" />
            </div>
            <div class="field">
              <label>邮箱地址 *</label>
              <input v-model="form.email" class="input" type="email" required placeholder="用于接收回复" />
            </div>
            <div class="field">
              <label>主题（可选）</label>
              <input v-model="form.subject" class="input" maxlength="120" placeholder="合作 / 反馈 / 其他" />
            </div>
            <div class="field">
              <label>留言内容 *</label>
              <textarea v-model="form.content" class="textarea" required maxlength="2000" placeholder="请描述您的问题或合作意向"></textarea>
              <div class="hint">{{ form.content.length }} / 2000</div>
            </div>
            <button class="btn btn-primary btn-block" :disabled="submitting">
              <span v-if="submitting" class="spinner"></span>
              {{ submitting ? '发送中…' : '发送留言' }}
            </button>
          </form>

          <p v-if="sentTip" class="sent-tip">✅ {{ sentTip }}</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { messageApi } from '@/api'
import { useSiteStore } from '@/stores/site'
import { useToast } from '@/composables/useToast'

const site = useSiteStore()
const toast = useToast()

const form = ref({ name: '', email: '', subject: '', content: '' })
const submitting = ref(false)
const sentTip = ref('')

const platforms = computed(() => [
  { name: '网易我的世界', icon: '🎮', url: site.settings.platform_mc },
  { name: 'CurseForge', icon: '🔥', url: site.settings.platform_curseforge },
  { name: 'Modrinth', icon: '🧩', url: site.settings.platform_modrinth },
  { name: 'GitHub', icon: '🐙', url: site.settings.platform_github }
])

const submit = async () => {
  submitting.value = true
  sentTip.value = ''
  try {
    await messageApi.create({ ...form.value })
    sentTip.value = '留言已提交，我们会尽快通过邮箱回复您。'
    toast.success('留言已提交')
    form.value = { name: '', email: '', subject: '', content: '' }
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.contact-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 22px;
  align-items: start;
}
.info-list {
  list-style: none;
  padding: 0;
  margin: 18px 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.info-list li {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}
.ico {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--brand-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}
.info-list div {
  display: flex;
  flex-direction: column;
}
.label {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 2px;
}
.platforms {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.platform {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink-2);
}
.platform:hover {
  border-color: var(--brand);
  color: var(--brand);
}
.sent-tip {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
  color: #0d8d7c;
  font-size: 14px;
}

@media (max-width: 900px) {
  .contact-grid {
    grid-template-columns: 1fr;
  }
}
</style>
