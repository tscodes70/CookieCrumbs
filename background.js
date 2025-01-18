importScripts('lib/helia-unixfs.js');
importScripts('lib/helia-core.js');
importScripts('lib/blockstore-core.js');

// Access Helia's components globally
const { createHelia } = Helia; // From helia-core.js
const { unixfs } = HeliaUnixfs; // From helia-unixfs.js
const { MemoryBlockstore } = BlockstoreCore; // From blockstore-core.js

let helia, fs;

(async () => {
    try {
        // Initialize a MemoryBlockstore
        const blockstore = new MemoryBlockstore();

        // Initialize Helia
        helia = await createHelia({ blockstore });

        // Initialize UnixFS
        fs = unixfs(helia);

        console.log('Helia, Blockstore, and UnixFS Initialized');
    } catch (error) {
        console.error('Error initializing Helia:', error);
    }
})();

// Fetch cookies from the browser
async function fetchCookies() {
  return new Promise((resolve, reject) => {
      chrome.cookies.getAll({}, (cookies) => {
          if (chrome.runtime.lastError) {
              return reject(chrome.runtime.lastError);
          }
          resolve(cookies);
      });
  });
}

// Store cookies in IPFS using UnixFS
async function storeCookiesInIpfs() {
  try {
      // Fetch cookies
      const cookies = await fetchCookies();
      console.log('Fetched Cookies:', cookies);

      // Convert cookies to JSON
      const cookiesJson = JSON.stringify(cookies, null, 2);

      // Add cookies to IPFS
      const encoder = new TextEncoder();
      const bytes = encoder.encode(cookiesJson);
      const cid = await fs.addBytes(bytes);

      console.log('Cookies stored in IPFS with CID:', cid.toString());

      // Save CID in Chrome storage
      chrome.storage.local.set({ cookiesCid: cid.toString() }, () => {
          console.log('CID saved locally:', cid.toString());
      });
  } catch (error) {
      console.error('Error storing cookies in IPFS:', error);
  }
}

async function retrieveCookiesFromIpfs(cidString) {
  try {
      // Create an empty array to collect chunks of data
      const chunks = [];

      // Use `fs.cat` to retrieve the data as a stream
      for await (const chunk of fs.cat(cidString)) {
          chunks.push(chunk);
      }

      // Combine all chunks into a single Uint8Array
      const combinedBytes = new Uint8Array(chunks.reduce((acc, curr) => acc + curr.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
          combinedBytes.set(chunk, offset);
          offset += chunk.length;
      }

      // Decode the combined bytes into a JSON string
      const decoder = new TextDecoder();
      const cookiesJson = decoder.decode(combinedBytes);

      // Parse the JSON string into an object
      const cookies = JSON.parse(cookiesJson);
      console.log('Retrieved Cookies:', cookies);

      return cookies;
  } catch (error) {
      console.error('Error retrieving cookies from IPFS:', error);
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

  if (request.action === 'retrieveCookies') {
      chrome.storage.local.get('cookiesCid', async (result) => {
          if (result.cookiesCid) {
              const cookies = await retrieveCookiesFromIpfs(result.cookiesCid);
              sendResponse({ cookies });
          } else {
              sendResponse({ error: 'No CID found' });
          }
      });
      return true; // Keep the message channel open for async response
  }
});
