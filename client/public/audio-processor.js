class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        // Configure buffer size (4096 was used in ScriptProcessor)
        this.bufferSize = 4096;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0]; // Primary input
        if (!input || !input[0]) return true; // No audio data

        const channelData = input[0];

        // Push data into our buffer
        for (let i = 0; i < channelData.length; i++) {
            this.buffer[this.bufferIndex++] = channelData[i];

            // When buffer is full, send it to the main thread
            if (this.bufferIndex >= this.bufferSize) {
                // Convert Float32 to Int16
                const int16Array = new Int16Array(this.bufferSize);
                for (let j = 0; j < this.bufferSize; j++) {
                    int16Array[j] = Math.max(-32768, Math.min(32767, this.buffer[j] * 32768));
                }

                // Send back via MessagePort
                this.port.postMessage(int16Array.buffer, [int16Array.buffer]);

                // Reset buffer
                this.bufferIndex = 0;
                this.buffer = new Float32Array(this.bufferSize);
            }
        }

        // Return true to keep the processor alive
        return true;
    }
}

registerProcessor('vapi-processor', AudioProcessor);
