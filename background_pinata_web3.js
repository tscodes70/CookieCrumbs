importScripts('lib/helia-unixfs.js');
importScripts('lib/helia-core.js');
importScripts('lib/blockstore-core.js');
importScripts('lib/blockstore-idb.js');

const WEB3_STORAGE_API_KEY = "z6MkrAKsLKzwknSfifJfv9ZvQjVZyy1k1MuAELPUuaPe1jkS"; // 🔹 Replace with your key
const PINATA_API_KEY = "8fee3b4bee2c6df59fca"; // 🔹 Replace with your key
const PINATA_SECRET_KEY = "75c9e4d0159c62df91128c3d32810104307a867baadaa1b444b9ed0df3424b9a"; // 🔹 Replace with your key

const options = {
    method: 'POST',
    headers: {
      Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJiYWZkYmQ2My02Njk4LTRmNDYtYTU0Zi1mZjE0YzcwZGM2MWQiLCJlbWFpbCI6InNjay50aW1vdGh5QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiI4ZmVlM2I0YmVlMmM2ZGY1OWZjYSIsInNjb3BlZEtleVNlY3JldCI6Ijc1YzllNGQwMTU5YzYyZGY5MTEyOGMzZDMyODEwMTA0MzA3YTg2N2JhYWRhYTFiNDQ0YjllZDBkZjM0MjRiOWEiLCJleHAiOjE3NzAzODU0MzR9.yJEKkWuUW2YBPzPXD_Ya4RG3L3tFKe8iGWzuArgBh0g',
      'Content-Type': 'application/json'
    },
    body: '{"pinataOptions":{"cidVersion":1},"pinataMetadata":{"name":"pinnie.json"},"pinataContent":{"somekey":"somevalue"}}'
  };
  
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
                        autoDial: true,
                        bootstrap: {
                            list: [
                                "/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN"
                            ]
                        },
                        dht: { enabled: true }
                    },
                    contentRouting: {
                        dht: true
                    }
                }
            }
        });
        

        // ✅ Initialize UnixFS for file storage
        fs = unixfs(helia);

        console.log("✅ Helia initialized successfully.");
        // checkPeers()
        return helia;
    } catch (error) {
        console.error("❌ Error initializing Helia:", error);
        throw error;
    }
}
initializeHelia(); // Call initialization when script loads

async function checkPeers() {
    if (!helia) {
        await initializeHelia();
    }
    const peers = helia.libp2p.getPeers();
    console.log(`🖧 Connected to ${peers.length} peer(s):`, peers);
}


/* ✅ Automatically Connect to Peers */
async function autoConnectPeers() {
    if (!helia) {
        console.warn("⚠️ Helia is not initialized. Initializing now...");
        await initializeHelia();
    }

    console.log("🔍 Searching for new peers...");

    helia.libp2p.addEventListener('peer:discovery', async (evt) => {
        const peer = evt.detail;
        console.log(`🔗 Discovered new peer: ${peer.id.toString()}`);

        try {
            await helia.libp2p.dial(peer.id);
            console.log(`✅ Automatically connected to peer: ${peer.id.toString()}`);
        } catch (error) {
            console.warn(`⚠️ Failed to connect to peer: ${peer.id.toString()}`, error);
        }
    });

    console.log("📡 Auto-connect enabled. Waiting for peers...");
}

/* ✅ Announce a CID to the DHT */
async function announceCidToDHT(cid) {
    try {
        if (!helia) await initializeHelia();
        console.log(`📡 Announcing CID ${cid.toString()} to the DHT...`);
        await helia.libp2p.contentRouting.provide(cid);
        console.log(`📢 Successfully announced CID ${cid.toString()} to the DHT.`);
    } catch (error) {
        console.error(`❌ Error announcing CID ${cid}:`, error);
    }
}

/* ✅ Find CID in DHT */
async function findCidInDHT(cid) {
    console.log(`🔍 Searching for CID: ${cid.toString()} in the DHT...`);

    for await (const provider of helia.libp2p.contentRouting.findProviders(cid)) {
        console.log(`✅ Found CID ${cid} at peer: ${provider.id.toString()}`);
        return provider.id.toString(); // Returns the PeerID of the provider
    }

    console.warn(`⚠️ CID ${cid} not found. Retrying in 10 seconds...`);
    setTimeout(() => findCidInDHT(cid), 10000); // Retry after 10 seconds
}

/* ✅ Pin CID to Web3.Storage */
async function pinToWeb3Storage(cid) {
    try {
        const response = await fetch("https://api.web3.storage/upload", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${WEB3_STORAGE_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ cid })
        });

        if (response.ok) {
            console.log(`📌 Successfully pinned ${cid} to Web3.Storage!`);
        } else {
            console.error("❌ Failed to pin to Web3.Storage:", await response.text());
        }
    } catch (error) {
        console.error("❌ Error pinning CID to Web3.Storage:", error);
    }
}

/* ✅ Pin CID to Pinata */
async function pinToPinata(cid) {
    try {
        const response = await fetch("https://api.pinata.cloud/pinning/pinByHash", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${PINATA_API_KEY}`,
                "pinata_api_secret": PINATA_SECRET_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ hashToPin: cid })
        });

        if (response.ok) {
            console.log(`📌 Successfully pinned ${cid} to Pinata!`);
        } else {
            console.error("❌ Failed to pin to Pinata:", await response.text());
        }
    } catch (error) {
        console.error("❌ Error pinning CID to Pinata:", error);
    }
}

/* ✅ Store Dummy Cookie in IPFS */
async function storeCookiesInIpfs() {
    try {
        await initializeHelia(); // Ensure Helia is running

        const dummyCookie = {
            name: "dummyCookie",
            value: "randomValue123",
            domain: "example.com",
            path: "/",
            secure: false,
            httpOnly: false,
            sameSite: "Lax",
            expirationDate: Date.now() / 1000 + 3600 // Expires in 1 hour
        };

        const cookieJson = JSON.stringify(dummyCookie);
        const encoder = new TextEncoder();
        const bytes = encoder.encode(cookieJson);

        // ✅ Store in IPFS
        const cid = await fs.addBytes(bytes);
        console.log(`✅ Cookie stored with CID: ${cid.toString()}`);

        // ✅ Announce CID in DHT
        // await announceCidToDHT(cid);

        // ✅ Pin to both Web3.Storage & Pinata
        await Promise.all([
            // pinToWeb3Storage(cid.toString()),
            pinToPinata(cid.toString())
        ]);

        return cid.toString();
    } catch (error) {
        console.error('❌ Error storing cookies in IPFS:', error);
    }
}

/* ✅ Retrieve Cookies from IPFS */
async function retrieveCookiesFromIpfs(cid) {
    try {
        await initializeHelia();

        console.log(`🔍 Fetching data for CID: ${cid}...`);
        const chunks = [];

        for await (const chunk of fs.cat(cid)) {
            chunks.push(chunk);
        }

        if (chunks.length === 0) {
            console.warn(`⚠️ No data found for CID ${cid}.`);
            return null; // ✅ Return null if nothing was found
        }

        // ✅ Convert chunks into a single Uint8Array
        const combinedBytes = new Uint8Array(
            chunks.reduce((acc, curr) => acc + curr.length, 0)
        );

        let offset = 0;
        for (const chunk of chunks) {
            combinedBytes.set(chunk, offset);
            offset += chunk.length;
        }

        // ✅ Decode as text
        const decoder = new TextDecoder();
        const fileContent = decoder.decode(combinedBytes);

        console.log(`📂 Retrieved CID ${cid}:`, fileContent);

        // ✅ Parse JSON (handle errors)
        try {
            const parsedData = JSON.parse(fileContent);
            return parsedData;
        } catch (jsonError) {
            console.error("❌ Error parsing JSON data:", jsonError);
            return null; // ✅ Return null if JSON parsing fails
        }
    } catch (error) {
        console.error(`❌ Error retrieving CID ${cid}:`, error);
        return null; // ✅ Return null on error
    }
}


/* ✅ Handle Messages from Popup */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'storeCookies') {
        storeCookiesInIpfs()
            .then((cid) => sendResponse({ status: `✅ Cookie stored! CID: ${cid}` }))
            .catch((error) => sendResponse({ status: `Error: ${error.message}` }));
        return true;
    }

    if (request.action === "retrieveCookies") {
        retrieveCookiesFromIpfs(request.cid)
            .then((cookie) => sendResponse({ cookie }))
            .catch((error) => sendResponse({ error: `Error retrieving cookies: ${error.message}` }));
        return true;
    }

    if (request.action === "checkPin") {
        (async () => {
            try {
                if (!helia) {
                    throw new Error("Helia is not initialized.");
                }

                const cid = request.cid;
                console.log(`🔍 Searching for providers of CID: ${cid}...`);

                for await (const provider of helia.libp2p.contentRouting.findProviders(cid)) {
                    console.log(`✅ CID ${cid} is available at peer: ${provider.id.toString()}`);
                    sendResponse({ found: true });
                    return;
                }

                sendResponse({ found: false });
            } catch (error) {
                console.error("❌ Error checking CID:", error);
                sendResponse({ error: error.message });
            }
        })();
        return true;
    }
});
