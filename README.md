# CookieCrumbs

Decentralised Cookie Manager

---

## Table of Contents

- [Overview](#overview)
- [Installation and Setup](#installation-and-setup)
- [Running the Server](#running-the-server)
- [Library Dependencies](#library-dependencies)

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

## installation-and-setup

Navigate to the cookie-stealer directory and install the required packages:
- cd cookie-stealer
- npm install

### Prerequisites

- **Node.js:** Ensure you have Node.js installed (v14 or later is recommended).
  


## Running the Server
- node server.js


## Library Dependencies
- blockstore-idb.js: IndexedDB-based block storage.
- helia-core.js & helia-unixfs.js: Core integration for Helia/IPFS-based storage.
- multiformats.js: Utilities for handling multiformat data encodings.
