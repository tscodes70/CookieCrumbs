document.addEventListener("DOMContentLoaded", function () {
    // ✅ Store Dummy Cookie in IPFS
    // document.getElementById("storeCookies").addEventListener("click", () => {
    //     chrome.runtime.sendMessage({ action: "storeCookies" }, (response) => {
    //         if (chrome.runtime.lastError) {
    //             alert("❌ Error: " + chrome.runtime.lastError.message);
    //             return;
    //         }

    //         if (response.error) {
    //             alert("❌ Error: " + response.error);
    //             return;
    //         }

    //         alert(`✅ Cookie stored for ${response.domainName}!`);
    //     });
    // });

    // ✅ Retrieve Cookie Data
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
            let tableHtml = `<strong>📂 Retrieved Data:</strong><br><table border="1" cellpadding="5" style="width: 100%; table-layout: fixed; border-collapse: collapse;">`;
    
            // Iterate over the keys and values of the response object
            for (const [key, value] of Object.entries(response)) {
                if (typeof value === 'object' && !Array.isArray(value)) {
                    // If the value is an object, display it as a nested table
                    tableHtml += `<tr><td style="width: 10%;"><strong>${key}:</strong></td><td><table border="1" cellpadding="5" style="width: 100%; table-layout: fixed;">`;
    
                    // Iterate over the subkeys
                    for (const [subKey, subValue] of Object.entries(value)) {
                        if (typeof subValue === 'object' && !Array.isArray(subValue)) {
                            // If the subValue is an object, display it as a nested table
                            tableHtml += `<tr><td style="width: 20%;"><strong>${subKey}:</strong></td><td><table border="1" cellpadding="5" style="width: 100%; table-layout: fixed;">`;
    
                            // // If it's still an object, iterate again (deep nested)
                            // for (const [deepSubKey, deepSubValue] of Object.entries(subValue)) {
                            //     tableHtml += `<tr><td style="width: 20%;"><strong>${deepSubKey}:</strong></td><td>${deepSubValue}</td></tr>`;
                            // }
    
                            // tableHtml += `</table></td></tr>`;
                        } else {
                            // If it's not an object, display it directly
                            tableHtml += `<tr><td style="width: 40%;"><strong>${subKey}:</strong></td><td>${subValue}</td></tr>`;
                        }
                    }
                    tableHtml += `</table></td></tr>`;
                } else if (key == "cookieData") {
                    // If cookieData is a string, parse it
                    try {
                        const cookieDataObject = JSON.parse(value);
                        tableHtml += `<tr><td style="width: 10%;"><strong>${key}:</strong></td><td><table border="1" cellpadding="5" style="width: 100%; table-layout: fixed;">`;
            
                        // Display totalChunks
                        tableHtml += `<tr><td style="width: 20%;"><strong>Total Chunks:</strong></td><td>${cookieDataObject.totalChunks}</td></tr>`;
            
                        // Display chunkCIDs as a list
                        tableHtml += `<tr><td style="width: 20%;"><strong>Chunk CIDs:</strong></td><td><ul style="padding-left: 20px;">`;
                        cookieDataObject.chunkCIDs.forEach(cid => {
                            tableHtml += `<li>${cid}</li>`;
                        });
                        tableHtml += `</ul></td></tr>`;
            
                        tableHtml += `</table></td></tr>`;
                    } catch (e) {
                        tableHtml += `<tr><td style="width: 30%;"><strong>Cookie Data (Parsing Error):</strong></td><td>${value}</td></tr>`;
                    }
                } else {
                    // Otherwise, display the key-value pair directly
                    tableHtml += `<tr><td style="width: 30%;"><strong>${key}:</strong></td><td>${value}</td></tr>`;
                }
            }
    
            tableHtml += `</table>`;
    
            output.innerHTML = tableHtml;
        });
    });
      
});
