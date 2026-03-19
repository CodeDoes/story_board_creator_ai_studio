import { StoryFrame } from "../types";

export const generateScriptLayout = (frames: StoryFrame[] = [], type: string, aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "16:9"): string => {
  const canvas = document.createElement('canvas');
  
  // Set dimensions based on aspect ratio (1K target)
  let width = 1024;
  let height = 576; // 16:9
  
  if (aspectRatio === "1:1") {
    width = 1024;
    height = 1024;
  } else if (aspectRatio === "3:4") {
    width = 768;
    height = 1024;
  } else if (aspectRatio === "4:3") {
    width = 1024;
    height = 768;
  } else if (aspectRatio === "9:16") {
    width = 576;
    height = 1024;
  }
  
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return "";

  // Background - Deep Matte
  ctx.fillStyle = '#020617'; // slate-950
  ctx.fillRect(0, 0, width, height);

  const safeFrames = frames || [];
  
  // Fixed 3x3 Grid for 9 frames
  const cols = 3;
  const rows = 3;
  
  const cellW = width / cols;
  const cellH = height / rows;
  
  safeFrames.slice(0, 9).forEach((frame, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = c * cellW;
    const y = r * cellH;
    
    const isHighlight = frame.priority === "highlight";

    // Draw Frame
    // Subtle border
    ctx.strokeStyle = isHighlight ? 'rgba(14, 165, 233, 0.3)' : 'rgba(30, 41, 59, 0.5)'; // sky-500/30 or slate-800/50
    ctx.lineWidth = isHighlight ? 2 : 1;
    ctx.strokeRect(x + 4, y + 4, cellW - 8, cellH - 8);

    // Background for text
    const gradient = ctx.createLinearGradient(x, y, x + cellW, y + cellH);
    gradient.addColorStop(0, isHighlight ? '#0f172a' : '#020617');
    gradient.addColorStop(1, isHighlight ? '#1e293b' : '#0f172a');
    ctx.fillStyle = gradient;
    ctx.fillRect(x + 5, y + 5, cellW - 10, cellH - 10);

    // Frame Number - Large Editorial Style
    ctx.fillStyle = isHighlight ? 'rgba(14, 165, 233, 0.05)' : 'rgba(255, 255, 255, 0.02)';
    const numSize = Math.floor(cellH * 0.7);
    ctx.font = `900 ${numSize}px "Inter", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${i + 1}`, x + cellW / 2, y + cellH / 2);

    // Prompt Text
    ctx.fillStyle = isHighlight ? '#f8fafc' : '#94a3b8'; // slate-50 or slate-400
    const fontSize = isHighlight ? 14 : 10;
    ctx.font = `${isHighlight ? 'bold' : 'normal'} ${fontSize}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const words = (frame.prompt || "").split(' ');
    let line = '';
    const lines = [];
    const maxWidth = cellW - 40;
    
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        lines.push(line);
        line = words[n] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    const lineHeight = fontSize * 1.4;
    const totalTextHeight = lines.length * lineHeight;
    const startY = y + (cellH / 2) - (totalTextHeight / 2) + (lineHeight / 2);

    lines.forEach((l, idx) => {
      ctx.fillText(l.trim(), x + cellW / 2, startY + (idx * lineHeight));
    });

    // Small index in corner
    ctx.fillStyle = isHighlight ? '#38bdf8' : '#475569'; // sky-400 or slate-500
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${i + 1}`, x + 15, y + 15);

    if (isHighlight) {
      ctx.fillStyle = 'rgba(14, 165, 233, 0.1)';
      ctx.font = 'black 6px "Inter", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('HIGHLIGHT BEAT', x + cellW - 15, y + 15);
    }
  });

  return canvas.toDataURL('image/png');
};
