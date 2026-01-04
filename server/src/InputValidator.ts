import { PlayerInput } from './types';
import { Logger } from './logger';
import { config } from './config';

/**
 * 输入验证器
 * 负责验证玩家输入的合法性和速率限制
 */
export class InputValidator {
  // 存储每个socket的输入速率 socketId -> timestamps[]
  private inputRates: Map<string, number[]> = new Map();

  /**
   * 验证玩家输入是否合法
   * @param input 玩家输入
   * @returns 是否合法
   */
  validateInput(input: PlayerInput): boolean {
    // 验证输入类型（新格式使用 'state' 类型）
    if (input.type !== 'state') {
      Logger.warn(`Invalid input type: ${input.type}`);
      return false;
    }

    // 验证方向
    if (input.direction && !['up', 'down', 'left', 'right'].includes(input.direction)) {
      Logger.warn(`Invalid direction: ${input.direction}`);
      return false;
    }

    // 验证布尔字段
    if (typeof input.moving !== 'boolean' || typeof input.firing !== 'boolean') {
      Logger.warn('Invalid moving/firing fields');
      return false;
    }

    // 验证时间戳
    if (!input.timestamp || typeof input.timestamp !== 'number') {
      Logger.warn('Invalid timestamp');
      return false;
    }

    // 验证时间戳不能是未来时间（允许一定误差）
    const now = Date.now();
    if (input.timestamp > now + 1000) {
      Logger.warn(`Future timestamp: ${input.timestamp}, now: ${now}`);
      return false;
    }

    return true;
  }

  /**
   * 检查速率限制
   * @param socketId socket ID
   * @returns 是否通过速率限制
   */
  checkRateLimit(socketId: string): boolean {
    const now = Date.now();
    const timestamps = this.inputRates.get(socketId) || [];

    // 移除1秒前的时间戳
    const recentTimestamps = timestamps.filter(t => now - t < 1000);

    // 检查是否超过速率限制
    if (recentTimestamps.length >= config.rateLimit.maxInputsPerSecond) {
      Logger.warn(`Rate limit exceeded for socket: ${socketId}`);
      return false;
    }

    // 添加当前时间戳
    recentTimestamps.push(now);
    this.inputRates.set(socketId, recentTimestamps);

    return true;
  }

  /**
   * 清理socket的速率记录
   * @param socketId socket ID
   */
  clearRateLimit(socketId: string): void {
    this.inputRates.delete(socketId);
  }

  /**
   * 定期清理过期的速率记录
   */
  startCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [socketId, timestamps] of this.inputRates.entries()) {
        const recentTimestamps = timestamps.filter(t => now - t < 1000);
        if (recentTimestamps.length === 0) {
          this.inputRates.delete(socketId);
        } else {
          this.inputRates.set(socketId, recentTimestamps);
        }
      }
    }, 5000); // 每5秒清理一次
  }
}
