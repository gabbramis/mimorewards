import { createCanvas } from '@napi-rs/canvas';
import { getStampGridLayout } from '@/lib/wallet-config';

export async function generateStripImage(
    maxStamps: number,
    currentStamps: number,
    primaryColor: string,
    stampBackgroundColor?: string,
    textColor: string = '#FFFFFF'
): Promise<Buffer> {
    const width = 1125;
    const height = 432;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Rellenar el canvas con el color sólido de fondo de los sellos (opacidad 100%)
    const bgColor = stampBackgroundColor || primaryColor || '#FF1F2D';
    ctx.globalAlpha = 1;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // 2. Distribución de filas y columnas idéntica al Frontend (4 -> 2x2, 5 -> 1x5, 6 -> 2x3, 8 -> 2x4, 10 -> 2x5)
    const target = Math.max(1, Math.min(15, maxStamps || 8));
    const { rows, columns } = getStampGridLayout(target);

    const padX = 40;
    const usableWidth = width - padX * 2;
    const maxAvailableWidth = usableWidth / columns;
    const maxAvailableHeight = (height - 48) / (rows === 1 ? 1 : 2.15);
    const size = Math.floor(Math.min(rows === 1 ? 148 : 136, maxAvailableWidth * 0.82, maxAvailableHeight));
    const radius = size * 0.38;

    // Distribución vertical con space-evenly
    const rowGap = (height - rows * size) / (rows + 1);

    for (let row = 0; row < rows; row++) {
        const startIdx = row * columns;
        const itemsInRow = Math.max(0, Math.min(columns, target - startIdx));
        if (itemsInRow <= 0) continue;

        // Distribución horizontal con space-evenly
        const colGap = (usableWidth - itemsInRow * size) / (itemsInRow + 1);
        const y = rowGap + size / 2 + row * (size + rowGap);

        for (let col = 0; col < itemsInRow; col++) {
            const index = startIdx + col;
            const x = padX + colGap + size / 2 + col * (size + colGap);

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);

            if (index < currentStamps) {
                ctx.globalAlpha = 0.95;
                ctx.fillStyle = textColor;
                ctx.fill();
            } else {
                ctx.globalAlpha = 0.2;
                ctx.fillStyle = textColor;
                ctx.fill();

                ctx.globalAlpha = 0.45;
                ctx.strokeStyle = textColor;
                ctx.lineWidth = 6;
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }
    }

    return canvas.toBuffer('image/png');
}
