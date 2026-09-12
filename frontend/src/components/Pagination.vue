<template>
  <nav v-if="totalPages > 1" class="pagination">
    <button class="btn btn-ghost btn-sm" :disabled="page <= 1" @click="go(page - 1)">上一页</button>
    <button
      v-for="p in pages"
      :key="p"
      class="page-btn"
      :class="{ active: p === page }"
      @click="go(p)"
    >
      {{ p }}
    </button>
    <button class="btn btn-ghost btn-sm" :disabled="page >= totalPages" @click="go(page + 1)">下一页</button>
    <span class="small muted">共 {{ total }} 条 / {{ totalPages }} 页</span>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ page: number; totalPages: number; total: number }>()
const emit = defineEmits<{ (e: 'change', page: number): void }>()

const pages = computed(() => {
  const list: number[] = []
  const start = Math.max(1, props.page - 2)
  const end = Math.min(props.totalPages, start + 4)
  for (let i = start; i <= end; i++) list.push(i)
  return list
})

const go = (page: number) => {
  if (page < 1 || page > props.totalPages || page === props.page) return
  emit('change', page)
}
</script>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 28px;
  flex-wrap: wrap;
}
.page-btn {
  min-width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink-2);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.18s;
}
.page-btn:hover {
  border-color: var(--brand);
  color: var(--brand);
}
.page-btn.active {
  background: var(--brand);
  border-color: var(--brand);
  color: #fff;
  font-weight: 700;
}
</style>
