<template>
  <component :is="layoutComponent">
    <router-view v-slot="{ Component }">
      <transition name="page" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </component>
  <ToastHost />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ToastHost from '@/components/ToastHost.vue'
import PublicLayout from '@/components/PublicLayout.vue'

const route = useRoute()

// 后台页面自带布局，登录页为空白布局，其余使用公共头尾
const layoutComponent = computed(() =>
  route.meta.layout === 'blank' || route.path.startsWith('/admin') ? 'div' : PublicLayout
)
</script>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-leave-to {
  opacity: 0;
}
</style>
