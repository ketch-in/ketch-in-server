import * as http from "http";
import * as express from "express";
import { Server } from "socket.io";

import Room from "./room";
import User from "./user";

import { wrapperCallback } from "./utils";

import { ERROR_MESSAGES } from "./constants";

const app = express();

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
io.on("connection", (socket) => {
  const currentUser = new User(socket);

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

  // 데이터 공유여부를 확인하고 정보를 공유합니다. (커스텀 소켓)
  socket.on("data-sharing", function (message) {
    if (!message.remoteUserId || message.remoteUserId === currentUser.userId) {
      return;
    }

    // 새로운 참가자 요청일 경우 (보통 open-room or join-room 임)
    if (message.message.newParticipationRequest) {
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
      room.emitAll("data-sharing", (pid) =>
        pid === currentUser.userId ? null : [{ ...message, remoteUserId: pid }]
      );
      return;
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
      sender.getConnectedWith(message.remoteUserId)?.emit("data-sharing", {
        ...message,
        extra: currentUser.extra,
      });
    }
  });

  // 방을 새로 생성합니다.
  socket.on("open-room", function (arg, _callback = console.log) {
    const callback = wrapperCallback("open-room", _callback);

    const room = Room.get(arg.sessionid) as Room | null;

    // 룸이 이미 존재하다면 종료합니다.
    if (room && !room.isEmpty) {
      return callback(false, ERROR_MESSAGES.ROOM_NOT_AVAILABLE);
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

    // 내 extra 데이터를 업데이트합니다.
    currentUser.setExtra(arg.extra);

    const room = Room.get(arg.sessionid) as Room | null;

    // 룸이 존재하지 않을 경우 접속하지 않습니다.
    if (!room) {
      return callback(false, ERROR_MESSAGES.ROOM_NOT_AVAILABLE);
    }

    // 룸 한동에 도달했으면 더 이상 진행하지 않습니다.
    if (room.isFull) {
      return callback(false, ERROR_MESSAGES.ROOM_FULL);
    }

    // 나한테 RTC 정보를 저장합니다.
    currentUser.admininfo = arg;

    // 룸에 가입합니다.
    Room.join(arg.sessionid, currentUser.userId);

    callback(true);
  });

  // 룸에 나갑니다.
  socket.on("disconnect", function () {
    // 나와 연결된 사용자에게 룸을 나간다는 소식을 전합니다.
    currentUser?.emitAll("user-disconnected", (pid) => {
      (User.get(pid) as User)?.disconnectedWith(currentUser.userId);
      return [currentUser.userId];
    });

    // 내 정보를 제거합니다.
    User.remove(currentUser);
  });
});

app.use((_, res) => {
  res.redirect("https://ketch-in.github.io/");
});

server.listen(process.env.PORT || 9002);
