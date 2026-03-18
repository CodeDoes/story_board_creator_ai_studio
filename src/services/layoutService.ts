import { StoryFrame } from "../types";

export const generateScriptLayout = (frames: StoryFrame[] = [], type: string, aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "16:9"): string => {
  const canvas = document.createElement('canvas');
  
  // Set dimensions based on aspect ratio
  let width = 1280;
  let height = 720;
  
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
    width = 720;
    height = 1280;
  }
  
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return "";

  // Background
  ctx.fillStyle = '#020617'; // slate-950
  ctx.fillRect(0, 0, width, height);

  // Dynamic Grid settings based on frame count
  const safeFrames = frames || [];
  const count = safeFrames.length || 1;
  
  // To maintain the same aspect ratio as the parent, we want cols == rows.
  // This ensures (W/cols) / (H/rows) == W/H.
  let cols = Math.ceil(Math.sqrt(count));
  let rows = cols; 
  
  const cellWidth = width / cols;
  const cellHeight = height / rows;

  // Draw Grid
  ctx.strokeStyle = '#334155'; // slate-700
  ctx.lineWidth = 1;

  for (let i = 0; i < count; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = c * cellWidth;
    const y = r * cellHeight;
    
    // Get prompt
    const prompt = safeFrames[i]?.prompt || `Frame ${i + 1}`;
    
    // Cell background
    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.fillRect(x, y, cellWidth, cellHeight);
    
    // Cell border
    ctx.strokeRect(x, y, cellWidth, cellHeight);
    
    // Cell label (Prompt)
    ctx.fillStyle = '#f8fafc'; // slate-50 (brighter text)
    const fontSize = Math.max(10, Math.min(16, Math.floor(cellHeight / 10)));
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Simple text wrapping
    const words = prompt.split(' ');
    let line = '';
    const lines = [];
    const maxWidth = cellWidth - 20;
    
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        lines.push(line);
        line = words[n] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line);
    
    const lineHeight = fontSize + 4;
    const startY = y + (cellHeight / 2) - ((lines.length - 1) * lineHeight / 2);
    
    lines.forEach((l, idx) => {
      ctx.fillText(l.trim(), x + cellWidth/2, startY + (idx * lineHeight));
    });

    // Frame Number (Small, top-left)
    ctx.fillStyle = '#334155';
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${i + 1}`, x + 5, y + 10);
  }

  return canvas.toDataURL('image/png');
};
