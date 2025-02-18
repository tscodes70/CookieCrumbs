// ===============================================
// 🚀 Cookie Encryption & IPFS Storage (background_encrypt.js)
// ===============================================
// This script implements:
// 1️⃣ AES-GCM Encryption for cookies (Symmetric)
// 2️⃣ RSA-OAEP Encryption for AES key (Asymmetric)
// 3️⃣ Persistent storage of RSA keys in chrome.storage.local
// 4️⃣ Secure storage of encrypted cookies in IPFS
// 5️⃣ Secure retrieval & decryption of stored cookies
// ===============================================

// ===============================================
// 🛠️ Generate an RSA Key Pair and Store in Chrome Storage
// ===============================================
// This function generates an RSA key pair for asymmetric encryption.
// The public key is used to encrypt AES keys, and the private key is used to decrypt them.
// The keys are stored persistently in Chrome local storage.
async function generateKeyPair() {
    const keyPair = await crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
    );

    // Convert keys to Base64 format for storage in Chrome local storage.
    const exportedPrivateKey = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    const exportedPublicKey = await crypto.subtle.exportKey("spki", keyPair.publicKey);

    chrome.storage.local.set({
        rsaPrivateKey: arrayBufferToBase64(exportedPrivateKey),
        rsaPublicKey: arrayBufferToBase64(exportedPublicKey),
    });

    return keyPair;
}

// ===============================================
// 🛠️ Load or Generate RSA Key Pair from Storage
// ===============================================
// This function retrieves the RSA key pair from Chrome local storage.
// If no key pair exists, it generates a new one.
async function getKeyPair() {
    return new Promise((resolve) => {
        chrome.storage.local.get(["rsaPrivateKey", "rsaPublicKey"], async (result) => {
            if (result.rsaPrivateKey && result.rsaPublicKey) {
                // Import stored keys
                const privateKey = await crypto.subtle.importKey(
                    "pkcs8",
                    base64ToArrayBuffer(result.rsaPrivateKey),
                    { name: "RSA-OAEP", hash: "SHA-256" },
                    true,
                    ["decrypt"]
                );

                const publicKey = await crypto.subtle.importKey(
                    "spki",
                    base64ToArrayBuffer(result.rsaPublicKey),
                    { name: "RSA-OAEP", hash: "SHA-256" },
                    true,
                    ["encrypt"]
                );

                resolve({ privateKey, publicKey });
            } else {
                resolve(await generateKeyPair());
            }
        });
    });
}

// ===============================================
// 🔐 Generate AES-GCM Symmetric Key for Encryption
// ===============================================
// AES-GCM is used for encrypting cookie data before storing it securely.
export async function generateSymmetricKey() {
    return await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

// ===============================================
// 🔐 Encrypt Data with AES-GCM for Chunks
// ===============================================
// Encrypt a chunk with AES-GCM (each chunk separately)
export async function encryptChunkWithSymmetricKey(chunk, symmetricKey) {
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for each chunk
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(chunk);

    const cipher = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        symmetricKey,
        encodedData
    );

    return { cipher, iv };
}

// ===============================================
// 🔓 Decrypt Data with AES-GCM for Chunks
// ===============================================
// Decrypts each chunk of AES-GCM encrypted data using the corresponding AES key and IV for each chunk.
export async function decryptChunksWithSymmetricKey(chunks, key) {
    const decryptedChunks = [];

    for (const { iv, cipher } of chunks) {
        const decryptedData = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            cipher
        );
        decryptedChunks.push(new TextDecoder().decode(decryptedData));
    }

    return decryptedChunks.join(""); // Combine the decrypted chunks back into one string
}


// ===============================================
// 🔐 Encrypt Data with AES-GCM (Symmetric Encryption)
// ===============================================
// Encrypts data using AES-GCM and generates a unique IV (Initialization Vector).
async function encryptWithSymmetricKey(data, key) {
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV

    const cipher = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encodedData
    );

    return { cipher, iv };
}

// ===============================================
// 🔓 Decrypt Data with AES-GCM
// ===============================================
// Decrypts AES-GCM encrypted data using the corresponding AES key and IV.
async function decryptWithSymmetricKey(cipher, iv, key) {
    const decryptedData = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        cipher
    );
    return new TextDecoder().decode(decryptedData);
}

// ===============================================
// 🔒 Encrypt AES Key using RSA Public Key
// ===============================================
// Encrypts the AES key using the RSA public key for secure storage.
async function encryptSymmetricKey(symmetricKey, publicKey) {
    const exportedKey = await crypto.subtle.exportKey("raw", symmetricKey);
    return await crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, exportedKey);
}

// ===============================================
// 🔓 Decrypt AES Key using RSA Private Key
// ===============================================
// Decrypts the AES key using the RSA private key to allow cookie decryption.
async function decryptSymmetricKey(encryptedKey, privateKey) {
    const decryptedKey = await crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        privateKey,
        encryptedKey
    );
    return await crypto.subtle.importKey(
        "raw",
        decryptedKey,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
    );
}

// ===============================================
// 📤 Store Encrypted Cookies in IPFS
// ===============================================
// Encrypts cookies, encrypts the AES key, and stores the data in IPFS.
async function storeCookiesInIpfs() {
    try {
        console.log("📥 Fetching cookies for encryption...");
        const cookies = await fetchCookies(); // Retrieve cookies from browser.
        const cookiesJson = JSON.stringify(cookies, null, 2);

        console.log("🔐 Generating AES-GCM symmetric key...");
        const symmetricKey = await generateSymmetricKey();

        console.log("🔑 Encrypting cookies using AES-GCM...");
        const { cipher, iv } = await encryptWithSymmetricKey(cookiesJson, symmetricKey);

        console.log("🔒 Fetching RSA public key for AES key encryption...");
        const { publicKey } = await getKeyPair();

        console.log("🔑 Encrypting AES key using RSA-OAEP...");
        const encryptedSymmetricKey = await encryptSymmetricKey(symmetricKey, publicKey);

        console.log("📦 Concatenating IV, encrypted AES key, and encrypted cookies...");
        const combinedData = new Uint8Array([...iv, ...new Uint8Array(encryptedSymmetricKey), ...new Uint8Array(cipher)]);

        console.log("🚀 Storing encrypted data in IPFS...");
        const cid = await fs.addBytes(combinedData);
        console.log("✅ Encrypted cookies stored in IPFS with CID:", cid.toString());

        console.log("💾 Saving CID to Chrome local storage...");
        chrome.storage.local.set({ cookiesCid: cid.toString() });
    } catch (error) {
        console.error("❌ Error storing cookies in IPFS:", error);
    }
}

// ===============================================
// 📥 Retrieve and Decrypt Cookies from IPFS
// ===============================================
// This function fetches encrypted cookie data from IPFS, decrypts the AES key,
// and then decrypts the cookies to restore their original values.
async function retrieveCookiesFromIpfs() {
    try {
        console.log("🔍 Retrieving RSA private key for decryption...");
        const { privateKey } = await getKeyPair();

        console.log("📡 Fetching CID from Chrome local storage...");
        const cidResult = await new Promise((resolve) => {
            chrome.storage.local.get("cookiesCid", (result) => resolve(result.cookiesCid));
        });

        if (!cidResult) {
            console.error("❌ No CID found in local storage.");
            return;
        }

        console.log("📡 Fetching encrypted data from IPFS...");
        const chunks = [];
        for await (const chunk of fs.cat(cidResult)) {
            chunks.push(chunk);
        }

        console.log("📦 Combining retrieved IPFS data...");
        const combinedData = new Uint8Array(chunks.reduce((acc, curr) => acc + curr.length, 0));
        let offset = 0;

        for (const chunk of chunks) {
            combinedData.set(chunk, offset);
            offset += chunk.length;
        }

        // Extract the IV, encrypted AES key, and encrypted cookie data.
        const iv = combinedData.slice(0, 12);
        const encryptedSymmetricKey = combinedData.slice(12, 268);
        const cipher = combinedData.slice(268);

        console.log("🔓 Decrypting AES key using RSA private key...");
        const symmetricKey = await decryptSymmetricKey(encryptedSymmetricKey, privateKey);

        console.log("🔓 Decrypting cookie data using AES-GCM...");
        const decryptedData = await decryptWithSymmetricKey(cipher, iv, symmetricKey);
        const cookies = JSON.parse(decryptedData);

        console.log("✅ Successfully retrieved and decrypted cookies:", cookies);
        return cookies;
    } catch (error) {
        console.error("❌ Error retrieving cookies from IPFS:", error);
    }
}

// ===============================================
// 📨 Listen for Messages (Communication with Background.js)
// ===============================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "storeCookies") {
        console.log("📩 Received message to store cookies.");
        storeCookiesInIpfs()
            .then(() => sendResponse({ status: "Cookies stored successfully" }))
            .catch((error) => sendResponse({ status: `Error: ${error.message}` }));
        return true;
    }

    if (request.action === "retrieveCookies") {
        console.log("📩 Received message to retrieve cookies.");
        retrieveCookiesFromIpfs()
            .then((cookies) => sendResponse({ cookies }))
            .catch((error) => sendResponse({ error: `Error: ${error.message}` }));
        return true;
    }
});
