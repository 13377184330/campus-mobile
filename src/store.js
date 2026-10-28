import { reactive } from 'vue'

/**
 * 轻量全局状态。
 * 首页手上有「全量学生」，打分页与动态页复用这份缓存：
 * 从列表点进打分页不必再请求一次学生详情，打完分返回列表也能立刻看到新积分。
 */
export const store = reactive({
  classes: [],
  students: [],
  studentMap: {},
  loaded: false
})

export function setClasses(list) {
  store.classes = Array.isArray(list) ? list : []
}

export function setStudents(list) {
  store.students = Array.isArray(list) ? list : []
  const map = {}
  store.students.forEach((s) => {
    map[s.studentId] = s
  })
  store.studentMap = map
  store.loaded = true
}

/** 打分后同步本地缓存，避免返回列表还显示旧积分 */
export function patchStudentScore(studentId, totalScore) {
  const target = store.studentMap[studentId]
  if (target) {
    target.totalScore = totalScore
  }
}

/** 某个班级的在校人数（班级 chips 上显示） */
export function classStudentCount(classId) {
  return store.students.filter((s) => isInSchool(s) && (classId === 0 || s.classId === classId)).length
}

/** 在校判定：后端 status 0=在校 1=离校，历史数据可能为空按在校处理 */
export function isInSchool(student) {
  return !student.status || String(student.status) === '0'
}
