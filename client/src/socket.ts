import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    throw new Error('Socket not initialized. Call initSocket first.');
  }
  return socket;
}

export function initSocket(token: string): Socket {
  if (socket) {
    socket.disconnect();
  }
  socket = io(`http://${window.location.hostname}:3001`, {
    auth: { token },
    autoConnect: true,
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
