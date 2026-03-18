import React from 'react';
import { motion } from 'motion/react';
import { ActivePanel } from '../types';

interface NavigationProps {
  activePanel: ActivePanel;
  setActivePanel: (panel: ActivePanel) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activePanel, setActivePanel }) => {
  return (
    <nav className="flex items-center gap-8 mb-6 border-b border-slate-800/50 pb-2">
      {(["sequences", "references", "data", "settings"] as const).map((panel) => (
        <button 
          key={panel}
          onClick={() => setActivePanel(panel)}
          className={`text-sm font-black uppercase tracking-widest transition-all pb-4 relative ${activePanel === panel ? "text-sky-400" : "text-slate-500 hover:text-slate-300"}`}
        >
          {panel.charAt(0).toUpperCase() + panel.slice(1)}
          {activePanel === panel && (
            <motion.div 
              layoutId="activeTab" 
              className="absolute bottom-0 left-0 right-0 h-1 bg-sky-400 rounded-full" 
            />
          )}
        </button>
      ))}
    </nav>
  );
};
