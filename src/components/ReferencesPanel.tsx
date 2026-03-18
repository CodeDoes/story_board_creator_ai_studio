import React from 'react';
import { Camera, User, Box, Zap } from 'lucide-react';
import { ReferenceCard } from './ReferenceCard';
import { PageData, Character, Prop } from '../types';

interface ReferencesPanelProps {
  storyboard: PageData[];
  sharedLocs: Record<string, any>;
  masterChars: Record<string, Character>;
  sharedChars: Record<string, any>;
  masterProps: Record<string, Prop>;
  sharedProps: Record<string, any>;
  generateLocation: (prompt: string, size: any, force: boolean) => void;
  generateCharacter: (id: string, size: any, force: boolean) => void;
  generateProp: (id: string, size: any, force: boolean) => void;
  setModalData: (data: any) => void;
  currentTime: number;
}

export const ReferencesPanel: React.FC<ReferencesPanelProps> = ({
  storyboard,
  sharedLocs,
  masterChars,
  sharedChars,
  masterProps,
  sharedProps,
  generateLocation,
  generateCharacter,
  generateProp,
  setModalData,
  currentTime
}) => {
  const uniqueLocPrompts = Array.from(new Set(storyboard.map(p => p.loc.prompt))) as string[];

  return (
    <div className="space-y-8">
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
          {uniqueLocPrompts.map(locPrompt => (
            <ReferenceCard 
              key={locPrompt}
              title={locPrompt}
              type="Location"
              aspectRatio="aspect-video"
              data={sharedLocs[locPrompt]}
              onGenerate={() => generateLocation(locPrompt, "1K", true)}
              onImageClick={(url, title, prompt, feedback, settings) => 
                setModalData({ isOpen: true, imageUrl: url, title, prompt, feedback, settings })
              }
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
              onGenerate={() => generateCharacter(charId, "1K", true)}
              onImageClick={(url, title, prompt, feedback, settings) => 
                setModalData({ isOpen: true, imageUrl: url, title, prompt, feedback, settings })
              }
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
              onGenerate={() => generateProp(propId, "1K", true)}
              onImageClick={(url, title, prompt, feedback, settings) => 
                setModalData({ isOpen: true, imageUrl: url, title, prompt, feedback, settings })
              }
              currentTime={currentTime}
            />
          ))}
        </div>
      </section>
    </div>
  );
};
