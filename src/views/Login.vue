<template>
  <div class="page login-page">
    <div class="brand">
      <div class="badge">积</div>
      <div class="logo">学员积分</div>
      <div class="sub">教师移动打分端</div>
    </div>

    <div class="card login-card">
      <van-field
        v-model="form.username"
        label="账号"
        placeholder="请输入教师账号"
        clearable
        autocomplete="username"
        @keyup.enter="doLogin"
      />
      <van-field
        v-model="form.password"
        type="password"
        label="密码"
        placeholder="请输入密码"
        clearable
        autocomplete="current-password"
        @keyup.enter="doLogin"
      />
      <van-field
        v-if="captchaEnabled"
        v-model="form.code"
        label="验证码"
        placeholder="请输入验证码"
        center
        clearable
        maxlength="6"
        @keyup.enter="doLogin"
      >
        <template #button>
          <div class="captcha-box" @click="loadCaptcha">
            <img v-if="captchaImg" :src="captchaImg" class="captcha" alt="验证码" />
            <van-loading v-else size="16" />
          </div>
        </template>
      </van-field>

      <div class="row">
        <van-checkbox v-model="remember" icon-size="16px" shape="square">记住账号</van-checkbox>
        <span class="row-tip">与 PC 管理端同一套账号</span>
      </div>

      <div class="btn-wrap">
        <van-button
          round
          block
          type="primary"
          :loading="loading"
          loading-text="登录中..."
          @click="doLogin"
        >
          登 录
        </van-button>
      </div>

      <div class="tip">
        移动端仅做「打分」一件事，账号需具备
        <b>积分增减（stu:student:score）</b> 权限；<br />
        未开通时可正常登录，但无法提交打分。
      </div>
    </div>

    <div class="foot">校园局域网内使用 · 无需公网</div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showFailToast } from 'vant'
import { login, getCaptcha, getInfo } from '../api'
import {
  getToken,
  setToken,
  setUser,
  setPermissions,
  getRememberedUser,
  setRememberedUser
} from '../utils/auth'

const router = useRouter()

const form = reactive({ username: '', password: '', code: '' })
const remember = ref(true)
const loading = ref(false)
const checking = ref(false)
const captchaEnabled = ref(false)
const captchaImg = ref('')
const captchaUuid = ref('')

/** 拉取图形验证码；接口异常时按「无验证码」降级，登录失败再提示 */
async function loadCaptcha() {
  captchaImg.value = ''
  try {
    const res = await getCaptcha()
    captchaEnabled.value = res.captchaEnabled !== false
    if (captchaEnabled.value && res.img) {
      captchaImg.value = 'data:image/gif;base64,' + res.img
      captchaUuid.value = res.uuid || ''
      form.code = ''
    }
  } catch (e) {
    captchaEnabled.value = false
  }
}

/** 保存身份并进入首页；权限集合用于「有没有打分 / 看流水」的界面自适应 */
function persistIdentity(info) {
  const user = (info && info.user) || {}
  setUser({ userName: user.userName, nickName: user.nickName || user.userName })
  setPermissions((info && info.permissions) || [])
}

async function doLogin() {
  if (loading.value || checking.value) return
  if (!form.username.trim()) {
    showToast('请输入账号')
    return
  }
  if (!form.password) {
    showToast('请输入密码')
    return
  }
  if (captchaEnabled.value && !form.code.trim()) {
    showToast('请输入验证码')
    return
  }

  loading.value = true
  try {
    const res = await login({
      username: form.username.trim(),
      password: form.password,
      code: captchaEnabled.value ? form.code.trim() : undefined,
      uuid: captchaEnabled.value ? captchaUuid.value : undefined
    })
    if (!res.token) {
      showFailToast(res.msg || '登录失败')
      if (captchaEnabled.value) loadCaptcha()
      return
    }
    setToken(res.token)
    setRememberedUser(remember.value ? form.username.trim() : '')
    try {
      persistIdentity(await getInfo())
    } catch (e) {
      // 身份信息拿不到不阻塞登录，进入首页后各接口会再校验一次
    }
    router.replace('/home')
  } catch (e) {
    showFailToast(e.message || '登录失败')
    if (captchaEnabled.value) loadCaptcha()
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  form.username = getRememberedUser()

  // 已有令牌：先确认它还有效，避免拿着过期 token 进首页后满屏 401
  if (getToken()) {
    checking.value = true
    try {
      persistIdentity(await getInfo())
      router.replace('/home')
      return
    } catch (e) {
      // 无效令牌已被 request 拦截器清理，继续走登录流程
    } finally {
      checking.value = false
    }
  }

  loadCaptcha()
})
</script>

<style scoped>
.login-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: linear-gradient(180deg, #eaf3ff 0%, var(--bg) 42%);
}

.brand {
  padding: 56px 0 26px;
  text-align: center;
}

.badge {
  width: 52px;
  height: 52px;
  margin: 0 auto 12px;
  border-radius: 16px;
  background: linear-gradient(135deg, #4aa8ff, #1989fa);
  color: #fff;
  font-size: 24px;
  font-weight: 700;
  line-height: 52px;
  box-shadow: 0 6px 16px rgba(25, 137, 250, 0.28);
}

.logo {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #1a1a1a;
}

.sub {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-3);
}

.login-card {
  padding: 8px 16px 20px;
}

.captcha-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 34px;
}

.captcha {
  width: 96px;
  height: 34px;
  border-radius: 4px;
  display: block;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 4px 4px;
  font-size: 13px;
}

.row-tip {
  color: var(--text-3);
  font-size: 12px;
}

.btn-wrap {
  margin-top: 14px;
}

.tip {
  margin-top: 16px;
  text-align: center;
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-3);
}

.tip b {
  color: var(--text-2);
  font-weight: 600;
}

.foot {
  margin-top: auto;
  padding: 20px 0 26px;
  text-align: center;
  font-size: 11px;
  color: #c8c9cc;
}
</style>
