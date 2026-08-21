import { Server as SocketIOServer } from 'socket.io';

declare global {
  // Global Socket.IO Server instance
  var io: any;
  // Global In-Memory connected devices map
  var connectedDevices: Map<string, any> | undefined;
  // Global In-Memory virtual printer tickets
  var virtualPrinterHistory: any[] | undefined;
}

export {};
