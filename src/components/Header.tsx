import React from 'react';
import { Trash2, FileText } from 'lucide-react';

interface HeaderProps {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  clearPersistence: () => void;
  showScriptEditor: boolean;
  setShowScriptEditor: (show: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedModel,
  setSelectedModel,
  clearPersistence,
  showScriptEditor,
  setShowScriptEditor
}) => {
  return (
    <header className="mb-6 border-b border-slate-800 pb-6 flex flex-col md:flex-row justify-between items-end gap-6">
      <div>
        <p className="text-slate-400 text-sm uppercase tracking-widest font-black italic">
          TETHER <span className="text-sky-600 font-bold ml-2">— Multimodal Production Engine</span>
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center bg-slate-900/50 border border-slate-700/50 rounded-full px-4 py-2 gap-3">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Model Engine</span>
          <select 
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-transparent text-xs font-bold text-sky-400 outline-none cursor-pointer"
          >
            <option value="gemini-3.1-flash-image-preview">Nano Banana 2 (3.1)</option>
            <option value="gemini-2.5-flash-image">Nano Banana (2.5)</option>
          </select>
        </div>
        <button 
          onClick={clearPersistence}
          className="bg-red-900/20 hover:bg-red-900/40 text-red-400 px-6 py-3 rounded-full font-black text-xs uppercase transition-all border border-red-900/30 flex items-center gap-2"
        >
          <Trash2 size={14} />
          Clear
        </button>
        <button 
          onClick={() => setShowScriptEditor(!showScriptEditor)}
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-6 py-3 rounded-full font-black text-xs uppercase transition-all border border-slate-700 flex items-center gap-2"
        >
          <FileText size={14} />
          Script Ingest
        </button>
      </div>
    </header>
  );
};
