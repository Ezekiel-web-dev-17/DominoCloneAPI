import { Server } from "socket.io";

const io = new Server(4000);

io.on("connection");
