var listOfRooms = {};

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
class User {
  static users = {};

  static add(user) {
    if (this.users[user.userId]) {
      return this;
    }
    this.users[user.userId] = user;
    return this;
  }

  static remove(user) {
    return this.removeById(user.userId);
  }

  static removeById(userId) {
    if (!this.users[userId]) {
      return this;
    }
    delete this.users[userId];
    return this;
  }

  static get(userId) {
    if (!this.users[userId]) {
      return null;
    }
    return this.users[userId];
  }

  static createId(userId) {
    if (!userId) {
      return this.createId((Math.random() * 1000).toString().replace(".", ""));
    }
    return this.users[userId] ? this.createId() : userId;
  }

  constructor(socket) {
    this.socket = socket;
    this.userId = User.createId(this.params.userid);

    if (this.userId !== this.params.userid) {
      // id가 변경되었을 경우 클라이언트에 고지
      socket.emit("userid-already-taken", this.params.userid, this.userId);
    }

    this.extra = parseExtra(this.params);
    this.autoCloseEntireSession = [true, "true"].includes(
      this.params.autoCloseEntireSession
    );
    this.connectedWith = {};
    this.admininfo = {};

    User.add(this);
  }

  get socketMessageEvent() {
    return this.params.msgEvent || "RTCMultiConnection-Message";
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

export default function (socket) {
  const currentUser = new User(socket);

  socket.on("extra-data-updated", function (extra) {
    try {
      if (!currentUser) return;

      currentUser.extra = extra;
      currentUser.admininfo.extra = extra;

      Object.values(currentUser.connectedWith).forEach((connectedSocket) => {
        try {
          connectedSocket.emit("extra-data-updated", currentUser.userId, extra);
        } catch (e) {
          console.log("extra-data-updated.connectedWith", e);
        }
      });

      const roomId = currentUser.admininfo.sessionid;
      if (roomId && listOfRooms[roomId]) {
        if (currentUser.userId == listOfRooms[roomId].owner) {
          // room's extra must match owner's extra
          listOfRooms[roomId].extra = extra;
        }
        listOfRooms[roomId].participants.forEach((pid) => {
          try {
            const user = User.get(pid);
            if (!user) {
              // todo: remove this user from participants list
              return;
            }
            user.socket.emit("extra-data-updated", currentUser.userId, extra);
          } catch (e) {
            console.log("extra-data-updated.participants", e);
          }
        });
      }
    } catch (e) {
      console.log("extra-data-updated", e);
    }
  });

  socket.on("check-presence", function (roomid, callback) {
    try {
      if (!listOfRooms[roomid] || !listOfRooms[roomid].participants.length) {
        callback(false, roomid, {
          _room: {
            isFull: false,
            isPasswordProtected: false,
          },
        });
      } else {
        var extra = listOfRooms[roomid].extra;
        if (typeof extra !== "object" || !extra) {
          extra = {
            value: extra,
          };
        }
        extra._room = {
          isFull:
            listOfRooms[roomid].participants.length >=
            listOfRooms[roomid].maxParticipantsAllowed,
          isPasswordProtected:
            listOfRooms[roomid].password &&
            listOfRooms[roomid].password.toString().replace(/ /g, "").length,
        };
        callback(true, roomid, extra);
      }
    } catch (e) {
      console.log("check-presence", e);
    }
  });

  function onMessageCallback(message) {
    try {
      if (!User.get(message.sender)) {
        socket.emit("user-not-found", message.sender);
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
          currentUser.socketMessageEvent,
          message
        );
      }
    } catch (e) {
      console.log("onMessageCallback", e);
    }
  }

  function joinARoom(message) {
    try {
      if (!currentUser.admininfo.sessionid) return;

      // var roomid = message.remoteUserId;
      var roomid = currentUser.admininfo.sessionid;

      if (!listOfRooms[roomid]) return; // find a solution?

      if (
        listOfRooms[roomid].participants.length >=
          listOfRooms[roomid].maxParticipantsAllowed &&
        listOfRooms[roomid].participants.indexOf(currentUser.userId) === -1
      ) {
        // room is full
        // todo: how to tell user that room is full?
        // do not fire "room-full" event
        // find something else
        return;
      }

      if (
        listOfRooms[roomid].session &&
        (listOfRooms[roomid].session.oneway === true ||
          listOfRooms[roomid].session.broadcast === true)
      ) {
        var owner = listOfRooms[roomid].owner;
        if (User.get(owner)) {
          message.remoteUserId = owner;
        }
        return;
      }

      // redundant?
      // appendToRoom(roomid, currentUser.userId);

      // connect with all participants
      listOfRooms[roomid].participants.forEach(function (pid) {
        if (pid === currentUser.userId || !User.get(pid)) return;

        var user = User.get(pid);
        message.remoteUserId = pid;
        user.socket.emit(currentUser.socketMessageEvent, message);
      });
    } catch (e) {
      console.log("joinARoom", e);
    }
  }

  function appendToRoom(roomid, userid) {
    try {
      if (!listOfRooms[roomid]) {
        listOfRooms[roomid] = {
          maxParticipantsAllowed: currentUser.maxParticipantsAllowed,
          owner: userid, // this can change if owner leaves and if control shifts
          participants: [userid],
          extra: {}, // usually owner's extra-data
          socketMessageEvent: "",
          socketCustomEvent: "",
          identifier: "",
          session: {
            audio: true,
            video: true,
          },
        };
      }

      if (listOfRooms[roomid].participants.indexOf(userid) !== -1) return;
      listOfRooms[roomid].participants.push(userid);
    } catch (e) {
      console.log("appendToRoom", e);
    }
  }

  function closeOrShiftRoom() {
    try {
      var roomid = currentUser.admininfo.sessionid;

      if (!roomid || !listOfRooms[roomid]) {
        return;
      }

      if (currentUser.userId !== listOfRooms[roomid].owner) {
        listOfRooms[roomid].participants = listOfRooms[
          roomid
        ].participants.filter(
          (pid) => pid && pid != currentUser.userId && User.get(pid)
        );
        return;
      }

      console.log("1 >", currentUser.autoCloseEntireSession);
      if (
        currentUser.autoCloseEntireSession ||
        listOfRooms[roomid].participants.length <= 1
      ) {
        delete listOfRooms[roomid];
        return;
      }

      var firstParticipant;
      listOfRooms[roomid].participants.forEach(function (pid) {
        if (firstParticipant || pid === currentUser.userId) return;
        if (!User.get(pid)) return;
        firstParticipant = User.get(pid);
      });

      if (!firstParticipant) {
        delete listOfRooms[roomid];
        return;
      }

      // reset owner priviliges
      listOfRooms[roomid].owner = firstParticipant.currentUser.userId;

      // redundant?
      firstParticipant.socket.emit("set-isInitiator-true", roomid);

      // remove from room's participants list
      var newParticipantsList = [];
      listOfRooms[roomid].participants.forEach(function (pid) {
        if (pid != currentUser.userId) {
          newParticipantsList.push(pid);
        }
      });
      listOfRooms[roomid].participants = newParticipantsList;
    } catch (e) {
      console.log("closeOrShiftRoom", e);
    }
  }

  socket.on(currentUser.socketMessageEvent, function (message, callback) {
    if (message.remoteUserId && message.remoteUserId === currentUser.userId) {
      // remoteUserId MUST be unique
      return;
    }

    try {
      if (
        message.remoteUserId &&
        message.remoteUserId != "system" &&
        message.message.newParticipationRequest
      ) {
        joinARoom(message);
        return;
      }

      // for v3 backward compatibility; >v3.3.3 no more uses below block
      if (message.remoteUserId == "system") {
        if (message.message.detectPresence) {
          if (message.message.userid === currentUser.userId) {
            callback(false, currentUser.userId);
            return;
          }

          callback(!!User.get(message.message.userid), message.message.userid);
          return;
        }
      }

      if (!User.get(message.sender)) {
        // User.get(message.sender) = {
        //   socket: socket,
        //   connectedWith: {},
        //   extra: {},
        //   admininfo: {},
        // };
      }

      onMessageCallback(message);
    } catch (e) {
      console.log("on-socketMessageEvent", e);
    }
  });

  socket.on("open-room", function (arg, callback = console.log) {
    try {
      // if already joined a room, either leave or close it
      closeOrShiftRoom();

      if (
        listOfRooms[arg.sessionid] &&
        listOfRooms[arg.sessionid].participants.length
      ) {
        callback(false, CONST_STRINGS.ROOM_NOT_AVAILABLE);
        return;
      }

      // maybe redundant?
      if (!currentUser) {
        // currentUser = {
        //   socket: socket,
        //   connectedWith: {},
        //   extra: arg.extra,
        //   admininfo: {},
        //   socketMessageEvent: currentUser.socketMessageEvent,
        //   socketCustomEvent: currentUser.socketCustomEvent,
        // };
      }
      currentUser.extra = arg.extra;

      if (arg.session && (arg.session.oneway || arg.session.broadcast)) {
        console.log("2 >", currentUser.autoCloseEntireSession);
        currentUser.autoCloseEntireSession = true;
      }
    } catch (e) {
      console.log("open-room", e);
    }

    // append this user into participants list
    appendToRoom(arg.sessionid, currentUser.userId);

    try {
      // override owner & session

      // for non-scalable-broadcast demos
      listOfRooms[arg.sessionid].owner = currentUser.userId;
      listOfRooms[arg.sessionid].session = arg.session;
      listOfRooms[arg.sessionid].extra = arg.extra || {};
      listOfRooms[arg.sessionid].socketMessageEvent = User.get(
        currentUser.userId
      ).socketMessageEvent;
      listOfRooms[arg.sessionid].socketCustomEvent = User.get(
        currentUser.userId
      ).socketCustomEvent;
      listOfRooms[arg.sessionid].maxParticipantsAllowed =
        currentUser.maxParticipantsAllowed;

      if (arg.identifier && arg.identifier.toString().length) {
        listOfRooms[arg.sessionid].identifier = arg.identifier;
      }

      try {
        if (
          typeof arg.password !== "undefined" &&
          arg.password.toString().length
        ) {
          // password protected room?
          listOfRooms[arg.sessionid].password = arg.password;
        }
      } catch (e) {
        console.log("open-room.password", e);
      }

      // admin info are shared only with /admin/
      currentUser.admininfo = {
        sessionid: arg.sessionid,
        session: arg.session,
        mediaConstraints: arg.mediaConstraints,
        sdpConstraints: arg.sdpConstraints,
        streams: arg.streams,
        extra: arg.extra,
      };
    } catch (e) {
      console.log("open-room", e);
    }

    try {
      callback(true);
    } catch (e) {
      console.log("open-room", e);
    }
  });

  socket.on("join-room", function (arg, callback = console.log) {
    try {
      // if already joined a room, either leave or close it
      closeOrShiftRoom();

      // maybe redundant?
      if (!currentUser) {
        // currentUser = {
        //   socket: socket,
        //   connectedWith: {},
        //   extra: arg.extra,
        //   admininfo: {},
        //   socketMessageEvent: currentUser.socketMessageEvent,
        //   socketCustomEvent: currentUser.socketCustomEvent ,
        // };
      }
      currentUser.extra = arg.extra;
    } catch (e) {
      console.log("join-room", e);
    }

    try {
      if (!listOfRooms[arg.sessionid]) {
        callback(false, CONST_STRINGS.ROOM_NOT_AVAILABLE);
        return;
      }
    } catch (e) {
      console.log("join-room", e);
    }

    try {
      if (
        listOfRooms[arg.sessionid].password &&
        listOfRooms[arg.sessionid].password != arg.password
      ) {
        callback(false, CONST_STRINGS.INVALID_PASSWORD);
        return;
      }
    } catch (e) {
      console.log("join-room.password", e);
    }

    try {
      if (
        listOfRooms[arg.sessionid].participants.length >=
        listOfRooms[arg.sessionid].maxParticipantsAllowed
      ) {
        callback(false, CONST_STRINGS.ROOM_FULL);
        return;
      }
    } catch (e) {
      console.log("join-room.ROOM_FULL", e);
    }

    // append this user into participants list
    appendToRoom(arg.sessionid, currentUser.userId);

    try {
      // admin info are shared only with /admin/
      currentUser.admininfo = {
        sessionid: arg.sessionid,
        session: arg.session,
        mediaConstraints: arg.mediaConstraints,
        sdpConstraints: arg.sdpConstraints,
        streams: arg.streams,
        extra: arg.extra,
      };
    } catch (e) {
      console.log("join-room", e);
    }

    try {
      callback(true);
    } catch (e) {
      console.log("join-room", e);
    }
  });

  socket.on("disconnect", function () {
    try {
      if (socket && socket.namespace && socket.namespace.sockets) {
        delete socket.namespace.sockets[this.id];
      }
    } catch (e) {
      console.log("disconnect", e);
    }

    try {
      // inform all connected users
      if (currentUser) {
        for (var s in currentUser.connectedWith) {
          currentUser.connectedWith[s].emit(
            "user-disconnected",
            currentUser.userId
          );

          // sending duplicate message to same socket?
          if (User.get(s) && User.get(s).connectedWith[currentUser.userId]) {
            delete User.get(s).connectedWith[currentUser.userId];
            User.get(s).socket.emit("user-disconnected", currentUser.userId);
          }
        }
      }
    } catch (e) {
      console.log("disconnect", e);
    }

    closeOrShiftRoom();

    User.remove(currentUser.userId);

    if (socket.ondisconnect) {
      try {
        // scalable-broadcast.js
        socket.ondisconnect();
      } catch (e) {
        console.log("socket.ondisconnect", e);
      }
    }
  });
}
