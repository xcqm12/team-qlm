import { ref, watchEffect } from 'vue'

const THEME_KEY = 'qlm_theme'
const stored = (localStorage.getItem(THEME_KEY) as 'light' | 'dark' | null) || null
const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false

const theme = ref<'light' | 'dark'>(stored || (prefersDark ? 'dark' : 'light'))

watchEffect(() => {
  document.documentElement.setAttribute('data-theme', theme.value)
  localStorage.setItem(THEME_KEY, theme.value)
})

export const useTheme = () => ({
  theme,
  toggleTheme: () => {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }
})
