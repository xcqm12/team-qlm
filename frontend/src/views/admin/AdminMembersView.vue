<template>
  <div>
    <section class="card mb-16">
      <div class="card-body">
        <div class="flex-between mb-16">
          <h3>{{ editing ? `编辑成员 #${editing.id}` : '添加成员' }}</h3>
          <div class="flex" style="gap: 8px">
            <button v-if="editing" class="btn btn-ghost btn-sm" @click="resetForm">取消编辑</button>
            <button class="btn btn-primary btn-sm" :disabled="saving" @click="save">
              {{ saving ? '保存中…' : editing ? '保存修改' : '添加成员' }}
            </button>
          </div>
        </div>
        <div class="form-grid">
          <div class="field">
            <label>名称 / ID *</label>
            <input v-model="form.name" class="input" placeholder="如 zasta" />
          </div>
          <div class="field">
            <label>职务</label>
            <input v-model="form.role" class="input" placeholder="室长 / 副室长 / 成员" />
          </div>
          <div class="field">
            <label>加入时间</label>
            <input v-model="form.joinedAt" class="input" placeholder="2019-01" />
          </div>
          <div class="field">
            <label>排序（越小越前）</label>
            <input v-model.number="form.sortOrder" class="input" type="number" />
          </div>
          <div class="field">
            <label>头像文件</label>
            <select v-model="form.avatarFileId" class="select">
              <option :value="null">不使用头像</option>
              <option v-for="f in imageFiles" :key="f.id" :value="f.id">{{ f.originalName }}</option>
            </select>
          </div>
          <div class="field">
            <label>擅长</label>
            <input v-model="form.skills" class="input" placeholder="地图制作，测试" />
          </div>
        </div>
        <div class="field">
          <label>简介</label>
          <textarea v-model="form.bio" class="textarea" rows="2"></textarea>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-body">
        <LoadingBlock v-if="loading" />
        <div v-else class="table-wrap">
          <table v-if="items.length" class="table">
            <thead>
              <tr>
                <th>成员</th>
                <th>职务</th>
                <th>擅长</th>
                <th>加入</th>
                <th style="width: 150px">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="member in items" :key="member.id">
                <td>
                  <div class="fname">
                    <span class="avatar">
                      <img v-if="member.avatar" :src="member.avatar.thumbnailUrl || member.avatar.url" alt="" />
                      <template v-else>{{ member.name.slice(0, 1) }}</template>
                    </span>
                    <strong>{{ member.name }}</strong>
                  </div>
                </td>
                <td><span class="badge">{{ member.role }}</span></td>
                <td class="small muted text-clip" style="max-width: 260px">{{ member.skills }}</td>
                <td class="small muted">{{ member.joined_at || '—' }}</td>
                <td>
                  <div class="flex" style="gap: 6px">
                    <button class="btn btn-ghost btn-sm" @click="edit(member)">编辑</button>
                    <button class="btn btn-danger btn-sm" @click="remove(member)">删除</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <EmptyState v-else emoji="👥" title="还没有成员" />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fileApi, memberApi, type FileItem, type Member } from '@/api'
import { useToast } from '@/composables/useToast'
import LoadingBlock from '@/components/LoadingBlock.vue'
import EmptyState from '@/components/EmptyState.vue'

const toast = useToast()
const items = ref<Member[]>([])
const files = ref<FileItem[]>([])
const loading = ref(true)
const saving = ref(false)
const editing = ref<Member | null>(null)

const emptyForm = () => ({
  name: '',
  role: '成员',
  skills: '',
  bio: '',
  joinedAt: '',
  sortOrder: 0,
  avatarFileId: null as number | null
})

const form = ref(emptyForm())
const imageFiles = computed(() => files.value.filter((f) => f.kind === 'image'))

const reload = async () => {
  loading.value = true
  try {
    const res = await memberApi.list()
    items.value = res.items
  } finally {
    loading.value = false
  }
}

const loadFiles = async () => {
  const res = await fileApi.list({ pageSize: 100, scope: 'all' }).catch(() => null)
  if (res) files.value = res.data.items.filter((f) => f.kind === 'image')
}

const resetForm = () => {
  editing.value = null
  form.value = emptyForm()
}

const edit = (member: Member) => {
  editing.value = member
  form.value = {
    name: member.name,
    role: member.role,
    skills: member.skills,
    bio: member.bio,
    joinedAt: member.joined_at,
    sortOrder: member.sort_order,
    avatarFileId: member.avatar?.id ?? null
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const save = async () => {
  if (!form.value.name.trim()) {
    toast.error('请填写成员名称')
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      await memberApi.update(editing.value.id, { ...form.value })
      toast.success('成员信息已更新')
    } else {
      await memberApi.create({ ...form.value })
      toast.success('成员已添加')
    }
    resetForm()
    await reload()
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    saving.value = false
  }
}

const remove = async (member: Member) => {
  if (!confirm(`确定删除成员「${member.name}」？`)) return
  try {
    await memberApi.remove(member.id)
    toast.success('已删除')
    await reload()
  } catch (err: any) {
    toast.error(err.message)
  }
}

onMounted(async () => {
  await Promise.all([reload(), loadFiles()])
})
</script>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
}
.table-wrap {
  overflow-x: auto;
}
.fname {
  display: flex;
  align-items: center;
  gap: 10px;
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--brand), var(--accent));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  overflow: hidden;
  flex-shrink: 0;
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
