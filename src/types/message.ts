import { MessageType } from '../core/interfaces';

export interface IMessage {
  id: string;
  type: MessageType;
  sender: string;
  receiver: string;
  payload: any;
  timestamp: number;
  metadata?: {
    priority?: number;
    requiresAck?: boolean;
    ttl?: number;
  };
  timeout?: number;
}
