/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  User, 
  LayoutGrid, 
  Play, 
  Copy, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  ChevronRight,
  FileText,
  Settings,
  Image as ImageIcon,
  RefreshCw,
  Trash2,
  MapPin,
  Clapperboard,
  Zap,
  Download,
  Layout,
  Box,
  Check,
  Key
} from 'lucide-react';
import { get, set, clear } from 'idb-keyval';
import { GoogleGenAI } from "@google/genai";
import { generateProductionAsset } from './services/gemini';
import { generateScriptLayout } from './services/layoutService';
import { PageData, Panel, Character, Prop, GenerationResult, ActivePanel, GenerationMode } from './types';
import { Toast } from './components/Toast';
import { IntentBox } from './components/IntentBox';
import { ReferenceCard } from './components/ReferenceCard';
import { ImageModal } from './components/ImageModal';

// --- CONSTANTS ---

const GLOBAL_STYLE = "Universal cinematic 35mm film still, sharp focus, authentic textures, natural lighting, deep shadows, anamorphic lens, high-fidelity details. No illustration, no cartoon styles, no blur.";
const SUBTITLE_STYLE = "White cinematic subtitle text centered at the bottom of the frame for any dialogue.";

const DEFAULT_STORYBOARD: PageData[] = [
  {
    "id": 1,
    "title": "The Awakening & Arrival",
    "sequence": "Sequence 1",
    "priority": "high",
    "loc": {
      "title": "The Liminal - Crew Quarters & Cockpit",
      "prompt": "Interior of a cramped, dark spaceship sleeping cabin transitioning into a functional cockpit with a wide viewport. Metal panels covered in 20 years of modifications, cable runs, and flickering blue-green status lights."
    },
    "chars": ["kael"],
    "props": ["liminal"],
    "frames": [
      { "id": 1, "priority": "highlight", "prompt": "Extreme macro shot of Kael's eye snapping open in the dark. Holographic data strings and a blue-green LED status light reflect in his wet iris." },
      { "id": 2, "priority": "standard", "prompt": "Kael sits up, the cabin lights flickering to life. He rubs his face, exhausted." },
      { "id": 3, "priority": "standard", "prompt": "Kael climbs into the pilot's seat, the console humming as he initiates the power-up sequence." },
      { "id": 4, "priority": "highlight", "prompt": "Wide shot through the cockpit viewport. The massive, skeletal structure of Kepler Station looms against the backdrop of a swirling gas giant. The Liminal's nose is visible in the foreground." },
      { "id": 5, "priority": "standard", "prompt": "The ship's thrusters fire, small blue plumes visible in the dark." },
      { "id": 6, "priority": "standard", "prompt": "Kael checks his navigation console, his face illuminated by the green glow." },
      { "id": 7, "priority": "standard", "prompt": "The Liminal approaches the station's docking arm." },
      { "id": 8, "priority": "standard", "prompt": "A close-up of the ship's docking port extending." },
      { "id": 9, "priority": "standard", "prompt": "The station's docking bay doors slowly open." },
      { "id": 10, "priority": "standard", "prompt": "The Liminal enters the hangar, the station's interior visible." },
      { "id": 11, "priority": "standard", "prompt": "The ship settles into the docking cradle." },
      { "id": 12, "priority": "standard", "prompt": "The main engines shut down, the blue glow fading." },
      { "id": 13, "priority": "standard", "prompt": "Kael unbuckles his harness and prepares to disembark." },
      { "id": 14, "priority": "highlight", "prompt": "Close up of massive hydraulic docking clamps slamming shut onto The Liminal's hull. Sparks fly and steam erupts from the pressure seal." },
      { "id": 15, "priority": "standard", "prompt": "The airlock cycles, a hissing sound filling the cockpit." },
      { "id": 16, "priority": "highlight", "prompt": "Medium shot. Kael steps off the ramp into the bay. Tomas and Yuki, two station mechanics in greasy coveralls, wait for him with suspicious expressions." }
    ]
  }
];

const SCRIPT_INGEST_PROMPT_TEMPLATE = `Analyze this raw script and merge it into the current production storyboard.
        
CURRENT PRODUCTION DATA:
{{CURRENT_CONTEXT}}

NEW SCRIPT CONTENT:
{{RAW_SCRIPT}}

INSTRUCTIONS:
1. Compare the new script with the existing data.
2. Decide what to ADD, REMOVE, or REPLACE.
3. Maintain visual consistency for existing characters, locations, and key props.
4. Generate detailed visual prompts for new elements.
5. Provide a summary for each sequence (new or updated).

Return a COMPLETE NEW JSON object with:
1. "masterChars": Record<string, { name: string, prompt: string }>
2. "masterProps": Record<string, { name: string, prompt: string }> - Key objects, ships, or items that need visual consistency.
3. "sequenceSummaries": Record<string, string> - A brief overview of what each sequence is about.
4. "storyboard": Array<{
     id: number,
     title: string,
     sequence: string,
     priority: "high" | "low",
     loc: { title: string, prompt: string },
     chars: string[],
     props: string[], // IDs of master props present in this beat
     frames: Array<{ id: number, prompt: string, priority: "highlight" | "standard" }> // Exactly 16 frames. 4 must be "highlight".
   }> - Every story beat. High priority for key narrative shifts, low for transitions.

Ensure prompts are highly descriptive for cinematic generation.`;

export default function App() {
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [storyboard, setStoryboard] = useState<PageData[]>(DEFAULT_STORYBOARD);
  const [sequenceSummaries, setSequenceSummaries] = useState<Record<string, string>>({
    "Sequence 1": "Kael Vasaro wakes up in his cramped quarters on The Liminal, preparing for another day of survival in deep space."
  });
  const [rawScript, setRawScript] = useState("");
  const [isProcessingScript, setIsProcessingScript] = useState(false);
  const [scriptStartTime, setScriptStartTime] = useState<number | null>(null);
  const [activePanel, setActivePanel] = useState<"references" | "sequences" | "data" | "settings">("sequences");
  const [masterChars, setMasterChars] = useState<Record<string, Character>>({
    kael: { 
      name: "Kael Vasaro", 
      prompt: "A weathered man in his 50s, grey stubble, deep-set weary eyes, wearing a patched flight suit with faded insignias. Cybernetic data port visible behind his left ear." 
    },
    tomas: {
      name: "Tomas",
      prompt: "A burly station mechanic in greasy coveralls, with a thick beard and a suspicious expression."
    },
    yuki: {
      name: "Yuki",
      prompt: "A lean, sharp-eyed mechanic with short-cropped black hair and a tool belt slung low on her hips."
    },
    marcus: {
      name: "Marcus",
      prompt: "A shadowy figure in a hooded cloak, his face partially obscured by shadows."
    },
    fake_cops: {
      name: "Security Guards",
      prompt: "Figures in black security uniforms with polarized visors that obscure their faces."
    },
    elara: {
      name: "Elara (AI)",
      prompt: "A shimmering blue AI avatar with ethereal features and glowing eyes."
    }
  });
  const [masterProps, setMasterProps] = useState<Record<string, Prop>>({
    liminal: {
      name: "The Liminal (Ship)",
      prompt: "A rugged, modular spaceship with a weathered hull, exposed cable runs, and a distinctive nose shape. It looks like it's been through decades of repairs."
    },
    kepler: {
      name: "Kepler Station",
      prompt: "A massive, skeletal space station with industrial modules, docking arms, and rotating warning lights, set against a gas giant."
    },
    docking_clamps: {
      name: "Docking Clamps",
      prompt: "Massive hydraulic metal clamps with heavy pistons and industrial grime, designed to lock onto ship hulls."
    },
    data_cube: {
      name: "Data Cube",
      prompt: "A small, glowing crystalline cube with intricate internal circuitry that emits a soft blue light."
    }
  });
  const [sharedProps, setSharedProps] = useState<Record<string, { result: GenerationResult | null; loading: boolean; startTime?: number }>>({});
  const [scriptText, setScriptText] = useState("");
  const [streamingScriptText, setStreamingScriptText] = useState("");
  const [showScriptEditor, setShowScriptEditor] = useState(false);

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
        const [locs, chars, props, savedResults, savedStoryboard, savedSummaries] = await Promise.all([
          get('tether_locs'),
          get('tether_chars'),
          get('tether_props'),
          get('tether_results'),
          get('tether_storyboard'),
          get('tether_summaries')
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
      
      const resultsToSave = { ...results };
      Object.keys(resultsToSave).forEach(key => {
        resultsToSave[key] = { ...resultsToSave[key], loadingMode: null, status: '' };
      });
      set('tether_results', resultsToSave);
    }
  }, [sharedLocs, sharedChars, sharedProps, storyboard, sequenceSummaries, results, isLoaded]);

  const clearPersistence = async () => {
    await clear();
    window.location.reload();
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleScriptOverride = () => {
    try {
      const parsed = JSON.parse(scriptText);
      setStoryboard(parsed);
      setShowScriptEditor(false);
      showToast("Script Updated Successfully");
    } catch (e) {
      alert("Invalid JSON script format");
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
    setStreamingScriptText("");
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

      const response = await ai.models.generateContentStream({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      let fullText = "";
      for await (const chunk of response) {
        fullText += chunk.text;
        setStreamingScriptText(fullText);
      }

      const data = JSON.parse(fullText || "{}");
      if (data.masterChars) setMasterChars(data.masterChars);
      if (data.masterProps) setMasterProps(data.masterProps);
      if (data.sequenceSummaries) setSequenceSummaries(data.sequenceSummaries);
      if (data.storyboard) {
        setStoryboard(data.storyboard);
        setScriptText(JSON.stringify(data, null, 2));
      }
      showToast("Script Merged Successfully.");
      setShowScriptEditor(false);
    } catch (err) {
      console.error("Script Processing Error:", err);
      showToast("Failed to process script.");
    } finally {
      setIsProcessingScript(false);
      setScriptStartTime(null);
      setStreamingScriptText("");
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
    let cols = Math.ceil(Math.sqrt(count));
    let rows = Math.ceil(count / cols);
    if (cols / rows < 1.5 && cols < count) {
       const altCols = cols + 1;
       const altRows = Math.ceil(count / altCols);
       if (altCols * altRows >= count) { cols = altCols; rows = altRows; }
    }
    const gridLayout = `${cols}x${rows}`;
    
    const charNames = page.chars.map(cid => masterChars[cid]?.name || cid).join(', ');
    const propNames = (page.props || []).map(pid => masterProps[pid]?.name || pid).join(', ');

    let composite = `[CONTEXT]: Cinematic storyboard grid (${gridLayout} sequence, ${count} frames). Location: ${locPrompt}. Characters: ${charNames}. Props: ${propNames}.
[STYLE]: ${GLOBAL_STYLE} ${SUBTITLE_STYLE}.
[CONTINUITY]: Maintain strict visual continuity with the provided reference images. Lighting, character features, and environment details must match exactly. 
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
    const layoutRef = generateScriptLayout(page.frames || [], "full");
    
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
        isFull ? "2K" : "1K", 
        layoutRef, 
        selectedModel,
        "16:9",
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
      <header className="mb-6 border-b border-slate-800 pb-6 flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <p className="text-slate-400 text-sm uppercase tracking-widest font-black italic">TETHER <span className="text-sky-600 font-bold ml-2">— Multimodal Production Engine</span></p>
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

      {showScriptEditor || storyboard.length === 0 ? (
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
            {storyboard.length > 0 && (
              <button 
                onClick={() => setShowScriptEditor(false)}
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
      ) : (
        <>
          <nav className="flex items-center gap-8 mb-6 border-b border-slate-800/50 pb-2">
            <button 
              onClick={() => setActivePanel("sequences")}
              className={`text-sm font-black uppercase tracking-widest transition-all pb-4 relative ${activePanel === "sequences" ? "text-sky-400" : "text-slate-500 hover:text-slate-300"}`}
            >
              Sequences
              {activePanel === "sequences" && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-sky-400 rounded-full" />}
            </button>
            <button 
              onClick={() => setActivePanel("references")}
              className={`text-sm font-black uppercase tracking-widest transition-all pb-4 relative ${activePanel === "references" ? "text-sky-400" : "text-slate-500 hover:text-slate-300"}`}
            >
              References
              {activePanel === "references" && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-sky-400 rounded-full" />}
            </button>
            <button 
              onClick={() => setActivePanel("data")}
              className={`text-sm font-black uppercase tracking-widest transition-all pb-4 relative ${activePanel === "data" ? "text-sky-400" : "text-slate-500 hover:text-slate-300"}`}
            >
              Data
              {activePanel === "data" && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-sky-400 rounded-full" />}
            </button>
            <button 
              onClick={() => setActivePanel("settings")}
              className={`text-sm font-black uppercase tracking-widest transition-all pb-4 relative ${activePanel === "settings" ? "text-sky-400" : "text-slate-500 hover:text-slate-300"}`}
            >
              Settings
              {activePanel === "settings" && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-sky-400 rounded-full" />}
            </button>
          </nav>

      <main className="space-y-8">
        {activePanel === "references" ? (
          <div className="space-y-8">
            {/* References Header */}
            <section className="bg-sky-500/5 border border-sky-500/10 rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-3">
                <Zap className="text-sky-500" size={20} />
                <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Visual Anchor System</h2>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed max-w-3xl">
                The Tether pipeline relies on <span className="text-sky-400 font-bold italic">Visual Anchors</span> to maintain cinematic consistency. 
                Generate your <span className="text-sky-400 font-bold">Location</span> and <span className="text-purple-400 font-bold">Character</span> master references first. 
                These assets are injected into the generation prompt for every story beat, ensuring that lighting, architecture, and character features remain identical across the entire production.
              </p>
            </section>

            <section>
              <div className="flex items-center gap-4 mb-6">
                <Camera className="text-sky-500" size={20} />
                <h2 className="text-xl font-black text-white italic">LOCATION MASTER LIST</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(Array.from(new Set(storyboard.map(p => p.loc.prompt))) as string[]).map(locPrompt => (
                  <ReferenceCard 
                    key={locPrompt}
                    title={locPrompt}
                    type="Location"
                    aspectRatio="aspect-video"
                    data={sharedLocs[locPrompt]}
                    onGenerate={() => { generateLocation(locPrompt, "1K", true); }}
                    onImageClick={(url, title, prompt, feedback, settings) => setModalData({ isOpen: true, imageUrl: url, title, prompt, feedback, settings })}
                    currentTime={currentTime}
                  />
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center gap-4 mb-6">
                <User className="text-sky-500" size={20} />
                <h2 className="text-xl font-black text-white italic">CHARACTER MASTER LIST</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {Object.keys(masterChars).map(charId => (
                  <ReferenceCard 
                    key={charId}
                    title={masterChars[charId].name}
                    type="Character"
                    aspectRatio="aspect-[3/4]"
                    data={sharedChars[charId]}
                    onGenerate={() => { generateCharacter(charId, "1K", true); }}
                    onImageClick={(url, title, prompt, feedback, settings) => setModalData({ isOpen: true, imageUrl: url, title, prompt, feedback, settings })}
                    currentTime={currentTime}
                  />
                ))}
              </div>
            </section>
            <section>
              <div className="flex items-center gap-4 mb-6">
                <Box className="text-sky-500" size={20} />
                <h2 className="text-xl font-black text-white italic">PROP MASTER LIST</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {Object.keys(masterProps).map(propId => (
                  <ReferenceCard 
                    key={propId}
                    title={masterProps[propId].name}
                    type="Prop"
                    aspectRatio="aspect-square"
                    data={sharedProps[propId]}
                    onGenerate={() => { generateProp(propId, "1K", true); }}
                    onImageClick={(url, title, prompt, feedback, settings) => setModalData({ isOpen: true, imageUrl: url, title, prompt, feedback, settings })}
                    currentTime={currentTime}
                  />
                ))}
              </div>
            </section>
          </div>
        ) : activePanel === "data" ? (
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
                    {/* Characters */}
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
                    {/* Props */}
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
                    {/* Locations */}
                    {Array.from(new Set(storyboard.map(p => p.loc.prompt))).map(locPrompt => {
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
          </div>
        ) : activePanel === "settings" ? (
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
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Group by Sequence */}
            {Array.from(new Set(storyboard.map(p => p.sequence))).map(seqName => (
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
                                  const layoutImg = generateScriptLayout(page.frames || [], "full");
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
                                  <img src={generateScriptLayout(page.frames || [], "full")} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
                          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden aspect-video relative group">
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
                                      src={generateScriptLayout(page.frames || [], "full")} 
                                      className="w-full h-full object-cover grayscale invert"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                  <div className="p-6 bg-slate-900 rounded-full mb-6 relative z-10">
                                    <Clapperboard className="text-slate-700" size={64} />
                                  </div>
                                  <h5 className="text-lg font-black text-white italic mb-2 uppercase tracking-tighter relative z-10">Awaiting Production Cycle</h5>
                                  <p className="text-slate-500 text-xs leading-relaxed max-w-sm relative z-10">
                                    This track will generate a 4x4 grid of the full 16-frame temporal sequence for maximum granular detail.
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
        )}
      </main>
    </>
  )}

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
</div>
  );
}
