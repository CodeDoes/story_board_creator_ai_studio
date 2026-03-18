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
1. Break down the ENTIRE script into logical story beats (storyboard items).
2. Each story beat should represent a specific location and sequence of action.
3. For EACH story beat, you MUST generate between 8 and 32 distinct frames that cover the action in that beat.
4. Maintain visual continuity for existing characters, locations, and key props.
5. Generate detailed visual prompts for new elements.
6. Provide a summary for each sequence (new or updated).
7. If the script is long, ensure you process ALL of it, creating multiple storyboard items as needed. Do not stop after the first scene.

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
     frames: Array<{ id: number, prompt: string, priority: "highlight" | "standard" }> // Between 8 and 32 frames per beat. Approximately 25% should be "highlight".
   }>

CRITICAL: Ensure prompts are highly descriptive for cinematic generation. Use the provided style templates if applicable. The output MUST be valid JSON.`;
