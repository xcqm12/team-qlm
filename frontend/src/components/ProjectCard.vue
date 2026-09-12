<template>
  <article class="project-card card card-hover">
    <div class="cover">
      <img v-if="project.cover" :src="project.cover.thumbnailUrl || project.cover.url" :alt="project.title" loading="lazy" />
      <div v-else class="cover-fallback">
        <span class="paw">🐾</span>
      </div>
      <span class="badge cat">{{ project.category }}</span>
    </div>
    <div class="card-body">
      <h3 class="title">{{ project.title }}</h3>
      <p class="muted small clamp-2 summary">{{ project.summary }}</p>
      <div class="flex flex-wrap small muted meta">
        <span v-if="project.version" class="badge badge-accent">{{ project.version }}</span>
        <span v-for="tag in tagList" :key="tag" class="badge badge-muted">{{ tag }}</span>
      </div>
      <div class="footer">
        <span class="small muted">👁 {{ project.views }} 次浏览</span>
        <router-link class="btn btn-ghost btn-sm" :to="`/projects/${project.slug}`">查看详情 →</router-link>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Project } from '@/api'

const props = defineProps<{ project: Project }>()

const tagList = computed(() =>
  (props.project.tags || '')
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3)
)
</script>

<style scoped>
.project-card {
  display: flex;
  flex-direction: column;
}
.cover {
  position: relative;
  height: 170px;
  background: linear-gradient(135deg, var(--brand-soft), var(--accent-soft));
  overflow: hidden;
}
.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 46px;
  opacity: 0.65;
}
.cat {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--brand-dark);
}
.title {
  font-size: 17px;
  margin-bottom: 6px;
}
.summary {
  min-height: 42px;
  margin-bottom: 10px;
}
.meta {
  gap: 6px;
  margin-bottom: 12px;
}
.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}
</style>
