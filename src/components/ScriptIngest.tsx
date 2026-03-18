import React from 'react';
import { motion } from 'motion/react';
import { FileText, Loader2, Zap } from 'lucide-react';

interface ScriptIngestProps {
  rawScript: string;
  setRawScript: (script: string) => void;
  isProcessingScript: boolean;
  scriptStartTime: number | null;
  currentTime: number;
  processScript: () => void;
  showCancel: boolean;
  onCancel: () => void;
  streamingScriptText: string;
}

export const ScriptIngest: React.FC<ScriptIngestProps> = ({
  rawScript,
  setRawScript,
  isProcessingScript,
  scriptStartTime,
  currentTime,
  processScript,
  showCancel,
  onCancel,
  streamingScriptText
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-900/50 border border-slate-800 rounded-3xl p-12 mb-12"
    >
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-sky-500/10 rounded-2xl">
          <FileText className="text-sky-400" size={32} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-white italic">SCRIPT INGESTION</h2>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Paste your raw script to generate a production bible</p>
        </div>
      </div>
      
      <textarea 
        value={rawScript}
        onChange={(e) => setRawScript(e.target.value)}
        placeholder="Paste your script here... (e.g. INT. COCKPIT - NIGHT. The pilot stares into the void...)"
        className="w-full h-96 bg-slate-950 border border-slate-800 rounded-2xl p-6 text-slate-300 font-mono text-sm outline-none focus:border-sky-500/50 transition-all mb-8"
      />

      <div className="flex justify-end gap-4 items-center">
        {isProcessingScript && scriptStartTime && (
          <span className="text-sky-500/50 text-[10px] font-mono uppercase tracking-widest">
            ELAPSED: {Math.floor((currentTime - scriptStartTime) / 1000)}s
          </span>
        )}
        {showCancel && (
          <button 
            onClick={onCancel}
            className="px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest text-slate-400 hover:text-white transition-all"
          >
            Cancel
          </button>
        )}
        <button 
          onClick={processScript}
          disabled={isProcessingScript || !rawScript.trim()}
          className="bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 px-12 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center gap-3"
        >
          {isProcessingScript ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
          {isProcessingScript ? "Processing Script..." : "Generate Production Bible"}
        </button>
      </div>

      {isProcessingScript && streamingScriptText && (
        <div className="mt-8 p-6 bg-slate-950 border border-slate-800 rounded-2xl max-h-64 overflow-y-auto">
          <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mb-2">Live Analysis Output</p>
          <pre className="text-slate-500 font-mono text-[10px] whitespace-pre-wrap">{streamingScriptText}</pre>
        </div>
      )}
    </motion.div>
  );
};
