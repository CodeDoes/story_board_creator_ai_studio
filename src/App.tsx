/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Key
} from 'lucide-react';
import { get, set, clear } from 'idb-keyval';
import { GoogleGenAI } from "@google/genai";
import { withRetry } from './services/apiUtils';
import { generateProductionAsset } from './services/gemini';
import { generateScriptLayout } from './services/layoutService';
import { PageData, Panel, Character, Prop, GenerationResult, ActivePanel, GenerationMode } from './types';
import { GLOBAL_STYLE, SUBTITLE_STYLE, DEFAULT_STORYBOARD, SCRIPT_INGEST_PROMPT_TEMPLATE } from './constants';
import { Toast } from './components/Toast';
import { IntentBox } from './components/IntentBox';
import { ReferenceCard } from './components/ReferenceCard';
import { ImageModal } from './components/ImageModal';

import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { ReferencesPanel } from './components/ReferencesPanel';
import { DataPanel } from './components/DataPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { SequencesPanel } from './components/SequencesPanel';
import { Footer } from './components/Footer';

// --- KEY SELECTION GUARD ---

const KeySelectionGuard = ({ children }: { children: React.ReactNode }) => {
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } else {
        // Fallback or development environment
        setHasKey(true);
      }
    };
    checkKey();
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Assume success and proceed as per guidelines
      setHasKey(true);
    }
  };

  if (hasKey === null) return null;

  if (!hasKey) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Key className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Connect Gemini API</h1>
          <p className="text-slate-400 mb-8 leading-relaxed">
            To generate high-quality storyboard assets and process scripts, you'll need to connect your own Gemini API key.
          </p>
          <button
            onClick={handleOpenKeySelector}
            className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
          >
            Select API Key
          </button>
          <p className="mt-6 text-xs text-slate-500">
            Don't have a key? Visit the <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Gemini API Billing Docs</a> to set one up.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// --- CONSTANTS ---

// Simple JSON repair for truncated LLM output
const repairJSON = (json: string): string => {
  let cleaned = json.trim();
  
  // Find first { and last }
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace === -1) return "{}";
  cleaned = cleaned.substring(firstBrace);
  
  // Basic stack-based repair for truncation
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let lastSignificantChar = '';

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      if (!inString) lastSignificantChar = '"';
      continue;
    }
    if (inString) continue;

    if (char.trim()) {
      lastSignificantChar = char;
    }

    if (char === '{' || char === '[') {
      stack.push(char);
    } else if (char === '}') {
      if (stack[stack.length - 1] === '{') stack.pop();
    } else if (char === ']') {
      if (stack[stack.length - 1] === '[') stack.pop();
    }
  }

  // If we are in a string, close it
  if (inString) {
    cleaned += '"';
    lastSignificantChar = '"';
  }

  // If the last character is a comma or colon, remove it
  if (lastSignificantChar === ',' || lastSignificantChar === ':') {
    const lastIndex = cleaned.lastIndexOf(lastSignificantChar);
    cleaned = cleaned.substring(0, lastIndex);
  }

  // Close open structures in reverse order
  while (stack.length > 0) {
    const last = stack.pop();
    if (last === '{') cleaned += '}';
    else if (last === '[') cleaned += ']';
  }

  return cleaned;
};

export default function App() {
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [storyboard, setStoryboard] = useState<PageData[]>(DEFAULT_STORYBOARD);
  const [storyboardAspectRatio, setStoryboardAspectRatio] = useState<"1:1" | "3:4" | "4:3" | "9:16" | "16:9">("16:9");
  const [sequenceSummaries, setSequenceSummaries] = useState<Record<string, string>>({});
  const [rawScript, setRawScript] = useState("");

  const [isProcessingScript, setIsProcessingScript] = useState(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const [scriptStartTime, setScriptStartTime] = useState<number | null>(null);
  const [scriptFirstTokenTime, setScriptFirstTokenTime] = useState<number | null>(null);
  const [scriptEndTime, setScriptEndTime] = useState<number | null>(null);
  const [activePanel, setActivePanel] = useState<"references" | "sequences" | "data" | "settings">("data");
  const [masterChars, setMasterChars] = useState<Record<string, Character>>({});
  const [masterProps, setMasterProps] = useState<Record<string, Prop>>({});
  const [sharedProps, setSharedProps] = useState<Record<string, { result: GenerationResult | null; loading: boolean; startTime?: number }>>({});
  const [activeTabs, setActiveTabs] = useState<Record<number, GenerationMode>>({});
  const [scriptText, setScriptText] = useState("");
  const [streamingScriptText, setStreamingScriptText] = useState("");

  const [modalData, setModalData] = useState<{
    isOpen: boolean;
    imageUrl: string;
    title: string;
    prompt?: string;
    feedback?: string;
    settings?: any;
  }>({
    isOpen: false,
    imageUrl: "",
    title: "",
  });

  const [results, setResults] = useState<Record<number, {
    story1K: GenerationResult | null;
    story2K: GenerationResult | null;
    story1K_layout: GenerationResult | null;
    story2K_layout: GenerationResult | null;
    loadingMode: string | null;
    status: string;
    startTime?: number;
  }>>({});
  
  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkApiKey = async () => {
      // Check if a key is already present in the environment (Secrets)
      const envKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (envKey) {
        setHasApiKey(true);
        return;
      }

      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      } else {
        // Fallback for local development or if not in AI Studio
        setHasApiKey(true);
      }
    };
    checkApiKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Assume success to mitigate race condition
      setHasApiKey(true);
    }
  };

  // Shared references across sequences with persistence
  const [sharedLocs, setSharedLocs] = useState<Record<string, { result: GenerationResult | null; loading: boolean; startTime?: number }>>({});
  const [sharedChars, setSharedChars] = useState<Record<string, { result: GenerationResult | null; loading: boolean; startTime?: number }>>({});
  
  const [toast, setToast] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.1-flash-image-preview');

  // Persistence Load (Async IndexedDB)
  useEffect(() => {
    const loadData = async () => {
      try {
        const [locs, chars, props, savedResults, savedStoryboard, savedSummaries, savedMasterChars, savedMasterProps, savedRawScript, savedScriptText] = await Promise.all([
          get('tether_locs'),
          get('tether_chars'),
          get('tether_props'),
          get('tether_results'),
          get('tether_storyboard'),
          get('tether_summaries'),
          get('tether_master_chars'),
          get('tether_master_props'),
          get('tether_raw_script'),
          get('tether_script_text')
        ]);
        
        if (locs) {
          const cleaned = { ...locs };
          Object.keys(cleaned).forEach(k => cleaned[k].loading = false);
          setSharedLocs(cleaned);
        }
        if (chars) {
          const cleaned = { ...chars };
          Object.keys(cleaned).forEach(k => cleaned[k].loading = false);
          setSharedChars(cleaned);
        }
        if (props) {
          const cleaned = { ...props };
          Object.keys(cleaned).forEach(k => cleaned[k].loading = false);
          setSharedProps(cleaned);
        }
        if (savedStoryboard) setStoryboard(savedStoryboard);
        if (savedSummaries) setSequenceSummaries(savedSummaries);
        if (savedMasterChars) setMasterChars(savedMasterChars);
        if (savedMasterProps) setMasterProps(savedMasterProps);
        if (savedRawScript) setRawScript(savedRawScript);
        if (savedScriptText) setScriptText(savedScriptText);
        
        const initialResults: any = {};
        
        // Use saved storyboard if available, otherwise use default
        const currentStoryboard = savedStoryboard || DEFAULT_STORYBOARD;
        
        currentStoryboard.forEach((p: any) => {
          const saved = savedResults?.[p.id];
          initialResults[p.id] = saved ? { ...saved, loadingMode: null, status: '' } : { 
            story1K: null, 
            story2K: null, 
            story1K_layout: null, 
            story2K_layout: null, 
            loadingMode: null, 
            status: '' 
          };
        });
        setResults(initialResults);
        setIsLoaded(true);
      } catch (err) {
        console.error("Failed to load from IndexedDB", err);
        setIsLoaded(true);
      }
    };
    loadData();
  }, []); // Run ONCE on mount

  // Persistence Sync (Async IndexedDB)
  useEffect(() => {
    if (isLoaded) {
      // Filter out loading states before saving
      const cleanLocs = { ...sharedLocs };
      Object.keys(cleanLocs).forEach(k => cleanLocs[k] = { ...cleanLocs[k], loading: false });
      
      const cleanChars = { ...sharedChars };
      Object.keys(cleanChars).forEach(k => cleanChars[k] = { ...cleanChars[k], loading: false });
      
      const cleanProps = { ...sharedProps };
      Object.keys(cleanProps).forEach(k => cleanProps[k] = { ...cleanProps[k], loading: false });

      set('tether_locs', cleanLocs);
      set('tether_chars', cleanChars);
      set('tether_props', cleanProps);
      set('tether_storyboard', storyboard);
      set('tether_summaries', sequenceSummaries);
      set('tether_master_chars', masterChars);
      set('tether_master_props', masterProps);
      set('tether_raw_script', rawScript);
      set('tether_script_text', scriptText);
      
      const resultsToSave = { ...results };
      Object.keys(resultsToSave).forEach(key => {
        resultsToSave[key] = { ...resultsToSave[key], loadingMode: null, status: '' };
      });
      set('tether_results', resultsToSave);
    }
  }, [sharedLocs, sharedChars, sharedProps, storyboard, sequenceSummaries, masterChars, masterProps, rawScript, results, isLoaded]);

  const clearPersistence = async () => {
    await clear();
    window.location.reload();
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleScriptOverride = (text: string) => {
    try {
      const data = JSON.parse(text);
      if (Array.isArray(data)) {
        setStoryboard(data);
      } else {
        if (data.masterChars) setMasterChars(data.masterChars);
        if (data.masterProps) setMasterProps(data.masterProps);
        if (data.sequenceSummaries) setSequenceSummaries(data.sequenceSummaries);
        if (data.storyboard) setStoryboard(data.storyboard);
      }
      setScriptText(text);
      showToast("Production Bible Updated Successfully");
    } catch (e) {
      alert("Invalid JSON format. Please ensure it matches the Production Bible schema.");
    }
  };

  const generateLocation = async (locPrompt: string, size: "512px" | "1K" | "2K" = "1K", force = false) => {
    const sizeOrder: Record<string, number> = { "512px": 0, "1K": 1, "2K": 2, "4K": 3 };
    // Cache check: Don't overwrite higher quality with lower quality
    const existing = sharedLocs[locPrompt];
    if (!force && existing?.result) {
      const existingSize = existing.result.settings.size as string;
      if (sizeOrder[existingSize] >= sizeOrder[size]) return existing.result;
    }

    setSharedLocs(prev => ({ ...prev, [locPrompt]: { result: prev[locPrompt]?.result || null, loading: true, startTime: Date.now() } }));
    try {
      const res = await generateProductionAsset(
        `[CONTEXT]: Reference Location (EMPTY ENVIRONMENT, NO PEOPLE, NO CHARACTERS, NO FOREGROUND CHARACTERS): ${locPrompt}. 
[STYLE]: ${GLOBAL_STYLE}`, 
        [], 
        size, 
        undefined, 
        selectedModel,
        "16:9",
        {
          imagePrompt: locPrompt,
          stylePrompt: GLOBAL_STYLE,
          contextPrompt: "EMPTY ENVIRONMENT, NO PEOPLE, NO CHARACTERS, NO FOREGROUND CHARACTERS"
        }
      );
      setSharedLocs(prev => ({ ...prev, [locPrompt]: { result: res, loading: false } }));
      return res;
    } catch (err: any) {
      setSharedLocs(prev => ({ ...prev, [locPrompt]: { result: prev[locPrompt]?.result || null, loading: false } }));
      const isOverloaded = JSON.stringify(err).includes("503") || JSON.stringify(err).includes("500");
      showToast(isOverloaded ? "Engine Overloaded. Try switching models." : "Location Generation Failed.");
      throw err;
    }
  };

  const generateCharacter = async (charId: string, size: "512px" | "1K" | "2K" = "1K", force = false) => {
    const charObj = masterChars[charId] || { name: charId, prompt: charId };
    const sizeOrder: Record<string, number> = { "512px": 0, "1K": 1, "2K": 2, "4K": 3 };
    
    // Cache check: Don't overwrite higher quality with lower quality
    const existing = sharedChars[charId];
    if (!force && existing?.result) {
      const existingSize = existing.result.settings.size as string;
      if (sizeOrder[existingSize] >= sizeOrder[size]) return existing.result;
    }

    setSharedChars(prev => ({ ...prev, [charId]: { result: prev[charId]?.result || null, loading: true, startTime: Date.now() } }));
    try {
      const res = await generateProductionAsset(
        `[CONTEXT]: Reference Character Portrait: ${charObj.prompt}. 
[STYLE]: ${GLOBAL_STYLE}`, 
        [], 
        size, 
        undefined, 
        selectedModel,
        "3:4",
        {
          imagePrompt: charObj.prompt,
          stylePrompt: GLOBAL_STYLE,
          contextPrompt: `Reference Character Portrait: ${charObj.name}`
        }
      );
      setSharedChars(prev => ({ ...prev, [charId]: { result: res, loading: false } }));
      return res;
    } catch (err: any) {
      setSharedChars(prev => ({ ...prev, [charId]: { result: prev[charId]?.result || null, loading: false } }));
      const isOverloaded = JSON.stringify(err).includes("503") || JSON.stringify(err).includes("500");
      showToast(isOverloaded ? "Engine Overloaded. Try switching models." : "Character Generation Failed.");
      throw err;
    }
  };

  const processScript = async () => {
    if (!rawScript.trim()) return;
    setIsProcessingScript(true);
    setScriptStartTime(Date.now());
    setScriptFirstTokenTime(null);
    setScriptEndTime(null);
    setStreamingScriptText("");
    setResults({}); // Clear results for fresh ingest
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
      const currentContext = {
        masterChars,
        masterProps,
        storyboard,
        sequenceSummaries
      };

      const prompt = SCRIPT_INGEST_PROMPT_TEMPLATE
        .replace("{{CURRENT_CONTEXT}}", JSON.stringify(currentContext, null, 2))
        .replace("{{RAW_SCRIPT}}", rawScript);

      const response = await withRetry(() => ai.models.generateContentStream({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1, // Lower temperature for more consistent JSON
        }
      }));

      let fullText = "";
      for await (const chunk of response) {
        if (controller.signal.aborted) break;
        const text = chunk.text;
        if (!fullText && text) {
          setScriptFirstTokenTime(Date.now());
        }
        fullText += text;
        setStreamingScriptText(fullText);
      }

      if (controller.signal.aborted) return;

      setScriptEndTime(Date.now());

      let data;
      try {
        // Attempt to parse directly
        data = JSON.parse(fullText || "{}");
      } catch (err) {
        console.warn("Direct JSON parse failed, attempting recovery...", err);
        try {
          const repaired = repairJSON(fullText);
          data = JSON.parse(repaired);
          console.log("JSON Recovery Successful via repairJSON");
        } catch (err2) {
          console.error("Recovery parse failed", err2);
          throw new Error(`JSON Parse Error: ${err instanceof Error ? err.message : String(err)}\n\nPartial Output: ${fullText.substring(0, 300)}...`);
        }
      }

      // Merge logic: Update existing or add new
      if (data.masterChars) {
        setMasterChars(prev => ({ ...prev, ...data.masterChars }));
      }
      if (data.masterProps) {
        setMasterProps(prev => ({ ...prev, ...data.masterProps }));
      }
      if (data.sequenceSummaries) {
        setSequenceSummaries(prev => ({ ...prev, ...data.sequenceSummaries }));
      }
      if (data.storyboard) {
        // For storyboard, we usually want to append or replace specific pages
        // but for now, let's keep the AI's version as the "merged" result
        // if it followed the prompt to include existing context.
        // If we want true incremental, we'd need more complex logic.
        // Let's stick to the AI's full output for now but support the repair.
        setStoryboard(data.storyboard);
        setScriptText(JSON.stringify(data, null, 2));
      }
      showToast("Script Merged Successfully.");
    } catch (err) {
      console.error("Script Processing Error:", err);
      showToast("Failed to process script.");
    } finally {
      setIsProcessingScript(false);
    }
  };

  const cancelScriptProcess = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsProcessingScript(false);
      showToast("Script processing cancelled.");
    }
  };

  const generateProp = async (propId: string, size: "1K" | "2K" = "1K", force = false) => {
    const prop = masterProps[propId];
    if (!prop) return;
    setSharedProps(prev => ({ ...prev, [propId]: { result: prev[propId]?.result || null, loading: true, startTime: Date.now() } }));
    
    try {
      const result = await generateProductionAsset(
        prop.prompt,
        [],
        size,
        undefined,
        selectedModel,
        "1:1",
        {
          imagePrompt: prop.prompt,
          stylePrompt: GLOBAL_STYLE,
          contextPrompt: `Master Prop Reference: ${prop.name}. High-fidelity object study.`
        }
      );
      setSharedProps(prev => ({ ...prev, [propId]: { result, loading: false } }));
      showToast(`Prop ${prop.name} generated!`);
    } catch (err) {
      setSharedProps(prev => ({ ...prev, [propId]: { result: prev[propId]?.result || null, loading: false } }));
      showToast("Prop generation failed.");
    }
  };

  const getStalenessReason = (page: PageData, result: GenerationResult | null): string | null => {
    if (!result || !result.referenceSnapshot) return null;
    const snap = result.referenceSnapshot;
    
    if (page.loc.prompt !== snap.locPrompt) return "Location prompt changed";
    if (sharedLocs[page.loc.prompt]?.result?.image !== snap.locImage) return "Location reference image updated";
    
    for (const cid of page.chars) {
      if (!snap.charPrompts[cid] || masterChars[cid]?.prompt !== snap.charPrompts[cid]) return `Character '${masterChars[cid]?.name || cid}' prompt changed`;
      if (sharedChars[cid]?.result?.image !== snap.charImages[cid]) return `Character '${masterChars[cid]?.name || cid}' reference image updated`;
    }
    
    if (JSON.stringify(page.frames || []) !== JSON.stringify(snap.frames || [])) return "Script frames modified";
    
    return null;
  };

  const getPromptData = (page: PageData, mode: GenerationMode) => {
    const locPrompt = page.loc.prompt;
    const pageFrames = page.frames || [];
    const isFull = mode.startsWith("full");
    const frames = isFull ? pageFrames : pageFrames.filter(f => f.priority === "highlight");
    const framesToUse = frames.length > 0 ? frames : pageFrames.slice(0, 4);
    
    const count = framesToUse.length;
    // Fixed 3x3 grid for 9 frames as per user request
    const cols = 3;
    const rows = 3;
    const gridLayout = `${cols}x${rows}`;
    
    const charNames = page.chars.map(cid => masterChars[cid]?.name || cid).join(', ');
    const propNames = (page.props || []).map(pid => masterProps[pid]?.name || pid).join(', ');

    let composite = `[CONTEXT]: Cinematic storyboard grid (${gridLayout} sequence, ${count} frames). Location: ${locPrompt}. Characters: ${charNames}. Props: ${propNames}.
[STYLE]: ${GLOBAL_STYLE} ${SUBTITLE_STYLE}.
[CONTINUITY]: Maintain strict visual continuity with the provided reference images. Lighting, character features, and environment details must match exactly. 
[LAYOUT]: CRITICAL: Use the provided layout reference image as a spatial guide for composition. Match the framing and object placement exactly.
[KEYFRAMES]: `;
    let imagePrompt = "";
    let contextPrompt = `Cinematic storyboard grid (${gridLayout} sequence, ${count} frames). Location: ${locPrompt}. Characters: ${charNames}. Props: ${propNames}. `;
    
    // Continuity Instructions
    const continuity = "CRITICAL: Maintain strict visual continuity with the provided reference images. Lighting, character features, and environment details must match exactly. ";
    composite += continuity;
    contextPrompt += continuity;

    if (isFull) {
      const motionStudy = `Full Production Track (Temporal): ${count}-frame granular sequence showing fluid motion and micro-transitions. 
      CRITICAL: This MUST be a ${gridLayout} grid containing ${count} distinct frames. 
      Each frame represents a tiny slice of time, showing the scene in motion. `;
      composite += motionStudy;
      imagePrompt += motionStudy;
    } else {
      const highlightTrack = `Highlight Track (Main Points): Simple ${gridLayout} grid showing ${count} key highlight frames. `;
      composite += highlightTrack;
      imagePrompt += highlightTrack;
    }
    
    framesToUse.forEach((f, i) => { 
      const frameText = `[Frame ${i+1}]: ${f.prompt} `;
      composite += frameText;
      imagePrompt += frameText;
    });

    return { composite, imagePrompt, contextPrompt };
  };

  const runProductionCycle = async (pageId: number) => {
    const mode = "full_layout" as GenerationMode;
    const page = storyboard.find(p => p.id === pageId);
    if (!page) return;

    const locPrompt = page.loc.prompt;
    
    // Generate layout on the fly
    const layoutRef = generateScriptLayout(page.frames || [], "full", storyboardAspectRatio);
    
    setResults(prev => ({
      ...prev,
      [pageId]: { ...prev[pageId], loadingMode: mode, status: `🎬 SYNCING REFERENCES FOR ${mode}...`, startTime: Date.now() }
    }));

    try {
      const [locRes, ...charAndPropResults] = await Promise.all([
        sharedLocs[locPrompt]?.result ? Promise.resolve(sharedLocs[locPrompt].result) : generateLocation(locPrompt),
        ...page.chars.map(cid => sharedChars[cid]?.result ? Promise.resolve(sharedChars[cid].result) : generateCharacter(cid)),
        ...(page.props || []).map(pid => sharedProps[pid]?.result ? Promise.resolve(sharedProps[pid].result) : generateProp(pid, "1K"))
      ]);

      const charResults = charAndPropResults.slice(0, page.chars.length);
      const propResults = charAndPropResults.slice(page.chars.length);

      setResults(prev => ({ ...prev, [pageId]: { ...prev[pageId], status: `🎬 GENERATING ${mode} TRACK...` } }));
      
      let { composite, imagePrompt, contextPrompt } = getPromptData(page, mode);
      const isFull = mode.startsWith("full");
      
      console.log("Final Prompt:", composite);
      
      const referenceImages = [];
      if (locRes?.image) referenceImages.push(locRes.image);
      charResults.forEach(cr => {
        if (cr?.image) referenceImages.push(cr.image);
      });
      propResults.forEach(pr => {
        if (pr?.image) referenceImages.push(pr.image);
      });

      // --- CONTINUITY: PREVIOUS BATCH REFERENCES ---
      
      // 1. Previous Sequence (Temporal Continuity)
      const prevPage = storyboard.find(p => p.id === pageId - 1);
      if (prevPage) {
        const prevRes = results[prevPage.id];
        const prevBatchImage = prevRes?.story2K?.image || prevRes?.story1K?.image || prevRes?.story2K_layout?.image || prevRes?.story1K_layout?.image;
        if (prevBatchImage) {
          referenceImages.push(prevBatchImage);
          const temporalText = "Reference image includes the PREVIOUS SEQUENCE for temporal continuity. ";
          composite += temporalText;
          contextPrompt += temporalText;
        }
      }

      // 2. Previous Iteration of this Tab (Iterative Continuity)
      const resultKey = mode === "highlights" ? "story1K" : 
                        mode === "full" ? "story2K" : 
                        mode === "highlights_layout" ? "story1K_layout" : "story2K_layout";
      const lastIterationImage = results[pageId][resultKey]?.image;
      if (lastIterationImage) {
        referenceImages.push(lastIterationImage);
        const iterativeText = "Reference image includes the PREVIOUS ITERATION of this specific track. Maintain and refine this look. ";
        composite += iterativeText;
        contextPrompt += iterativeText;
      }

      // 3. Cross-Mode Continuity (highlights <-> full)
      const otherModeKey = isFull ? "story1K" : "story2K";
      const otherModeImage = results[pageId][otherModeKey]?.image;
      if (otherModeImage) {
        referenceImages.push(otherModeImage);
        const crossModeText = `Reference image includes the ${isFull ? "Highlights" : "Full"} version of this sequence. Maintain visual consistency with this existing track. `;
        composite += crossModeText;
        contextPrompt += crossModeText;
      }

      const resStory = await generateProductionAsset(
        composite, 
        referenceImages, 
        "1K", 
        layoutRef, 
        selectedModel,
        storyboardAspectRatio,
        {
          imagePrompt,
          stylePrompt: `${GLOBAL_STYLE} ${SUBTITLE_STYLE}`,
          contextPrompt
        }
      );

      // Capture reference snapshot
      const charPrompts: Record<string, string> = {};
      const charImages: Record<string, string> = {};
      page.chars.forEach(cid => {
        charPrompts[cid] = masterChars[cid]?.prompt || cid;
        charImages[cid] = sharedChars[cid]?.result?.image || '';
      });

      const referenceSnapshot = {
        locPrompt: page.loc.prompt,
        locImage: locRes?.image,
        charPrompts,
        charImages,
        frames: JSON.parse(JSON.stringify(page.frames || []))
      };
      
      setResults(prev => ({
        ...prev,
        [pageId]: { 
          ...prev[pageId], 
          [resultKey]: { ...resStory, referenceSnapshot }, 
          loadingMode: null, 
          status: "Production Cycle Complete." 
        }
      }));
      
      setActiveTabs(prev => ({ ...prev, [pageId]: mode }));
      showToast(`${mode} Track Complete.`);
    } catch (err: any) {
      const errStr = JSON.stringify(err);
      const is503 = errStr.includes("503");
      const is500 = errStr.includes("500");
      
      let statusMsg = "❌ PIPELINE FAILED.";
      if (is503) statusMsg = "❌ MODEL OVERLOADED (503). Try Nano Banana (2.5).";
      if (is500) statusMsg = "❌ INTERNAL ENGINE ERROR (500). Try again or switch models.";
      
      setResults(prev => ({
        ...prev,
        [pageId]: { ...prev[pageId], loadingMode: null, status: statusMsg }
      }));
      
      if (is503 || is500) {
        showToast(is503 ? "Gemini 3.1 is busy (503)." : "Internal Engine Error (500).");
      }
    }
  };

  if (hasApiKey === false) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-300 font-sans p-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-sky-500/10 rounded-full flex items-center justify-center mx-auto border border-sky-500/30">
            <Key className="text-sky-400" size={32} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight mb-2">API Key Required</h2>
            <p className="text-sm text-slate-400">
              This application uses advanced Gemini models that require a user-provided API key from a paid Google Cloud project.
            </p>
          </div>
          <button
            onClick={handleSelectKey}
            className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            Select API Key
          </button>
          <p className="text-xs text-slate-500">
            Learn more about <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">billing and API keys</a>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-7xl mx-auto">
      <Header 
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        clearPersistence={clearPersistence}
      />

      <Navigation 
        activePanel={activePanel}
        setActivePanel={setActivePanel}
      />

      <main className="space-y-8">
        {activePanel === "references" ? (
          <ReferencesPanel 
            storyboard={storyboard}
            sharedLocs={sharedLocs}
            masterChars={masterChars}
            sharedChars={sharedChars}
            masterProps={masterProps}
            sharedProps={sharedProps}
            generateLocation={generateLocation}
            generateCharacter={generateCharacter}
            generateProp={generateProp}
            setModalData={setModalData}
            currentTime={currentTime}
          />
        ) : activePanel === "data" ? (
          <DataPanel 
            rawScript={rawScript}
            setRawScript={setRawScript}
            isProcessingScript={isProcessingScript}
            scriptStartTime={scriptStartTime}
            scriptFirstTokenTime={scriptFirstTokenTime}
            scriptEndTime={scriptEndTime}
            currentTime={currentTime}
            processScript={processScript}
            cancelScriptProcess={cancelScriptProcess}
            streamingScriptText={streamingScriptText}
            masterChars={masterChars}
            masterProps={masterProps}
            storyboard={storyboard}
            sequenceSummaries={sequenceSummaries}
            scriptText={scriptText}
            setScriptText={setScriptText}
            handleScriptOverride={handleScriptOverride}
            sharedChars={sharedChars}
            sharedProps={sharedProps}
            sharedLocs={sharedLocs}
            results={results}
            showToast={showToast}
          />
        ) : activePanel === "settings" ? (
          <SettingsPanel 
            handleSelectKey={handleSelectKey}
            hasApiKey={hasApiKey}
            storyboardAspectRatio={storyboardAspectRatio}
            setStoryboardAspectRatio={setStoryboardAspectRatio}
          />
        ) : (
          <SequencesPanel 
            storyboard={storyboard}
            sequenceSummaries={sequenceSummaries}
            sharedLocs={sharedLocs}
            sharedChars={sharedChars}
            sharedProps={sharedProps}
            masterChars={masterChars}
            masterProps={masterProps}
            results={results}
            storyboardAspectRatio={storyboardAspectRatio}
            currentTime={currentTime}
            runProductionCycle={runProductionCycle}
            setModalData={setModalData}
            getStalenessReason={getStalenessReason}
            getPromptData={getPromptData}
            generateScriptLayout={generateScriptLayout}
          />
        )}
      </main>

      <AnimatePresence>
    {toast && <Toast message={toast} onHide={() => setToast(null)} />}
  </AnimatePresence>

  <ImageModal 
    isOpen={modalData.isOpen}
    onClose={() => setModalData(prev => ({ ...prev, isOpen: false }))}
    imageUrl={modalData.imageUrl}
    title={modalData.title}
    prompt={modalData.prompt}
    feedback={modalData.feedback}
  />

  <Footer />
</div>
  );
}
