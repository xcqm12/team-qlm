<template>
  <div class="settings">
    <section class="card mb-16">
      <div class="card-body">
        <div class="flex-between mb-16">
          <h3>站点信息</h3>
          <button class="btn btn-primary btn-sm" :disabled="saving" @click="save">
            {{ saving ? '保存中…' : '保存设置' }}
          </button>
        </div>

        <div class="form-grid">
          <div v-for="field in fields" :key="field.key" class="field" :class="{ wide: field.wide }">
            <label>{{ field.label }}</label>
            <textarea v-if="field.type === 'textarea'" v-model="form[field.key]" class="textarea" rows="2"></textarea>
            <input v-else v-model="form[field.key]" class="input" :placeholder="field.placeholder" />
            <div v-if="field.hint" class="hint">{{ field.hint }}</div>
          </div>
        </div>

        <div class="field">
          <label>文件分类（JSON 数组，用于上传时选择）</label>
          <input v-model="categoriesText" class="input" placeholder='["工具软件","模组资源"]' />
          <div class="hint">格式示例：["工具软件","模组资源","文档资料","图片素材","其他"]</div>
        </div>
      </div>
    </section>

    <section class="card mb-16">
      <div class="card-body">
        <h3>修改登录密码</h3>
        <div class="form-grid">
          <div class="field">
            <label>当前密码</label>
            <input v-model="pwd.oldPassword" class="input" type="password" autocomplete="current-password" />
          </div>
          <div class="field">
            <label>新密码（至少 6 位）</label>
            <input v-model="pwd.newPassword" class="input" type="password" autocomplete="new-password" />
          </div>
          <div class="field">
            <label>确认新密码</label>
            <input v-model="pwd.confirm" class="input" type="password" autocomplete="new-password" />
          </div>
        </div>
        <button class="btn btn-primary btn-sm" :disabled="changingPwd" @click="changePassword">
          {{ changingPwd ? '提交中…' : '更新密码' }}
        </button>
      </div>
    </section>

    <section class="card mb-16">
      <div class="card-body">
        <div class="flex-between mb-16">
          <div>
            <h3>第三方链接检测（跳转前检查）</h3>
            <p class="muted small mt-0">
              访客点击第三方下载前，先确认目标地址是否可达，并记录 HTTP 状态、跳转次数与真实终点；
              检测结果默认缓存 10 分钟，避免每次都去打扰第三方平台。
            </p>
          </div>
          <button class="btn btn-primary btn-sm" :disabled="saving" @click="save">保存设置</button>
        </div>

        <div class="form-grid">
          <div class="field">
            <label>检测时机</label>
            <select v-model="form.link_check_mode" class="select">
              <option value="before-redirect">跳转前检测（推荐）</option>
              <option value="manual">仅后台手动检测</option>
            </select>
            <div class="hint">「跳转前检测」会在每次跳转前复用/刷新检测结果</div>
          </div>
          <div class="field">
            <label>结果缓存（秒）</label>
            <input v-model="form.link_check_ttl" class="input" type="number" min="0" max="86400" />
            <div class="hint">0 表示每次都重新检测（会变慢）；默认 600</div>
          </div>
          <div class="field">
            <label>单次检测超时（毫秒）</label>
            <input v-model="form.link_check_timeout_ms" class="input" type="number" min="1000" max="30000" />
            <div class="hint">默认 8000，超时即判定该链接暂不可达</div>
          </div>
          <div class="field">
            <label>最大跳转次数</label>
            <input v-model="form.link_check_max_hops" class="input" type="number" min="1" max="15" />
            <div class="hint">超过即判定为异常跳转链；默认 6</div>
          </div>
          <div class="field">
            <label>批量检测并发数</label>
            <input v-model="form.link_check_concurrency" class="input" type="number" min="1" max="8" />
            <div class="hint">后台「批量检测链接」与运维脚本使用；默认 3</div>
          </div>
          <div class="field">
            <label>不可达时是否拦截跳转</label>
            <select v-model="form.link_check_block" class="select">
              <option value="0">不拦截：仅记录并提示（推荐）</option>
              <option value="1">拦截：显示提示页，仍可「仍然前往」</option>
            </select>
            <div class="hint">拦截页会给出原因与「仍然尝试前往」的逃生通道</div>
          </div>
        </div>

        <div class="flex" style="gap: 8px; flex-wrap: wrap; margin-top: 12px">
          <button class="btn btn-ghost btn-sm" :disabled="checkingAll" @click="checkAllLinks">
            {{ checkingAll ? '检测中…' : '🔍 立即检测全部第三方链接' }}
          </button>
          <span v-if="checkResult" class="small" :class="checkResult.failed ? 'err-text' : 'ok-text'">
            {{ checkResult.text }}
          </span>
        </div>
      </div>
    </section>

    <section class="card mb-16">
      <div class="card-body">
        <div class="flex-between mb-16">
          <div>
            <h3>防 CC（连接/请求频率防护）</h3>
            <p class="muted small mt-0">
              两层防护：nginx 层限速限并发（部署脚本已写入 vhost 模板），应用层做「滑动窗口计数 + 并发保护 + 超限自动封禁」。
              已登录用户与白名单 IP 默认豁免，避免误伤后台与监控脚本。
            </p>
          </div>
          <button class="btn btn-primary btn-sm" :disabled="saving" @click="save">保存设置</button>
        </div>

        <div class="form-grid">
          <div class="field">
            <label>应用层防护开关</label>
            <select v-model="form.anticc_enabled" class="select">
              <option value="1">开启（推荐）</option>
              <option value="0">关闭</option>
            </select>
          </div>
          <div class="field">
            <label>统计窗口（毫秒）</label>
            <input v-model="form.anticc_window_ms" class="input" type="number" min="1000" max="600000" />
            <div class="hint">默认 60000（1 分钟）</div>
          </div>
          <div class="field">
            <label>单 IP 每窗口请求上限</label>
            <input v-model="form.anticc_max_requests" class="input" type="number" min="5" max="100000" />
            <div class="hint">默认 240，超出即封禁</div>
          </div>
          <div class="field">
            <label>封禁时长（秒）</label>
            <input v-model="form.anticc_ban_seconds" class="input" type="number" min="1" max="86400" />
            <div class="hint">默认 600（10 分钟）</div>
          </div>
          <div class="field">
            <label>单 IP 并发上限</label>
            <input v-model="form.anticc_max_per_ip" class="input" type="number" min="2" max="500" />
            <div class="hint">默认 16</div>
          </div>
          <div class="field">
            <label>全局并发上限</label>
            <input v-model="form.anticc_max_concurrent" class="input" type="number" min="10" max="5000" />
            <div class="hint">默认 200，超出返回 503</div>
          </div>
          <div class="field">
            <label>白名单 IP（逗号分隔）</label>
            <input v-model="form.anticc_whitelist" class="input" placeholder="127.0.0.1,10.0." />
            <div class="hint">支持前缀匹配，适合放行本机/办公出口/监控</div>
          </div>
          <div class="field">
            <label>已登录用户豁免</label>
            <select v-model="form.anticc_skip_token" class="select">
              <option value="1">豁免（推荐）</option>
              <option value="0">不豁免</option>
            </select>
          </div>
        </div>

        <div class="divider"></div>

        <div v-if="anticcStats" class="anticc-status">
          <div class="stat-row">
            <span class="chip">跟踪 IP：{{ anticcStats.tracked }}</span>
            <span class="chip" :class="{ danger: anticcStats.banned > 0 }">封禁中：{{ anticcStats.banned }}</span>
            <span class="chip">处理中：{{ anticcStats.inFlight }}</span>
            <span class="chip">累计拦截：{{ anticcStats.blockedTotal }}</span>
            <span class="chip">累计封禁：{{ anticcStats.bannedTotal }}</span>
            <span class="chip">并发拒绝：{{ anticcStats.concurrencyRejected }}</span>
          </div>
          <div v-if="anticcStats.bannedList?.length" class="banned-list">
            <div v-for="item in anticcStats.bannedList" :key="item.ip" class="banned-item">
              <code>{{ item.ip }}</code>
              <span class="small muted">剩余 {{ item.remainingSeconds }}s · 窗口内 {{ item.requests }} 次</span>
              <button class="btn btn-ghost btn-sm" @click="unban(item.ip)">解封</button>
            </div>
          </div>
          <div class="flex" style="gap: 8px; flex-wrap: wrap; margin-top: 10px">
            <button class="btn btn-ghost btn-sm" @click="loadAntiCc">刷新状态</button>
            <button class="btn btn-ghost btn-sm" :disabled="!anticcStats.banned" @click="unban('')">清空全部封禁</button>
            <span class="small muted">
              nginx 层：单 IP 15r/s（突发 30）、并发 20；命令行走 nginx 时同样生效
            </span>
          </div>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-body">
        <h3>安全与运维建议</h3>
        <ul class="tips">
          <li>在服务器 <code>backend/.env</code> 中把 <code>JWT_SECRET</code> 改成随机长字符串后重启服务。</li>
          <li>上传目录为 <code>backend/data/uploads</code>，请纳入定期备份；后台控制台可一键导出数据库 SQL 备份。</li>
          <li>若站点对外开放，请在宝塔面板为该站点开启 HTTPS 证书，并限制 <code>/admin</code> 的访问来源。</li>
          <li>修改单文件上传上限：调整 <code>.env</code> 中的 <code>MAX_UPLOAD_SIZE</code>，同时修改 nginx 的 <code>client_max_body_size</code>。</li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fileApi, siteApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useSiteStore } from '@/stores/site'
import { useToast } from '@/composables/useToast'

const site = useSiteStore()
const auth = useAuthStore()
const toast = useToast()

const saving = ref(false)
const changingPwd = ref(false)
const categoriesText = ref('[]')
const form = ref<Record<string, string>>({})
const pwd = ref({ oldPassword: '', newPassword: '', confirm: '' })

/* 链接检测：立即体检全部第三方链接 */
const checkingAll = ref(false)
const checkResult = ref<{ text: string; failed: number } | null>(null)

const checkAllLinks = async () => {
  checkingAll.value = true
  checkResult.value = null
  try {
    const res = await fileApi.checkAll(true)
    const suspicious = res.summary.suspicious ?? 0
    if (res.checked === 0) {
      checkResult.value = { text: `没有需要检测的链接（${res.skipped} 条结果仍在缓存有效期内）`, failed: 0 }
    } else {
      checkResult.value = {
        text:
          `检测 ${res.checked} 条：可达 ${res.summary.ok}` +
          (suspicious ? ` · 疑似风控 ${suspicious}` : '') +
          ` · 失效 ${res.summary.failed}`,
        failed: res.summary.failed
      }
      res.summary.failed ? toast.error('存在失效链接，请到「文件管理」中查看') : toast.success('没有失效链接')
    }
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    checkingAll.value = false
  }
}

/** 老库可能还没有这些键，给一份默认值兜底 */
const SETTINGS_DEFAULTS: Record<string, string> = {
  link_check_mode: 'before-redirect',
  link_check_ttl: '600',
  link_check_timeout_ms: '8000',
  link_check_max_hops: '6',
  link_check_concurrency: '3',
  link_check_block: '0',
  anticc_enabled: '1',
  anticc_window_ms: '60000',
  anticc_max_requests: '240',
  anticc_max_concurrent: '200',
  anticc_max_per_ip: '16',
  anticc_ban_seconds: '600',
  anticc_whitelist: '',
  anticc_skip_token: '1'
}

/* 防 CC 实时状态 */
const anticcStats = ref<any>(null)

const loadAntiCc = async () => {
  try {
    const res = await siteApi.anticc()
    anticcStats.value = res.anticc
  } catch (err: any) {
    toast.error(err.message)
  }
}

const unban = async (ip: string) => {
  if (ip && !confirm(`确认解封 ${ip}？`)) return
  if (!ip && !confirm('确认清空全部封禁与计数？')) return
  try {
    await siteApi.anticcUnban(ip)
    toast.success(ip ? `已解封 ${ip}` : '已清空全部封禁与计数')
    await loadAntiCc()
  } catch (err: any) {
    toast.error(err.message)
  }
}

interface SettingField {
  key: string
  label: string
  placeholder?: string
  type?: 'text' | 'textarea'
  wide?: boolean
  hint?: string
}

const fields: SettingField[] = [
  { key: 'site_name', label: '站点名称' },
  { key: 'site_short_name', label: '站点简称' },
  { key: 'site_slogan', label: '标语' },
  { key: 'founded_at', label: '成立日期', placeholder: '2019-11-11' },
  { key: 'contact_email', label: '联系邮箱' },
  { key: 'contact_hours', label: '工作时间' },
  { key: 'contact_address', label: '联系地址' },
  { key: 'icp', label: 'ICP 备案号', placeholder: '选填' },
  { key: 'site_description', label: '站点描述（SEO）', type: 'textarea', wide: true },
  { key: 'site_keywords', label: '关键词（SEO）', wide: true },
  { key: 'platform_mc', label: '网易我的世界链接' },
  { key: 'platform_curseforge', label: 'CurseForge 链接' },
  { key: 'platform_modrinth', label: 'Modrinth 链接' },
  { key: 'platform_github', label: 'GitHub 链接' },
  { key: 'footer_note', label: '页脚备注', wide: true }
]

const load = async () => {
  const data = await siteApi.settings()
  form.value = { ...SETTINGS_DEFAULTS, ...data.settings }
  categoriesText.value = JSON.stringify(data.fileCategories)
}

const save = async () => {
  let categories: string[] = []
  try {
    categories = JSON.parse(categoriesText.value)
    if (!Array.isArray(categories) || !categories.length) throw new Error('应为非空数组')
  } catch (err: any) {
    toast.error(`文件分类格式错误：${err.message}`)
    return
  }

  saving.value = true
  try {
    await siteApi.updateSettings({ ...form.value, file_categories: categories })
    toast.success('设置已保存')
    await site.refresh()
    site.applyDocumentMeta()
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    saving.value = false
  }
}

const changePassword = async () => {
  if (pwd.value.newPassword.length < 6) {
    toast.error('新密码至少 6 位')
    return
  }
  if (pwd.value.newPassword !== pwd.value.confirm) {
    toast.error('两次输入的新密码不一致')
    return
  }
  changingPwd.value = true
  try {
    await auth.changePassword(pwd.value.oldPassword, pwd.value.newPassword)
    toast.success('密码已更新，请牢记新密码')
    pwd.value = { oldPassword: '', newPassword: '', confirm: '' }
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    changingPwd.value = false
  }
}

onMounted(async () => {
  await load()
  await loadAntiCc()
})
</script>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
}
.field.wide {
  grid-column: 1 / -1;
}
.tips {
  margin: 0;
  padding-left: 20px;
  color: var(--ink-2);
  font-size: 14px;
}
.tips li {
  margin-bottom: 8px;
}
.ok-text {
  color: var(--success);
  font-weight: 600;
}
.err-text {
  color: var(--danger);
  font-weight: 600;
}
.anticc-status {
  margin-top: 4px;
}
.stat-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  font-size: 13px;
  color: var(--ink-2);
}
.chip.danger {
  background: rgba(229, 72, 77, 0.12);
  border-color: transparent;
  color: var(--danger);
  font-weight: 700;
}
.banned-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.banned-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}
.banned-item code {
  font-weight: 700;
  color: var(--danger);
}
.banned-item .btn {
  margin-left: auto;
}
h3 {
  font-size: 15.5px;
}
</style>
