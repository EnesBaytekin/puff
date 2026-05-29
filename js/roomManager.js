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
        this.currentReaction = null; // Current reaction/activity emoji (null or emoji string)
        this.chatMessages = []; // Array of { userId, message, timestamp }
        this.lastMessagePerUser = new Map(); // userId -> last message (for speech bubbles)
        this._chatBubbleTimers = new Map(); // userId -> setTimeout id
        this._chatInitialized = false;
        this._chatOpen = false;
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
                            isSleeping: creature.isSleeping || false,
                            reaction: this.currentReaction
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

            // Load chat history
            if (data.chatHistory && data.chatHistory.length > 0) {
                this.chatMessages = data.chatHistory;
                this.updateChatUI();
            } else {
                this.chatMessages = [];
            }

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
                puff.remoteReaction = data.reaction || null;

                // Update user data for name display
                const userData = this.remoteUsers.get(data.userId);
                if (userData) {
                    userData.puffData = data;
                }
            }
        });

        this.socket.on('chat_message', (data) => {
            console.log('[Room] Chat message from', data.userId, ':', data.message);
            this.chatMessages.push(data);

            // Set speech bubble for this user
            if (this._chatBubbleTimers.has(data.userId)) {
                clearTimeout(this._chatBubbleTimers.get(data.userId));
            }
            this.lastMessagePerUser.set(data.userId, data.message);
            const timer = setTimeout(() => {
                if (this.lastMessagePerUser.get(data.userId) === data.message) {
                    this.lastMessagePerUser.delete(data.userId);
                }
                this._chatBubbleTimers.delete(data.userId);
            }, 8000);
            this._chatBubbleTimers.set(data.userId, timer);

            this.updateChatUI();
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
            isSleeping: creature.isSleeping || false,
            reaction: this.currentReaction
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

        // Show reaction buttons
        const reactionBar = document.getElementById('room-mode-reactions');
        if (reactionBar) reactionBar.classList.add('active');
        this.setupReactionButtons();
        this.updateReactionButtonUI();

        // Show chat toggle
        const chatToggle = document.getElementById('room-chat-toggle');
        if (chatToggle) chatToggle.classList.add('visible');
        this.setupChatPanel();

        // Re-open chat panel if it was open
        if (this._chatOpen) {
            const panel = document.getElementById('room-chat-panel');
            if (panel) {
                panel.classList.add('open');
                this.updateChatUI();
            }
        }

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

        // Hide reaction buttons
        const reactionBar = document.getElementById('room-mode-reactions');
        if (reactionBar) reactionBar.classList.remove('active');

        // Hide chat toggle and panel
        const chatToggle = document.getElementById('room-chat-toggle');
        if (chatToggle) chatToggle.classList.remove('visible');
        const chatPanel = document.getElementById('room-chat-panel');
        if (chatPanel) chatPanel.classList.remove('open');
        this._chatOpen = false;
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
        this.currentReaction = null;
        this.chatMessages = [];
        this.lastMessagePerUser.clear();
        this._chatBubbleTimers.forEach(t => clearTimeout(t));
        this._chatBubbleTimers.clear();
        this._chatOpen = false;

        // Clear local creature's activity visual
        if (this.appView.creature) {
            this.appView.creature.activity = null;
        }

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
            isSleeping: creature.isSleeping || false,
            reaction: this.currentReaction
        };

        // Throttle: only send if data changed meaningfully
        const dataKey = `${data.x},${data.y},${data.isSleeping},${data.reaction}`;
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
        puff.remoteReaction = puffData.reaction || null;
        puff.displayName = puffData.name || 'Puff';

        // Set initial activity based on reaction data
        puff.activity = this.getActivityForReaction(puffData.reaction);

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
        this.currentReaction = null;

        // Clear local creature's activity visual
        if (this.appView.creature) {
            this.appView.creature.activity = null;
        }

        this.exitRoomMode();
        this.updateRoomUI();

        // Clear chat state
        this.chatMessages = [];
        this.lastMessagePerUser.clear();
        this._chatBubbleTimers.forEach(t => clearTimeout(t));
        this._chatBubbleTimers.clear();
        this._chatOpen = false;
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

            // Map remote reaction to activity for visual rendering
            puff.activity = this.getActivityForReaction(puff.remoteReaction);

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

                // Chat speech bubble
                this.drawChatBubble(ctx, puff, userId);
            }
        });
    }

    // Called each frame to render local puff's name tag (on top of everything)
    renderLocalName(ctx) {
        const creature = this.appView.creature;
        if (!creature || !creature.displayName) return;

        const nx = creature.centerParticle.x;
        const ny = creature.centerParticle.y - creature.radius * 1.4;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        // Name background (same style as remote)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif';
        const metrics = ctx.measureText(creature.displayName || this.appView.puffName);
        const padding = 10;
        const bw = metrics.width + padding * 2;
        const bh = 28;
        const bx = nx - bw / 2;
        const by = ny - bh;

        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(bx, by, bw, bh, 8);
            ctx.fill();
        } else {
            ctx.fillRect(bx, by, bw, bh);
        }

        // Name text — bright gold color to distinguish self
        ctx.fillStyle = '#ffd700';
        ctx.fillText(creature.displayName || this.appView.puffName, nx, ny - 4);
        ctx.restore();

        // Chat speech bubble for local user
        const myId = API.getUserId();
        this.drawChatBubble(ctx, creature, myId);
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

    // Set or toggle a reaction emoji (null to clear)
    setReaction(emoji) {
        if (this.currentReaction === emoji) {
            this.currentReaction = null; // Toggle off
        } else {
            this.currentReaction = emoji; // Toggle on
        }
        this.updateReactionButtonUI();

        // Update local creature's activity for visual rendering
        const creature = this.appView.creature;
        if (creature) {
            creature.activity = this.getActivityForReaction(this.currentReaction);
        }
    }

    // Map reaction emoji to activity visual state
    getActivityForReaction(reaction) {
        const map = {
            '📖': 'reading',
            '💃': 'dancing',
            '😴': 'sleepy',
            '🤔': 'thinking'
        };
        return map[reaction] || null;
    }

    // Update active state on reaction buttons
    updateReactionButtonUI() {
        const buttons = document.querySelectorAll('.reaction-btn');
        buttons.forEach(btn => {
            if (btn.dataset.reaction === this.currentReaction) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // Set up reaction button click handlers (runs once)
    setupReactionButtons() {
        const container = document.getElementById('room-mode-reactions');
        if (!container || container.dataset.reactionsInitialized) return;
        container.dataset.reactionsInitialized = 'true';

        container.addEventListener('click', (e) => {
            const btn = e.target.closest('.reaction-btn');
            if (!btn) return;
            this.setReaction(btn.dataset.reaction);
            // Force send puff update immediately so reaction syncs right away
            this.sendPuffUpdate();
        });
    }

    // --- Chat System ---

    sendChatMessage(text) {
        if (!this.socket || !this.socket.connected || !this.currentRoom) return;
        const message = text.trim();
        if (!message) return;
        this.socket.emit('chat_message', { message });
    }

    setupChatPanel() {
        if (this._chatInitialized) return;
        this._chatInitialized = true;

        const toggle = document.getElementById('room-chat-toggle');
        const closeBtn = document.getElementById('room-chat-close-btn');
        const sendBtn = document.getElementById('room-chat-send-btn');
        const input = document.getElementById('room-chat-input');

        if (toggle) toggle.addEventListener('click', () => this.toggleChatPanel());
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeChatPanel());
        if (sendBtn) sendBtn.addEventListener('click', () => this.sendFromInput());
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.sendFromInput();
            });
        }
    }

    toggleChatPanel() {
        const panel = document.getElementById('room-chat-panel');
        if (!panel) return;
        const opening = !panel.classList.contains('open');
        panel.classList.toggle('open');
        this._chatOpen = opening;
        if (opening) {
            const input = document.getElementById('room-chat-input');
            if (input) input.focus();
            this.updateChatUI();
        }
    }

    closeChatPanel() {
        const panel = document.getElementById('room-chat-panel');
        if (panel) panel.classList.remove('open');
        this._chatOpen = false;
    }

    sendFromInput() {
        const input = document.getElementById('room-chat-input');
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;
        this.sendChatMessage(text);
        input.value = '';
        input.focus();
    }

    updateChatUI() {
        const container = document.getElementById('room-chat-messages');
        if (!container) return;

        // Only update if panel is open
        const panel = document.getElementById('room-chat-panel');
        if (!panel || !panel.classList.contains('open')) return;

        container.innerHTML = '';
        this.chatMessages.forEach(msg => {
            const div = document.createElement('div');
            const isOwn = msg.userId === API.getUserId();
            div.className = 'chat-message' + (isOwn ? ' own-message' : '');
            const name = this.remoteUsers.get(msg.userId)?.name || 'Unknown';
            const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            div.innerHTML = `<span class="chat-username">${isOwn ? 'You' : this.escapeHtml(name)}</span><span class="chat-text">${this.escapeHtml(msg.message)}</span><span class="chat-time">${time}</span>`;
            container.appendChild(div);
        });
        this.scrollChatToBottom();
    }

    scrollChatToBottom() {
        const container = document.getElementById('room-chat-messages');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    escapeHtml(text) {
        const d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }

    // Draw a speech bubble above a puff showing their last chat message
    drawChatBubble(ctx, puff, userId) {
        const message = this.lastMessagePerUser.get(userId);
        if (!message) return;

        const truncated = message.length > 35 ? message.substring(0, 32) + '...' : message;
        const bx = puff.centerParticle.x;
        const by = puff.centerParticle.y - puff.radius * 1.9;

        ctx.save();
        ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        const metrics = ctx.measureText(truncated);
        const padding = 8;
        const bw = metrics.width + padding * 2;
        const bh = 22;
        const rx = bx - bw / 2;
        const ry = by - bh;

        // Bubble background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(rx, ry, bw, bh, 8);
            ctx.fill();
        } else {
            ctx.fillRect(rx, ry, bw, bh);
        }

        // Small triangle pointer
        ctx.beginPath();
        ctx.moveTo(bx - 4, ry + bh);
        ctx.lineTo(bx + 4, ry + bh);
        ctx.lineTo(bx, ry + bh + 5);
        ctx.closePath();
        ctx.fill();

        // Message text
        ctx.fillStyle = '#fff';
        ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textBaseline = 'bottom';
        ctx.fillText(truncated, bx, by - 3);
        ctx.restore();
    }

    cleanup() {
        this.disconnect();
    }
}
