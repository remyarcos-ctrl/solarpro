import React, { useRef, useEffect } from "react";

export default function RoofSimulation({ roofWidth, roofHeight, panelCount, panel }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !roofWidth || !roofHeight || !panelCount || !panel) return;

    const ctx = canvas.getContext("2d");
    const canvasWidth = canvas.offsetWidth;
    const canvasHeight = canvas.offsetHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const padding = 30;
    const availableW = canvasWidth - padding * 2;
    const availableH = canvasHeight - padding * 2;

    // Scale roof to fit canvas
    const scaleX = availableW / roofWidth;
    const scaleY = availableH / roofHeight;
    const scale = Math.min(scaleX, scaleY);

    const roofPixelW = roofWidth * scale;
    const roofPixelH = roofHeight * scale;
    const startX = (canvasWidth - roofPixelW) / 2;
    const startY = (canvasHeight - roofPixelH) / 2;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw roof outline
    ctx.strokeStyle = "#4a5568";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(startX, startY, roofPixelW, roofPixelH);
    ctx.setLineDash([]);

    // Draw roof label
    ctx.fillStyle = "#718096";
    ctx.font = "12px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Toiture ${roofWidth}m × ${roofHeight}m`, canvasWidth / 2, startY - 10);

    // Calculate panel grid
    const panelW = (panel.width_mm / 1000) * scale;
    const panelH = (panel.height_mm / 1000) * scale;
    const cols = Math.floor(roofPixelW / panelW);
    const rows = Math.floor(roofPixelH / panelH);
    const gap = 2;

    // Center panels within roof
    const totalPanelsW = cols * panelW + (cols - 1) * gap;
    const totalPanelsH = rows * panelH + (rows - 1) * gap;
    const offsetX = startX + (roofPixelW - totalPanelsW) / 2;
    const offsetY = startY + (roofPixelH - totalPanelsH) / 2;

    let count = 0;
    for (let row = 0; row < rows && count < panelCount; row++) {
      for (let col = 0; col < cols && count < panelCount; col++) {
        const x = offsetX + col * (panelW + gap);
        const y = offsetY + row * (panelH + gap);

        // Panel background
        const gradient = ctx.createLinearGradient(x, y, x + panelW, y + panelH);
        gradient.addColorStop(0, "rgba(30, 64, 175, 0.7)");
        gradient.addColorStop(1, "rgba(59, 130, 246, 0.5)");
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, panelW, panelH);

        // Panel border
        ctx.strokeStyle = "rgba(96, 165, 250, 0.6)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, panelW, panelH);

        // Grid lines on panel
        ctx.strokeStyle = "rgba(147, 197, 253, 0.3)";
        ctx.lineWidth = 0.5;
        const midX = x + panelW / 2;
        ctx.beginPath();
        ctx.moveTo(midX, y);
        ctx.lineTo(midX, y + panelH);
        ctx.stroke();
        for (let i = 1; i < 3; i++) {
          const lineY = y + (panelH / 3) * i;
          ctx.beginPath();
          ctx.moveTo(x, lineY);
          ctx.lineTo(x + panelW, lineY);
          ctx.stroke();
        }

        count++;
      }
    }
  }, [roofWidth, roofHeight, panelCount, panel]);

  if (!roofWidth || !roofHeight || !panelCount || !panel) {
    return (
      <div className="w-full h-[300px] rounded-xl bg-secondary/30 border border-border flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Configurez la toiture et les panneaux pour voir la simulation</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[300px] rounded-xl bg-background/50 border border-border relative overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}