const {
    app,
    BrowserWindow,
    screen,
    Menu,
    desktopCapturer,
    ipcMain
} = require("electron");

const path = require("path");


const {
    startAliceServer,
    stopAliceServer
} = require("./Server/server");

let mainWindow = null;
let isHidden = false;




function createWindow() {

    const { width, height } =
        screen.getPrimaryDisplay()
            .workAreaSize;


    mainWindow =
        new BrowserWindow({

            width: 380,

            height: 680,

            x: width - 400,

            y: height - 700,

            transparent: true,

            frame: false,

            alwaysOnTop: true,

            resizable: false,

            hasShadow: false,

            skipTaskbar: false,

            webPreferences: {

                preload:
                    path.join(
                        __dirname,
                        "preload.js"
                    ),

                contextIsolation: true,

                nodeIntegration: false,

                backgroundThrottling: false,

                
                autoplayPolicy: "no-user-gesture-required"
            }
        });

    mainWindow.setContentProtection(false);

    mainWindow.loadURL(
        "http://127.0.0.1:3000"
    );


    
    mainWindow.webContents.on(
        "context-menu",
        () => {

            const contextMenu =
                Menu.buildFromTemplate([

                    {
                        label:
                            isHidden
                                ? "Show Alice"
                                : "Hide Alice",

                        click: () => {

                            if (isHidden) {

                                mainWindow.show();

                                isHidden = false;

                            } else {

                                mainWindow.hide();

                                isHidden = true;
                            }
                        }
                    },

                    {
                        type: "separator"
                    },

                    {
                        label: "Quit Alice",

                        click: () => {

                            app.quit();
                        }
                    }

                ]);


            contextMenu.popup();
        });


    mainWindow.on(
        "closed",
        () => {

            mainWindow = null;
        }
    );
}




app.whenReady().then(
    async () => {

        try {
            console.log("Starting Alice server (in-process)...");
            await startAliceServer();
            console.log("Alice server is ready!");
        } catch (error) {
            console.error(
                "Cannot start Alice window because the server failed:",
                error
            );
            return;
        }

        createWindow();
    }
);



let isStoppingServer = false;

async function stopServer() {

    if (isStoppingServer) {
        return;
    }

    isStoppingServer = true;

    try {

        await stopAliceServer();

    } catch (error) {

        console.error(
            "Error while stopping Alice server:",
            error
        );

    }
}

app.on(
    "window-all-closed",
    () => {

        if (process.platform !== "darwin") {

            app.quit();
            
        }

    }
);


app.on(
    "before-quit",
    async (event) => {

        if (isStoppingServer) {
            return;
        }

        event.preventDefault();

        await stopServer();

        app.exit(0);
    }
);



ipcMain.on(
    "set-ignore-mouse-events",
    (event, ignore) => {

        if (!mainWindow) {
            return;
        }


        mainWindow.setIgnoreMouseEvents(
            Boolean(ignore),
            {
                forward: true
            }
        );
    }
);


ipcMain.handle(
    "capture-screen",
    async () => {

        try {

            const sources =
                await desktopCapturer.getSources({

                    types: ["screen"],

                    thumbnailSize: {
                        width: 1280,
                        height: 720
                    }

                });


            const primarySource =
                sources[0];


            if (!primarySource) {

                return null;
            }


            return primarySource.thumbnail
                .toDataURL();


        } catch (error) {

            console.error(
                "Screen capture failed:",
                error
            );


            return null;
        }
    }
);