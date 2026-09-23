import { AppState, ServerEvent, ServerMessage } from '../../shared/types';

// ============================================================================
// Client sync. Clients render AppState and nothing else:
//   - any change to runtime state or config calls changed();
//   - the server then rebuilds the whole AppState and sends it to every client;
//   - a client that connects gets it the same way, so connect, reconnect and
//     server restart need no special handling.
// Changes made in the same turn of the event loop go out as one message, and
// builds never overlap, so the last message a client receives is always the
// current state. One-off effects go out immediately with notify(). A
// heartbeat every HEARTBEAT_MS lets clients spot a dead link (see GameContext).
// ============================================================================

export interface Client {
  readyState: number;
  send(data: string): void;
}

const OPEN = 1;
export const HEARTBEAT_MS = 10_000;

export class Sync {
  private readonly clients = new Set<Client>();
  private dirty = false;
  private sending = false;

  constructor(private readonly build: () => AppState | Promise<AppState>) {}

  connect(client: Client): void {
    this.clients.add(client);
    this.changed();
  }

  disconnect(client: Client): void {
    this.clients.delete(client);
  }

  /** State changed: every client gets a fresh snapshot shortly. */
  changed(): void {
    this.dirty = true;
    if (this.sending) return; // the running loop picks it up
    this.sending = true;
    setImmediate(() => void this.flush());
  }

  /** Tell every client the link is alive. */
  heartbeat(): void {
    this.send({ type: 'HEARTBEAT' });
  }

  /** Send a one-off effect to every client. */
  notify(event: ServerEvent): void {
    this.send(event);
  }

  private async flush(): Promise<void> {
    try {
      while (this.dirty) {
        this.dirty = false;
        this.send({ type: 'STATE', payload: await this.build() });
      }
    } catch (err) {
      console.error('Failed to build the client state:', err);
    } finally {
      this.sending = false;
    }
  }

  private send(message: ServerMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === OPEN) client.send(data);
    }
  }
}
