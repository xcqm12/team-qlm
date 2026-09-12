<template>
  <div class="login-page">
    <div class="login-card card">
      <div class="card-body">
        <div class="brand">
          <img :src="site.logoUrl" :alt="site.siteName" class="logo" />
          <div>
            <h1>{{ site.siteName }}</h1>
            <p class="muted small">内容管理后台</p>
          </div>
        </div>

        <form @submit.prevent="submit">
          <div class="field">
            <label>用户名</label>
            <input v-model="form.username" class="input" autocomplete="username" required placeholder="admin" />
          </div>
          <div class="field">
            <label>密码</label>
            <input
              v-model="form.password"
              class="input"
              type="password"
              autocomplete="current-password"
              required
              placeholder="请输入密码"
            />
          </div>
          <button class="btn btn-primary btn-block" :disabled="loading">
            <span v-if="loading" class="spinner"></span>
            {{ loading ? '登录中…' : '登 录' }}
          </button>
        </form>

        <p v-if="error" class="error">⚠️ {{ error }}</p>

        <p class="hint center mt-16">
          账号 <code>admin</code>；初始密码见部署脚本输出
          （<code>backend/.env</code> 中的 <code>ADMIN_PASSWORD</code>）
        </p>
        <p class="hint center mt-8 small">
          忘记密码？在服务器上执行
          <code>node backend/scripts/reset-password.js '新密码'</code>
        </p>
        <p class="center mt-8"><router-link to="/" class="small">← 返回站点首页</router-link></p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSiteStore } from '@/stores/site'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
const site = useSiteStore()
const route = useRoute()
const router = useRouter()
const toast = useToast()

const form = ref({ username: 'admin', password: '' })
const loading = ref(false)
const error = ref('')

const submit = async () => {
  loading.value = true
  error.value = ''
  try {
    await auth.login(form.value.username, form.value.password)
    toast.success('登录成功')
    const redirect = (route.query.redirect as string) || '/admin/dashboard'
    router.replace(redirect)
  } catch (err: any) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: radial-gradient(circle at 20% 20%, var(--brand-soft), transparent 55%),
    radial-gradient(circle at 80% 80%, var(--accent-soft), transparent 55%), var(--bg);
}
.login-card {
  width: min(420px, 100%);
}
.brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 24px;
}
.logo {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: #fff;
  box-shadow: var(--shadow-sm);
}
.brand h1 {
  font-size: 19px;
  margin: 0;
}
.error {
  margin-top: 14px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  background: rgba(229, 72, 77, 0.1);
  color: var(--danger);
  font-size: 13.5px;
}
</style>
