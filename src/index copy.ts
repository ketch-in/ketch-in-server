import * as http from "http";
import * as path from "path";
import * as express from "express";
import { Server, Socket } from "socket.io";

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

// --------

function errorLog(funcName: string, error: unknown) {
  console.log({ funcName, error });
}

const rooms: {
  [roomId: string]: {
    owner: string;
    participants: string[];
    extra: {
      value: unknown;
      _room: {
        isFull: boolean;
        isPasswordProtected: boolean;
      };
    };
  };
} = {};
const users: { [userId: string]: User } = {};
interface User {
  extra: unknown;
  socket: Socket | null;
  admininfo?: {
    sessionid: string;
    session: unknown;
    mediaConstraints: unknown;
    sdpConstraints: unknown;
    streams: unknown;
    extra: unknown;
  };
  connectedWith: { [userId: string]: Socket | null };
}

function createUserId(
  { beforeUserId, userid = "" }: NodeJS.Dict<string>,
  onChange = (beforeUserId: string, userid: string) => {
    console.log({ beforeUserId, userid });
  }
): string {
  if (!userid) {
    if (beforeUserId) {
      onChange(beforeUserId, userid);
    }
    return createUserId({
      userid: (Math.random() * 1000).toString().replace(".", ""),
    });
  }

  if (users[userid]) {
    return createUserId({ userid: "", beforeUserId: userid });
  }

  return userid;
}

function getExtra({ extra = "" }: NodeJS.Dict<string>) {
  try {
    return JSON.parse(extra) || {};
  } catch {
    return {};
  }
}

io.on("connection", (socket) => {
  const params = socket.handshake.query as NodeJS.Dict<string>;

  params.userid = createUserId(params, (beforeUserId, userid) =>
    socket.emit("userid-already-taken", beforeUserId, userid)
  );
  params.extra = getExtra(params);
  params.socketMessageEvent = params.msgEvent || "RTCMultiConnection-Message";

  users[params.userid] = {
    socket,
    extra: params.extra,
    connectedWith: {},
  };

  socket.on("extra-data-updated", (extra) => {
    console.log(extra, params);
    // users[params.userid].extra = extra;
  });

  socket.on("check-presence", (roomid, callback) => {
    if (!callback) {
      return;
    }
    if (!rooms[roomid] || !rooms[roomid].participants.length) {
      return callback(false, roomid, {
        _room: {
          isFull: false,
          isPasswordProtected: false,
        },
      });
    }
    callback(true, roomid, rooms[roomid].extra);
  });

  socket.on("open-room", (arg, callback = console.log) => {});
});

// interface User {
//   extra: any;
//   socket: Socket | null;
//   admininfo: { [key: string]: unknown };
//   connectedWith: { [userid: string]: Socket | null };
//   socketCustomEvent?: string;
//   socketMessageEvent?: string;
// }

// const listOfUsers: {
//   [key: string]: User;
// } = {};

// const listOfRooms: { [roomid: string]: any } = {};

// function getUserId(userid?: unknown): string {
//   return (userid as string)
//     ? (userid as string)
//     : (Math.random() * 100).toString().replace(".", "");
// }

// function parseExtra(extra?: any) {
//   if (!extra) {
//     return {};
//   }
//   if (typeof extra !== "string") {
//     return extra;
//   }
//   try {
//     return JSON.parse(extra);
//   } catch {
//     return extra;
//   }
// }

// function toString(str?: string | string[]): string {
//   if (!str) {
//     return "";
//   }
//   if (Array.isArray(str)) {
//     return toString(str[0]);
//   }
//   return str;
// }

// function addUser(socket: Socket, params: { [key: string]: unknown }) {
//   const extra = parseExtra(params.extra);

//   listOfUsers[params.userid as string] = {
//     extra,
//     socket,
//     admininfo: {},
//     connectedWith: {},
//     socketCustomEvent: params.socketCustomEvent as string,
//     socketMessageEvent: params.socketCustomEvent as string,
//   };
// }

// function addRoom(params: ParsedUrlQuery, roomid: string, userid: string) {
//   try {
//     if (!listOfRooms[roomid]) {
//       listOfRooms[roomid] = {
//         maxParticipantsAllowed:
//           parseInt(toString(params.maxParticipantsAllowed)) || 1000,
//         owner: userid, // this can change if owner leaves and if control shifts
//         participants: [getUserId(params.userid)],
//         extra: {}, // usually owner's extra-data
//         socketMessageEvent: "",
//         socketCustomEvent: "",
//         identifier: "",
//         session: {
//           audio: true,
//           video: true,
//         },
//       };
//     }

//     if (listOfRooms[roomid].participants.indexOf(userid) !== -1) return;
//     listOfRooms[roomid].participants.push(userid);
//   } catch (e) {
//     console.log(addRoom, e);
//   }
// }

// // // eslint-disable-next-line @typescript-eslint/ban-ts-comment
// // // @ts-ignore
// // import * as RTCMultiConnectionServer from "rtcmulticonnection-server";
// // io.on("connection", (socket) => {
// //   const config = RTCMultiConnectionServer.getBashParameters(
// //     RTCMultiConnectionServer.getValuesFromConfigJson({
// //       config: "config.json",
// //       logs: "logs.json",
// //     }),
// //     RTCMultiConnectionServer.BASH_COLORS_HELPER
// //   );

// //   RTCMultiConnectionServer.addSocket(socket, config);

// //   const params = socket.handshake.query;

// //   if (!toString(params.socketCustomEvent)) {
// //     params.socketCustomEvent = "custom-message";
// //   }

// //   socket.on(toString(params.socketCustomEvent), function (message) {
// //     socket.broadcast.emit(toString(params.socketCustomEvent), message);
// //   });
// // });

// io.on("connection", (socket) => {
//   const params: { [key: string]: unknown } = socket.handshake
//     .query as NodeJS.Dict<string>;

//   params.userid = getUserId(params.userid as string);
//   try {
//     params.extra = JSON.parse(params.extra as string) || {};
//   } catch {
//     params.extra = {};
//   }

//   params.socketMessageEvent = params.msgEvent || "RTCMultiConnection-Message";
//   params.socketCustomEvent = params.socketCustomEvent || "custom-message";

//   if (listOfUsers[params.userid as string]) {
//     const prevUserId = params.userid;
//     params.userid = (Math.random() * 1000).toString().replace(".", "");
//     socket.emit("userid-already-taken", prevUserId, params.userid);
//     return;
//   }

//   addUser(socket, params);

//   function onMessageCallback(message: any) {
//     console.log(message);
//     try {
//       console.log(11);
//       if (!listOfUsers[message.sender]) {
//         console.log(22);
//         socket.emit("user-not-found", message.sender);
//         return;
//       }
//       console.log(33);

//       // we don't need "connectedWith" anymore
//       // todo: remove all these redundant codes
//       // fire "onUserStatusChanged" for room-participants instead of individual users
//       // rename "user-connected" to "user-status-changed"
//       if (
//         !message.message.userLeft &&
//         !listOfUsers[message.sender].connectedWith[message.remoteUserId] &&
//         !!listOfUsers[message.remoteUserId]
//       ) {
//         console.log(44);
//         listOfUsers[message.sender].connectedWith[message.remoteUserId] =
//           listOfUsers[message.remoteUserId].socket;
//         listOfUsers[message.sender].socket?.emit(
//           "user-connected",
//           message.remoteUserId
//         );

//         if (!listOfUsers[message.remoteUserId]) {
//           listOfUsers[message.remoteUserId] = {
//             socket: null,
//             connectedWith: {},
//             extra: {},
//             socketCustomEvent: "",
//             socketMessageEvent: "",
//           };
//         }

//         listOfUsers[message.remoteUserId].connectedWith[message.sender] =
//           socket;

//         if (listOfUsers[message.remoteUserId].socket) {
//           listOfUsers[message.remoteUserId].socket?.emit(
//             "user-connected",
//             message.sender
//           );
//         }
//       }
//       console.log(55);

//       if (
//         listOfUsers[message.sender] &&
//         listOfUsers[message.sender].connectedWith[message.remoteUserId] &&
//         listOfUsers[getUserId(params.userid)]
//       ) {
//         console.log(66);
//         message.extra = listOfUsers[getUserId(params.userid)].extra;
//         listOfUsers[message.sender].connectedWith[message.remoteUserId]?.emit(
//           socketMessageEvent,
//           message
//         );
//       }
//     } catch (e) {
//       console.log(77);
//       console.log("onMessageCallback", e);
//     }
//     console.log("asd", listOfUsers[message.sender].connectedWith);
//   }

//   socket.on("admin", function (message, callback) {
//     console.log("admin", message, callback);
//   });
//   socket.on("extra-data-updated", function (extra) {
//     // console.log("\n\n\n");
//     // console.log(0);
//     if (!listOfUsers[getUserId(params.userid)]) return;
//     //console.log(1);
//     // todo: use "admininfo.extra" instead of below one
//     listOfUsers[getUserId(params.userid)].extra = extra;
//     //console.log(2);
//     try {
//       //console.log(3, listOfUsers[getUserId(params.userid)].connectedWith);
//       for (const user in listOfUsers[getUserId(params.userid)].connectedWith) {
//         // console.log(4);
//         try {
//           // console.log(5);
//           listOfUsers[user].socket?.emit(
//             "extra-data-updated",
//             getUserId(params.userid),
//             extra
//           );
//           // console.log(6);
//         } catch (e) {
//           // console.log(7);
//           // console.log("extra-data-updated", e);
//         }
//         // console.log(8);
//       }
//     } catch (e) {
//       // console.log(9);
//       // console.log("extra-data-updated", e);
//     }
//     // console.log(10);
//   });
//   socket.on("get-remote-user-extra-data", function (remoteUserId, callback) {
//     console.log("get-remote-user-extra-data", remoteUserId, callback);
//   });
//   socket.on("set-custom-socket-event-listener", function (customEvent) {
//     console.log("set-custom-socket-event-listener", customEvent);
//   });
//   socket.on("changed-uuid", function (newUserId, callback) {
//     console.log("changed-uuid", newUserId, callback);
//   });
//   socket.on("set-password", function (password, callback) {
//     console.log("set-password", password, callback);
//   });
//   socket.on("disconnect-with", function (remoteUserId, callback) {
//     console.log("disconnect-with", remoteUserId, callback);
//   });
//   socket.on("close-entire-session", function (callback) {
//     console.log("close-entire-session", callback);
//   });
//   socket.on("check-presence", function (roomid, callback) {
//     try {
//       if (!listOfRooms[roomid] || !listOfRooms[roomid].participants.length) {
//         return callback(false, roomid, {
//           _room: {
//             isFull: false,
//             isPasswordProtected: false,
//           },
//         });
//       }

//       const extra =
//         typeof listOfRooms[roomid].extra !== "object" ||
//         !listOfRooms[roomid].extra
//           ? {
//               value: listOfRooms[roomid].extra,
//             }
//           : listOfRooms[roomid].extra;
//       extra._room = {
//         isFull:
//           listOfRooms[roomid].participants.length >=
//           listOfRooms[roomid].maxParticipantsAllowed,
//         isPasswordProtected: false,
//       };
//       callback(true, roomid, extra);
//     } catch (e) {
//       console.log("check-presence", e);
//     }
//   });
//   socket.on("is-valid-password", function (password, roomid, callback) {
//     console.log("is-valid-password", password, roomid, callback);
//   });
//   socket.on("get-public-rooms", function (identifier, callback) {
//     console.log("get-public-rooms", identifier, callback);
//   });
//   socket.on("open-room", function (arg, callback = console.log) {
//     try {
//       if (
//         listOfRooms[arg.sessionid] &&
//         listOfRooms[arg.sessionid].participants.length
//       ) {
//         return callback(false, "Room not available");
//       }

//       if (!listOfUsers[getUserId(params.userid)]) {
//         listOfUsers[getUserId(params.userid)] = {
//           socket: socket,
//           extra: arg.extra,
//           connectedWith: {},
//           socketMessageEvent: toString(params.socketMessageEvent),
//           socketCustomEvent: toString(params.socketCustomEvent),
//         };
//       }

//       listOfUsers[getUserId(params.userid)].extra = arg.extra;
//     } catch (e) {
//       console.log("open-room", e);
//     }

//     addRoom(params, arg.sessionid, getUserId(params.userid));

//     try {
//       listOfRooms[arg.sessionid].owner = getUserId(params.userid);
//       listOfRooms[arg.sessionid].session = arg.session;
//       listOfRooms[arg.sessionid].extra = arg.extra || {};
//       listOfRooms[arg.sessionid].socketMessageEvent =
//         listOfUsers[getUserId(params.userid)].socketMessageEvent;
//       listOfRooms[arg.sessionid].socketCustomEvent =
//         listOfUsers[getUserId(params.userid)].socketCustomEvent;
//       listOfRooms[arg.sessionid].maxParticipantsAllowed =
//         parseInt(toString(params.maxParticipantsAllowed)) || 1000;

//       if (arg.identifier && arg.identifier.toString().length) {
//         listOfRooms[arg.sessionid].identifier = arg.identifier;
//       }
//     } catch (e) {
//       console.log("open-room", e);
//     }

//     try {
//       callback(true);
//     } catch (e) {
//       console.log("open-room", e);
//     }
//   });
//   socket.on("join-room", function (arg, callback = console.log) {
//     try {
//       // maybe redundant?
//       if (!listOfUsers[getUserId(params.userid)]) {
//         listOfUsers[getUserId(params.userid)] = {
//           socket: socket,
//           connectedWith: {},
//           extra: arg.extra,
//           socketMessageEvent: toString(params.socketMessageEvent),
//           socketCustomEvent: toString(params.socketCustomEvent),
//         };
//       }
//       listOfUsers[getUserId(params.userid)].extra = arg.extra;
//     } catch (e) {
//       console.log("join-room", e);
//     }

//     try {
//       if (!listOfRooms[arg.sessionid]) {
//         callback(false, "Room not available");
//         return;
//       }
//     } catch (e) {
//       console.log("join-room", e);
//     }

//     try {
//       if (
//         listOfRooms[arg.sessionid].participants.length >=
//         listOfRooms[arg.sessionid].maxParticipantsAllowed
//       ) {
//         callback(false, "Room full");
//         return;
//       }
//     } catch (e) {
//       console.log("join-room", e);
//     }

//     // append this user into participants list
//     addRoom(params, arg.sessionid, getUserId(params.userid));

//     try {
//       callback(true);
//     } catch (e) {
//       console.log("join-room", e);
//     }
//   });
//   socket.on("disconnect", function () {
//     try {
//       // inform all connected users
//       if (listOfUsers[getUserId(params.userid)]) {
//         for (const s in listOfUsers[getUserId(params.userid)].connectedWith) {
//           listOfUsers[getUserId(params.userid)].connectedWith[s]?.emit(
//             "user-disconnected",
//             getUserId(params.userid)
//           );

//           // sending duplicate message to same socket?
//           if (
//             listOfUsers[s] &&
//             listOfUsers[s].connectedWith[getUserId(params.userid)]
//           ) {
//             delete listOfUsers[s].connectedWith[getUserId(params.userid)];
//             listOfUsers[s].socket?.emit(
//               "user-disconnected",
//               getUserId(params.userid)
//             );
//           }
//         }
//       }
//     } catch (e) {
//       console.log("disconnect", e);
//     }

//     delete listOfUsers[getUserId(params.userid)];
//   });
//   socket.on(socketMessageEvent, function (message, callback) {
//     console.log("\n\n\n");
//     console.log(0);
//     if (
//       message.remoteUserId &&
//       message.remoteUserId === getUserId(params.userid)
//     ) {
//       // remoteUserId MUST be unique
//       console.log(1);
//       return;
//     }
//     console.log(2);
//     try {
//       if (
//         message.remoteUserId &&
//         message.remoteUserId != "system" &&
//         message.message.newParticipationRequest
//       ) {
//         console.log(
//           3,
//           message.remoteUserId,
//           message.message.newParticipationRequest
//         );
//         if (listOfRooms[message.remoteUserId]) {
//           console.log(5);
//           return;
//         }
//       }
//       console.log(
//         6,
//         message.remoteUserId,
//         message.message.newParticipationRequest
//       );
//       // for v3 backward compatibility; >v3.3.3 no more uses below block
//       if (message.remoteUserId == "system") {
//         console.log(7);
//         if (message.message.detectPresence) {
//           console.log(8);
//           if (message.message.userid === getUserId(params.userid)) {
//             console.log(9);
//             callback(false, getUserId(params.userid));
//             return;
//           }
//           console.log(10);
//           callback(
//             !!listOfUsers[message.message.userid],
//             message.message.userid
//           );
//           return;
//         }
//       }
//       console.log(11);
//       if (!listOfUsers[message.sender]) {
//         console.log(12);
//         listOfUsers[message.sender] = {
//           socket: socket,
//           connectedWith: {},
//           extra: {},
//         };
//       }

//       console.log(14);
//       onMessageCallback(message);
//     } catch (e) {
//       console.log(15);
//       console.log(socketMessageEvent, e);
//     }
//     console.log(16);
//   });
//   socket.on(socketCustomEvent, function (message) {
//     console.log(message);
//     socket.broadcast.emit(socketCustomEvent, message);
//   });
// });

server.listen(9002);
