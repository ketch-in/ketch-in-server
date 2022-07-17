import { Socket } from "socket.io";
import Item from "./item";
import { Dictionary } from "./types";
import { parseExtra } from "./utils";

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
}
