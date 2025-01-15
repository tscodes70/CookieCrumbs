document.getElementById("viewCookies").addEventListener("click", () => {
    chrome.cookies.getAll({}, (cookies) => {
      const output = document.getElementById("output");
  
      if (cookies.length === 0) {
        output.innerHTML = '<p id="noCookies">No cookies found.</p>';
        return;
      }
  
      // Table to display cookies
      let tableHTML = `
        <table>
          <thead>
            <tr>
              <th>Domain</th>
              <th>Expires</th>
              <th>Name</th>
              <th>Value</th>
              <th>Path</th>
            </tr>
          </thead>
          <tbody>
      `;
  
      cookies.forEach((cookie) => {
        tableHTML += `
          <tr>
            <td>${cookie.domain || "(No Domain)"}</td>
            <td>${cookie.expirationDate ? new Date(cookie.expirationDate * 1000).toLocaleString() : "Session"}</td>
            <td>${cookie.name || "(No Name)"}</td>
            <td>${cookie.value || "(No Value)"}</td>
            <td>${cookie.path || "/"}</td>
          </tr>
        `;
      });
  
      tableHTML += `</tbody></table>`;
      output.innerHTML = tableHTML;
    });
  });
  