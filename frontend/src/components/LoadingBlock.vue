<template>
  <div class="loading" :class="{ inline }">
    <span class="spinner spinner-dark"></span>
    <span class="muted small">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ text?: string; inline?: boolean }>(), { text: '加载中…', inline: false })
</script>

<style scoped>
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px 0;
}
.loading.inline {
  padding: 12px 0;
}
</style>
