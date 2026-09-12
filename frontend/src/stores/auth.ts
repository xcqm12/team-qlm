import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api'
import { USER_KEY, clearToken, getToken, setToken } from '@/api/client'

export const useAuthStore = defineStore('auth', () => {
  const loaded = ref(false)
  const user = ref<any>(JSON.parse(localStorage.getItem(USER_KEY) || 'null'))
  const jwtSecretIsDefault = ref(false)
  const isLoggedIn = computed(() => !!getToken() && !!user.value)

  const persistUser = (value: any) => {
    user.value = value
    if (value) localStorage.setItem(USER_KEY, JSON.stringify(value))
    else localStorage.removeItem(USER_KEY)
  }

  const login = async (username: string, password: string) => {
    const data = await authApi.login(username, password)
    setToken(data.token)
    persistUser(data.user)
    loaded.value = true
    return data.user
  }

  const logout = () => {
    clearToken()
    persistUser(null)
  }

  /** 应用启动时校验 token 是否仍然有效 */
  const ensureLoaded = async () => {
    if (loaded.value) return
    loaded.value = true
    if (!getToken()) {
      persistUser(null)
      return
    }
    try {
      const data = await authApi.me()
      persistUser(data.user)
      jwtSecretIsDefault.value = !!data.jwtSecretIsDefault
    } catch {
      logout()
    }
  }

  const changePassword = (oldPassword: string, newPassword: string) =>
    authApi.changePassword(oldPassword, newPassword)

  return { user, loaded, isLoggedIn, jwtSecretIsDefault, login, logout, ensureLoaded, changePassword }
})
