import { eventChannel, buffers } from 'redux-saga';
import { call, delay, put, race, take } from 'redux-saga/effects';
import { push } from '../utils/router';
import { A, Action, startGame } from '../utils/actions';
import {
  startGameCountdown,
  cancelGameCountdown,
  updateCountdown,
  multiplayerGameStart,
  setGameInitialState,
} from '../utils/multiplayerActions';
import { firstStageName } from '../stages';
import { socketService } from '../utils/SocketService';
import { SocketEvent, GameInitialState } from '../types/multiplayer-types';
import { MULTI_PLAYERS_SEARCH_KEY } from '../utils/constants';
import { setRandomSeed } from '../utils/common';

const shouldCancelWatch = (action: Action) => {
  if (action.type === A.DisableMultiplayer) {
    return true;
  }
  if (action.type === A.SetRoomInfo && action.roomInfo == null) {
    return true;
  }
  return false;
};

const shouldCancelCountdown = (action: Action) => {
  if (shouldCancelWatch(action)) {
    return true;
  }
  return action.type === A.SetOpponentConnected && action.connected === false;
};

/**
 * 监听游戏初始状态，当服务器发送同步状态后启动倒计时
 */
function* watchGameInitialState() {
  while (true) {
    // 等待服务器发送游戏初始状态
    yield take(A.SetGameInitialState);

    const state: State = yield select();
    const { multiplayer } = state;

    // 检查初始状态是否有效
    if (!multiplayer.gameInitialState || !multiplayer.roomInfo) {
      continue;
    }

    // 设置对手已连接
    yield put({ type: A.SetOpponentConnected, connected: true });

    // 启动倒计时
    yield put(startGameCountdown());

    // 执行倒计时逻辑
    const result: any = yield race({
      countdown: call(countdownSaga),
      cancel: take([A.DisableMultiplayer, A.SetRoomInfo]),
    });

    if (result.cancel) {
      // 对手断开或离开大厅，取消倒计时
      yield put(cancelGameCountdown());
    } else if (result.countdown) {
      // 倒计时结束，启动游戏
      yield put(multiplayerGameStart());

      // 发出startGame action启动游戏（从第一关开始）
      yield put(startGame(0));

      // 跳转到游戏场景
      yield put(push(`/stage/${firstStageName}`));
    }
  }
}

/**
 * 倒计时saga
 */
function* countdownSaga() {
  // 3秒倒计时
  for (let i = 3; i > 0; i--) {
    yield put(updateCountdown(i));
    yield delay(1000);
  }

  yield put(updateCountdown(0));
  return true;
}

/**
 * 等待服务器发起游戏开始信号，并同步初始状态
 */
function* watchGameStart() {
  const startChannel = yield call(createSocketChannel, SocketEvent.GAME_START);
  const initChannel = yield call(createSocketChannel, SocketEvent.GAME_STATE_INIT);
  let pendingStart = false;
  let countdownComplete = false;
  let initialState: GameInitialState | null = null;

  const maybeStartGame = function* () {
    if (!pendingStart || !countdownComplete || !initialState) {
      return;
    }

    yield put(multiplayerGameStart());
    const stageIndex = Math.max(0, (initialState.mapId || 1) - 1);
    yield put(startGame(stageIndex));
    yield put(push(`/stage/${firstStageName}?${MULTI_PLAYERS_SEARCH_KEY}`));

    pendingStart = false;
    countdownComplete = false;
    initialState = null;
  };

  try {
    while (true) {
      const result: any = yield race({
        start: take(startChannel),
        init: take(initChannel),
        cancel: take(shouldCancelWatch),
      });

      if (result.cancel) {
        pendingStart = false;
        countdownComplete = false;
        initialState = null;
        setRandomSeed(null);
        yield put(cancelGameCountdown());
        continue;
      }

      if (result.init) {
        initialState = result.init as GameInitialState;
        yield put(setGameInitialState(initialState));
        setRandomSeed(initialState.seed);
        yield* maybeStartGame();
        continue;
      }

      if (result.start) {
        pendingStart = true;
        countdownComplete = false;
        yield put(startGameCountdown());

        const countdownResult: any = yield race({
          countdown: call(countdownSaga),
          cancel: take(shouldCancelCountdown),
        });

        if (countdownResult.cancel) {
          pendingStart = false;
          countdownComplete = false;
          initialState = null;
          setRandomSeed(null);
          yield put(cancelGameCountdown());
          continue;
        }

        countdownComplete = true;
        yield* maybeStartGame();
      }
    }
  } finally {
    startChannel.close();
    initChannel.close();
  }
}

/**
 * 联机大厅主saga
 */
export default function* multiplayerLobbySaga() {
  while (true) {
    // 等待启用联机模式
    yield take(A.EnableMultiplayer);

    // 启动监听
    yield race({
      watchGameInit: call(watchGameInitialState),
      leave: take(A.DisableMultiplayer),
    });

    if (result.leave) {
      setRandomSeed(null);
    }
  }
}
