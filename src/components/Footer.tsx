import React from 'react';
import { Zap } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-32 border-t border-slate-800 pt-12 pb-24 flex flex-col md:flex-row justify-between items-center gap-8">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center">
          <Zap className="text-slate-950" size={16} />
        </div>
        <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">TETHER PRODUCTION BIBLE v2.0</span>
      </div>
      <div className="flex gap-8">
        <span className="text-slate-600 text-[10px] font-bold uppercase tracking-widest italic">Script-Driven Multimodal Pipeline</span>
      </div>
    </footer>
  );
};
