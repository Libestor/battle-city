import { Logger } from './logger';

/**
 * 游戏初始状态
 */
export interface GameInitialState {
  seed: number; // 随机种子，确保双方生成相同的地图和敌人
  mapId: number; // 地图ID
  hostPosition: { x: number; y: number }; // 房主初始位置
  guestPosition: { x: number; y: number }; // 客人初始位置
  hostTankColor: 'yellow' | 'green'; // 房主坦克颜色
  guestTankColor: 'yellow' | 'green'; // 客人坦克颜色
  timestamp: number; // 游戏开始时间戳
}

/**
 * 游戏状态管理器
 * 负责生成和管理游戏初始状态
 */
export class GameStateManager {
  /**
   * 生成游戏初始状态
   * @param roomId 房间ID
   * @returns 游戏初始状态
   */
  generateInitialState(roomId: string): GameInitialState {
    // 使用房间ID和当前时间生成确定性的随机种子
    const seed = this.generateSeed(roomId);
    
    // 默认使用第1关地图
    const mapId = 1;
    
    // 玩家初始位置（基于原游戏的位置）
    // 玩家1（房主）在左下角，玩家2（客人）在右下角
    const hostPosition = { x: 128, y: 384 }; // 左下角
    const guestPosition = { x: 256, y: 384 }; // 右下角
    
    // 玩家角色分配：玩家1=黄色，玩家2=绿色
    const hostTankColor: 'yellow' | 'green' = 'yellow';
    const guestTankColor: 'yellow' | 'green' = 'green';
    
    const initialState: GameInitialState = {
      seed,
      mapId,
      hostPosition,
      guestPosition,
      hostTankColor,
      guestTankColor,
      timestamp: Date.now(),
    };
    
    Logger.info(`Generated initial state for room ${roomId}:`, initialState);
    
    return initialState;
  }

  /**
   * 生成确定性的随机种子
   * @param roomId 房间ID
   * @returns 随机种子
   */
  private generateSeed(roomId: string): number {
    // 使用房间ID生成确定性的种子
    let hash = 0;
    for (let i = 0; i < roomId.length; i++) {
      const char = roomId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * 验证游戏状态
   * @param state 游戏状态
   * @returns 是否有效
   */
  validateState(state: any): boolean {
    if (!state || typeof state !== 'object') {
      return false;
    }

    // 验证必需字段
    if (typeof state.seed !== 'number' ||
        typeof state.mapId !== 'number' ||
        !state.hostPosition ||
        !state.guestPosition ||
        typeof state.timestamp !== 'number') {
      return false;
    }

    // 验证位置格式
    if (typeof state.hostPosition.x !== 'number' ||
        typeof state.hostPosition.y !== 'number' ||
        typeof state.guestPosition.x !== 'number' ||
        typeof state.guestPosition.y !== 'number') {
      return false;
    }

    return true;
  }
}
