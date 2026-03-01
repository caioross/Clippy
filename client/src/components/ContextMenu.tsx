import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, XCircle, Activity, Zap } from 'lucide-react';
import { setIgnoreMouseEvents } from '@/utils/electronInteraction';
import { useAssistantStore } from '@/store';

interface ContextMenuProps {
    x: number;
    y: number;
    isOpen: boolean;
    onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, isOpen, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const lowPerf = useAssistantStore(s => s.lowPerformanceMode);
    const togglePerf = useAssistantStore(s => s.togglePerformanceMode);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    // Handle actions
    const handleAction = (action: string) => {
        console.log(`Action triggered: ${action}`);
        // TODO: Implement actual actions
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={menuRef}
                    initial={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="fixed z-50 min-w-[180px] bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-white/50 dark:border-gray-700/50 shadow-2xl rounded-xl overflow-hidden py-1 text-sm font-sans pointer-events-auto"
                    style={{ left: x, top: y }}
                    onMouseEnter={() => setIgnoreMouseEvents(false)}
                    onMouseLeave={() => setIgnoreMouseEvents(true)}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent pointer-events-none"></div>

                    <button
                        onClick={() => {
                            togglePerf();
                            handleAction('performance_mode');
                        }}
                        className="relative w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <Zap size={16} className={lowPerf ? "text-amber-500" : "text-gray-500 dark:text-gray-400"} />
                            Performance Mode
                        </div>
                        <span className="text-xs text-gray-400">{lowPerf ? 'LOW' : 'HIGH'}</span>
                    </button>

                    <button
                        onClick={() => handleAction('logs')}
                        className="relative w-full text-left px-4 py-2.5 flex items-center gap-3 text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                    >
                        <Activity size={16} className="text-gray-500 dark:text-gray-400" />
                        View Logs
                    </button>

                    <div className="h-px bg-gray-200/50 dark:bg-gray-700/50 my-1 mx-2"></div>

                    <button
                        onClick={() => handleAction('sleep')}
                        className="relative w-full text-left px-4 py-2.5 flex items-center gap-3 text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                    >
                        <Moon size={16} className="text-gray-500 dark:text-gray-400" />
                        Sleep
                    </button>

                    <button
                        onClick={() => handleAction('quit')}
                        className="relative w-full text-left px-4 py-2.5 flex items-center gap-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                        <XCircle size={16} />
                        Quit Assistant
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
