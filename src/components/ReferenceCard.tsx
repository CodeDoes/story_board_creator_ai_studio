import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MapPin, User, Camera, Loader2, RefreshCw, Zap, Image, Info, X, Box } from "lucide-react";
import { GenerationResult } from "../types";

export interface ReferenceCardProps {
  title: string;
  type: string;
  data: { result: GenerationResult | null; loading: boolean; startTime?: number } | undefined;
  onGenerate: () => void;
  onImageClick?: (imageUrl: string, title: string, prompt?: string, feedback?: string, settings?: any) => void;
  aspectRatio?: string;
  currentTime?: number;
}

export const ReferenceCard: React.FC<ReferenceCardProps> = ({ 
  title, 
  type, 
  data, 
  onGenerate,
  onImageClick,
  aspectRatio = "aspect-video",
  currentTime
}) => {
  const [showInfo, setShowInfo] = useState(false);

  const getInfoText = () => {
    if (type === "Location") {
      return "This reference establishes the environmental DNA. It dictates lighting, architecture, and atmosphere for all story beats set here. The AI uses this as a 'master plate' to ensure spatial consistency.";
    }
    if (type === "Character") {
      return "This reference locks in the character's visual identity. It defines features, clothing, and proportions. The AI injects this specific look into every frame where the character appears.";
    }
    return "This reference defines a key object or prop. It ensures that critical items (like ships, tools, or artifacts) maintain their design, scale, and material properties across all scenes.";
  };

  return (
    <div className="space-y-3 relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`inline-flex items-center gap-2 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${
            type === "Location" ? "bg-sky-900/50 text-sky-200 border border-sky-700/30" : 
            type === "Character" ? "bg-purple-900/50 text-purple-200 border border-purple-700/30" :
            "bg-emerald-900/50 text-emerald-200 border border-emerald-700/30"
          }`}>
            {type === "Location" ? <Camera size={12} /> : type === "Character" ? <User size={12} /> : <Box size={12} />}
            {type}
          </div>
          <button 
            onClick={() => setShowInfo(!showInfo)}
            className="text-slate-500 hover:text-sky-400 transition-colors"
          >
            <Info size={14} />
          </button>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onGenerate()}
            disabled={data?.loading}
            className="text-[10px] font-black uppercase tracking-wider text-sky-400 hover:text-sky-300 disabled:opacity-50 flex items-center gap-1"
          >
            {data?.loading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showInfo && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute inset-0 z-20 bg-slate-950/95 backdrop-blur-md border border-sky-500/30 rounded-2xl p-4 flex flex-col justify-center"
          >
            <button 
              onClick={() => setShowInfo(false)}
              className="absolute top-3 right-3 text-slate-500 hover:text-white"
            >
              <X size={16} />
            </button>
            <h4 className="text-sky-400 text-[10px] font-black uppercase tracking-widest mb-2">Production Intent</h4>
            <p className="text-slate-300 text-[11px] leading-relaxed italic mb-4">
              "{getInfoText()}"
            </p>
            {data?.result?.settings?.prompt && (
              <div className="pt-4 border-t border-slate-800">
                <p className="text-slate-500 text-[9px] uppercase font-bold tracking-tighter mb-1">Generation Prompt:</p>
                <p className="text-slate-400 text-[9px] leading-relaxed font-mono line-clamp-3">
                  {data.result.settings.prompt}
                </p>
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-slate-800">
              <p className="text-slate-500 text-[9px] uppercase font-bold tracking-tighter">
                Pipeline Role: <span className="text-slate-300">Visual Anchor</span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div 
        onClick={() => data?.result?.image && onImageClick?.(data.result.image, title, data.result.settings.prompt, data.result.feedback, data.result.settings)}
        className={`${aspectRatio} bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex items-center justify-center relative group cursor-pointer`}
      >
        {data?.loading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="animate-spin text-sky-500" size={24} />
            <span className="text-[10px] text-slate-500 font-bold uppercase">Generating...</span>
            {data.startTime && currentTime && (
              <span className="text-sky-500/50 text-[10px] font-mono mt-2">
                ELAPSED: {Math.floor((currentTime - data.startTime) / 1000)}s
              </span>
            )}
          </div>
        ) : data?.result?.image ? (
          <img 
            src={data.result.image} 
            alt={title} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
            referrerPolicy="no-referrer"
          />
        ) : (
          <p className="text-slate-700 text-[10px] font-black uppercase text-center px-4">Awaiting Pipeline</p>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[150px]">{title}</span>
        {data?.result && <span className="text-[8px] font-mono text-slate-600 uppercase">{data.result.settings.size}</span>}
      </div>
    </div>
  );
};
