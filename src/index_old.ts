import * as http from "http";
import * as path from "path";
import * as express from "express";
import { Server } from "socket.io";

type HostCache = { [key: string]: string };
type OrganizerInfo = {
  id?: string | null;
  active?: boolean;
};
interface UserState {
  target: "self" | "other";
  toggle: boolean;
  organizer: OrganizerInfo;
}
type EventType = "up" | "down" | "move";
type DrawPacket = [number, number, number, number, EventType];

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const cache: HostCache = {};

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

io.on("connection", (socket) => {
  // join 할 때 organizer-info:screen 정보 송출
  socket.on("join", (meetId: string, role?: string) => {
    socket.join(meetId);
    if (role === "organizer") {
      cache[meetId] = socket.id;
      socket.to(meetId).emit("organizer-info:screen", socket.id);
    } else {
      socket.to(meetId).emit("organizer-info:refetch", socket.id);
      if (cache[meetId]) {
        socket.emit("organizer-info:screen", cache[meetId]);
      }
    }
  });

  /**
   * organizerInfo:{
   *  id: data-initial-participant-id // 발표자 ID
   *  active: true // 그리기 가능 여부
   * }
   */
  socket.on("organizer-info:update", (id: string, userState: UserState) => {
    socket.to(id).emit("organizer-info:update", userState, socket.id);
  });

  socket.on("draw:add", (id: string, packet: DrawPacket) => {
    // console.log(`draw:add > ${point}`)
    // TODO: 그림을 그리는 주최는 host의 app이므로 app한태만 쏴주면 됨
    socket.to(id).emit("draw:add", packet, socket.id);
  });

  // screen host가 접속을 끊으면 캐시를 비운다.
  socket.on("disconnect", () => {
    const meets = Object.keys(cache);
    meets.forEach((meetId) => {
      if (cache[meetId] === socket.id) {
        delete cache[meetId];
        socket.to(meetId).emit("organizer-info:screen", null);
      }
    });
  });
});

server.listen(8000, () => {
  console.log("listening on *:8000");
});
