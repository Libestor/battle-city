# Battle City WebSocket Server

WebSocket服务器，用于坦克大战联机对战功能。

## 安装依赖

```bash
npm install
# 或
yarn install
```

## 开发模式

```bash
npm run dev
# 或
yarn dev
```

## 构建

```bash
npm run build
# 或
yarn build
```

## 生产环境运行

```bash
npm start
# 或
yarn start
```

## 环境变量

创建`.env`文件配置以下变量：

```
PORT=3001
CORS_ORIGIN=http://localhost:8080
LOG_LEVEL=info
```

## API端点

- `GET /health` - 健康检查

## Socket.IO事件

详见`src/types.ts`中的`SocketEvent`枚举。
