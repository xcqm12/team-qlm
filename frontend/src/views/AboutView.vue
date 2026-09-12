<template>
  <div class="page container">
    <div class="section-head">
      <div>
        <h1>关于我们</h1>
        <p class="sub">了解 {{ site.siteName }}</p>
      </div>
    </div>

    <section class="card intro-card">
      <div class="card-body">
        <div class="intro-grid">
          <img :src="site.logoUrl" :alt="site.siteName" class="logo" />
          <div>
            <h2>{{ site.siteName }}</h2>
            <p>{{ site.settings.site_description }}</p>
            <div class="facts">
              <div><span class="label">成立日期</span><strong>{{ site.settings.founded_at }}</strong></div>
              <div><span class="label">团队性质</span><strong>线上团队 · 全球合作</strong></div>
              <div><span class="label">联系邮箱</span><strong>{{ site.settings.contact_email }}</strong></div>
              <div><span class="label">工作时间</span><strong>{{ site.settings.contact_hours }}</strong></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="block">
      <div class="section-head">
        <div>
          <h2>团队介绍</h2>
          <p class="sub">作品主要发布渠道</p>
        </div>
      </div>
      <div class="grid grid-4">
        <a
          v-for="platform in platforms"
          :key="platform.name"
          class="card card-hover platform"
          :href="platform.url"
          target="_blank"
          rel="noopener"
        >
          <div class="card-body">
            <div class="p-icon">{{ platform.icon }}</div>
            <strong>{{ platform.name }}</strong>
            <p class="muted small">{{ platform.desc }}</p>
          </div>
        </a>
      </div>
    </section>

    <section class="block">
      <div class="section-head">
        <div>
          <h2>团队成员</h2>
          <p class="sub">共 {{ members.length }} 位成员</p>
        </div>
      </div>

      <LoadingBlock v-if="loading" />
      <div v-else class="grid grid-4">
        <article v-for="member in members" :key="member.id" class="card card-hover member">
          <div class="card-body">
            <div class="avatar">
              <img v-if="member.avatar" :src="member.avatar.thumbnailUrl || member.avatar.url" :alt="member.name" />
              <span v-else>{{ member.name.slice(0, 1) }}</span>
            </div>
            <h3>{{ member.name }}</h3>
            <span class="badge">{{ member.role }}</span>
            <p class="skills small muted">{{ member.skills }}</p>
            <p class="bio small">{{ member.bio }}</p>
            <span v-if="member.joined_at" class="joined small muted">加入于 {{ member.joined_at }}</span>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { memberApi, type Member } from '@/api'
import { useSiteStore } from '@/stores/site'
import LoadingBlock from '@/components/LoadingBlock.vue'

const site = useSiteStore()
const members = ref<Member[]>([])
const loading = ref(true)

const platforms = computed(() => [
  { name: '网易我的世界', icon: '🎮', desc: '地图与模组发布', url: site.settings.platform_mc },
  { name: 'CurseForge', icon: '🔥', desc: '模组分发平台', url: site.settings.platform_curseforge },
  { name: 'Modrinth', icon: '🧩', desc: '开源模组平台', url: site.settings.platform_modrinth },
  { name: 'GitHub', icon: '🐙', desc: '部分代码开源', url: site.settings.platform_github }
])

onMounted(async () => {
  try {
    const data = await memberApi.list()
    members.value = data.items
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.intro-grid {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 28px;
  align-items: start;
}
.logo {
  width: 180px;
  border-radius: var(--radius);
  background: #fff;
  box-shadow: var(--shadow-sm);
}
.facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
  margin-top: 18px;
}
.facts > div {
  display: flex;
  flex-direction: column;
  padding: 12px 14px;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
}
.label {
  font-size: 12px;
  color: var(--muted);
}
.block {
  margin-top: 46px;
}
.platform {
  color: var(--ink);
  text-decoration: none;
}
.p-icon {
  font-size: 30px;
  margin-bottom: 8px;
}
.member {
  text-align: center;
}
.avatar {
  width: 68px;
  height: 68px;
  margin: 0 auto 12px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--brand), var(--accent));
  color: #fff;
  font-size: 26px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.member h3 {
  font-size: 16px;
  margin-bottom: 8px;
}
.skills {
  margin: 10px 0 8px;
  min-height: 20px;
}
.bio {
  color: var(--ink-2);
  min-height: 58px;
}
.joined {
  display: block;
  margin-top: 6px;
}

@media (max-width: 700px) {
  .intro-grid {
    grid-template-columns: 1fr;
  }
  .logo {
    width: 130px;
  }
}
</style>
