import React from 'react';
import { Settings, Key } from 'lucide-react';
import { GLOBAL_STYLE, SUBTITLE_STYLE } from '../constants';

interface SettingsPanelProps {
  handleSelectKey: () => void;
  hasApiKey: boolean | null;
  storyboardAspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  setStoryboardAspectRatio: (ratio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9") => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  handleSelectKey,
  hasApiKey,
  storyboardAspectRatio,
  setStoryboardAspectRatio
}) => {
  return (
    <div className="space-y-8">
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <Settings className="text-sky-500" size={20} />
          <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Settings</h2>
        </div>
        <div className="space-y-4 max-w-xl">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">API Key Configuration</label>
            <p className="text-sm text-slate-500 mb-4">
              The application requires a valid Gemini API key to function. You can update your selected key here.
            </p>
            <button
              onClick={handleSelectKey}
              className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-4 rounded-xl transition-colors flex items-center gap-2 text-sm"
            >
              <Key size={16} />
              {hasApiKey ? "Update API Key" : "Select API Key"}
            </button>
          </div>

          <div className="pt-6 border-t border-slate-800">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Storyboard Aspect Ratio</label>
            <p className="text-sm text-slate-500 mb-4">
              Set the aspect ratio for all storyboard generations and their corresponding layout references.
            </p>
            <div className="flex flex-wrap gap-2">
              {(["1:1", "3:4", "4:3", "9:16", "16:9"] as const).map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => setStoryboardAspectRatio(ratio)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                    storyboardAspectRatio === ratio 
                      ? "bg-sky-500 border-sky-400 text-slate-950" 
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Storyboard Image Prompt Template</label>
            <p className="text-sm text-slate-500 mb-4">
              The base style and continuity instructions used for all storyboard frame generations.
            </p>
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mb-2">Global Style</p>
                <pre className="text-slate-400 font-mono text-[10px] whitespace-pre-wrap">{GLOBAL_STYLE}</pre>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mb-2">Subtitle Style</p>
                <pre className="text-slate-400 font-mono text-[10px] whitespace-pre-wrap">{SUBTITLE_STYLE}</pre>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mb-2">Continuity Instruction</p>
                <pre className="text-slate-400 font-mono text-[10px] whitespace-pre-wrap">CRITICAL: Maintain strict visual continuity with the provided reference images. Lighting, character features, and environment details must match exactly.</pre>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
