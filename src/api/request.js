import axios from 'axios'
import { getToken, clearAuth } from '../utils/auth'

// 开发态走 vite 代理 /api；生产同源部署（/static/m/），baseURL 为空直接打根路径
const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? '/api' : ''),
  timeout: 15000
})

/**
 * 把嵌套对象序列化成 params[changeType]=add 这种形式。
 * 若依后端用 BaseEntity.params（Map）接收动态查询条件，axios 默认序列化会把它变成 [object Object]。
 */
function serializeParams(params) {
  const parts = []
  const walk = (obj, prefix) => {
    Object.keys(obj).forEach((key) => {
      const val = obj[key]
      if (val === undefined || val === null || val === '') return
      const name = prefix ? `${prefix}[${key}]` : key
      if (Array.isArray(val)) {
        val.forEach((item, i) => {
          parts.push(encodeURIComponent(`${name}[${i}]`) + '=' + encodeURIComponent(item))
        })
      } else if (typeof val === 'object' && !(val instanceof Date)) {
        walk(val, name)
      } else {
        parts.push(encodeURIComponent(name) + '=' + encodeURIComponent(val))
      }
    })
  }
  walk(params, '')
  return parts.join('&')
}

service.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers['Authorization'] = 'Bearer ' + token
  }
  if (config.params) {
    config.paramsSerializer = { serialize: serializeParams }
  }
  return config
})

/** 统一构造带 code 的错误，页面可以按 e.code 区分「没权限」与「真失败」 */
function buildError(msg, code) {
  const err = new Error(msg || '请求失败')
  err.code = code
  return err
}

/** 登录态失效：清缓存并回到登录页（hash 路由，避免刷新后落到不存在的路径） */
function toLogin() {
  clearAuth()
  if (location.hash.indexOf('/login') === -1) {
    location.replace((import.meta.env.BASE_URL || '/') + '#/login')
  }
}

service.interceptors.response.use(
  (res) => {
    const body = res.data
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code === 200) {
        return body
      }
      if (body.code === 401) {
        toLogin()
        return Promise.reject(buildError(body.msg || '登录已过期，请重新登录', 401))
      }
      if (body.code === 403) {
        return Promise.reject(buildError(body.msg || '没有权限，请联系管理员授权', 403))
      }
      return Promise.reject(buildError(body.msg, body.code))
    }
    return body
  },
  (err) => {
    const status = err.response && err.response.status
    const data = (err.response && err.response.data) || {}
    if (status === 401) {
      toLogin()
      return Promise.reject(buildError(data.msg || '登录已过期，请重新登录', 401))
    }
    if (status === 403) {
      return Promise.reject(buildError(data.msg || '没有权限，请联系管理员授权', 403))
    }
    if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '')) {
      return Promise.reject(buildError('请求超时，请确认手机已连上校园 WiFi', 'TIMEOUT'))
    }
    if (!err.response) {
      return Promise.reject(buildError('网络异常，请检查校园网连接', 'NETWORK'))
    }
    return Promise.reject(buildError(data.msg || err.message, status))
  }
)

export default service
