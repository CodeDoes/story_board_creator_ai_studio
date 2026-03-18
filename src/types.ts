export interface PageData {
  id: number;
  title: string;
  sequence: string;
  sequenceSummary?: string;
  priority: "high" | "low"; // Beat-level priority
  loc: { title: string; prompt: string };
  chars: string[];
  props?: string[];
  frames: StoryFrame[]; // The complete temporal sequence (8-32 frames)
}

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export interface StoryFrame {
  id: number;
  prompt: string;
  priority: "highlight" | "standard"; // Frame-level priority
}

export interface Panel {
  scene: string;
  prompt: string;
}

export interface Character {
  name: string;
  prompt: string;
}

export interface Prop {
  name: string;
  prompt: string;
}

export interface GenerationResult {
  image: string;
  feedback: string;
  timestamp: number;
  settings: {
    prompt: string;
    imagePrompt?: string;
    stylePrompt?: string;
    contextPrompt?: string;
    size: string;
    hasLayoutRef: boolean;
  };
  referenceSnapshot?: {
    locPrompt: string;
    locImage?: string;
    charPrompts: Record<string, string>;
    charImages: Record<string, string>;
    frames: StoryFrame[];
  };
}

export type ActivePanel = "references" | "sequences" | "raw";
export type GenerationMode = "highlights" | "full" | "highlights_layout" | "full_layout";
