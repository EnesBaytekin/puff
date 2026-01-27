// Customize view
const CustomizeView = {
    init() {
        const form = document.getElementById('customize-form');
        const errorEl = document.getElementById('customize-error');
        const colorInput = document.getElementById('puff-color');
        const preview = document.getElementById('puff-preview');

        // Clear previous error
        errorEl.textContent = '';

        // Update preview when color changes
        this.updatePreview(colorInput.value);

        colorInput.oninput = () => {
            this.updatePreview(colorInput.value);
        };

        // Handle form submission
        form.onsubmit = async (e) => {
            e.preventDefault();

            const name = document.getElementById('puff-name').value;
            const color = colorInput.value;

            errorEl.textContent = '';

            try {
                await API.createPuff(name, color);
                // Navigate to app
                Router.fetchPuffAndRoute();
            } catch (err) {
                errorEl.textContent = err.message;
            }
        };
    },

    updatePreview(color) {
        const preview = document.getElementById('puff-preview');

        // Create a simple canvas preview
        preview.innerHTML = '';
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        preview.appendChild(canvas);

        const ctx = canvas.getContext('2d');

        // Draw a simple puff preview
        const centerX = 100;
        const centerY = 100;
        const radius = 60;

        // Draw irregular shape with rounded corners (using curves)
        const points = [];
        const numPoints = 12;
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            const deform = 0.9 + Math.sin(i * 3) * 0.1;
            const r = radius * deform;
            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;
            points.push({ x, y });
        }

        // Draw smooth curve through points
        ctx.beginPath();
        const firstPoint = points[0];
        const lastPoint = points[numPoints - 1];
        const midX = (firstPoint.x + lastPoint.x) / 2;
        const midY = (firstPoint.y + lastPoint.y) / 2;

        ctx.moveTo(midX, midY);

        for (let i = 0; i < numPoints; i++) {
            const point = points[i];
            const nextPoint = points[(i + 1) % numPoints];
            const nextMidX = (point.x + nextPoint.x) / 2;
            const nextMidY = (point.y + nextPoint.y) / 2;

            ctx.quadraticCurveTo(point.x, point.y, nextMidX, nextMidY);
        }

        ctx.closePath();

        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = this.getDarkerColor(color);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Draw simple face with contrast color
        const contrastColor = this.getContrastColor(color);
        ctx.fillStyle = contrastColor;
        // Eyes
        ctx.beginPath();
        ctx.arc(centerX - 15, centerY - 10, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX + 15, centerY - 10, 5, 0, Math.PI * 2);
        ctx.fill();
        // Smile
        ctx.strokeStyle = contrastColor;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(centerX, centerY + 5, 15, 0.2, Math.PI - 0.2);
        ctx.stroke();
    },

    getDarkerColor(hex) {
        // Convert hex to darker shade for outline
        const num = parseInt(hex.slice(1), 16);
        const r = Math.max(0, (num >> 16) - 40);
        const g = Math.max(0, ((num >> 8) & 0x00FF) - 40);
        const b = Math.max(0, (num & 0x0000FF) - 40);
        return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
    },

    getContrastColor(hex) {
        // Get contrast color (black or white) based on luminance
        const num = parseInt(hex.slice(1), 16);
        const r = (num >> 16) & 0xFF;
        const g = (num >> 8) & 0xFF;
        const b = num & 0xFF;

        // Calculate luminance
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

        // Return black for light colors, white for dark colors
        return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
    }
};
