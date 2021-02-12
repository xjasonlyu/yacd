import { ClashAPIConfig } from 'src/types';

import { buildWebSocketURL, getURLAndInit } from '../misc/request-helper';

const endpoint = '/connections';

const fetched = false;
const subscribers = [];

// see also https://github.com/Dreamacro/clash/blob/dev/constant/metadata.go#L41
type UUID = string;
type ConnNetwork = 'tcp' | 'udp';
type ConnType = 'HTTP' | 'HTTP Connect' | 'Socks5' | 'Redir' | 'Unknown';
export type ConnectionItem = {
  id: UUID;
  metadata: {
    network: ConnNetwork;
    type: ConnType;
    sourceIP: string;
    destinationIP: string;
    sourcePort: string;
    destinationPort: string;
    host: string;
  };
  upload: number;
  download: number;
  // e.g. "2019-11-30T22:48:13.416668+08:00",
  start: string;
  chains: string[];
  // e.g. 'Match', 'DomainKeyword'
  rule: string;
};
type ConnectionsData = {
  downloadTotal: number;
  uploadTotal: number;
  connections: Array<ConnectionItem>;
};

function handleData(cs: ConnectionsData) {
  const url = 'http://10.0.0.2:9090/connections';
  const http = new XMLHttpRequest();
  http.open("GET", url, false);
  http.send();
  const ts = JSON.parse(http.responseText);
  for (let i = 0; i < cs.connections.length; i++) {
    let cm = cs.connections[i].metadata;
    for (let j = 0; j < ts.connections.length; j++) {
      let tm = ts.connections[j].metadata;
      if ((tm.network === 'tcp' && tm.dialerIP === cm.sourceIP || tm.network === 'udp')
        && tm.dialerPort.toString() === cm.sourcePort) {
        cs.connections[i].metadata.sourceIP = tm.sourceIP;
        cs.connections[i].metadata.sourcePort = tm.sourcePort.toString();
        break;
      }
    }
  }
  return cs;
}

function appendData(s: string) {
  let o: ConnectionsData;
  try {
    o = handleData(JSON.parse(s));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log('JSON.parse error', JSON.parse(s));
  }
  subscribers.forEach((f) => f(o));
}

type UnsubscribeFn = () => void;

let wsState: number;
export function fetchData(
  apiConfig: ClashAPIConfig,
  listener: unknown
): UnsubscribeFn | void {
  if (fetched || wsState === 1) {
    if (listener) return subscribe(listener);
  }
  wsState = 1;
  const url = buildWebSocketURL(apiConfig, endpoint);
  const ws = new WebSocket(url);
  ws.addEventListener('error', () => (wsState = 3));
  ws.addEventListener('message', (event) => appendData(event.data));
  if (listener) return subscribe(listener);
}

function subscribe(listener: unknown): UnsubscribeFn {
  subscribers.push(listener);
  return function unsubscribe() {
    const idx = subscribers.indexOf(listener);
    subscribers.splice(idx, 1);
  };
}

export async function closeAllConnections(apiConfig: ClashAPIConfig) {
  const { url, init } = getURLAndInit(apiConfig);
  return await fetch(url + endpoint, { ...init, method: 'DELETE' });
}

export async function fetchConns(apiConfig: ClashAPIConfig) {
  const { url, init } = getURLAndInit(apiConfig);
  return await fetch(url + endpoint, { ...init });
}

export async function closeConnById(apiConfig: ClashAPIConfig, id: string) {
  const { url: baseURL, init } = getURLAndInit(apiConfig);
  const url = `${baseURL}${endpoint}/${id}`;
  return await fetch(url, { ...init, method: 'DELETE' });
}
