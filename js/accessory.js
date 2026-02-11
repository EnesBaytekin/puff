// Accessory System for Puff

// Accessory class
class Accessory {
    constructor(id, name, type, color = '#ffffff') {
        this.id = id;
        this.name = name;
        this.type = type; // 'hat', 'glasses', 'ribbon', 'bowtie', 'halo', 'crown', 'horn', 'antenna'
        this.color = color;
        this.enabled = true;
    }
}

// Accessory Renderer
class AccessoryRenderer {
    constructor() {
        // Slot system - each slot can hold ONE accessory
        this.slots = {
            hat: null,
            glasses: null,
            head: null,      // ribbon, halo, crown, horns, antenna
            face: null       // eyebrows, mustache
        };
    }

    getSlotForType(type) {
        if (type === 'hat') return 'hat';
        if (type === 'glasses') return 'glasses';
        if (type === 'eyebrows' || type === 'mustache') return 'face';
        return 'head'; // ribbon, bowtie, halo, crown, horns, antenna
    }

    addAccessory(accessory) {
        const slot = this.getSlotForType(accessory.type);
        this.slots[slot] = accessory;
    }

    removeAccessory(accessoryId) {
        Object.keys(this.slots).forEach(slot => {
            if (this.slots[slot] && this.slots[slot].id === accessoryId) {
                this.slots[slot] = null;
            }
        });
    }

    clearAccessories() {
        this.slots = {
            hat: null,
            glasses: null,
            head: null,
            face: null
        };
    }

    hasAccessory(id) {
        return Object.values(this.slots).some(acc => acc && acc.id === id);
    }

    // Get all accessories (for compatibility)
    get accessories() {
        return Object.values(this.slots).filter(acc => acc !== null);
    }

    // Draw all accessories on the puff
    render(ctx, softBody) {
        // Fixed slot order for consistent z-index rendering
        const slotOrder = ['hat', 'glasses', 'head', 'face'];

        slotOrder.forEach(slot => {
            const accessory = this.slots[slot];
            if (!accessory || !accessory.enabled) return;

            switch (accessory.type) {
                case 'hat':
                    this.drawHat(ctx, softBody, accessory);
                    break;
                case 'glasses':
                    this.drawGlasses(ctx, softBody, accessory);
                    break;
                case 'ribbon':
                    this.drawRibbon(ctx, softBody, accessory);
                    break;
                case 'bowtie':
                    this.drawBowtie(ctx, softBody, accessory);
                    break;
                case 'halo':
                    this.drawHalo(ctx, softBody, accessory);
                    break;
                case 'crown':
                    this.drawCrown(ctx, softBody, accessory);
                    break;
                case 'horns':
                    this.drawHorns(ctx, softBody, accessory);
                    break;
                case 'antenna':
                    this.drawAntenna(ctx, softBody, accessory);
                    break;
                case 'eyebrows':
                    this.drawEyebrows(ctx, softBody, accessory);
                    break;
                case 'mustache':
                    this.drawMustache(ctx, softBody, accessory);
                    break;
            }
        });
    }

    // Find top-most particles for hat placement
    getTopParticles(softBody) {
        const particles = softBody.getParticles();
        const center = softBody.centerParticle;

        // Sort by Y position (higher Y = lower on screen, so we want lowest Y)
        const sorted = [...particles].sort((a, b) => a.y - b.y);

        // Return top 5 particles
        return sorted.slice(0, 5);
    }

    // Find particles around the face for glasses
    getFaceParticles(softBody) {
        const particles = softBody.getParticles();
        const center = softBody.centerParticle;

        // Find particles in upper-middle area
        const faceParticles = particles.filter(p => {
            const dy = Math.abs(p.y - center.y);
            const dx = Math.abs(p.x - center.x);
            return dy < softBody.radius * 0.6 && dx < softBody.radius * 0.8;
        });

        return faceParticles;
    }

    // Hat - sits on top of head
    drawHat(ctx, softBody, accessory) {
        // Use mainCircle position for stable positioning (not centerParticle which jiggles)
        const centerX = softBody.mainCircle.x;
        const centerY = softBody.mainCircle.y;
        const radius = softBody.radius;

        // Calculate hat position from main circle center (stable position)
        const avgX = centerX;
        const avgY = centerY - radius * 0.35; // Fixed position relative to center
        const width = radius * 0.7;

        ctx.save();
        ctx.fillStyle = accessory.color;

        // Hat base (brim)
        ctx.beginPath();
        ctx.ellipse(avgX, avgY, width, width * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();

        // Hat top (cylinder)
        const hatHeight = radius * 0.4;
        ctx.fillRect(avgX - width * 0.6, avgY - hatHeight, width * 1.2, hatHeight);

        // Hat top (ellipse)
        ctx.beginPath();
        ctx.ellipse(avgX, avgY - hatHeight, width * 0.6, width * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // Glasses - sits on face
    drawGlasses(ctx, softBody, accessory) {
        const faceParticles = this.getFaceParticles(softBody);
        if (faceParticles.length < 2) return;

        const centerX = softBody.mainCircle.x;
        const centerY = softBody.mainCircle.y;
        const eyeY = centerY - softBody.radius * 0.1;
        const lensSize = softBody.radius * 0.25;
        const bridgeWidth = softBody.radius * 0.15;

        ctx.save();

        // Left lens - fill with semi-transparent color
        ctx.fillStyle = accessory.color + '40'; // Add transparency
        ctx.strokeStyle = accessory.color;
        ctx.lineWidth = 4;

        ctx.beginPath();
        ctx.ellipse(centerX - bridgeWidth - lensSize, eyeY, lensSize, lensSize * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Right lens
        ctx.beginPath();
        ctx.ellipse(centerX + bridgeWidth + lensSize, eyeY, lensSize, lensSize * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Bridge - thicker
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(centerX - bridgeWidth, eyeY);
        ctx.lineTo(centerX + bridgeWidth, eyeY);
        ctx.stroke();

        ctx.restore();
    }

    // Ribbon - on side of head (like hair accessory)
    drawRibbon(ctx, softBody, accessory) {
        const centerX = softBody.mainCircle.x;
        const centerY = softBody.mainCircle.y;
        const radius = softBody.radius;

        // Position on right-top side of head (like hair accessory)
        const avgX = centerX + radius * 0.4;
        const avgY = centerY - radius * 0.3;
        const ribbonSize = radius * 0.2;

        ctx.save();
        ctx.fillStyle = accessory.color;

        // Rotate slightly for angled look
        ctx.translate(avgX, avgY);
        ctx.rotate(0.3); // Tilted angle
        ctx.translate(-avgX, -avgY);

        // Center knot
        ctx.beginPath();
        ctx.arc(avgX, avgY, ribbonSize * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Left bow loop
        ctx.beginPath();
        ctx.ellipse(avgX - ribbonSize, avgY, ribbonSize, ribbonSize * 0.5, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Right bow loop
        ctx.beginPath();
        ctx.ellipse(avgX + ribbonSize, avgY, ribbonSize, ribbonSize * 0.5, 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Ribbon tails flowing down
        ctx.beginPath();
        ctx.moveTo(avgX - ribbonSize * 0.5, avgY + ribbonSize * 0.4);
        ctx.lineTo(avgX - ribbonSize * 0.7, avgY + ribbonSize * 1.2);
        ctx.lineTo(avgX - ribbonSize * 0.3, avgY + ribbonSize * 0.4);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(avgX + ribbonSize * 0.5, avgY + ribbonSize * 0.4);
        ctx.lineTo(avgX + ribbonSize * 0.7, avgY + ribbonSize * 1.2);
        ctx.lineTo(avgX + ribbonSize * 0.3, avgY + ribbonSize * 0.4);
        ctx.fill();

        ctx.restore();
    }

    // Bowtie - at bottom center
    drawBowtie(ctx, softBody, accessory) {
        const centerX = softBody.mainCircle.x;
        const centerY = softBody.mainCircle.y;
        const y = centerY + softBody.radius * 0.5;
        const bowSize = softBody.radius * 0.25;

        ctx.save();
        ctx.fillStyle = accessory.color;

        // Center knot
        ctx.beginPath();
        ctx.arc(centerX, y, bowSize * 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Left triangle
        ctx.beginPath();
        ctx.moveTo(centerX, y);
        ctx.lineTo(centerX - bowSize, y - bowSize * 0.5);
        ctx.lineTo(centerX - bowSize, y + bowSize * 0.5);
        ctx.closePath();
        ctx.fill();

        // Right triangle
        ctx.beginPath();
        ctx.moveTo(centerX, y);
        ctx.lineTo(centerX + bowSize, y - bowSize * 0.5);
        ctx.lineTo(centerX + bowSize, y + bowSize * 0.5);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    // Halo - floating above head
    drawHalo(ctx, softBody, accessory) {
        const centerX = softBody.mainCircle.x;
        const centerY = softBody.mainCircle.y;
        const radius = softBody.radius;

        const haloY = centerY - radius * 0.5;
        const haloRadius = radius * 0.6;

        ctx.save();
        ctx.strokeStyle = accessory.color;
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.7;

        // Draw halo ring (back half only)
        ctx.beginPath();
        ctx.arc(centerX, haloY, haloRadius, Math.PI * 0.8, Math.PI * 2.2);
        ctx.stroke();

        ctx.restore();
    }

    // Crown - on top of head
    drawCrown(ctx, softBody, accessory) {
        const centerX = softBody.mainCircle.x;
        const centerY = softBody.mainCircle.y;
        const radius = softBody.radius;

        const crownWidth = radius * 0.5;
        const crownHeight = radius * 0.5;
        const avgY = centerY - radius * 0.3;

        ctx.save();
        ctx.fillStyle = accessory.color;

        // Crown base
        ctx.beginPath();
        ctx.moveTo(centerX - crownWidth, avgY);
        ctx.lineTo(centerX - crownWidth, avgY - crownHeight * 0.5);
        ctx.lineTo(centerX - crownWidth * 0.6, avgY - crownHeight * 0.3);
        ctx.lineTo(centerX - crownWidth * 0.3, avgY - crownHeight);
        ctx.lineTo(centerX, avgY - crownHeight * 0.6);
        ctx.lineTo(centerX + crownWidth * 0.3, avgY - crownHeight);
        ctx.lineTo(centerX + crownWidth * 0.6, avgY - crownHeight * 0.3);
        ctx.lineTo(centerX + crownWidth, avgY - crownHeight * 0.5);
        ctx.lineTo(centerX + crownWidth, avgY);
        ctx.closePath();
        ctx.fill();

        // Crown gems
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.arc(centerX, avgY - crownHeight * 0.7, crownWidth * 0.1, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#4ecdc4';
        ctx.beginPath();
        ctx.arc(centerX - crownWidth * 0.4, avgY - crownHeight * 0.4, crownWidth * 0.08, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(centerX + crownWidth * 0.4, avgY - crownHeight * 0.4, crownWidth * 0.08, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // Horns - devil style
    drawHorns(ctx, softBody, accessory) {
        const centerX = softBody.mainCircle.x;
        const centerY = softBody.mainCircle.y;
        const radius = softBody.radius;

        const avgY = centerY - radius * 0.3;
        const hornWidth = radius * 0.15;
        const hornHeight = radius * 0.5;

        ctx.save();
        ctx.fillStyle = accessory.color;

        // Left horn
        ctx.beginPath();
        ctx.moveTo(centerX - hornWidth * 2, avgY);
        ctx.quadraticCurveTo(centerX - hornWidth * 4, avgY - hornHeight * 0.5, centerX - hornWidth * 3, avgY - hornHeight);
        ctx.quadraticCurveTo(centerX - hornWidth * 2, avgY - hornHeight * 0.7, centerX - hornWidth, avgY - hornHeight * 0.3);
        ctx.closePath();
        ctx.fill();

        // Right horn
        ctx.beginPath();
        ctx.moveTo(centerX + hornWidth * 2, avgY);
        ctx.quadraticCurveTo(centerX + hornWidth * 4, avgY - hornHeight * 0.5, centerX + hornWidth * 3, avgY - hornHeight);
        ctx.quadraticCurveTo(centerX + hornWidth * 2, avgY - hornHeight * 0.7, centerX + hornWidth, avgY - hornHeight * 0.3);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    // Antenna - single on top
    drawAntenna(ctx, softBody, accessory) {
        const centerX = softBody.mainCircle.x;
        const centerY = softBody.mainCircle.y;
        const radius = softBody.radius;

        const avgX = centerX;
        const avgY = centerY - radius * 0.3;
        const antennaHeight = radius * 0.6;
        const ballSize = radius * 0.12;

        ctx.save();
        ctx.strokeStyle = accessory.color;
        ctx.lineWidth = 3;

        // Antenna stem
        ctx.beginPath();
        ctx.moveTo(avgX, avgY);
        ctx.lineTo(avgX, avgY - antennaHeight);
        ctx.stroke();

        // Antenna ball
        ctx.fillStyle = accessory.color;
        ctx.beginPath();
        ctx.arc(avgX, avgY - antennaHeight, ballSize, 0, Math.PI * 2);
        ctx.fill();

        // Shine on ball
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.arc(avgX - ballSize * 0.3, avgY - antennaHeight - ballSize * 0.3, ballSize * 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // Eyebrows - expressive (sad/puppy dog style)
    drawEyebrows(ctx, softBody, accessory) {
        const centerX = softBody.mainCircle.x;
        const centerY = softBody.mainCircle.y;
        const radius = softBody.radius;

        const browY = centerY - radius * 0.25;
        const browWidth = radius * 0.25;
        const spacing = radius * 0.2;

        ctx.save();
        ctx.strokeStyle = accessory.color;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';

        // Left eyebrow (sad style - outer up, inner down)
        ctx.beginPath();
        ctx.moveTo(centerX - spacing - browWidth, browY - 3);
        ctx.lineTo(centerX - spacing + browWidth * 0.5, browY + 3);
        ctx.stroke();

        // Right eyebrow (sad style - outer up, inner down)
        ctx.beginPath();
        ctx.moveTo(centerX + spacing - browWidth * 0.5, browY + 3);
        ctx.lineTo(centerX + spacing + browWidth, browY - 3);
        ctx.stroke();

        ctx.restore();
    }

    // Mustache - fancy
    drawMustache(ctx, softBody, accessory) {
        const centerX = softBody.mainCircle.x;
        const centerY = softBody.mainCircle.y;
        const radius = softBody.radius;

        const y = centerY + radius * 0.1;
        const mustacheWidth = radius * 0.4;

        ctx.save();
        ctx.fillStyle = accessory.color;

        // Left curl
        ctx.beginPath();
        ctx.moveTo(centerX, y);
        ctx.quadraticCurveTo(centerX - mustacheWidth * 0.5, y - mustacheWidth * 0.2, centerX - mustacheWidth, y + mustacheWidth * 0.3);
        ctx.quadraticCurveTo(centerX - mustacheWidth * 0.5, y + mustacheWidth * 0.1, centerX, y);
        ctx.fill();

        // Right curl
        ctx.beginPath();
        ctx.moveTo(centerX, y);
        ctx.quadraticCurveTo(centerX + mustacheWidth * 0.5, y - mustacheWidth * 0.2, centerX + mustacheWidth, y + mustacheWidth * 0.3);
        ctx.quadraticCurveTo(centerX + mustacheWidth * 0.5, y + mustacheWidth * 0.1, centerX, y);
        ctx.fill();

        ctx.restore();
    }
}

// Available accessories catalog
const ACCESSORY_CATALOG = [
    // Hats
    new Accessory('tophat', 'Top Hat', 'hat', '#1a1a2e'),
    new Accessory('cap', 'Cap', 'hat', '#e74c3c'),
    new Accessory('witchhat', 'Witch Hat', 'hat', '#4a2c7a'),
    new Accessory('santahat', 'Santa Hat', 'hat', '#c41e3a'),

    // Glasses
    new Accessory('sunglasses', 'Sunglasses', 'glasses', '#1a1a1a'),
    new Accessory('nerdglasses', 'Nerd Glasses', 'glasses', '#1a1a1a'),
    new Accessory('hipster', 'Hipster Glasses', 'glasses', '#8b4513'),

    // Head accessories
    new Accessory('redribbon', 'Red Ribbon', 'ribbon', '#e74c3c'),
    new Accessory('blueribbon', 'Blue Ribbon', 'ribbon', '#3498db'),
    new Accessory('pinkribbon', 'Pink Ribbon', 'ribbon', '#ff69b4'),
    new Accessory('goldribbon', 'Gold Ribbon', 'ribbon', '#ffd700'),

    // Bowties
    new Accessory('redbowtie', 'Red Bowtie', 'bowtie', '#c41e3a'),
    new Accessory('blackbowtie', 'Black Bowtie', 'bowtie', '#1a1a1a'),
    new Accessory('bluebowtie', 'Blue Bowtie', 'bowtie', '#2980b9'),

    // Special
    new Accessory('halo', 'Halo', 'halo', '#ffd700'),
    new Accessory('crown', 'Crown', 'crown', '#ffd700'),
    new Accessory('devilhorns', 'Devil Horns', 'horns', '#8b0000'),
    new Accessory('antenna', 'Antenna', 'antenna', '#silver'),

    // Face accessories
    new Accessory('angrybrows', 'Angry Brows', 'eyebrows', '#1a1a1a'),
    new Accessory('fancystache', 'Fancy Mustache', 'mustache', '#1a1a1a'),
];
