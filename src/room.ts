import Item from "./item";
import { Dictionary } from "./types";
import User from "./user";
import { parseExtra } from "./utils";

interface RoomArgs {
  id: string;
  owner: string;
  extra: Dictionary;
  maxParticipantsAllowed: number;
}

export default class Room extends Item {
  static join(roomId: string, userId: string): boolean {
    const room = Room.get(roomId) as Room;
    if (!room) {
      return false;
    }
    room.join(userId);
    return true;
  }

  static get extra(): Dictionary {
    return {
      _room: {
        isFull: false,
        isPasswordProtected: false,
      },
    };
  }

  static isActive(roomId: string): boolean {
    const room = this.get(roomId) as Room;
    return !!room && !room.isEmpty;
  }

  owner: string;
  _extra: Dictionary;
  participants: string[];
  maxParticipantsAllowed: number;

  constructor({ id, owner, extra, maxParticipantsAllowed }: RoomArgs) {
    super(id);
    this.owner = owner;
    this._extra = parseExtra(extra);
    this.participants = [owner];
    this.maxParticipantsAllowed = maxParticipantsAllowed;
  }

  get roomId(): string {
    return this.id;
  }

  emitAll(
    ev: string,
    getArgs: (userId: string) => unknown[] | null = () => []
  ): void {
    this.participants.forEach((pid) => {
      const user = User.get(pid) as User;
      if (!user) {
        return;
      }
      try {
        const args = getArgs(pid);
        if (args === null) {
          return;
        }
        user.emit(ev, ...args);
      } catch (e) {
        console.log("participants", e);
      }
    });
  }

  join(userId: string): void {
    if (this.participants.includes(userId)) {
      return;
    }
    this.participants.push(userId);
  }

  exit(userId: string): void {
    if (!this.isJoinUser(userId)) {
      return;
    }
    this.participants = this.participants.filter(
      (id) => id !== userId && User.get(id)
    );
  }

  isJoinUser(userId: string): boolean {
    return this.participants.includes(userId);
  }

  isOwner(user: User): boolean {
    return this.isOwnerById(user.userId);
  }

  isOwnerById(userId: string): boolean {
    return this.owner === userId;
  }

  get extra(): Dictionary {
    return { ...this._extra, _room: { isFull: this.isFull } };
  }

  set extra(extra: Dictionary) {
    this._extra = parseExtra(extra);
  }

  get isFull(): boolean {
    return this.maxParticipantsAllowed <= this.participants.length;
  }

  get isEmpty(): boolean {
    return this.participants.length === 0;
  }

  get isOnlyOwner(): boolean {
    return this.isJoinUser(this.owner) && this.participants.length === 1;
  }
}
