import logger from "../config/logger.config.js";

export class SocketConnectionManager {
  constructor() {
    this.connections = new Map();
    this.userConnections = new Map();
    this.driverConnections = new Map();
    this.adminConnections = new Map();
  }

  addConnection(socket) {
    const userId = socket.userId;
    const userRole = socket.userRole;

    // Store connection
    this.connections.set(socket.id, {
      socket,
      userId,
      userRole,
      connectedAt: new Date(),
    });

    // Store by user type
    switch (userRole) {
      case "customer":
        this.userConnections.set(userId, socket.id);
        break;
      case "driver":
        this.driverConnections.set(userId, socket.id);
        break;
      case "admin":
        this.adminConnections.set(userId, socket.id);
        break;
    }

    logger.info(`Connection added: ${socket.user.name} (${userRole})`);
  }

  removeConnection(socketId) {
    const connection = this.connections.get(socketId);

    if (connection) {
      const { userId, userRole } = connection;

      // Remove from main connections
      this.connections.delete(socketId);

      // Remove from role-specific connections
      switch (userRole) {
        case "customer":
          this.userConnections.delete(userId);
          break;
        case "driver":
          this.driverConnections.delete(userId);
          break;
        case "admin":
          this.adminConnections.delete(userId);
          break;
      }

      logger.info(`Connection removed: ${userId} (${userRole})`);
    }
  }

  getConnectionStats() {
    return {
      total: this.connections.size,
      customers: this.userConnections.size,
      drivers: this.driverConnections.size,
      admins: this.adminConnections.size,
      lastUpdated: new Date(),
    };
  }

  getUserSocket(userId) {
    const socketId = this.userConnections.get(userId);
    return socketId ? this.connections.get(socketId)?.socket : null;
  }

  getDriverSocket(driverId) {
    const socketId = this.driverConnections.get(driverId);
    return socketId ? this.connections.get(socketId)?.socket : null;
  }

  getAdminSockets() {
    return Array.from(this.adminConnections.values())
      .map((socketId) => this.connections.get(socketId)?.socket)
      .filter(Boolean);
  }

  broadcastToRole(role, event, data) {
    let connections;

    switch (role) {
      case "customer":
        connections = this.userConnections;
        break;
      case "driver":
        connections = this.driverConnections;
        break;
      case "admin":
        connections = this.adminConnections;
        break;
      default:
        return;
    }

    connections.forEach((socketId) => {
      const socket = this.connections.get(socketId)?.socket;
      if (socket) {
        socket.emit(event, data);
      }
    });
  }
}
