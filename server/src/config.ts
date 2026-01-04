type CorsOriginCallback = (err: Error | null, allow?: boolean) => void;

const explicitOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const localOriginPattern = /^http:\/\/(localhost|127\.0\.0\.1|\d{1,3}(?:\.\d{1,3}){3}):8080$/;

function resolveCorsOrigin(origin: string | undefined | null, callback: CorsOriginCallback) {
  if (!origin) {
    callback(null, true);
    return;
  }

  if (explicitOrigins.length > 0) {
    if (explicitOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS not allowed: ${origin}`));
    return;
  }

  if (localOriginPattern.test(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error(`CORS not allowed: ${origin}`));
}

// 环境变量配置
export const config = {
  // 服务器端口
  port: process.env.PORT || 3001,
  
  // CORS配置
  cors: {
    origin: resolveCorsOrigin,
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
