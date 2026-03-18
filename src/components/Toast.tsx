import React from "react";
import { motion } from "motion/react";
import { CheckCircle2 } from "lucide-react";

export const Toast = ({ message, onHide }: { message: string; onHide: () => void }) => (
  <motion.div 
    initial={{ opacity: 0, y: 50 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 50 }}
    className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-sky-500 text-slate-950 px-6 py-3 rounded-full font-bold z-[100] shadow-lg flex items-center gap-2"
  >
    <CheckCircle2 size={18} />
    {message}
  </motion.div>
);
