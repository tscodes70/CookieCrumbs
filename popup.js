document.addEventListener("DOMContentLoaded", function () {
    // ✅ Store Dummy Cookie in IPFS
    document.getElementById("storeCookies").addEventListener("click", () => {
        chrome.runtime.sendMessage({ action: "storeCookies" }, (response) => {
            if (chrome.runtime.lastError) {
                alert("❌ Error: " + chrome.runtime.lastError.message);
                return;
            }

            if (response.error) {
                alert("❌ Error: " + response.error);
                return;
            }

            alert(`✅ Cookie stored! Manifest CID: ${response.manifestCID}`);
        });
    });

    // ✅ Retrieve Manifest Data
    document.getElementById("retrieveCookies").addEventListener("click", () => {
        const domainName = document.getElementById("domainNameDataInput").value.trim();
        if (!domainName) {
            alert("⚠️ Please enter a valid Domain Name.");
            return;
        }

        chrome.runtime.sendMessage({ action: "retrieveCookies", domainName: domainName }, (response) => {
            const output = document.getElementById("cookieDataOutput");

            if (response.error) {
                output.innerText = `❌ Error: ${response.error}`;
                return;
            }

            if (!response) {
                output.innerText = `⚠️ No data found for domain name: ${domainName}`;
                return;
            }

            // ✅ Display the Data (name, value, domain, etc.) as a table
            let tableHtml = `<strong>📂 Retrieved Data:</strong><br><table border="1" cellpadding="5" style="width: 100%; table-layout: fixed;">`;

            // Iterate over the keys and values of the response object
            for (const [key, value] of Object.entries(response)) {
                if (typeof value === 'object' && !Array.isArray(value)) {
                    // If the value is an object (like 'metadata'), we need to display it as a nested table
                    tableHtml += `<tr><td style="width: 30%;"><strong>${key}:</strong></td><td><table border="1" cellpadding="5" style="width: 100%; table-layout: fixed;">`;
                    for (const [subKey, subValue] of Object.entries(value)) {
                        tableHtml += `<tr><td style="width: 40%;"><strong>${subKey}:</strong></td><td>${subValue}</td></tr>`;
                    }
                    tableHtml += `</table></td></tr>`;
                } else if (Array.isArray(value)) {
                    // If the value is an array (like 'chunkCIDs'), we display it as a list
                    tableHtml += `<tr><td style="width: 30%;"><strong>${key}:</strong></td><td><ul style="padding-left: 20px;">`;
                    value.forEach(item => {
                        tableHtml += `<li>${item}</li>`; // Display each CID on a new line
                    });
                    tableHtml += `</ul></td></tr>`;
                } else {
                    // Otherwise, display the key-value pair directly
                    tableHtml += `<tr><td style="width: 30%;"><strong>${key}:</strong></td><td>${value}</td></tr>`;
                }
            }
            tableHtml += `</table>`;

            output.innerHTML = tableHtml;
        });
    });




    // ✅ List Chunks (Retrieve Chunks)
    document.getElementById("listChunks").addEventListener("click", () => {
        const manifestCid = document.getElementById("manifestCidInput").value.trim();

        if (!manifestCid) {
            alert("⚠️ Please enter a valid Manifest CID.");
            return;
        }

        chrome.runtime.sendMessage({ action: "listFileChunks", manifestCid: manifestCid }, (response) => {
            const output = document.getElementById("chunkOutput");

            if (response.error) {
                output.innerText = `❌ Error: ${response.error}`;
                return;
            }

            const fileInfo = response.fileInfo;

            // Ensure we are displaying 5 chunks with 64 bytes each, if applicable
            let chunkTableHtml = `<strong>📂 Retrieved Chunks:</strong><br><table border="1" cellpadding="5">`;
            chunkTableHtml += `<tr><th>Chunk #</th><th>Size (bytes)</th><th>Preview</th></tr>`;

            // Dynamically create a row for each chunk
            fileInfo.chunks.forEach((chunk, index) => {
                chunkTableHtml += `<tr>
                    <td>${index + 1}</td>
                    <td>${chunk.size}</td>
                    <td>${chunk.data}</td>
                </tr>`;
            });

            chunkTableHtml += `</table>`;
            output.innerHTML = chunkTableHtml;
        });
    });
});
