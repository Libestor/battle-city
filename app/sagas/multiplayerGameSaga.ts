import { call, delay, put, race, select, take } from 'redux-saga/effects';
import { eventChannel, EventChannel } from 'redux-saga';
import { Set as ISet } from 'immutable';
import { State } from '../reducers';
import { A } from '../utils/actions';
import { socketService } from '../utils/SocketService';
import { SocketEvent, PlayerInput, GameStateEvent } from '../types/multiplayer-types';
import * as actions from '../utils/actions';
import * as multiplayerActions from '../utils/multiplayerActions';
import fireController from './fireController';

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
 * 创建游戏状态事件通道
 */
function createGameStateEventChannel(): EventChannel<GameStateEvent> {
  return eventChannel(emitter => {
    const handler = (event: GameStateEvent) => {
      emitter(event);
    };

    socketService.on(SocketEvent.GAME_STATE_EVENT, handler);

    // 返回取消订阅函数
    return () => {
      socketService.off(SocketEvent.GAME_STATE_EVENT, handler);
    };
  });
}

/**
 * 创建状态同步事件通道
 */
function createStateSyncChannel(): EventChannel<any> {
  return eventChannel(emitter => {
    const handler = (data: any) => {
      emitter(data);
    };

    socketService.on(SocketEvent.STATE_SYNC, handler);

    // 返回取消订阅函数
    return () => {
      socketService.off(SocketEvent.STATE_SYNC, handler);
    };
  });
}

/**
 * 创建对手断线事件通道
 */
function createOpponentDisconnectChannel(): EventChannel<void> {
  return eventChannel(emitter => {
    const handler = () => {
      emitter();
    };

    socketService.on(SocketEvent.OPPONENT_DISCONNECTED, handler);

    return () => {
      socketService.off(SocketEvent.OPPONENT_DISCONNECTED, handler);
    };
  });
}

/**
 * 创建对手重连事件通道
 */
function createOpponentReconnectChannel(): EventChannel<void> {
  return eventChannel(emitter => {
    const handler = () => {
      emitter();
    };

    socketService.on(SocketEvent.OPPONENT_RECONNECTED, handler);

    return () => {
      socketService.off(SocketEvent.OPPONENT_RECONNECTED, handler);
    };
  });
}

/**
 * 监听对手输入事件
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
 * 监听游戏状态事件
 */
function* watchGameStateEvents() {
  const channel: EventChannel<GameStateEvent> = yield call(createGameStateEventChannel);

  try {
    while (true) {
      const event: GameStateEvent = yield take(channel);
      yield call(handleGameStateEvent, event);
    }
  } finally {
    channel.close();
  }
}

/**
 * 监听状态同步事件
 */
function* watchStateSync() {
  const channel: EventChannel<any> = yield call(createStateSyncChannel);

  try {
    while (true) {
      const data: any = yield take(channel);
      if (data.requestSnapshot) {
        // 服务器请求状态快照，生成并发送当前状态
        yield call(sendStateSnapshot);
      }
    }
  } finally {
    channel.close();
  }
}

/**
 * 监听对手断线事件
 */
function* watchOpponentDisconnect() {
  const channel: EventChannel<void> = yield call(createOpponentDisconnectChannel);

  try {
    while (true) {
      yield take(channel);
      console.log('Opponent disconnected, pausing game...');
      
      // 暂停游戏
      yield put(actions.gamePause());
      
      // 显示提示信息（通过更新multiplayer状态）
      yield put(multiplayerActions.setOpponentDisconnected(true));
      
      // 启动超时计时器（60秒）
      const { timeout }: any = yield race({
        reconnect: take(channel), // 等待重连通道的消息（实际由watchOpponentReconnect处理）
        timeout: delay(60000), // 60秒超时
      });
      
      if (timeout) {
        // 超时，对手未重连，结束游戏
        console.log('Opponent reconnect timeout, ending game...');
        yield put(multiplayerActions.setOpponentDisconnected(false));
        
        // 判定为胜利
        const state: State = yield select();
        const role = state.multiplayer.roomInfo?.role;
        socketService.sendGameOver(role || 'host', 'opponent_timeout');
        
        // 返回大厅
        yield put(multiplayerActions.disableMultiplayer());
        yield put(actions.leaveGameScene());
      }
    }
  } finally {
    channel.close();
  }
}

/**
 * 监听对手重连事件
 */
function* watchOpponentReconnect() {
  const channel: EventChannel<void> = yield call(createOpponentReconnectChannel);

  try {
    while (true) {
      yield take(channel);
      console.log('Opponent reconnected, resuming game...');
      
      // 恢复游戏
      yield put(actions.gameResume());
      
      // 隐藏提示信息
      yield put(multiplayerActions.setOpponentDisconnected(false));
      
      // 发送当前状态快照给对手（帮助对手恢复状态）
      yield call(sendStateSnapshot);
    }
  } finally {
    channel.close();
  }
}

/**
 * 生成并发送当前游戏状态快照
 */
function* sendStateSnapshot() {
  const state: State = yield select();
  
  // 生成状态快照
  const snapshot = {
    timestamp: Date.now(),
    tanks: state.tanks.toArray().map(tank => ({
      tankId: tank.tankId,
      x: tank.x,
      y: tank.y,
      hp: tank.hp,
      alive: tank.alive,
    })),
    bullets: state.bullets.toArray().map(bullet => ({
      bulletId: bullet.bulletId,
      x: bullet.x,
      y: bullet.y,
    })),
    bricksCount: state.map.bricks.count(),
    steelsCount: state.map.steels.count(),
    eagleAlive: state.map.eagle,
  };
  
  // 发送快照到服务器（服务器会转发给对手进行比对）
  socketService.emit(SocketEvent.STATE_SYNC, snapshot);
  
  console.log('State snapshot sent:', snapshot);
}

/**
 * 处理游戏状态事件
 */
function* handleGameStateEvent(event: GameStateEvent) {
  const state: State = yield select();

  // 检查是否在联机模式
  if (!state.multiplayer.enabled || !state.multiplayer.roomInfo) {
    return;
  }

  console.log('Received game state event:', event.type, event.data);

  switch (event.type) {
    case 'enemy_spawn':
      // 应用敌人生成
      if (event.data) {
        const { tankId, x, y, level, hp, withPowerUp } = event.data;
        const { TankRecord } = yield import('../types');
        const tank = new TankRecord({
          tankId,
          x,
          y,
          side: 'bot',
          level,
          hp,
          withPowerUp,
          frozenTimeout: state.game.botFrozenTimeout,
        });
        
        // 生成坦克动画
        const { spawnTank } = yield import('./common');
        yield put(actions.setIsSpawningBotTank(true));
        yield call(spawnTank, tank, 1);
        yield put(actions.setIsSpawningBotTank(false));
        
        // 启动敌人AI
        const { default: botSaga } = yield import('./BotSaga');
        const { fork } = yield import('redux-saga/effects');
        yield fork(botSaga, tankId);
        
        console.log('Enemy spawned from server:', tankId);
      }
      break;

    case 'bricks_removed':
      // 应用砖块破坏
      if (event.data.bricks && Array.isArray(event.data.bricks)) {
        yield put(actions.removeBricks(ISet(event.data.bricks)));
      }
      break;

    case 'steels_removed':
      // 应用钢块破坏
      if (event.data.steels && Array.isArray(event.data.steels)) {
        yield put(actions.removeSteels(ISet(event.data.steels)));
      }
      break;

    case 'eagle_destroyed':
      // 应用老鹰被摧毁
      yield put(actions.destroyEagle());
      break;

    case 'enemy_destroy':
      // 应用敌人摧毁（这里只需要确保视觉效果同步，实际的坦克状态由各自的saga管理）
      // 可以在这里添加额外的同步逻辑，比如确保分数统计一致
      console.log('Enemy destroyed:', event.data);
      break;

    default:
      console.warn('Unknown game state event type:', event.type);
  }
}

// 存储对手射击状态
let opponentFireState = {
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
function* handleOpponentInput(input: PlayerInput) {
  const state: State = yield select();

  // 检查是否在联机模式
  if (!state.multiplayer.enabled || !state.multiplayer.roomInfo) {
    return;
  }
}

/**
 * 应用服务器状态到本地 Redux store
 */
function* applyServerState(serverState: ServerStateSyncPayload) {
  const state: State = yield select();

  // 确定对手坦克ID：通过对手的 player 状态获取
  const role = state.multiplayer.roomInfo.role;
  // 主机控制 player1，所以对手是 player2
  // 客机控制 player2，所以对手是 player1
  const opponentPlayer = role === 'host' ? state.player2 : state.player1;
  const opponentTankId = opponentPlayer.activeTankId;

  if (opponentTankId === -1) {
    // 对手坦克还未激活
    return;
  }

  // 获取对手坦克
  const opponentTank = state.tanks.get(opponentTankId);
  if (!opponentTank) {
    console.warn('Opponent tank not found:', opponentTankId);
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
 * 获取对手的活跃坦克ID
 */
function getOpponentTankIdFromState(state: State): TankId {
  const role = state.multiplayer.roomInfo?.role;
  const opponentPlayer = role === 'host' ? state.player2 : state.player1;
  return opponentPlayer.activeTankId;
}

/**
 * 联机游戏主saga
 */
export default function* multiplayerGameSaga() {
  while (true) {
    yield take(A.MultiplayerGameStart);

    yield race({
      watchInput: call(watchOpponentInput),
      watchGameEvents: call(watchGameStateEvents),
      watchStateSync: call(watchStateSync),
      watchDisconnect: call(watchOpponentDisconnect),
      watchReconnect: call(watchOpponentReconnect),
      // 对手射击使用专门的 fireController，需要每个 tick 检查对手坦克ID
      opponentFireController: call(function* opponentFireLoop() {
        while (true) {
          const currentState: State = yield select();
          const opponentTankId = getOpponentTankIdFromState(currentState);
          if (opponentTankId !== -1) {
            // 运行一个 tick 的 fire check
            yield call(function* singleTickFire() {
              yield race({
                fire: call(fireController, opponentTankId, () => shouldOpponentFire(opponentTankId)),
                tick: take(A.Tick),
              });
            });
          } else {
            yield take(A.Tick);
          }
        }
      }),
      resetFire: call(resetOpponentFireState),
      ping: call(pingLoop),
      leave: take([A.LeaveGameScene, A.DisableMultiplayer]),
    });

    // 清理对手射击状态
    opponentFireState = { firing: false, tankId: null };
  }
}
