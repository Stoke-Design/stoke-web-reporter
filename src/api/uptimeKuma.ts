import { io, Socket } from 'socket.io-client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UKMonitor {
  id: number;
  name: string;
  type: string;
  url?: string;
  active: boolean;
  interval: number;
}

export interface UKHeartbeat {
  status: number;
  ping: number | null;
  time: string;
  msg?: string;
  duration?: number;
  down_count?: number;
}

interface UKCache {
  monitors: Record<string, UKMonitor>;
  heartbeatList: Record<string, UKHeartbeat[]>;
  fetchedAt: number;
}

// ── In-memory cache (60s TTL) ─────────────────────────────────────────────────

let cache: UKCache | null = null;
const CACHE_TTL_MS = 60_000;

/** Invalidate the cache — call this if credentials change */
export function clearUptimeKumaCache(): void {
  cache = null;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Connect to Uptime Kuma via Socket.IO, authenticate, and collect all monitor
 * and heartbeat data. Results are cached for 60 seconds to avoid hammering the
 * Socket.IO endpoint on every dashboard request.
 */
export async function getUptimeKumaData(
  baseUrl: string,
  username: string,
  password: string
): Promise<{ monitors: Record<string, UKMonitor>; heartbeatList: Record<string, UKHeartbeat[]> }> {
  // Serve from cache if still fresh
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache;
  }

  return new Promise((resolve, reject) => {
    const socket: Socket = io(baseUrl, {
      transports: ['websocket'],
      reconnection: false,
    });

    const monitors: Record<string, UKMonitor> = {};
    const heartbeatList: Record<string, UKHeartbeat[]> = {};
    let loginOk = false;
    let monitorListReceived = false;
    let finishTimer: ReturnType<typeof setTimeout> | null = null;

    // Abort if the whole flow takes too long
    const hardTimeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Uptime Kuma connection timed out after 15s'));
    }, 15_000);

    function finish() {
      if (finishTimer) return; // already scheduled
      // Wait for trailing heartbeatList events (one per monitor) to arrive
      finishTimer = setTimeout(() => {
        clearTimeout(hardTimeout);
        socket.disconnect();
        cache = { monitors, heartbeatList, fetchedAt: Date.now() };
        resolve({ monitors, heartbeatList });
      }, 2000);
    }

    // ── Connect ──────────────────────────────────────────────────────────────

    socket.on('connect', () => {
      socket.emit('login', { username, password }, (res: any) => {
        if (!res?.ok) {
          clearTimeout(hardTimeout);
          socket.disconnect();
          reject(new Error('Uptime Kuma login failed: ' + (res?.msg || 'invalid credentials')));
          return;
        }
        loginOk = true;
        // After successful login, Uptime Kuma auto-pushes monitorList and
        // heartbeatList events — no need to emit any further requests.
      });
    });

    // ── Monitor list (single event with all monitors as a keyed object) ──────

    socket.on('monitorList', (data: any) => {
      Object.assign(monitors, data);
      monitorListReceived = true;
      if (loginOk) finish();
    });

    // ── Heartbeat history (one event per monitor) ─────────────────────────────
    // Uptime Kuma emits: socket.emit("heartbeatList", monitorID, data, overwrite)
    // so the handler receives three separate arguments, NOT a single object.

    socket.on('heartbeatList', (monitorId: number, data: UKHeartbeat[], overwrite: boolean) => {
      if (monitorId != null) {
        const id = String(monitorId);
        if (overwrite || !heartbeatList[id]) {
          heartbeatList[id] = data ?? [];
        } else {
          heartbeatList[id] = [...(heartbeatList[id] || []), ...(data ?? [])];
        }
      }
      if (loginOk && monitorListReceived) finish();
    });

    // ── Errors ────────────────────────────────────────────────────────────────

    socket.on('connect_error', (err: Error) => {
      clearTimeout(hardTimeout);
      reject(new Error('Cannot connect to Uptime Kuma: ' + err.message));
    });

    socket.on('disconnect', (reason: string) => {
      // If we haven't resolved yet, treat unexpected disconnect as an error
      if (!finishTimer) {
        clearTimeout(hardTimeout);
        reject(new Error('Uptime Kuma disconnected unexpectedly: ' + reason));
      }
    });
  });
}
