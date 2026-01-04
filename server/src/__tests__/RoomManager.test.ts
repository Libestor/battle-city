import { RoomManager } from '../RoomManager';
import { ErrorType } from '../types';

describe('RoomManager', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

  describe('createRoom', () => {
    it('should create a room with a 6-digit ID', () => {
      const { roomId, sessionId } = roomManager.createRoom('socket1');
      
      expect(roomId).toMatch(/^\d{6}$/);
      expect(sessionId).toBeTruthy();
      expect(roomManager.getRoomCount()).toBe(1);
    });

    it('should assign host role to creator', () => {
      const { roomId } = roomManager.createRoom('socket1');
      const room = roomManager.getRoom(roomId);
      
      expect(room).toBeDefined();
      expect(room!.players.size).toBe(1);
      expect(room!.players.get('host')).toBeDefined();
      expect(room!.players.get('host')!.socketId).toBe('socket1');
    });

    it('should create unique room IDs', () => {
      const room1 = roomManager.createRoom('socket1');
      const room2 = roomManager.createRoom('socket2');
      
      expect(room1.roomId).not.toBe(room2.roomId);
      expect(roomManager.getRoomCount()).toBe(2);
    });
  });

  describe('joinRoom', () => {
    it('should allow guest to join existing room', () => {
      const { roomId } = roomManager.createRoom('socket1');
      const result = roomManager.joinRoom(roomId, 'socket2');
      
      expect('sessionId' in result).toBe(true);
      if ('sessionId' in result) {
        expect(result.sessionId).toBeTruthy();
      }
      
      const room = roomManager.getRoom(roomId);
      expect(room!.players.size).toBe(2);
      expect(room!.players.get('guest')).toBeDefined();
    });

    it('should return error for non-existent room', () => {
      const result = roomManager.joinRoom('999999', 'socket2');
      
      expect('type' in result).toBe(true);
      if ('type' in result) {
        expect(result.type).toBe(ErrorType.ROOM_NOT_FOUND);
      }
    });

    it('should return error when room is full', () => {
      const { roomId } = roomManager.createRoom('socket1');
      roomManager.joinRoom(roomId, 'socket2');
      const result = roomManager.joinRoom(roomId, 'socket3');
      
      expect('type' in result).toBe(true);
      if ('type' in result) {
        expect(result.type).toBe(ErrorType.ROOM_FULL);
      }
    });
  });

  describe('leaveRoom', () => {
    it('should remove guest from room', () => {
      const { roomId } = roomManager.createRoom('socket1');
      roomManager.joinRoom(roomId, 'socket2');
      
      roomManager.leaveRoom('socket2');
      
      const room = roomManager.getRoom(roomId);
      expect(room!.players.size).toBe(1);
      expect(room!.players.get('guest')).toBeUndefined();
    });

    it('should close room when host leaves', () => {
      const { roomId } = roomManager.createRoom('socket1');
      roomManager.joinRoom(roomId, 'socket2');
      
      roomManager.leaveRoom('socket1');
      
      expect(roomManager.getRoom(roomId)).toBeUndefined();
      expect(roomManager.getRoomCount()).toBe(0);
    });
  });

  describe('getOpponent', () => {
    it('should return opponent player', () => {
      const { roomId } = roomManager.createRoom('socket1');
      roomManager.joinRoom(roomId, 'socket2');
      
      const opponent = roomManager.getOpponent(roomId, 'host');
      expect(opponent).toBeDefined();
      expect(opponent!.role).toBe('guest');
      expect(opponent!.socketId).toBe('socket2');
    });

    it('should return undefined if opponent not in room', () => {
      const { roomId } = roomManager.createRoom('socket1');
      
      const opponent = roomManager.getOpponent(roomId, 'host');
      expect(opponent).toBeUndefined();
    });
  });

  describe('reconnect', () => {
    it('should allow player to reconnect with valid session', () => {
      const { roomId, sessionId } = roomManager.createRoom('socket1');
      
      const result = roomManager.reconnect(sessionId, 'socket1-new');
      
      expect('roomId' in result).toBe(true);
      if ('roomId' in result) {
        expect(result.roomId).toBe(roomId);
        expect(result.role).toBe('host');
      }
      
      const room = roomManager.getRoom(roomId);
      expect(room!.players.get('host')!.socketId).toBe('socket1-new');
    });

    it('should return error for invalid session', () => {
      const result = roomManager.reconnect('invalid-session', 'socket1');
      
      expect('type' in result).toBe(true);
      if ('type' in result) {
        expect(result.type).toBe(ErrorType.UNAUTHORIZED);
      }
    });
  });

  describe('startGame', () => {
    it('should start game when room is full', () => {
      const { roomId } = roomManager.createRoom('socket1');
      roomManager.joinRoom(roomId, 'socket2');
      
      const started = roomManager.startGame(roomId);
      
      expect(started).toBe(true);
      const room = roomManager.getRoom(roomId);
      expect(room!.status).toBe('playing');
      expect(room!.startedAt).toBeDefined();
    });

    it('should not start game when room is not full', () => {
      const { roomId } = roomManager.createRoom('socket1');
      
      const started = roomManager.startGame(roomId);
      
      expect(started).toBe(false);
      const room = roomManager.getRoom(roomId);
      expect(room!.status).toBe('waiting');
    });
  });

  describe('updatePlayerStatus', () => {
    it('should update player connection status', () => {
      const { roomId } = roomManager.createRoom('socket1');
      
      roomManager.updatePlayerStatus('socket1', 'disconnected');
      
      const room = roomManager.getRoom(roomId);
      expect(room!.players.get('host')!.status).toBe('disconnected');
    });
  });

  describe('statistics', () => {
    it('should return correct room and player counts', () => {
      roomManager.createRoom('socket1');
      const { roomId } = roomManager.createRoom('socket2');
      roomManager.joinRoom(roomId, 'socket3');
      
      expect(roomManager.getRoomCount()).toBe(2);
      expect(roomManager.getPlayerCount()).toBe(3);
    });
  });
});
