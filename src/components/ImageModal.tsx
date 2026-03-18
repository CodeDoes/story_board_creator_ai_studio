import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Info } from 'lucide-react';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title: string;
  prompt?: string;
  feedback?: string;
  settings?: any;
}

export const ImageModal: React.FC<ImageModalProps> = ({ 
  isOpen, 
  onClose, 
  imageUrl, 
  title, 
  prompt,
  feedback,
  settings
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 bg-slate-950/90 backdrop-blur-xl"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative max-w-7xl w-full max-h-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col md:flex-row"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image Section */}
            <div className="flex-1 bg-black flex items-center justify-center overflow-hidden">
              <img 
                src={imageUrl} 
                alt={title} 
                className="max-w-full max-h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Info Section */}
            <div className="w-full md:w-96 bg-slate-900 p-6 flex flex-col border-t md:border-t-0 md:border-l border-slate-800">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black text-white uppercase tracking-widest truncate pr-4">{title}</h3>
                <button 
                  onClick={onClose}
                  className="p-1.5 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-all shrink-0"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-6 flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800">
                {settings?.imagePrompt && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sky-400">
                      <span className="text-[9px] font-black uppercase tracking-widest">Image Prompt</span>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800/50 rounded-xl p-3">
                      <p className="text-[10px] text-slate-300 leading-relaxed font-mono">
                        {settings.imagePrompt}
                      </p>
                    </div>
                  </div>
                )}

                {settings?.stylePrompt && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-purple-400">
                      <span className="text-[9px] font-black uppercase tracking-widest">Style Prompt</span>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800/50 rounded-xl p-3">
                      <p className="text-[10px] text-slate-400 leading-relaxed font-mono italic">
                        {settings.stylePrompt}
                      </p>
                    </div>
                  </div>
                )}

                {settings?.contextPrompt && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <span className="text-[9px] font-black uppercase tracking-widest">Context Prompt</span>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800/50 rounded-xl p-3">
                      <p className="text-[10px] text-slate-500 leading-relaxed font-mono">
                        {settings.contextPrompt}
                      </p>
                    </div>
                  </div>
                )}

                {!settings?.imagePrompt && prompt && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-400">
                      <span className="text-[9px] font-black uppercase tracking-widest">Raw Prompt</span>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800/50 rounded-xl p-3">
                      <p className="text-[10px] text-slate-400 leading-relaxed font-mono">
                        {prompt}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-slate-800 space-y-4">
                {feedback && (
                  <div className="opacity-50 hover:opacity-100 transition-opacity">
                    <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-1">Director's Intent</p>
                    <p className="text-[9px] text-slate-400 leading-tight italic">
                      {feedback}
                    </p>
                  </div>
                )}
                
                <a 
                  href={imageUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-slate-300 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-slate-700 hover:border-sky-400"
                >
                  <Download size={14} />
                  Export Asset
                </a>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
