import * as http from "http";
import * as path from "path";
import * as express from "express";
import { Server, Socket } from "socket.io";
import { createNewId, logs, toBoolean, toString } from "./utils";
import User from "./User";
import Room from "./Room";

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
  addSocket(socket, {});

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
