<template>
  <div class="toast-host">
    <transition-group name="toast">
      <div v-for="toast in toasts" :key="toast.id" class="toast" :class="`toast-${toast.type}`" @click="remove(toast.id)">
        <span class="icon">{{ toast.type === 'success' ? '✅' : toast.type === 'error' ? '⚠️' : 'ℹ️' }}</span>
        <span class="msg">{{ toast.message }}</span>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { toasts, remove } = useToast()
</script>

<style scoped>
.toast-host {
  position: fixed;
  top: 84px;
  right: 20px;
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}
.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 240px;
  max-width: 380px;
  padding: 12px 16px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
  font-size: 14px;
  cursor: pointer;
}
.toast-success {
  border-left: 4px solid var(--success);
}
.toast-error {
  border-left: 4px solid var(--danger);
}
.toast-info {
  border-left: 4px solid var(--brand);
}
.msg {
  flex: 1;
}
.toast-enter-active,
.toast-leave-active {
  transition: all 0.28s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(30px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
