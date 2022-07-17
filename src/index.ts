import * as http from "http";
import * as path from "path";
import * as express from "express";
import { Server, Socket } from "socket.io";

import Room from "./room";
import User from "./user";

import { wrapperCallback } from "./utils";

import { Dictionary } from "./types";
import { CONST_STRINGS } from "./CONST_STRINGS";

const app = express();
const server = http.createServer(app);

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/socket.io.js", (_req, res) => {
  res.sendFile(
    path.join(__dirname, "../node_modules/socket.io/client-dist/socket.io.js")
  );
});

app.get("/RTCMultiConnection.js", (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/RTCMultiConnection.js"));
});

app.get("/socket.io.js.map", (_req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "../node_modules/socket.io/client-dist/socket.io.js.map"
    )
  );
});

app.get("/adapter.js", (_req, res) => {
  res.sendFile(
    path.join(__dirname, "../node_modules/webrtc-adapter/out/adapter.js")
  );
});

app.get("/FileBufferReader.js", (_req, res) => {
  res.sendFile(path.join(__dirname, "../node_modules/fbr/FileBufferReader.js"));
});

const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  const currentUser = new User(socket);

  // 내가 속하게될 방에 접속합니다.
  function joinARoom(message: Dictionary) {
    const room = Room.get(currentUser.admininfo.sessionid) as Room | null;

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
      const room = Room.get(roomId) as Room | null;

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
        return Room.removeById(room.roomId);
      }

      // 다음 룸 주인을 결정합니다.
      const nextOwner = User.get(
        room.participants.find(
          (pid) => !(pid === currentUser.userId || !User.get(pid))
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
      room.exit(currentUser.userId);
    } catch (e) {
      console.log("closeOrShiftRoom", e);
    }
  }

  // 내가 속한 룸의 데이터를 업데이트합니다.
  socket.on("extra-data-updated", function (extra) {
    try {
      currentUser.setExtra(extra, true);

      const roomId = currentUser.admininfo.sessionid;
      const room = Room.get(roomId) as Room | null;

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

    const room = Room.get(roomId) as Room;
    const active = Room.isActive(roomId);

    callback(active, roomId, active ? room.extra : Room.extra);
  });

  // 데이터 공유여부를 확인하고 정보를 공유합니다.
  socket.on("file-sharing-demo", function (message) {
    if (!message.remoteUserId || message.remoteUserId === currentUser.userId) {
      return;
    }

    // 새로운 참가자 요청일 경우 (보통 open-room or join-room 임)
    if (message.message.newParticipationRequest) {
      return joinARoom(message);
    }

    // sender 사용자가 존재하는 지 확인합니다.
    const sender = User.get(message.sender) as User | null;
    if (!sender) {
      currentUser.emit("user-not-found", message.sender);
      return;
    }

    // remoteUser 사용자가 존재하는 지 확인합니다.
    const remoteUser = User.get(message.remoteUserId) as User | null;

    // sender와 remoteUser 사용자간에 connectedWith로 이어줍니다.
    if (
      remoteUser &&
      !message.message.userLeft &&
      !sender.isConnectedWith(message.remoteUserId)
    ) {
      sender.connectedWith(message.remoteUserId, remoteUser.socket);
      sender.emit("user-connected", message.remoteUserId);

      remoteUser.connectedWith(message.sender, socket);
      remoteUser.emit("user-connected", message.sender);
    }

    // 연결되어있다면 데이터 공유를 합니다.
    if (sender.isConnectedWith(message.remoteUserId)) {
      sender.getConnectedWith(message.remoteUserId)?.emit("file-sharing-demo", {
        ...message,
        extra: currentUser.extra,
      });
    }
  });

  // 방을 새로 생성합니다.
  socket.on("open-room", function (arg, _callback = console.log) {
    const callback = wrapperCallback("open-room", _callback);

    // 이미 내가 다른 룸에 소속되어있다면 룸을 나가고 새로운 룸에 들어갈 준비를 합니다.
    closeOrShiftRoom();

    const room = Room.get(arg.sessionid) as Room | null;

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

    const room = Room.get(arg.sessionid) as Room | null;

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
    // 나와 연결된 사용자에게 룸을 나간다는 소식을 전합니다.
    currentUser?.emitAll("user-disconnected", (pid) => {
      (User.get(pid) as User)?.disconnectedWith(currentUser.userId);
      return [currentUser.userId];
    });

    // 룸을 나갑니다.
    closeOrShiftRoom();

    // 내 정보를 제거합니다.
    User.remove(currentUser);
  });
});

server.listen(9002);
