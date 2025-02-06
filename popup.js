document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("storeCookies").addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "storeCookies" }, (response) => {
          alert(response.status || response.error);
      });
  });

  document.getElementById("retrieveCookies").addEventListener("click", () => {
      const cid = document.getElementById("cidInput").value.trim();
      if (!cid) {
          alert("Please enter a valid CID.");
          return;
      }

      chrome.runtime.sendMessage({ action: "retrieveCookies", cids: [cid] }, (response) => {
          if (response.error) {
              alert(response.error);
          } else {
              document.getElementById("cookieOutput").innerText = JSON.stringify(response.cookies, null, 2);
          }
      });
  });
});
