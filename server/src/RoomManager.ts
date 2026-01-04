import { v4 as uuidv4 } from 'uuid';
import { Room, Player, PlayerRole, RoomStatus, ErrorType, ErrorResponse } from './types';
import { config } from './config';
import { Logger } from './logger';

/**
 * 房间管理器
 * 负责管理所有游戏房间的生命周期
 */
export class RoomManager {
  // 存储所有房间 roomId -> Room
  private rooms: Map<string, Room> = new Map();
  
  // 存储socket到房间的映射 socketId -> roomId
  private socketToRoom: Map<string, string> = new Map();
  
  // 存储session到房间和角色的映射 sessionId -> {roomId, role}
  private sessionToRoom: Map<string, { roomId: string; role: PlayerRole }> = new Map();

  /**
   * 生成唯一的房间ID（6位数字）
   */
  private generateRoomId(): string {
    let roomId: string;
    do {
      // 生成6位随机数字
      roomId = Math.floor(100000 + Math.random() * 900000).toString();
    } while (this.rooms.has(roomId));
    return roomId;
  }

  /**
   * 创建新房间
   * @param hostSocketId 房主的socket ID
   * @returns 房间ID和session ID
   */
  createRoom(hostSocketId: string): { roomId: string; sessionId: string } {
    const roomId = this.generateRoomId();
    const sessionId = uuidv4();

    const hostPlayer: Player = {
      socketId: hostSocketId,
      sessionId,
      role: 'host',
      status: 'connected',
      joinedAt: Date.now(),
    };

    const room: Room = {
      id: roomId,
      status: 'waiting',
      players: new Map([['host', hostPlayer]]),
      createdAt: Date.now(),
    };

    this.rooms.set(roomId, room);
    this.socketToRoom.set(hostSocketId, roomId);
    this.sessionToRoom.set(sessionId, { roomId, role: 'host' });

    Logger.info(`Room created: ${roomId} by socket ${hostSocketId}`);

    // 设置房间超时清理
    this.scheduleRoomCleanup(roomId);

    return { roomId, sessionId };
  }

  /**
   * 加入房间
   * @param roomId 房间ID
   * @param guestSocketId 客人的socket ID
   * @returns session ID或错误
   */
  joinRoom(roomId: string, guestSocketId: string): { sessionId: string } | ErrorResponse {
    const room = this.rooms.get(roomId);

    // 检查房间是否存在
    if (!room) {
      return {
        type: ErrorType.ROOM_NOT_FOUND,
        message: '房间不存在',
      };
    }

    // 检查房间是否已满
    if (room.players.size >= config.room.maxPlayers) {
      return {
        type: ErrorType.ROOM_FULL,
        message: '房间已满',
      };
    }

    const sessionId = uuidv4();

    const guestPlayer: Player = {
      socketId: guestSocketId,
      sessionId,
      role: 'guest',
      status: 'connected',
      joinedAt: Date.now(),
    };

    room.players.set('guest', guestPlayer);
    this.socketToRoom.set(guestSocketId, roomId);
    this.sessionToRoom.set(sessionId, { roomId, role: 'guest' });

    Logger.info(`Player joined room: ${roomId}, socket: ${guestSocketId}`);

    return { sessionId };
  }

  /**
   * 离开房间
   * @param socketId socket ID
   */
  leaveRoom(socketId: string): void {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) {
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    // 找到离开的玩家
    let leavingRole: PlayerRole | null = null;
    for (const [role, player] of room.players.entries()) {
      if (player.socketId === socketId) {
        leavingRole = role;
        break;
      }
    }

    if (!leavingRole) {
      return;
    }

    Logger.info(`Player left room: ${roomId}, socket: ${socketId}, role: ${leavingRole}`);

    // 如果是房主离开，解散房间
    if (leavingRole === 'host') {
      this.closeRoom(roomId);
    } else {
      // 客人离开，只移除该玩家
      const player = room.players.get(leavingRole);
      if (player) {
        this.sessionToRoom.delete(player.sessionId);
      }
      room.players.delete(leavingRole);
      this.socketToRoom.delete(socketId);
      room.status = 'waiting';
    }
  }

  /**
   * 关闭房间
   * @param roomId 房间ID
   */
  closeRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    Logger.info(`Closing room: ${roomId}`);

    // 清理所有玩家的映射
    for (const player of room.players.values()) {
      this.socketToRoom.delete(player.socketId);
      this.sessionToRoom.delete(player.sessionId);
    }

    this.rooms.delete(roomId);
  }

  /**
   * 获取房间信息
   * @param roomId 房间ID
   */
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * 通过socket ID获取房间ID
   * @param socketId socket ID
   */
  getRoomIdBySocket(socketId: string): string | undefined {
    return this.socketToRoom.get(socketId);
  }

  /**
   * 获取房间内的对手
   * @param roomId 房间ID
   * @param role 当前玩家角色
   */
  getOpponent(roomId: string, role: PlayerRole): Player | undefined {
    const room = this.rooms.get(roomId);
    if (!room) {
      return undefined;
    }

    const opponentRole: PlayerRole = role === 'host' ? 'guest' : 'host';
    return room.players.get(opponentRole);
  }

  /**
   * 更新玩家连接状态
   * @param socketId socket ID
   * @param status 连接状态
   */
  updatePlayerStatus(socketId: string, status: 'connected' | 'disconnected'): void {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) {
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    for (const player of room.players.values()) {
      if (player.socketId === socketId) {
        player.status = status;
        Logger.info(`Player status updated: ${socketId}, status: ${status}`);
        break;
      }
    }
  }

  /**
   * 通过session ID重连
   * @param sessionId session ID
   * @param newSocketId 新的socket ID
   */
  reconnect(sessionId: string, newSocketId: string): { roomId: string; role: PlayerRole } | ErrorResponse {
    const roomInfo = this.sessionToRoom.get(sessionId);
    if (!roomInfo) {
      return {
        type: ErrorType.UNAUTHORIZED,
        message: '无效的会话ID',
      };
    }

    const { roomId, role } = roomInfo;
    const room = this.rooms.get(roomId);
    if (!room) {
      return {
        type: ErrorType.ROOM_NOT_FOUND,
        message: '房间已关闭',
      };
    }

    const player = room.players.get(role);
    if (!player) {
      return {
        type: ErrorType.UNAUTHORIZED,
        message: '玩家不存在',
      };
    }

    // 更新socket ID映射
    this.socketToRoom.delete(player.socketId);
    this.socketToRoom.set(newSocketId, roomId);

    // 更新玩家信息
    player.socketId = newSocketId;
    player.status = 'connected';

    Logger.info(`Player reconnected: ${newSocketId}, room: ${roomId}, role: ${role}`);

    return { roomId, role };
  }

  /**
   * 开始游戏
   * @param roomId 房间ID
   */
  startGame(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    if (room.players.size < config.room.maxPlayers) {
      return false;
    }

    room.status = 'playing';
    room.startedAt = Date.now();

    Logger.info(`Game started in room: ${roomId}`);

    return true;
  }

  /**
   * 结束游戏
   * @param roomId 房间ID
   */
  endGame(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    room.status = 'finished';
    Logger.info(`Game ended in room: ${roomId}`);
  }

  /**
   * 调度房间清理（超时自动关闭）
   * @param roomId 房间ID
   */
  private scheduleRoomCleanup(roomId: string): void {
    setTimeout(() => {
      const room = this.rooms.get(roomId);
      if (room && room.status === 'waiting') {
        Logger.info(`Room timeout: ${roomId}, closing...`);
        this.closeRoom(roomId);
      }
    }, config.room.timeout);
  }

  /**
   * 获取所有房间数量（用于监控）
   */
  getRoomCount(): number {
    return this.rooms.size;
  }

  /**
   * 获取在线玩家数量（用于监控）
   */
  getPlayerCount(): number {
    let count = 0;
    for (const room of this.rooms.values()) {
      count += room.players.size;
    }
    return count;
  }
}
