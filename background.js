importScripts('lib/helia-unixfs.js');
importScripts('lib/helia-core.js');
importScripts('lib/blockstore-core.js');
importScripts('lib/blockstore-idb.js');

// Access Helia's components globally
const { createHelia } = Helia; // From helia-core.js
const { unixfs } = HeliaUnixfs; // From helia-unixfs.js
const { IDBBlockstore } = BlockstoreIdb; // From blockstore-idb.js

let helia, fs; // Global variables for Helia and UnixFS
let symmetricKey;

// ===============================================
// ✅ Initialize Helia with DHT and UnixFS support
// ===============================================
async function initializeHelia() {
    try {
        if (helia) {
            return helia;
        }

        console.log("================== 🚀 Initializing Helia, FS 🚀==================");

        const blockstore = new IDBBlockstore("ipfs-cookie-storage");
        await blockstore.open();

        // Default bootstrap list
        const bootstrapList = [
            "/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
            "/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa",
            "/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb",
            "/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt",
            "/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ"
        ];

        helia = await createHelia({
            blockstore,
            libp2p: {
                config: {
                    peerDiscovery: {
                        autoDial: true, // ✅ Auto-connect to discovered peers
                        bootstrap: {
                            list: bootstrapList
                        },
                        dht: { enabled: true } // ✅ Enable DHT peer discovery
                    },
                    contentRouting: {
                        dht: true // ✅ Ensure DHT is used for finding content
                    }
                }
            }
        });

        // ✅ Initialize UnixFS for file storage
        fs = unixfs(helia);

        // Init Symmetric key
        symmetricKey = await generateSymmetricKey()

        console.log("✅ Successfully initialized Helia, FS and generated Symmetric Key");
        return helia;
    } catch (error) {
        console.error("❌ Error initializing Helia:", error);
        throw error;
    }
}

// Open an IndexedDB connection (or create if it doesn't exist)
async function openIndexDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('CookieStorageDB', 1);
        
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('domainMappings')) {
                db.createObjectStore('domainMappings', { keyPath: 'domainName' });
            }
        };

        request.onsuccess = (e) => {
            resolve(e.target.result);
        };

        request.onerror = (e) => {
            reject(e.target.error);
        };
    });
}

// Store the domain-to-chunkSet mapping in IndexedDB
async function storeMappingInDb(domainName, chunkSetCID) {
    const db = await openIndexDb();
    const transaction = db.transaction('domainMappings', 'readwrite');
    const store = transaction.objectStore('domainMappings');
    const mapping = { domainName, chunkSetCID };

    const request = store.put(mapping); // Store the mapping

    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            console.log(`✅ Successfully stored mapping for domain: ${domainName}`);
            resolve();
        };
        request.onerror = (e) => {
            console.error('❌ Error storing mapping:', e.target.error);
            reject(e.target.error);
        };
    });
}

// Function to retrieve the chunkSetCID from IndexedDB for a domain
async function getMappingFromDb(domainName) {
    const db = await openIndexDb();
    const transaction = db.transaction('domainMappings', 'readonly');
    const store = transaction.objectStore('domainMappings');

    const request = store.get(domainName);  // Fetch the mapping by domain name
    return new Promise((resolve, reject) => {
        request.onsuccess = (e) => {
            const mapping = e.target.result;
            if (mapping) {
                resolve(mapping.chunkSetCID);  // Return the chunkSetCID from the mapping
            } else {
                console.error(`❌ No mapping found for domain: ${domainName}`);
                resolve(null);  // No mapping found, resolve with null
            }
        };
        request.onerror = (e) => {
            console.error('❌ Error retrieving mapping from DB:', e.target.error);
            reject(e.target.error);
        };
    });
}

// ===============================================
// 🔐 Generate AES-GCM Symmetric Key for Encryption
// ===============================================
// AES-GCM is used for encrypting cookie data before storing it securely.
async function generateSymmetricKey() {
    return await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

// ===============================================
// 🔐 Encrypt Data with AES-GCM (Symmetric Encryption)
// ===============================================
// Encrypts data using AES-GCM and generates a unique IV (Initialization Vector).
async function encryptWithSymmetricKey(data, key, encoder) {
    const encodedData = encoder.encode(data);
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV (12 Bytes)

    // Encrypt the data
    const cipher = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encodedData
    );

    // Concatenate IV and ciphertext (cipher)
    const cipherArray = new Uint8Array(iv.byteLength + cipher.byteLength);
    cipherArray.set(iv, 0);  // Set the IV in the first part
    cipherArray.set(new Uint8Array(cipher), iv.byteLength);  // Set the cipher after the IV
    return cipherArray;
}

// ===============================================
// 🔐 Decrypt Data with AES-GCM (Symmetric Decryption)
// ===============================================
// Decrypts data using AES-GCM by extracting the IV and ciphertext.
async function decryptWithSymmetricKey(encryptedData, key) {
    const iv = encryptedData.slice(0, 12); // First 12 bytes are the IV
    const cipher = encryptedData.slice(12); // Remaining data is the ciphertext

    const decryptedData = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        cipher
    );
    return new TextDecoder().decode(decryptedData);
}



// ===============================================
// ✅ Fetch cookie (currently dummy cookie)
// ===============================================
async function fetchCookie() {
    // Return Dummy Cookie
    return {
        "name": "session_id",
        "value": "abcd1234",
        "domain": "localhost",
        "path": "/",
        "secure": false,
        "httpOnly": false,
        "sameSite": "Lax",
        "expirationDate": 1700000000
    };
}

// ===============================================
// Split the encrypted data into chunks
// ===============================================
function splitIntoChunks(cipher, chunkSize) {
    let chunks = [];
    for (let i = 0; i < cipher.byteLength; i += chunkSize) {
        chunks.push(cipher.slice(i, i + chunkSize));
    }
    return chunks;
}

// ===============================================
// 📤 Store Encrypted Cookies in IPFS
// ===============================================
async function storeCookiesInIpfs() {
    try {
        await initializeHelia();

        console.log("==================🔒📜 Encrypting & Storing Cookies in IPFS 📜🔒 ==================");

        const cookie = await fetchCookie();
        const cookieDomain = cookie.domain;
        const cookieJson = JSON.stringify(cookie);
        const encoder = new TextEncoder();

        // Encrypt the cookie data
        const cookieIVCipher = await encryptWithSymmetricKey(cookieJson, symmetricKey, encoder);
        console.log(`✅ Encrypted data: ${cookieIVCipher}`)

        // Split Cookie Data into 64B Chunks
        let chunkArray = splitIntoChunks(cookieIVCipher, 64)
        let chunkCIDs = [];

        for (let i = 0; i < chunkArray.length; i ++){
            let cipherChunk = chunkArray[i];
            let cid = await fs.addBytes(cipherChunk);
            chunkCIDs.push(cid.toString());
        }

        console.log(`✅ Successfully stored cookie in ${chunkCIDs.length} chunks.`);

        // Create Chunk Set
        const chunkSet = {
            totalChunks: chunkCIDs.length,
            chunkCIDs: chunkCIDs
        };

        const chunkSetBytes = encoder.encode(JSON.stringify(chunkSet));
        const chunkSetCID = await fs.addBytes(chunkSetBytes);

        console.log(`✅ Chunk Set stored with CID: ${chunkSetCID.toString()}`);

        // Store the domain-to-chunkSet mapping in IndexedDB
        await storeMappingInDb(cookieDomain, chunkSetCID.toString());

        // Return the ChunkSet CID directly for use
        return cookieDomain, chunkSetCID.toString();

    } catch (error) {
        console.error('❌ Error storing cookies in IPFS:', error);
    }
}

// ✅ Retrieve ChunkSet File using only the domainName
async function retrieveChunkSet(domainName) {
    console.log("================== 📥 Retrieving Cookie Chunk Set CID 📥 ==================");
    try {
        // Fetch the chunkSetCID for the given domainName from IndexedDB
        const chunkSetCID = await getMappingFromDb(domainName);

        if (!chunkSetCID) {
            throw new Error(`❌ No Chunk Set CID found for domain: ${domainName}`);
        }

        // Initialize Helia and fs
        await initializeHelia();

        console.log(`✅ Successfully fetched Chunk Set CID: ${chunkSetCID}`);
        let chunks = [];

        // Fetch all chunks for the Chunk Set
        for await (const chunk of fs.cat(chunkSetCID)) {
            chunks.push(chunk);
            console.log(`✅ Successfully retrieved Chunk: Size ${chunk.length} bytes`);
        }

        // If no chunks are retrieved, throw an error
        if (chunks.length === 0) {
            throw new Error(`❌ Chunk Set CID ${chunkSetCID} not found or empty.`);
        }

        // Combine all chunks into a single Uint8Array
        const mergedChunks = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));

        let offset = 0;
        for (const chunk of chunks) {
            mergedChunks.set(chunk, offset);
            offset += chunk.length;
        }

        // Decode the combined data into a string
        const decoder = new TextDecoder();
        const chunkSetContent = decoder.decode(mergedChunks);

        console.log(`✅ Successfully Retrieved Chunk Set: ${chunkSetContent}`);

        return chunkSetContent; // Return the cookie data
            
    } catch (error) {
        console.error("❌ Error retrieving chunk set:", error);
        return null;
    }
}

/* ✅ Retrieve Cookies from IPFS using the CIDs */
async function retrieveCookiesFromIpfs(cookieData) {
    console.log("================== 🔑📦 Decrypting, Retrieving and Reconstructing Cookie Data 📦🔑 ==================");
    try {
        // Ensure Helia and fs are initialized
        if (!helia) await initializeHelia();

        // Check if CIDs are provided
        if (cookieData.totalChunks === 0) {
            console.warn("⚠️ No chunks found in chunk set.");
            return null;
        }

        let combinedBytes = [];
        let cids = cookieData.chunkCIDs

        // Fetch each chunk for the given CIDs
        for (const cid of cids) {
            console.log(`✅ Processing CID: ${cid}`); // Log the CID being processed

            const chunks = [];

            // Fetch the chunk data
            for await (const chunk of fs.cat(cid)) {
                chunks.push(chunk);
            }

            // Merge the fetched chunks into the combinedBytes array
            if (chunks.length > 0) {
                // Push the data directly into combinedBytes array
                for (const chunk of chunks) {
                    combinedBytes.push(...chunk);
                }
            } else {
                console.warn(`⚠️ No data found for CID: ${cid}`);
            }
        }

        // Merge Chunks into a Single Uint8Array without using flat() method
        const mergedEncryptedBytes = new Uint8Array(combinedBytes);

        // Decrypt the data
        const mergedDecryptedBytes = await decryptWithSymmetricKey(mergedEncryptedBytes, symmetricKey);

        console.log(`✅ Successfully Reconstructed Cookie Data:`, mergedDecryptedBytes);

        // Try to parse the JSON content
        try {
            const parsedData = JSON.parse(mergedDecryptedBytes);
            return parsedData;
        } catch (jsonError) {
            console.error("❌ Error parsing JSON data:", jsonError);
            return null;
        }
    } catch (error) {
        console.error("❌ Error retrieving cookies from IPFS:", error);
        return null;
    }
}


/* ✅ Handle Messages from Popup */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "storeCookies") {
        storeCookiesInIpfs()
            .then((domainName, chunkSetCID) => sendResponse({ domainName, chunkSetCID }))
            .catch((error) => sendResponse({ error: `Error: ${error.message}` }));
        return true; // Keep async response open
    }

    if (request.action === "retrieveCookies") {
        retrieveChunkSet(request.domainName)
            .then((cookieData) => {
                const parsedCookieData = JSON.parse(cookieData);  // Parse if needed
                if (!parsedCookieData || !parsedCookieData.chunkCIDs || parsedCookieData.chunkCIDs.length === 0) {
                    throw new Error("Invalid or empty chunkSetCID.");
                }
                return retrieveCookiesFromIpfs(parsedCookieData).then((cookie) => ({
                    cookie,
                    cookieData
                }));
            })
            .then((responseData) => sendResponse(responseData))
            .catch((error) => sendResponse({ error: `Error retrieving cookies: ${error.message}` }));

        return true; // Keep async response open
    }

});

initializeHelia(); // Call initialization when script loads
