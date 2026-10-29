import * as THREE from "three";

import {
    GLTFLoader
} from "three/addons/loaders/GLTFLoader.js";

import {
    VRMLoaderPlugin,
    VRMUtils
} from "@pixiv/three-vrm";


// ========================================
// DOM
// ========================================



const container =
    document.getElementById(
        "avatar-container"
    );

const loading =
    document.getElementById(
        "loading"
    );

const messageInput =
    document.getElementById(
        "message"
    );

const sendButton =
    document.getElementById(
        "sendButton"
    );

const responseBox =
    document.getElementById(
        "response"
    );

const micButton =
    document.getElementById(
        "micButton"
    );

const screenButton =
    document.getElementById(
        "screenButton"
    );

const chatUI =
    document.getElementById(
        "chat-ui"
    );

    const memoryButton =
    document.getElementById(
        "memoryButton"
    );

const memoryPanel =
    document.getElementById(
        "memory-panel"
    );

const closeMemoryButton =
    document.getElementById(
        "closeMemoryButton"
    );

const memoryList =
    document.getElementById(
        "memory-list"
    );

const memoryCount =
    document.getElementById(
        "memory-count"
    );

    
 // ========================================
// MEMORY VIEWER
// ========================================

async function loadAliceMemories() {

    memoryList.innerHTML =
        "<div>Loading...</div>";

    try {

        const response =
            await fetch("/memories");

        if (!response.ok) {
            throw new Error(
                `Memory request failed: ${response.status}`
            );
        }

        const data =
            await response.json();

        const memories =
            Array.isArray(data.memories)
                ? data.memories
                : [];

        memoryCount.textContent =
            `${memories.length} memor${
                memories.length === 1
                    ? "y"
                    : "ies"
            }`;

        memoryList.innerHTML = "";

        if (memories.length === 0) {

            memoryList.innerHTML =
                "<div>Alice hasn't remembered anything yet.</div>";

            return;
        }

        memories.forEach(memory => {

            const card =
                document.createElement("div");

            card.className =
                "memory-card";

            const deleteButton =
                document.createElement("button");

            deleteButton.className =
                "memory-delete";

            deleteButton.textContent =
                "🗑";

            deleteButton.title =
                "Forget this memory";

            deleteButton.addEventListener(
                "click",
                async () => {

                    await deleteAliceMemory(
                        memory.id
                    );
                }
            );

            const text =
                document.createElement("div");

            text.className =
                "memory-text";

            text.textContent =
                memory.text;

            const category =
                document.createElement("div");

            category.className =
                "memory-category";

            category.textContent =
                memory.category || "fact";

            card.appendChild(
                deleteButton
            );

            card.appendChild(
                text
            );

            card.appendChild(
                category
            );

            memoryList.appendChild(
                card
            );
        });

    } catch (error) {

        console.error(
            "Could not load Alice's memories:",
            error
        );

        memoryCount.textContent =
            "Unable to load memories.";

        memoryList.innerHTML =
            "<div>Something went wrong...</div>";
    }
}


// ========================================
// DELETE MEMORY
// ========================================

async function deleteAliceMemory(id) {

    try {

        const response =
            await fetch(
                `/memories/${encodeURIComponent(id)}`,
                {
                    method: "DELETE"
                }
            );

        if (!response.ok) {

            throw new Error(
                `Delete failed: ${response.status}`
            );
        }

        await loadAliceMemories();

    } catch (error) {

        console.error(
            "Could not delete memory:",
            error
        );
    }
}


// ========================================
// OPEN MEMORY PANEL
// ========================================

memoryButton.addEventListener(
    "click",
    async () => {

        memoryPanel.style.display =
            "block";

        await loadAliceMemories();
    }
);


// ========================================
// CLOSE MEMORY PANEL
// ========================================

closeMemoryButton.addEventListener(
    "click",
    () => {

        memoryPanel.style.display =
            "none";
    }
);
// ========================================
// ALICE
// ========================================

let alice = null;

let leftArm = null;
let rightArm = null;
let head = null;


// ========================================
// EMOTIONS
// ========================================

const emotionNames = [
    "happy",
    "sad",
    "angry",
    "confused",
    "relaxed",
    "hungry",
    "sleepy",
    "neutral"
];


let currentEmotion = "neutral";

let targetEmotion = "neutral";

let emotionBlendSpeed = 5;


// ========================================
// EMOTION DECAY
// ========================================


const EMOTION_DECAY_TARGET = "relaxed";


const EMOTION_DECAY_MS = 20 * 1000;


let lastEmotionChangeTime = Date.now();


// ========================================
// SET TARGET EMOTION
// ========================================

function setExpression(name) {

    if (
        !alice ||
        !alice.expressionManager
    ) {
        return;
    }


    if (
        !emotionNames.includes(name)
    ) {

        name = "neutral";
    }


    targetEmotion = name;

    lastEmotionChangeTime = Date.now();

    console.log(
        "Alice emotion:",
        targetEmotion
    );
}


// ========================================
// DECAY EMOTION BACK TO RESTING STATE
// ========================================

function updateEmotionDecay() {

    if (
        targetEmotion === EMOTION_DECAY_TARGET ||
        targetEmotion === "neutral"
    ) {
        return;
    }


    
    if (currentAudio) {
        lastEmotionChangeTime = Date.now();
        return;
    }


    if (
        Date.now() - lastEmotionChangeTime >
        EMOTION_DECAY_MS
    ) {

        targetEmotion = EMOTION_DECAY_TARGET;

        console.log(
            "Alice emotion decayed to:",
            targetEmotion
        );
    }
}


// ========================================
// UPDATE EMOTION
// ========================================

function updateEmotion(delta) {

    if (
        !alice ||
        !alice.expressionManager
    ) {
        return;
    }


    const manager =
        alice.expressionManager;


    for (
        const emotion of emotionNames
    ) {

        let currentValue =
            manager.getValue
                ? manager.getValue(
                    emotion
                )
                : emotion ===
                  currentEmotion
                    ? 1
                    : 0;


        const targetValue =
            emotion === targetEmotion
                ? 1
                : 0;


        currentValue =
            THREE.MathUtils.lerp(
                currentValue,
                targetValue,
                Math.min(
                    delta *
                        emotionBlendSpeed,
                    1
                )
            );


        manager.setValue(
            emotion,
            currentValue
        );
    }


    currentEmotion =
        targetEmotion;
}


// ========================================
// LIP SYNC
// ========================================

let currentAudio = null;

// ========================================
// IDLE CONVERSATION
// ========================================

const IDLE_MIN_DELAY =
    2 * 60 * 1000; // 2 min

const IDLE_MAX_DELAY =
    5 * 60 * 1000; // 5 min

let idleTimer = null;

let idleConversationRunning = false;

let chatRequestInFlight = false;

let lipSyncInterval = null;

let currentAudioContext = null;

let currentAudioSource = null;

let currentAnalyser = null;


const visemes = [
    "aa",
    "ih",
    "ou",
    "ee",
    "oh"
];


// ========================================
// RESET MOUTH
// ========================================

function resetMouth() {

    if (
        !alice ||
        !alice.expressionManager
    ) {
        return;
    }


    for (
        const name of visemes
    ) {

        try {

            alice.expressionManager
                .setValue(
                    name,
                    0
                );

        } catch (error) {
            // Ignore unsupported expression
        }
    }
}


// ========================================
// START LIP SYNC
// ========================================

function startLipSync(audio) {

    if (
        !alice ||
        !alice.expressionManager
    ) {
        return;
    }


    stopLipSync();


    resetMouth();


    try {

        currentAudioContext =
            new (
                window.AudioContext ||
                window.webkitAudioContext
            )();


        currentAudioSource =
            currentAudioContext
                .createMediaElementSource(
                    audio
                );


        currentAnalyser =
            currentAudioContext
                .createAnalyser();


        currentAnalyser.fftSize =
            256;


        currentAudioSource.connect(
            currentAnalyser
        );


        currentAnalyser.connect(
            currentAudioContext.destination
        );


        const dataArray =
            new Uint8Array(
                currentAnalyser
                    .frequencyBinCount
            );


        lipSyncInterval =
            setInterval(
                () => {

                    if (
                        !currentAnalyser ||
                        !alice
                    ) {
                        return;
                    }


                    currentAnalyser
                        .getByteFrequencyData(
                            dataArray
                        );


                    let sum = 0;


                    for (
                        let i = 0;
                        i < dataArray.length;
                        i++
                    ) {

                        sum +=
                            dataArray[i];
                    }


                    const average =
                        sum /
                        dataArray.length;


                    const volume =
                        Math.min(
                            average / 60,
                            1
                        );


                    resetMouth();


                    if (
                        volume > 0.08
                    ) {

                        const index =
                            Math.floor(
                                Math.random() *
                                visemes.length
                            );


                        const viseme =
                            visemes[index];


                        try {

                            alice
                                .expressionManager
                                .setValue(
                                    viseme,
                                    volume
                                );

                        } catch (error) {

                            try {

                                alice
                                    .expressionManager
                                    .setValue(
                                        "aa",
                                        volume
                                    );

                            } catch (
                                error2
                            ) {
                                // Ignore
                            }
                        }
                    }

                },
                50
            );


    } catch (error) {

        console.error(
            "Lip sync setup failed:",
            error
        );
    }
}


// ========================================
// STOP LIP SYNC
// ========================================

function stopLipSync() {

    if (lipSyncInterval) {

        clearInterval(
            lipSyncInterval
        );

        lipSyncInterval = null;
    }


    resetMouth();


    if (currentAudioSource) {

        try {
            currentAudioSource.disconnect();
        } catch (error) {}

        currentAudioSource = null;
    }


    if (currentAnalyser) {

        try {
            currentAnalyser.disconnect();
        } catch (error) {}

        currentAnalyser = null;
    }


    if (currentAudioContext) {

        try {
            currentAudioContext.close();
        } catch (error) {}

        currentAudioContext = null;
    }
}


// ========================================
// TTS TEXT CLEANUP
// ========================================


function sanitizeForSpeech(text) {

    if (!text) {
        return "";
    }

    let clean = text;


    
    clean = clean.replace(/\*[^*]*\*/g, " ");

    
    clean = clean.replace(/\*/g, "");


    
    clean = clean.replace(/\[[^\]]*\]/g, " ");


    
    clean = clean.replace(
        /\p{Extended_Pictographic}/gu,
        ""
    );

    
    clean = clean.replace(/[\u200D\uFE0F]/g, "");


   
    clean = clean.replace(/\s{2,}/g, " ").trim();


    return clean;
}


// ========================================
// CHAT
// ========================================
async function sendMessage() {

    // Don't allow two requests at the same time.
    if (chatRequestInFlight) {

        console.log(
            "Alice request ignored: another request is already running."
        );

        return;
    }


    const message =
        messageInput.value.trim();


    if (!message) {
        return;
    }


    

    resetIdleTimer();

    try {

        const response =
            await fetch(
                "/chat",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            message
                        })
                }
            );


        if (!response.ok) {

            throw new Error(
                `Server error: ${response.status}`
            );
        }


        const data =
            await response.json();


        responseBox.textContent =
            data.reply ||
            "...";


        setExpression(
            data.emotion ||
            "neutral"
        );


       
        speak(
            data.reply
        );


    } catch (error) {

        console.error(
            error
        );


        responseBox.textContent =
            "U-um... I can't connect to my brain right now. 🥺";


        setExpression(
            "sad"
        );

    } finally {

        sendButton.disabled =
            false;

        chatRequestInFlight = false;


        messageInput.value =
            "";


        messageInput.focus();
    }
}


// ========================================
// SCREEN VISION
// ========================================

async function lookAtScreen() {

     resetIdleTimer();

    if (
        !window.aliceDesktop ||
        !window.aliceDesktop
            .captureScreen
    ) {

        responseBox.textContent =
            "I can't access the screen right now... 🥺";

        setExpression(
            "sad"
        );

        return;
    }


    responseBox.textContent =
        "Looking at your screen... 👀";


    setExpression(
        "confused"
    );

    chatRequestInFlight = true;


    try {

        const imageData =
            await window.aliceDesktop
                .captureScreen();


        if (!imageData) {

            responseBox.textContent =
                "I couldn't see your screen... 🥺";

            setExpression(
                "sad"
            );

            return;
        }


        const response =
            await fetch(
                "/chat",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            message:
                                "Please look at my screen and tell me what you see. React naturally as Alice.",

                            imageBase64:
                                imageData

                        })
                }
            );


        if (!response.ok) {

            throw new Error(
                `Server error: ${response.status}`
            );
        }


        const data =
            await response.json();


        responseBox.textContent =
            data.reply ||
            "I-I don't know what I'm looking at...";


        setExpression(
            data.emotion ||
            "confused"
        );


        speak(
            data.reply
        );


    } catch (error) {

        console.error(
            "Screen vision error:",
            error
        );


        responseBox.textContent =
            "S-sorry... I had trouble looking at the screen.";


        setExpression(
            "sad"
        );

    } finally {

        chatRequestInFlight = false;
    }
}


// ========================================
// MICROPHONE / SPEECH RECOGNITION
// ========================================

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;


let recognition = null;

let isListening = false;


if (
    SpeechRecognition &&
    micButton
) {

    recognition =
        new SpeechRecognition();


    recognition.continuous =
        false;


    recognition.interimResults =
        false;


    recognition.lang =
        "en-US";


    recognition.onstart =
        () => {

            isListening =
                true;


            micButton.classList
                .add(
                    "listening"
                );


            micButton.textContent =
                "🔴";


            responseBox.textContent =
                "Listening... 🎤";
        };


    recognition.onresult =
        event => {

            const transcript =
                event.results[0][0]
                    .transcript;


            messageInput.value =
                transcript;


            sendMessage();
        };


    recognition.onerror =
        event => {

            console.error(
                "STT Error:",
                event.error
            );

            
            if (event.error === "network" || event.error === "not-allowed") {
                responseBox.textContent =
                    "Mic needs local Whisper in Electron (browser STT won't work here).";
            } else {
                responseBox.textContent =
                    "Sorry, I couldn't hear you clearly...";
            }

            stopListening();
        };


    recognition.onend =
        () => {

            stopListening();
        };


} else if (micButton) {

    micButton.style.display =
        "none";


    console.warn(
        "Speech Recognition not supported."
    );
}


// ========================================
// START LISTENING
// ========================================
    function startListening() {

        resetIdleTimer();

    if (
        !recognition ||
        isListening
    ) {
        return;
    }
    try {

        recognition.start();

    } catch (error) {

        console.error(
            "Could not start microphone:",
            error
        );
    }
}


// ========================================
// STOP LISTENING
// ========================================

function stopListening() {

    isListening =
        false;


    if (micButton) {

        micButton.classList
            .remove(
                "listening"
            );


        micButton.textContent =
            "🎤";
    }
}


if (micButton) {

    micButton.addEventListener(
        "click",
        () => {

            if (isListening) {

                recognition.stop();

            } else {

                startListening();
            }
        }
    );
}


// ========================================
// TTS
// ========================================

async function speak(text) {

    const spokenText =
        sanitizeForSpeech(text);


    if (!spokenText) {
        return;
    }


    try {

        const response =
            await fetch(
                "http://127.0.0.1:5000/tts",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            text: spokenText
                        })
                }
            );


        if (!response.ok) {

            console.error(
                "TTS failed:",
                response.status
            );

            return;
        }


        const audioBlob =
            await response.blob();


        const audioUrl =
            URL.createObjectURL(
                audioBlob
            );


        const audio =
            new Audio(
                audioUrl
            );


        
        if (currentAudio) {

            currentAudio.pause();

            stopLipSync();

            currentAudio = null;
        }


        currentAudio =
            audio;


        audio.onplay =
            () => {

                startLipSync(
                    audio
                );
            };


        audio.onended =
            () => {

                stopLipSync();


                URL.revokeObjectURL(
                    audioUrl
                );


                currentAudio =
                    null;
            };


        audio.onerror =
            error => {

                console.error(
                    "Audio error:",
                    error
                );


                stopLipSync();


                URL.revokeObjectURL(
                    audioUrl
                );


                currentAudio =
                    null;
            };


        audio.play()
            .catch(
                error => {

                    console.error(
                        "Audio play error:",
                        error
                    );


                    stopLipSync();
                }
            );


    } catch (error) {

        console.error(
            "TTS error:",
            error
        );


        stopLipSync();
    }
}
// ========================================
// IDLE CONVERSATION SYSTEM
// ========================================

function getRandomIdleDelay() {

    return (
        IDLE_MIN_DELAY +
        Math.random() *
        (
            IDLE_MAX_DELAY -
            IDLE_MIN_DELAY
        )
    );
}


// ========================================
// RESET IDLE TIMER
// ========================================

function resetIdleTimer() {

    if (idleTimer) {

        clearTimeout(
            idleTimer
        );

        idleTimer = null;
    }


    const delay =
        getRandomIdleDelay();


    console.log(
        "Alice idle timer set for:",
        Math.round(delay / 1000),
        "seconds"
    );


    idleTimer =
        setTimeout(
            () => {

                console.log(
                    "🔥 ALICE IDLE TIMER FIRED!"
                );

                triggerIdleConversation();

            },
            delay
        );
}


// ========================================
// TRIGGER IDLE CONVERSATION
// ========================================

async function triggerIdleConversation() {

    console.log(
    "🔥 triggerIdleConversation() STARTED"
);

    idleTimer = null;


    // ------------------------------------
    // Don't interrupt the user
    // ------------------------------------

    if (isListening) {

        console.log(
            "Alice idle cancelled: microphone active."
        );

        resetIdleTimer();

        return;
    }


    // ------------------------------------
    // Don't interrupt Alice speaking
    // ------------------------------------

    if (currentAudio) {

        console.log(
            "Alice idle cancelled: Alice is speaking."
        );

        resetIdleTimer();

        return;
    }


    // ------------------------------------
    // Don't collide with an in-flight chat
    // or screen-vision request
    // ------------------------------------

    if (chatRequestInFlight) {

        console.log(
            "Alice idle cancelled: a chat request is already in flight."
        );

        resetIdleTimer();

        return;
    }


    // ------------------------------------
    // Don't start two idle conversations
    // ------------------------------------

    if (idleConversationRunning) {

        resetIdleTimer();

        return;
    }


    idleConversationRunning = true;


    try {

        console.log(
            "Asking Alice if she wants to say something..."
        );


        const response =
            await fetch(
                "/idle",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({})
                }
            );


        if (!response.ok) {

            throw new Error(
                `Idle server error: ${response.status}`
            );
        }


        const data =
            await response.json();


        // --------------------------------
        // Alice decided to stay quiet
        // --------------------------------

        if (
            data.silent ||
            !data.reply
        ) {

            console.log(
                "Alice decided to stay quiet."
            );

            return;
        }


        // --------------------------------
        // Display Alice's idle message
        // --------------------------------

        responseBox.textContent =
            data.reply;


        // --------------------------------
        // Change Alice's emotion
        // --------------------------------

        setExpression(
            data.emotion ||
            "neutral"
        );


        // --------------------------------
        // Speak
        // --------------------------------

        await speak(
            data.reply
        );


    } catch (error) {

        console.error(
            "Idle conversation error:",
            error
        );

    } finally {

        idleConversationRunning =
            false;


        

        resetIdleTimer();
    }
}

// ========================================
// BUTTONS
// ========================================

if (sendButton) {

    sendButton.addEventListener(
        "click",
        sendMessage
    );
}


if (messageInput) {

    messageInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                sendMessage();
            }
        }
    );
}


if (screenButton) {

    screenButton.addEventListener(
        "click",
        lookAtScreen
    );
}


// ========================================
// THREE.JS
// ========================================

const scene =
    new THREE.Scene();


const camera =
    new THREE.PerspectiveCamera(
        30,

        window.innerWidth /
            window.innerHeight,

        0.1,

        100
    );


camera.position.set(
    0,
    1.4,
    5
);


const renderer =
    new THREE.WebGLRenderer({

        antialias: true,

        alpha: true

    });


renderer.setSize(
    window.innerWidth,
    window.innerHeight
);


renderer.setPixelRatio(
    Math.min(
        window.devicePixelRatio,
        2
    )
);


renderer.outputColorSpace =
    THREE.SRGBColorSpace;
    
    renderer.toneMapping = THREE.NoToneMapping;
renderer.toneMappingExposure = 1.0;

container.appendChild(
    renderer.domElement
);


// ========================================
// LIGHTING
// ========================================

const ambientLight = new THREE.AmbientLight(
    0xffffff,
    0.7
);

scene.add(ambientLight);


const keyLight = new THREE.DirectionalLight(
    0xffffff,
    1.0
);

keyLight.position.set(
    2,
    3,
    4
);

scene.add(keyLight);


const fillLight = new THREE.DirectionalLight(
    0xffffff,
    0.35
);

fillLight.position.set(
    -2,
    1,
    2
);

scene.add(fillLight);


// ========================================
// CLICK-THROUGH / MOUSE INTERACTIVITY
// ========================================


const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();

let windowIsInteractive = null;
let hoveringChatUI = false;

function setWindowInteractive(interactive) {

    if (interactive === windowIsInteractive) {
        return;
    }

    windowIsInteractive = interactive;

    if (
        window.aliceDesktop &&
        window.aliceDesktop.setIgnoreMouseEvents
    ) {

        window.aliceDesktop.setIgnoreMouseEvents(
            !interactive
        );
    }
}

function hitTestAvatar(clientX, clientY) {

    if (!alice || !alice.scene) {
        return false;
    }

    const rect =
        renderer.domElement.getBoundingClientRect();

    pointerNDC.x =
        ((clientX - rect.left) / rect.width) * 2 - 1;

    pointerNDC.y =
        -((clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointerNDC, camera);

    const hits =
        raycaster.intersectObject(alice.scene, true);

    return hits.length > 0;
}

window.addEventListener(
    "mousemove",
    event => {

       
        if (event.buttons !== 0) {
            return;
        }

        const overAvatar =
            hitTestAvatar(event.clientX, event.clientY);

        setWindowInteractive(
            hoveringChatUI || overAvatar
        );
    }
);

if (chatUI) {

    chatUI.addEventListener(
        "mouseenter",
        () => {
            hoveringChatUI = true;
            setWindowInteractive(true);
        }
    );

    chatUI.addEventListener(
        "mouseleave",
        () => {
            hoveringChatUI = false;
           
            setWindowInteractive(false);
        }
    );
}


setWindowInteractive(false);


// ========================================
// LOAD ALICE
// ========================================

const loader =
    new GLTFLoader();


loader.register(
    parser =>
        new VRMLoaderPlugin(
            parser
        )
);


loader.load(

    "/Model/Alice.vrm",

    gltf => {

        console.log(
            "Alice VRM loaded!"
        );


        alice =
            gltf.userData.vrm;


        console.log(
            "Alice VRM:",
            alice
        );


        console.log(
            "Alice expressions:",
            alice.expressionManager
        );


        VRMUtils
            .removeUnnecessaryVertices(
                gltf.scene
            );


        VRMUtils.combineSkeletons(
            gltf.scene
        );


        VRMUtils.combineMorphs(
            alice
        );


        scene.add(
            alice.scene
        );


        alice.scene.position.set(
            0,
            0,
            0
        );


        alice.scene.rotation.y =
            Math.PI;


        // ========================================
        // BONES
        // ========================================

        leftArm =
            alice.humanoid
                .getNormalizedBoneNode(
                    "leftUpperArm"
                );


        rightArm =
            alice.humanoid
                .getNormalizedBoneNode(
                    "rightUpperArm"
                );


        head =
            alice.humanoid
                .getNormalizedBoneNode(
                    "head"
                );


        console.log(
            "Head:",
            head
        );


        console.log(
            "Left arm:",
            leftArm
        );


        console.log(
            "Right arm:",
            rightArm
        );


        // ========================================
        // INITIAL ARM POSITION
        // ========================================

        if (leftArm) {

            leftArm.rotation.z =
                THREE.MathUtils
                    .degToRad(
                        70
                    );
        }


        if (rightArm) {

            rightArm.rotation.z =
                THREE.MathUtils
                    .degToRad(
                        -70
                    );
        }


        // ========================================
        // INITIAL EMOTION
        // ========================================

        setExpression(
            "relaxed"
        );


        loading.style.display =
            "none";


        console.log(
            "Alice is ready!"
        );
    },


    progress => {

        if (progress.total) {

            const percent =
                (
                    progress.loaded /
                    progress.total
                ) * 100;


            loading.textContent =
                `Loading Alice... ${percent.toFixed(0)}%`;
        }
    },


    error => {

        console.error(
            "FAILED TO LOAD ALICE:",
            error
        );


        loading.textContent =
            "Couldn't load Alice. Check the browser console.";
    }
);


// ========================================
// BLINKING
// ========================================

let blinkTimer = 0;

let blinkDuration = 0;

let isBlinking = false;


// ========================================
// START BLINK
// ========================================

function startBlink() {

    if (
        !alice ||
        !alice.expressionManager
    ) {
        return;
    }


    isBlinking =
        true;


    blinkDuration =
        0;
}


// ========================================
// UPDATE BLINK
// ========================================

function updateBlink(delta) {

    if (
        !alice ||
        !alice.expressionManager
    ) {
        return;
    }


    blinkTimer +=
        delta;


    s
    if (
        !isBlinking &&
        blinkTimer >=
            3 +
            Math.random() * 3
    ) {

        startBlink();

        blinkTimer = 0;
    }


    if (isBlinking) {

        blinkDuration +=
            delta;


        if (
            blinkDuration <
            0.12
        ) {

            alice.expressionManager
                .setValue(
                    "blink",
                    1
                );

        } else {

            alice.expressionManager
                .setValue(
                    "blink",
                    0
                );


            isBlinking =
                false;
        }
    }
}


// ========================================
// IDLE ANIMATION
// ========================================

const clock =
    new THREE.Clock();


function updateIdleAnimation() {

    if (!alice) {
        return;
    }


    const time =
        clock.getElapsedTime();


    // ========================================
    // BREATHING
    // ========================================

    const breathing =
        Math.sin(
            time * 1.8
        ) * 0.012;


    alice.scene.position.y =
        breathing;


    // ========================================
    // BODY SWAY
    // ========================================

    const sway =
        Math.sin(
            time * 0.7
        ) * 0.012;


    alice.scene.rotation.y =
        Math.PI + sway;


    // ========================================
    // ARMS
    // ========================================

    if (leftArm) {

        leftArm.rotation.z =
            THREE.MathUtils
                .degToRad(70) +

            Math.sin(
                time * 1.4
            ) * 0.012;
    }


    if (rightArm) {

        rightArm.rotation.z =
            THREE.MathUtils
                .degToRad(-70) +

            Math.sin(
                time * 1.4
            ) * 0.012;
    }


    // ========================================
    // HEAD
    // ========================================

    if (head) {

        head.rotation.y =
            Math.sin(
                time * 0.55
            ) * 0.07;


        head.rotation.x =
            Math.sin(
                time * 0.4
            ) * 0.035;


        head.rotation.z =
            Math.sin(
                time * 0.3
            ) * 0.02;
    }
}


// ========================================
// ANIMATION LOOP
// ========================================

function animate() {

    requestAnimationFrame(
        animate
    );


    const delta =
        clock.getDelta();


    if (alice) {

        alice.update(
            delta
        );


        updateIdleAnimation();

        updateBlink(
            delta
        );

        updateEmotionDecay();

        updateEmotion(
            delta
        );
    }


    renderer.render(
        scene,
        camera
    );
}


animate();


// ========================================
// RESIZE
// ========================================

window.addEventListener(
    "resize",
    () => {

        camera.aspect =
            window.innerWidth /
            window.innerHeight;


        camera.updateProjectionMatrix();


        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );
    }
);

// ========================================
// START ALICE IDLE SYSTEM
// ========================================

console.log("ALICE IDLE SYSTEM STARTING...");

resetIdleTimer();

console.log("ALICE IDLE SYSTEM STARTED!");