// 环境变量配置
export const config = {
  // 服务器端口
  port: process.env.PORT || 3001,
  
  // CORS配置
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
    credentials: true,
  },
  
  // 日志级别: 'debug' | 'info' | 'warn' | 'error'
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // 房间配置
  room: {
    // 房间ID长度
    idLength: 6,
    // 房间最大玩家数
    maxPlayers: 2,
    // 房间超时时间（毫秒）
    timeout: 30 * 60 * 1000, // 30分钟
    // 断线重连超时（毫秒）
    reconnectTimeout: 30 * 1000, // 30秒
  },
  
  // 速率限制配置
  rateLimit: {
    // 每秒最大输入数
    maxInputsPerSecond: 60,
  },
};
