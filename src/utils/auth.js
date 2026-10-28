const TOKEN_KEY = 'Admin-Token'
const USER_KEY = 'Mobile-User'
const PERM_KEY = 'Mobile-Perm'
const REMEMBER_KEY = 'Mobile-Remember'

/** 读取令牌 */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

/** 保存令牌 */
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

/** 读取当前登录教师信息 { userName, nickName } */
export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch (e) {
    return null
  }
}

/** 保存当前登录教师信息 */
export function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user || null))
}

/** 读取若依权限集合（/getInfo 返回），如 ['stu:student:score'] 或 ['*:*:*'] */
export function getPermissions() {
  try {
    const list = JSON.parse(localStorage.getItem(PERM_KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch (e) {
    return []
  }
}

/** 保存权限集合 */
export function setPermissions(list) {
  localStorage.setItem(PERM_KEY, JSON.stringify(Array.isArray(list) ? list : []))
}

/**
 * 是否具备某个权限点。
 * 管理员在若依里拿到的是通配权限 *:*:*，需要单独兼容。
 */
export function hasPerm(perm) {
  const list = getPermissions()
  if (!list.length) return false
  if (list.includes('*:*:*')) return true
  return list.includes(perm)
}

/** 记住上次登录的账号，方便教师下次点开就填 */
export function getRememberedUser() {
  return localStorage.getItem(REMEMBER_KEY) || ''
}

export function setRememberedUser(username) {
  if (username) {
    localStorage.setItem(REMEMBER_KEY, username)
  } else {
    localStorage.removeItem(REMEMBER_KEY)
  }
}

/** 清空登录态（401 / 主动退出） */
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(PERM_KEY)
}
