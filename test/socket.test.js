import { createServer } from "http";
import { Server } from "socket.io";
import Client from "socket.io-client";

describe("Socket.IO Integration", () => {
  let io, serverSocket, clientSocket, httpServer;

  beforeAll((done) => {
    httpServer = createServer();
    io = new Server(httpServer);
    httpServer.listen(() => {
      const port = httpServer.address().port;
      clientSocket = new Client(`http://localhost:${port}`, {
        auth: { token: "valid-jwt-token" },
      });

      io.on("connection", (socket) => {
        serverSocket = socket;

        // respond to "ping"
        socket.on("ping", (cb) => {
          cb("pong");
        });
      });

      clientSocket.on("connect", done);
    });
  });

  afterAll(() => {
    io.close();
    clientSocket.close();
    httpServer.close();
  });

  test("should authenticate socket connection", (done) => {
    clientSocket.emit("ping", (response) => {
      expect(response).toBe("pong");
      done();
    });
  });
});
