// SoftBody class for the creature
// Large circle + 3 smaller orbiting circles (double pendulum style)

class SoftBody {
    constructor(centerX, centerY, radius, numParticles = 16, customColor = null, puffState = null) {
        this.particles = [];
        this.constraints = [];
        this.radius = radius;
        this.baseColor = customColor || '#ffd6cc'; // Use custom color or default
        this.color = this.baseColor;
        this.baseRadius = radius;
        this.numParticles = numParticles;

        // Puff state (hunger, mood, energy) - values 0-100
        // Handle null values from database
        this.puffState = {
            hunger: puffState?.hunger ?? 50,  // 0 = starving (dark), 100 = full (normal color)
            mood: puffState?.mood ?? 50,      // 0 = very sad (melty), 100 = very happy (normal)
            energy: puffState?.energy ?? 50   // 0 = exhausted (slow), 100 = full energy (fast)
        };

        // Sleep state
        this.isSleeping = false;

        // Activity state (null, 'reading', 'dancing', 'sleepy', 'thinking')
        this.activity = null;

        // Dance animation particles
        this.danceNotes = [];
        this.lastDanceNoteTime = 0;

        // Eating animation state
        this.isEating = false;
        this.eatingTimer = 0;
        this.eatingDuration = 600; // ms
        this.chewCount = 0;
        this.chewMax = 3; // Number of chews

        // Sleep particles (z-z-z)
        this.sleepParticles = [];
        this.lastSleepParticleTime = 0;

        // Apply initial color calculation based on hunger
        this.updateColorByHunger();

        // YENİ SİSTEM: Büyük düzensiz daire + 6 küçük hareketli daire
        this.mainCircle = {
            x: centerX,
            y: centerY,
            radius: radius * 1.2,  // Daha büyük!
            angle: 0,
            rotationSpeed: 0.001,
            // Ana yuvarlağın şekli için düzensizlik
            deformPoints: []
        };

        // Ana yuvarlağın etrafına düzensizlik noktaları ekle
        const numDeformPoints = 12;
        for (let i = 0; i < numDeformPoints; i++) {
            const angle = (i / numDeformPoints) * Math.PI * 2;
            // Rastgele deformasyon
            const deform = 0.8 + Math.random() * 0.4; // 0.8 ile 1.2 arası
            this.mainCircle.deformPoints.push({
                angle: angle,
                deform: deform,
                speed: 0.0005 + Math.random() * 0.001 // Her nokta farklı hızda deforme olsun
            });
        }

        // 6 küçük daire (yumrular) - her biri farklı hareket
        this.smallCircles = [
            { angle: 0, speed: 0.002, baseRadius: radius * 0.25, distance: radius * 0.5, phase: 0, radiusOscillationSpeed: 0.003 },
            { angle: 1.0, speed: 0.004, baseRadius: radius * 0.18, distance: radius * 0.55, phase: 2, radiusOscillationSpeed: -0.002 },
            { angle: 2.5, speed: -0.003, baseRadius: radius * 0.22, distance: radius * 0.45, phase: 4, radiusOscillationSpeed: 0.004 },
            { angle: 3.8, speed: 0.0025, baseRadius: radius * 0.15, distance: radius * 0.6, phase: 1, radiusOscillationSpeed: -0.0035 },
            { angle: 4.5, speed: -0.0018, baseRadius: radius * 0.2, distance: radius * 0.4, phase: 3.5, radiusOscillationSpeed: 0.0025 },
            { angle: 5.5, speed: 0.0035, baseRadius: radius * 0.17, distance: radius * 0.52, phase: 5.2, radiusOscillationSpeed: -0.0018 }
        ];

        // Orijinal soft-body'i de tut (physics için)
        this.createOriginalSoftBody(centerX, centerY, radius, numParticles);
    }

    createOriginalSoftBody(centerX, centerY, radius, numParticles) {
        // Create particles in a circular pattern
        for (let i = 0; i < numParticles; i++) {
            const angle = (i / numParticles) * Math.PI * 2;

            // Add organic variation
            const variation = Math.sin(angle * 3) * 0.15 +
                             Math.cos(angle * 2) * 0.1 +
                             Math.sin(angle * 5) * 0.05;

            const r = radius * (1 + variation);
            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;

            this.particles.push(new Particle(x, y, 1.0));
        }

        // Create central particle
        this.centerParticle = new Particle(centerX, centerY, 1.5);
        this.particles.push(this.centerParticle);

        // Connect edge particles
        for (let i = 0; i < numParticles; i++) {
            const next = (i + 1) % numParticles;
            this.constraints.push(new Constraint(this.particles[i], this.particles[next], 0.8));
        }

        // Connect to center
        for (let i = 0; i < numParticles; i++) {
            this.constraints.push(new Constraint(this.particles[i], this.centerParticle, 0.4));
        }

        // Face positions
        this.eyeLeftOffset = { x: -radius * 0.25, y: -radius * 0.1 };
        this.eyeRightOffset = { x: radius * 0.25, y: -radius * 0.1 };
        this.mouthOffset = { x: 0, y: radius * 0.2 };
    }

    // Get all particles
    getParticles() {
        return this.particles;
    }

    // Get all constraints
    getConstraints() {
        return this.constraints;
    }

    // Find the nearest particle to a point
    findNearestParticle(x, y, maxDistance = 100) {
        let nearest = null;
        let minDist = maxDistance;

        for (const particle of this.particles) {
            const dx = particle.x - x;
            const dy = particle.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < minDist) {
                minDist = dist;
                nearest = particle;
            }
        }

        return nearest;
    }

    // Update small circles (double pendulum animation)
    updateSmallCircles() {
        const energy = this.puffState.energy || 50;
        const energyFactor = energy / 100; // 0 = exhausted, 1 = full energy

        const time = Date.now() * 0.001;

        // Ana yuvarlağı döndür - energy affects rotation speed dramatically
        // Low energy = very slow rotation, high energy = normal rotation
        this.mainCircle.angle += this.mainCircle.rotationSpeed * (0.05 + energyFactor * 0.95);

        // Ana yuvarlağın deformasyonunu güncelle - energy affects movement amount dramatically
        this.mainCircle.deformPoints.forEach(point => {
            // Very low energy = barely moving, high energy = normal movement
            const movementScale = 0.002 + energyFactor * 0.118; // 0.002 to 0.12 (much more dramatic)
            point.currentDeform = point.deform + Math.sin(time * point.speed * 1000) * movementScale;
        });

        // Update main circle position to follow center particle
        this.mainCircle.x = this.centerParticle.x;
        this.mainCircle.y = this.centerParticle.y;
    }

    // Apply organic deformation - updates main circle animation
    applyOrganicDeformation() {
        // Update main circle rotation and deformation
        this.updateSmallCircles();

        // Update color based on hunger
        this.updateColorByHunger();
    }

    // Update color based on fullness (logarithmic)
    // 0 = starving (dark), 100 = full (normal color)
    // Logarithmic: 0=very dark, 10=much lighter, 25=almost normal, 50+=normal
    updateColorByHunger() {
        const fullness = this.puffState.hunger || 50; // Still called hunger in DB but means fullness

        // Logarithmic scale: rapid lightening at low values, then plateaus
        // Using: darken = maxDarken * (1 - (fullness/50)^0.5) for 0-50 range
        // This gives: 0→80, 10→~45, 25→~20, 50→0, 50-100→0

        let darkenAmount;

        if (fullness >= 50) {
            // 50-100: essentially no darkening (normal color)
            darkenAmount = 0;
        } else {
            // 0-50: logarithmic decay
            // (fullness/50)^0.5 gives: 0→0, 10→0.45, 25→0.71, 50→1
            const normalizedFullness = fullness / 50;
            const logFactor = Math.sqrt(normalizedFullness); // Square root for logarithmic-like curve
            darkenAmount = 80 * (1 - logFactor);
        }

        if (darkenAmount < 1) {
            // Essentially normal color
            this.color = this.baseColor;
        } else {
            // Apply darkening
            this.color = this.getDarkerColor(this.baseColor, darkenAmount);
        }
    }

    // Update puff state
    updateState(newState) {
        if (newState.hunger !== undefined) this.puffState.hunger = newState.hunger;
        if (newState.mood !== undefined) this.puffState.mood = newState.mood;
        if (newState.energy !== undefined) this.puffState.energy = newState.energy;
    }

    // Set sleep state
    setSleepState(isSleeping) {
        this.isSleeping = isSleeping;
        // Clear particles when waking up
        if (!isSleeping) {
            this.sleepParticles = [];
        }
    }

    // Set activity state (visual behavior like reading)
    setActivity(activity) {
        this.activity = activity;
        // Clear dance particles when switching away from dancing
        if (activity !== 'dancing') {
            this.danceNotes = [];
        }
    }

    // Start eating animation
    startEating() {
        this.isEating = true;
        this.eatingTimer = Date.now();
        this.chewCount = 0;
    }

    // Update eating animation
    updateEating() {
        if (!this.isEating) return 0;

        const elapsed = Date.now() - this.eatingTimer;
        const chewDuration = 150; // ms per chew

        if (elapsed > this.eatingDuration) {
            this.isEating = false;
            return 0;
        }

        // Calculate chew animation (0 to 1, oscillating)
        this.chewCount = Math.floor(elapsed / chewDuration);
        const chewProgress = (elapsed % chewDuration) / chewDuration;

        // Return squash/stretch amount (-1 to 1)
        return Math.sin(chewProgress * Math.PI * 2) * 0.15;
    }

    // Draw the creature on canvas
    draw(ctx) {
        // Update mainCircle position to follow the center particle
        this.mainCircle.x = this.centerParticle.x;
        this.mainCircle.y = this.centerParticle.y;

        // Dance wobble — subtle body sway
        if (this.activity === 'dancing') {
            const t = Date.now() * 0.003;
            this.mainCircle.x += Math.sin(t * 1.3) * this.radius * 0.06;
            this.mainCircle.y += Math.sin(t * 1.7 + 1) * this.radius * 0.04;
        }

        // Breathing animation when sleeping
        let breathingScale = 1.0;
        if (this.isSleeping) {
            // Slow breathing: sine wave with period of ~3 seconds
            const time = Date.now() * 0.002;
            breathingScale = 1.0 + Math.sin(time) * 0.03; // ±3% size variation
        }

        const numPoints = this.mainCircle.deformPoints.length;

        // Apply mood-based squishy deformation (low mood = wide and short)
        const mood = this.puffState.mood || 50;
        const moodFactor = (100 - mood) / 100; // 0 = happy (normal), 1 = very sad (squishy)

        // Get eating animation squash/stretch
        const eatingAnim = this.updateEating();

        // Yumuşak eğrilerle düzensiz şekli çiz
        // İlk noktanın orta noktasından başla
        const firstPoint = this.mainCircle.deformPoints[0];
        const lastPoint = this.mainCircle.deformPoints[numPoints - 1];

        let firstDeform = (firstPoint.currentDeform || firstPoint.deform);
        let lastDeform = (lastPoint.currentDeform || lastPoint.deform);

        const firstAngle = firstPoint.angle + this.mainCircle.angle;
        const lastAngle = lastPoint.angle + this.mainCircle.angle;

        // Apply mood-based squishy effect to first/last points (smoothly, no sharp corners)
        const firstSin = Math.sin(firstAngle);
        const lastSin = Math.sin(lastAngle);
        const firstCos = Math.cos(firstAngle);
        const lastCos = Math.cos(lastAngle);

        // Smooth horizontal expansion using cos^2 (max at sides, zero at top/bottom)
        if (moodFactor > 0 || eatingAnim !== 0) {
            // Expand outward at sides, shrink vertically at top/bottom (mood)
            let horizontalExpansion = moodFactor * 0.3 * firstCos * firstCos;
            let verticalShrink = moodFactor * 0.15 * firstSin * firstSin;

            // Add eating animation - chewing makes it stretch up/down
            if (eatingAnim !== 0) {
                // When chewing, vertical stretch
                verticalShrink -= eatingAnim * firstSin * firstSin;
                horizontalExpansion += eatingAnim * 0.1 * firstCos * firstCos;
            }

            firstDeform += horizontalExpansion;
            firstDeform -= verticalShrink;

            let lastHorizontalExpansion = moodFactor * 0.3 * lastCos * lastCos;
            let lastVerticalShrink = moodFactor * 0.15 * lastSin * lastSin;

            if (eatingAnim !== 0) {
                lastVerticalShrink -= eatingAnim * lastSin * lastSin;
                lastHorizontalExpansion += eatingAnim * 0.1 * lastCos * lastCos;
            }

            lastDeform += lastHorizontalExpansion;
            lastDeform -= lastVerticalShrink;
        }

        const firstX = this.mainCircle.x + Math.cos(firstAngle) * this.mainCircle.radius * breathingScale * firstDeform;
        const firstY = this.mainCircle.y + Math.sin(firstAngle) * this.mainCircle.radius * breathingScale * firstDeform;
        const lastX = this.mainCircle.x + Math.cos(lastAngle) * this.mainCircle.radius * breathingScale * lastDeform;
        const lastY = this.mainCircle.y + Math.sin(lastAngle) * this.mainCircle.radius * breathingScale * lastDeform;

        const midX = (firstX + lastX) / 2;
        const midY = (firstY + lastY) / 2;

        // İlk olarak shape'i başlat (hem fill hem stroke için)
        ctx.beginPath();

        ctx.moveTo(midX, midY);

        // Her nokta için quadratic curve kullan
        for (let i = 0; i < numPoints; i++) {
            const point = this.mainCircle.deformPoints[i];
            let deform = point.currentDeform || point.deform;
            const angle = point.angle + this.mainCircle.angle;

            // Apply mood-based squishy deformation (wide and short, not tall)
            // Smooth transition using cos^2 and sin^2 - no sharp corners
            if (moodFactor > 0 || eatingAnim !== 0) {
                const sinAngle = Math.sin(angle);
                const cosAngle = Math.cos(angle);

                // Expand horizontally at sides (cos^2 = max at sides, 0 at top/bottom)
                let horizontalExpansion = moodFactor * 0.3 * cosAngle * cosAngle;

                // Shrink vertically at top/bottom (sin^2 = max at top/bottom, 0 at sides)
                let verticalShrink = moodFactor * 0.15 * sinAngle * sinAngle;

                // Add eating animation
                if (eatingAnim !== 0) {
                    verticalShrink -= eatingAnim * sinAngle * sinAngle;
                    horizontalExpansion += eatingAnim * 0.1 * cosAngle * cosAngle;
                }

                deform += horizontalExpansion;
                deform -= verticalShrink;
            }

            const x = this.mainCircle.x + Math.cos(angle) * this.mainCircle.radius * breathingScale * deform;
            const y = this.mainCircle.y + Math.sin(angle) * this.mainCircle.radius * breathingScale * deform;

            // Bir sonraki noktanın orta noktasını hesapla
            const nextPoint = this.mainCircle.deformPoints[(i + 1) % numPoints];
            let nextDeform = nextPoint.currentDeform || nextPoint.deform;
            const nextAngle = nextPoint.angle + this.mainCircle.angle;

            // Apply mood-based deformation for next point too
            if (moodFactor > 0 || eatingAnim !== 0) {
                const nextSin = Math.sin(nextAngle);
                const nextCos = Math.cos(nextAngle);

                let nextHorizontalExpansion = moodFactor * 0.3 * nextCos * nextCos;
                let nextVerticalShrink = moodFactor * 0.15 * nextSin * nextSin;

                // Add eating animation
                if (eatingAnim !== 0) {
                    nextVerticalShrink -= eatingAnim * nextSin * nextSin;
                    nextHorizontalExpansion += eatingAnim * 0.1 * nextCos * nextCos;
                }

                nextDeform += nextHorizontalExpansion;
                nextDeform -= nextVerticalShrink;
            }

            const nextX = this.mainCircle.x + Math.cos(nextAngle) * this.mainCircle.radius * breathingScale * nextDeform;
            const nextY = this.mainCircle.y + Math.sin(nextAngle) * this.mainCircle.radius * breathingScale * nextDeform;

            const nextMidX = (x + nextX) / 2;
            const nextMidY = (y + nextY) / 2;

            // Quadratic curve ile yumuşat
            ctx.quadraticCurveTo(x, y, nextMidX, nextMidY);
        }

        ctx.closePath();

        // Fill with color
        ctx.fillStyle = this.color;
        ctx.fill();

        // Draw outline (darker shade of main color)
        ctx.strokeStyle = this.getDarkerColor(this.color);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Draw the face on top
        this.drawFace(ctx);

        // Draw activity visuals in front of body, below face
        if (this.activity === 'reading') {
            this.drawBook(ctx);
        } else if (this.activity === 'dancing') {
            this.drawDanceNotes(ctx);
        } else if (this.activity === 'thinking') {
            this.drawThoughtBubble(ctx);
        }

        // Draw sleep particles (z-z-z)
        if (this.isSleeping || this.activity === 'sleepy') {
            this.drawSleepParticles(ctx);
        }
    }

    // Draw sleep particles (z-z-z effect)
    drawSleepParticles(ctx) {
        const currentTime = Date.now();

        // Add new particle every 2 seconds
        if (currentTime - this.lastSleepParticleTime > 2000) {
            this.lastSleepParticleTime = currentTime;
            this.sleepParticles.push({
                x: this.centerParticle.x + this.radius * 0.5,
                y: this.centerParticle.y - this.radius * 0.5,
                vx: 0.5 + Math.random() * 0.5, // Move right
                vy: -0.3 - Math.random() * 0.3, // Move up
                life: 1.0, // Life from 1.0 to 0.0
                scale: 0.8 + Math.random() * 0.4
            });
        }

        // Update and draw particles
        ctx.fillStyle = this.getContrastColor();
        ctx.font = `${this.radius * 0.15}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = this.sleepParticles.length - 1; i >= 0; i--) {
            const p = this.sleepParticles[i];

            // Update position
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.005; // Fade out

            // Remove dead particles
            if (p.life <= 0) {
                this.sleepParticles.splice(i, 1);
                continue;
            }

            // Draw "z" with fading
            ctx.globalAlpha = p.life * 0.6;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.scale(p.scale, p.scale);
            ctx.fillText('z', 0, 0);
            ctx.restore();
        }

        ctx.globalAlpha = 1.0; // Reset alpha
    }

    // Draw a single hand-drawn stroke with variation
    drawHandDrawnStroke(ctx, numEdgeParticles, lineWidth, offsetPhase) {
        ctx.beginPath();
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 0.7; // Semi-transparent for layered stroke effect

        const first = this.particles[0];
        const last = this.particles[numEdgeParticles - 1];
        const midX = (first.x + last.x) / 2;
        const midY = (first.y + last.y) / 2;

        ctx.moveTo(midX, midY);

        // Draw curve with hand-drawn jitter
        for (let i = 0; i < numEdgeParticles; i++) {
            const current = this.particles[i];
            const next = this.particles[(i + 1) % numEdgeParticles];

            const nextMidX = (current.x + next.x) / 2;
            const nextMidY = (current.y + next.y) / 2;

            // Add hand-drawn wobble and jitter
            const time = Date.now() * 0.002;
            const jitter = 2;
            const wobbleX = Math.sin(i * 0.8 + time + offsetPhase) * jitter +
                           (Math.random() - 0.5) * jitter * 0.5;
            const wobbleY = Math.cos(i * 0.7 + time + offsetPhase) * jitter +
                           (Math.random() - 0.5) * jitter * 0.5;

            ctx.quadraticCurveTo(
                current.x + wobbleX,
                current.y + wobbleY,
                nextMidX,
                nextMidY
            );
        }

        ctx.closePath();
        ctx.stroke();
        ctx.globalAlpha = 1.0; // Reset alpha
    }

    // Draw the face (eyes and smile)
    drawFace(ctx) {
        const centerX = this.centerParticle.x;
        const centerY = this.centerParticle.y;

        // Calculate face position based on current shape
        const leftEyeX = centerX + this.eyeLeftOffset.x;
        const leftEyeY = centerY + this.eyeLeftOffset.y;
        const rightEyeX = centerX + this.eyeRightOffset.x;
        const rightEyeY = centerY + this.eyeRightOffset.y;
        const mouthX = centerX + this.mouthOffset.x;
        const mouthY = centerY + this.mouthOffset.y;

        ctx.fillStyle = this.getContrastColor();
        ctx.strokeStyle = this.getContrastColor();

        // Draw eyes - closed if sleeping
        if (this.isSleeping || this.activity === 'sleepy') {
            // Closed eyes (arcs)
            ctx.lineWidth = this.radius * 0.03;
            ctx.lineCap = 'round';

            // Left eye (closed arc)
            ctx.beginPath();
            ctx.arc(leftEyeX, leftEyeY, this.radius * 0.08, 0.2 * Math.PI, 0.8 * Math.PI);
            ctx.stroke();

            // Right eye (closed arc)
            ctx.beginPath();
            ctx.arc(rightEyeX, rightEyeY, this.radius * 0.08, 0.2 * Math.PI, 0.8 * Math.PI);
            ctx.stroke();
        } else if (this.activity === 'reading') {
            // Animated reading eyes — pupils wander as if scanning text
            const t = Date.now() * 0.001;
            const eyeR = this.radius * 0.08;
            const pupilR = eyeR * 0.55;

            // Subtle wandering: horizontal scanning + slow vertical drift
            const wanderX = Math.sin(t * 1.2) * this.radius * 0.025;
            const wanderY = this.radius * 0.03 + Math.sin(t * 0.7 + 1.0) * this.radius * 0.008;

            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = this.getContrastColor();
            ctx.lineWidth = 1;

            // Left eye
            ctx.beginPath();
            ctx.arc(leftEyeX, leftEyeY, eyeR, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(leftEyeX + wanderX, leftEyeY + wanderY, pupilR, 0, Math.PI * 2);
            ctx.fillStyle = '#333';
            ctx.fill();

            // Right eye
            ctx.beginPath();
            ctx.arc(rightEyeX, rightEyeY, eyeR, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(rightEyeX + wanderX, rightEyeY + wanderY, pupilR, 0, Math.PI * 2);
            ctx.fillStyle = '#333';
            ctx.fill();
        } else if (this.activity === 'dancing') {
            // Happy squint eyes ^ ^ — upward arcs (∩) = mutlu gözler
            const eyeR = this.radius * 0.09;
            ctx.strokeStyle = this.getContrastColor();
            ctx.lineWidth = this.radius * 0.028;
            ctx.lineCap = 'round';

            // Left eye — arc from left to right through TOP = ∩ shape
            ctx.beginPath();
            ctx.arc(leftEyeX, leftEyeY, eyeR, 0, Math.PI, true);
            ctx.stroke();

            // Right eye
            ctx.beginPath();
            ctx.arc(rightEyeX, rightEyeY, eyeR, 0, Math.PI, true);
            ctx.stroke();
        } else if (this.activity === 'thinking') {
            // Thinking — pupils shifted toward thought bubble (upper-right)
            const eyeR = this.radius * 0.09;
            const pupilR = eyeR * 0.5;
            const pupilX = this.radius * 0.03;
            const pupilY = this.radius * 0.035;

            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = this.getContrastColor();
            ctx.lineWidth = 1;

            // Left eye
            ctx.beginPath();
            ctx.arc(leftEyeX, leftEyeY, eyeR, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(leftEyeX + pupilX, leftEyeY - pupilY, pupilR, 0, Math.PI * 2);
            ctx.fillStyle = '#333';
            ctx.fill();

            // Right eye
            ctx.beginPath();
            ctx.arc(rightEyeX, rightEyeY, eyeR, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(rightEyeX + pupilX, rightEyeY - pupilY, pupilR, 0, Math.PI * 2);
            ctx.fillStyle = '#333';
            ctx.fill();
        } else {
            // Open eyes (simple dots)
            ctx.fillStyle = this.getContrastColor();
            ctx.beginPath();
            ctx.arc(leftEyeX, leftEyeY, this.radius * 0.08, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.arc(rightEyeX, rightEyeY, this.radius * 0.08, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw mouth based on mood - narrow, cute mouth
        // Mood 100 = very sad (downward U), Mood 50 = neutral (flat line), Mood 0 = very happy (upward U)
        const mood = this.puffState.mood || 50;

        ctx.lineWidth = this.radius * 0.025;
        ctx.lineCap = 'round';

        const mouthHalfWidth = this.radius * 0.1;

        // Activity-specific mouths
        if (this.activity === 'dancing' && !this.isEating) {
            // Big happy smile (∪) — corners up, center down
            const bigW = this.radius * 0.15;
            const smileDepth = this.radius * 0.12;
            ctx.strokeStyle = this.getContrastColor();
            ctx.beginPath();
            ctx.moveTo(mouthX - bigW, mouthY - smileDepth * 0.3);
            ctx.quadraticCurveTo(mouthX, mouthY + smileDepth, mouthX + bigW, mouthY - smileDepth * 0.3);
            ctx.stroke();
        } else if (this.activity === 'thinking' && !this.isEating) {
            // Pursed thinking mouth — small wavy line
            ctx.strokeStyle = this.getContrastColor();
            ctx.beginPath();
            ctx.moveTo(mouthX - mouthHalfWidth, mouthY - this.radius * 0.01);
            ctx.quadraticCurveTo(mouthX - mouthHalfWidth * 0.5, mouthY + this.radius * 0.03, mouthX, mouthY - this.radius * 0.01);
            ctx.quadraticCurveTo(mouthX + mouthHalfWidth * 0.5, mouthY - this.radius * 0.04, mouthX + mouthHalfWidth, mouthY - this.radius * 0.01);
            ctx.stroke();
        } else if (this.isEating) {
            const chewOpen = (Math.abs(this.updateEating()) > 0.07);
            if (chewOpen) {
                // Open mouth - small oval
                ctx.ellipse(mouthX, mouthY, mouthHalfWidth, this.radius * 0.08, 0, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                // Closed mouth - small line
                ctx.moveTo(mouthX - mouthHalfWidth, mouthY);
                ctx.lineTo(mouthX + mouthHalfWidth, mouthY);
                ctx.stroke();
            }
        } else if (mood >= 50) {
            // Sad to very sad - downward U (frown)
            // As mood goes from 50 UP TO 100, curve gets deeper (more sad)
            const sadnessAmount = (mood - 50) / 50; // 0 to 1
            const curveDepth = sadnessAmount * this.radius * 0.18; // Deeper curve for more n-like

            // Left point (higher)
            ctx.moveTo(mouthX - mouthHalfWidth, mouthY - curveDepth * 0.3);
            // Curve to right point, bowing downward - control point is lower
            ctx.quadraticCurveTo(mouthX, mouthY + curveDepth, mouthX + mouthHalfWidth, mouthY - curveDepth * 0.3);
            ctx.stroke();
        } else {
            // Happy to very happy - upward U (smile)
            // As mood goes from 50 DOWN TO 0, curve gets deeper (more happy)
            const happinessAmount = (50 - mood) / 50; // 0 to 1
            const curveDepth = happinessAmount * this.radius * 0.15; // Deeper curve for more U-like

            // Left point (lower)
            ctx.moveTo(mouthX - mouthHalfWidth, mouthY + curveDepth * 0.3);
            // Curve to right point, bowing upward - control point is higher
            ctx.quadraticCurveTo(mouthX, mouthY - curveDepth, mouthX + mouthHalfWidth, mouthY + curveDepth * 0.3);
            ctx.stroke();
        }
    }

    // Draw an open book in front of the puff (reading activity)
    drawBook(ctx) {
        const cx = this.centerParticle.x;
        const cy = this.centerParticle.y;
        const r = this.radius;

        // Perspective: book tilted away from us (bottom closer, top further)
        // Open book viewed from front — wider at bottom, narrower at top
        const bookY = cy + r * 0.34;
        const botHalfW = r * 0.50;  // bottom half-width (closer)
        const topHalfW = r * 0.32;  // top half-width (further)
        const h = r * 0.28;         // height
        const spineW = r * 0.04;    // visible spine/center gap

        ctx.save();

        // --- Left page (trapezoid with curved top) ---
        ctx.beginPath();
        ctx.moveTo(cx + spineW, bookY + h * 0.3);                                 // bottom spine
        ctx.lineTo(cx - botHalfW, bookY + h * 0.55);                              // bottom left
        ctx.quadraticCurveTo(cx - topHalfW * 0.6, bookY - h * 0.3, cx - topHalfW + spineW, bookY - h * 0.05); // top left with curve
        ctx.lineTo(cx + spineW, bookY - h * 0.05);                                 // top spine
        ctx.closePath();

        let grad = ctx.createLinearGradient(cx - botHalfW, bookY, cx, bookY);
        grad.addColorStop(0, '#f5f0e0');
        grad.addColorStop(1, '#efe8d0');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = '#d4c9a8';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // --- Right page (mirrored) ---
        ctx.beginPath();
        ctx.moveTo(cx - spineW, bookY + h * 0.3);                                 // bottom spine
        ctx.lineTo(cx + botHalfW, bookY + h * 0.55);                              // bottom right
        ctx.quadraticCurveTo(cx + topHalfW * 0.6, bookY - h * 0.3, cx + topHalfW - spineW, bookY - h * 0.05); // top right with curve
        ctx.lineTo(cx - spineW, bookY - h * 0.05);                                 // top spine
        ctx.closePath();

        grad = ctx.createLinearGradient(cx + botHalfW, bookY, cx, bookY);
        grad.addColorStop(0, '#f5f0e0');
        grad.addColorStop(1, '#efe8d0');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.stroke();

        // --- Spine (the V-gap / center fold) ---
        ctx.beginPath();
        ctx.moveTo(cx - spineW, bookY - h * 0.05);
        ctx.lineTo(cx + spineW, bookY - h * 0.05);
        ctx.lineTo(cx + spineW, bookY + h * 0.3);
        ctx.lineTo(cx - spineW, bookY + h * 0.3);
        ctx.closePath();
        ctx.fillStyle = '#d8d0b8';
        ctx.fill();
        ctx.strokeStyle = '#b8a88a';
        ctx.lineWidth = 1;
        ctx.stroke();

        // --- Cover edges (brown border on outer edges) ---
        ctx.strokeStyle = '#8b6914';
        ctx.lineWidth = 2.5;

        // Left cover edge
        ctx.beginPath();
        ctx.moveTo(cx - botHalfW, bookY + h * 0.55);
        ctx.lineTo(cx - topHalfW + spineW * 0.5, bookY - h * 0.02);
        ctx.stroke();

        // Right cover edge
        ctx.beginPath();
        ctx.moveTo(cx + botHalfW, bookY + h * 0.55);
        ctx.lineTo(cx + topHalfW - spineW * 0.5, bookY - h * 0.02);
        ctx.stroke();

        // Bottom cover edge (connecting both sides)
        ctx.beginPath();
        ctx.moveTo(cx - botHalfW, bookY + h * 0.55);
        ctx.quadraticCurveTo(cx, bookY + h * 0.35, cx + botHalfW, bookY + h * 0.55);
        ctx.strokeStyle = '#8b6914';
        ctx.lineWidth = 2;
        ctx.stroke();

        // --- Text lines on left page ---
        ctx.strokeStyle = 'rgba(120, 90, 50, 0.2)';
        ctx.lineWidth = 0.8;
        for (let i = 0; i < 3; i++) {
            const t = 0.15 + i * 0.22;
            const ly = bookY + h * (t - 0.05) * 0.9;
            const lx1 = cx - botHalfW + r * 0.06;
            const lx2 = cx - spineW - r * 0.02;
            const rx1 = cx + spineW + r * 0.02;
            const rx2 = cx + botHalfW - r * 0.06;

            // Interpolate for perspective: top is narrower
            const frac = 1 - (t / 0.85);
            const p1x = lx1 * frac + (cx - topHalfW + r * 0.06) * (1 - frac);
            const p2x = lx2 * frac + (cx - spineW * 0.5) * (1 - frac);
            const p3x = rx1 * frac + (cx + spineW * 0.5) * (1 - frac);
            const p4x = rx2 * frac + (cx + topHalfW - r * 0.06) * (1 - frac);

            ctx.beginPath();
            ctx.moveTo(p1x, ly);
            ctx.lineTo(p2x, ly);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(p3x, ly);
            ctx.lineTo(p4x, ly);
            ctx.stroke();
        }

        // --- Page edge (top — thin cream strip showing thickness) ---
        ctx.beginPath();
        ctx.moveTo(cx - topHalfW + spineW, bookY - h * 0.05);
        ctx.quadraticCurveTo(cx, bookY - h * 0.1, cx + topHalfW - spineW, bookY - h * 0.05);
        ctx.strokeStyle = 'rgba(220, 200, 170, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }

    // Draw floating music notes (dancing activity)
    drawDanceNotes(ctx) {
        const currentTime = Date.now();

        // Add new note periodically
        if (currentTime - this.lastDanceNoteTime > 700) {
            this.lastDanceNoteTime = currentTime;
            this.danceNotes.push({
                x: this.centerParticle.x + (Math.random() - 0.5) * this.radius * 0.8,
                y: this.centerParticle.y - this.radius * 0.5,
                vx: (Math.random() - 0.5) * 1.2,
                vy: -0.8 - Math.random() * 0.6,
                life: 1.0,
                note: Math.random() > 0.5 ? '♫' : '♪'
            });
        }

        // Update and draw notes
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = this.danceNotes.length - 1; i >= 0; i--) {
            const n = this.danceNotes[i];
            n.x += n.vx;
            n.y += n.vy;
            n.life -= 0.008;
            if (n.life <= 0) {
                this.danceNotes.splice(i, 1);
                continue;
            }
            ctx.globalAlpha = n.life * 0.8;
            ctx.font = `${this.radius * 0.2}px serif`;
            ctx.fillStyle = this.getContrastColor();
            ctx.fillText(n.note, n.x + Math.sin(currentTime * 0.003 + i) * 2, n.y);
        }
        ctx.restore();
    }

    // Draw thought bubble (thinking activity)
    drawThoughtBubble(ctx) {
        const cx = this.centerParticle.x;
        const cy = this.centerParticle.y;
        const r = this.radius;

        // Gentle bobbing animation
        const bob = Math.sin(Date.now() * 0.002) * r * 0.025;

        // Position to upper-right of puff
        const bx = cx + r * 0.5;
        const by = cy - r * 0.85 + bob;
        const bw = r * 0.38;
        const bh = r * 0.26;

        ctx.save();

        // Main bubble
        ctx.beginPath();
        ctx.ellipse(bx, by, bw, bh, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // "..." text
        ctx.fillStyle = '#666';
        ctx.font = `bold ${bh * 0.45}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('...', bx, by + 1);

        // Trailing small bubbles
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        for (let i = 1; i <= 2; i++) {
            const bx2 = bx + (i % 2 === 0 ? 1 : -1) * bw * 0.35;
            const by2 = by + bh * 0.5 + i * bh * 0.25;
            const br = bh * 0.08 * (1 - i * 0.25);
            ctx.beginPath();
            ctx.arc(bx2, by2, br, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        ctx.restore();
    }

    // Get darker shade of the main color for border
    getDarkerColor(hex, amount = 40) {
        const num = parseInt(hex.slice(1), 16);
        const r = Math.max(0, (num >> 16) - amount);
        const g = Math.max(0, ((num >> 8) & 0x00FF) - amount);
        const b = Math.max(0, (num & 0x0000FF) - amount);
        return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
    }

    // Get contrast color (black or white) based on luminance
    getContrastColor(hex = null) {
        const color = hex || this.color;
        const num = parseInt(color.slice(1), 16);
        const r = (num >> 16) & 0xFF;
        const g = (num >> 8) & 0xFF;
        const b = num & 0xFF;

        // Calculate luminance
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

        // Return black for light colors, white for dark colors
        return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
    }
}
