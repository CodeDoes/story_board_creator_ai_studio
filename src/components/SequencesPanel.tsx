import React from 'react';
import { Clapperboard, MapPin, Layout, User, Box, Play, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { PageData, Character, Prop } from '../types';
import { IntentBox } from './IntentBox';

interface SequencesPanelProps {
  storyboard: PageData[];
  sequenceSummaries: Record<string, string>;
  sharedLocs: Record<string, any>;
  sharedChars: Record<string, any>;
  sharedProps: Record<string, any>;
  masterChars: Record<string, Character>;
  masterProps: Record<string, Prop>;
  results: Record<number, any>;
  storyboardAspectRatio: string;
  currentTime: number;
  runProductionCycle: (id: number) => void;
  setModalData: (data: any) => void;
  getStalenessReason: (page: PageData, result: any) => string | null;
  getPromptData: (page: PageData, mode: any) => { composite: string; imagePrompt: string; contextPrompt: string };
  generateScriptLayout: (frames: any[], mode: string, ratio: string) => string;
}

export const SequencesPanel: React.FC<SequencesPanelProps> = ({
  storyboard,
  sequenceSummaries,
  sharedLocs,
  sharedChars,
  sharedProps,
  masterChars,
  masterProps,
  results,
  storyboardAspectRatio,
  currentTime,
  runProductionCycle,
  setModalData,
  getStalenessReason,
  getPromptData,
  generateScriptLayout
}) => {
  return (
    <div className="space-y-4">
      {(Array.from(new Set(storyboard.map(p => p.sequence))) as string[]).map(seqName => (
        <div key={seqName} className="space-y-4">
          <div className="flex flex-col gap-1 border-l-2 border-sky-500 pl-4 py-1">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-black text-white uppercase tracking-tighter italic">{seqName}</h3>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                {storyboard.filter(p => p.sequence === seqName).length} Beats
              </span>
            </div>
            {sequenceSummaries[seqName] && (
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed max-w-2xl italic">
                {sequenceSummaries[seqName]}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4">
            {storyboard.filter(p => p.sequence === seqName).map(page => (
              <div key={page.id} className="bg-slate-900/30 border border-slate-800/50 rounded-2xl p-4 hover:border-slate-700/50 transition-all">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Left: Info & Controls */}
                  <div className="lg:w-1/4 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-sky-500 uppercase tracking-widest">Beat {page.id}</span>
                          <h4 className="text-sm font-black text-white uppercase tracking-tight">{page.title}</h4>
                        </div>
                      </div>
                    </div>

                    {/* Beat Breakdown */}
                    <div className="bg-slate-950/50 border border-slate-800/50 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Clapperboard size={14} className="text-sky-500" />
                          <h5 className="text-[10px] font-black text-white uppercase tracking-widest">
                            Full Prompt
                          </h5>
                        </div>
                      </div>
                      
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800">
                        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                          <p className="text-[10px] text-slate-400 leading-relaxed italic whitespace-pre-wrap">
                            {getPromptData(page, "full_layout").composite}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-slate-400">
                        <MapPin size={16} className="text-sky-500" />
                        <div 
                          className="flex items-center gap-2 cursor-pointer hover:text-sky-400 transition-colors"
                          onClick={() => {
                            const loc = sharedLocs[page.loc.prompt];
                            if (loc?.result?.image) {
                              setModalData({
                                isOpen: true,
                                imageUrl: loc.result.image,
                                title: page.loc.title,
                                prompt: loc.result.settings.prompt,
                                feedback: loc.result.feedback,
                                settings: loc.result.settings
                              });
                            }
                          }}
                        >
                          <span className="text-xs font-bold uppercase tracking-widest">{page.loc.title}</span>
                          {sharedLocs[page.loc.prompt]?.result?.image && (
                            <div className="w-6 h-6 rounded border border-slate-700 overflow-hidden bg-slate-800">
                              <img src={sharedLocs[page.loc.prompt].result.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <div 
                          className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300 bg-slate-800 pr-3 pl-1 py-1 rounded-full border border-slate-700 cursor-pointer hover:border-sky-500/50 transition-colors"
                          onClick={() => {
                            const layoutImg = generateScriptLayout(page.frames || [], "full", storyboardAspectRatio);
                            setModalData({
                              isOpen: true,
                              imageUrl: layoutImg,
                              title: "Generated Layout",
                              prompt: "Script-driven layout",
                              feedback: "Generated automatically from script frames.",
                              settings: { prompt: "Script Layout", size: "2K", hasLayoutRef: false }
                            });
                          }}
                        >
                          <div className="w-6 h-6 rounded-full border border-slate-600 overflow-hidden bg-slate-700 shrink-0">
                            <img src={generateScriptLayout(page.frames || [], "full", storyboardAspectRatio)} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                          <div className="flex items-center gap-1">
                            <Layout size={10} className="text-slate-400" />
                            <span>Layout</span>
                          </div>
                        </div>
                        {page.chars.map(cid => (
                          <div 
                            key={cid} 
                            className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300 bg-slate-800 pr-3 pl-1 py-1 rounded-full border border-slate-700 cursor-pointer hover:border-sky-500/50 transition-colors"
                            onClick={() => {
                              const char = sharedChars[cid];
                              if (char?.result?.image) {
                                setModalData({
                                  isOpen: true,
                                  imageUrl: char.result.image,
                                  title: masterChars[cid]?.name || cid,
                                  prompt: char.result.settings.prompt,
                                  feedback: char.result.feedback,
                                  settings: char.result.settings
                                });
                              }
                            }}
                          >
                            {sharedChars[cid]?.result?.image && (
                              <div className="w-6 h-6 rounded-full border border-slate-600 overflow-hidden bg-slate-700 shrink-0">
                                <img src={sharedChars[cid].result.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <User size={10} className="text-slate-400" />
                              <span>{masterChars[cid]?.name || cid}</span>
                            </div>
                          </div>
                        ))}
                        {(page.props || []).map(pid => (
                          <div 
                            key={pid} 
                            className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300 bg-slate-800 pr-3 pl-1 py-1 rounded-full border border-slate-700 cursor-pointer hover:border-sky-500/50 transition-colors"
                            onClick={() => {
                              const prop = sharedProps[pid];
                              if (prop?.result?.image) {
                                setModalData({
                                  isOpen: true,
                                  imageUrl: prop.result.image,
                                  title: masterProps[pid]?.name || pid,
                                  prompt: prop.result.settings.prompt,
                                  feedback: prop.result.feedback,
                                  settings: prop.result.settings
                                });
                              }
                            }}
                          >
                            {sharedProps[pid]?.result?.image && (
                              <div className="w-6 h-6 rounded-full border border-slate-600 overflow-hidden bg-slate-700 shrink-0">
                                <img src={sharedProps[pid].result.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Box size={10} className="text-slate-400" />
                              <span>{masterProps[pid]?.name || pid}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-800/50">
                      <button 
                        onClick={() => runProductionCycle(page.id)}
                        disabled={results[page.id]?.loadingMode !== null}
                        className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 mb-3"
                      >
                        <Play size={16} />
                        {results[page.id]?.loadingMode ? "Generating..." : "Run Production Cycle"}
                      </button>
                      <p className="text-[10px] text-center font-bold text-slate-500 uppercase tracking-widest">
                        Generates F-Layout Track + References
                      </p>
                    </div>
                  </div>

                  {/* Right: Results Track */}
                  <div className="lg:w-3/4">
                    <div className={`bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden relative group ${
                      storyboardAspectRatio === "16:9" ? "aspect-video" :
                      storyboardAspectRatio === "9:16" ? "aspect-[9/16]" :
                      storyboardAspectRatio === "3:4" ? "aspect-[3/4]" :
                      storyboardAspectRatio === "4:3" ? "aspect-[4/3]" :
                      "aspect-square"
                    }`}>
                      {(() => {
                        const currentResult = results[page.id]?.story2K_layout;
                        const stalenessReason = getStalenessReason(page, currentResult);

                        return currentResult?.image ? (
                          <div 
                            className="w-full h-full relative cursor-pointer"
                            onClick={() => setModalData({ 
                              isOpen: true, 
                              imageUrl: currentResult.image, 
                              title: `${page.title} - Full Layout`,
                              prompt: currentResult.settings.prompt,
                              feedback: currentResult.feedback,
                              settings: currentResult.settings
                            })}
                          >
                            <img 
                              src={currentResult.image} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            {stalenessReason && (
                              <div className="absolute top-4 left-4 right-4 bg-amber-500/90 backdrop-blur-md text-slate-950 p-3 rounded-xl flex items-center gap-3 z-20 shadow-2xl border border-amber-400/50">
                                <AlertCircle size={18} className="shrink-0" />
                                <div className="flex-1">
                                  <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">Stale Asset Detected</p>
                                  <p className="text-[9px] font-bold opacity-80 leading-tight">{stalenessReason}. Run production cycle again to sync.</p>
                                </div>
                                <RefreshCw size={14} className="opacity-50" />
                              </div>
                            )}
                            <IntentBox title="Full Layout Director's Intent" content={currentResult.feedback} />
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-12 text-center relative">
                            <div className="absolute inset-0 opacity-20 pointer-events-none">
                              <img 
                                src={generateScriptLayout(page.frames || [], "full", storyboardAspectRatio)} 
                                className="w-full h-full object-cover grayscale invert"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div className="p-6 bg-slate-900 rounded-full mb-6 relative z-10">
                              <Clapperboard className="text-slate-700" size={64} />
                            </div>
                            <h5 className="text-lg font-black text-white italic mb-2 uppercase tracking-tighter relative z-10">Awaiting Production Cycle</h5>
                            <p className="text-slate-500 text-xs leading-relaxed max-w-sm relative z-10">
                              This track will generate a grid of the full temporal sequence (8-32 frames) for maximum granular detail.
                            </p>
                            <div className="mt-8 grid grid-cols-2 gap-4 w-full max-w-md relative z-10">
                              <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-xl">
                                <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Location Sync</p>
                                <p className="text-[10px] text-slate-300 font-bold truncate">{page.loc.title}</p>
                              </div>
                              <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-xl">
                                <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Cast Sync</p>
                                <p className="text-[10px] text-slate-300 font-bold truncate">{page.chars.length} Characters</p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {results[page.id]?.loadingMode === "full_layout" && (
                        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-10">
                          <Loader2 className="animate-spin text-sky-500" size={48} />
                          <div className="text-center">
                            <p className="text-sky-400 text-xs font-black uppercase tracking-widest mb-1">{results[page.id].status}</p>
                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Gemini is rendering frames...</p>
                            {results[page.id].startTime && (
                              <p className="text-sky-500/50 text-[10px] font-mono mt-2">
                                ELAPSED: {Math.floor((currentTime - results[page.id].startTime!) / 1000)}s
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
