const http = require("http");
const fs = require("fs");
const path = require("path");

const {
    askAlice,
    clearMemory
} = require("../brain/brain");

const {
    loadMemories,
    deleteMemory
} = require("../brain/memory");

const HOST = "127.0.0.1";
const PORT = 3000;

const ALLOWED_EMOTIONS = new Set([
    "happy",
    "sad",
    "angry",
    "confused",
    "relaxed",
    "hungry",
    "sleepy",
    "neutral"
]);

const contentTypes = {
    ".html": "text/html; charset=UTF-8",
    ".css": "text/css; charset=UTF-8",
    ".js": "text/javascript; charset=UTF-8",
    ".vrm": "model/gltf-binary",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".json": "application/json; charset=UTF-8"
};

const MAX_BODY_SIZE = 15 * 1024 * 1024;

const server = http.createServer(async (req, res) => {

    // ========================================
    // HEALTH CHECK
    // ========================================

    if (req.method === "GET" && req.url === "/health") {

        res.writeHead(200, {
            "Content-Type": "application/json; charset=UTF-8"
        });

        res.end(JSON.stringify({
            status: "ok",
            alice: "online"
        }));

        return;
    }
// ========================================
// GET MEMORIES
// ========================================

if (
    req.method === "GET" &&
    req.url === "/memories"
) {

    try {

        const memories = loadMemories();

        // Never send embeddings to the browser
        const safeMemories = memories.map(
            memory => ({
                id: memory.id,
                text: memory.text,
                category: memory.category,
                createdAt: memory.createdAt
            })
        );

        res.writeHead(200, {
            "Content-Type":
                "application/json; charset=UTF-8"
        });

        res.end(
            JSON.stringify({
                memories: safeMemories
            })
        );

    } catch (error) {

        console.error(
            "Failed to load memories:",
            error
        );

        res.writeHead(500, {
            "Content-Type":
                "application/json; charset=UTF-8"
        });

        res.end(
            JSON.stringify({
                error: "Failed to load memories."
            })
        );
    }

    return;
}

// ========================================
// DELETE MEMORY
// ========================================

if (
    req.method === "DELETE" &&
    req.url.startsWith("/memories/")
) {

    const id =
        decodeURIComponent(
            req.url.slice("/memories/".length)
        );

    if (!id) {

        res.writeHead(400, {
            "Content-Type":
                "application/json; charset=UTF-8"
        });

        res.end(
            JSON.stringify({
                error: "Memory ID is required."
            })
        );

        return;
    }

    try {

        const deleted =
            deleteMemory(id);

        if (!deleted) {

            res.writeHead(404, {
                "Content-Type":
                    "application/json; charset=UTF-8"
            });

            res.end(
                JSON.stringify({
                    error: "Memory not found."
                })
            );

            return;
        }

        res.writeHead(200, {
            "Content-Type":
                "application/json; charset=UTF-8"
        });

        res.end(
            JSON.stringify({
                success: true
            })
        );

    } catch (error) {

        console.error(
            "Failed to delete memory:",
            error
        );

        res.writeHead(500, {
            "Content-Type":
                "application/json; charset=UTF-8"
        });

        res.end(
            JSON.stringify({
                error: "Failed to delete memory."
            })
        );
    }

    return;
}


    // ========================================
    // CHAT
    // ========================================

    if (req.method === "POST" && req.url === "/chat") {

        let body = "";
        let tooLarge = false;

        req.on("data", chunk => {

            if (tooLarge) {
                return;
            }

            body += chunk;

            if (Buffer.byteLength(body, "utf8") > MAX_BODY_SIZE) {

                tooLarge = true;

                res.writeHead(413, {
                    "Content-Type": "application/json; charset=UTF-8"
                });

                res.end(JSON.stringify({
                    reply: "That image is a little too big for me. 🥺",
                    emotion: "confused"
                }));

                req.destroy();
            }
        });


        req.on("end", async () => {

            if (tooLarge) {
                return;
            }

            try {

                const requestData = JSON.parse(body);


                // ========================================
                // MESSAGE
                // ========================================

                const message =
                    typeof requestData.message === "string"
                        ? requestData.message.trim()
                        : "";


                // ========================================
                // IMAGE
                // ========================================

                let imageBase64 = null;

                if (typeof requestData.imageBase64 === "string") {
                    imageBase64 = requestData.imageBase64;
                }


                // ========================================
                // NOTHING SENT
                // ========================================

                if (!message && !imageBase64) {

                    res.writeHead(400, {
                        "Content-Type": "application/json; charset=UTF-8"
                    });

                    res.end(JSON.stringify({
                        reply: "U-um... you didn't say anything. 🥺",
                        emotion: "confused"
                    }));

                    return;
                }


                // ========================================
                // CLEAR MEMORY
                // ========================================

                if (
                    message &&
                    message.toLowerCase() === "/clear"
                ) {

                    clearMemory();

                    res.writeHead(200, {
                        "Content-Type": "application/json; charset=UTF-8"
                    });

                    res.end(JSON.stringify({
                        reply: "Okay... I cleared my short-term memory. 🧹",
                        emotion: "relaxed"
                    }));

                    return;
                }


                console.log("");
                console.log("--------------------------------");
                console.log("User:", message || "[Image]");
                console.log("--------------------------------");


                // ========================================
                // ASK ALICE
                // ========================================

                const rawReply = await askAlice(
                    message,
                    imageBase64
                );


                // ========================================
                // EXTRACT EMOTION
                // ========================================

                const emotionMatch =
                    rawReply.match(
                        /^\[(happy|sad|angry|confused|relaxed|hungry|sleepy|neutral)\]\s*/i
                    );


                let emotion =
                    emotionMatch
                        ? emotionMatch[1].toLowerCase()
                        : "neutral";


                if (!ALLOWED_EMOTIONS.has(emotion)) {
                    emotion = "neutral";
                }


                // ========================================
                // REMOVE EMOTION TAG
                // ========================================

                const cleanReply =
                    rawReply
                        .replace(
                            /^\[(happy|sad|angry|confused|relaxed|hungry|sleepy|neutral)\]\s*/i,
                            ""
                        )
                        .trim();


                console.log(
                    "Alice:",
                    cleanReply
                );

                console.log(
                    "Emotion:",
                    emotion
                );


                // ========================================
                // SEND RESPONSE
                // ========================================

                res.writeHead(200, {
                    "Content-Type": "application/json; charset=UTF-8"
                });

                res.end(JSON.stringify({
                    reply: cleanReply,
                    emotion: emotion
                }));


            } catch (error) {

                console.error(
                    "Alice brain error:",
                    error
                );


                res.writeHead(500, {
                    "Content-Type": "application/json; charset=UTF-8"
                });

                res.end(JSON.stringify({
                    reply: "S-sorry... something went wrong with my brain. 🥺",
                    emotion: "sad"
                }));
            }
        });

        return;
    }

            // ========================================
    // IDLE CONVERSATION
    // ========================================

    if (
        req.method === "POST" &&
        req.url === "/idle"
    ) {

        try {

            console.log("");
            console.log("--------------------------------");
            console.log("Alice idle conversation triggered");
            console.log("--------------------------------");


            const rawReply =
                await generateIdleMessage();


            // --------------------------------
            // Alice chose not to speak
            // --------------------------------

            const upperIdle = rawReply.trim().toUpperCase();
            if (
                upperIdle === "[SILENT]" ||
                upperIdle.includes("[SILENT]") ||
                upperIdle === "SILENT"
            ) {

                res.writeHead(200, {
                    "Content-Type":
                        "application/json; charset=UTF-8"
                });

                res.end(JSON.stringify({

                    silent: true,

                    reply: "",

                    emotion: "neutral"

                }));

                return;
            }


            // --------------------------------
            // Extract emotion
            // --------------------------------

            const emotionMatch =
                rawReply.match(
                    /^\[(happy|sad|angry|confused|relaxed|hungry|sleepy|neutral)\]\s*/i
                );


            let emotion =
                emotionMatch
                    ? emotionMatch[1].toLowerCase()
                    : "neutral";


            if (
                !ALLOWED_EMOTIONS.has(
                    emotion
                )
            ) {

                emotion = "neutral";
            }


            // --------------------------------
            // Remove emotion tag
            // --------------------------------

            const cleanReply =
                rawReply
                    .replace(
                        /^\[(happy|sad|angry|confused|relaxed|hungry|sleepy|neutral)\]\s*/i,
                        ""
                    )
                    .trim();


            console.log(
                "Alice idle:",
                cleanReply
            );

            console.log(
                "Emotion:",
                emotion
            );


            // --------------------------------
            // Send response
            // --------------------------------

            res.writeHead(200, {

                "Content-Type":
                    "application/json; charset=UTF-8"

            });

            res.end(
                JSON.stringify({

                    silent: false,

                    reply:
                        cleanReply,

                    emotion:
                        emotion

                })
            );


        } catch (error) {

            console.error(
                "Alice idle error:",
                error
            );


            res.writeHead(500, {

                "Content-Type":
                    "application/json; charset=UTF-8"

            });

            res.end(
                JSON.stringify({

                    silent: true,

                    reply: "",

                    emotion: "neutral"

                })
            );
        }

        return;
    }


    // ========================================
    // STATIC FILE SERVER
    // ========================================

    try {

        const parsedUrl =
            new URL(
                req.url,
                `http://localhost:${PORT}`
            );


        let requestedFile =
            decodeURIComponent(
                parsedUrl.pathname
            );


        if (requestedFile === "/") {
            requestedFile = "/index.html";
        }


        requestedFile =
            requestedFile.replace(/^\/+/, "");


        if (
            requestedFile.includes("..") ||
            requestedFile.includes("\0")
        ) {

            res.writeHead(403, {
                "Content-Type": "text/plain; charset=UTF-8"
            });

            res.end("Forbidden");

            return;
        }


        const publicDirectory =
            path.resolve(
                __dirname,
                "..",
                "Public"
            );


        const filePath =
            path.resolve(
                publicDirectory,
                requestedFile
            );


        if (
            filePath !== publicDirectory &&
            !filePath.startsWith(
                publicDirectory + path.sep
            )
        ) {

            res.writeHead(403, {
                "Content-Type": "text/plain; charset=UTF-8"
            });

            res.end("Forbidden");

            return;
        }


        const ext =
            path.extname(
                filePath
            ).toLowerCase();


        const contentType =
            contentTypes[ext] ||
            "application/octet-stream";


        fs.readFile(
            filePath,
            (error, content) => {

                if (error) {

                    res.writeHead(404, {
                        "Content-Type": "text/plain; charset=UTF-8"
                    });

                    res.end("File not found.");

                    return;
                }


                res.writeHead(200, {
                    "Content-Type": contentType
                });

                res.end(content);
            }
        );


    } catch (error) {

        console.error(
            "Static file error:",
            error
        );


        res.writeHead(400, {
            "Content-Type": "text/plain; charset=UTF-8"
        });

        res.end("Bad request.");
    }
});


// ========================================
// SERVER LIFECYCLE
// ========================================

let serverStarting = false;


// ========================================
// START SERVER
// ========================================

function startAliceServer() {

    // Already running
    if (server.listening) {

        console.log(
            "Alice server is already running."
        );

        return Promise.resolve(server);
    }


    // Already in the process of starting
    if (serverStarting) {

        return new Promise((resolve, reject) => {

            const checkServer = () => {

                if (server.listening) {

                    cleanup();

                    resolve(server);

                    return;
                }

                if (!serverStarting) {

                    cleanup();

                    reject(
                        new Error(
                            "Alice server failed to start."
                        )
                    );

                    return;
                }
            };


            const onListening = () => {

                cleanup();

                resolve(server);
            };


            const onError = (error) => {

                cleanup();

                reject(error);
            };


            const cleanup = () => {

                server.removeListener(
                    "listening",
                    onListening
                );

                server.removeListener(
                    "error",
                    onError
                );
            };


            server.once(
                "listening",
                onListening
            );

            server.once(
                "error",
                onError
            );

            checkServer();
        });
    }


    serverStarting = true;


    return new Promise((resolve, reject) => {

        const onListening = () => {

            serverStarting = false;

            cleanup();


            console.log("");
            console.log("================================");
            console.log("        ALICE IS RUNNING");
            console.log("================================");
            console.log("");

            console.log(
                `Website → http://${HOST}:${PORT}`
            );

            console.log(
                `Health  → http://${HOST}:${PORT}/health`
            );

            console.log("");


            resolve(server);
        };


        const onError = (error) => {

            serverStarting = false;

            cleanup();


            if (
                error.code === "EADDRINUSE"
            ) {

                console.error("");
                console.error(
                    `Alice could not start because port ${PORT} is already in use.`
                );
                console.error(
                    "Another Alice/server process may still be running."
                );
                console.error("");
            }


            reject(error);
        };


        const cleanup = () => {

            server.removeListener(
                "listening",
                onListening
            );

            server.removeListener(
                "error",
                onError
            );
        };


        server.once(
            "listening",
            onListening
        );

        server.once(
            "error",
            onError
        );


        server.listen(
            PORT,
            HOST
        );
    });
}


// ========================================
// STOP SERVER
// ========================================

function stopAliceServer() {

    return new Promise((resolve) => {

        
        if (!server.listening) {

            resolve();

            return;
        }


        console.log(
            "Stopping Alice server..."
        );


        server.close(() => {

            console.log(
                "Alice server closed."
            );

            resolve();
        });
    });
}


// ========================================
// EXPORTS
// ========================================

module.exports = {

    startAliceServer,

    stopAliceServer,

    server,

    HOST,

    PORT
};


// ========================================
// STANDALONE MODE
// ========================================

if (require.main === module) {

    startAliceServer()

        .catch((error) => {

            console.error(
                "Failed to start Alice server:",
                error
            );

            process.exit(1);
        });
}