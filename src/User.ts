import { Socket } from "socket.io";
import Room from "./Room";
import { logs, parseExtra, toBoolean } from "./utils";

export default class User {
  static users: { [userId: string]: User } = {};

  static createNewId(): string {
    const newUserId = (Math.random() * 100).toString().replace(".", "");
    if (Object.keys(this.users).includes(newUserId)) {
      return this.createNewId();
    }
    return newUserId;
  }

  static getUser(userId: string): User | null {
    if (Object.keys(this.users).includes(userId)) {
      return this.users[userId];
    }
    return null;
  }

  static addUser(user: User): void {
    if (Object.keys(this.users).includes(user.userId)) {
      logs("User > addUser", `already ${user.userId}`);
      return;
    }
    this.users[user.userId] = user;
  }

  static removeUser(userId: string): void {
    if (Object.keys(this.users).includes(userId)) {
      logs("User > removeUser", `already Remove ${userId}`);
    }
    delete this.users[userId];
  }

  extra: { [key: string]: unknown };
  userId: string;
  params: { [key: string]: unknown };
  socket: Socket;
  roomId: string;
  admininfo: any;
  autoCloseEntireSession: boolean;
  socketMessageEvent: string;
  socketCustomEvent: string;

  constructor(socket: Socket) {
    this.socket = socket;
    this.params = socket.handshake.query;
    this.extra = parseExtra(this.params);
    this.userId = User.createNewId();
    this.roomId = "";
    this.admininfo = {};
    this.autoCloseEntireSession = toBoolean(this.params.autoCloseEntireSession);
    this.socketCustomEvent = (this.params.socketCustomEvent as string) || "";
    this.socketMessageEvent =
      (this.params.msgEvent as string) || "custom-message";

    User.addUser(this);
  }

  setExtra(extra: { [key: string]: unknown }): void {
    this.extra = extra;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit(ev: string, ...args: any[]): void {
    console.log(ev, ...args);
    this.socket.emit(ev, ...args);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connectedEmit(ev: string, getArgs: (userId: string) => any[]): void {
    this.connectedWith.forEach((userId: string) => {
      try {
        const user = User.getUser(userId);
        if (user) {
          user.emit(ev, ...getArgs(userId));
        }
      } catch (e) {
        logs("User > emit", e);
      }
    });
  }

  get connectedWith(): string[] {
    const room = Room.get(this.roomId);
    if (!room) {
      return [];
    }
    return room.participants.filter((userId) => userId !== this.userId);
  }

  remove(): void {
    Room.get(this.roomId)?.exit(this.userId);
    this.socket.disconnect();
    User.removeUser(this.userId);
  }
}
