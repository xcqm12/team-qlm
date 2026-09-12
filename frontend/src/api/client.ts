import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios'

export const TOKEN_KEY = 'qlm_token'
export const USER_KEY = 'qlm_user'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token)
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export interface ApiResult<T = any> {
  success: boolean
  message: string
  data: T
  [key: string]: any
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status = 0) {
    super(message)
    this.status = status
  }
}

const instance: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 60000
})

instance.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

instance.interceptors.response.use(
  (response) => response,
  (error: AxiosError<any>) => {
    const status = error.response?.status || 0
    const payload = error.response?.data
    let message = payload?.message || error.message || '网络异常，请稍后重试'

    if (status === 401) {
      clearToken()
      if (!location.pathname.startsWith('/admin/login')) {
        message = '登录状态已失效，请重新登录'
      }
    }
    if (status === 413) message = payload?.message || '文件超出大小限制'
    return Promise.reject(new ApiError(message, status))
  }
)

/** 统一请求：成功返回 data，失败抛出 ApiError */
export const request = async <T = any>(config: AxiosRequestConfig): Promise<T> => {
  const res = await instance.request<ApiResult<T>>(config)
  return res.data?.data as T
}

/** 需要完整响应的场景（如分页包装在 data 之外） */
export const requestFull = async <T = any>(config: AxiosRequestConfig): Promise<ApiResult<T>> => {
  const res = await instance.request<ApiResult<T>>(config)
  return res.data
}

export const uploadWithProgress = async (
  url: string,
  formData: FormData,
  onProgress?: (percent: number) => void
) => {
  const res = await instance.post<ApiResult>(url, formData, {
    timeout: 0,
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) return
      onProgress(Math.round((event.loaded / event.total) * 100))
    }
  })
  return res.data
}

export default instance
