import { config } from './config';

// 日志级别枚举
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// 获取当前日志级别
const getCurrentLogLevel = (): LogLevel => {
  const level = config.logLevel.toLowerCase();
  switch (level) {
    case 'debug':
      return LogLevel.DEBUG;
    case 'info':
      return LogLevel.INFO;
    case 'warn':
      return LogLevel.WARN;
    case 'error':
      return LogLevel.ERROR;
    default:
      return LogLevel.INFO;
  }
};

const currentLogLevel = getCurrentLogLevel();

// 格式化时间戳
const getTimestamp = (): string => {
  return new Date().toISOString();
};

// 日志工具类
export class Logger {
  static debug(message: string, ...args: any[]): void {
    if (currentLogLevel <= LogLevel.DEBUG) {
      console.log(`[${getTimestamp()}] [DEBUG]`, message, ...args);
    }
  }

  static info(message: string, ...args: any[]): void {
    if (currentLogLevel <= LogLevel.INFO) {
      console.log(`[${getTimestamp()}] [INFO]`, message, ...args);
    }
  }

  static warn(message: string, ...args: any[]): void {
    if (currentLogLevel <= LogLevel.WARN) {
      console.warn(`[${getTimestamp()}] [WARN]`, message, ...args);
    }
  }

  static error(message: string, ...args: any[]): void {
    if (currentLogLevel <= LogLevel.ERROR) {
      console.error(`[${getTimestamp()}] [ERROR]`, message, ...args);
    }
  }
}
