document.addEventListener("DOMContentLoaded", function () {
    // ✅ Store Dummy Cookie in IPFS
    document.getElementById("storeCookies").addEventListener("click", async () => {
        chrome.runtime.sendMessage({ action: "storeCookies" }, (response) => {
            alert(response.status || response.error);
        });
    });

    // ✅ Retrieve Cookie from IPFS
    document.getElementById("retrieveCookies").addEventListener("click", async () => {
        const cid = document.getElementById("cidInput").value.trim();
        if (!cid) {
            alert("⚠️ Please enter a valid CID.");
            return;
        }

        chrome.runtime.sendMessage({ action: "retrieveCookies", cid }, (response) => {
            const output = document.getElementById("cookieOutput");

            if (response.error) {
                output.innerText = `❌ Error: ${response.error}`;
                return;
            }

            if (!response.cookie) {
                output.innerText = `⚠️ No cookie data found for CID: ${cid}`;
                return;
            }

            // ✅ Ensure data is an object
            let cookieData;
            if (typeof response.cookie === "string") {
                try {
                    cookieData = JSON.parse(response.cookie);
                } catch (parseError) {
                    console.error("❌ Error parsing cookie data:", parseError);
                    output.innerText = `❌ Error displaying cookie data.`;
                    return;
                }
            } else {
                cookieData = response.cookie;
            }

            // ✅ Generate Dynamic Table for Any Cookie Data
            let tableHtml = `<strong>🍪 Retrieved Cookie Data:</strong><br><table border="1" cellpadding="5">`;
            for (const [key, value] of Object.entries(cookieData)) {
                tableHtml += `<tr><td><strong>${key}:</strong></td><td>${value}</td></tr>`;
            }
            tableHtml += `</table>`;

            output.innerHTML = tableHtml;
        });
    });

    // ✅ Check If CID is Pinned
    document.getElementById("checkPin").addEventListener("click", async () => {
        const cid = document.getElementById("pinCidInput").value.trim();
        if (!cid) {
            alert("⚠️ Please enter a CID.");
            return;
        }

        chrome.runtime.sendMessage({ action: "checkPin", cid }, (response) => {
            document.getElementById("pinCheckOutput").innerText = response.found
                ? `✅ CID ${cid} is pinned.`
                : `⚠️ CID ${cid} is NOT pinned.`;
        });
    });

    // ✅ Check Active Peers
    document.getElementById("checkPeers").addEventListener("click", async () => {
        chrome.runtime.sendMessage({ action: "checkPeers" }, (response) => {
            document.getElementById("peerStatus").innerText = response.peers
                ? `🖧 Connected to ${response.peers} peer(s).`
                : "⚠️ No peers found.";
        });
    });

    // ✅ Find CID in DHT
    document.getElementById("findCidDHT").addEventListener("click", async () => {
        const cid = document.getElementById("dhtCidInput").value.trim();
        if (!cid) {
            alert("⚠️ Please enter a CID.");
            return;
        }

        chrome.runtime.sendMessage({ action: "findCidDHT", cid }, (response) => {
            document.getElementById("dhtStatus").innerText = response.found
                ? `✅ Found CID ${cid} at peer: ${response.peer}`
                : `⚠️ CID ${cid} not found in DHT.`;
        });
    });
});
