import { useEffect, useRef } from 'react';
import { debateStreamUrl } from '../api/debates';
import type { DebateTerminalEvent, Turn, TurnDeltaEvent, TurnStartedEvent } from '../api/types';

export interface StreamHandlers {
  onDebateStarted?: () => void;
  onTurnStarted?: (e: TurnStartedEvent) => void;
  onTurnDelta?: (e: TurnDeltaEvent) => void;
  onTurnCompleted?: (turn: Turn) => void;
  onTurnError?: (turn: Turn) => void;
  onDebateCompleted?: (e: DebateTerminalEvent) => void;
  onDebateError?: (e: DebateTerminalEvent) => void;
  onDebateStopped?: (e: DebateTerminalEvent) => void;
  /** Fired when the browser re-established a dropped connection. */
  onReconnect?: () => void;
}

const TERMINAL_EVENTS = ['debate_completed', 'debate_error', 'debate_stopped'] as const;

/**
 * Subscribe to a debate's Server-Sent Events while `enabled` is true.
 * Handlers are read through a ref so the subscription survives re-renders.
 */
export function useDebateStream(
  debateId: string | undefined,
  enabled: boolean,
  handlers: StreamHandlers,
) {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!debateId || !enabled) return;

    const source = new EventSource(debateStreamUrl(debateId));
    let wasDisconnected = false;

    const on = <T,>(event: string, handler: (payload: T) => void) => {
      source.addEventListener(event, (e) => {
        try {
          handler(JSON.parse((e as MessageEvent).data) as T);
        } catch (err) {
          console.error(`Failed to handle SSE event "${event}"`, err);
        }
      });
    };

    source.onopen = () => {
      if (wasDisconnected) {
        wasDisconnected = false;
        handlersRef.current.onReconnect?.();
      }
    };
    source.onerror = () => {
      // EventSource reconnects automatically; remember so we can resync state.
      wasDisconnected = true;
    };

    on<unknown>('debate_started', () => handlersRef.current.onDebateStarted?.());
    on<TurnStartedEvent>('turn_started', (e) => handlersRef.current.onTurnStarted?.(e));
    on<TurnDeltaEvent>('turn_delta', (e) => handlersRef.current.onTurnDelta?.(e));
    on<Turn>('turn_completed', (t) => handlersRef.current.onTurnCompleted?.(t));
    on<Turn>('turn_error', (t) => handlersRef.current.onTurnError?.(t));

    const terminal: Record<(typeof TERMINAL_EVENTS)[number], (e: DebateTerminalEvent) => void> = {
      debate_completed: (e) => handlersRef.current.onDebateCompleted?.(e),
      debate_error: (e) => handlersRef.current.onDebateError?.(e),
      debate_stopped: (e) => handlersRef.current.onDebateStopped?.(e),
    };
    for (const event of TERMINAL_EVENTS) {
      on<DebateTerminalEvent>(event, (e) => {
        // The server closes the stream; close here too so EventSource doesn't reconnect.
        source.close();
        terminal[event](e);
      });
    }

    return () => source.close();
  }, [debateId, enabled]);
}
