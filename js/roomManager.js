// Room Manager - handles multiplayer room system via WebSocket

class RoomManager {
    constructor(appView) {
        this.appView = appView;
        this.socket = null;
        this.currentRoom = null;
        this.remotePuffs = new Map(); // userId -> SoftBody instance
        this.remoteUsers = new Map(); // userId -> { puffData, name }
        this.sendInterval = null;
        this.connected = false;
        this.lastSentData = null;
        this.sendThrottle = 30; // ms between sends
        this.reconnectRoom = null; // Room to re-join on socket reconnect
    }

    connect() {
        if (this.socket && this.socket.connected) return;

        this.socket = io({
            path: '/socket.io',
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: Infinity
        });

        this.socket.on('connect', () => {
            console.log('[Room] Socket connected');
            this.connected = true;
            // Re-join room after socket reconnect
            if (this.reconnectRoom) {
                const roomName = this.reconnectRoom;
                // Don't clear reconnectRoom yet — only clear when room_joined is received
                console.log('[Room] Re-joining room after reconnect:', roomName);
                const creature = this.appView.creature;
                if (creature) {
                    this.socket.emit('join_room', {
                        roomName,
                        userId: API.getUserId(),
                        puffData: {
                            x: creature.centerParticle.x,
                            y: creature.centerParticle.y,
                            color: creature.baseColor,
                            name: this.appView.puffName || 'Puff',
                            state: {
                                hunger: creature.puffState.hunger,
                                mood: creature.puffState.mood,
                                energy: creature.puffState.energy
                            },
                            isSleeping: creature.isSleeping || false
                        }
                    });
                }
            }
        });

        this.socket.on('disconnect', () => {
            console.log('[Room] Socket disconnected');
            this.connected = false;
            // Save room name before cleanup so we can re-join on reconnect
            this.reconnectRoom = this.currentRoom;
            this.handleDisconnect();
        });

        this.socket.on('room_joined', (data) => {
            console.log('[Room] Joined room:', data.roomName, 'users:', data.users);
            this.currentRoom = data.roomName;
            this.reconnectRoom = null; // Clear reconnection flag on successful join

            // Create remote puffs for existing users
            data.users.forEach(user => {
                this.addRemotePuff(user.userId, user.puffData);
            });

            // Update UI
            this.updateRoomUI();
            this.startSendingPosition();

            // Enter room mode (dedicated view like minigame)
            this.enterRoomMode();
        });

        this.socket.on('room_error', (data) => {
            console.error('[Room] Error:', data.message);
            alert('Room error: ' + data.message);
        });

        this.socket.on('room_left', () => {
            console.log('[Room] Left room');
            this.currentRoom = null;
        });

        this.socket.on('user_joined', (data) => {
            console.log('[Room] User joined:', data.userId, data.puffData);
            this.addRemotePuff(data.userId, data.puffData);
            this.updateRoomUI();
            // Ensure room mode is active (safety net for missed room_joined)
            if (!this.isRoomModeActive()) {
                this.enterRoomMode();
            }
        });

        this.socket.on('user_left', (data) => {
            console.log('[Room] User left:', data.userId);
            this.removeRemotePuff(data.userId);
            this.updateRoomUI();
        });

        this.socket.on('puff_update', (data) => {
            const puff = this.remotePuffs.get(data.userId);
            if (puff) {
                // Smoothly move toward target position
                puff.remoteTargetX = data.x;
                puff.remoteTargetY = data.y;
                puff.remoteTargetState = data.state || null;
                puff.remoteTargetSleeping = data.isSleeping;

                // Update user data for name display
                const userData = this.remoteUsers.get(data.userId);
                if (userData) {
                    userData.puffData = data;
                }
            }
        });
    }

    disconnect() {
        if (this.socket) {
            this.leaveRoom();
            this.socket.disconnect();
            this.socket = null;
        }
        this.connected = false;
    }

    joinRoom(roomName) {
        if (!this.socket || !this.socket.connected) {
            console.warn('[Room] Cannot join - not connected');
            return;
        }

        const creature = this.appView.creature;
        if (!creature) return;

        const puffData = {
            x: creature.centerParticle.x,
            y: creature.centerParticle.y,
            color: creature.baseColor,
            name: this.appView.puffName || 'Puff',
            state: {
                hunger: creature.puffState.hunger,
                mood: creature.puffState.mood,
                energy: creature.puffState.energy
            },
            isSleeping: creature.isSleeping || false
        };

        this.socket.emit('join_room', {
            roomName,
            userId: API.getUserId(),
            puffData
        });
    }

    enterRoomMode() {
        console.log('[Room] enterRoomMode called, currentRoom:', this.currentRoom);

        // Set physics solver to room mode (no centering, wall bounce)
        if (this.appView.physicsSolver) {
            this.appView.physicsSolver.setRoomMode(true);
            console.log('[Room] Physics set to room mode');
        }

        // Hide normal controls
        const topControls = document.querySelector('.top-controls');
        const bottomControls = document.querySelector('.bottom-controls');
        const puffName = document.querySelector('.puff-name-container');
        if (topControls) topControls.style.display = 'none';
        if (bottomControls) bottomControls.style.display = 'none';
        if (puffName) puffName.style.display = 'none';
        console.log('[Room] Controls hidden');

        // Show room mode UI
        const roomUi = document.getElementById('room-mode-ui');
        const roomOverlay = document.getElementById('room-mode-overlay');
        const roomNameLabel = document.getElementById('room-mode-name');
        if (roomNameLabel && this.currentRoom) {
            roomNameLabel.textContent = this.currentRoom;
        }
        if (roomUi) {
            roomUi.classList.add('active');
            console.log('[Room] room-mode-ui .active added');
        } else {
            console.warn('[Room] room-mode-ui element not found!');
        }
        if (roomOverlay) {
            roomOverlay.classList.add('active');
        } else {
            console.warn('[Room] room-mode-overlay element not found!');
        }

        // Close any open panels (with error handling to ensure room mode works)
        try {
            this.appView.closeRoomPanel();
            this.appView.closeStatusPanel();
            if (this.appView.foodDragHandler) this.appView.foodDragHandler.closeFoodPanel();
            this.appView.closeSettingsPanel();
        } catch (e) {
            console.warn('[Room] Error closing panels (non-fatal):', e);
        }

        // Disable sleep overlay visual during room mode (but keep sleep state)
        const sleepOverlay = document.getElementById('sleep-overlay');
        if (sleepOverlay) sleepOverlay.style.display = 'none';
        console.log('[Room] Room mode fully activated');
    }

    exitRoomMode() {
        // Restore physics solver
        if (this.appView.physicsSolver) {
            this.appView.physicsSolver.setRoomMode(false);
        }

        // Show normal controls
        const topControls = document.querySelector('.top-controls');
        const bottomControls = document.querySelector('.bottom-controls');
        const puffName = document.querySelector('.puff-name-container');
        if (topControls) topControls.style.display = '';
        if (bottomControls) bottomControls.style.display = '';
        if (puffName) puffName.style.display = '';

        // Hide room mode UI
        const roomUi = document.getElementById('room-mode-ui');
        const roomOverlay = document.getElementById('room-mode-overlay');
        if (roomUi) roomUi.classList.remove('active');
        if (roomOverlay) roomOverlay.classList.remove('active');

        // Restore sleep overlay if sleeping
        const sleepOverlay = document.getElementById('sleep-overlay');
        if (sleepOverlay) sleepOverlay.style.display = '';
    }

    leaveRoom() {
        this.stopSendingPosition();
        this.reconnectRoom = null; // Don't re-join after intentional leave

        if (this.socket && this.socket.connected) {
            this.socket.emit('leave_room');
        }

        // Remove all remote puffs
        this.remotePuffs.clear();
        this.remoteUsers.clear();
        this.currentRoom = null;

        // Exit room mode
        this.exitRoomMode();

        // Update UI
        this.updateRoomUI();
    }

    startSendingPosition() {
        this.stopSendingPosition();
        this.sendInterval = setInterval(() => {
            this.sendPuffUpdate();
        }, this.sendThrottle);
    }

    stopSendingPosition() {
        if (this.sendInterval) {
            clearInterval(this.sendInterval);
            this.sendInterval = null;
        }
    }

    sendPuffUpdate() {
        if (!this.socket || !this.socket.connected || !this.currentRoom) return;

        const creature = this.appView.creature;
        if (!creature) return;

        const data = {
            x: Math.round(creature.centerParticle.x),
            y: Math.round(creature.centerParticle.y),
            state: {
                hunger: creature.puffState.hunger,
                mood: creature.puffState.mood,
                energy: creature.puffState.energy
            },
            isSleeping: creature.isSleeping || false
        };

        // Throttle: only send if data changed meaningfully
        const dataKey = `${data.x},${data.y},${data.isSleeping}`;
        if (dataKey !== this.lastSentData) {
            this.socket.emit('puff_update', data);
            this.lastSentData = dataKey;
        }
    }

    addRemotePuff(userId, puffData) {
        if (this.remotePuffs.has(userId)) return;

        const canvas = this.appView.canvas;
        const radius = Math.min(canvas.getWidth(), canvas.getHeight()) * 0.12;

        // Create SoftBody at the received position
        const puff = new SoftBody(
            puffData.x || canvas.getWidth() / 2,
            puffData.y || canvas.getHeight() / 2,
            radius,
            20,
            puffData.color || '#ffd6cc',
            puffData.state || { hunger: 50, mood: 50, energy: 50 }
        );

        // Store target position for smooth interpolation
        puff.remoteTargetX = puffData.x || canvas.getWidth() / 2;
        puff.remoteTargetY = puffData.y || canvas.getHeight() / 2;
        puff.remoteTargetState = puffData.state || null;
        puff.remoteTargetSleeping = puffData.isSleeping || false;
        puff.displayName = puffData.name || 'Puff';

        this.remotePuffs.set(userId, puff);
        this.remoteUsers.set(userId, { puffData, name: puffData.name || 'Puff' });
    }

    removeRemotePuff(userId) {
        this.remotePuffs.delete(userId);
        this.remoteUsers.delete(userId);
    }

    handleDisconnect() {
        this.stopSendingPosition();
        this.remotePuffs.clear();
        this.remoteUsers.clear();
        this.currentRoom = null;
        this.exitRoomMode();
        this.updateRoomUI();
    }

    // Called each frame from game loop to update remote puff positions
    update() {
        this.remotePuffs.forEach((puff) => {
            // Smooth interpolation toward target position
            const targetX = puff.remoteTargetX !== undefined ? puff.remoteTargetX : puff.centerParticle.x;
            const targetY = puff.remoteTargetY !== undefined ? puff.remoteTargetY : puff.centerParticle.y;

            puff.centerParticle.x += (targetX - puff.centerParticle.x) * 0.12;
            puff.centerParticle.y += (targetY - puff.centerParticle.y) * 0.12;
            puff.mainCircle.x = puff.centerParticle.x;
            puff.mainCircle.y = puff.centerParticle.y;

            // Update state from remote
            if (puff.remoteTargetState) {
                puff.updateState(puff.remoteTargetState);
            }

            // Update sleep state
            if (puff.remoteTargetSleeping !== undefined) {
                puff.setSleepState(puff.remoteTargetSleeping);
            }

            // Apply organic deformation for visual animation
            puff.applyOrganicDeformation();
        });
    }

    // Called each frame to render remote puffs
    render(ctx) {
        this.remotePuffs.forEach((puff, userId) => {
            puff.draw(ctx);

            // Draw name tag above puff
            if (puff.displayName) {
                const nx = puff.centerParticle.x;
                const ny = puff.centerParticle.y - puff.radius * 1.4;

                ctx.save();
                ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';

                // Name background
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                const metrics = ctx.measureText(puff.displayName);
                const padding = 8;
                const bw = metrics.width + padding * 2;
                const bh = 24;
                const bx = nx - bw / 2;
                const by = ny - bh;

                // Use roundRect if available, fallback to plain rect
                if (ctx.roundRect) {
                    ctx.beginPath();
                    ctx.roundRect(bx, by, bw, bh, 8);
                    ctx.fill();
                } else {
                    ctx.fillRect(bx, by, bw, bh);
                }

                // Name text
                ctx.fillStyle = '#ffffff';
                ctx.fillText(puff.displayName, nx, ny - 4);
                ctx.restore();
            }
        });
    }

    updateRoomUI() {
        const roomPanel = document.getElementById('room-panel');
        const roomUsersList = document.getElementById('room-users-list');
        const leaveBtn = document.getElementById('room-leave-btn');
        const joinBtn = document.getElementById('room-join-btn');
        const roomNameInput = document.getElementById('room-name-input');
        const roomStatus = document.getElementById('room-status');

        if (!roomPanel) return;

        if (this.currentRoom) {
            // In a room
            if (roomNameInput) roomNameInput.disabled = true;
            if (joinBtn) joinBtn.style.display = 'none';
            if (leaveBtn) leaveBtn.style.display = 'block';
            if (roomStatus) roomStatus.textContent = `📍 In Room: "${this.currentRoom}"`;

            // Update user list
            if (roomUsersList) {
                roomUsersList.innerHTML = '';
                // Add self
                const selfItem = document.createElement('div');
                selfItem.className = 'room-user-item';
                selfItem.innerHTML = `
                    <span class="room-user-dot active"></span>
                    <span class="room-user-name">${this.appView.puffName || 'You'} (you)</span>
                `;
                roomUsersList.appendChild(selfItem);

                // Add remote users
                this.remoteUsers.forEach((userData, userId) => {
                    const item = document.createElement('div');
                    item.className = 'room-user-item';
                    item.innerHTML = `
                        <span class="room-user-dot active"></span>
                        <span class="room-user-name">${userData.name}</span>
                    `;
                    roomUsersList.appendChild(item);
                });
            }
        } else {
            // Not in a room
            if (roomNameInput) roomNameInput.disabled = false;
            if (joinBtn) joinBtn.style.display = 'block';
            if (leaveBtn) leaveBtn.style.display = 'none';
            if (roomStatus) roomStatus.textContent = 'Enter a room name to join or create one';

            if (roomUsersList) {
                roomUsersList.innerHTML = '<div class="room-user-empty">Not in a room yet</div>';
            }
        }
    }

    isInRoom() {
        return this.currentRoom !== null;
    }

    // Check if the actual room mode UI is active (may differ from isInRoom
    // if there was a rendering issue or missed event)
    isRoomModeActive() {
        const roomUi = document.getElementById('room-mode-ui');
        return roomUi && roomUi.classList.contains('active');
    }

    cleanup() {
        this.disconnect();
    }
}
