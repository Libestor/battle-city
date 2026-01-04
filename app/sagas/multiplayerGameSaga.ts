import { call, delay, put, race, select, take, fork, all } from 'redux-saga/effects';
import { eventChannel, EventChannel } from 'redux-saga';
import { State } from '../reducers';
import { A } from '../utils/actions';
import { socketService } from '../utils/SocketService';
import { SocketEvent, PlayerInput, PlayerRole, GameStateEvent } from '../types/multiplayer-types';
import * as actions from '../utils/actions';
import fireController from './fireController';
import directionController from './directionController';
import { setRandomSeed } from '../utils/common';
import { TankRecord, BulletRecord } from '../types';
import { Map as IMap, Set as ISet } from 'immutable';

function getOpponentPlayerName(role: PlayerRole): PlayerName {
  return role === 'host' ? 'player-2' : 'player-1';
}

function getMyPlayerName(role: PlayerRole): PlayerName {
  return role === 'host' ? 'player-1' : 'player-2';
}

/**
 * 创建对手输入事件通道
 */
function createOpponentInputChannel(): EventChannel<PlayerInput> {
  return eventChannel(emitter => {
    const handler = (input: PlayerInput) => {
      emitter(input);
    };

    socketService.on(SocketEvent.OPPONENT_INPUT, handler);

    return () => {
      socketService.off(SocketEvent.OPPONENT_INPUT, handler);
    };
  });
}

/**
 * 创建游戏状态事件通道
 */
function createGameStateEventChannel(): EventChannel<GameStateEvent> {
  return eventChannel(emitter => {
    const handler = (event: GameStateEvent) => {
      emitter(event);
    };

    socketService.on(SocketEvent.GAME_STATE_EVENT, handler);

    return () => {
      socketService.off(SocketEvent.GAME_STATE_EVENT, handler);
    };
  });
}

// 存储 Guest 最新输入状态（用于 Host 端远程控制 player-2）
let guestInputState = {
  direction: null as Direction | null,
  moving: false,
  firing: false,
};

// 存储对手射击状态
let opponentFireState = {
  firing: false,
  tankId: null as TankId | null,
};

/**
 * 获取 Guest 玩家输入（用于 Host 端的 directionController）
 */
function getGuestPlayerInput(tank: TankRecord): any {
  if (!guestInputState.moving) {
    return null; // 没有移动
  }

  const direction = guestInputState.direction;
  if (direction == null) {
    return null;
  }

  if (direction !== tank.direction) {
    return { type: 'turn', direction };
  } else {
    return { type: 'forward' };
  }
}

/**
 * 获取对手是否应该射击
 */
export function shouldOpponentFire(tankId: TankId): boolean {
  return opponentFireState.tankId === tankId && opponentFireState.firing;
}

/**
 * Host: 监听 Guest 玩家输入并控制其坦克
 */
function* hostWatchGuestInput() {
  const channel: EventChannel<PlayerInput> = yield call(createOpponentInputChannel);

  try {
    while (true) {
      const input: PlayerInput = yield take(channel);
      yield call(hostHandleGuestInput, input);
    }
  } finally {
    channel.close();
  }
}

/**
 * Host: 处理 Guest 玩家输入
 */
function* hostHandleGuestInput(input: PlayerInput) {
  const state: State = yield select();

  if (!state.multiplayer.enabled || !state.multiplayer.roomInfo) {
    return;
  }

  // 处理完整状态输入 - 更新 guestInputState 供 directionController 使用
  if (input.type === 'state') {
    guestInputState = {
      direction: input.direction || guestInputState.direction,
      moving: input.moving,
      firing: input.firing,
    };

    // Guest 玩家是 player-2
    const guestPlayer = state.player2;
    const guestTankId = guestPlayer.activeTankId;
    if (!guestTankId) {
      return;
    }

    // 处理开火状态
    if (input.firing) {
      opponentFireState = {
        firing: true,
        tankId: guestTankId,
      };
    }
  }
}

/**
 * Host: 每个 tick 广播完整游戏状态
 */
function* hostBroadcastGameState() {
  let tickCount = 0;

  while (true) {
    yield take(A.Tick);
    tickCount++;

    // 每 2 个 tick 广播一次状态（约 33ms 一次）
    if (tickCount % 2 !== 0) {
      continue;
    }

    const state: State = yield select();

    if (!state.multiplayer.enabled || !state.multiplayer.roomInfo) {
      continue;
    }

    // 收集所有坦克状态
    const tanks: any[] = [];
    state.tanks.forEach((tank, tankId) => {
      tanks.push({
        tankId,
        x: tank.x,
        y: tank.y,
        direction: tank.direction,
        moving: tank.moving,
        side: tank.side,
        level: tank.level,
        hp: tank.hp,
        alive: tank.alive,
        color: tank.color,
        helmetDuration: tank.helmetDuration,
        frozenTimeout: tank.frozenTimeout,
        cooldown: tank.cooldown,
        withPowerUp: tank.withPowerUp,
      });
    });

    // 收集所有子弹状态
    const bullets: any[] = [];
    state.bullets.forEach((bullet, bulletId) => {
      bullets.push({
        bulletId,
        x: bullet.x,
        y: bullet.y,
        direction: bullet.direction,
        speed: bullet.speed,
        tankId: bullet.tankId,
        power: bullet.power,
      });
    });

    // 广播完整状态
    socketService.sendGameStateEvent({
      type: 'full_sync',
      data: {
        tanks,
        bullets,
        // 也同步地图状态（砖块等）
        bricks: state.map.bricks.toArray(),
        steels: state.map.steels.toArray(),
      },
      timestamp: Date.now(),
      sender: 'host',
    });
  }
}

/**
 * Guest: 监听 Host 广播的游戏状态
 */
function* guestWatchGameState() {
  const channel: EventChannel<GameStateEvent> = yield call(createGameStateEventChannel);

  try {
    while (true) {
      const event: GameStateEvent = yield take(channel);

      if (event.type === 'full_sync' && event.sender === 'host') {
        yield call(guestApplyGameState, event.data);
      }
    }
  } finally {
    channel.close();
  }
}

/**
 * Guest: 应用 Host 广播的游戏状态
 */
function* guestApplyGameState(data: any) {
  const state: State = yield select();

  if (!state.multiplayer.enabled) {
    return;
  }

  const { tanks, bullets, bricks, steels } = data;

  // 同步坦克状态
  for (const tankData of tanks) {
    const existingTank = state.tanks.get(tankData.tankId);

    if (existingTank) {
      // 更新现有坦克
      const updatedTank = existingTank.merge({
        x: tankData.x,
        y: tankData.y,
        direction: tankData.direction,
        moving: tankData.moving,
        hp: tankData.hp,
        alive: tankData.alive,
        helmetDuration: tankData.helmetDuration,
        frozenTimeout: tankData.frozenTimeout,
        cooldown: tankData.cooldown,
      });
      yield put(actions.move(updatedTank));

      // 同步移动状态
      if (tankData.moving && !existingTank.moving) {
        yield put(actions.startMove(tankData.tankId));
      } else if (!tankData.moving && existingTank.moving) {
        yield put(actions.stopMove(tankData.tankId));
      }

      // 处理死亡
      if (!tankData.alive && existingTank.alive) {
        yield put(actions.setTankToDead(tankData.tankId));
      }
    } else {
      // 创建新坦克
      const newTank = new TankRecord({
        tankId: tankData.tankId,
        x: tankData.x,
        y: tankData.y,
        direction: tankData.direction,
        moving: tankData.moving,
        side: tankData.side,
        level: tankData.level,
        hp: tankData.hp,
        alive: tankData.alive,
        color: tankData.color,
        helmetDuration: tankData.helmetDuration,
        frozenTimeout: tankData.frozenTimeout,
        cooldown: tankData.cooldown,
        withPowerUp: tankData.withPowerUp,
      });
      yield put(actions.addTank(newTank));
    }
  }

  // 移除 Host 端不存在的坦克
  const hostTankIds = new Set(tanks.map((t: any) => t.tankId));
  for (const [tankId, tank] of state.tanks.entries()) {
    if (!hostTankIds.has(tankId) && tank.alive) {
      yield put(actions.setTankToDead(tankId));
    }
  }

  // 同步子弹状态 - 使用 updateBullets 批量更新
  const hostBulletIds = new Set(bullets.map((b: any) => b.bulletId));

  // 构建新的子弹 Map
  let updatedBulletsMap = IMap<BulletId, BulletRecord>();
  for (const bulletData of bullets) {
    const newBullet = new BulletRecord({
      bulletId: bulletData.bulletId,
      x: bulletData.x,
      y: bulletData.y,
      direction: bulletData.direction,
      speed: bulletData.speed,
      tankId: bulletData.tankId,
      power: bulletData.power,
    });
    updatedBulletsMap = updatedBulletsMap.set(bulletData.bulletId, newBullet);
  }

  // 批量更新子弹
  yield put(actions.updateBullets(updatedBulletsMap));

  // 移除 Host 端不存在的子弹
  for (const [bulletId] of state.bullets.entries()) {
    if (!hostBulletIds.has(bulletId)) {
      yield put(actions.beforeRemoveBullet(bulletId));
    }
  }

  // 同步地图状态（砖块）- 地图不需要每帧同步，只同步变化
  // 注意：Guest 端自己加载地图，只需要同步被摧毁的砖块
  if (bricks && Array.isArray(bricks)) {
    for (let i = 0; i < bricks.length; i++) {
      if (state.map.bricks.get(i) !== bricks[i]) {
        if (!bricks[i] && state.map.bricks.get(i)) {
          // 砖块被摧毁
          yield put(actions.removeBricks(ISet([i])));
        }
      }
    }
  }

  // 同步钢墙状态
  if (steels && Array.isArray(steels)) {
    for (let i = 0; i < steels.length; i++) {
      if (state.map.steels.get(i) !== steels[i]) {
        if (!steels[i] && state.map.steels.get(i)) {
          // 钢墙被摧毁
          yield put(actions.removeSteels(ISet([i])));
        }
      }
    }
  }
}

/**
 * 每个tick重置对手射击状态
 */
function* resetOpponentFireState() {
  while (true) {
    yield take(A.Tick);
    opponentFireState.firing = false;
  }
}

/**
 * 定期发送ping来测量网络延迟
 */
function* pingLoop() {
  while (true) {
    const state: State = yield select();

    if (state.multiplayer.enabled && state.multiplayer.roomInfo) {
      const startTime = Date.now();
      socketService.sendPing();

      const channel: EventChannel<any> = yield call(createPongChannel);
      const { pong }: any = yield race({
        pong: take(channel),
        timeout: delay(1000),
      });
      channel.close();

      if (pong) {
        const ping = Date.now() - startTime;
        yield put(actions.updateNetworkStats({ ping, lastPingTime: Date.now() }));
      }
    }

    yield delay(2000);
  }
}

function createPongChannel(): EventChannel<any> {
  return eventChannel(emitter => {
    const handler = (data: any) => {
      emitter(data);
    };

    socketService.on(SocketEvent.PONG, handler);

    return () => {
      socketService.off(SocketEvent.PONG, handler);
    };
  });
}

function* watchOpponentFire(opponentPlayerName: PlayerName) {
  while (true) {
    const action: actions.ActivatePlayer = yield take(
      (nextAction: actions.Action) =>
        nextAction.type === A.ActivatePlayer && nextAction.playerName === opponentPlayerName,
    );

    const tankId = action.tankId;
    const result: any = yield race({
      controller: call(fireController, tankId, () => shouldOpponentFire(tankId)),
      next: take(
        (nextAction: actions.Action) =>
          nextAction.type === A.ActivatePlayer && nextAction.playerName === opponentPlayerName,
      ),
      leave: take([A.LeaveGameScene, A.DisableMultiplayer]),
    });

    if (result.leave) {
      return;
    }
  }
}

/**
 * Host: 监听 Guest 玩家移动并控制其坦克
 */
function* watchOpponentMove(opponentPlayerName: PlayerName) {
  while (true) {
    const action: actions.ActivatePlayer = yield take(
      (nextAction: actions.Action) =>
        nextAction.type === A.ActivatePlayer && nextAction.playerName === opponentPlayerName,
    );

    const tankId = action.tankId;
    const result: any = yield race({
      controller: call(directionController, tankId, getGuestPlayerInput),
      next: take(
        (nextAction: actions.Action) =>
          nextAction.type === A.ActivatePlayer && nextAction.playerName === opponentPlayerName,
      ),
      leave: take([A.LeaveGameScene, A.DisableMultiplayer]),
    });

    if (result.leave) {
      return;
    }
  }
}

/**
 * 判断当前客户端是否为 Host
 */
export function* isHost() {
  const state: State = yield select();
  return state.multiplayer.enabled && state.multiplayer.roomInfo?.role === 'host';
}

/**
 * 广播游戏状态事件（仅 Host 调用）
 */
export function sendGameStateEvent(type: GameStateEvent['type'], data: any) {
  socketService.sendGameStateEvent({
    type,
    data,
    timestamp: Date.now(),
    sender: 'host',
  });
}

/**
 * 联机游戏主saga
 */
export default function* multiplayerGameSaga() {
  while (true) {
    yield take(A.MultiplayerGameStart);

    const state: State = yield select();
    const role = state.multiplayer.roomInfo?.role;
    if (!role) {
      continue;
    }

    const opponentPlayerName = getOpponentPlayerName(role);

    if (role === 'host') {
      // Host 模式：监听 Guest 输入 + 广播游戏状态 + 控制 Guest 移动和开火
      yield race({
        watchGuestInput: call(hostWatchGuestInput),
        broadcastState: call(hostBroadcastGameState),
        opponentFire: call(watchOpponentFire, opponentPlayerName),
        opponentMove: call(watchOpponentMove, opponentPlayerName),
        resetFire: call(resetOpponentFireState),
        ping: call(pingLoop),
        leave: take([A.LeaveGameScene, A.DisableMultiplayer]),
      });
    } else {
      // Guest 模式：只监听 Host 状态广播
      yield race({
        watchGameState: call(guestWatchGameState),
        ping: call(pingLoop),
        leave: take([A.LeaveGameScene, A.DisableMultiplayer]),
      });
    }

    opponentFireState = { firing: false, tankId: null };
    setRandomSeed(null);
  }
}
