importScripts('lib/helia-unixfs.js');
importScripts('lib/helia-core.js');
importScripts('lib/blockstore-core.js');
importScripts('lib/blockstore-idb.js');

// Access Helia's components globally
const { createHelia } = Helia; // From helia-core.js
const { unixfs } = HeliaUnixfs; // From helia-unixfs.js
const { IDBBlockstore } = BlockstoreIdb; // From blockstore-idb.js

let helia, fs; // Global variables for Helia and UnixFS

// ===============================================
// ✅ Initialize Helia with DHT and UnixFS support
// ===============================================
async function initializeHelia() {
    try {
        if (helia) {
            console.log("✅ Helia is already initialized.");
            return helia;
        }

        console.log("🚀 Initializing Helia with DHT support...");

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

        console.log("✅ Helia initialized successfully.");
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
// ✅ Fetch cookie (currently dummy cookie)
// ===============================================
async function fetchCookie() {
    // Return Dummy Cookie
    return {
        name: "dummyCookie",
        value: "randomValue123",
        domain: "example.com",
        path: "/",
        secure: false,
        httpOnly: false,
        sameSite: "Lax",
        expirationDate: Date.now() / 1000 + 3600,
        metadata: {
            deviceType: "Desktop",
            browser: "Chrome",
            version: "119.0.0.0",
            os: "Windows 10"
        }
    };
}

// ===============================================
// 📤 Store Encrypted Cookies in IPFS
// ===============================================
async function storeCookiesInIpfs(domainName) {
    try {
        await initializeHelia();

        const cookie = await fetchCookie();

        const cookieJson = JSON.stringify(cookie);
        const encoder = new TextEncoder();
        const bytes = encoder.encode(cookieJson);

        // ✅ Split Cookie Data into 64B Chunks
        let chunkSize = 64;
        let chunkCIDs = [];

        for (let i = 0; i < bytes.length; i += chunkSize) {
            let chunk = bytes.slice(i, i + chunkSize);
            let cid = await fs.addBytes(chunk);
            chunkCIDs.push(cid.toString());
        }

        console.log(`✅ Successfully stored cookie in ${chunkCIDs.length} chunks.`);

        // ✅ Create Chunk Set
        const chunkSet = {
            totalChunks: chunkCIDs.length,
            chunkCIDs: chunkCIDs
        };

        const chunkSetBytes = encoder.encode(JSON.stringify(chunkSet));
        const chunkSetCID = await fs.addBytes(chunkSetBytes);

        console.log(`📜 Chunk Set stored with CID: ${chunkSetCID.toString()}`);

        // ✅ Store the domain-to-chunkSet mapping in IndexedDB
        await storeMappingInDb(domainName, chunkSetCID.toString());

        // Return the ChunkSet CID directly for use
        return chunkSetCID.toString();

    } catch (error) {
        console.error('❌ Error storing cookies in IPFS:', error);
    }
}

// ✅ Retrieve ChunkSet File using only the domainName
async function retrieveChunkSet(domainName) {
    try {
        // Fetch the chunkSetCID for the given domainName from IndexedDB
        const chunkSetCID = await getMappingFromDb(domainName);

        if (!chunkSetCID) {
            throw new Error(`No Chunk Set CID found for domain: ${domainName}`);
        }

        // Initialize Helia and fs
        await initializeHelia();

        console.log(`📥 Fetching Chunk Set CID: ${chunkSetCID}...`);
        let chunks = [];

        // Fetch all chunks for the Chunk Set
        for await (const chunk of fs.cat(chunkSetCID)) {
            chunks.push(chunk);
            console.log(`📥 Retrieved Chunk: Size ${chunk.length} bytes`);
        }

        // If no chunks are retrieved, throw an error
        if (chunks.length === 0) {
            throw new Error(`Chunk Set CID ${chunkSetCID} not found or empty.`);
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

        console.log(`📂 Retrieved Chunk Set Data: ${chunkSetContent}`);

        // Try to parse the JSON content
        let parsedData;
        try {
            parsedData = JSON.parse(chunkSetContent);
        } catch (jsonError) {
            console.error("❌ Error parsing JSON data:", jsonError);
            return null;
        }

        // Retrieve cookie chunks from chunkSetCID
        console.log(`🔄 Retrieving cookie data using ChunkSet CID: ${chunkSetCID}...`);

        // Retrieve the chunks of cookie data
        let cookieChunks = [];
        for await (const chunk of fs.cat(chunkSetCID)) {
            cookieChunks.push(chunk);
            console.log(`📥 Retrieved Cookie Chunk: Size ${chunk.length} bytes`);
        }

        if (cookieChunks.length === 0) {
            throw new Error(`No cookie data found for domain: ${domainName}`);
        }

        // Merge all cookie chunks
        const mergedCookieChunks = new Uint8Array(cookieChunks.reduce((acc, chunk) => acc + chunk.length, 0));
        let cookieOffset = 0;
        for (const chunk of cookieChunks) {
            mergedCookieChunks.set(chunk, cookieOffset);
            cookieOffset += chunk.length;
        }

        // Decode the combined cookie data into a string
        const cookieData = decoder.decode(mergedCookieChunks);
        console.log(`🍪 Retrieved Cookie Data: ${cookieData}`);

        return cookieData; // Return the cookie data
            
    } catch (error) {
        console.error("❌ Error retrieving manifest or cookie data:", error);
        return null;
    }
}

/* ✅ Retrieve Cookies from IPFS using the CIDs */
async function retrieveCookiesFromIpfs(cookieData) {
    try {
        // Ensure Helia and fs are initialized
        if (!helia) await initializeHelia();

        // Check if CIDs are provided
        if (cookieData.totalChunks === 0) {
            console.warn("⚠️ No chunks found in manifest.");
            return null;
        }

        let combinedBytes = [];
        let cids = cookieData.chunkCIDs
        console.log(cids)

        // Fetch each chunk for the given CIDs
        for (const cid of cids) {
            console.log(`📡 Processing CID: ${cid}`); // Log the CID being processed

            const chunks = [];

            // Fetch the chunk data
            for await (const chunk of fs.cat(cid)) {
                chunks.push(chunk);
                console.log(`📥 Retrieved Chunk: ${cid}, Size: ${chunk.length} bytes`); // Log chunk size
                console.log(`Chunk Preview:`, new TextDecoder().decode(chunk).slice(0, 100)); // Log preview of first 100 characters of chunk
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
        const finalBytes = new Uint8Array(combinedBytes);

        // Decode the final bytes into a string (assuming the data is text-based, such as JSON)
        const decoder = new TextDecoder();
        const fileContent = decoder.decode(finalBytes);

        console.log(`📂 Reconstructed Data:`, fileContent);

        // Try to parse the JSON content
        try {
            const parsedData = JSON.parse(fileContent);
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
        storeCookiesInIpfs("example.com")
            .then((chunkSetCID) => sendResponse({ chunkSetCID }))
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
