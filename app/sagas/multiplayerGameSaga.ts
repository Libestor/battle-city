import { call, delay, put, race, select, take, fork } from 'redux-saga/effects';
import { eventChannel, EventChannel } from 'redux-saga';
import { State } from '../reducers';
import { A } from '../utils/actions';
import { socketService } from '../utils/SocketService';
import {
  SocketEvent,
  PlayerInput,
  PlayerRole,
  ServerStateSyncPayload,
  ServerTankState,
  ServerBulletState,
  MapChangesPayload,
} from '../types/multiplayer-types';
import * as actions from '../utils/actions';
import { TankRecord, BulletRecord, ExplosionRecord } from '../types';
import { Map as IMap, Set as ISet } from 'immutable';
import { getNextId, frame as f } from '../utils/common';
import Timing from '../utils/Timing';

/**
 * 创建服务器状态同步事件通道
 */
function createStateSyncChannel(): EventChannel<ServerStateSyncPayload> {
  return eventChannel(emitter => {
    const handler = (data: ServerStateSyncPayload) => {
      emitter(data);
    };

    socketService.on(SocketEvent.STATE_SYNC, handler);

    return () => {
      socketService.off(SocketEvent.STATE_SYNC, handler);
    };
  });
}

/**
 * 创建地图变化事件通道
 */
function createMapChangesChannel(): EventChannel<MapChangesPayload> {
  return eventChannel(emitter => {
    const handler = (data: MapChangesPayload) => {
      emitter(data);
    };

    socketService.on(SocketEvent.MAP_CHANGES, handler);

    return () => {
      socketService.off(SocketEvent.MAP_CHANGES, handler);
    };
  });
}

/**
 * 创建Pong响应通道
 */
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

/**
 * 本地子弹爆炸动画（不广播）
 */
function* explosionFromBulletLocal(cx: number, cy: number) {
  const bulletExplosionShapeTiming: [ExplosionShape, number][] = [
    ['s0', f(4)],
    ['s1', f(3)],
    ['s2', f(2)],
  ];

  const explosionId = getNextId('explosion');
  try {
    for (const [shape, time] of bulletExplosionShapeTiming) {
      yield put(
        actions.setExplosion(
          new ExplosionRecord({
            cx,
            cy,
            shape,
            explosionId,
          }),
        ),
      );
      yield Timing.delay(time);
    }
  } finally {
    yield put(actions.removeExplosion(explosionId));
  }
}

/**
 * 本地坦克爆炸动画（不广播）
 * 坦克爆炸动画比子弹爆炸更大更持久
 */
function* tankExplosionLocal(cx: number, cy: number) {
  const tankExplosionShapeTiming: [ExplosionShape, number][] = [
    ['s0', f(7)],
    ['s1', f(5)],
    ['s2', f(7)],
    ['b0', f(5)],
    ['b1', f(7)],
    ['s2', f(5)],
  ];

  const explosionId = getNextId('explosion');
  try {
    for (const [shape, time] of tankExplosionShapeTiming) {
      yield put(
        actions.setExplosion(
          new ExplosionRecord({
            cx,
            cy,
            shape,
            explosionId,
          }),
        ),
      );
      yield Timing.delay(time);
    }
  } finally {
    yield put(actions.removeExplosion(explosionId));
  }
}

/**
 * 存储本地玩家输入状态
 */
let localInputState = {
  direction: null as 'up' | 'down' | 'left' | 'right' | null,
  moving: false,
  firing: false,
};

/**
 * 更新本地输入状态（由 playerController 调用）
 */
export function updateLocalInput(direction: 'up' | 'down' | 'left' | 'right' | null, moving: boolean, firing: boolean) {
  localInputState = { direction, moving, firing };
}

/**
 * 发送本地玩家输入到服务器
 */
function* sendLocalPlayerInput() {
  let lastSentInput = { direction: null as any, moving: false, firing: false };

  while (true) {
    yield take(A.Tick);

    const state: State = yield select();
    if (!state.multiplayer.enabled || !state.multiplayer.roomInfo) {
      continue;
    }

    // 只在输入变化时发送
    if (
      localInputState.direction !== lastSentInput.direction ||
      localInputState.moving !== lastSentInput.moving ||
      localInputState.firing !== lastSentInput.firing
    ) {
      const input: PlayerInput = {
        type: 'state',
        direction: localInputState.direction || undefined,
        moving: localInputState.moving,
        firing: localInputState.firing,
        timestamp: Date.now(),
      };

      socketService.sendPlayerInput(input);
      lastSentInput = { ...localInputState };
    }
  }
}

/**
 * 接收服务器状态并更新本地状态
 */
function* receiveServerState() {
  const channel: EventChannel<ServerStateSyncPayload> = yield call(createStateSyncChannel);

  try {
    while (true) {
      const serverState: ServerStateSyncPayload = yield take(channel);
      yield call(applyServerState, serverState);
    }
  } finally {
    channel.close();
  }
}

/**
 * 应用服务器状态到本地 Redux store
 */
function* applyServerState(serverState: ServerStateSyncPayload) {
  const state: State = yield select();

  if (!state.multiplayer.enabled) {
    return;
  }

  // 同步坦克状态
  for (const tankData of serverState.tanks) {
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

      // 处理死亡 - 添加爆炸动画和音效
      if (!tankData.alive && existingTank.alive) {
        yield put(actions.setTankToDead(tankData.tankId));
        // 播放爆炸音效和动画
        yield put(actions.playSound('explosion_1'));
        yield fork(tankExplosionLocal, existingTank.x + 8, existingTank.y + 8);
      }
    } else {
      // 创建新坦克 - 播放重生音效
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

  // 移除服务器端不存在的坦克
  const serverTankIds = new Set(serverState.tanks.map(t => t.tankId));
  for (const [tankId, tank] of state.tanks.entries()) {
    if (!serverTankIds.has(tankId) && tank.alive) {
      yield put(actions.setTankToDead(tankId));
    }
  }

  // 同步子弹状态 - 使用 updateBullets 批量更新
  const serverBulletIds = new Set(serverState.bullets.map(b => b.bulletId));

  // 检测消失的子弹（本地有但服务器没有），生成本地爆炸效果
  for (const [bulletId, bullet] of state.bullets.entries()) {
    if (!serverBulletIds.has(bulletId)) {
      // 子弹消失，在其位置生成爆炸效果（使用 fork 异步执行）
      yield fork(explosionFromBulletLocal, bullet.x + 2, bullet.y + 2);
    }
  }

  let updatedBulletsMap = IMap<BulletId, BulletRecord>();
  for (const bulletData of serverState.bullets) {
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

  // 同步完整地图状态（仅在首次接收时，即 map 字段存在时）
  if (serverState.map && serverState.map.bricks) {
    const bricksToRemove: number[] = [];
    const currentBricks = state.map.bricks;

    for (let i = 0; i < serverState.map.bricks.length; i++) {
      // 如果服务器端砖块已被破坏，且本地砖块还存在
      if (!serverState.map.bricks[i] && currentBricks.get(i) === true) {
        bricksToRemove.push(i);
      }
    }

    if (bricksToRemove.length > 0) {
      yield put(actions.removeBricks(ISet(bricksToRemove)));
    }
  }
}

/**
 * 应用地图变化（增量更新）
 */
function* applyMapChanges(mapChanges: MapChangesPayload) {
  const state: State = yield select();

  if (!state.multiplayer.enabled) {
    return;
  }

  // 移除被破坏的砖块
  if (mapChanges.bricksDestroyed.length > 0) {
    yield put(actions.removeBricks(ISet(mapChanges.bricksDestroyed)));
    // 本地播放砖块摧毁音效（不广播）
    yield put(actions.playSound('bullet_hit_2'));
  }

  // 移除被破坏的钢块（如果需要的话）
  // 目前游戏中钢块破坏较少，可以暂时忽略或添加类似逻辑
}

/**
 * 接收地图变化并更新本地状态
 */
function* receiveMapChanges() {
  const channel: EventChannel<MapChangesPayload> = yield call(createMapChangesChannel);

  try {
    while (true) {
      const mapChanges: MapChangesPayload = yield take(channel);
      yield call(applyMapChanges, mapChanges);
    }
  } finally {
    channel.close();
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

/**
 * 判断当前客户端是否为 Host
 */
export function* isHost() {
  const state: State = yield select();
  return state.multiplayer.enabled && state.multiplayer.roomInfo?.role === 'host';
}

/**
 * 联机游戏主saga（服务器权威模式）
 *
 * 在服务器权威模式下：
 * - 客户端只发送玩家输入到服务器
 * - 客户端接收服务器广播的游戏状态并渲染
 * - 所有游戏逻辑由服务器运行
 */
export default function* multiplayerGameSaga() {
  while (true) {
    yield take(A.MultiplayerGameStart);

    const state: State = yield select();
    const role = state.multiplayer.roomInfo?.role;
    if (!role) {
      continue;
    }

    console.log(`[Multiplayer] Server-Authoritative mode started, role: ${role}`);

    // 服务器权威模式：发送输入 + 接收状态 + 接收地图变化
    yield race({
      sendInput: call(sendLocalPlayerInput),
      receiveState: call(receiveServerState),
      receiveMapChanges: call(receiveMapChanges),
      ping: call(pingLoop),
      leave: take([A.LeaveGameScene, A.DisableMultiplayer]),
    });

    // 清理状态
    localInputState = { direction: null, moving: false, firing: false };
    console.log('[Multiplayer] Game session ended');
  }
}
