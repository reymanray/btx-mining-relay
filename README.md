# BTX Mining Relay Server

Cloudflare Worker untuk relay WebSocket BTX mining.

## Setup

1. Upload file ini ke GitHub
2. Deploy ke Cloudflare Workers
3. Dapatkan relay URL
4. Connect miner ke relay URL

## Configuration

Edit `relay.js` line 10: ganti `CONFIG.POOL_URL` dengan URL pool/OTC yang benar dari @BTX_OTC Telegram

## Usage

Di VPS/GPU (marimo.io):
```bash
./btx-miner -u WALLET_ADDRESS -r wss://your-worker.workers.dev/relay -p x
```
