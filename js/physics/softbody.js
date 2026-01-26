// SoftBody class for the creature
// Large circle + 3 smaller orbiting circles (double pendulum style)

class SoftBody {
    constructor(centerX, centerY, radius, numParticles = 16, customColor = null) {
        this.particles = [];
        this.constraints = [];
        this.radius = radius;
        this.color = customColor || '#ffd6cc'; // Use custom color or default
        this.eyeColor = '#4a4a4a'; // Dark gray for eyes
        this.baseRadius = radius;
        this.numParticles = numParticles;

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
        const time = Date.now() * 0.001;

        // Ana yuvarlağı döndür
        this.mainCircle.angle += this.mainCircle.rotationSpeed;

        // Ana yuvarlağın deformasyonunu güncelle
        this.mainCircle.deformPoints.forEach(point => {
            // Yavaşça deformasyon değişsin
            point.currentDeform = point.deform + Math.sin(time * point.speed * 1000) * 0.1;
        });

        // Update main circle position to follow center particle
        this.mainCircle.x = this.centerParticle.x;
        this.mainCircle.y = this.centerParticle.y;
    }

    // Apply organic deformation - updates main circle animation
    applyOrganicDeformation() {
        // Update main circle rotation and deformation
        this.updateSmallCircles();
    }

    // Draw the creature on canvas
    draw(ctx) {
        const numPoints = this.mainCircle.deformPoints.length;

        // Yumuşak eğrilerle düzensiz şekli çiz
        // İlk noktanın orta noktasından başla
        const firstPoint = this.mainCircle.deformPoints[0];
        const lastPoint = this.mainCircle.deformPoints[numPoints - 1];

        const firstDeform = (firstPoint.currentDeform || firstPoint.deform);
        const lastDeform = (lastPoint.currentDeform || lastPoint.deform);

        const firstAngle = firstPoint.angle + this.mainCircle.angle;
        const lastAngle = lastPoint.angle + this.mainCircle.angle;

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
            const deform = point.currentDeform || point.deform;
            const angle = point.angle + this.mainCircle.angle;

            const x = this.mainCircle.x + Math.cos(angle) * this.mainCircle.radius * deform;
            const y = this.mainCircle.y + Math.sin(angle) * this.mainCircle.radius * deform;

            // Bir sonraki noktanın orta noktasını hesapla
            const nextPoint = this.mainCircle.deformPoints[(i + 1) % numPoints];
            const nextDeform = nextPoint.currentDeform || nextPoint.deform;
            const nextAngle = nextPoint.angle + this.mainCircle.angle;

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

        // Draw outline (kendi renginin daha koyusu)
        ctx.strokeStyle = '#d6aea3'; // Pastel pink'in daha koyu versiyonu
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
        ctx.fillStyle = this.eyeColor;
        ctx.beginPath();
        ctx.arc(leftEyeX, leftEyeY, this.radius * 0.08, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(rightEyeX, rightEyeY, this.radius * 0.08, 0, Math.PI * 2);
        ctx.fill();

        // Draw smile (small curve)
        ctx.strokeStyle = this.eyeColor;
        ctx.lineWidth = this.radius * 0.03;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(mouthX, mouthY - this.radius * 0.05, this.radius * 0.15, 0.2, Math.PI - 0.2);
        ctx.stroke();
    }
}
