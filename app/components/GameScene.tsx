import { List } from 'immutable'
import React from 'react'
import { connect } from 'react-redux'
import { useParams } from 'react-router-dom'
import { Dispatch } from 'redux'
import { GameRecord } from '../reducers/game'
import { MultiplayerRecord } from '../reducers/multiplayer'
import { State } from '../types'
import StageConfig from '../types/StageConfig'
import * as actions from '../utils/actions'
import BattleFieldScene from './BattleFieldScene'
import StatisticsScene from './StatisticsScene'

interface GameSceneInnerProps {
  game: GameRecord
  multiplayer: MultiplayerRecord
  stages: List<StageConfig>
  dispatch: Dispatch
  stageName: string
}

class GameSceneInner extends React.PureComponent<GameSceneInnerProps> {
  componentDidMount() {
    this.didMountOrUpdate()
  }

  componentDidUpdate() {
    this.didMountOrUpdate()
  }

  didMountOrUpdate() {
    const { game, dispatch, stageName, stages, multiplayer } = this.props
    const isOnlineMultiplayer = multiplayer.enabled && multiplayer.roomInfo != null
    // 联机模式下，游戏由 multiplayerLobbySaga 启动，不需要在这里启动
    // 但如果游戏已经通过 multiplayerLobbySaga 启动，则不阻止后续逻辑
    if (isOnlineMultiplayer && game.status === 'idle') {
      return
    }
    if (game.status === 'idle' || game.status === 'gameover') {
      // 如果游戏还没开始或已经结束 则开始游戏
      const stageIndex = stages.findIndex(s => s.name === stageName)
      dispatch(actions.startGame(stageIndex === -1 ? 0 : stageIndex))
    } else {
      // status is 'on' or 'statistics'
      // 用户在地址栏中手动输入了新的关卡名称
      if (
        game.currentStageName != null &&
        stages.some(s => s.name === stageName) &&
        stageName !== game.currentStageName
      ) {
        DEV.LOG && console.log('`stageName` in url changed. Restart game...')
        dispatch(actions.startGame(stages.findIndex(s => s.name === stageName)))
      }
    }
  }

  componentWillUnmount() {
    this.props.dispatch(actions.leaveGameScene())
  }

  render() {
    const { game } = this.props
    if (game.status === 'stat') {
      return <StatisticsScene />
    } else {
      return <BattleFieldScene />
    }
  }
}

function mapStateToProps(state: State) {
  return { game: state.game, stages: state.stages, multiplayer: state.multiplayer }
}

const ConnectedGameSceneInner = connect(mapStateToProps)(GameSceneInner)

export default function GameScene() {
  const { stageName } = useParams<{ stageName: string }>()
  return <ConnectedGameSceneInner stageName={stageName || ''} />
}
