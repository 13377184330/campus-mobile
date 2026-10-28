import request from './request'

/* ---------------- 登录与身份 ---------------- */

// 登录（沿用若依账号，与 PC 管理端一致）
export const login = (data) => request({ url: '/login', method: 'post', data })

// 图形验证码（若依返回 { captchaEnabled, uuid, img }）
export const getCaptcha = () => request({ url: '/captchaImage' })

// 当前用户信息：返回 user / roles / permissions，移动端用它做权限自适应
export const getInfo = () => request({ url: '/getInfo' })

/* ---------------- 字典：打分事由 ---------------- */

// stu_score_reason：dictLabel = 事由，dictValue = 默认分值（正加负扣）
export const getScoreReasons = () => request({ url: '/system/dict/data/type/stu_score_reason' })

/* ---------------- 班级 / 学生 ---------------- */

// 全部班级（后端未加权限注解，普通教师可用）
export const classOptions = () => request({ url: '/stu/class/optionselect' })

// 全部学生（后端未加权限注解，一次拉全量，前端做班级/关键字筛选）
export const allStudents = (params) => request({ url: '/stu/student/allList', params })

// 学生详情（需要 stu:student:query）
export const studentDetail = (studentId) => request({ url: '/stu/student/' + studentId })

// 某学生的积分流水（需要 stu:student:query）
export const studentScoreLog = (studentId) => request({ url: '/stu/student/scoreLog/' + studentId })

/* ---------------- 打分 ---------------- */

// 打分：后端 changeScore() 在一个事务里「写流水 + 回写学生积分」，前端不需要也不应该自己算总账
export const submitScore = (data) => request({ url: '/stu/student/score', method: 'post', data })

/* ---------------- 全站动态 ---------------- */

// 积分流水分页（需要 stu:score:list），支持 params[changeType] = add | sub
export const scoreLogPage = (params) => request({ url: '/stu/score/list', params })

// 首页概览（后端未加权限注解）：含 studentTotal / classTotal / recentScores，作为动态与统计的兜底数据源
export const dashboardOverview = () => request({ url: '/stu/dashboard/overview' })
