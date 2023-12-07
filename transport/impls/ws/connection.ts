import { TransportClientId } from '../../message';
import { Connection, Transport } from '../../transport';
import WebSocket from 'isomorphic-ws';

export class WebSocketConnection extends Connection {
  ws: WebSocket;

  constructor(
    transport: Transport<WebSocketConnection>,
    connectedTo: TransportClientId,
    ws: WebSocket,
  ) {
    super(transport, connectedTo);
    this.ws = ws;
    ws.binaryType = 'arraybuffer';

    // Bun ws.onmessage currently does not work (as of v1.0.15), so we must use
    // ws.on('message'). @see https://github.com/oven-sh/bun/issues/4529#issuecomment-1789580327
    ws.on('message', (data) => {
      this.onMessage(
        new Uint8Array(Array.isArray(data) ? Buffer.concat(data) : data),
      );
    });
  }

  send(payload: Uint8Array) {
    // Bun ws.OPEN seems to be unimplemented, so we use the static value instead
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
      return true;
    } else {
      return false;
    }
  }

  async close() {
    this.ws.close();
  }
}
