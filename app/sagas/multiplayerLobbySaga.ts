import { eventChannel } from 'redux-saga';
import { call, delay, put, race, take } from 'redux-saga/effects';
import { push } from '../utils/router';
import { A, startGame } from '../utils/actions';
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

/**
 * 创建socket事件通道
 */
function createSocketChannel(event: SocketEvent) {
  return eventChannel<GameInitialState | { timestamp: number }>(emit => {
    const handler = (data: GameInitialState | { timestamp: number }) => emit(data);
    socketService.on(event, handler);
    return () => socketService.off(event, handler);
  });
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
        cancel: take([A.DisableMultiplayer, A.SetRoomInfo]),
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
          cancel: take([A.SetOpponentConnected, A.DisableMultiplayer, A.SetRoomInfo]),
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
    const result: any = yield race({
      watchGame: call(watchGameStart),
      leave: take(A.DisableMultiplayer),
    });

    if (result.leave) {
      setRandomSeed(null);
    }
  }
}
