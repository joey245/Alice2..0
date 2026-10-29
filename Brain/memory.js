// ========================================
// ALICE LONG-TERM MEMORY
// ========================================

const fs = require("fs");
const path = require("path");

const MEMORY_FILE = path.join(__dirname, "memories.json");

const OLLAMA_URL = "http://localhost:11434";

const EMBED_MODEL = "nomic-embed-text";
const CHAT_MODEL = "llama3.2";


// ========================================
// STORAGE
// ========================================

function loadMemories() {
    if (!fs.existsSync(MEMORY_FILE)) {
        return [];
    }

    try {
        return JSON.parse(
            fs.readFileSync(MEMORY_FILE, "utf-8")
        );
    } catch (error) {
        console.error(
            "Failed to read memories.json:",
            error
        );

        return [];
    }
}


function saveMemories(memories) {
    fs.writeFileSync(
        MEMORY_FILE,
        JSON.stringify(memories, null, 2),
        "utf-8"
    );
}


// ========================================
// EMBEDDINGS
// ========================================

async function embedText(text) {

    const response = await fetch(
        `${OLLAMA_URL}/api/embed`,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                model: EMBED_MODEL,
                input: text
            })
        }
    );

    if (!response.ok) {

        const errorText = await response.text();

        throw new Error(
            `Embedding error ${response.status}: ${errorText}`
        );
    }

    const data = await response.json();

    if (
        !data.embeddings ||
        !data.embeddings[0]
    ) {
        throw new Error(
            "Ollama returned no embedding."
        );
    }

    return data.embeddings[0];
}


// ========================================
// COSINE SIMILARITY
// ========================================

function cosineSimilarity(a, b) {

    let dot = 0;
    let magA = 0;
    let magB = 0;

    const length = Math.min(
        a.length,
        b.length
    );

    for (let i = 0; i < length; i++) {

        dot += a[i] * b[i];

        magA += a[i] * a[i];

        magB += b[i] * b[i];
    }

    if (magA === 0 || magB === 0) {
        return 0;
    }

    return (
        dot /
        (
            Math.sqrt(magA) *
            Math.sqrt(magB)
        )
    );
}


// ========================================
// ADD MEMORY
// ========================================

async function addMemory(
    text,
    category = "fact"
) {

    const memories = loadMemories();

    const embedding =
        await embedText(text);


    // Check for near duplicates

    const duplicate =
        memories.find(memory =>
            memory.embedding &&
            cosineSimilarity(
                memory.embedding,
                embedding
            ) > 0.95
        );


    if (duplicate) {

        console.log(
            "Memory already exists:",
            duplicate.text
        );

        return duplicate;
    }


    const entry = {

        id:
            Date.now().toString(36) +
            Math.random()
                .toString(36)
                .slice(2, 7),

        text,

        category,

        createdAt:
            new Date().toISOString(),

        embedding
    };


    memories.push(entry);

    saveMemories(memories);


    console.log(
        "💾 Alice remembered:",
        text
    );


    return entry;
}

// ========================================
// DELETE MEMORY
// ========================================

function deleteMemory(id) {

    const memories = loadMemories();

    const newMemories = memories.filter(
        memory => memory.id !== id
    );

    // Nothing was deleted
    if (newMemories.length === memories.length) {
        return false;
    }

    saveMemories(newMemories);

    console.log(
        "🗑️ Alice forgot:",
        id
    );

    return true;
}


// ========================================
// SEARCH MEMORIES
// ========================================

async function searchMemories(
    query,
    topN = 5,
    minScore = 0.55
) {

    const memories =
        loadMemories();


    if (memories.length === 0) {
        return [];
    }


    const queryEmbedding =
        await embedText(query);


    return memories

        .filter(memory =>
            Array.isArray(memory.embedding)
        )

        .map(memory => ({

            ...memory,

            score:
                cosineSimilarity(
                    memory.embedding,
                    queryEmbedding
                )

        }))

        .filter(memory =>
            memory.score >= minScore
        )

        .sort(
            (a, b) =>
                b.score - a.score
        )

        .slice(0, topN);
}


// ========================================
// AUTOMATIC MEMORY EXTRACTION
// ========================================

async function extractMemoriesFromExchange(
    userMessage,
    aliceResponse
) {

    const extractionPrompt = `

You are Alice's long-term memory system.

Read this conversation exchange.

Decide whether there is anything important enough to remember about the user permanently.

Remember things such as:

- important facts about the user
- preferences
- hobbies
- ongoing projects
- important people they mention
- goals
- things the user explicitly says to remember

Do NOT remember:

- normal small talk
- greetings
- temporary moods
- random questions
- one-time requests
- information that is not clearly stated
- guesses about the user

Only remember information that is useful in future conversations.

Return ONLY a JSON array.

Each item must have:

{
    "text": "short description",
    "category": "fact | preference | project | person | explicit"
}

If nothing should be remembered, return:

[]

User:
${userMessage}

Alice:
${aliceResponse}

`;


    try {

        const response =
            await fetch(
                `${OLLAMA_URL}/api/generate`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        model: CHAT_MODEL,

                        prompt:
                            extractionPrompt,

                        stream: false

                    })
                }
            );


        if (!response.ok) {

            throw new Error(
                `Memory extraction HTTP ${response.status}`
            );
        }


        const data =
            await response.json();


        const raw =
            (data.response || "").trim();


        const jsonMatch =
            raw.match(/\[[\s\S]*\]/);


        if (!jsonMatch) {
            return;
        }


        const items =
            JSON.parse(
                jsonMatch[0]
            );


        if (!Array.isArray(items)) {
            return;
        }


        for (const item of items) {

            if (
                item &&
                typeof item.text === "string" &&
                item.text.trim().length > 0
            ) {

                await addMemory(
                    item.text.trim(),
                    item.category || "fact"
                );
            }
        }

    } catch (error) {

        console.error(
            "Memory extraction failed:",
            error
        );
    }
}


// ========================================
// EXPORTS
// ========================================

module.exports = {

    loadMemories,

    addMemory,

    deleteMemory,

    searchMemories,

    extractMemoriesFromExchange

};