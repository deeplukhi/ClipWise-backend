import { Server as HTTPServer } from 'http';
import { Server } from 'socket.io';
import { env } from '@/config/env.config';

let io: Server;

export function initSocket(httpServer: HTTPServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    socket.on('join-job', (jobId: string) => {
      socket.join(`job:${jobId}`);
    });
  });

  return io;
}

export function getIO(): Server {
  return io;
}
