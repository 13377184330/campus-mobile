/**
 * 积分等级：阈值与 PC 管理端首页「积分分布」保持一致
 * ≥90 优秀 / ≥70 良好 / ≥60 及格 / <60 预警
 */
export function scoreLevel(score) {
  const n = Number(score) || 0
  if (n >= 90) return { type: 'success', text: '优秀', color: '#07c160' }
  if (n >= 70) return { type: 'primary', text: '良好', color: '#1989fa' }
  if (n >= 60) return { type: 'warning', text: '及格', color: '#ff976a' }
  return { type: 'danger', text: '预警', color: '#ee0a24' }
}

/** 分值带符号展示：+3 / -2 / 0 */
export function signed(value) {
  const n = Number(value) || 0
  return n > 0 ? '+' + n : String(n)
}

function pad(n) {
  return n < 10 ? '0' + n : String(n)
}

/**
 * 后端 createTime 形如 "2026-10-28 13:54:52"（Jackson 已格式化），
 * 这里转成「刚刚 / 12 分钟前 / 今天 13:54 / 10-27 08:10」这类手机上好读的形式。
 */
export function fromNow(value) {
  if (!value) return ''
  const time = new Date(String(value).replace(/-/g, '/'))
  if (isNaN(time.getTime())) return String(value)

  const now = new Date()
  const diff = Math.floor((now.getTime() - time.getTime()) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前'
  if (diff < 86400 && now.getDate() === time.getDate()) {
    return '今天 ' + pad(time.getHours()) + ':' + pad(time.getMinutes())
  }
  if (diff < 172800) {
    return '昨天 ' + pad(time.getHours()) + ':' + pad(time.getMinutes())
  }
  return pad(time.getMonth() + 1) + '-' + pad(time.getDate()) + ' ' + pad(time.getHours()) + ':' + pad(time.getMinutes())
}
