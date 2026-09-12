import { ref } from 'vue'

export interface Toast {
  id: number
  type: 'success' | 'error' | 'info'
  message: string
}

const toasts = ref<Toast[]>([])
let seq = 0

const push = (type: Toast['type'], message: string, duration = 3200) => {
  const id = ++seq
  toasts.value.push({ id, type, message })
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, duration)
}

export const useToast = () => ({
  toasts,
  success: (message: string) => push('success', message),
  error: (message: string) => push('error', message, 4200),
  info: (message: string) => push('info', message),
  remove: (id: number) => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }
})
