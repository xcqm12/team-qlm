<template>
  <div class="state-box">
    <div class="emoji">{{ emoji }}</div>
    <h3>{{ title }}</h3>
    <p v-if="description" class="muted">{{ description }}</p>
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    emoji?: string
    title?: string
    description?: string
  }>(),
  { emoji: '🐾', title: '暂无内容', description: '' }
)
</script>

<style scoped>
.state-box {
  padding: 56px 20px;
  text-align: center;
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
}
.emoji {
  font-size: 42px;
  margin-bottom: 12px;
}
.state-box h3 {
  margin-bottom: 6px;
  font-size: 17px;
}
</style>
