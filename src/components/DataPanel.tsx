import React from 'react';
import { Loader2, Zap } from 'lucide-react';
import { PageData, Character, Prop } from '../types';
import { SCRIPT_INGEST_PROMPT_TEMPLATE } from '../constants';

interface DataPanelProps {
  rawScript: string;
  setRawScript: (script: string) => void;
  isProcessingScript: boolean;
  scriptStartTime: number | null;
  scriptFirstTokenTime: number | null;
  scriptEndTime: number | null;
  currentTime: number;
  processScript: () => void;
  cancelScriptProcess: () => void;
  streamingScriptText: string;
  masterChars: Record<string, Character>;
  masterProps: Record<string, Prop>;
  storyboard: PageData[];
  sequenceSummaries: Record<string, string>;
  sharedChars: Record<string, any>;
  sharedProps: Record<string, any>;
  sharedLocs: Record<string, any>;
  results: Record<number, any>;
  scriptText: string;
  setScriptText: (text: string) => void;
  handleScriptOverride: (text: string) => void;
  showToast: (msg: string) => void;
}

export const DataPanel: React.FC<DataPanelProps> = ({
  rawScript,
  setRawScript,
  isProcessingScript,
  scriptStartTime,
  scriptFirstTokenTime,
  scriptEndTime,
  currentTime,
  processScript,
  cancelScriptProcess,
  streamingScriptText,
  masterChars,
  masterProps,
  storyboard,
  sequenceSummaries,
  sharedChars,
  sharedProps,
  sharedLocs,
  results,
  scriptText,
  setScriptText,
  handleScriptOverride,
  showToast
}) => {
  return (
    <div className="space-y-8">
      {/* Script Ingest */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-white font-black uppercase tracking-widest italic mb-4">Script Ingest</h3>
        <textarea 
          value={rawScript}
          onChange={(e) => setRawScript(e.target.value)}
          placeholder="Paste your script here..."
          className="w-full h-48 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-slate-300 font-mono text-sm outline-none focus:border-sky-500/50 transition-all mb-4"
        />
        <div className="flex justify-end gap-6 items-center">
          {isProcessingScript && scriptStartTime && (
            <div className="flex gap-6">
              <div className="flex flex-col items-end">
                <span className="text-slate-500 text-[8px] font-black uppercase tracking-[0.2em]">Total Elapsed</span>
                <span className="text-sky-400 text-xs font-mono">
                  {Math.floor((currentTime - scriptStartTime) / 1000)}s
                </span>
              </div>
              
              <div className="flex flex-col items-end">
                <span className="text-slate-500 text-[8px] font-black uppercase tracking-[0.2em]">Time to Read</span>
                <span className="text-sky-400 text-xs font-mono">
                  {scriptFirstTokenTime 
                    ? `${Math.floor((scriptFirstTokenTime - scriptStartTime) / 1000)}s` 
                    : "---"}
                </span>
              </div>

              <div className="flex flex-col items-end">
                <span className="text-slate-500 text-[8px] font-black uppercase tracking-[0.2em]">Time to Output</span>
                <span className="text-sky-400 text-xs font-mono">
                  {scriptFirstTokenTime 
                    ? `${Math.floor((currentTime - scriptFirstTokenTime) / 1000)}s` 
                    : "---"}
                </span>
              </div>
            </div>
          )}
          {!isProcessingScript && scriptEndTime && scriptStartTime && (
            <div className="flex gap-6">
              <div className="flex flex-col items-end">
                <span className="text-slate-500 text-[8px] font-black uppercase tracking-[0.2em]">Last Process Time</span>
                <span className="text-emerald-400 text-xs font-mono">
                  {Math.floor((scriptEndTime - scriptStartTime) / 1000)}s
                </span>
              </div>
            </div>
          )}
          <button 
            onClick={processScript}
            disabled={isProcessingScript || !rawScript.trim()}
            className="bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2"
          >
            {isProcessingScript ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
            {isProcessingScript ? "Processing..." : "Generate Production Bible"}
          </button>
          {isProcessingScript && (
            <button 
              onClick={cancelScriptProcess}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-500 px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all"
            >
              Cancel
            </button>
          )}
        </div>
        {!isProcessingScript && (
          <p className="text-[10px] text-slate-500 mt-2 text-right italic">
            Note: Large scripts may take a few moments. We use Gemini 3 Flash for high-speed processing.
          </p>
        )}
        {isProcessingScript && (
          <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-2 h-2 bg-sky-500 rounded-full animate-pulse" />
              <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest">
                {!scriptFirstTokenTime ? "Reading & Analyzing Script..." : "Generating Production Bible..."}
              </p>
            </div>
            {streamingScriptText && (
              <div className="max-h-64 overflow-y-auto scrollbar-hide">
                <pre className="text-slate-500 font-mono text-[10px] whitespace-pre-wrap leading-relaxed">
                  {streamingScriptText}
                </pre>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Script Ingest Prompt */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-white font-black uppercase tracking-widest italic mb-4">Ingest Prompt Template</h3>
        <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[10px] text-slate-400 overflow-auto max-h-64 whitespace-pre-wrap">
          {SCRIPT_INGEST_PROMPT_TEMPLATE}
        </pre>
      </section>

      {/* JSON Editor/Viewer */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <h3 className="text-white font-black uppercase tracking-widest italic">Production Bible JSON</h3>
            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-1">Manual override for fine-tuning the ingested script</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => {
                navigator.clipboard.writeText(scriptText);
                showToast("JSON Copied to Clipboard");
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all"
            >
              Copy JSON
            </button>
            <button 
              onClick={() => handleScriptOverride(scriptText)}
              className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all border border-emerald-500/20"
            >
              Apply Changes
            </button>
          </div>
        </div>
        <textarea 
          value={scriptText}
          onChange={(e) => setScriptText(e.target.value)}
          placeholder="Production Bible JSON will appear here after ingestion..."
          className="w-full h-96 bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[10px] text-sky-400/80 outline-none focus:border-sky-500/50 transition-all whitespace-pre overflow-auto"
        />
      </section>

      {/* References Table */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-white font-black uppercase tracking-widest italic mb-4">References Table</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="text-xs text-slate-500 uppercase bg-slate-950/50">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">Type</th>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Name/Title</th>
                <th className="px-4 py-3">Prompt</th>
                <th className="px-4 py-3 rounded-tr-lg">Image</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(masterChars).map((id) => {
                const char = masterChars[id];
                return (
                <tr key={`char-${id}`} className="border-b border-slate-800/50">
                  <td className="px-4 py-3">Character</td>
                  <td className="px-4 py-3 font-mono text-xs">{id}</td>
                  <td className="px-4 py-3 font-bold text-slate-300">{char.name}</td>
                  <td className="px-4 py-3 text-xs">{char.prompt}</td>
                  <td className="px-4 py-3">
                    {sharedChars[id]?.result?.image ? (
                      <img src={sharedChars[id].result.image} className="w-10 h-10 object-cover rounded" referrerPolicy="no-referrer" />
                    ) : <span className="text-xs text-slate-600">None</span>}
                  </td>
                </tr>
              )})}
              {Object.keys(masterProps).map((id) => {
                const prop = masterProps[id];
                return (
                <tr key={`prop-${id}`} className="border-b border-slate-800/50">
                  <td className="px-4 py-3">Prop</td>
                  <td className="px-4 py-3 font-mono text-xs">{id}</td>
                  <td className="px-4 py-3 font-bold text-slate-300">{prop.name}</td>
                  <td className="px-4 py-3 text-xs">{prop.prompt}</td>
                  <td className="px-4 py-3">
                    {sharedProps[id]?.result?.image ? (
                      <img src={sharedProps[id].result.image} className="w-10 h-10 object-cover rounded" referrerPolicy="no-referrer" />
                    ) : <span className="text-xs text-slate-600">None</span>}
                  </td>
                </tr>
              )})}
              {(Array.from(new Set(storyboard.map(p => p.loc.prompt))) as string[]).map(locPrompt => {
                const locTitle = storyboard.find(p => p.loc.prompt === locPrompt)?.loc.title || "Unknown";
                return (
                  <tr key={`loc-${locPrompt}`} className="border-b border-slate-800/50">
                    <td className="px-4 py-3">Location</td>
                    <td className="px-4 py-3 font-mono text-xs">-</td>
                    <td className="px-4 py-3 font-bold text-slate-300">{locTitle}</td>
                    <td className="px-4 py-3 text-xs">{locPrompt}</td>
                    <td className="px-4 py-3">
                      {sharedLocs[locPrompt]?.result?.image ? (
                        <img src={sharedLocs[locPrompt].result.image} className="w-10 h-10 object-cover rounded" referrerPolicy="no-referrer" />
                      ) : <span className="text-xs text-slate-600">None</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Storyboard Images Table */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-white font-black uppercase tracking-widest italic mb-4">Storyboard Images Table</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="text-xs text-slate-500 uppercase bg-slate-950/50">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">Beat ID</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Sequence</th>
                <th className="px-4 py-3">1K Image</th>
                <th className="px-4 py-3">2K Image</th>
                <th className="px-4 py-3">1K Layout</th>
                <th className="px-4 py-3 rounded-tr-lg">2K Layout</th>
              </tr>
            </thead>
            <tbody>
              {storyboard.map(page => (
                <tr key={`sb-${page.id}`} className="border-b border-slate-800/50">
                  <td className="px-4 py-3 font-mono text-xs">{page.id}</td>
                  <td className="px-4 py-3 font-bold text-slate-300">{page.title}</td>
                  <td className="px-4 py-3 text-xs">{page.sequence}</td>
                  <td className="px-4 py-3">
                    {results[page.id]?.story1K?.image ? (
                      <img src={results[page.id].story1K.image} className="w-16 h-9 object-cover rounded" referrerPolicy="no-referrer" />
                    ) : <span className="text-xs text-slate-600">-</span>}
                  </td>
                  <td className="px-4 py-3">
                    {results[page.id]?.story2K?.image ? (
                      <img src={results[page.id].story2K.image} className="w-16 h-9 object-cover rounded" referrerPolicy="no-referrer" />
                    ) : <span className="text-xs text-slate-600">-</span>}
                  </td>
                  <td className="px-4 py-3">
                    {results[page.id]?.story1K_layout?.image ? (
                      <img src={results[page.id].story1K_layout.image} className="w-16 h-9 object-cover rounded" referrerPolicy="no-referrer" />
                    ) : <span className="text-xs text-slate-600">-</span>}
                  </td>
                  <td className="px-4 py-3">
                    {results[page.id]?.story2K_layout?.image ? (
                      <img src={results[page.id].story2K_layout.image} className="w-16 h-9 object-cover rounded" referrerPolicy="no-referrer" />
                    ) : <span className="text-xs text-slate-600">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sequence Table */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-white font-black uppercase tracking-widest italic mb-4">Sequence Table</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="text-xs text-slate-500 uppercase bg-slate-950/50">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">Sequence Name</th>
                <th className="px-4 py-3">Summary</th>
                <th className="px-4 py-3 rounded-tr-lg">Beats Count</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(sequenceSummaries).map(([seqName, summary]) => (
                <tr key={`seq-${seqName}`} className="border-b border-slate-800/50">
                  <td className="px-4 py-3 font-bold text-slate-300 whitespace-nowrap">{seqName}</td>
                  <td className="px-4 py-3 text-xs">{summary}</td>
                  <td className="px-4 py-3 font-mono text-xs">{storyboard.filter(p => p.sequence === seqName).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Keyframes Table */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-white font-black uppercase tracking-widest italic mb-4">Keyframes Table</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="text-xs text-slate-500 uppercase bg-slate-950/50">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">Beat ID</th>
                <th className="px-4 py-3">Frame Index</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3 rounded-tr-lg">Prompt</th>
              </tr>
            </thead>
            <tbody>
              {storyboard.flatMap(page => 
                page.frames.map((frame, idx) => (
                  <tr key={`frame-${page.id}-${idx}`} className="border-b border-slate-800/50">
                    <td className="px-4 py-3 font-mono text-xs">{page.id}</td>
                    <td className="px-4 py-3 font-mono text-xs">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        frame.priority === 'highlight' ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-800 text-slate-500'
                      }`}>
                        {frame.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{frame.prompt}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
