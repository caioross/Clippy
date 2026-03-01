import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Mic, Volume2 } from 'lucide-react';
import { AudioVisualizer } from './AudioVisualizer';
import { setIgnoreMouseEvents } from '@/utils/electronInteraction';

interface PremiumBubbleProps {
    text: { user: string; clippy: string } | null;
    onClose: () => void;
}

// We stream real-time now from LLM, so we just render what we get 
// (or we can keep typewriter for static fallback messages)
const TypewriterText = ({ text, delay = 0.02, streaming = true }: { text: string, delay?: number, streaming?: boolean }) => {
    const [displayedText, setDisplayedText] = useState('');

    useEffect(() => {
        if (streaming) {
            setDisplayedText(text);
            return;
        }

        setDisplayedText('');
        let i = 0;
        const interval = setInterval(() => {
            if (i < text.length) {
                setDisplayedText(prev => prev + text.charAt(i));
                i++;
            } else {
                clearInterval(interval);
            }
        }, delay * 1000);
        return () => clearInterval(interval);
    }, [text, delay, streaming]);

    return <span>{displayedText}</span>;
};

export const PremiumBubble: React.FC<PremiumBubbleProps> = ({ text, onClose }) => {
    return (
        <AnimatePresence>
            {text && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 0.9, y: 20, filter: 'blur(10px)' }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    // Premium Glassmorphism styling
                    className="pointer-events-auto relative w-full bg-white/40 dark:bg-black/40 backdrop-blur-2xl border border-white/50 dark:border-white/10 shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] rounded-2xl p-5 text-sm text-gray-800 dark:text-gray-100 font-sans overflow-hidden"
                    onMouseEnter={() => setIgnoreMouseEvents(false)}
                    onMouseLeave={() => setIgnoreMouseEvents(true)}
                >
                    {/* Glassmorphism shine effect layer */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-50 pointer-events-none rounded-2xl"></div>

                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="absolute top-3 right-3 p-1.5 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-all backdrop-blur-md z-10"
                    >
                        <X size={14} />
                    </button>

                    <div className="relative z-10 flex flex-col gap-3">
                        {text.user && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 }}
                                className="flex flex-col gap-1 items-end"
                            >
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                    Você <Mic size={12} />
                                </div>
                                <div className="bg-blue-50/80 dark:bg-blue-900/40 backdrop-blur-md border border-blue-100 dark:border-blue-800 p-3 rounded-2xl rounded-tr-sm text-gray-700 dark:text-gray-200">
                                    <p className="italic">{text.user}</p>
                                </div>
                            </motion.div>
                        )}

                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                            className="flex flex-col gap-1 items-start"
                        >
                            <div className="flex items-center gap-2 text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                                Clippy <Volume2 size={12} />
                                <div className="ml-1">
                                    <AudioVisualizer isActive={text.clippy !== 'Pensando...'} />
                                </div>
                            </div>
                            <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md border border-purple-100 dark:border-purple-800 p-3 rounded-2xl rounded-tl-sm text-gray-900 dark:text-gray-100 font-medium leading-relaxed shadow-sm">
                                <p><TypewriterText text={text.clippy} streaming={true} /></p>
                            </div>
                        </motion.div>
                    </div>

                    {/* Balloon tail (Glass) */}
                    <div className="absolute -bottom-3 left-8 w-0 h-0 border-l-[10px] border-l-transparent border-t-[14px] border-t-white/40 dark:border-t-black/40 border-r-[10px] border-r-transparent backdrop-blur-sm drop-shadow-sm"></div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
