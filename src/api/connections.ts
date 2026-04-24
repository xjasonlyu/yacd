import { ClashAPIConfig } from '~/types';

import { buildWebSocketURL, getURLAndInit } from '../misc/request-helper';

const endpoint = '/connections';

const fetched = false;

interface Subscriber {
  listner: unknown; // on data received, listener will be called with data
  onClose: () => void; // on stream closed, onClose will be called
}

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
    remoteDestination: string;
    sourcePort: string;
    destinationPort: string;
    host: string;
    process?: string;
    processPath?: string;
    sniffHost?: string;
  };
  upload: number;
  download: number;
  // e.g. "2019-11-30T22:48:13.416668+08:00",
  start: string;
  chains: string[];
  // e.g. 'Match', 'DomainKeyword'
  rule: string;
  rulePayload?: string;
};
type ConnectionsData = {
  downloadTotal: number;
  uploadTotal: number;
  connections: Array<ConnectionItem>;
};
type tunConnectionItem = {
  id: UUID;
  metadata: {
    network: ConnNetwork;
    sourceIP: string;
    dialerIP: string;
    destinationIP: string;
    sourcePort: number;
    dialerPort: number;
    destinationPort: number;
  };
  upload: number;
  download: number;
  start: string;
};
type tunConnectionsData = {
  downloadTotal: number;
  uploadTotal: number;
  connections: Array<tunConnectionItem>;
};

function handleData(cs: ConnectionsData) {
  const url = 'http://10.0.0.2:9090/connections';
  fetch(url)
    .then((response) => response.json())
    .then((ts: tunConnectionsData) => {
      for (let i = 0; i < cs.connections.length; i++) {
        let cm = cs.connections[i].metadata;
        for (let j = 0; j < ts.connections.length; j++) {
          let tm = ts.connections[j].metadata;
          if (
            tm.network === cm.network &&
            tm.dialerPort.toString() === cm.sourcePort &&
            ((tm.network === 'tcp' && tm.dialerIP === cm.sourceIP) || tm.network === 'udp')
          ) {
            cm.sourceIP = tm.sourceIP;
            cm.sourcePort = tm.sourcePort.toString();
            break;
          }
        }
      }
    })
    .then(() => {
      subscribers.forEach((s) => s.listner(cs));
    })
    .catch((err) => {
      console.error('fetch error', err);
    });
}

function appendData(s: string) {
  let o: ConnectionsData;
  try {
    o = JSON.parse(s);
    o.connections?.forEach((conn) => {
      const m = conn.metadata;
      if (m.process == null) {
        if (m.processPath != null) {
          m.process = m.processPath.replace(/^.*[/\\](.*)$/, '$1');
        }
      }
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('JSON.parse error', err);
  }
  handleData(o);
}

type UnsubscribeFn = () => void;

let wsState: number;
export function fetchData(
  apiConfig: ClashAPIConfig,
  listener: unknown,
  onClose: () => void,
): UnsubscribeFn | void {
  if (fetched || wsState === 1) {
    if (listener)
      return subscribe({
        listner: listener,
        onClose,
      });
  }
  wsState = 1;
  const url = buildWebSocketURL(apiConfig, endpoint);
  const ws = new WebSocket(url);
  ws.addEventListener('error', () => {
    wsState = 3;
    subscribers.forEach((s) => s.onClose?.());
    subscribers.length = 0;
  });
  ws.addEventListener('close', () => {
    wsState = 3;
    subscribers.forEach((s) => s.onClose?.());
    subscribers.length = 0;
  });
  ws.addEventListener('message', (event) => appendData(event.data));
  if (listener)
    return subscribe({
      listner: listener,
      onClose,
    });
}

function subscribe(subscriber: Subscriber): UnsubscribeFn {
  subscribers.push(subscriber);
  return function unsubscribe() {
    const idx = subscribers.indexOf(subscriber);
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
