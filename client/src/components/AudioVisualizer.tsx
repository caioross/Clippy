import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAudioQueueStore } from '@/store/audioQueueStore';

interface AudioVisualizerProps {
    isActive: boolean;
    barCount?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isActive, barCount = 12 }) => {
    const [heights, setHeights] = useState<number[]>(Array(barCount).fill(10));
    const getFrequencyData = useAudioQueueStore(state => state.getFrequencyData);

    useEffect(() => {
        if (!isActive) {
            setHeights(Array(barCount).fill(5));
            return;
        }

        let animationFrameId: number;

        const updateBars = () => {
            const data = getFrequencyData();
            if (data && data.length > 0) {
                // Map fft frequency array to our bars
                // data is essentially 0-255 byte array
                const step = Math.floor(data.length / barCount);
                const newHeights = Array.from({ length: barCount }, (_, i) => {
                    // take max in the frequency bin area
                    let maxVal = 0;
                    for (let j = 0; j < step; j++) {
                        maxVal = Math.max(maxVal, data[i * step + j]);
                    }
                    // Map 0-255 to roughly 5-25 pixels
                    return Math.max(5, (maxVal / 255) * 20 + 5);
                });
                setHeights(newHeights);
            } else {
                setHeights(Array(barCount).fill(5));
            }
            animationFrameId = requestAnimationFrame(updateBars);
        };

        updateBars();

        return () => cancelAnimationFrame(animationFrameId);
    }, [isActive, barCount]);

    return (
        <div className="flex items-end gap-0.5 h-6 opacity-80">
            {heights.map((h, i) => (
                <motion.div
                    key={i}
                    animate={{ height: h }}
                    transition={{ type: "tween", duration: 0.1 }}
                    className="w-1 bg-purple-500/60 dark:bg-purple-400/80 rounded-t-sm"
                    style={{ minHeight: '4px' }}
                />
            ))}
        </div>
    );
};
