async function generateKeyPair() {
    const keyPair = await crypto.subtle.generateKey(
        {
            name: 'RSA-OAEP',
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256',
        },
        true,
        ['encrypt', 'decrypt']
    );
    return keyPair;
}

let rsaKeyPair;

(async () => {
    rsaKeyPair = await generateKeyPair();
    console.log('RSA Key Pair Generated');
})();

// Generate a symmetric AES-GCM key
async function generateSymmetricKey() {
    return await crypto.subtle.generateKey(
        {
            name: 'AES-GCM',
            length: 256,
        },
        true,
        ['encrypt', 'decrypt']
    );
}

// Encrypt data using AES-GCM
async function encryptWithSymmetricKey(data, key) {
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV

    const cipher = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encodedData
    );

    return { cipher, iv };
}

// Decrypt data using AES-GCM
async function decryptWithSymmetricKey(cipher, iv, key) {
    const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        cipher
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
}

// Encrypt AES symmetric key using RSA public key
async function encryptSymmetricKey(symmetricKey, publicKey) {
    const exportedKey = await crypto.subtle.exportKey('raw', symmetricKey);
    return await crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        publicKey,
        exportedKey
    );
}

// Decrypt AES symmetric key using RSA private key
async function decryptSymmetricKey(encryptedKey, privateKey) {
    const decryptedKey = await crypto.subtle.decrypt(
        { name: 'RSA-OAEP' },
        privateKey,
        encryptedKey
    );

    return await crypto.subtle.importKey(
        'raw',
        decryptedKey,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
    );
}

async function storeCookiesInIpfs() {
    try {
        const cookies = await fetchCookies();
        const cookiesJson = JSON.stringify(cookies, null, 2);

        // Step 1: Generate a symmetric AES-GCM key
        const symmetricKey = await generateSymmetricKey();

        // Step 2: Encrypt cookies using the symmetric key
        const { cipher, iv } = await encryptWithSymmetricKey(cookiesJson, symmetricKey);

        // Step 3: Encrypt the symmetric key using the RSA public key
        const encryptedSymmetricKey = await encryptSymmetricKey(symmetricKey, rsaKeyPair.publicKey);

        // Combine IV, encrypted symmetric key, and encrypted cookies
        const combinedData = new Uint8Array([
            ...iv,
            ...new Uint8Array(encryptedSymmetricKey),
            ...new Uint8Array(cipher),
        ]);

        // Step 4: Add combined data to IPFS
        const cid = await fs.addBytes(combinedData);
        console.log('Encrypted cookies stored in IPFS with CID:', cid.toString());

        // Store CID locally
        chrome.storage.local.set({ cookiesCid: cid.toString() }, () => {
            console.log('CID saved locally:', cid.toString());
        });
    } catch (error) {
        console.error('Error storing cookies in IPFS:', error);
    }
}

async function retrieveCookiesFromIpfs(cidString) {
    try {
        const chunks = [];
        for await (const chunk of fs.cat(cidString)) {
            chunks.push(chunk);
        }

        const combinedData = new Uint8Array(chunks.reduce((acc, curr) => acc + curr.length, 0));
        let offset = 0;

        for (const chunk of chunks) {
            combinedData.set(chunk, offset);
            offset += chunk.length;
        }

        // Split IV, encrypted symmetric key, and ciphertext
        const iv = combinedData.slice(0, 12); // First 12 bytes are IV
        const encryptedSymmetricKey = combinedData.slice(12, 268); // Next 256 bytes (RSA-2048 encrypted key)
        const cipher = combinedData.slice(268); // Remaining bytes are the ciphertext

        // Step 1: Decrypt the symmetric key using the RSA private key
        const symmetricKey = await decryptSymmetricKey(encryptedSymmetricKey, rsaKeyPair.privateKey);

        // Step 2: Decrypt the cookies using the symmetric key
        const decryptedData = await decryptWithSymmetricKey(cipher, iv, symmetricKey);
        const cookies = JSON.parse(decryptedData);

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
        return true;
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
        return true;
    }
});
