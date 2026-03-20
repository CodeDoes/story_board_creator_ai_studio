import { PageData } from './types';

export const GLOBAL_STYLE = "Universal cinematic 35mm film still, sharp focus, authentic textures, natural lighting, deep shadows, anamorphic lens, high-fidelity details. No illustration, no cartoon styles, no blur.";
export const SUBTITLE_STYLE = "White cinematic subtitle text centered at the bottom of the frame for any dialogue.";

export const DEFAULT_STORYBOARD: PageData[] = [];

export const SCRIPT_INGEST_PROMPT_TEMPLATE = `Analyze this raw script and merge it into the current production storyboard.
        
CURRENT PRODUCTION DATA:
{{CURRENT_CONTEXT}}

NEW SCRIPT CONTENT:
{{RAW_SCRIPT}}

INSTRUCTIONS:
1. Break down the ENTIRE script into logical storyboard pages.
2. Each page MUST represent a specific location and sequence of action.
3. CRITICAL: Each storyboard page MUST contain EXACTLY 9 frames. If a scene is short, interpolate or add intermediate visual beats to reach exactly 9 frames. If a scene is long, split it into multiple storyboard pages (e.g., "Scene 1 - Part 1", "Scene 1 - Part 2"), each with exactly 9 frames.
4. Maintain visual continuity for existing characters, locations, and key props.
5. Generate detailed visual prompts for new elements.
6. Provide a summary for each sequence (new or updated).
7. If the script is long, ensure you process ALL of it, creating as many 9-frame storyboard pages as needed.

Return a COMPLETE NEW JSON object with:
1. "masterChars": Record<string, { name: string, prompt: string }> - All characters in the production.
2. "masterProps": Record<string, { name: string, prompt: string }> - Key objects, ships, or items that need visual consistency.
3. "sequenceSummaries": Record<string, string> - A brief overview of what each sequence is about.
4. "storyboard": Array<{
     id: number,
     title: string,
     sequence: string,
     priority: "high" | "low",
     loc: { title: string, prompt: string },
     chars: string[], // IDs from masterChars
     props: string[], // IDs from masterProps
     frames: Array<{ prompt: string, priority: "highlight" | "standard" }> // EXACTLY 9 frames per page.
   }>

CRITICAL: The output MUST be valid JSON. NO preamble, NO postamble, NO markdown code blocks. Just the raw JSON object.
Ensure all strings are correctly escaped and all objects are properly closed.
IMPORTANT: Pay close attention to commas between properties and elements. Do not forget them.
If the script is very long, you may simplify the frame descriptions to stay within token limits, but you MUST maintain the 9-frame structure per page.`;
