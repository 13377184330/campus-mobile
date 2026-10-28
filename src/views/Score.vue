<template>
  <div class="page" :class="{ 'has-undo': !!undo }">
    <van-nav-bar :title="navTitle" left-arrow fixed placeholder @click-left="goBack" />

    <van-notice-bar
      v-if="!canScore"
      left-icon="warning-o"
      :scrollable="false"
      text="当前账号缺少「积分增减」权限，可以查看但无法提交打分，请联系管理员开通"
    />

    <!-- 学生信息 -->
    <div class="card stu-head">
      <div class="head-main">
        <div class="name-line">
          <span class="name">{{ student.name || '加载中...' }}</span>
          <van-tag v-if="student.status && !isInSchool(student)" type="warning" plain>离校</van-tag>
        </div>
        <div class="meta">
          {{ student.studentNo || '—' }}
          <span v-if="student.className">· {{ student.className }}</span>
        </div>
      </div>
      <div class="head-score">
        <div class="score-num" :style="{ color: level.color }">{{ num(student.totalScore) }}</div>
        <div class="score-label">{{ level.text }}</div>
      </div>
    </div>

    <!-- 事由 chips -->
    <div class="card">
      <div class="section-title">
        选择事由
        <span class="hint">点选自动带出分值</span>
      </div>
      <div v-if="!reasons.length" class="dict-empty">
        事由字典暂无数据，可直接在下方手输
      </div>
      <div v-else class="chip-wrap">
        <div
          v-for="r in reasons"
          :key="r.dictCode || r.dictLabel"
          class="chip"
          :class="[chipSign(r), { active: reason === r.dictLabel }]"
          @click="pickReason(r)"
        >
          <span>{{ r.dictLabel }}</span>
          <span class="val">{{ signed(r.dictValue) }}</span>
        </div>
      </div>
    </div>

    <!-- 分值 -->
    <div class="card">
      <div class="section-title">
        分值
        <span class="hint">正数加分 · 负数扣分</span>
      </div>
      <div class="score-editor">
        <van-stepper
          v-model="changeScore"
          :min="-50"
          :max="50"
          :step="1"
          integer
          theme="round"
          button-size="32"
          input-width="56"
        />
        <div v-if="afterScore !== null" class="preview">
          {{ num(student.totalScore) }}
          <van-icon name="arrow" />
          <b :class="changeScore > 0 ? 'score-up' : changeScore < 0 ? 'score-down' : ''">
            {{ afterScore }}
          </b>
        </div>
      </div>

      <div class="quick-row">
        <van-button
          v-for="q in quickValues"
          :key="q"
          size="small"
          round
          plain
          :type="q > 0 ? 'success' : 'danger'"
          @click="changeScore = q"
        >
          {{ signed(q) }}
        </van-button>
      </div>

      <van-field
        v-model="reason"
        label="事由"
        placeholder="点选上方模板，或手动输入"
        maxlength="100"
        show-word-limit
        class="reason-field"
      />
      <van-field v-model="remark" label="备注" placeholder="选填，最多 200 字" maxlength="200" />
    </div>

    <div class="submit-wrap">
      <van-button
        round
        block
        type="primary"
        :loading="submitting"
        loading-text="提交中..."
        :disabled="!canScore"
        @click="doSubmit"
      >
        提交打分
      </van-button>
    </div>

    <!-- 该生最近流水 -->
    <div class="card">
      <div class="section-title">
        该生最近流水
        <span v-if="historyDenied" class="hint">无「学生查询」权限</span>
        <span v-else-if="history.length" class="hint">共 {{ history.length }} 条</span>
      </div>
      <div v-if="!history.length" class="dict-empty">
        {{ historyDenied ? '暂无权限查看积分明细' : '暂无流水记录' }}
      </div>
      <template v-else>
        <div v-for="log in history.slice(0, 8)" :key="log.logId" class="log-row">
          <div class="body">
            <div class="line1">{{ log.reason || '未填事由' }}</div>
            <div class="line2">
              {{ log.createByName || log.createBy || '未知老师' }} · {{ fromNow(log.createTime) }}
              <template v-if="log.remark"> · {{ log.remark }}</template>
            </div>
          </div>
          <div>
            <div class="value" :class="Number(log.changeScore) > 0 ? 'score-up' : 'score-down'">
              {{ signed(log.changeScore) }}
            </div>
            <div class="after">余 {{ num(log.scoreAfter) }}</div>
          </div>
        </div>
      </template>
    </div>

    <!-- 30 秒撤销条 -->
    <transition name="undo-slide">
      <div v-if="undo" class="undo-bar">
        <div class="undo-text">
          <div class="undo-main">已提交 {{ signed(undo.changeScore) }} 分</div>
          <div class="undo-sub">撤销窗口剩 {{ left }} 秒</div>
        </div>
        <van-button size="small" round type="danger" plain :loading="submitting" @click="doUndo">
          撤销
        </van-button>
        <van-button size="small" round plain @click="closeUndo">知道了</van-button>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showSuccessToast, showFailToast, showConfirmDialog } from 'vant'
import { studentDetail, studentScoreLog, submitScore, getScoreReasons } from '../api'
import { store, patchStudentScore, isInSchool } from '../store'
import { hasPerm, getPermissions } from '../utils/auth'
import { signed, fromNow, scoreLevel } from '../utils/format'

const props = defineProps({
  studentId: { type: [String, Number], required: true }
})

const router = useRouter()
const sid = computed(() => Number(props.studentId))

/**
 * 权限自适应：/getInfo 里没存到权限（老会话 / 拿信息失败）时先按「有权限」放行，
 * 真被后端拒绝（403）再降级，避免因为读不到权限集合就白白挡住老师打分。
 */
const permsUnknown = getPermissions().length === 0
const canScore = ref(permsUnknown || hasPerm('stu:student:score'))
const canQuery = ref(permsUnknown || hasPerm('stu:student:query'))

const student = ref({})
const reasons = ref([])
const history = ref([])
const historyDenied = ref(false)
const changeScore = ref(1)
const reason = ref('')
const remark = ref('')
const submitting = ref(false)

const undo = ref(null)
const left = ref(30)
let ticker = null

const quickValues = [1, 2, 3, 5, -1, -2, -3, -5]

const num = (v) => (v === undefined || v === null || v === '' ? '—' : v)
const level = computed(() => scoreLevel(student.value.totalScore))
const navTitle = computed(() => (student.value.name ? student.value.name + ' · 打分' : '积分打分'))

const afterScore = computed(() => {
  if (student.value.totalScore === undefined || student.value.totalScore === null) return null
  return Number(student.value.totalScore) + (Number(changeScore.value) || 0)
})

function chipSign(r) {
  const v = Number(r.dictValue)
  if (v > 0) return 'pos'
  if (v < 0) return 'neg'
  return ''
}

function clampScore(value) {
  return Math.max(-50, Math.min(50, value))
}

function setLocalScore(score) {
  student.value.totalScore = score
  patchStudentScore(sid.value, score)
}

/* ---------------- 加载 ---------------- */

async function loadStudent() {
  // 列表页的全量缓存先顶上，进去就能看到名字和当前积分
  const cached = store.studentMap[sid.value]
  if (cached) {
    student.value = { ...cached }
  }
  if (!canQuery.value) return
  try {
    const res = await studentDetail(sid.value)
    if (res.data) {
      student.value = res.data
      patchStudentScore(sid.value, res.data.totalScore)
    }
  } catch (e) {
    if (e.code === 403) canQuery.value = false
    // 有缓存就用缓存，没有就保持占位
  }
}

async function loadReasons() {
  try {
    const res = await getScoreReasons()
    reasons.value = res.data || []
  } catch (e) {
    // 字典拿不到时仍可手动输入事由，不影响打分
    reasons.value = []
  }
}

async function loadHistory({ silent = false } = {}) {
  if (!canQuery.value) {
    historyDenied.value = true
    return
  }
  try {
    const res = await studentScoreLog(sid.value)
    const rows = res.data || []
    history.value = rows
    historyDenied.value = false
    // 最新一条的 score_after 就是学生当前积分，以服务端落库结果为准
    const top = rows[0]
    if (top && Number(top.studentId) === sid.value && top.scoreAfter !== null && top.scoreAfter !== undefined) {
      setLocalScore(Number(top.scoreAfter))
    }
  } catch (e) {
    if (e.code === 403) canQuery.value = false
    historyDenied.value = true
    if (!silent) {
      showFailToast(e.message || '流水加载失败')
    }
  }
}

/* ---------------- 打分 ---------------- */

function pickReason(r) {
  reason.value = r.dictLabel
  const v = Number(r.dictValue)
  if (!isNaN(v) && v !== 0) {
    changeScore.value = clampScore(v)
  }
}

async function doSubmit() {
  if (submitting.value) return
  if (!canScore.value) {
    showToast('账号缺少「积分增减」权限')
    return
  }
  const delta = Number(changeScore.value) || 0
  const why = (reason.value || '').trim()
  if (!delta) {
    showToast('分值不能为 0')
    return
  }
  if (!why) {
    showToast('请选择或输入事由')
    return
  }

  submitting.value = true
  try {
    await submitScore({
      studentId: sid.value,
      changeScore: delta,
      reason: why,
      remark: (remark.value || '').trim() || undefined
    })
    // 后端的 changeScore() 就是 current + delta，本地先按同一算法给即时反馈，
    // 随后 loadHistory 会用落库的 score_after 校准
    const before = Number(student.value.totalScore) || 0
    setLocalScore(before + delta)
    showSuccessToast(`已记录 ${signed(delta)} 分，当前 ${num(student.value.totalScore)} 分`)
    openUndo(delta, why)
    remark.value = ''
    loadHistory({ silent: true })
  } catch (e) {
    if (e.code === 403) canScore.value = false
    showFailToast(e.message || '提交失败')
  } finally {
    submitting.value = false
  }
}

/* ---------------- 30 秒反向流水撤销 ---------------- */

function openUndo(delta, why) {
  stopTicker()
  undo.value = { changeScore: delta, reason: why }
  left.value = 30
  ticker = setInterval(() => {
    left.value -= 1
    if (left.value <= 0) closeUndo()
  }, 1000)
}

function stopTicker() {
  if (ticker) {
    clearInterval(ticker)
    ticker = null
  }
}

function closeUndo() {
  stopTicker()
  undo.value = null
  left.value = 0
}

async function doUndo() {
  const cur = undo.value
  if (!cur || submitting.value) return

  let confirmed = true
  try {
    await showConfirmDialog({
      title: '撤销这次打分',
      message: `将补记一笔 ${signed(-cur.changeScore)} 分的反向流水，原记录保留以便追溯。`,
      confirmButtonText: '确认撤销'
    })
  } catch (e) {
    confirmed = false
  }
  if (!confirmed) return

  submitting.value = true
  try {
    await submitScore({
      studentId: sid.value,
      changeScore: -cur.changeScore,
      reason: ('撤销：' + cur.reason).slice(0, 100),
      remark: '30 秒内撤销上一笔打分（反向流水留痕）'
    })
    setLocalScore((Number(student.value.totalScore) || 0) - cur.changeScore)
    showSuccessToast('已撤销')
    closeUndo()
    loadHistory({ silent: true })
  } catch (e) {
    if (e.code === 403) canScore.value = false
    showFailToast(e.message || '撤销失败，可手动补记一笔反向流水')
  } finally {
    submitting.value = false
  }
}

/* ---------------- 其他 ---------------- */

function goBack() {
  // Vue Router 4 把上一页 fullPath 放在 history.state.back；
  // 直接打开本页（刷新 / 收藏）时它是空的，back() 点了没反应，这里回列表兜底。
  const state = window.history.state
  if (state && state.back) {
    router.back()
  } else {
    router.replace('/home')
  }
}

onMounted(() => {
  if (!student.value.name) {
    student.value = { ...(store.studentMap[sid.value] || {}) }
  }
  loadStudent()
  loadReasons()
  loadHistory({ silent: true })
})

onUnmounted(stopTicker)
</script>

<style scoped>
.stu-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.head-main {
  min-width: 0;
}

.name-line {
  display: flex;
  align-items: center;
  gap: 6px;
}

.name {
  font-size: 19px;
  font-weight: 700;
  color: var(--text);
}

.meta {
  margin-top: 5px;
  font-size: 12px;
  color: var(--text-3);
}

.head-score {
  text-align: center;
  flex: 0 0 auto;
}

.score-num {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.1;
}

.score-label {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 2px;
}

.dict-empty {
  font-size: 12px;
  color: var(--text-3);
  padding: 6px 0;
}

.score-editor {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.preview {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-3);
}

.preview b {
  font-size: 17px;
}

.quick-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.reason-field {
  margin-top: 8px;
}

.submit-wrap {
  padding: 4px 12px 0;
}

.page.has-undo {
  padding-bottom: calc(84px + env(safe-area-inset-bottom));
}

.undo-bar {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: calc(12px + env(safe-area-inset-bottom));
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(50, 50, 51, 0.94);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.22);
}

.undo-text {
  flex: 1;
  min-width: 0;
  color: #fff;
}

.undo-main {
  font-size: 13px;
  font-weight: 600;
}

.undo-sub {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.65);
  margin-top: 2px;
}

.undo-slide-enter-active,
.undo-slide-leave-active {
  transition: all 0.22s ease;
}

.undo-slide-enter-from,
.undo-slide-leave-to {
  opacity: 0;
  transform: translateY(14px);
}
</style>
