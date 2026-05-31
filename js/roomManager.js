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

        // Activity timer tracking
        this.activityStartTime = null; // timestamp when current activity started
        this.sessionHistory = []; // [{activity, emoji, startTime, endTime, duration}]
        this.lastDurationPing = 0; // for throttling duration-only updates
        this._statsInitialized = false;
        this._statsOpen = false;
        this._statsRefreshInterval = null;

        // Room timer (shared countdown for everyone in room)
        this.roomTimerEnd = null; // timestamp when room timer ends (null = no timer)
        this.roomTimerStartTime = null; // when the timer was started
        this.roomTimerSetterId = null; // userId of who set it
        this._timerBarInterval = null;

        // Room-level cumulative activity stats: { userId: { name, activities: { reading: 300, dancing: 0, ... } } }
        this.roomActivityStats = {};
        this._roomStatsSyncInterval = null;
        this._lastRoomStatsSyncTime = Date.now();
        this._reconnecting = false;
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
                            x: this.normX(creature.centerParticle.x),
                            y: this.normY(creature.centerParticle.y),
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

            if (this.currentRoom) {
                // Graceful disconnect: keep room state, don't exit room mode
                this.reconnectRoom = this.currentRoom;

                // Log current activity session and reset timer to avoid double-counting
                if (this.currentReaction && this.activityStartTime) {
                    this.logActivitySession(this.currentReaction);
                    this.activityStartTime = null;
                }

                // Clear remote puffs — they'll be re-populated on reconnect
                this.remotePuffs.clear();
                this.remoteUsers.clear();

                this._reconnecting = true;
                this.updateReconnectingUI();
            }
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

            // Load room timer
            if (data.roomTimer && data.roomTimer.endTime) {
                this.roomTimerEnd = data.roomTimer.endTime;
                this.roomTimerStartTime = data.roomTimer.startTime || null;
                this.roomTimerSetterId = data.roomTimer.userId || null;
            } else {
                this.roomTimerEnd = null;
                this.roomTimerStartTime = null;
                this.roomTimerSetterId = null;
            }

            // Load room activity stats from server
            if (data.activityStats) {
                this.roomActivityStats = data.activityStats;
            }

            // Send my accumulated stats for this room after joining
            setTimeout(() => {
                this.syncRoomActivityStats();
            }, 500);

            // Update UI
            this.updateRoomUI();
            this.startSendingPosition();

            if (this._reconnecting) {
                this._reconnecting = false;
                this.updateReconnectingUI();
            } else {
                // Enter room mode only on fresh join, not reconnect
                this.enterRoomMode();
            }
        });

        this.socket.on('room_error', (data) => {
            console.error('[Room] Error:', data.message);
            alert('Room error: ' + data.message);
        });

        this.socket.on('room_left', () => {
            console.log('[Room] Left room');
            this.currentRoom = null;
        });

        this.socket.on('user_away', (data) => {
            console.log('[Room] User away:', data.userId);
            const puff = this.remotePuffs.get(data.userId);
            if (puff) {
                puff.isAway = true;
            }
        });

        this.socket.on('user_back', (data) => {
            console.log('[Room] User back:', data.userId);
            const puff = this.remotePuffs.get(data.userId);
            if (puff) {
                puff.isAway = false;
                // Update position from server data
                if (data.puffData) {
                    puff.remoteNormX = data.puffData.x !== undefined ? data.puffData.x : 0.5;
                    puff.remoteNormY = data.puffData.y !== undefined ? data.puffData.y : 0.5;
                }
            }
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
                // Store normalized position, denormalize in update()
                puff.remoteNormX = data.x !== undefined ? data.x : 0.5;
                puff.remoteNormY = data.y !== undefined ? data.y : 0.5;
                puff.remoteTargetX = this.denormX(puff.remoteNormX);
                puff.remoteTargetY = this.denormY(puff.remoteNormY);
                puff.remoteTargetState = data.state || null;
                puff.remoteTargetSleeping = data.isSleeping;
                puff.remoteReaction = data.reaction || null;
                puff.remoteActivityDuration = data.activityDuration || 0;

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

        this.socket.on('room_timer', (data) => {
            console.log('[Room] Room timer update:', data);
            if (data && data.endTime) {
                this.roomTimerEnd = data.endTime;
                this.roomTimerStartTime = data.startTime || null;
                this.roomTimerSetterId = data.userId || null;
            } else {
                this.roomTimerEnd = null;
                this.roomTimerStartTime = null;
                this.roomTimerSetterId = null;
            }
            this.updateSharedTimerBar();
            if (this._statsOpen) this.updateStatsUI();
        });

        this.socket.on('room_activity_sync', (data) => {
            if (!data || !data.userId) return;
            this.roomActivityStats[data.userId] = {
                name: data.name || 'Unknown',
                activities: data.activities || {}
            };
            if (this._statsOpen) this.updateStatsUI();
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
            x: this.normX(creature.centerParticle.x),
            y: this.normY(creature.centerParticle.y),
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

        // Show stats toggle
        const statsToggle = document.getElementById('room-stats-toggle');
        if (statsToggle) statsToggle.classList.add('visible');
        this.setupStatsPanel();

        // Start shared timer bar updater
        this.startTimerBar();

        // Start periodic room stats sync (every 10s)
        this.startRoomStatsSync();

        // Re-open panels if they were open
        if (this._chatOpen) {
            const panel = document.getElementById('room-chat-panel');
            if (panel) {
                panel.classList.add('open');
                this.updateChatUI();
            }
        }
        if (this._statsOpen) {
            const panel = document.getElementById('room-stats-panel');
            if (panel) {
                panel.classList.add('open');
                this.updateStatsUI();
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

        // Hide shared timer bar, reconnecting indicator, and stop room stats sync
        this.stopTimerBar();
        this.stopRoomStatsSync();
        this._reconnecting = false;
        this.updateReconnectingUI();

        // Hide stats toggle and panel
        const statsToggle = document.getElementById('room-stats-toggle');
        if (statsToggle) statsToggle.classList.remove('visible');
        const statsPanel = document.getElementById('room-stats-panel');
        if (statsPanel) statsPanel.classList.remove('open');
        this._statsOpen = false;
    }

    leaveRoom() {
        this.stopSendingPosition();
        this.reconnectRoom = null; // Don't re-join after intentional leave

        // Log current activity before leaving (this saves to room stats)
        if (this.currentReaction) {
            this.logActivitySession(this.currentReaction);
        }

        // Sync final room stats before leaving
        this.syncRoomActivityStats();

        if (this.socket && this.socket.connected) {
            this.socket.emit('leave_room');
        }

        // Remove all remote puffs
        this.remoteUsers.clear();
        this.currentRoom = null;
        this.currentReaction = null;
        this.chatMessages = [];
        this.lastMessagePerUser.clear();
        this._chatBubbleTimers.forEach(t => clearTimeout(t));
        this._chatBubbleTimers.clear();
        this._chatOpen = false;
        this.activityStartTime = null;
        this._statsOpen = false;
        this.roomTimerEnd = null;
        this.roomTimerStartTime = null;
        this.roomTimerSetterId = null;
        this.roomActivityStats = {};
        this.stopTimerBar();
        this.stopRoomStatsSync();
        if (this._statsRefreshInterval) {
            clearInterval(this._statsRefreshInterval);
            this._statsRefreshInterval = null;
        }

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

    getCanvasSize() {
        if (this.appView.canvas) {
            return { w: this.appView.canvas.getWidth(), h: this.appView.canvas.getHeight() };
        }
        return { w: window.innerWidth, h: window.innerHeight };
    }

    // Normalize pixel coords to 0-1 range for cross-screen sync
    normX(px) { const c = this.getCanvasSize(); return c.w > 0 ? px / c.w : 0.5; }
    normY(py) { const c = this.getCanvasSize(); return c.h > 0 ? py / c.h : 0.5; }
    denormX(nx) { const c = this.getCanvasSize(); return nx * c.w; }
    denormY(ny) { const c = this.getCanvasSize(); return ny * c.h; }

    sendPuffUpdate() {
        if (!this.socket || !this.socket.connected || !this.currentRoom) return;

        const creature = this.appView.creature;
        if (!creature) return;

        const data = {
            x: this.normX(creature.centerParticle.x),
            y: this.normY(creature.centerParticle.y),
            state: {
                hunger: creature.puffState.hunger,
                mood: creature.puffState.mood,
                energy: creature.puffState.energy
            },
            isSleeping: creature.isSleeping || false,
            reaction: this.currentReaction,
            activityDuration: this.getCurrentActivityDuration()
        };

        // Throttle: only send if data changed meaningfully (rounded to avoid float jitter)
        const now = Date.now();
        const dataKey = `${Math.round(data.x*100)},${Math.round(data.y*100)},${data.isSleeping},${data.reaction}`;
        if (dataKey !== this.lastSentData) {
            this.socket.emit('puff_update', data);
            this.lastSentData = dataKey;
            this.lastDurationPing = now;
        } else if (this.currentReaction && now - this.lastDurationPing > 5000) {
            // Periodic ping to sync activity duration (every 5s even if idle)
            this.socket.emit('puff_update', data);
            this.lastDurationPing = now;
        }
    }

    addRemotePuff(userId, puffData) {
        if (this.remotePuffs.has(userId)) return;

        const canvas = this.appView.canvas;
        const radius = Math.min(canvas.getWidth(), canvas.getHeight()) * 0.12;

        // Create SoftBody at received position (denormalize to local screen)
        const initX = puffData.x !== undefined ? this.denormX(puffData.x) : canvas.getWidth() / 2;
        const initY = puffData.y !== undefined ? this.denormY(puffData.y) : canvas.getHeight() / 2;
        const puff = new SoftBody(
            initX,
            initY,
            radius,
            20,
            puffData.color || '#ffd6cc',
            puffData.state || { hunger: 50, mood: 50, energy: 50 }
        );

        // Store normalized target position for cross-screen sync
        const normX = puffData.x !== undefined ? puffData.x : 0.5;
        const normY = puffData.y !== undefined ? puffData.y : 0.5;
        puff.remoteNormX = normX;
        puff.remoteNormY = normY;
        puff.remoteTargetX = this.denormX(normX);
        puff.remoteTargetY = this.denormY(normY);
        puff.remoteTargetState = puffData.state || null;
        puff.remoteTargetSleeping = puffData.isSleeping || false;
        puff.remoteReaction = puffData.reaction || null;
        puff.remoteActivityDuration = puffData.activityDuration || 0;
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

        // Log current activity before clearing (capture before nulling)
        if (this.currentReaction) {
            this.logActivitySession(this.currentReaction);
        }

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
        this.activityStartTime = null;
        this._statsOpen = false;
        this.roomTimerEnd = null;
        this.roomTimerStartTime = null;
        this.roomTimerSetterId = null;
        this.roomActivityStats = {};
        if (this._statsRefreshInterval) {
            clearInterval(this._statsRefreshInterval);
            this._statsRefreshInterval = null;
        }
    }

    // Called each frame from game loop to update remote puff positions
    update() {
        this.remotePuffs.forEach((puff) => {
            // Denormalize target each frame (handles window resize)
            if (puff.remoteNormX !== undefined) {
                puff.remoteTargetX = this.denormX(puff.remoteNormX);
                puff.remoteTargetY = this.denormY(puff.remoteNormY);
            }
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
            // Away puffs are drawn at lower opacity
            if (puff.isAway) {
                ctx.save();
                ctx.globalAlpha = 0.35;
            }

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
                ctx.fillStyle = puff.isAway ? 'rgba(255,255,255,0.4)' : '#ffffff';
                ctx.fillText(puff.displayName, nx, ny - 4);
                ctx.restore();

                // Away badge
                if (puff.isAway) {
                    ctx.save();
                    ctx.globalAlpha = 0.6;
                    ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText('💤', nx, ny - 28);
                    ctx.restore();
                }

                // Chat speech bubble
                this.drawChatBubble(ctx, puff, userId);

                // Activity duration badge
                if (puff.remoteReaction) {
                    this.drawDurationBadge(ctx, puff, puff.remoteActivityDuration);
                }
            }

            if (puff.isAway) {
                ctx.restore(); // restore alpha
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

        // Activity duration badge for local puff
        if (this.currentReaction) {
            this.drawDurationBadge(ctx, creature, this.getCurrentActivityDuration());
        }
    }

    updateRoomUI() {
        const roomPanel = document.getElementById('room-panel');
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
        } else {
            // Not in a room
            if (roomNameInput) roomNameInput.disabled = false;
            if (joinBtn) joinBtn.style.display = 'block';
            if (leaveBtn) leaveBtn.style.display = 'none';
            if (roomStatus) roomStatus.textContent = 'Enter a room name to join or create one';
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
        const previousReaction = this.currentReaction;

        if (this.currentReaction === emoji) {
            this.currentReaction = null; // Toggle off
        } else {
            this.currentReaction = emoji; // Toggle on
        }
        this.updateReactionButtonUI();

        // Log previous activity session if switching
        if (previousReaction && this.activityStartTime) {
            this.logActivitySession(previousReaction);
        }

        // Reset timer for new activity
        if (this.currentReaction) {
            this.activityStartTime = Date.now();
        } else {
            this.activityStartTime = null;
        }

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

    // --- Activity Timer & Stats ---

    getActivityEmoji(activity) {
        const map = { 'reading': '📖', 'dancing': '💃', 'sleepy': '😴', 'thinking': '🤔' };
        return map[activity] || '❓';
    }

    getCurrentActivityDuration() {
        if (!this.currentReaction || !this.activityStartTime) return 0;
        return Math.floor((Date.now() - this.activityStartTime) / 1000);
    }

    formatDuration(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        if (m > 0 || seconds >= 60) return `${m}:${s.toString().padStart(2, '0')}`;
        return `0:${s.toString().padStart(2, '0')}`;
    }

    logActivitySession(reaction) {
        if (!this.activityStartTime) return;
        const activity = this.getActivityForReaction(reaction);
        const duration = Math.floor((Date.now() - this.activityStartTime) / 1000);
        if (duration < 10) return; // Ignore sessions shorter than 10s

        const session = {
            activity,
            emoji: this.getActivityEmoji(activity),
            startTime: this.activityStartTime,
            endTime: Date.now(),
            duration
        };
        this.sessionHistory.push(session);

        // Save to daily stats in localStorage
        this.saveDailyStats(activity, duration);

        // Save to room-level cumulative stats
        this.addToRoomActivityStats(activity, duration);
        // Sync to room after each session
        this.syncRoomActivityStats();
        this.updateStatsUI();
    }

    loadDailyStats() {
        try {
            const raw = localStorage.getItem('puff-activity-stats');
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    }

    saveDailyStats(activity, seconds) {
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const stats = this.loadDailyStats();
        if (!stats[today]) stats[today] = {};
        stats[today][activity] = (stats[today][activity] || 0) + seconds;
        localStorage.setItem('puff-activity-stats', JSON.stringify(stats));
    }

    getTodayStats() {
        const today = new Date().toISOString().slice(0, 10);
        return this.loadDailyStats()[today] || {};
    }

    // --- Room-level cumulative activity stats ---

    getRoomStatsKey() {
        return this.currentRoom ? `puff-room-stats-${this.currentRoom}` : null;
    }

    loadRoomStats() {
        const key = this.getRoomStatsKey();
        if (!key) return {};
        try {
            return JSON.parse(localStorage.getItem(key)) || {};
        } catch { return {}; }
    }

    saveRoomStats(stats) {
        const key = this.getRoomStatsKey();
        if (!key) return;
        localStorage.setItem(key, JSON.stringify(stats));
    }

    addToRoomActivityStats(activity, seconds) {
        if (!this.currentRoom || seconds <= 0) return;
        const stats = this.loadRoomStats();
        const myId = API.getUserId();
        if (!stats[myId]) stats[myId] = { name: this.appView.puffName || 'You', activities: {} };
        stats[myId].name = this.appView.puffName || 'You';
        stats[myId].activities[activity] = (stats[myId].activities[activity] || 0) + seconds;
        this.saveRoomStats(stats);

        // Also update in-memory roomActivityStats so UI refreshes immediately
        if (!this.roomActivityStats[myId]) {
            this.roomActivityStats[myId] = { name: this.appView.puffName || 'You', activities: {} };
        }
        this.roomActivityStats[myId].name = this.appView.puffName || 'You';
        this.roomActivityStats[myId].activities[activity] = stats[myId].activities[activity];
    }

    syncRoomActivityStats() {
        if (!this.socket || !this.socket.connected || !this.currentRoom) return;

        // Update local roomActivityStats so UI refreshes immediately
        const myId = API.getUserId();
        const localStats = this.loadRoomStats();
        if (localStats[myId]) {
            this.roomActivityStats[myId] = {
                name: localStats[myId].name || this.appView.puffName || 'You',
                activities: { ...localStats[myId].activities }
            };
        }

        const myStats = localStats[myId];
        if (!myStats) return;
        this.socket.emit('room_activity_sync', {
            name: this.appView.puffName || 'You',
            activities: myStats.activities || {}
        });
    }

    updateReconnectingUI() {
        const el = document.getElementById('room-reconnecting');
        if (!el) return;
        el.style.display = this._reconnecting ? 'block' : 'none';
    }

    drawDurationBadge(ctx, puff, durationSeconds) {
        if (!durationSeconds || durationSeconds < 5) return;
        const text = this.formatDuration(durationSeconds);
        const bx = puff.centerParticle.x;
        const by = puff.centerParticle.y - puff.radius * 1.1;

        ctx.save();
        ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const metrics = ctx.measureText(text);
        const padding = 6;
        const bw = metrics.width + padding * 2;
        const bh = 18;
        const rx = bx - bw / 2;
        const ry = by - bh;

        // Semi-transparent dark badge
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(rx, ry, bw, bh, 6);
            ctx.fill();
        } else {
            ctx.fillRect(rx, ry, bw, bh);
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textBaseline = 'bottom';
        ctx.fillText(text, bx, by - 2);
        ctx.restore();
    }

    // --- Room Timer (shared countdown for the whole room) ---

    getRoomTimerElapsed() {
        if (!this.roomTimerEnd) return 0;
        return Math.floor((Date.now() - this.roomTimerEnd + this.getRoomTimerDuration() * 1000) / 1000);
    }

    getRoomTimerRemaining() {
        if (!this.roomTimerEnd) return 0;
        return Math.max(0, Math.floor((this.roomTimerEnd - Date.now()) / 1000));
    }

    getRoomTimerDuration() {
        if (!this.roomTimerEnd || !this.roomTimerStartTime) return 0;
        return Math.floor((this.roomTimerEnd - this.roomTimerStartTime) / 1000);
    }

    getRoomTimerProgress() {
        if (!this.roomTimerEnd || !this.roomTimerStartTime) return 0;
        const total = this.getRoomTimerDuration();
        if (total <= 0) return 0;
        const remaining = this.getRoomTimerRemaining();
        return 1 - (remaining / total);
    }

    isRoomTimerComplete() {
        return this.roomTimerEnd !== null && Date.now() >= this.roomTimerEnd;
    }

    setRoomTimer(seconds) {
        const endTime = Date.now() + seconds * 1000;
        this.roomTimerEnd = endTime;
        this.roomTimerStartTime = Date.now();
        this.roomTimerSetterId = API.getUserId();

        // Send to server to broadcast
        if (this.socket && this.socket.connected && this.currentRoom) {
            this.socket.emit('room_timer', { endTime, startTime: this.roomTimerStartTime, userId: API.getUserId() });
        }

        this.updateSharedTimerBar();
        if (this._statsOpen) this.updateStatsUI();
    }

    cancelRoomTimer() {
        this.roomTimerEnd = null;
        this.roomTimerStartTime = null;
        this.roomTimerSetterId = null;

        if (this.socket && this.socket.connected && this.currentRoom) {
            this.socket.emit('room_timer', { endTime: null, startTime: null, userId: API.getUserId() });
        }

        this.updateSharedTimerBar();
        if (this._statsOpen) this.updateStatsUI();
    }

    // --- Room Activity Stats Sync ---

    startRoomStatsSync() {
        this.stopRoomStatsSync();
        this._lastRoomStatsSyncTime = Date.now();
        this._roomStatsSyncInterval = setInterval(() => {
            // Accumulate current activity time to room stats
            if (this.currentReaction) {
                const activity = this.getActivityForReaction(this.currentReaction);
                const now = Date.now();
                const delta = Math.floor((now - this._lastRoomStatsSyncTime) / 1000);
                this._lastRoomStatsSyncTime = now;
                if (delta > 0) {
                    this.addToRoomActivityStats(activity, delta);
                    this.syncRoomActivityStats();
                }
            } else {
                this._lastRoomStatsSyncTime = Date.now();
            }

            // Also refresh stats panel if open
            if (this._statsOpen) this.updateStatsUI();
        }, 10000);
    }

    stopRoomStatsSync() {
        if (this._roomStatsSyncInterval) {
            clearInterval(this._roomStatsSyncInterval);
            this._roomStatsSyncInterval = null;
        }
    }

    // --- Shared Timer Bar (visible to everyone in room) ---

    startTimerBar() {
        this.stopTimerBar();
        this.updateSharedTimerBar();
        this._timerBarInterval = setInterval(() => this.updateSharedTimerBar(), 1000);

        // Click on timer bar opens stats panel
        const bar = document.getElementById('room-timer-bar');
        if (bar && !bar.dataset.timerBarInit) {
            bar.dataset.timerBarInit = '1';
            bar.addEventListener('click', () => {
                this.toggleStatsPanel();
            });
        }
    }

    stopTimerBar() {
        if (this._timerBarInterval) {
            clearInterval(this._timerBarInterval);
            this._timerBarInterval = null;
        }
        const bar = document.getElementById('room-timer-bar');
        if (bar) bar.style.display = 'none';
    }

    updateSharedTimerBar() {
        const bar = document.getElementById('room-timer-bar');
        if (!bar) return;

        if (!this.roomTimerEnd || Date.now() >= this.roomTimerEnd) {
            if (this.roomTimerEnd && Date.now() >= this.roomTimerEnd) {
                // Timer just completed
                const timeEl = document.getElementById('room-timer-time');
                const fillEl = document.getElementById('room-timer-fill');
                if (timeEl) timeEl.textContent = '⏰ Time\'s up!';
                if (fillEl) fillEl.style.width = '100%';
                bar.style.display = 'flex';
            } else {
                bar.style.display = 'none';
            }
            return;
        }

        const elapsed = this.getRoomTimerElapsed();
        const total = this.getRoomTimerDuration();
        const progress = elapsed / total;

        bar.style.display = 'flex';

        const timeEl = document.getElementById('room-timer-time');
        const fillEl = document.getElementById('room-timer-fill');

        if (timeEl) {
            timeEl.textContent = `${this.formatDuration(elapsed)} / ${this.formatDuration(total)}`;
        }

        if (fillEl) {
            fillEl.style.width = Math.min(progress * 100, 100) + '%';
        }
    }

    // --- Stats Panel ---

    setupStatsPanel() {
        if (this._statsInitialized) return;
        this._statsInitialized = true;

        const toggle = document.getElementById('room-stats-toggle');
        const closeBtn = document.getElementById('room-stats-close-btn');
        if (toggle) toggle.addEventListener('click', () => this.toggleStatsPanel());
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeStatsPanel());

        // Timer preset buttons (event delegation on the content area)
        const content = document.getElementById('room-stats-content');
        if (content) {
            content.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-timer-preset]');
                if (btn) {
                    this.setRoomTimer(parseInt(btn.dataset.timerPreset));
                    return;
                }
                const cancelBtn = e.target.closest('#timer-cancel-btn');
                if (cancelBtn) {
                    this.cancelRoomTimer();
                    return;
                }
            });
        }
    }

    toggleStatsPanel() {
        const panel = document.getElementById('room-stats-panel');
        if (!panel) return;
        panel.classList.toggle('open');
        this._statsOpen = panel.classList.contains('open');
        if (this._statsOpen) {
            this.updateStatsUI();
            // Auto-refresh every 2s while open
            if (this._statsRefreshInterval) clearInterval(this._statsRefreshInterval);
            this._statsRefreshInterval = setInterval(() => {
                if (this._statsOpen) this.updateStatsUI();
                else {
                    clearInterval(this._statsRefreshInterval);
                    this._statsRefreshInterval = null;
                }
            }, 2000);
        } else {
            if (this._statsRefreshInterval) {
                clearInterval(this._statsRefreshInterval);
                this._statsRefreshInterval = null;
            }
        }
    }

    closeStatsPanel() {
        const panel = document.getElementById('room-stats-panel');
        if (panel) panel.classList.remove('open');
        this._statsOpen = false;
        if (this._statsRefreshInterval) {
            clearInterval(this._statsRefreshInterval);
            this._statsRefreshInterval = null;
        }
    }

    updateStatsUI() {
        const container = document.getElementById('room-stats-content');
        if (!container) return;

        const panel = document.getElementById('room-stats-panel');
        if (!panel || !panel.classList.contains('open')) return;

        // Don't replace HTML if custom timer input is focused (would kill focus)
        const customInput = document.getElementById('timer-custom-input');
        if (customInput && document.activeElement === customInput) return;

        const myId = API.getUserId();
        const allActivities = ['reading', 'dancing', 'thinking', 'sleepy'];
        let html = '';

        // === ⏱ Room Timer Card ===
        html += '<div class="stats-card">';
        if (!this.roomTimerEnd || Date.now() >= this.roomTimerEnd) {
            html += '<div class="stats-card-title">⏱ Room Timer</div>';
            html += '<div class="timer-presets">';
            [600, 1500, 2700, 3600].forEach(s => {
                const label = s >= 3600 ? `${s/3600}h` : `${s/60}m`;
                html += `<button class="timer-preset-btn" data-timer-preset="${s}">${label}</button>`;
            });
            html += '</div>';
            html += '<div class="timer-custom-row">';
            html += '<input type="number" id="timer-custom-input" class="timer-custom-input" placeholder="min" min="1" max="480">';
            html += '<button class="timer-preset-btn" data-timer-preset-selector>Set</button>';
            html += '</div>';
            if (Date.now() >= this.roomTimerEnd && this.roomTimerEnd) {
                html += '<div class="timer-complete" style="margin-top:6px;">⏰ Time\'s up!</div>';
            }
        } else {
            const remaining = this.getRoomTimerRemaining();
            const progress = this.getRoomTimerProgress();
            html += '<div class="stats-card-title">⏱ Room Timer</div>';
            html += `<div class="timer-display">`;
            const m = Math.floor(remaining / 60);
            const s = remaining % 60;
            html += `<div class="timer-time">${m}:${s.toString().padStart(2, '0')}</div>`;
            html += `<div class="timer-bar"><div class="timer-bar-fill" style="width:${progress*100}%"></div></div>`;
            html += '</div>';
            html += '<div class="timer-controls">';
            html += `<button id="timer-cancel-btn" class="timer-btn timer-btn-reset">✕ Cancel Timer</button>`;
            html += '</div>';
        }
        html += '</div>';

        // === 👥 Online Now Card ===
        html += '<div class="stats-card"><div class="stats-card-title">👥 Online Now</div>';
        const onlineUsers = [];
        // Self
        onlineUsers.push({
            userId: myId, name: this.appView.puffName || 'You',
            emoji: this.currentReaction ? this.getActivityEmoji(this.getActivityForReaction(this.currentReaction)) : '💤',
            activity: this.currentReaction ? this.getActivityForReaction(this.currentReaction) : 'idle',
            dur: this.getCurrentActivityDuration(),
            isOwn: true
        });
        // Remote users (only those currently connected)
        this.remotePuffs.forEach((puff, uid) => {
            const emoji = puff.remoteReaction ? this.getActivityEmoji(this.getActivityForReaction(puff.remoteReaction)) : '💤';
            onlineUsers.push({
                userId: uid, name: puff.displayName, emoji,
                activity: puff.remoteReaction ? this.getActivityForReaction(puff.remoteReaction) : 'idle',
                dur: puff.remoteActivityDuration || 0,
                isOwn: false
            });
        });

        if (onlineUsers.length > 0) {
            html += '<div class="online-list">';
            onlineUsers.forEach(u => {
                const cls = u.isOwn ? ' online-item-own' : '';
                html += `<div class="online-item${cls}">`;
                html += `<span class="online-dot"></span>`;
                html += `<span class="online-name">${u.name}</span>`;
                if (u.emoji !== '💤') {
                    html += `<span class="online-activity">${u.emoji}</span>`;
                    html += `<span class="online-duration">${u.dur >= 10 ? this.formatDuration(u.dur) : 'just now'}</span>`;
                } else {
                    html += `<span class="online-activity" style="opacity:0.4;">💤 idle</span>`;
                }
                html += '</div>';
            });
            html += '</div>';
        } else {
            html += '<div class="stats-empty">No one online</div>';
        }
        html += '</div>';

        // === 📖 Room Activity Card ===
        html += '<div class="stats-card"><div class="stats-card-title">📖 Room Activity</div>';
        const roomUsers = [];

        // Merge own localStorage stats
        const localStats = this.loadRoomStats();
        if (localStats[myId] && Object.values(localStats[myId].activities || {}).some(v => v > 0)) {
            this.roomActivityStats[myId] = {
                name: localStats[myId].name || this.appView.puffName || 'You',
                activities: { ...localStats[myId].activities }
            };
        }

        Object.entries(this.roomActivityStats).forEach(([uid, stat]) => {
            const isOwn = uid === myId;
            const hasActivity = Object.values(stat.activities || {}).some(v => v > 0);
            if (hasActivity) {
                roomUsers.push({ userId: uid, name: stat.name || 'Unknown', activities: stat.activities || {}, isOwn });
            }
        });

        if (roomUsers.length === 0) {
            html += '<div class="stats-empty">No activity recorded yet</div>';
        } else {
            roomUsers.forEach(u => {
                const cls = u.isOwn ? ' user-card-own' : '';
                html += `<div class="user-card${cls}">`;
                html += `<div class="user-card-name">${u.name}</div>`;
                html += '<div class="activity-tiles">';
                allActivities.forEach(act => {
                    const duration = u.activities[act] || 0;
                    if (duration > 0) {
                        const emoji = this.getActivityEmoji(act);
                        html += `<div class="activity-tile">`;
                        html += `<span class="tile-emoji">${emoji}</span>`;
                        html += `<span class="tile-duration">${this.formatDuration(duration)}</span>`;
                        html += `</div>`;
                    }
                });
                html += '</div></div>';
            });
        }
        html += '</div>';

        // === 📊 Today Card ===
        html += '<div class="stats-card"><div class="stats-card-title">📊 Today</div>';
        const todayStats = this.getTodayStats();
        const totalSeconds = Object.values(todayStats).reduce((a, b) => a + b, 0);
        if (totalSeconds === 0) {
            html += '<div class="stats-empty">No activity yet</div>';
        } else {
            html += '<div class="activity-tiles">';
            const order = ['reading', 'dancing', 'thinking', 'sleepy'];
            order.forEach(a => {
                if (todayStats[a]) {
                    html += `<div class="activity-tile"><span class="tile-emoji">${this.getActivityEmoji(a)}</span><span class="tile-duration">${this.formatDuration(todayStats[a])}</span></div>`;
                }
            });
            html += '</div>';
            html += `<div class="stats-total-row">Total · ${this.formatDuration(totalSeconds)}</div>`;
        }
        html += '</div>';

        container.innerHTML = html;

        // Re-attach custom timer events
        const setBtn = container.querySelector('[data-timer-preset-selector]');
        if (setBtn) {
            setBtn.addEventListener('click', () => {
                const input = document.getElementById('timer-custom-input');
                if (input) {
                    const val = parseInt(input.value);
                    if (val && val > 0 && val <= 480) {
                        this.setRoomTimer(val * 60);
                    }
                }
            });
        }
        const custInput = document.getElementById('timer-custom-input');
        if (custInput) {
            custInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const val = parseInt(custInput.value);
                    if (val && val > 0 && val <= 480) {
                        this.setRoomTimer(val * 60);
                    }
                }
            });
        }
    }

    cleanup() {
        this.disconnect();
    }
}
