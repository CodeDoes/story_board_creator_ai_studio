import React from "react";

export const IntentBox = ({ title, content }: { title: string; content: string }) => (
  <div className="bg-sky-500/5 border border-sky-500/10 p-4 rounded-xl mt-3 text-xs leading-relaxed text-slate-400">
    <b className="text-sky-400 uppercase text-[10px] block mb-1 tracking-wider">{title}</b>
    {content}
  </div>
);
