document.getElementById('storeCookies').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'storeCookies' }, (response) => {
      console.log(response.status);
  });
});

document.getElementById('retrieveCookies').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'retrieveCookies' }, (response) => {
      if (response.cookies) {
          console.log('Retrieved Cookies:', response.cookies);
      } else {
          console.error(response.error);
      }
  });
});
