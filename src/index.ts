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

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import addSocket from "./RTC/Signaling-Server";

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

  socket.onAny((title, ...args) => {
    console.log(">>>>> ", title);
  });

  // const params = socket.handshake.query;

  // if (!toString(params.socketCustomEvent)) {
  //   params.socketCustomEvent = "custom-message";
  // }

  // socket.on(toString(params.socketCustomEvent), function (message) {
  //   socket.broadcast.emit(toString(params.socketCustomEvent), message);
  // });
});

// io.on("connection", (socket) => {
//   const user = new User(socket);
//   const socketCustomEvent = user.socketCustomEvent;
//   const socketMessageEvent = user.socketMessageEvent;

//   function joinARoom(message: any) {
//     try {
//       if (!user.admininfo || !user.admininfo.sessionid) return;

//       // var roomid = message.remoteUserId;
//       const roomId = user.admininfo.sessionid;
//       const room = Room.get(roomId);
//       if (!room) {
//         return; // find a solution?
//       }

//       if (room.isFull && room.participants.indexOf(user.userId) === -1) {
//         return;
//       }
//       console.log(room.session);
//       if (room.session && (room.session.oneway || room.session.broadcast)) {
//         const ownerId = room.owner;
//         const owner = User.getUser(ownerId);
//         if (owner) {
//           owner.emit(user.socketMessageEvent || "", {
//             ...message,
//             remoteUserId: owner.userId,
//           });
//         }
//         return;
//       }

//       // connect with all participants
//       user.connectedEmit(user.socketMessageEvent || "", (userId) => [
//         { ...message, remoteUserId: userId },
//       ]);
//     } catch (e) {
//       console.log("joinARoom", e);
//     }
//   }

//   function onMessageCallback(message: any) {
//     try {
//       const sender = User.getUser(message.sender);
//       if (!sender) {
//         socket.emit("user-not-found", message.sender);
//         return;
//       }

//       // we don't need "connectedWith" anymore
//       // todo: remove all these redundant codes
//       // fire "onUserStatusChanged" for room-participants instead of individual users
//       // rename "user-connected" to "user-status-changed"
//       const remoteUser = User.getUser(message.remoteUserId);
//       if (
//         !message.message.userLeft &&
//         !sender.connectedWith.includes(message.remoteUserId) &&
//         remoteUser
//       ) {
//         const room = Room.get(sender.roomId);
//         if (!room) {
//           socket.emit("user-not-found", message.sender);
//           return;
//         }
//         room.addParticipants(remoteUser.userId);
//         sender.emit("user-connected", remoteUser.userId);

//         remoteUser.emit("user-connected", message.sender);
//       }

//       if (
//         user &&
//         sender &&
//         sender.connectedWith.includes(message.remoteUserId)
//       ) {
//         const extra = user.extra;

//         sender.connectedEmit(user.socketMessageEvent || "", {
//           ...message,
//           extra,
//         });
//       }
//     } catch (e) {
//       console.log("onMessageCallback", e);
//     }
//   }

//   const using = [
//     "check-presence",
//     "open-room",
//     "extra-data-updated",
//     "join-room",
//     socketMessageEvent,
//     socketCustomEvent,
//   ];

//   console.log(using);

//   socket.onAny((title, ...args) => {
//     if (!using.includes(title)) console.log(">>>>> ", title, ...args);
//   });

//   function closeOrShiftRoom() {
//     try {
//       if (!user.admininfo) {
//         return;
//       }

//       const roomId = user.admininfo.sessionid;
//       const room = Room.get(roomId);

//       if (!room) {
//         return;
//       }

//       if (user.userId !== room.owner) {
//         room.participants = room.participants.filter(
//           (userId) => user.userId !== userId
//         );
//         return;
//       }

//       if (user.autoCloseEntireSession || room.participants.length <= 1) {
//         Room.remove(roomId);
//         return;
//       }

//       const firstParticipant = User.getUser(
//         room.participants.find((userId) =>
//           userId === user.userId ? !User.getUser(userId) : false
//         ) || ""
//       );

//       if (!firstParticipant) {
//         Room.remove(roomId);
//         return;
//       }

//       // reset owner priviliges
//       room.owner = firstParticipant.userId;

//       // redundant?
//       firstParticipant.socket.emit("set-isInitiator-true", roomId);

//       // remove from room's participants list
//       room.participants = room.participants.filter(
//         (userId) => userId !== user.userId
//       );
//     } catch (e) {
//       console.log("closeOrShiftRoom", e);
//     }
//   }

//   socket.on("check-presence", (roomId: string, callback: any) => {
//     const room = Room.get(roomId);
//     if (!room || !room.participants.length) {
//       return callback(false, roomId, {
//         _room: {
//           isFull: false,
//           isPasswordProtected: false,
//         },
//       });
//     }

//     callback(true, roomId, room.getExtra());
//   });

//   socket.on("open-room", (arg, callback) => {
//     closeOrShiftRoom();
//     const room = Room.get(arg.sessionid);
//     if (room && room.participants.length) {
//       return callback(false, "룸이 이미 생성되었습니다.");
//     }

//     user.extra = arg.extra;

//     if (arg.session && (arg.session.oneway || arg.session.broadcast)) {
//       user.autoCloseEntireSession = true;
//     }

//     const newRoom = new Room(arg.sessionid, {
//       maxParticipantsAllowed: user.params.maxParticipantsAllowed as string,
//     });
//     console.log(arg.extra);
//     newRoom.setOwner(user.userId);
//     newRoom.setExtra(arg.extra);
//     newRoom.session = arg.session;
//     newRoom.socketMessageEvent = user.socketMessageEvent;
//     newRoom.socketCustomEvent = user.socketCustomEvent;

//     if (arg.identifier && arg.identifier.toString().length) {
//       newRoom.identifier = arg.identifier;
//     }

//     try {
//       if (
//         typeof arg.password !== "undefined" &&
//         arg.password.toString().length
//       ) {
//         // password protected room?
//         newRoom.password = arg.password;
//       }
//     } catch (e) {
//       console.log("open-room.password", e);
//     }

//     user.admininfo = {
//       sessionid: arg.sessionid,
//       session: arg.session,
//       mediaConstraints: arg.mediaConstraints,
//       sdpConstraints: arg.sdpConstraints,
//       streams: arg.streams,
//       extra: arg.extra,
//     };

//     callback(true);
//   });

//   socket.on("extra-data-updated", (extra) => {
//     try {
//       if (user.admininfo) {
//         user.admininfo.extra = extra;
//       }

//       // todo: use "admininfo.extra" instead of below one
//       user.extra = extra;

//       try {
//         user.connectedWith.forEach((userId: string) => {
//           try {
//             const connectedUser = User.getUser(userId);
//             if (connectedUser) {
//               connectedUser.emit("extra-data-updated", user.userId, extra);
//               return;
//             }
//           } catch (e) {
//             console.log("extra-data-updated.connectedWith", e);
//           }
//         });
//       } catch (e) {
//         console.log("extra-data-updated.connectedWith", e);
//       }

//       // sent alert to all room participants
//       if (!user.admininfo) {
//         return;
//       }

//       const roomId = user.admininfo.sessionid;

//       const room = Room.get(roomId);

//       if (room) {
//         if (user.userId === room.owner) {
//           room.extra = extra;
//         }

//         room.participants.forEach((userId: string) => {
//           const participant = User.getUser(userId);
//           if (!participant) {
//             return;
//           }
//           participant.emit("extra-data-updated", user.userId, extra);
//         });
//       }
//     } catch (e) {
//       console.log("extra-data-updated", e);
//     }
//   });

//   socket.on("join-room", (arg, callback) => {
//     closeOrShiftRoom();

//     user.extra = arg.extra;

//     const room = Room.get(arg.sessionid);
//     if (!room) {
//       callback(false, "접속하려는 방이 존재하지 않습니다.");
//       return;
//     }

//     if (room.isFull) {
//       callback(false, "접속하려는 방이 가득찼습니다.");
//       return;
//     }

//     room.join(user.userId);

//     user.admininfo = {
//       sessionid: arg.sessionid,
//       session: arg.session,
//       mediaConstraints: arg.mediaConstraints,
//       sdpConstraints: arg.sdpConstraints,
//       streams: arg.streams,
//       extra: arg.extra,
//     };

//     callback(true);
//   });

//   socket.on(socketMessageEvent, (message, callback) => {
//     if (message.remoteUserId && message.remoteUserId === user.userId) {
//       return;
//     }

//     try {
//       if (
//         message.remoteUserId &&
//         message.remoteUserId !== "system" &&
//         message.message.newParticipationRequest
//       ) {
//         joinARoom(message);
//         return;
//       }

//       onMessageCallback(message);
//     } catch (e) {
//       console.log("on-socketMessageEvent", e);
//     }
//   });

//   socket.on(socketCustomEvent, function (message) {
//     socket.broadcast.emit(socketCustomEvent, message);
//   });
// });

// const io = new Server(server, { cors: { origin: "*" } });

// io.on("connection", (socket) => {
//   const params = socket.handshake.query as NodeJS.Dict<string>;

//   const user = new User(socket);

//   console.log(params.msgEvent);

//   //console.log(Room.rooms);

//   // setInterval(() => {
//   //   console.log(Room.rooms, User.users);
//   // }, 1000);

//   socket.on("admin", (message, callback) => {
//     console.log("admin", { message, callback });
//   });
//   socket.on("extra-data-updated", (extra) => {
//     console.log("extra-data-updated", { extra });
//     user.setExtra(extra);
//     user.connectedEmit("extra-data-updated", () => [user.userId, extra]);
//   });
//   socket.on("get-remote-user-extra-data", (remoteUserId, callback) => {
//     console.log("get-remote-user-extra-data", { remoteUserId, callback });
//   });
//   socket.on("set-custom-socket-event-listener", (customEvent) => {
//     console.log("set-custom-socket-event-listener", { customEvent });
//   });
//   socket.on("RTCMultiConnection-Custom-Message", (message) => {
//     console.log("RTCMultiConnection-Custom-Message", { message });
//   });
//   socket.on("changed-uuid", (newUserId, callback) => {
//     console.log("changed-uuid", { newUserId, callback });
//   });
//   socket.on("set-password", (password, callback) => {
//     console.log("set-password", { password, callback });
//   });
//   socket.on("disconnect-with", (remoteUserId, callback) => {
//     console.log("disconnect-with", { remoteUserId, callback });
//   });
//   socket.on("close-entire-session", (callback) => {
//     console.log("close-entire-session", { callback });
//   });
//   socket.on("check-presence", (roomid, callback) => {
//     console.log("check-presence", { roomid, callback });
//     const room = Room.get(roomid);

//     if (!room || room.isEmpty) {
//       console.log(1);
//       return callback(false, roomid, {
//         _room: {
//           isFull: false,
//           isPasswordProtected: false,
//         },
//       });
//     }

//     try {
//       callback(true, roomid, room.getExtra());
//     } catch (e) {
//       logs("check-presence", e);
//     }
//   });
//   socket.on("file-sharing-demo", (message, callback) => {
//     console.log("file-sharing-demo");
//     console.log({ message });
//     console.log({ userId: user.userId, roomId: user.roomId });

//     if (!message.remoteUserId) {
//       console.log("file-sharing-demo > !message.remoteUserId");
//       return;
//     }

//     if (message.remoteUserId === user.userId) {
//       return;
//     }

//     if (
//       message.remoteUserId !== "system" &&
//       message.message.newParticipationRequest
//     ) {
//       const room = Room.get(user.roomId);
//       if (!room) {
//         return;
//       }

//       if (room.session.oneway || room.session.broadcast) {
//         const owner = User.getUser(room.owner);
//         if (!owner) {
//           return;
//         }

//         owner.emit("file-sharing-demo", {
//           ...message,
//           remoteUserId: owner.userId,
//         });
//         return;
//       }

//       user.connectedEmit("file-sharing-demo", (userId) => [
//         { ...message, remoteUserId: userId },
//       ]);
//       return;
//     }

//     console.log("??????");

//     //   console.log({ socketMessageEvent }, { message, callback });
//     //   const userId = toString(params.userid);
//     //   if (!message.remoteUserId) {
//     //     return;
//     //   }
//     //   if (message.remoteUserId === userId) {
//     //     return;
//     //   }
//     //   if (message.remoteUserId !== "system") {
//     //     return;
//     //   }
//     //   if (!message.message.newParticipationRequest) {
//     //     return;
//     //   }
//     //   const room = rooms[message.remoteUserId];
//     //   if (!room) {
//     //     return;
//     //   }
//     //   if (room.participants.length >= room.maxParticipantsAllowed) {
//     //     return;
//     //   }
//     //   if (
//     //     room.session &&
//     //     (room.session.oneway === true || room.session.broadcast === true)
//     //   ) {
//     //     const { owner } = room;
//     //     if (users[owner]) {
//     //       message.remoteUserId = owner;
//     //       users[owner].socket.emit(socketMessageEvent, message);
//     //     }
//     //     return;
//     //   }
//     //   console.log(1);
//   });
//   socket.on("is-valid-password", (password, roomid, callback) => {
//     console.log("is-valid-password", { password, roomid, callback });
//   });
//   socket.on("get-public-rooms", (identifier, callback) => {
//     console.log("get-public-rooms", { identifier, callback });
//   });
//   socket.on("open-room", (arg, callback = console.log) => {
//     console.log("open");
//     if (Room.isAlreadyRoomId(arg.sessionid)) {
//       return callback(false, "already room");
//     }

//     const room = new Room(arg.sessionid, {
//       maxParticipantsAllowed: params.maxParticipantsAllowed,
//     });

//     room.setOwner(user.userId);
//     room.setExtra(arg.extra || {});
//     room.session = arg.session;
//     if (arg.identifier && arg.identifier.toString().length) {
//       room.identifier = arg.identifier;
//     }
//     room.join(user.userId);
//     user.roomId = room.roomId;

//     try {
//       callback(true);
//     } catch (e) {
//       logs("open-room", e);
//     }
//   });
//   socket.on("join-room", (arg, callback = console.log) => {
//     console.log("join");
//     //console.log("join-room", { arg, callback });

//     const room = Room.get(arg.sessionid);

//     if (!room) {
//       return callback(false, "Room not available");
//     }
//     if (room.isFull) {
//       return callback(false, "Room full");
//     }

//     room.join(user.userId);
//     user.roomId = room.roomId;

//     callback(true);
//   });
//   socket.on("disconnect", () => {
//     console.log("disconnect");
//     const room = Room.get(user.roomId);
//     if (!room) {
//       return;
//     }
//     room.exit(user.userId);
//   });
// });

server.listen(9002);
