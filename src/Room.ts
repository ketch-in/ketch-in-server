import User from "./User";
import { logs } from "./utils";

interface RoomOptions {
  maxParticipantsAllowed?: string;
}

export default class Room {
  static rooms: { [roomId: string]: Room } = {};

  static isAlreadyRoomId(roomId: string): boolean {
    return Object.keys(this.rooms).includes(roomId);
  }

  static get(roomId: string): Room | null {
    if (Object.keys(this.rooms).includes(roomId)) {
      return this.rooms[roomId];
    }
    return null;
  }

  static add(room: Room): void {
    if (Object.keys(this.rooms).includes(room.roomId)) {
      logs("Room > add", `already ${room.roomId}`);
      return;
    }
    this.rooms[room.roomId] = room;
  }

  static remove(roomId: string): void {
    this.get(roomId)?.disconnect();
    if (Object.keys(this.rooms).includes(roomId)) {
      logs("Room > remove", `already removed ${roomId}`);
      return;
    }
    delete this.rooms[roomId];
  }

  owner: string;
  extra: { [key: string]: unknown };
  identifier: string;
  roomId: string;
  participants: string[];
  options: RoomOptions;
  session: {
    audio?: boolean;
    video?: boolean;
    oneway?: boolean;
    broadcast?: boolean;
    scalable?: boolean;
  };
  socketMessageEvent?: string;
  socketCustomEvent?: string;
  password?: string;

  constructor(roomId: string, options: RoomOptions = {}) {
    this.roomId = roomId;
    this.participants = [];
    this.extra = {};
    this.owner = "";
    this.options = options;
    this.session = {};
    this.identifier = "";

    Room.add(this);
  }

  join(userId: string): void {
    const user = User.getUser(userId);
    if (this.participants.includes(userId) || !user) {
      return;
    }
    user.roomId = this.roomId;
    this.participants.push(userId);
  }

  exit(userId: string): void {
    if (!this.participants.includes(userId)) {
      return;
    }
    this.participants = this.participants.filter((id) => id !== userId);
  }

  addParticipants(userId: string): void {
    if (this.participants.includes(userId)) {
      return;
    }
    this.participants.push(userId);
  }

  setOwner(owner: string): void {
    this.owner = owner;
    this.addParticipants(owner);
  }

  getOwner(): string {
    return this.owner;
  }

  get maxParticipantsAllowed(): number {
    return parseInt(this.getOption("maxParticipantsAllowed") || "1000") || 1000;
  }

  get isFull(): boolean {
    return this.maxParticipantsAllowed < this.participants.length;
  }

  get isEmpty(): boolean {
    return this.participants.length === 0;
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  getOption(name: keyof RoomOptions) {
    return this.options[name];
  }

  setExtra(extra: any): void {
    if (typeof extra !== "object" || !extra) {
      this.extra = {
        value: extra,
      };
      return;
    }
    this.extra = extra;
  }

  getExtra(): { [key: string]: unknown } {
    return {
      ...this.extra,
      _room: {
        isFull: this.isFull,
        isPasswordProtected: false,
      },
    };
  }

  disconnect(): void {
    this.participants.forEach((userId) => User.getUser(userId)?.remove());
    this.participants = [];
  }
}
