import React from 'react';
import { useSelector } from 'react-redux';
import { State } from '../reducers';
import Text from './Text';

/**
 * 网络状态显示组件
 * 显示网络延迟和连接状态
 */
const NetworkStatus: React.FC = () => {
  const multiplayer = useSelector((state: State) => state.multiplayer);

  // 只在联机模式下显示
  if (!multiplayer.enabled || !multiplayer.roomInfo) {
    return null;
  }

  const { ping, connectionStatus } = multiplayer.networkStats;

  // 根据延迟确定颜色（使用十六进制颜色值）
  let color: string;

  if (connectionStatus !== 'connected') {
    color = '#ff0000'; // 红色
  } else if (ping < 50) {
    color = '#00ff00'; // 绿色
  } else if (ping < 100) {
    color = '#ffff00'; // 黄色
  } else if (ping < 200) {
    color = '#ffa500'; // 橙色
  } else {
    color = '#ff0000'; // 红色
  }

  return (
    <g className="network-status" transform="translate(200, 8)">
      <Text 
        content={`ping: ${ping}ms`} 
        x={0} 
        y={0} 
        fill={color} 
      />
    </g>
  );
};

export default NetworkStatus;
