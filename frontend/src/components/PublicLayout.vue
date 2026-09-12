<template>
  <div class="public-layout">
    <SiteHeader />
    <main class="public-main">
      <slot />
    </main>
    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import SiteHeader from '@/components/SiteHeader.vue'
import SiteFooter from '@/components/SiteFooter.vue'
</script>

<style scoped>
.public-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.public-main {
  flex: 1;
}
</style>
