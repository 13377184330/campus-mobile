# campus-mobile — 教师移动打分端

[campus-admin](../campus-admin)（专门学校学员管理系统）的手机端：教师掏出手机就能给学生加减行为积分，不用回办公室开电脑。

PC 管理端是完整版（建档 / 导入导出 / 调班 / 流水管理 / 报表）；移动端只做**校内最常发生的那一件事**——当场打分，并把 PC 上已有的能力以「手机顺手」的方式补齐。

- **后端零改动**：全部复用 campus-admin 现有接口，没有新增/修改任何 Java 代码
- **纯前端**：Vite + Vue3 + Vant4，构建产物是静态文件

## 三个页面

| 页面 | 路由 | 说明 |
| --- | --- | --- |
| 登录 | `#/login` | 沿用若依账号体系，支持图形验证码、记住账号 |
| 班级学生选择 | `#/home` | 概览统计、姓名/学号搜索、班级 chips（带人数）、在校/离校切换；第二个 tab 是**全站动态** |
| 打分面板 | `#/score/:studentId` | 事由 chips 点选自动带分值、分值步进/快捷按钮、变动后预览、备注、**30 秒反向流水撤销**、该生最近流水 |

## 关键设计

### 1. 事由字典走若依字典管理

事由与默认分值存在字典 `stu_score_reason` 里（见 `campus-admin/sql/stu_score_dict.sql`，12 条：6 加分 6 扣分）：

- `dict_label` → 提交为流水的 `reason`（事由）
- `dict_value` → 点选后自动填入的分值（正数加分、负数扣分）

教师端每次打开打分页实时拉取 `/system/dict/data/type/stu_score_reason`，所以管理员在【系统管理 - 字典管理】里增删改词条后，手机上立刻生效，不需要重新发版。

### 2. 撤销 = 反向流水，不是删记录

30 秒内点「撤销」，前端会再提交一笔分值相反的流水（事由 `撤销：原事由`，备注注明），原记录完整保留。

这样做的原因：`stu_score_log` 是审计链，PC 端的流水删除权限只给管理员；教师临时点错，用反向流水对冲既不破坏留痕，也不需要在后端开新接口。

### 3. 积分以服务端为准

提交成功后不长期依赖前端加法：

1. 先用 `current + delta` 给即时反馈（与后端 `changeScore()` 的算法一致）；
2. 随即重新拉该生流水，用最新一条的 `score_after` 校准——这是数据库里真实落库的值；
3. 同时把新积分写回全局学生缓存，返回列表页立刻能看到。

### 4. 权限自适应（没有对应权限也不会白屏）

移动端拿 `/getInfo` 返回的 `permissions` 做界面自适应，并对每个接口做了降级兜底：

| 能力 | 需要的权限点 | 没有权限时的表现 |
| --- | --- | --- |
| 班级/学生列表 | 无（`/stu/class/optionselect`、`/stu/student/allList` 未加注解） | 正常 |
| 首页概览 | 无（`/stu/dashboard/overview` 未加注解） | 正常 |
| 打分 | `stu:student:score` | 顶部提示条 + 提交按钮禁用 |
| 该生积分明细 | `stu:student:query` | 显示「无权限」，其余功能不受影响 |
| 全站动态（完整分页） | `stu:score:list` | 自动退回概览里的最近 8 条动态，并注明来源 |

教师角色只要勾上「学生查询 + 积分增减」就能完整使用；管理员（`*:*:*`）不受限。

## 开发

```bash
npm install
npm run dev     # http://localhost:5180/static/m/ ，/api 代理到本地 9090
```

要求本地 campus-admin 后端已启动（默认 9090），且已导入 `stu_tables.sql`、`stu_score_dict.sql`。

## 构建与部署（后端零改动）

```bash
npm run build
# 产物 dist/ 复制到：
#   campus-admin/ruoyi-admin/src/main/resources/static/static/m/
```

访问地址：

```
http://<内网IP>:9090/static/m/
```

> **为什么是 `/static/m/` 而不是 `/m/`**
> 若依 `SecurityConfig` 只对 `GET /`、`/index.html`、`/*.html`、`/static/**`、`/profile/**` 放行匿名访问，`/m/**` 会被 `anyRequest().authenticated()` 拦下——手机浏览器连首页 HTML 都拿不到。
> 在「不改后端」的前提下，构建产物只能落在被放行的 `/static/**` 下：`classpath:static/` 映射到 URL 根，所以放在 `resources/static/static/m/` 即对应 `/static/m/`。
> 若以后允许改后端，把 `"/m/**"` 加进 `SecurityConfig` 的 permitAll，并把 `vite.config.js` 的 `base` 与 `VITE_BASE` 改成 `/m/` 即可。

路由使用 hash 模式（`#/home`），静态托管下刷新子页面不会 404，不需要任何 rewrite 配置。

## 架构

```
教师手机（校园 WiFi / H5）
        │  http://<内网IP>:9090/static/m/
        ▼
ruoyi-admin（9090，同源，免 CORS）
   ├── /static/m/**                        → 本项目构建产物（静态）
   ├── /login /getInfo /captchaImage       → 若依认证与权限
   ├── /system/dict/data/type/stu_score_reason → 事由字典
   └── /stu/**                             → 学员管理接口（复用，零改动）
```

## 文件清单

```
campus-mobile/
├── index.html              入口 HTML（移动端 viewport / 刘海屏适配）
├── package.json
├── vite.config.js          base = /static/m/，dev 代理 /api → 9090
├── .gitignore
├── README.md
└── src/
    ├── main.js             Vue + Vant 全量注册
    ├── App.vue
    ├── router.js           hash 路由 + 登录守卫
    ├── store.js            全局学生/班级缓存（打完分回列表即时生效）
    ├── style.css           移动端基础样式、卡片、chips、流水行
    ├── api/
    │   ├── request.js      axios 封装：Bearer、嵌套 params 序列化、401/403 分级
    │   └── index.js        全部接口定义（与若依后端一一对应）
    ├── utils/
    │   ├── auth.js         令牌 / 身份 / 权限集合
    │   └── format.js       积分等级、带符号分值、相对时间
    └── views/
        ├── Login.vue       登录
        ├── Home.vue        班级学生选择 + 全站动态
        └── Score.vue       打分面板 + 30 秒撤销
```

无需公网、无需备案、无需小程序审核——打分发生在校内，局域网直连即达。
