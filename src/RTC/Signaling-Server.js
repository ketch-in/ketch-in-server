import { CONST_STRINGS } from "./CONST_STRINGS";

function parseExtra({ extra }) {
  if (!extra) {
    return {};
  }
  if (typeof extra === "object") {
    return extra;
  }
  if (typeof extra === "string") {
    try {
      return JSON.parse(extra);
    } catch {
      console.log("parseExtra > JSON Parse Error");
    }
  }
  return {
    value: extra,
  };
}

function wrapperCallback(title, callback = console) {
  return (...args) => {
    try {
      callback(...args);
    } catch (e) {
      console.log(title, e);
    }
  };
}

class Item {
  static items = {};

  static add(item) {
    if (this.items[item.id]) {
      return this;
    }
    this.items[item.id] = item;
    return this;
  }

  static remove(item) {
    return this.removeById(item.id);
  }

  static removeById(id) {
    if (!this.items[id]) {
      return this;
    }
    delete this.items[id];
    return this;
  }

  static get(id) {
    if (!this.items[id]) {
      return null;
    }
    return this.items[id];
  }

  static createId(id) {
    if (!id) {
      return this.createId((Math.random() * 1000).toString().replace(".", ""));
    }
    return this.items[id] ? this.createId() : id;
  }

  constructor(id) {
    this.id = Item.createId(id);
    Item.add(this);
  }
}

class User extends Item {
  constructor(socket) {
    super(socket.handshake.query.userid);

    this.socket = socket;

    if (this.userId !== this.params.userid) {
      // id가 변경되었을 경우 클라이언트에 고지
      socket.emit("userid-already-taken", this.params.userid, this.userId);
    }

    this._extra = parseExtra(this.params);
    this.connectedWith = {};
    this._admininfo = {};
  }

  emit(ev, ...args) {
    this.socket.emit(ev, ...args);
  }

  emitAll(ev, getArgs = () => []) {
    Object.keys(this.connectedWith).forEach((userId) => {
      try {
        this.connectedWith[userId].emit(ev, ...getArgs(userId));
      } catch (e) {
        console.log(ev, "connectedWith", e);
      }
    });
  }

  connectedWith(userId, socket) {
    if (this.connectedWith[userId]) {
      return;
    }
    this.connectedWith[userId] = socket;
  }

  disconnectedWith(userId) {
    if (!this.connectedWith[userId]) {
      return;
    }
    delete this.connectedWith[userId];
  }

  get extra() {
    return this._extra;
  }

  setExtra(extra, isEmit = false) {
    this._extra = parseExtra(extra);
    if (isEmit) {
      this.admininfo.extra = this._extra;
      this.emitAll("extra-data-updated", () => [this.id, this._extra]);
    }
  }

  get admininfo() {
    return this._admininfo;
  }

  set admininfo(adminInfo) {
    this._admininfo = { ...adminInfo };
  }

  get userId() {
    return this.id;
  }

  get socketCustomEvent() {
    return this.params.socketCustomEvent || "";
  }

  get params() {
    return this.socket.handshake.query;
  }

  get maxParticipantsAllowed() {
    return parseInt(this.params.maxParticipantsAllowed || "0") || 1000;
  }
}

class Room extends Item {
  static join(roomId, userId) {
    const room = Room.get(roomId);
    if (!room) {
      return false;
    }
    room.join(userId);
    return true;
  }

  static get extra() {
    return {
      _room: {
        isFull: this.isFull,
        isPasswordProtected: false,
      },
    };
  }

  static isActive(roomId) {
    const room = this.get(roomId);
    return room && !room.isEmpty;
  }

  constructor({ id, owner, extra, socketCustomEvent, maxParticipantsAllowed }) {
    super(id);
    this.owner = owner;
    this._extra = parseExtra(extra);
    this.participants = [owner];
    this.socketCustomEvent = socketCustomEvent;
    this.maxParticipantsAllowed = maxParticipantsAllowed;
  }

  get roomId() {
    return this.id;
  }

  emitAll(ev, getArgs = () => []) {
    this.participants.forEach((pid) => {
      const user = User.get(pid);
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

  join(userId) {
    if (this.participants.includes(userId)) {
      return;
    }
    this.participants.push(userId);
  }

  exit(userId) {
    if (!this.isJoinUser(userId)) {
      return;
    }
    this.participants = this.participants.filter(
      (id) => id !== userId && User.get(id)
    );
  }

  isJoinUser(userId) {
    return this.participants.includes(userId);
  }

  isOwner(user) {
    return this.isOwnerById(user.userId);
  }

  isOwnerById(userId) {
    return this.owner === userId;
  }

  get extra() {
    return { ...this._extra, _room: { isFull: this.isFull } };
  }

  set extra(extra) {
    this._extra = parseExtra(extra);
  }

  get isFull() {
    return this.maxParticipantsAllowed <= this.participants.length;
  }

  get isEmpty() {
    return this.participants.length === 0;
  }

  get isOnlyOwner() {
    return this.isJoinUser(this.owner) && this.participants.length === 1;
  }
}

export default function (socket) {
  const currentUser = new User(socket);

  socket.on("extra-data-updated", function (extra) {
    try {
      if (!currentUser) return;

      currentUser.setExtra(extra, true);

      const roomId = currentUser.admininfo.sessionid;
      const room = Room.get(roomId);

      if (!room) {
        return;
      }
      if (room.isOwner(currentUser)) {
        // room's extra must match owner's extra
        room.extra = extra;
      }
      room.emitAll("extra-data-updated", () => [currentUser.userId, extra]);
    } catch (e) {
      console.log("extra-data-updated", e);
    }
  });

  // 방을 새로 생성할지, 아니면 기존 방에 접속하는 형태인지 지정
  socket.on("check-presence", function (roomId, _callback) {
    const callback = wrapperCallback("open-room", _callback);

    const room = Room.get(roomId);
    const active = Room.isActive(roomId);

    callback(active, roomId, active ? room.extra : Room.extra);
  });

  function onMessageCallback(message) {
    try {
      if (!User.get(message.sender)) {
        currentUser.socket.emit("user-not-found", message.sender);
        return;
      }

      // we don't need "connectedWith" anymore
      // todo: remove all these redundant codes
      // fire "onUserStatusChanged" for room-participants instead of individual users
      // rename "user-connected" to "user-status-changed"
      if (
        !message.message.userLeft &&
        !User.get(message.sender).connectedWith[message.remoteUserId] &&
        !!User.get(message.remoteUserId)
      ) {
        User.get(message.sender).connectedWith[message.remoteUserId] = User.get(
          message.remoteUserId
        ).socket;
        User.get(message.sender).socket.emit(
          "user-connected",
          message.remoteUserId
        );

        if (!User.get(message.remoteUserId)) {
          console.log("oh!");
        }

        User.get(message.remoteUserId).connectedWith[message.sender] = socket;

        if (User.get(message.remoteUserId).socket) {
          User.get(message.remoteUserId).socket.emit(
            "user-connected",
            message.sender
          );
        }
      }

      if (
        User.get(message.sender) &&
        User.get(message.sender).connectedWith[message.remoteUserId] &&
        currentUser
      ) {
        message.extra = currentUser.extra;
        User.get(message.sender).connectedWith[message.remoteUserId].emit(
          "file-sharing-demo",
          message
        );
      }
    } catch (e) {
      console.log("onMessageCallback", e);
    }
  }

  // 내가 속하게될 방에 접속합니다.
  function joinARoom(message) {
    const room = Room.get(currentUser.admininfo.sessionid);

    // 아직 내가 속한 방이 없다면 대기합니다.
    if (!room) {
      return;
    }

    // 만약 내가 속한 방이 만약 꽉찬 상태라면, 반환합니다.
    if (room.isFull && !room.isJoinUser(currentUser.userId)) {
      return;
    }

    // redundant?
    Room.join(room.roomId, currentUser.userId);

    // connect with all participants
    room.emitAll("file-sharing-demo", (pid) =>
      pid === currentUser.userId ? null : [{ ...message, remoteUserId: pid }]
    );
  }

  // room에서 나가기전에, 내가 소유자였으면 다른 사람에게 양도하거나 room을 제거합니다.
  function closeOrShiftRoom() {
    try {
      const roomId = currentUser.admininfo.sessionid;
      const room = Room.get(roomId);

      // 룸이 이미 존재하지 않으면 종료합니다.
      if (!room) {
        return;
      }

      // 만약 내가 룸의 소유자가 아니면 룸에서 나가기만 한다.
      if (!room.isOwner(currentUser)) {
        return room.exit(currentUser.userId);
      }

      // 만약 내가 소유자인데 나만 있었으면 룸도 함께 삭제합니다.
      if (room.isOnlyOwner || room.isEmpty) {
        return Room.removeById(roomId);
      }

      // 다음 룸 주인을 결정합니다.
      const nextOwner = User.get(
        room.participants.find(
          (pid) => !(pid === currentUser.userId || !User.get(pid))
        )
      );

      // 만약 다른 사용자가 없다면 룸을 삭제합니다.
      if (!nextOwner) {
        return Room.removeById(roomId);
      }

      // 새로운 룸의 주인이 나타났습니다.
      room.owner = nextOwner.userId;

      // redundant?
      nextOwner.emit("set-isInitiator-true", roomId);

      // 나는 빠져나갑니다.
      room.exit(currentUser.userId);
    } catch (e) {
      console.log("closeOrShiftRoom", e);
    }
  }

  socket.on("file-sharing-demo", function (message) {
    if (!message.remoteUserId || message.remoteUserId === currentUser.userId) {
      return;
    }

    if (message.message.newParticipationRequest) {
      return joinARoom(message);
    }

    onMessageCallback(message);
  });

  // 방을 새로 생성합니다.
  socket.on("open-room", function (arg, _callback = console.log) {
    const callback = wrapperCallback("open-room", _callback);

    // 이미 내가 다른 룸에 소속되어있다면 룸을 나가고 새로운 룸에 들어갈 준비를 합니다.
    closeOrShiftRoom();

    const room = Room.get(arg.sessionid);

    // 룸이 이미 존재하다면 종료합니다.
    if (room && !room.isEmpty) {
      return callback(false, CONST_STRINGS.ROOM_NOT_AVAILABLE);
    }

    // 내 extra 데이터를 업데이트합니다.
    currentUser.setExtra(arg.extra);

    // 새로운 룸을 생성합니다.
    new Room({
      id: arg.sessionid,
      owner: currentUser.userId,
      ...arg,
      socketCustomEvent: currentUser.socketCustomEvent,
      maxParticipantsAllowed: currentUser.maxParticipantsAllowed,
    });

    // 나한테 RTC 정보를 저장합니다.
    currentUser.admininfo = arg;

    callback(true);
  });

  // 룸에 들어갑니다.
  socket.on("join-room", function (arg, _callback = console.log) {
    const callback = wrapperCallback("join-room", _callback);

    // 이미 내가 다른 룸에 소속되어있다면 룸을 나가고 새로운 룸에 들어갈 준비를 합니다.
    closeOrShiftRoom();

    // 내 extra 데이터를 업데이트합니다.
    currentUser.setExtra(arg.extra);

    const room = Room.get(arg.sessionid);

    // 룸이 존재하지 않을 경우 접속하지 않습니다.
    if (!room) {
      return callback(false, CONST_STRINGS.ROOM_NOT_AVAILABLE);
    }

    // 룸 한동에 도달했으면 더 이상 진행하지 않습니다.
    if (room.isFull) {
      return callback(false, CONST_STRINGS.ROOM_FULL);
    }

    // 룸에 가입합니다.
    Room.join(arg.sessionid, currentUser.userId);

    // 나한테 RTC 정보를 저장합니다.
    currentUser.admininfo = arg;

    callback(true);
  });

  // 룸에 나갑니다.
  socket.on("disconnect", function () {
    try {
      if (socket && socket.namespace && socket.namespace.sockets) {
        delete socket.namespace.sockets[this.id];
      }
    } catch (e) {
      console.log("disconnect", e);
    }

    // 나와 연결된 사용자에게 룸을 나간다는 소식을 전합니다.
    currentUser?.emitAll("user-disconnected", (pid) => {
      User.get(pid)?.disconnectedWith(currentUser.userId);
      return [currentUser.userId];
    });

    // 룸을 나갑니다.
    closeOrShiftRoom();

    // 내 정보를 제거합니다.
    User.remove(currentUser.userId);
  });
}
