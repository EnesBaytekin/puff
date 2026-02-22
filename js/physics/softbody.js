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

        // Eating animation state
        this.isEating = false;
        this.eatingTimer = 0;
        this.eatingDuration = 600; // ms
        this.chewCount = 0;
        this.chewMax = 3; // Number of chews

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

        const firstX = this.mainCircle.x + Math.cos(firstAngle) * this.mainCircle.radius * firstDeform;
        const firstY = this.mainCircle.y + Math.sin(firstAngle) * this.mainCircle.radius * firstDeform;
        const lastX = this.mainCircle.x + Math.cos(lastAngle) * this.mainCircle.radius * lastDeform;
        const lastY = this.mainCircle.y + Math.sin(lastAngle) * this.mainCircle.radius * lastDeform;

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

            const x = this.mainCircle.x + Math.cos(angle) * this.mainCircle.radius * deform;
            const y = this.mainCircle.y + Math.sin(angle) * this.mainCircle.radius * deform;

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

            const nextX = this.mainCircle.x + Math.cos(nextAngle) * this.mainCircle.radius * nextDeform;
            const nextY = this.mainCircle.y + Math.sin(nextAngle) * this.mainCircle.radius * nextDeform;

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

        // Draw eyes (simple dots)
        ctx.fillStyle = this.getContrastColor();
        ctx.beginPath();
        ctx.arc(leftEyeX, leftEyeY, this.radius * 0.08, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(rightEyeX, rightEyeY, this.radius * 0.08, 0, Math.PI * 2);
        ctx.fill();

        // Draw mouth based on mood - narrow, cute mouth
        // Mood 100 = very sad (downward U), Mood 50 = neutral (flat line), Mood 0 = very happy (upward U)
        const mood = this.puffState.mood || 50;

        ctx.strokeStyle = this.getContrastColor();
        ctx.lineWidth = this.radius * 0.025; // Slightly thinner for cute look
        ctx.lineCap = 'round';
        ctx.beginPath();

        // Fixed narrow width
        const mouthHalfWidth = this.radius * 0.1; // Half width of mouth

        // If eating, mouth is open/closed based on chew cycle
        if (this.isEating) {
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
