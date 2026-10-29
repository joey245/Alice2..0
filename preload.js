const {
    contextBridge,
    ipcRenderer
} = require("electron");


contextBridge.exposeInMainWorld(
    "aliceDesktop",
    {

        // ========================================
        // WINDOW DRAGGING
        // ========================================

        startDrag: () => {

            ipcRenderer.send(
                "window-drag"
            );
        },


        // ========================================
        // MOUSE CLICK-THROUGH
        // ========================================

        setIgnoreMouseEvents: (ignore) => {

            ipcRenderer.send(
                "set-ignore-mouse-events",
                Boolean(ignore)
            );
        },


        // ========================================
        // SCREEN CAPTURE
        // ========================================

        captureScreen: () => {

            return ipcRenderer.invoke(
                "capture-screen"
            );
        }

    }
);