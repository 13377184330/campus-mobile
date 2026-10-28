<template>
  <div class="page with-tabbar">
    <van-nav-bar title="学员积分 · 打分" fixed placeholder>
      <template #right>
        <div class="nav-right" @click="doLogout">
          <van-icon name="manager-o" size="16" />
          <span class="nav-name">{{ nickName || '退出' }}</span>
        </div>
      </template>
    </van-nav-bar>

    <!-- 概览：来自 /stu/dashboard/overview，该接口未加权限注解，普通教师也能看到 -->
    <div v-if="overview" class="stat-bar">
      <div class="stat">
        <b>{{ num(overview.studentTotal) }}</b>
        <span>在校学生</span>
      </div>
      <div class="stat">
        <b>{{ num(overview.classTotal) }}</b>
        <span>班级</span>
      </div>
      <div class="stat">
        <b class="warn">{{ warningCount }}</b>
        <span>预警(&lt;60分)</span>
      </div>
    </div>

    <!-- ============ 打分：班级 / 学生选择 ============ -->
    <template v-if="tab === 0">
      <van-search
        v-model="keyword"
        shape="round"
        background="transparent"
        placeholder="搜索姓名 / 学号"
        clearable
      />

      <!-- 班级：列表式选择（班级再多也能一眼挑到） -->
      <div class="class-row" @click="showClassPicker = true">
        <div class="class-row-main">
          <span class="class-row-label">班级</span>
          <span class="class-row-name">{{ activeClass.name }}</span>
          <span class="class-row-count">{{ activeClass.count }} 人</span>
        </div>
        <div class="class-row-action">
          <span class="class-row-btn">切换</span>
          <van-icon name="arrow" size="12" color="#c8c9cc" />
        </div>
      </div>

      <van-popup v-model:show="showClassPicker" position="bottom" round :style="{ maxHeight: '78vh' }">
        <div class="picker-head">
          <span class="picker-title">选择班级</span>
          <span class="picker-close" @click="showClassPicker = false">关闭</span>
        </div>
        <div class="picker-list">
          <div
            v-for="c in classChips"
            :key="c.id"
            class="picker-item"
            :class="{ active: c.id === activeClassId }"
            @click="pickClass(c.id)"
          >
            <div class="picker-item-main">
              <span class="picker-item-name">{{ c.name }}</span>
              <span class="picker-item-num">{{ c.count }} 人</span>
            </div>
            <van-icon v-if="c.id === activeClassId" name="success" color="#1989fa" />
          </div>
        </div>
      </van-popup>

      <div class="toolbar">
        <span class="count">共 {{ visibleStudents.length }} 人</span>
        <label class="switch-line">
          <van-switch v-model="includeLeft" size="18px" />
          <span>显示离校</span>
        </label>
      </div>

      <van-pull-refresh v-model="refreshingStudents" @refresh="refreshAll">
        <div v-if="loadingStudents" class="empty-box">
          <van-loading vertical size="22">加载学生中...</van-loading>
        </div>
        <div v-else-if="!visibleStudents.length" class="empty-box">
          <van-empty :description="emptyText" />
          <div class="empty-action" v-if="!store.loaded">
            <van-button size="small" round type="primary" plain @click="refreshAll">重新加载</van-button>
          </div>
        </div>
        <div v-else class="stu-grid">
          <button
            v-for="s in visibleStudents"
            :key="s.studentId"
            class="stu-card"
            @click="goScore(s)"
          >
            <span v-if="!isInSchool(s)" class="left-tag">离校</span>
            <div class="stu-name">{{ s.name }}</div>
            <div class="stu-no">{{ s.studentNo }}</div>
            <span
              class="stu-score"
              :style="{ color: levelOf(s.totalScore).color, background: levelOf(s.totalScore).color + '1a' }"
            >
              {{ num(s.totalScore) }}
            </span>
          </button>
        </div>
      </van-pull-refresh>
    </template>

    <!-- ============ 全站动态 ============ -->
    <template v-else>
      <div class="class-bar">
        <div
          v-for="f in logFilters"
          :key="f.value"
          class="chip"
          :class="{ active: logFilter === f.value }"
          @click="setLogFilter(f.value)"
        >
          {{ f.label }}
        </div>
      </div>

      <van-pull-refresh v-model="refreshingLogs" @refresh="refreshLogs">
        <div class="card log-card">
          <div v-if="logsLoading && !logs.length" class="empty-box">
            <van-loading vertical size="22">加载动态中...</van-loading>
          </div>
          <div v-else-if="!logs.length" class="empty-box">
            <van-empty description="还没有打分记录" />
          </div>

          <div
            v-for="log in logs"
            :key="log.logId"
            class="log-row"
            :class="{ 'log-row-new': log.unread }"
            @click="goStudent(log)"
          >
            <div class="avatar">{{ (log.studentName || '?').slice(0, 1) }}</div>
            <div class="body">
              <div class="line1">{{ log.studentName || '#' + log.studentId }} · {{ log.reason || '未填事由' }}</div>
              <div class="line2">
                {{ log.createByName || log.createBy || '未知老师' }} · {{ fromNow(log.createTime) }}
              </div>
            </div>
            <div>
              <div class="value" :class="Number(log.changeScore) > 0 ? 'score-up' : 'score-down'">
                {{ signed(log.changeScore) }}
              </div>
              <div class="after">余 {{ num(log.scoreAfter) }}</div>
            </div>
          </div>

          <div v-if="logFallback" class="hint-line">
            <van-icon name="info-o" />
            当前账号没有「积分流水」查看权限，这里展示首页概览的最近 {{ logs.length }} 条动态
          </div>
          <div v-else-if="logs.length && logs.length < logTotal" class="more">
            <van-button size="small" round plain :loading="logsLoading" @click="loadMore">
              加载更多（{{ logs.length }}/{{ logTotal }}）
            </van-button>
          </div>
          <div v-else-if="logs.length" class="hint-line">已经到底了</div>
        </div>
      </van-pull-refresh>
    </template>

    <van-tabbar v-model="tab" fixed placeholder>
      <van-tabbar-item icon="edit">打分</van-tabbar-item>
      <van-tabbar-item icon="clock-o" :badge="unread ? String(unread > 99 ? '99+' : unread) : ''">动态</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showFailToast } from 'vant'
import { allStudents, classOptions, scoreLogPage, dashboardOverview } from '../api'
import { store, setStudents, setClasses, isInSchool } from '../store'
import { getUser, clearAuth } from '../utils/auth'
import { signed, fromNow, scoreLevel } from '../utils/format'

const router = useRouter()

const tab = ref(0)
const keyword = ref('')
const activeClassId = ref(0)
const includeLeft = ref(false)
const loadingStudents = ref(false)
const refreshingStudents = ref(false)
const overview = ref(null)

const logs = ref([])
const logTotal = ref(0)
const logFilter = ref('all')
const logsLoading = ref(false)
const refreshingLogs = ref(false)
const logFallback = ref(false)
const logPage = reactive({ pageNum: 1, pageSize: 20 })

// 班级列表浮层
const showClassPicker = ref(false)

// 动态未读红点：只统计「别人」在我上次看过之后的新流水
const SEEN_KEY = 'Mobile-LogSeen'
const unread = ref(0)
const lastSeenLogId = ref(0)
const hasSeenMark = ref(false)
const myUserName = (getUser() && getUser().userName) || ''

function markSeen() {
  let maxId = lastSeenLogId.value
  logs.value.forEach((log) => {
    const id = Number(log.logId) || 0
    if (id > maxId) maxId = id
  })
  if (maxId > lastSeenLogId.value) {
    lastSeenLogId.value = maxId
    localStorage.setItem(SEEN_KEY, String(maxId))
  }
  hasSeenMark.value = true
}

function applyUnread() {
  const viewing = tab.value === 1
  const seen = lastSeenLogId.value
  let count = 0
  logs.value = logs.value.map((log) => {
    const isNew = !viewing && Number(log.logId) > seen && (log.createBy || '') !== myUserName
    if (isNew) count++
    return { ...log, unread: isNew }
  })
  unread.value = count
  if (viewing) markSeen()
}

/** 首次运行把当前能看到的历史当作已读，不上去就挂个红点 */
function settleUnread() {
  if (!hasSeenMark.value && logs.value.length) {
    markSeen()
    unread.value = 0
    return
  }
  applyUnread()
}

const nickName = ref((getUser() && getUser().nickName) || '')

const logFilters = [
  { value: 'all', label: '全部' },
  { value: 'add', label: '加分' },
  { value: 'sub', label: '扣分' }
]

const num = (v) => (v === undefined || v === null || v === '' ? '-' : v)
const levelOf = (score) => scoreLevel(score)

const warningCount = computed(() => {
  const dist = (overview.value && overview.value.scoreDistribution) || {}
  return Number(dist.warning || 0)
})

/** 是否显示离校学生：默认只看在校，便于课间快速点人 */
function matchBase(s) {
  return includeLeft.value ? true : isInSchool(s)
}

const classChips = computed(() => {
  const pool = store.students.filter(matchBase)
  const list = store.classes.map((c) => ({
    id: c.classId,
    name: c.className,
    count: pool.filter((s) => s.classId === c.classId).length
  }))
  return [{ id: 0, name: '全部', count: pool.length }, ...list]
})

const activeClass = computed(() => {
  const list = classChips.value
  return list.find((c) => c.id === activeClassId.value) || list[0]
})

function pickClass(id) {
  activeClassId.value = id
  showClassPicker.value = false
}

const visibleStudents = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return store.students.filter((s) => {
    if (!matchBase(s)) return false
    if (activeClassId.value && s.classId !== activeClassId.value) return false
    if (!kw) return true
    return (
      (s.name || '').toLowerCase().includes(kw) ||
      (s.studentNo || '').toLowerCase().includes(kw)
    )
  })
})

const emptyText = computed(() => {
  if (keyword.value.trim()) return '没有匹配的学生，换个关键字试试'
  return includeLeft.value ? '该班级暂无学生' : '该班级暂无在校学生'
})

/* ---------------- 数据加载 ---------------- */

/**
 * 一次拉全量：班级走 optionselect、学生走 allList，两个接口后端都没有权限注解，
 * 拿到后班级切换、关键字搜索全部在本地完成，点一下就出结果，不在校园网上反复请求。
 */
async function loadBase() {
  loadingStudents.value = true
  try {
    const [cls, stu] = await Promise.allSettled([classOptions(), allStudents()])
    if (cls.status === 'fulfilled') {
      setClasses(cls.value.data || [])
    }
    if (stu.status === 'fulfilled') {
      setStudents(stu.value.data || [])
    } else {
      showFailToast((stu.reason && stu.reason.message) || '学生列表加载失败')
    }
  } finally {
    loadingStudents.value = false
  }
}

async function loadOverview() {
  try {
    const res = await dashboardOverview()
    overview.value = res.data || null
    // 概览自带最近 8 条动态，先把动态页填上，等用户切过去再拉全量
    const recent = (res.data && res.data.recentScores) || []
    if (!logs.value.length && recent.length) {
      logs.value = recent
      logTotal.value = recent.length
    }
    settleUnread()
  } catch (e) {
    // 概览失败不影响打分的核心流程
  }
}

async function refreshAll() {
  refreshingStudents.value = true
  try {
    await Promise.all([loadBase(), loadOverview()])
  } finally {
    refreshingStudents.value = false
  }
}

/** 全站动态：优先进 /stu/score/list（带分页与增减筛选），无权限时退回 dashboard 的 recentScores */
async function loadLogs({ reset = true } = {}) {
  if (logsLoading.value) return
  logsLoading.value = true
  if (reset) logPage.pageNum = 1
  try {
    const params = { pageNum: logPage.pageNum, pageSize: logPage.pageSize }
    if (logFilter.value !== 'all') {
      params.params = { changeType: logFilter.value }
    }
    const res = await scoreLogPage(params)
    const rows = res.rows || []
    logs.value = reset ? rows : logs.value.concat(rows)
    logTotal.value = Number(res.total || rows.length)
    logFallback.value = false
    settleUnread()
  } catch (e) {
    if (reset) {
      await fallbackLogs()
    } else {
      logPage.pageNum = Math.max(1, logPage.pageNum - 1)
      showFailToast(e.message || '加载失败')
    }
  } finally {
    logsLoading.value = false
  }
}

async function fallbackLogs() {
  try {
    const res = await dashboardOverview()
    const data = res.data || {}
    overview.value = data
    const recent = data.recentScores || []
    const filtered = recent.filter((l) => {
      const v = Number(l.changeScore)
      if (logFilter.value === 'add') return v > 0
      if (logFilter.value === 'sub') return v < 0
      return true
    })
    logs.value = filtered
    logTotal.value = filtered.length
    logFallback.value = true
    settleUnread()
  } catch (e) {
    logs.value = []
    logTotal.value = 0
    logFallback.value = false
    showFailToast('动态加载失败，请下拉重试')
  }
}

async function refreshLogs() {
  refreshingLogs.value = true
  try {
    await loadLogs({ reset: true })
  } finally {
    refreshingLogs.value = false
  }
}

function setLogFilter(value) {
  if (logFilter.value === value) return
  logFilter.value = value
  logs.value = []
  logTotal.value = 0
  loadLogs({ reset: true })
}

function loadMore() {
  if (logsLoading.value || logFallback.value) return
  logPage.pageNum += 1
  loadLogs({ reset: false })
}

/* ---------------- 交互 ---------------- */

function goScore(student) {
  router.push({ name: 'score', params: { studentId: student.studentId } })
}

function goStudent(log) {
  const studentId = log && log.studentId
  if (!studentId) return
  // 点开这条就等于看过了，回来后这行不再标红
  const id = Number(log.logId) || 0
  if (id > lastSeenLogId.value) {
    lastSeenLogId.value = id
    localStorage.setItem(SEEN_KEY, String(id))
    hasSeenMark.value = true
  }
  applyUnread()
  router.push({ name: 'score', params: { studentId } })
}

function doLogout() {
  showConfirmDialog({
    title: '退出登录',
    message: '退出后需要重新输入账号密码，确定吗？'
  })
    .then(() => {
      clearAuth()
      router.replace('/login')
    })
    .catch(() => {})
}

onMounted(async () => {
  const stored = localStorage.getItem(SEEN_KEY)
  hasSeenMark.value = stored !== null && stored !== '' && !isNaN(Number(stored))
  lastSeenLogId.value = hasSeenMark.value ? Number(stored) : 0

  await Promise.all([loadBase(), loadOverview()])
  // 不在动态 tab 时也要能算出「别人新打了分」的红点
  loadLogs({ reset: true })
})

watch(tab, (value) => {
  // 进动态页即视为已读，红点立刻清零；同时拉一次全量流水
  if (value === 1) {
    applyUnread()
    loadLogs({ reset: true })
  } else {
    applyUnread()
  }
})
</script>

<style scoped>
.nav-right {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--text-2);
}

.nav-name {
  font-size: 13px;
  max-width: 90px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.stat-bar {
  display: flex;
  margin: 10px 12px 2px;
  background: #fff;
  border-radius: 12px;
  padding: 12px 6px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.stat {
  flex: 1;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat + .stat {
  border-left: 1px solid #f2f3f5;
}

.stat b {
  font-size: 19px;
  font-weight: 700;
  color: var(--text);
}

.stat b.warn {
  color: var(--down);
}

.stat span {
  font-size: 11px;
  color: var(--text-3);
}

.class-bar {
  display: flex;
  gap: 8px;
  padding: 4px 12px 8px;
  overflow-x: auto;
  white-space: nowrap;
  -webkit-overflow-scrolling: touch;
}

/* ---------- 班级选择行 + 浮层列表 ---------- */
.class-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 4px 12px 0;
  padding: 12px 14px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  cursor: pointer;
}

.class-row-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.class-row-label {
  font-size: 12px;
  color: var(--text-3);
}

.class-row-name {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  max-width: 160px;
}

.class-row-count {
  font-size: 11px;
  color: var(--text-3);
}

.class-row-action {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
}

.class-row-btn {
  font-size: 12px;
  color: var(--brand);
}

.picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 10px;
  border-bottom: 1px solid #f2f3f5;
}

.picker-title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
}

.picker-close {
  font-size: 13px;
  color: var(--text-3);
  padding: 4px 8px;
}

.picker-list {
  max-height: 60vh;
  overflow-y: auto;
  padding-bottom: env(safe-area-inset-bottom);
}

.picker-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #f7f8fa;
  cursor: pointer;
}

.picker-item.active {
  background: rgba(25, 137, 250, 0.06);
}

.picker-item-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.picker-item-name {
  font-size: 14px;
  color: var(--text);
}

.picker-item.active .picker-item-name {
  color: var(--brand);
  font-weight: 600;
}

.picker-item-num {
  font-size: 11px;
  color: var(--text-3);
}

.class-bar::-webkit-scrollbar {
  display: none;
}

.class-bar .chip {
  flex: 0 0 auto;
}

.chip .cnt {
  font-size: 10px;
  color: var(--text-3);
  background: #f2f3f5;
  border-radius: 8px;
  padding: 0 5px;
}

.chip.active .cnt {
  color: var(--brand);
  background: rgba(25, 137, 250, 0.14);
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px 8px;
  font-size: 12px;
  color: var(--text-3);
}

.switch-line {
  display: flex;
  align-items: center;
  gap: 6px;
}

.empty-action {
  text-align: center;
  margin-top: 4px;
}

.log-card {
  margin-top: 0;
  padding: 4px 14px;
}

.log-card .log-row:first-child {
  padding-top: 10px;
}

.log-row-new {
  background: rgba(238, 10, 36, 0.03);
}

.hint-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 12px 0 4px;
  font-size: 11px;
  color: var(--text-3);
  text-align: center;
}

.more {
  display: flex;
  justify-content: center;
  padding: 14px 0 4px;
}
</style>
