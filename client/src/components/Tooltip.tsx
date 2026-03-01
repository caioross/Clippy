import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
    text: string;
    visible: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({ text, visible }) => {
    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.8, y: 10, filter: 'blur(5px)' }}
                    animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 0.8, y: -10, filter: 'blur(5px)' }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/80 dark:bg-white/80 text-white dark:text-black px-3 py-1.5 rounded-full text-xs font-medium font-sans opacity-0 pointer-events-none shadow-xl border border-white/20 dark:border-black/20"
                >
                    {text}
                </motion.div>
            )}
        </AnimatePresence>
    );
};
