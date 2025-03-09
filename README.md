# CookieCrumbs

Decentralised Cookie Manager

---

## Table of Contents

- [Overview](#overview)
- [Installation and Setup](#installation-and-setup)
- [Running the Server](#running-the-server)
- [Library Dependencies](#library-dependencies)
- [User Manual](#user-manual)
---

## Overview

CookieCrumbs is a decentralized cookie manager designed to help you manage, audit, and store cookie data across applications. This project demonstrates how to simulate cookie handling on the server side and provides a Chrome extension–style popup to interact with cookies.

**Features include:**
- **Cookie Retrieval:** Query cookie data by domain.
- **Cookie Rules:** Define rules for storing cookies for specific domains.
- **Audit Logging:** Track and view cookie actions.
- **Import/Export:** Import or export cookie data in JSON format.
- **Decentralized Storage:** Use decentralized storage libraries to optionally persist cookie data.

---

## Installation and Setup

Navigate to the cookie-stealer directory and install the required packages:
   ```bash
   cd cookie-stealer
   ```
   ```bash
   npm install
   ```

### Prerequisites

- **Node.js:** Ensure you have Node.js installed (v14 or later is recommended).
  


## Running the Server
1. Open your terminal and navigate to the `cookie-stealer` folder:
   ```bash
   cd cookie-stealer
   ```
   
2. Start the server using one of the following commands:

    **Directly via Node.js:**
    ```bash
    node server.js
    ```

    **Using npm (recommended):**
    ```bash
    npm start
    ```

## Library Dependencies 
The following libraries are included in the project and are automatically installed locally. No separate installation is needed:

- **blockstore-idb.js**: Provides IndexedDB-based block storage functionality.
- **helia-core.js & helia-unixfs.js**: Offer core integration for Helia/IPFS-based storage.
- **multiformats.js**: Supplies utilities for handling multiformat data encodings.


## User Manual

For detailed instructions on how to use CookieCrumbs, please refer to our comprehensive user manual. The manual provides an in-depth guide covering:

- Step-by-step instructions on setting up and configuring the application.
- Detailed descriptions of all features, including cookie retrieval, rule setup, and audit logging.
- Simulation of the cookie-stealer functionality, showing how cookies can be captured and managed on the server side.
- Specific notes and considerations for Firefox compatibility.

> **Important:** As of now, CookieCrumbs works exclusively on Firefox. Future versions will introduce compatibility with other browsers.

You can download a copy of the user manual by clicking the link below:
[Download User Manual](./User_Manual.doc)


