import { Socket } from "socket.io";

import Item from "./item";
import Room from "./room";

import { parseExtra } from "./utils";

import { Dictionary } from "./types";

export default class User extends Item {
  socket: Socket;
  _extra: Dictionary;
  _admininfo: Dictionary;
  _connectedWith: { [userId: string]: Socket };

  constructor(socket: Socket) {
    super(socket.handshake.query.userid as string);

    this.socket = socket;

    if (this.userId !== this.params.userid) {
      // id가 변경되었을 경우 클라이언트에 고지
      socket.emit("userid-already-taken", this.params.userid, this.userId);
    }

    this._extra = parseExtra(this.params.extra);
    this._connectedWith = {};
    this._admininfo = {};
  }

  emit(ev: string, ...args: unknown[]): void {
    this.socket.emit(ev, ...args);
  }

  emitAll(ev: string, getArgs: (userId: string) => unknown[] = () => []): void {
    Object.keys(this._connectedWith).forEach((userId) => {
      try {
        this._connectedWith[userId].emit(ev, ...getArgs(userId));
      } catch (e) {
        console.log(ev, "connectedWith", e);
      }
    });
  }

  connectedWith(userId: string, socket: Socket): void {
    if (this._connectedWith[userId]) {
      return;
    }
    this._connectedWith[userId] = socket;
  }

  getConnectedWith(userId: string): Socket | undefined {
    return this._connectedWith[userId];
  }

  isConnectedWith(userId: string): boolean {
    return !!this._connectedWith[userId];
  }

  disconnectedWith(userId: string): void {
    if (!this._connectedWith[userId]) {
      return;
    }
    delete this._connectedWith[userId];
  }

  get extra(): Dictionary {
    return this._extra;
  }

  destroy(): void {
    this.closeOrShiftRoom();
  }

  setExtra(extra: unknown, isEmit = false): void {
    this._extra = parseExtra(extra);
    if (isEmit) {
      this.admininfo.extra = this._extra;
      this.emitAll("extra-data-updated", () => [this.id, this._extra]);
    }
  }

  get admininfo(): Dictionary {
    return this._admininfo;
  }

  set admininfo(adminInfo: Dictionary) {
    // 이미 내가 다른 룸에 소속되어있다면 룸을 나가고 새로운 룸에 들어갈 준비를 합니다.
    this.closeOrShiftRoom();
    this._admininfo = { ...adminInfo };
  }

  get userId(): string {
    return this.id;
  }

  get params(): NodeJS.Dict<string> {
    return this.socket.handshake.query as NodeJS.Dict<string>;
  }

  get maxParticipantsAllowed(): number {
    return parseInt(this.params.maxParticipantsAllowed || "0") || 1000;
  }

  closeOrShiftRoom(): void {
    try {
      const roomId = this.admininfo.sessionid;
      const room = Room.get(roomId) as Room | null;

      // 룸이 이미 존재하지 않으면 종료합니다.
      if (!room) {
        return;
      }

      // 만약 내가 룸의 소유자가 아니면 룸에서 나가기만 한다.
      if (!room.isOwner(this)) {
        return room.exit(this.userId);
      }

      // 만약 내가 소유자인데 나만 있었으면 룸도 함께 삭제합니다.
      if (room.isOnlyOwner || room.isEmpty) {
        return Room.removeById(room.roomId);
      }

      // 다음 룸 주인을 결정합니다.
      const nextOwner = User.get(
        room.participants.find(
          (pid) => !(pid === this.userId || !User.get(pid))
        )
      ) as User | null;

      // 만약 다른 사용자가 없다면 룸을 삭제합니다.
      if (!nextOwner) {
        return Room.removeById(room.roomId);
      }

      // 새로운 룸의 주인이 나타났습니다.
      room.owner = nextOwner.userId;

      // redundant?
      nextOwner.emit("set-isInitiator-true", roomId);

      // 나는 빠져나갑니다.
      room.exit(this.userId);
    } catch (e) {
      console.log("closeOrShiftRoom", e);
    }
  }
}
