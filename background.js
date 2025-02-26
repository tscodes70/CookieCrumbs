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

        const blockstore = new BlockstoreIdb.IDBBlockstore("ipfs-cookie-storage");
        await blockstore.open();

        // Default bootstrap list
        const bootstrapList = [
            "/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
            "/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa",
            "/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb",
            "/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt",
            "/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ"
        ];

        helia = await Helia.createHelia({
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
        fs = HeliaUnixfs.unixfs(helia);

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

// Function to retrieve all mappings from IndexedDB
async function getAllMappingsFromDb() {
    const db = await openIndexDb();
    const transaction = db.transaction('domainMappings', 'readonly');
    const store = transaction.objectStore('domainMappings');

    return new Promise((resolve, reject) => {
        const request = store.getAll(); // Fetch all entries
        request.onsuccess = (e) => {
            const mappings = e.target.result;
            if (mappings.length > 0) {
                resolve(mappings); // Return all mappings
            } else {
                console.warn('⚠️ No mappings found in the database.');
                resolve([]); // Return an empty array if no mappings exist
            }
        };
        request.onerror = (e) => {
            console.error('❌ Error retrieving all mappings from DB:', e.target.error);
            reject(e.target.error);
        };
    });
}

async function deleteMappingFromDb(domainName) {
    const db = await openIndexDb();
    const transaction = db.transaction('domainMappings', 'readwrite');
    const store = transaction.objectStore('domainMappings');

    return new Promise((resolve, reject) => {
        const request = store.delete(domainName);

        request.onsuccess = () => {
            console.log(`✅ Successfully removed mapping for domain: ${domainName}`);
            resolve();
        };

        request.onerror = (e) => {
            console.error('❌ Error deleting mapping:', e.target.error);
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
    // Actual domain code for testing purposes
    let tabs = await browser.tabs.query({ active: true, currentWindow: true });
    let currentDomain = tabs.length > 0 ? new URL(tabs[0].url).origin : "unknown";

    return {
        "name": "session_id",
        "value": "abcd1234",
        //"domain": currentDomain, // Uncomment this and comment out the line below if you want to test domain
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

async function storeCookiesInIpfsForReal(cookie, cookieDomain) {
    try {
        await initializeHelia();

        console.log("==================🔒📜 Encrypting & Storing Cookies in IPFS 📜🔒 ==================");

        // const cookie = await fetchCookie();
        // const cookieDomain = cookie.domain;
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

async function deleteCookiesFromIpfs(domainName) {
    console.log("================== 🗑️ Deleting and Verifying Cookies from Simulated IPFS 🗑️ ==================");

    try {
        if (!helia) await initializeHelia();

        // ✅ Fetch the chunkSetCID from IndexedDB
        const chunkSetCID = await getMappingFromDb(domainName);
        if (!chunkSetCID) {
            console.warn(`⚠️ No Chunk Set CID found for domain: ${domainName}`);
            return false;
        }
        console.log(`✅ Found Chunk Set CID: ${chunkSetCID}`);

        // ✅ Retrieve the split chunks using fs.cat
        let chunkSetData = [];
        try {
            for await (const chunk of fs.cat(chunkSetCID)) {
                chunkSetData.push(chunk);
            }
        } catch (error) {
            console.warn(`⚠️ Failed to fetch Chunk Set CID ${chunkSetCID}:`, error);
            return false;
        }

        if (chunkSetData.length === 0) {
            console.warn(`⚠️ No data found for Chunk Set CID: ${chunkSetCID}`);
            return false;
        }

        // ✅ Merge all split chunks into a single Uint8Array
        let totalLength = chunkSetData.reduce((acc, chunk) => acc + chunk.length, 0);
        let mergedChunks = new Uint8Array(totalLength);

        let offset = 0;
        for (const chunk of chunkSetData) {
            mergedChunks.set(chunk, offset);
            offset += chunk.length;
        }

        // ✅ Decode merged data into JSON
        const decoder = new TextDecoder();
        const chunkSetContent = decoder.decode(mergedChunks);
        console.log(`✅ Successfully Retrieved Chunk Set: ${chunkSetContent}`);

        // ✅ Parse JSON to get chunk CIDs
        const chunkSet = JSON.parse(chunkSetContent);
        if (!chunkSet.chunkCIDs || chunkSet.chunkCIDs.length === 0) {
            console.warn(`⚠️ No chunks found in chunk set for CID: ${chunkSetCID}`);
            return false;
        }

        console.log(`✅ Extracted Chunk CIDs: ${JSON.stringify(chunkSet.chunkCIDs)}`);

        // ✅ Retrieve and merge each chunk before deletion
        for (const chunkCID of chunkSet.chunkCIDs) {
            try {
                console.log(`Deleting chunk: ${chunkCID}`);

                // ✅ Verify chunk exists before deletion
                let exists = await verifyChunkExists(chunkCID);
                if (!exists) {
                    console.warn(`⚠️ Chunk CID ${chunkCID} does not exist.`);
                    continue;
                }
                const { CID } =  Multiformats;


                // ✅ Delete chunk from IPFS
                await helia.blockstore.delete(CID.parse(chunkCID));
                console.log(`🗑️ Deleted Chunk CID: ${chunkCID}`);

            } catch (error) {
                console.warn(`⚠️ Failed to delete chunk CID:`, error);
            }
        }

        // ✅ Delete the chunk set itself
        try {
            let exists = await verifyChunkExists(chunkSetCID);
            if (exists) {
                await helia.blockstore.delete(CID.parse(chunkSetCID));
                console.log(`🗑️ Deleted Chunk Set CID: ${chunkSetCID}`);
            } else {
                console.warn(`⚠️ Chunk Set CID ${chunkSetCID} already missing.`);
            }
        } catch (error) {
            console.warn(`⚠️ Failed to delete Chunk Set CID ${chunkSetCID}:`, error);
        }

        // ✅ Remove the domain-to-chunkSet mapping from IndexedDB
        await deleteMappingFromDb(domainName);
        console.log(`✅ Successfully removed domain mapping for: ${domainName}`);

        console.log("✅ Successfully deleted and verified cookies from Simulated IPFS.");
        return true;
    } catch (error) {
        console.error("❌ Error deleting cookies from Simulated IPFS:", error);
        return false;
    }
}

async function verifyChunkExists(cid) {
    try {
        for await (const chunk of fs.cat(cid)) {
            if (chunk) {
                return true; // ✅ Chunk exists
            }
            return false;
        }
    } catch (error) {
        if (error.message.includes("not found") || error.message.includes("does not exist")) {
            return false; // ❌ Chunk does not exist
        }
    }
    return false;
}

async function isChunkDeleted(cid, timeout = 5000) {
    console.log(`🔍 Checking if chunk ${cid} is deleted...`);

    try {
        return await Promise.race([
            (async () => {
                for await (const chunk of fs.cat(cid)) {
                    if (chunk) {
                        console.warn(`⚠️ Chunk with CID ${cid} still exists.`);
                        return false; // Chunk still exists
                    }
                }
                return false; // Default return if no error
            })(),
            new Promise((resolve) => {
                setTimeout(() => {
                    console.log(`✅ Timeout reached. Assuming chunk ${cid} is deleted.`);
                    resolve(true);
                }, timeout);
            })
        ]);
    } catch (error) {
        if (error.message.includes("not found") || error.message.includes("does not exist")) {
            console.log(`✅ Chunk with CID ${cid} is deleted.`);
            return true; // Confirmed deletion
        }
        console.error(`❌ Unexpected error while checking chunk CID ${cid}:`, error);
    }
    return false; // Assume not deleted if no confirmation
}

// Function to check if a domain exists in IndexedDB
async function verifyDomainExists(domainName) {
    try {
        const db = await openIndexDb();
        const transaction = db.transaction('domainMappings', 'readonly');
        const store = transaction.objectStore('domainMappings');
        const request = store.get(domainName);
        return new Promise((resolve) => {
            request.onsuccess = (e) => {
                const mapping = e.target.result;
                resolve(!!mapping);
            };
            request.onerror = () => {
                resolve(false);
            };
        });
    } catch {
        return false;
    }
}

// Function to export encrypted cookies and sym key
async function exportCookies() {
    try {
        const mappings = await getAllMappingsFromDb(); // Wait for mappings to be fetched
        console.log('📌 All mappings:', mappings);

        let exportData = {}; // Object to store data for export

        for (const mapping of mappings) {
            try {
                const cookieDataString = await retrieveChunkSet(mapping.domainName); // Await result

                if (!cookieDataString) {
                    console.warn(`⚠️ No chunk set data found for ${mapping.domainName}`);
                    continue;
                }

                const parsedCookieData = JSON.parse(cookieDataString); // Parse JSON string

                if (!parsedCookieData || !parsedCookieData.chunkCIDs || parsedCookieData.chunkCIDs.length === 0) {
                    console.warn(`⚠️ Invalid or empty chunkSetCID for ${mapping.domainName}.`);
                    continue;
                }

                if (parsedCookieData.totalChunks === 0) {
                    console.warn(`⚠️ No chunks found in chunk set for ${mapping.domainName}.`);
                    continue;
                }

                let cids = parsedCookieData.chunkCIDs; // Extract CIDs correctly
                let chunkSetId = mapping.chunkSetCID; // Get chunkSetCID
                let chunkData = {}; // Store chunk data for this domain

                for (const cid of cids) {
                    console.log(`✅ Processing CID: ${cid}`);

                    const chunks = [];

                    try {
                        for await (const chunk of fs.cat(cid)) {
                            chunks.push(...chunk); // Merge chunk data
                        }

                        if (chunks.length > 0) {
                            chunkData[cid] = Array.from(new Uint8Array(chunks)); // Convert Uint8Array to normal array
                        } else {
                            console.warn(`⚠️ No data found for CID: ${cid}`);
                        }
                    } catch (fsError) {
                        console.error(`❌ Error fetching CID ${cid}:`, fsError);
                    }
                }

                // Store chunk data inside the domain entry
                if (!exportData[mapping.domainName]) {
                    exportData[mapping.domainName] = {};
                }
                exportData[mapping.domainName][chunkSetId] = chunkData;

            } catch (error) {
                console.error(`❌ Error processing domain ${mapping.domainName}:`, error);
            }
        }

        // ✅ Export the symmetric key
        const symmetricKeyRaw = await crypto.subtle.exportKey("raw", symmetricKey);
        const symmetricKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(symmetricKeyRaw))); // Convert raw key to Base64

        // ✅ Modify the JSON format to place `symmetricKey` at the top
        const finalExportData = {
            symmetricKey: symmetricKeyBase64, // Symmetric key at the top
            ...exportData // Append all domain data
        };

        // Convert object to JSON string
        const jsonData = JSON.stringify(finalExportData, null, 4);

        // Save as JSON file (Assuming a browser environment)
        const blob = new Blob([jsonData], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "exported_cookies.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        console.log("✅ Data exported successfully!");

    } catch (error) {
        console.error('❌ Failed to fetch mappings:', error);
    }
}

async function importCookies(jsonData) {
            try {
                console.log("📂 Loaded JSON Data:", jsonData);

                // ✅ Extract and restore the symmetric key
                if (!jsonData.symmetricKey) {
                    console.error("❌ No symmetric key found in the imported JSON.");
                    alert("⚠️ Import failed: Missing symmetric key.");
                    return;
                }

                // ✅ Convert Base64 string back to Uint8Array
                const binaryKey = atob(jsonData.symmetricKey)
                    .split("")
                    .map(char => char.charCodeAt(0));
                const keyBuffer = new Uint8Array(binaryKey);

                // ✅ Import the symmetric key
                symmetricKey = await crypto.subtle.importKey(
                    "raw",
                    keyBuffer,
                    { name: "AES-GCM" },
                    true,
                    ["encrypt", "decrypt"]
                );

                console.log("🔑 Symmetric key successfully restored!");

                // ✅ Remove the symmetric key from JSON to process domain data
                delete jsonData.symmetricKey;

                // ✅ Initialize IPFS
                await initializeHelia();
                console.log("✅ IPFS initialized for re-storage.");

                for (const domainName in jsonData) {
                    const chunkSets = jsonData[domainName];

                    for (const chunkSetId in chunkSets) {
                        const chunkData = chunkSets[chunkSetId];
                        const chunkCIDs = Object.keys(chunkData);
                        let newChunkCIDs = [];

                        console.log(`🔄 Restoring domain: ${domainName}, Chunk Set: ${chunkSetId}`);

                        for (const cid of chunkCIDs) {
                            try {
                                const chunkBytes = new Uint8Array(chunkData[cid]); // Convert stored chunk back to Uint8Array
                                const newCid = await fs.addBytes(chunkBytes); // Re-store in IPFS
                                newChunkCIDs.push(newCid.toString());
                                console.log(`✅ Chunk ${cid} re-stored with new CID: ${newCid.toString()}`);
                            } catch (error) {
                                console.error(`❌ Error re-storing chunk ${cid}:`, error);
                            }
                        }

                        // ✅ Create new chunk set
                        const chunkSet = {
                            totalChunks: newChunkCIDs.length,
                            chunkCIDs: newChunkCIDs
                        };

                        const encoder = new TextEncoder();
                        const chunkSetBytes = encoder.encode(JSON.stringify(chunkSet));
                        const newChunkSetCID = await fs.addBytes(chunkSetBytes);

                        console.log(`✅ New Chunk Set stored with CID: ${newChunkSetCID.toString()}`);

                        // ✅ Store the new mapping using storeMappingInDb()
                        await storeMappingInDb(domainName, newChunkSetCID.toString());
                    }
                }

                console.log("✅ Import complete!");

            } catch (error) {
                console.error("❌ Failed to parse JSON file:", error);
            }
}

/* ✅ Function to Remove All Session Cookies from IPFS on Shutdown */
async function clearSessionCookiesOnShutdown() {

    const { CID } =  Multiformats;

    try {
        console.log("🧹 Clearing session cookies on browser shutdown...");

        // Step 1: Retrieve all stored mappings from IndexedDB
        const db = await openIndexDb();
        const transaction = db.transaction('domainMappings', 'readonly');
        const store = transaction.objectStore('domainMappings');

        const request = store.getAll();
        const storedMappings = await new Promise((resolve, reject) => {
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });

        if (!storedMappings || storedMappings.length === 0) {
            console.log("✅ No stored session cookies to delete.");
            return;
        }

        console.log(`🔍 Found ${storedMappings.length} stored domains. Checking for session cookies...`);

        // Step 2: Loop through stored mappings
        for (const mapping of storedMappings) {
            const { domainName, chunkSetCID } = mapping;

            // Step 3: Retrieve the chunk set to check for session-based cookies
            const chunkSetContent = await retrieveChunkSet(domainName);
            if (!chunkSetContent) continue;

            const chunkSet = JSON.parse(chunkSetContent);
            if (!chunkSet.chunkCIDs || chunkSet.chunkCIDs.length === 0) continue;

            console.log(`🛑 Deleting session cookies for domain: ${domainName}`);

            // Step 4: Delete each chunk
            for (const chunkCID of chunkSet.chunkCIDs) {
                try {
                    console.log(`🗑️ Deleting Chunk CID: ${chunkCID}`);
                    await helia.blockstore.delete(CID.parse(chunkCID));
                    console.log(`✅ Successfully deleted: ${chunkCID}`);
                } catch (error) {
                    console.error(`❌ Error deleting chunk CID ${chunkCID}:`, error);
                }
            }

            // Step 5: Delete the chunk set itself
            try {
                console.log(`🗑️ Deleting Chunk Set CID: ${chunkSetCID}`);
                await helia.blockstore.delete(CID.parse(chunkSetCID));
                console.log(`✅ Successfully deleted Chunk Set CID: ${chunkSetCID}`);
            } catch (error) {
                console.error(`❌ Error deleting Chunk Set CID ${chunkSetCID}:`, error);
            }

            // Step 6: Remove mapping from IndexedDB
            await deleteMappingFromDb(domainName);
            console.log(`✅ Successfully removed mapping for: ${domainName}`);
        }

        console.log("✅ All session cookies deleted successfully.");
    } catch (error) {
        console.error("❌ Error clearing session cookies on shutdown:", error);
    }
}

function parseCookie(headerValue, domain) {
    const parts = headerValue.split('; ');
    const [name, ...valueParts] = parts[0].split('=');
    const cookieData = {
        name: name.trim(),
        value: valueParts.join('=').trim(),
        domain: domain,
        path: '/',
        expires: null,
        maxAge: null,
        httpOnly: false,
        secure: false,
        sameSite: 'None',
    };
  
    parts.slice(1).forEach(part => {
        const [key, val] = part.split('=');
        const lowerKey = key.toLowerCase().trim();
        switch (lowerKey) {
        case 'path':
            cookieData.path = val || '/';
            break;
        case 'expires':
            cookieData.expires = new Date(val).toISOString();
            break;
        case 'max-age':
            cookieData.maxAge = parseInt(val, 10);
            break;
        case 'httponly':
            cookieData.httpOnly = true;
            break;
        case 'secure':
            cookieData.secure = true;
            break;
        case 'samesite':
            cookieData.sameSite = val || 'None';
            break;
        }
    });
  
    return cookieData;
}

function isCookieExpired(cookie) {
    const now = Date.now();
  
    // Check `max-age` first
    if (cookie.maxAge !== null) {
        const expirationTime = new Date(cookie.expires).getTime();
        return expirationTime <= now;
    }
  
    // Check `expires`
    if (cookie.expires !== null) {
        const expirationTime = new Date(cookie.expires).getTime();
        return expirationTime <= now;
    }
  
    // If neither `expires` nor `max-age` is set, the cookie is a session cookie
    // Session cookies expire when the browser is closed, so we consider them valid
    return false;
}

function filterExpiredCookies(cookies) {
    // If deleted cookie, remove from IPFS also IF THEY EXIST
    let expired = cookies.filter(cookie => isCookieExpired(cookie));
    expired.forEach(cookie => {
        console.log("Expired cookie: ", cookie);
        console.log("Expired cookie domain: ", cookie.domain);
        deleteCookiesFromIpfs(cookie.domain).then(details => {
            console.log(details);
            console.log("Cookie deleted inside IPFS.");
        });
    });
    return cookies.filter(cookie => !isCookieExpired(cookie));
}

/* ✅ Handle Messages from Popup */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "storeCookies") {
        fetchCookie().then(async (cookieData) => {
            let domain = cookieData.domain;
            let exists = await verifyDomainExists(domain);

            // Check if there is an existing cookie for the domain
            if (!exists) { 
                storeCookiesInIpfs()
                    .then((domainName, chunkSetCID) => sendResponse({ domainName, chunkSetCID }))
                    .catch((error) => sendResponse({ error: `Error: ${error.message}` }));
                return true; // Keep async response open
            } 
            else {
                console.log("Cookie already existing for this domain.");
                retrieveChunkSet(domain)
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
                    .then((responseData) => {
                        sendResponse(responseData);

                        // Send to web server (IDK if working)
                        const apiEndpoint = `${domain}/api/storeCookies`; // Construct the API URL
                        console.log(`✅ dsand ${domain}`);
                        fetch(apiEndpoint, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Cookie": document.cookie // Send current website's cookies if needed
                            },
                            credentials: "include", // Ensures cookies are sent with the request
                            body: JSON.stringify({
                                domain: currentWebsite,
                                cookies: responseData.cookie
                            })
                        })
                        .then(serverResponse => serverResponse.json())
                        .then(serverData => console.log("Server Response:", serverData))
                        .catch(error => console.error("Error sending cookie to server:", error));
                    })
                    .catch((error) => sendResponse({ error: `Error retrieving cookies: ${error.message}` }));

                return true; // Keep async response open
            }
        });

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

    if (request.action === "importCookies") {
        console.log("📥 Received importCookies request in background.js");

        importCookies(request.data)
            .then(() => sendResponse({ success: true }))
            .catch((error) => sendResponse({ success: false, error: error.message }));

        return true; // Keep response channel open for async operation
    }

    if (request.action === "exportCookies") {
        exportCookies()
            .then((data) => sendResponse({ success: true, data }))
            .catch((error) => sendResponse({ success: false, error: error.message }));
        return true; // Keeps the response channel open for async operations
    }

});

/* ✅ Listen for Browser Shutdown */
chrome.windows.onRemoved.addListener(async (windowId) => {
    console.log("🛑 Browser window closed, clearing session cookies...");
    await clearSessionCookiesOnShutdown();
});

/* ✅ Alternative: Detect when the service worker is being suspended */
chrome.runtime.onSuspend.addListener(async () => {
    console.log("🛑 Service worker is suspending, clearing session cookies...");
    await clearSessionCookiesOnShutdown();
});

chrome.webRequest.onBeforeSendHeaders.addListener(
    async function(details) { // Make this function async
        const domain = new URL(details.url).hostname;
        let headers = details.requestHeaders;
        
        console.log("Current Domain: ", domain);
        
        try {
            let exists = await verifyDomainExists(domain);
            console.log("Domain exists:", exists);

            if (exists) {
                console.log("Cookie already exists for this domain.");
                
                let cookieData = await retrieveChunkSet(domain);
                const parsedCookieData = JSON.parse(cookieData);

                if (!parsedCookieData || !parsedCookieData.chunkCIDs || parsedCookieData.chunkCIDs.length === 0) {
                    console.error("Invalid or empty chunkSetCID.");
                    return { requestHeaders: headers }; // Return early if no valid cookie
                }

                let cookie = await retrieveCookiesFromIpfs(parsedCookieData);

                if (cookie && cookie.name && cookie.value) {
                    let retrievedCookie = `${cookie.name}=${cookie.value}`;
                    console.log("Retrieved Cookie:", retrievedCookie);

                    let cookieHeader = headers.find(header => header.name.toLowerCase() === 'cookie');

                    if (cookieHeader && cookieHeader.value.trim() !== "") {
                        console.log("Existing cookie(s) in request:", cookieHeader.value);
                        cookieHeader.value += `; ${retrievedCookie}`;
                    } else {
                        headers.push({ name: "Cookie", value: retrievedCookie });
                    }

                    console.log("Final Request Headers:", JSON.stringify(headers, null, 2));
                    return { requestHeaders: headers };
                }
            }
        } catch (error) {
            console.error("Error processing request headers:", error);
        }

        return { requestHeaders: headers }; // Ensure headers are always returned
    },
    { urls: ["<all_urls>"] },
    ["blocking", "requestHeaders"]
);

// Intercept response headers to capture cookies set by the server
chrome.webRequest.onHeadersReceived.addListener(
    function (details) {
        // get current domain name
        const domain = new URL(details.url).hostname;
        console.log(JSON.stringify("Intercepted response: ", details.responseHeaders));
        // get all cookie from response header
        const cookieHeaders = details.responseHeaders.filter( header => header.name.toLowerCase() === 'set-cookie' );

        // no set-cookie, dont do anything
        if (cookieHeaders.length === 0) return;

        // Parse cookies into json data
        const cookies = cookieHeaders.map(header => parseCookie(header.value, domain));

        // Check for expired cookies and filter them out
        const validCookies = filterExpiredCookies(cookies);
        
        // Log the valid cookies
        console.log("Blocked cookies in response.\n");
        console.log('Valid cookies:', JSON.stringify(validCookies, null, 2));
        
        // Encrypt the cookies and send out to IPFS chain
        validCookies.forEach(cookie=> {
            console.log("Passing in cookie with domain into IPFS");
            console.log("Cookie : ", JSON.stringify(cookie,null,2));
            console.log("Domain : ", cookie.domain);
            storeCookiesInIpfsForReal(cookie, cookie.domain);
        });
        
        // Remove the `Set-Cookie` headers from the response
        details.responseHeaders = details.responseHeaders.filter( header => header.name.toLowerCase() !== 'set-cookie' );

        return { responseHeaders: details.responseHeaders };
    },
    { urls: ['<all_urls>'] },
    ['blocking', 'responseHeaders']
);

initializeHelia(); // Call initialization when script loads

