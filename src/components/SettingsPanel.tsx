import React, { useState, useEffect } from 'react';
import { Settings, Check, Save } from 'lucide-react';
import { GLOBAL_STYLE, SUBTITLE_STYLE } from '../constants';
import { getApiKey, setApiKey } from '../services/auth';

interface SettingsPanelProps {
  storyboardAspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  setStoryboardAspectRatio: (ratio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9") => void;
  hasApiKey: boolean | null;
  onKeyUpdate?: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  storyboardAspectRatio,
  setStoryboardAspectRatio,
  hasApiKey,
  onKeyUpdate
}) => {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const key = getApiKey();
    if (key) setApiKeyInput(key);
  }, []);

  const handleSaveKey = () => {
    if (apiKeyInput.trim()) {
      setApiKey(apiKeyInput.trim());
      setIsSaved(true);
      if (onKeyUpdate) onKeyUpdate();
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  return (
    <div className="space-y-8">
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <Settings className="text-sky-500" size={20} />
          <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Settings</h2>
        </div>
        <div className="space-y-4 max-w-xl">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Gemini API Key</label>
            <p className="text-sm text-slate-500 mb-4">
              Enter your Gemini API key. This key is stored locally in your browser.
            </p>
            
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Enter API Key..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all text-sm"
                />
              </div>
              <button
                onClick={handleSaveKey}
                className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold text-sm transition-all ${
                  isSaved 
                    ? "bg-emerald-600 text-white" 
                    : "bg-sky-600 hover:bg-sky-500 text-white"
                }`}
              >
                {isSaved ? <Check size={16} /> : <Save size={16} />}
                {isSaved ? "Saved" : "Save"}
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <div className={`w-2 h-2 rounded-full ${hasApiKey ? 'bg-emerald-500' : 'bg-red-500'}`} />
              {hasApiKey ? 'API Key is active' : 'API Key missing'}
            </div>
            
            <p className="mt-3 text-[10px] text-slate-500">
              Need a key? <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline">Get one from Google AI Studio →</a>
            </p>
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
