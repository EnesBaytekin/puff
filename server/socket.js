const socketIo = require('socket.io');

// Active rooms and their users: Map<roomName, Map<userId, userData>>
const rooms = new Map();

function setupSocket(server) {
    const io = socketIo(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    io.on('connection', (socket) => {
        let currentRoom = null;
        let currentUserId = null;

        socket.on('join_room', (data) => {
            const { roomName, userId, puffData } = data;

            if (!roomName || !userId || !puffData) {
                socket.emit('room_error', { message: 'Missing required fields' });
                return;
            }

            // Leave current room if already in one
            if (currentRoom) {
                leaveRoom(io, socket, currentRoom, currentUserId);
            }

            currentRoom = roomName;
            currentUserId = userId;

            socket.join(roomName);

            // Track user in rooms map
            if (!rooms.has(roomName)) {
                rooms.set(roomName, new Map());
            }
            rooms.get(roomName).set(userId, {
                socketId: socket.id,
                puffData: {
                    ...puffData,
                    x: puffData.x || 0,
                    y: puffData.y || 0,
                    lastSeen: Date.now()
                }
            });

            // Send current room users to the joining user (excluding self)
            const currentUsers = [];
            rooms.get(roomName).forEach((user, uid) => {
                if (uid !== userId) {
                    currentUsers.push({
                        userId: uid,
                        puffData: user.puffData
                    });
                }
            });
            socket.emit('room_joined', {
                roomName,
                users: currentUsers
            });

            // Broadcast to others that a new user joined
            socket.to(roomName).emit('user_joined', {
                userId,
                puffData: rooms.get(roomName).get(userId).puffData
            });
        });

        socket.on('leave_room', () => {
            if (currentRoom) {
                leaveRoom(io, socket, currentRoom, currentUserId);
                currentRoom = null;
                currentUserId = null;
                socket.emit('room_left');
            }
        });

        socket.on('puff_update', (data) => {
            if (!currentRoom || !currentUserId) return;

            const room = rooms.get(currentRoom);
            if (!room || !room.has(currentUserId)) return;

            // Update stored data
            const userData = room.get(currentUserId);
            userData.puffData = {
                ...userData.puffData,
                ...data,
                lastSeen: Date.now()
            };

            // Broadcast to others in room (exclude sender)
            socket.to(currentRoom).emit('puff_update', {
                userId: currentUserId,
                ...data
            });
        });

        socket.on('disconnect', () => {
            if (currentRoom) {
                leaveRoom(io, socket, currentRoom, currentUserId);
            }
        });
    });

    return io;
}

function leaveRoom(io, socket, roomName, userId) {
    if (!roomName || !userId) return;

    socket.leave(roomName);

    const room = rooms.get(roomName);
    if (room) {
        room.delete(userId);
        socket.to(roomName).emit('user_left', { userId });

        // Clean up empty rooms
        if (room.size === 0) {
            rooms.delete(roomName);
        }
    }
}

module.exports = { setupSocket };
