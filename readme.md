# 🎮 坦克大战复刻版（Battle City Remake）

<div align="center">

[![Version](https://img.shields.io/badge/version-0.4.0--SNAPSHOT-blue.svg)](https://github.com/shinima/battle-city)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3.1-blue.svg)](https://reactjs.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

[在线游戏](https://shinima.github.io/battle-city) | [知乎介绍](https://zhuanlan.zhihu.com/p/35551654) | [提交问题](https://github.com/shinima/battle-city/issues/new)

</div>

## 📖 项目简介

这是一个使用现代 Web 技术栈完整复刻的经典红白机游戏《坦克大战》（Battle City）。项目基于原版游戏素材，使用 React 技术栈从零打造，不仅还原了经典玩法，还增加了关卡编辑器、双人模式和联机对战等创新功能。

### ✨ 核心特点

- 🎨 **像素风格渲染**：使用 SVG 技术渲染游戏元素，完美呈现复古像素风格
- 🎯 **高保真还原**：严格按照原版游戏逻辑实现，包括坦克移动、碰撞检测、道具系统等
- 🎮 **多种游戏模式**：单人模式、双人模式、联机对战模式
- 🛠️ **关卡编辑器**：可视化关卡编辑，支持自定义关卡的创建和管理
- 🤖 **智能 AI**：内置多种难度的电脑对手，提供不同挑战
- 🔊 **完整音效**：还原原版游戏的各种音效

### 🎯 最佳体验

- **推荐分辨率**：1080P 屏幕
- **推荐缩放比例**：200%
- **支持浏览器**：Chrome、Firefox、Edge、Safari 等现代浏览器

如果在游戏过程中发现任何问题，欢迎提交 [Issue](https://github.com/shinima/battle-city/issues/new)！


## 🛠️ 技术栈

### 前端技术

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.3.1 | UI 组件库，负责游戏界面渲染 |
| TypeScript | 5.7.2 | 类型安全的开发语言 |
| Redux | 5.0.1 | 全局状态管理 |
| Redux-Saga | 1.3.0 | 处理复杂的游戏逻辑和副作用 |
| Immutable.js | 4.3.7 | 不可变数据结构，提升性能 |
| React Router | 6.28.0 | 路由管理 |
| Socket.IO Client | 4.6.1 | WebSocket 客户端，用于联机对战 |

### 后端技术

| 技术 | 用途 |
|------|------|
| Node.js | 服务器运行环境 |
| Express | Web 框架 |
| Socket.IO | WebSocket 服务端，实现实时通信 |
| TypeScript | 类型安全开发 |

### 构建工具

- **Webpack 5**：模块打包工具
- **webpack-dev-server**：开发服务器，支持热更新
- **ts-loader**：TypeScript 编译器
- **Prettier**：代码格式化

## 🚀 快速开始

### 环境要求

- **Node.js**: >= 14.0.0
- **npm** 或 **yarn**: 包管理工具

### 安装依赖

```bash
# 克隆项目
git clone https://github.com/shinima/battle-city.git
cd battle-city

# 安装前端依赖
npm install
# 或使用 yarn
yarn install
```

### 本地开发

#### 单机模式（单人/双人）

```bash
# 启动开发服务器
npm start
# 或使用 yarn
yarn start
```

然后在浏览器中访问 `http://localhost:8080`

#### 联机对战模式

**方式一：一键启动（推荐）**

```bash
# Linux/Mac 用户
./start-multiplayer.sh

# Windows 用户需手动启动（见下方）
```

**方式二：手动启动**

```bash
# 1. 启动后端服务器（终端1）
cd server
npm install
npm run dev

# 2. 启动前端服务（终端2）
cd ..
npm start
```

服务启动后：
- 前端地址：`http://localhost:8080`
- 后端地址：`http://localhost:3001`

### 生产构建

```bash
# 构建生产版本
npm run build
# 或使用 yarn
yarn build
```

构建输出在 `dist/` 目录下，可部署到任何静态服务器。

## 🎮 游戏功能

### 游戏模式

#### 1. 单人模式
- 35 个经典关卡（stage-1 至 stage-35）
- 与电脑 AI 对战
- 保护基地（老鹰）不被摧毁
- 消灭所有敌方坦克即可过关

#### 2. 双人合作模式
- 支持本地双人同时游戏
- 玩家一：方向键移动，空格键开火
- 玩家二：WASD 移动，J 键开火
- 共同保护基地，消灭敌军

#### 3. 联机对战模式 ✨ 新功能
- 基于 WebSocket 的实时联机对战
- 房间系统：创建或加入 6 位数房间号
- 低延迟输入同步（目标延迟 20-50ms）
- 断线重连机制（30 秒超时保护）
- 连接状态实时监控

### 游戏元素

#### 坦克类型

| 类型 | 特点 | 速度 | 生命值 |
|------|------|------|--------|
| 基础坦克 | 普通敌方坦克 | 慢 | 1 |
| 快速坦克 | 移动速度快 | 快 | 1 |
| 强力坦克 | 生命值高 | 中 | 2-4 |
| 装甲坦克 | 装甲防护 | 慢 | 4 |
| 玩家坦克 | 可升级 | 中 | 1 |

#### 道具系统

| 道具 | 效果 | 持续时间 |
|------|------|----------|
| 🪖 钢盔 | 短时间无敌 | 10 秒 |
| ⭐ 五角星 | 坦克升级 | 永久 |
| 💣 炸弹 | 消灭屏幕上所有敌军 | 立即 |
| ⏱️ 时钟 | 冻结所有敌军 | 10 秒 |
| 🧱 铁锹 | 基地周围变钢墙 | 20 秒 |
| 🔫 强化火力 | 子弹威力增强 | 永久（本局） |

#### 地形元素

- **砖墙（Brick）**：可被子弹摧毁
- **钢墙（Steel）**：只能被强化子弹摧毁
- **河流（River）**：坦克无法通过
- **树林（Forest）**：可遮挡视线，坦克和子弹可通过
- **冰面（Snow）**：降低移动速度

### 关卡编辑器

支持可视化关卡编辑，让你可以创建自己的挑战关卡！

#### 功能特性

- 🎨 拖拽式地形编辑
- 🎯 敌方坦克数量和类型配置
- 💾 关卡保存和加载
- 📋 关卡列表管理
- 🔄 导入/导出关卡数据（JSON 格式）
- 👁️ 实时预览

#### 使用方法

1. 在主菜单选择"编辑器"
2. 使用工具栏选择地形类型
3. 在网格上点击放置/清除元素
4. 配置敌方坦克出现位置和数量
5. 保存关卡并在游戏中测试

### 展览页面（Gallery）

浏览游戏中的所有元素：

- 🎨 **Sprites**：查看所有游戏精灵图
- 🎵 **Sounds**：试听游戏音效
- 📊 **Stats**：游戏统计数据

## 📁 项目结构

```
battle-city/
├── app/                      # 前端源代码
│   ├── components/           # React 组件
│   │   ├── GameScene.tsx    # 游戏主场景
│   │   ├── GameTitleScene.tsx # 标题场景
│   │   ├── tanks.tsx        # 坦克组件
│   │   ├── Bullet.tsx       # 子弹组件
│   │   ├── Editor.tsx       # 关卡编辑器
│   │   └── ...
│   ├── reducers/            # Redux reducers
│   │   ├── game.ts          # 游戏状态
│   │   ├── tanks.ts         # 坦克状态
│   │   ├── bullets.ts       # 子弹状态
│   │   └── ...
│   ├── sagas/               # Redux-Saga 逻辑
│   │   ├── gameSaga.ts      # 游戏主逻辑
│   │   ├── playerSaga.ts    # 玩家控制
│   │   ├── BotSaga.ts       # AI 逻辑
│   │   └── ...
│   ├── ai/                  # AI 算法
│   │   ├── Bot.ts           # AI 主类
│   │   ├── shortest-path.ts # 寻路算法
│   │   └── ...
│   ├── stages/              # 关卡数据
│   │   ├── stage-1.json
│   │   └── ...
│   ├── types/               # TypeScript 类型定义
│   ├── utils/               # 工具函数
│   └── App.tsx              # 应用入口
├── server/                  # 后端服务器（联机对战）
│   ├── src/
│   │   ├── index.ts         # 服务器入口
│   │   ├── game/            # 游戏逻辑
│   │   └── websocket/       # WebSocket 处理
│   └── package.json
├── docs/                    # 文档
│   ├── AI-design.md         # AI 设计文档
│   ├── journal.md           # 开发日志
│   └── other.md             # 其他文档
├── resources/               # 游戏资源
├── sound/                   # 音效文件
├── build/                   # 构建输出
├── webpack.config.js        # Webpack 配置
├── tsconfig.json           # TypeScript 配置
├── package.json            # 依赖管理
└── README.md               # 本文件
```

## 🎯 开发进度

### ✅ Milestone 0.2（已完成 2018-04-16）

- [x] 游戏的基本框架
- [x] 单人模式
- [x] 展览页面
- [x] 关卡编辑器与自定义关卡管理

### ✅ Milestone 0.3（已完成 2018-11-03）

- [x] 性能优化
- [x] 完整的游戏音效
- [x] 双人本地对战模式

### ✅ Milestone 0.4（进行中）

- [x] 基于 WebSocket 的联机对战功能 ✨
- [x] 房间系统和匹配机制
- [x] 断线重连支持
- [ ] AI 智能优化
- [ ] 完整的开发文档

### 🔮 Milestone 1.0（规划中）

- [ ] 更智能的 AI 对手系统
- [ ] 完整的技术文档和 API 文档
- [ ] 游戏回放功能
- [ ] 排行榜系统
- [ ] 成就系统


## 🌐 联机对战详细说明

### 快速开始

#### 一键启动脚本（Linux/Mac）

```bash
./start-multiplayer.sh
```

#### Windows 手动启动

```powershell
# 终端 1 - 启动后端
cd server
npm install
npm run dev

# 终端 2 - 启动前端
cd ..
npm start
```

### 功能特性

#### 房间系统
- ✅ 创建房间：自动生成 6 位数房间号
- ✅ 加入房间：输入房间号即可加入
- ✅ 房间状态：显示房间内玩家数量
- ✅ 自动清理：空房间自动关闭

#### 实时同步
- ✅ 输入同步：玩家操作实时传输（目标延迟 20-50ms）
- ✅ 状态同步：游戏状态在所有客户端保持一致
- ✅ 事件同步：坦克移动、开火、碰撞等事件实时同步

#### 连接管理
- ✅ 断线重连：30 秒内断线可自动重连
- ✅ 超时处理：超时自动踢出并清理资源
- ✅ 状态监控：实时显示连接状态（连接中/已连接/断开/重连中）
- ✅ 心跳检测：保持连接活跃，及时发现断线

### 技术实现

#### 前端（Client）

**技术栈**
- Socket.IO Client：WebSocket 通信
- Redux：状态管理
- Redux-Saga：处理异步逻辑

**关键实现**
```typescript
// 连接建立
socket.connect()

// 发送事件
socket.emit('join-room', { roomId: '123456' })

// 接收事件
socket.on('player-joined', (data) => { ... })
```

**核心功能模块**
- `MultiplayerLobby.tsx`：房间大厅界面
- `multiplayerLobbySaga.ts`：房间逻辑处理
- `multiplayerGameSaga.ts`：游戏同步逻辑

#### 后端（Server）

**技术栈**
- Node.js + Express：HTTP 服务器
- Socket.IO：WebSocket 服务端
- TypeScript：类型安全

**关键特性**
- 房间管理：创建、加入、离开、关闭
- 事件广播：将玩家操作广播到房间内所有玩家
- 状态维护：维护房间状态和玩家列表
- 错误处理：处理各种异常情况

**API 端点**
```
GET  /health         # 健康检查
POST /api/rooms      # 创建房间（预留）
GET  /api/rooms/:id  # 获取房间信息（预留）
```

**WebSocket 事件**

| 事件名 | 方向 | 说明 |
|--------|------|------|
| `create-room` | C→S | 创建房间 |
| `room-created` | S→C | 房间创建成功 |
| `join-room` | C→S | 加入房间 |
| `room-joined` | S→C | 加入成功 |
| `player-joined` | S→C | 其他玩家加入 |
| `player-left` | S→C | 玩家离开 |
| `game-input` | C→S | 游戏输入 |
| `game-state-sync` | S→C | 状态同步 |
| `disconnect` | C↔S | 断开连接 |

### 环境配置

#### 后端环境变量

在 `server/.env` 文件中配置：

```env
# 服务器端口
PORT=3001

# CORS 允许的源
CORS_ORIGIN=http://localhost:8080

# 日志级别
LOG_LEVEL=info

# 房间超时时间（秒）
ROOM_TIMEOUT=1800

# 玩家超时时间（秒）
PLAYER_TIMEOUT=30
```

#### 前端配置

在 `devConfig.js` 中配置：

```javascript
module.exports = {
  // WebSocket 服务器地址
  WS_SERVER_URL: 'http://localhost:3001',
  
  // 其他开发配置...
}
```

### 部署指南

#### 前端部署

```bash
# 构建生产版本
npm run build

# 部署 dist/ 目录到静态服务器
# 例如：Nginx, Apache, GitHub Pages, Vercel 等
```

#### 后端部署

```bash
# 进入服务器目录
cd server

# 安装依赖
npm install

# 构建
npm run build

# 启动生产服务
npm start
```

**推荐部署平台**
- 前端：Vercel、Netlify、GitHub Pages
- 后端：Heroku、Railway、AWS、阿里云

### 常见问题

**Q1: 无法连接到服务器？**
- 检查后端服务是否启动（`http://localhost:3001/health`）
- 检查防火墙设置
- 确认 WebSocket URL 配置正确

**Q2: 游戏延迟很高？**
- 检查网络连接
- 尝试使用更近的服务器部署节点
- 查看浏览器控制台是否有错误

**Q3: 断线重连失败？**
- 超过 30 秒断线会被踢出房间
- 确认网络连接恢复
- 尝试刷新页面重新加入

## ⚙️ 开发配置


## ⚙️ 开发配置

### devConfig.js

开发配置文件，用于自定义开发环境的各种参数：

```javascript
module.exports = {
  // 是否隐藏关于页面
  HIDE_ABOUT: false,
  
  // 是否启用调试器
  INSPECTOR: false,
  
  // WebSocket 服务器地址（联机对战）
  WS_SERVER_URL: 'http://localhost:3001',
  
  // 开发模式下的其他配置...
}
```

**注意**：修改此文件后需要重启 webpack-dev-server。

### 键盘控制

#### 玩家一（单人/双人模式）
- **移动**：方向键（↑ ↓ ← →）
- **开火**：空格键（Space）

#### 玩家二（双人模式）
- **移动**：W A S D 键
- **开火**：J 键

#### 通用控制
- **暂停**：P 键
- **重新开始**：R 键（游戏结束后）
- **ESC**：返回主菜单

## 🤖 AI 系统

游戏内置了多种 AI 策略，让电脑对手更具挑战性。

### AI 架构

```
AIWorkerSaga (AI 主控制器)
    ↓
BotSaga (单个 Bot 逻辑)
    ↓
├── Wander Mode (游走模式)
│   ├── 随机目标点选择
│   ├── 最短路径算法
│   └── 路径跟随
│
└── Dodge Mode (躲避模式)
    ├── 危险检测
    ├── 碰撞检测
    └── 应对策略
```

### 核心算法

#### 1. 寻路算法（shortest-path.ts）
- 基于 A* 算法的最短路径搜索
- 考虑地形因素（可通过性）
- 动态避障

#### 2. 游走模式（Wander Mode）
```
1. 随机选择目标点
2. 计算最短路径
3. 沿路径移动
4. 到达后重新选择目标
```

移动和开火是独立的流程：
- **移动**：使用最短路径算法导航
- **开火**：定期判断前方是否有目标

#### 3. 躲避模式（Dodge Mode）
```
1. 危险检测（检测玩家子弹）
2. 如果有危险，尝试：
   a. 继续前进（如果能躲避）
   b. 发射子弹抵挡
   c. 移动到安全点
```

#### 4. 开火决策（fire-utils.ts）
- 检测前方是否有玩家坦克
- 检测前方是否有基地（鹰）
- 靠近砖墙时增加开火概率
- 可击中目标时大幅提升开火概率

### AI 相关文件

- `app/ai/Bot.ts`：Bot 主类
- `app/ai/AIWorkerSaga.ts`：AI 主控制逻辑
- `app/sagas/BotSaga.ts`：单个 Bot 的 Saga
- `app/ai/shortest-path.ts`：寻路算法
- `app/ai/dodge-utils.ts`：躲避工具
- `app/ai/fire-utils.ts`：开火决策

更多详细信息请查看 [AI 设计文档](docs/AI-design.md)。

## 🎨 游戏设计

### 坐标系统

- 坦克位置：使用左上角坐标表示，尺寸 16×16 像素
- 子弹位置：使用左上角坐标表示，尺寸 3×3 像素
- 游戏地图：26×26 网格，每格 8×8 像素

### 道具生成规则

1. 当击中**第一个**带道具标记的坦克时，随机掉落一个道具
2. 道具掉落位置需满足特定碰撞条件
3. 当新的带道具坦克开始生成时，地图上所有道具消失
4. 每关第 4、11、18 辆坦克携带道具
5. 不同类型道具掉落概率相同

### URL 路由设计

| 路径 | 场景 | 说明 |
|------|------|------|
| `/` | 主页面 | 游戏标题界面 |
| `/choose/:stageName` | 选择关卡 | 选择要开始的关卡 |
| `/stage/:stageName` | 游戏进行中 | 游戏主界面或统计界面 |
| `/gameover` | 游戏结束 | 显示最终得分 |
| `/editor/:view?` | 关卡编辑器 | 编辑自定义关卡 |
| `/gallery/:tab?` | 展览页面 | 查看游戏元素 |
| `/list/*` | 关卡列表 | 浏览所有关卡 |
| `/multiplayer` | 联机大厅 | 联机对战房间 |

## 🧪 测试

```bash
# 运行测试（如果有）
npm test

# 运行服务器测试
cd server
npm test
```

## 📝 代码风格

项目使用 Prettier 进行代码格式化：

```bash
# 格式化代码
npx prettier --write "app/**/*.{ts,tsx}"
```

**Prettier 配置**（package.json）：
```json
{
  "printWidth": 100,
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all"
}
```

## 🤝 贡献指南

欢迎贡献！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支（`git checkout -b feature/AmazingFeature`）
3. 提交更改（`git commit -m 'Add some AmazingFeature'`）
4. 推送到分支（`git push origin feature/AmazingFeature`）
5. 开启 Pull Request

### 贡献方向

- 🐛 Bug 修复
- ✨ 新功能开发
- 📝 文档改进
- 🎨 UI/UX 改进
- 🤖 AI 算法优化
- 🌐 多语言支持
- 📱 移动端适配

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 👨‍💻 作者

**Shi Feichao**
- Email: 842351815@qq.com
- GitHub: [@shinima](https://github.com/shinima)
- 个人主页: https://shinima.github.io

## 🙏 致谢

- 原版《坦克大战》游戏素材
- React 及其生态系统的开发者们
- 所有贡献者和 Issue 提交者

## 📚 相关资源

- [在线游戏地址](https://shinima.github.io/battle-city)
- [知乎专栏文章](https://zhuanlan.zhihu.com/p/35551654)
- [GitHub Issues](https://github.com/shinima/battle-city/issues)
- [GitHub Discussions](https://github.com/shinima/battle-city/discussions)

## 📊 项目统计

- **关卡数量**：35 个经典关卡 + 无限自定义
- **游戏模式**：3 种（单人、双人、联机）
- **代码语言**：TypeScript
- **代码行数**：~15,000 行
- **开发周期**：2017-至今

## 🔮 未来计划

- [ ] 移动端支持（触控操作）
- [ ] 游戏回放系统
- [ ] 更多游戏模式（生存模式、竞速模式）
- [ ] 全局排行榜
- [ ] 成就系统
- [ ] 皮肤系统
- [ ] 关卡分享社区

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给一个 Star！⭐**

Made with ❤️ by [Shinima](https://github.com/shinima)

</div>
