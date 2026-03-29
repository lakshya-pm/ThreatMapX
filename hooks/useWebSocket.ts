import { useEffect, useState, useRef, useCallback } from 'react';
import { AttackEvent } from '../types/attack';

export function useWebSocket(url: string) {
  const [attacks, setAttacks] = useState<AttackEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      if (isPaused) {
        ws.send(JSON.stringify({ type: 'pause' }));
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'attack') {
          setAttacks(prev => {
            // Keep the latest 300 to manage memory
            const newArray = [message.data as AttackEvent, ...prev];
            return newArray.slice(0, 300);
          });
        }
      } catch (e) {
        console.error("Failed to parse websocket message", e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = (err) => {
      ws.close();
    };
  }, [url, isPaused]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null; 
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  const togglePause = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      if (isPaused) {
        wsRef.current.send(JSON.stringify({ type: 'resume' }));
        setIsPaused(false);
      } else {
        wsRef.current.send(JSON.stringify({ type: 'pause' }));
        setIsPaused(true);
      }
    }
  }, [isPaused]);

  return { attacks, isConnected, isPaused, togglePause };
}
