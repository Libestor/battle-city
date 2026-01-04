import { call, delay, put, race, select, take, fork } from 'redux-saga/effects';
import { eventChannel, EventChannel } from 'redux-saga';
import { State } from '../reducers';
import { A } from '../utils/actions';
import { socketService } from '../utils/SocketService';
import { SocketEvent, PlayerInput, PlayerRole } from '../types/multiplayer-types';
import * as actions from '../utils/actions';
import { updateNetworkStats } from '../utils/multiplayerActions';
import fireController from './fireController';
import { setRandomSeed } from '../utils/common';

function getOpponentPlayerName(role: PlayerRole): PlayerName {
  return role === 'host' ? 'player-2' : 'player-1';
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

    // 返回取消订阅函数
    return () => {
      socketService.off(SocketEvent.OPPONENT_INPUT, handler);
    };
  });
}

/**
 * 监听对手输入事件
 */
function* watchOpponentInput() {
  const channel: EventChannel<PlayerInput> = yield call(createOpponentInputChannel);

  try {
    while (true) {
      const input: PlayerInput = yield take(channel);
      yield call(handleOpponentInput, input);
    }
  } finally {
    channel.close();
  }
}

// 存储对手射击状态
let opponentFireState = {
  firing: false,
  tankId: null as TankId | null,
};

/**
 * 获取对手是否应该射击
 */
export function shouldOpponentFire(tankId: TankId): boolean {
  return opponentFireState.tankId === tankId && opponentFireState.firing;
}

/**
 * 处理对手输入
 */
function* handleOpponentInput(input: PlayerInput) {
  const state: State = yield select();
  
  // 检查是否在联机模式
  if (!state.multiplayer.enabled || !state.multiplayer.roomInfo) {
    return;
  }

  // 确定对手坦克ID
  const role = state.multiplayer.roomInfo.role;
  const opponentPlayerName = getOpponentPlayerName(role);
  const opponentPlayer = opponentPlayerName === 'player-1' ? state.player1 : state.player2;
  const opponentTankId = opponentPlayer.activeTankId;
  if (!opponentTankId) {
    return;
  }
  
  // 获取对手坦克
  const opponentTank = state.tanks.get(opponentTankId);
  if (!opponentTank) {
    console.warn('Opponent tank not found:', opponentTankId);
    return;
  }

  // 根据输入类型应用动作
  if (input.type === 'move' && input.direction) {
    // 移动或转向
    if (input.direction !== opponentTank.direction) {
      // 转向
      yield put(actions.move(opponentTank.set('direction', input.direction)));
    } else {
      // 继续移动
      if (!opponentTank.moving) {
        yield put(actions.startMove(opponentTankId));
      }
    }
  } else if (input.type === 'fire') {
    // 设置射击状态
    opponentFireState = {
      firing: true,
      tankId: opponentTankId,
    };
  } else if (input.type === 'direction' && input.direction) {
    // 仅转向
    yield put(actions.move(opponentTank.set('direction', input.direction)));
  } else {
    // 停止移动
    if (opponentTank.moving) {
      yield put(actions.stopMove(opponentTankId));
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
      
      // 等待pong响应（最多1秒）
      const channel: EventChannel<any> = yield call(createPongChannel);
      const { pong, timeout }: any = yield race({
        pong: take(channel),
        timeout: delay(1000),
      });
      channel.close();
      
      if (pong) {
        const ping = Date.now() - startTime;
        yield put(actions.updateNetworkStats({ ping, lastPingTime: Date.now() }));
      }
    }
    
    // 每2秒ping一次
    yield delay(2000);
  }
}

/**
 * 创建pong事件通道
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
 * 联机游戏主saga
 */
export default function* multiplayerGameSaga() {
  while (true) {
    // 等待游戏开始
    yield take(A.MultiplayerGameStart);
    
    // 获取对手坦克ID
    const state: State = yield select();
    const role = state.multiplayer.roomInfo?.role;
    if (!role) {
      continue;
    }
    const opponentPlayerName = getOpponentPlayerName(role);
    
    // 启动对手输入监听、fireController、ping循环和射击状态重置
    yield race({
      watchInput: call(watchOpponentInput),
      opponentFire: call(watchOpponentFire, opponentPlayerName),
      resetFire: call(resetOpponentFireState),
      ping: call(pingLoop),
      leave: take([A.LeaveGameScene, A.DisableMultiplayer]),
    });
    
    // 清理对手射击状态
    opponentFireState = { firing: false, tankId: null };
    setRandomSeed(null);
  }
}
