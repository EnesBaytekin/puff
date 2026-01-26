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

        // Draw irregular shape
        ctx.beginPath();
        const numPoints = 12;
        for (let i = 0; i <= numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            const deform = 0.9 + Math.sin(i * 3) * 0.1;
            const r = radius * deform;
            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();

        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = this.getDarkerColor(color);
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw simple face
        ctx.fillStyle = '#4a4a4a';
        // Eyes
        ctx.beginPath();
        ctx.arc(centerX - 15, centerY - 10, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX + 15, centerY - 10, 5, 0, Math.PI * 2);
        ctx.fill();
        // Smile
        ctx.strokeStyle = '#4a4a4a';
        ctx.lineWidth = 2;
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
    }
};
