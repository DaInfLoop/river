import { Codec, NaiveJsonCodec } from '../../../codec';
import { log } from '../../../logging';
import { TransportClientId } from '../../message';
import { Transport } from '../../transport';
import { Server } from 'ws';
import { WebSocketConnection } from './connection';

interface Options {
  codec: Codec;
}

const defaultOptions: Options = {
  codec: NaiveJsonCodec,
};

export class WebSocketServerTransport extends Transport<WebSocketConnection> {
  wss: Server;
  clientId: TransportClientId;

  constructor(
    wss: Server,
    clientId: TransportClientId,
    providedOptions?: Partial<Options>,
  ) {
    const options = { ...defaultOptions, ...providedOptions };
    super(options.codec, clientId);
    this.wss = wss;
    this.clientId = clientId;
    this.setupConnectionStatusListeners();
  }

  setupConnectionStatusListeners(): void {
    this.wss.on('connection', (ws) => {
      let conn: WebSocketConnection | undefined = undefined;

      // This message handler is used to set up a WebSocketConnection. The
      // connection sets up its own message listener that handles
      // processing messages after it has been set up.
      // I think ideally we don't have two listeners, processing `message`,
      // especially since this listener must process the _first_ message
      // while the connection is still being setup.

      // Also, we use `ws.on('message')` instead of `ws.onmessage` because
      // Bun incorrectly implements `ws.onmessage`.
      // @see https://github.com/oven-sh/bun/issues/4529#issuecomment-1789580327

      ws.on('message', (data) => {
        console.log('Conn number ' + closed);
        const message = new Uint8Array(
          Array.isArray(data) ? Buffer.concat(data) : data,
        );

        // If we don't already have a connection, set one up for this ws
        if (!conn) {
          const parsed = this.parseMsg(message);
          if (parsed) {
            conn = new WebSocketConnection(this, parsed.from, ws);
            this.onConnect(conn);
            conn.onMessage(message);
          }
        }
      });

      // close is always emitted, even on error, ok to do cleanup here
      ws.onclose = () => {
        ws.removeAllListeners('message');
        if (conn) {
          this.onDisconnect(conn);
          conn = undefined;
        }
      };

      ws.onerror = (msg) => {
        log?.warn(
          `${this.clientId} -- ws error from client ${
            conn?.connectedTo ?? 'unknown'
          }: ${msg}`,
        );
      };
    });
  }

  async createNewConnection(to: string) {
    const err = `${this.clientId} -- failed to send msg to ${to}, client probably dropped`;
    log?.warn(err);
    return;
  }

  async destroy() {
    super.destroy();
    this.wss.close();
  }

  async close() {
    super.close();
    this.wss.close();
  }
}
