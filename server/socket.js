const socketIo = require('socket.io');

// Active rooms and their users: Map<roomName, Map<userId, userData>>
const rooms = new Map();
const AWAY_TIMEOUT = 10 * 60 * 1000; // 10 minutes grace period for mobile disconnects

// Disconnect timeout IDs per room per user: Map<roomName, Map<userId, timeoutId>>
const awayTimeouts = new Map();

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

            // Check if this user is already in the room (grace period reconnect)
            const room = rooms.get(roomName);
            const existingUser = room && room.get(userId);
            const isReconnect = existingUser && existingUser.away;

            if (isReconnect) {
                // Cancel the away timeout
                cancelAwayTimeout(roomName, userId);

                // Update socket reference and data
                existingUser.socketId = socket.id;
                existingUser.away = false;
                existingUser.puffData = {
                    ...existingUser.puffData,
                    ...puffData,
                    lastSeen: Date.now()
                };

                // Leave previous socket's room if different
                if (currentRoom && currentRoom !== roomName) {
                    leaveRoom(io, socket, currentRoom, currentUserId, true);
                }

                currentRoom = roomName;
                currentUserId = userId;
                socket.join(roomName);

                // Notify others that user is back
                socket.to(roomName).emit('user_back', {
                    userId,
                    puffData: existingUser.puffData
                });

                // Send room_joined with full state back to the reconnecting client
                sendRoomState(io, socket, roomName, userId);
                return;
            }

            // Normal join (not a reconnect)
            // Leave current room if already in one
            if (currentRoom) {
                leaveRoom(io, socket, currentRoom, currentUserId, true);
            }

            currentRoom = roomName;
            currentUserId = userId;

            socket.join(roomName);

            // Cancel any lingering away timeout for this user
            cancelAwayTimeout(roomName, userId);

            // Track user in rooms map
            if (!rooms.has(roomName)) {
                rooms.set(roomName, new Map());
            }
            rooms.get(roomName).set(userId, {
                socketId: socket.id,
                away: false,
                puffData: {
                    ...puffData,
                    x: puffData.x || 0.5,
                    y: puffData.y || 0.5,
                    lastSeen: Date.now()
                }
            });

            // Init room activity stats
            const roomData = rooms.get(roomName);
            if (!roomData.activityStats) roomData.activityStats = {};

            sendRoomState(io, socket, roomName, userId);

            // Broadcast to others that a new user joined
            socket.to(roomName).emit('user_joined', {
                userId,
                puffData: rooms.get(roomName).get(userId).puffData
            });
        });

        socket.on('leave_room', () => {
            if (currentRoom) {
                cancelAwayTimeout(currentRoom, currentUserId);
                leaveRoom(io, socket, currentRoom, currentUserId, false);
                currentRoom = null;
                currentUserId = null;
                socket.emit('room_left');
            }
        });

        socket.on('room_timer', (data) => {
            if (!currentRoom || !currentUserId) return;
            const room = rooms.get(currentRoom);
            if (!room) return;

            const { endTime, userId: timerUserId, startTime } = data;
            // Store room-level timer
            room.roomTimer = { endTime: endTime || null, startTime: startTime || null, userId: timerUserId || currentUserId };

            // Broadcast to ALL in room
            io.to(currentRoom).emit('room_timer', room.roomTimer);
        });

        socket.on('chat_message', (data) => {
            if (!currentRoom || !currentUserId) return;
            const { message } = data;
            if (!message || typeof message !== 'string' || message.trim().length === 0) return;
            if (message.length > 200) return;

            const room = rooms.get(currentRoom);
            if (!room) return;

            // Store in room chat history
            const chatMessage = { userId: currentUserId, message: message.trim(), timestamp: Date.now() };
            room.chatHistory = room.chatHistory || [];
            room.chatHistory.push(chatMessage);
            if (room.chatHistory.length > 50) room.chatHistory.shift();

            // Broadcast to ALL users in room (including sender)
            io.to(currentRoom).emit('chat_message', chatMessage);
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

        socket.on('room_activity_sync', (data) => {
            if (!currentRoom || !currentUserId) return;
            const room = rooms.get(currentRoom);
            if (!room) return;

            // Store user's cumulative activity stats for this room
            if (!room.activityStats) room.activityStats = {};
            room.activityStats[currentUserId] = {
                name: data.name || 'Unknown',
                activities: data.activities || {}
            };

            // Broadcast updated stats to ALL in room
            io.to(currentRoom).emit('room_activity_sync', {
                userId: currentUserId,
                name: data.name || 'Unknown',
                activities: data.activities || {}
            });
        });

        socket.on('disconnect', () => {
            if (currentRoom && currentUserId) {
                const room = rooms.get(currentRoom);
                if (room && room.has(currentUserId)) {
                    // Mark as away and start grace period timer
                    const userData = room.get(currentUserId);
                    userData.away = true;
                    userData.puffData.lastSeen = Date.now();

                    // Broadcast away state
                    socket.to(currentRoom).emit('user_away', {
                        userId: currentUserId,
                        puffData: userData.puffData
                    });

                    // Set timeout to fully remove after grace period
                    const timeoutId = setTimeout(() => {
                        const r = rooms.get(currentRoom);
                        if (r && r.has(currentUserId) && r.get(currentUserId).away) {
                            leaveRoom(io, null, currentRoom, currentUserId, true);
                            // Notify remaining users
                            if (r && r.size > 0) {
                                io.to(currentRoom).emit('user_left', { userId: currentUserId });
                            }
                        }
                        cancelAwayTimeout(currentRoom, currentUserId);
                    }, AWAY_TIMEOUT);

                    // Store timeout
                    if (!awayTimeouts.has(currentRoom)) {
                        awayTimeouts.set(currentRoom, new Map());
                    }
                    awayTimeouts.get(currentRoom).set(currentUserId, timeoutId);
                } else {
                    // User not in room map (shouldn't happen), just clean up
                    leaveRoom(io, socket, currentRoom, currentUserId, true);
                }
            }
            currentRoom = null;
            currentUserId = null;
        });
    });

    return io;
}

function sendRoomState(io, socket, roomName, userId) {
    const roomData = rooms.get(roomName);
    if (!roomData) return;

    const currentUsers = [];
    roomData.forEach((user, uid) => {
        if (uid !== userId) {
            currentUsers.push({
                userId: uid,
                puffData: user.puffData
            });
        }
    });

    socket.emit('room_joined', {
        roomName,
        users: currentUsers,
        chatHistory: roomData.chatHistory || [],
        roomTimer: roomData.roomTimer || null,
        activityStats: roomData.activityStats || {}
    });
}

function leaveRoom(io, socket, roomName, userId, keepStats) {
    if (!roomName || !userId) return;

    if (socket) {
        socket.leave(roomName);
    }

    const room = rooms.get(roomName);
    if (room) {
        room.delete(userId);

        // Clean up empty rooms (but keep activityStats if they exist)
        if (room.size === 0) {
            if (keepStats && room.activityStats && Object.keys(room.activityStats).length > 0) {
                // Create a minimal room placeholder to preserve stats
                rooms.set(roomName, new Map());
                const newRoom = rooms.get(roomName);
                newRoom.activityStats = room.activityStats;
                newRoom.chatHistory = room.chatHistory || [];
                newRoom.roomTimer = room.roomTimer || null;
            } else {
                rooms.delete(roomName);
            }
        }
    }
}

function cancelAwayTimeout(roomName, userId) {
    const roomTimeouts = awayTimeouts.get(roomName);
    if (roomTimeouts && roomTimeouts.has(userId)) {
        clearTimeout(roomTimeouts.get(userId));
        roomTimeouts.delete(userId);
        if (roomTimeouts.size === 0) {
            awayTimeouts.delete(roomName);
        }
    }
}

module.exports = { setupSocket };
