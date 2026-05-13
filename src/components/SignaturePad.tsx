import { useEffect, useRef, useState } from "react";

interface Props {
  width?: number;
  height?: number;
  onChange: (dataUrl: string | null) => void;
}

/**
 * Lightweight HTML5 canvas signature pad. Captures mouse + touch and emits a
 * base64 PNG data URL via `onChange`. Emits `null` when the canvas is empty.
 */
export function SignaturePad({ width = 480, height = 160, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#111";
  }, []);

  function pos(e: PointerEvent | React.PointerEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const native = "nativeEvent" in e ? (e.nativeEvent as PointerEvent) : (e as PointerEvent);
    return {
      x: ((native.clientX - rect.left) / rect.width) * canvas.width,
      y: ((native.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function handleDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastRef.current = pos(e);
  }
  function handleMove(e: React.PointerEvent) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const p = pos(e);
    const last = lastRef.current;
    if (last) {
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    lastRef.current = p;
    if (empty) setEmpty(false);
  }
  function handleUp() {
    drawingRef.current = false;
    lastRef.current = null;
    const canvas = canvasRef.current;
    if (canvas && !empty) onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full h-40 touch-none rounded-lg"
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerLeave={handleUp}
        />
      </div>
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-500">{empty ? "Sign above with your mouse or finger" : "Signature captured"}</span>
        <button type="button" onClick={clear} className="text-blue-600 hover:underline">Clear</button>
      </div>
    </div>
  );
}
