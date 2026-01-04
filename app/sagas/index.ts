import { fork, put, takeEvery, takeLatest } from 'redux-saga/effects'
import * as actions from '../utils/actions'
import { A } from '../utils/actions'
import gameSaga from './gameSaga'
import soundManager from './soundManager'
import { syncFrom, syncTo } from './syncLocalStorage'
import multiplayerLobbySaga from './multiplayerLobbySaga'
import multiplayerGameSaga from './multiplayerGameSaga'

export default function* rootSaga() {
  DEV.LOG && console.log('root saga started')

  yield syncFrom()
  yield fork(soundManager)
  yield fork(multiplayerLobbySaga)
  yield fork(multiplayerGameSaga)
  yield takeEvery(A.SyncCustomStages, syncTo)
  yield takeLatest([A.StartGame, A.ResetGame], gameSaga)

  if (DEV.SKIP_CHOOSE_STAGE) {
    yield put(actions.startGame(0))
  }
}
