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

    // ✅ Import Cookie Data (Sends File Data to Background Script)
    document.getElementById("importButton").addEventListener("click", function() {
        const jsonText = document.getElementById("jsonInput").value.trim();
        if (!jsonText) {
            alert("⚠️ Please paste JSON data before importing.");
            return;
        }

        try {
            const jsonData = JSON.parse(jsonText); // Validate JSON format
            console.log("📂 Loaded JSON Data:", jsonData);

            // ✅ Send JSON data to background.js
            chrome.runtime.sendMessage({ action: "importCookies", data: jsonData }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("❌ Import Error:", chrome.runtime.lastError.message);
                    return;
                }
                if (response?.success) {
                    alert("✅ Import completed successfully!");
                } else {
                    alert(`❌ Import failed: ${response?.error}`);
                }
            });

        } catch (error) {
            console.error("❌ Failed to parse JSON:", error);
            alert("❌ Invalid JSON format. Please check your data.");
        }
    });
    

    // ✅ Export Cookie Data (Triggers Background.js Export)
    document.getElementById("exportButton").addEventListener("click", function() {
        chrome.runtime.sendMessage({ action: "exportCookies" }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("❌ Export Error:", chrome.runtime.lastError.message);
                return;
            }
    
            console.log("📥 Received Export Response:", response); // Debugging log
    
            // ✅ Ensure response contains valid data
            if (response.success === false) {
                console.warn("⚠️ No valid data received for export.");
                alert("⚠️ No data found for export.");
                return;
            }
            
            if (response.success === true){
                // ✅ Download JSON if valid data exists
                // const jsonData = JSON.stringify(response.data, null, 4);
                // const blob = new Blob([jsonData], { type: "application/json" });
                // const a = document.createElement("a");
                // a.href = URL.createObjectURL(blob);
                // a.download = "exported_cookies.json";
                // document.body.appendChild(a);
                // a.click();
                // document.body.removeChild(a);
        
                alert("✅ Data exported successfully!");
            }
        });
    });
    
    
    

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






        // ✅ Save Cookie Rules to Chrome Storage
        document.getElementById("saveRules").addEventListener("click", function() {
            const rulesText = document.getElementById("rulesInput").value.trim();
            try {
                const rules = JSON.parse(rulesText);
                chrome.storage.sync.set({ cookieRules: rules }, () => {
                    if (chrome.runtime.lastError) {
                        alert("Error saving rules: " + chrome.runtime.lastError.message);
                    } else {
                        alert("Cookie rules saved successfully!");
                    }
                });
            } catch (err) {
                alert("Invalid JSON format for rules.");
            }
        });

         // View Cookie Rules
        document.getElementById("viewRules").addEventListener("click", function() {
            chrome.storage.sync.get("cookieRules", (data) => {
            if (chrome.runtime.lastError) {
                console.error("Error fetching rules:", chrome.runtime.lastError);
                alert("Error fetching rules: " + chrome.runtime.lastError.message);
                return;
            }
            console.log("Fetched cookie rules:", data);
            const rules = data.cookieRules || {};
            document.getElementById("rulesOutput").innerText = JSON.stringify(rules, null, 2);
            if (Object.keys(rules).length === 0) {
                alert("No cookie rules saved.");
            }
            });
        });


         // Clear Cookie Rules button
    document.getElementById("clearRules").addEventListener("click", function() {
        chrome.runtime.sendMessage({ action: "clearRules" }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Error clearing rules:", chrome.runtime.lastError.message);
                alert("Error clearing rules: " + chrome.runtime.lastError.message);
                return;
            }
            if (response.success) {
                alert("✅ Cookie rules cleared successfully!");
                // Optionally, clear the rules output display
                document.getElementById("rulesOutput").innerText = "";
            } else {
                alert("❌ Failed to clear cookie rules: " + response.error);
            }
        });
    });
    
        // ✅ Retrieve and display audit logs from background.js
        document.getElementById("viewAuditLogs").addEventListener("click", function() {
            chrome.runtime.sendMessage({ action: "getAuditLogs" }, (response) => {
                const output = document.getElementById("auditLogOutput");
                if (response.error) {
                    output.innerText = "Error: " + response.error;
                } else if (response.logs) {
                    output.innerText = JSON.stringify(response.logs, null, 2);
                } else {
                    output.innerText = "No audit logs found.";
                }
            });
        });

        // Clear Audit Logs button
        document.getElementById("clearAuditLogs").addEventListener("click", function() {
            chrome.runtime.sendMessage({ action: "clearAuditLogs" }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("❌ Clear Audit Logs Error:", chrome.runtime.lastError.message);
                    alert("❌ Error clearing audit logs: " + chrome.runtime.lastError.message);
                    return;
                }
                if (response.success) {
                    alert("✅ Audit logs cleared successfully!");
                    // Optionally, clear the audit log output display
                    document.getElementById("auditLogOutput").innerText = "";
                } else {
                    alert("❌ Failed to clear audit logs: " + response.error);
                }
            });
        });


      
});
