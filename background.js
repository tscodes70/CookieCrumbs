importScripts('lib/helia-unixfs.js');
importScripts('lib/helia-core.js');
importScripts('lib/blockstore-core.js');
importScripts('lib/blockstore-idb.js');

// Access Helia's components globally
const { createHelia } = Helia; // From helia-core.js
const { unixfs } = HeliaUnixfs; // From helia-unixfs.js
const { IDBBlockstore } = BlockstoreIdb; // From blockstore-idb.js

let helia, fs; // Global variables for Helia and UnixFS

/* ✅ Initialize Helia with DHT and UnixFS support */
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
initializeHelia(); // Call initialization when script loads


/* ✅ Store Dummy Cookie in IPFS */
async function storeCookiesInIpfs() {
    try {
        await initializeHelia();

        const dummyCookie = {
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

        const cookieJson = JSON.stringify(dummyCookie);
        const encoder = new TextEncoder();
        const bytes = encoder.encode(cookieJson);

        // ✅ Split Data into 64B Chunks
        let chunkSize = 64;
        let chunkCIDs = [];

        for (let i = 0; i < bytes.length; i += chunkSize) {
            let chunk = bytes.slice(i, i + chunkSize);
            let cid = await fs.addBytes(chunk);
            chunkCIDs.push(cid.toString());
        }

        console.log(`✅ Stored ${chunkCIDs.length} chunks.`);

        // ✅ Create Manifest
        const manifest = {
            fileName: "cookies.json",
            totalChunks: chunkCIDs.length,
            chunkCIDs
        };

        const manifestBytes = encoder.encode(JSON.stringify(manifest));
        const manifestCID = await fs.addBytes(manifestBytes);

        console.log(`📜 Manifest stored with CID: ${manifestCID.toString()}`);
        return manifestCID.toString();
    } catch (error) {
        console.error('❌ Error storing cookies in IPFS:', error);
    }
}


/* ✅ Retrieve Manifest File */
async function retrieveManifest(manifestCID) {
    try {
        // Initialize Helia and fs
        await initializeHelia();

        console.log(`📥 Fetching Manifest CID: ${manifestCID}...`);
        let chunks = [];

        // Fetch all chunks for the manifest
        for await (const chunk of fs.cat(manifestCID)) {
            chunks.push(chunk);
            console.log(`📥 Retrieved Chunk: Size ${chunk.length} bytes`);
        }

        // If no chunks are retrieved, throw an error
        if (chunks.length === 0) {
            throw new Error(`Manifest CID ${manifestCID} not found or empty.`);
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
        const manifestContent = decoder.decode(mergedChunks);

        console.log(`📂 Retrieved Manifest Data: ${manifestContent}`); // Log the full content (or a part of it)

        // Try to parse the JSON content
        try {
            const parsedData = JSON.parse(manifestContent);
            return parsedData;
        } catch (jsonError) {
            console.error("❌ Error parsing JSON data:", jsonError);
            return null;
        }
    } catch (error) {
        console.error("❌ Error retrieving manifest:", error);
        return null;
    }
}



/* ✅ Retrieve Cookies from IPFS using the CIDs */
async function retrieveCookiesFromIpfs(cids) {
    try {
        // Ensure Helia and fs are initialized
        if (!helia) await initializeHelia();

        // Check if CIDs are provided
        if (cids.length === 0) {
            console.warn("⚠️ No chunks found in manifest.");
            return null;
        }

        console.log(`🔍 Fetching ${cids.length} chunks from IPFS...`);

        let combinedBytes = [];

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




async function listFileChunksFromUnixFS(manifestCID) {
    if (!fs) await initializeHelia();

    console.log(`📂 Listing chunks for CID: ${manifestCID}...`);

    let chunks = [];
    let totalSize = 0;

    try {
        // Ensure manifestCID is valid and has a value
        if (!manifestCID) {
            throw new Error("Manifest CID is invalid or empty.");
        }

        // Fetch the data associated with the CID
        let data = [];
        for await (const chunk of fs.cat(manifestCID)) {
            data.push(chunk);
        }

        if (data.length === 0) {
            console.warn(`⚠️ No data found for CID ${manifestCID}.`);
            return { cid: manifestCID, totalSize: 0, chunks: [] };
        }

        // Flatten the data array (if it's an array of Uint8Arrays)
        data = Uint8Array.from(data.flat());
        console.log(`✅ Data retrieved for CID ${manifestCID}, Size: ${data.length} bytes`);

        // Manually split data into chunks of 64 bytes
        const chunkSize = 64;
        for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);  // Slice the data into 64-byte chunks
            chunks.push({
                size: chunk.length,
                data: new TextDecoder().decode(chunk).slice(0, 50) + "..." // Preview the first 50 characters
            });
            totalSize += chunk.length;
        }

        if (chunks.length === 0) {
            console.warn(`⚠️ No chunks found for CID ${manifestCID}.`);
            return { cid: manifestCID, totalSize: 0, chunks: [] };
        }

        console.log(`✅ Retrieved ${chunks.length} chunks, Total Size: ${totalSize} bytes.`);
        return { cid: manifestCID, totalSize, chunks };
    } catch (error) {
        // Log detailed error information
        console.error(`❌ Error retrieving chunks for CID ${manifestCID}:`, error);
        return { cid: manifestCID, totalSize: 0, chunks: [], error: error.message };
    }
}



/* ✅ Handle Messages from Popup */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "storeCookies") {
        storeCookiesInIpfs()
            .then((manifestCID) => sendResponse({ manifestCID }))
            .catch((error) => sendResponse({ error: `Error: ${error.message}` }));
        return true; // Keep async response open
    }

    if (request.action === "retrieveManifest") {
        retrieveManifest(request.manifestCid)
            .then((manifest) => {
                if (!manifest || !manifest.chunkCIDs || manifest.chunkCIDs.length === 0) {
                    throw new Error("Invalid or empty manifest.");
                }
                return retrieveCookiesFromIpfs(manifest.chunkCIDs).then((cookie) => ({
                    cookie,
                    manifest
                }));
            })
            .then((responseData) => sendResponse(responseData))
            .catch((error) => sendResponse({ error: `Error retrieving cookies: ${error.message}` }));

        return true; // Keep async response open
    }

    if (request.action === "listFileChunks") {
        listFileChunksFromUnixFS(request.manifestCid)
            .then((fileInfo) => sendResponse({ fileInfo }))
            .catch((error) => sendResponse({ error: `Error listing chunks: ${error.message}` }));

        return true; // Keep async response open
    }
});

