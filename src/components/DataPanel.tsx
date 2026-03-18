import React from 'react';
import { Loader2, Zap } from 'lucide-react';
import { PageData, Character, Prop } from '../types';
import { SCRIPT_INGEST_PROMPT_TEMPLATE } from '../constants';

interface DataPanelProps {
  rawScript: string;
  setRawScript: (script: string) => void;
  isProcessingScript: boolean;
  scriptStartTime: number | null;
  currentTime: number;
  processScript: () => void;
  streamingScriptText: string;
  masterChars: Record<string, Character>;
  masterProps: Record<string, Prop>;
  storyboard: PageData[];
  sequenceSummaries: Record<string, string>;
  sharedChars: Record<string, any>;
  sharedProps: Record<string, any>;
  sharedLocs: Record<string, any>;
  results: Record<number, any>;
  showToast: (msg: string) => void;
}

export const DataPanel: React.FC<DataPanelProps> = ({
  rawScript,
  setRawScript,
  isProcessingScript,
  scriptStartTime,
  currentTime,
  processScript,
  streamingScriptText,
  masterChars,
  masterProps,
  storyboard,
  sequenceSummaries,
  sharedChars,
  sharedProps,
  sharedLocs,
  results,
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
        <div className="flex justify-end gap-4 items-center">
          {isProcessingScript && scriptStartTime && (
            <span className="text-sky-500/50 text-[10px] font-mono uppercase tracking-widest">
              ELAPSED: {Math.floor((currentTime - scriptStartTime) / 1000)}s
            </span>
          )}
          <button 
            onClick={processScript}
            disabled={isProcessingScript || !rawScript.trim()}
            className="bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2"
          >
            {isProcessingScript ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
            {isProcessingScript ? "Processing..." : "Generate Production Bible"}
          </button>
        </div>
        {isProcessingScript && streamingScriptText && (
          <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded-xl max-h-48 overflow-y-auto">
            <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mb-2">Live Analysis Output</p>
            <pre className="text-slate-500 font-mono text-[10px] whitespace-pre-wrap">{streamingScriptText}</pre>
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

      {/* JSON Viewer */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-black uppercase tracking-widest italic">Production Bible JSON</h3>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify({ masterChars, storyboard, sequenceSummaries }, null, 2));
              showToast("JSON Copied to Clipboard");
            }}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all"
          >
            Copy JSON
          </button>
        </div>
        <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[10px] text-sky-400/80 overflow-auto max-h-64 whitespace-pre-wrap">
          {JSON.stringify({ masterChars, storyboard, sequenceSummaries }, null, 2)}
        </pre>
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
                <th className="px-4 py-3">Frame ID</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3 rounded-tr-lg">Prompt</th>
              </tr>
            </thead>
            <tbody>
              {storyboard.flatMap(page => 
                page.frames.map(frame => (
                  <tr key={`frame-${page.id}-${frame.id}`} className="border-b border-slate-800/50">
                    <td className="px-4 py-3 font-mono text-xs">{page.id}</td>
                    <td className="px-4 py-3 font-mono text-xs">{frame.id}</td>
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
