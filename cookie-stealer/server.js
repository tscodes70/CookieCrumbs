const express = require('express');
const path = require('path');
const app = express();

// Middleware to check if a cookie exists and redirect only if not on home.html
app.use((req, res, next) => {
    const cookies = req.headers.cookie || ""; // Ensure cookies is a string

    // If session_id exists and user is NOT already on home.html, redirect them
    if (cookies.includes("session_id")) {
        if (req.path === "/") {
            return res.redirect("/home.html"); // Redirect from index to home if authenticated
        }
    } else {
        // If no session_id and user tries to access home.html, redirect to index.html
        if (req.path === "/home.html") {
            return res.redirect("/");
        }
    }

    next(); // Continue processing other requests
});


// Route to simulate setting cookies via the server's response
app.get('/set-cookie', (req, res) => {
    // Simulating the server setting a cookie in the response header
    res.setHeader('Set-Cookie', 'session_id=abcd1234; path=/; ');
    res.send('Cookie Set');
});

app.get('/logout', (req, res) => {
    // Remove the session cookie by setting an expired date in the past
    res.setHeader('Set-Cookie', 'session_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; HttpOnly;');
    res.setHeader('Content-Type', 'text/plain');
    res.send('Logging out');
});

// Serve a simple page to simulate the cookie being set
app.get('/', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>Simulated Cookie Setting</title>
        </head>
        <body>
            <h1>Simulated Cookie Setting</h1>
            <button id="getCookieBtn">Login</button>

            <script>
                // Trigger the GET request to set the cookie
                document.getElementById("getCookieBtn").onclick = function() {
                    fetch('/set-cookie')
                        .then(response => response.text())
                        .then(data => {
                            alert(data); // Alert the response (success or failure)
                            location.reload(); // Reload the page to ensure cookies are available in document.cookie
                        })
                        .catch(error => console.error('Error:', error));
                };
            </script>
        </body>
        </html>
    `);
});

// Serve home.html when redirected
app.get('/home.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
