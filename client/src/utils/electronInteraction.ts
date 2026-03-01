export const setIgnoreMouseEvents = (ignore: boolean) => {
    try {
        if (typeof window !== 'undefined' && (window as any).require) {
            const { ipcRenderer } = (window as any).require('electron');
            if (ignore) {
                ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
            } else {
                ipcRenderer.send('set-ignore-mouse-events', false);
            }
        }
    } catch (e) {
        // Not in electron, ignore
    }
};
