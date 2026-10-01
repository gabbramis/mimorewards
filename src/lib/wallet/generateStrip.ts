import { createCanvas } from '@napi-rs/canvas';

export async function generateStripImage(
    maxStamps: number,
    currentStamps: number,
    primaryColor: string
): Promise<Buffer> {
    const width = 1125;
    const height = 369;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Fondo transparente preparado para overlay en Apple Wallet
    ctx.clearRect(0, 0, width, height);

    // Ahora los sellos se dividen exactamente en 2 filas
    const columns = Math.ceil(maxStamps / 2);
    const rows = 2;

    // Determinar el radio máximo (55px normal o ajustar si son muchas columnas)
    const maxRadius = 55;
    const radius = Math.min((width - 120) / columns / 2.8, maxRadius);

    // Distancia entre los centros
    const spacingX = radius * 3.2;
    const spacingY = radius * 3.2;

    // Ancho y Alto total ocupado por todos los sellos
    const totalStampsWidth = (columns - 1) * spacingX;
    const totalStampsHeight = (rows - 1) * spacingY;

    // Puntos de partida para centrar en el Canvas (1125x369)
    const startX = (width - totalStampsWidth) / 2;
    const startY = (height - totalStampsHeight) / 2;

    for (let i = 0; i < maxStamps; i++) {
        const col = i % columns;
        const row = Math.floor(i / columns);

        const x = startX + (col * spacingX);
        const y = startY + (row * spacingY);

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);

        if (i < currentStamps) {
            // Sello completado / lleno
            ctx.fillStyle = primaryColor;
            ctx.fill();
        } else {
            // Sello pendiente / vacío (Fondo muy tenue del mismo color)
            // Usamos opacidad hexadecimal, ej: 20%
            ctx.fillStyle = `${primaryColor}33`;
            ctx.fill();

            // Borde
            ctx.strokeStyle = `${primaryColor}88`;
            ctx.lineWidth = 4;
            ctx.stroke();
        }
    }

    return canvas.toBuffer('image/png');
}
