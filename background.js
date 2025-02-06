importScripts('lib/helia-unixfs.js');
importScripts('lib/helia-core.js');
importScripts('lib/blockstore-core.js');
importScripts('lib/blockstore-idb.js');

// Access Helia's components globally
const { createHelia } = Helia; // From helia-core.js
const { unixfs } = HeliaUnixfs; // From helia-unixfs.js
// const { MemoryBlockstore } = BlockstoreCore; // From blockstore-core.js
const { IDBBlockstore } = BlockstoreIdb; // From blockstore-idb.js

let helia, fs;

// (async () => {
//     try {
//         // Initialize a MemoryBlockstore
//         // const blockstore = new MemoryBlockstore();
//         const blockstore = new IDBBlockstore('ipfs-cookie-storage');
//         await blockstore.open();

//         // temp public bootstrap list
//         let bootstrapConfig = {
//             list: [
//             '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN'
//             // '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
//             // '/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt'
//             ]
//         }

//         // Initialize Helia
//         // helia = await createHelia({ blockstore });

//         // Initialize Helia with libp2p settings
//         helia = await createHelia({
//             blockstore,
//             libp2p: {
//                 config: {
//                     peerDiscovery: {
//                         bootstrap: {
//                             list: bootstrapConfig.list
//                         }
//                     }
//                 }
//             }
//         });

//         // Initialize UnixFS
//         fs = unixfs(helia);

//         console.log('Helia, Blockstore, and UnixFS Initialized');
//     } catch (error) {
//         console.error('Error initializing Helia:', error);
//     }
// })();

async function initializeHelia() {
    try {
        if (helia && fs) {
            console.log("Helia is already initialized.");
            return; // ✅ Avoid re-initialization if already set up
        }

        console.log("Initializing Helia and UnixFS...");

        // Use IDBBlockstore for persistent storage
        const blockstore = new IDBBlockstore("ipfs-cookie-storage");
        await blockstore.open(); // ✅ Ensure the blockstore is opened

        // Temporary public bootstrap list
        const bootstrapConfig = {
            list: [
                "/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZgBMjTezGAJN"
                // "/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb",
                // "/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt"
            ]
        };

        // Initialize Helia with libp2p settings
        helia = await createHelia({
            blockstore,
            libp2p: {
                config: {
                    peerDiscovery: {
                        bootstrap: {
                            list: bootstrapConfig.list
                        }
                    }
                }
            }
        });

        // Initialize UnixFS
        fs = unixfs(helia);

        console.log("✅ Helia, Blockstore, and UnixFS initialized successfully.");
    } catch (error) {
        console.error("❌ Error initializing Helia:", error);
    }
}

// Call initialization when script loads
initializeHelia();

// // Fetch cookies from the browser
// async function fetchCookies() {
//   return new Promise((resolve, reject) => {
//       chrome.cookies.getAll({}, (cookies) => {
//           if (chrome.runtime.lastError) {
//               return reject(chrome.runtime.lastError);
//           }
//           resolve(cookies);
//       });
//   });
// }

// Return a dummy cookie instead of fetching from the browser
async function fetchCookies() {
    return new Promise((resolve) => {
        const dummyCookies = [
            {
                name: "dummyCookie",
                value: "randomValue123",
                domain: "example.com",
                path: "/",
                secure: false,
                httpOnly: false,
                sameSite: "Lax",
                expirationDate: Date.now() / 1000 + 3600 // Expires in 1 hour
            }
        ];
        resolve(dummyCookies);
    });
}


// Store each cookie in IPFS as its own CID
async function storeCookiesInIpfs() {
    try {
        // Fetch cookies
        const cookies = await fetchCookies();
        console.log('Fetched Cookies:', cookies);
  
        const cids = []; // Array to store CIDs for individual cookies
  
        // Process each cookie
        for (const cookie of cookies) {
            // Convert the cookie to JSON
            const cookieJson = JSON.stringify(cookie);
            const encoder = new TextEncoder();
            const bytes = encoder.encode(cookieJson);
  
            // Add cookie to IPFS and store its CID
            const cid = await fs.addBytes(bytes);
            cids.push(cid.toString());
            console.log(`Cookie stored with CID: ${cid.toString()}`);
        }
  
        // Save the array of CIDs in Chrome storage
        // chrome.storage.local.set({ cookiesCids: cids }, () => {
        //     console.log('CIDs saved locally:', cids);
        // });
    } catch (error) {
        console.error('Error storing cookies in IPFS:', error);
    }
  }
  

// Retrieve cookies from IPFS using an array of CIDs
async function retrieveCookiesFromIpfs(cids) {
    try {
        await initializeHelia(); // ✅ Ensure Helia is initialized before accessing fs

        if (!Array.isArray(cids) || cids.length === 0) {
            throw new Error("CIDs must be a non-empty array.");
        }

        const cookies = []; // Array to hold retrieved cookies

        for (const cid of cids) {
            const chunks = [];
            for await (const chunk of fs.cat(cid)) { // ✅ fs is now guaranteed to be initialized
                chunks.push(chunk);
            }

            // Combine chunks into a single Uint8Array
            const combinedBytes = new Uint8Array(
                chunks.reduce((acc, curr) => acc + curr.length, 0)
            );
            let offset = 0;
            for (const chunk of chunks) {
                combinedBytes.set(chunk, offset);
                offset += chunk.length;
            }

            // Decode the cookie data
            const decoder = new TextDecoder();
            const cookieJson = decoder.decode(combinedBytes);
            const cookie = JSON.parse(cookieJson);

            // Add the retrieved cookie to the array
            cookies.push(cookie);
            console.log(`Retrieved Cookie for CID ${cid}:`, cookie);
        }

        console.log("All Retrieved Cookies:", cookies);
        return cookies; // Return the array of cookies
    } catch (error) {
        console.error("Error retrieving cookies from IPFS:", error);
        throw error; // Propagate the error to the caller
    }
}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'storeCookies') {
      storeCookiesInIpfs().then(() => {
          sendResponse({ status: 'Cookies stored in IPFS successfully' });
      }).catch((error) => {
          sendResponse({ status: `Error: ${error.message}` });
      });
      return true; // Keep the message channel open for async response
  }

  if (request.action === "retrieveCookies") {
    initializeHelia().then(() => {
        retrieveCookiesFromIpfs(request.cids)
            .then((cookies) => sendResponse({ cookies }))
            .catch((error) => sendResponse({ error: `Error retrieving cookies: ${error.message}` }));
    });

    return true; // ✅ Keep the message channel open for async response
    }

if (request.action === 'retrieveCookiesByCid') {
    if (!request.cid) {
        sendResponse({ error: 'No CID provided.' });
        return;
    }
    retrieveCookiesFromIpfs(request.cid).then((cookies) => {
        sendResponse({ cookies });
    }).catch((error) => {
        sendResponse({ error: `Error: ${error.message}` });
    });
    return true; // Keep the message channel open for async response
}
});
