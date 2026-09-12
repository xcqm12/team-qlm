import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useSiteStore } from './stores/site'
import { useAuthStore } from './stores/auth'
import './assets/styles/main.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// 启动时并行拉取站点设置与校验登录态
const site = useSiteStore(pinia)
const auth = useAuthStore(pinia)
site.refresh().then(() => site.applyDocumentMeta())
auth.ensureLoaded()

app.mount('#app')
