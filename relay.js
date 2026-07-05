// relay.js - Cloudflare Worker untuk BTX Mining
// Deploy ke Cloudflare Workers untuk proxy WebSocket ke pool BTX

const CONFIG = {
  // Pool BTX - ninjaraider (54% network share, 2% fee)
  POOL_URL: "stratum.ninjaraider.com:44920", 
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Origin",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // WebSocket relay endpoint
    if (url.pathname === "/relay") {
      try {
        const upgradeHeader = request.headers.get("Upgrade");
        if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
          return new Response("Expected WebSocket upgrade", { status: 400 });
        }

        // Create WebSocket pair
        const [client, server] = Object.entries(
          new WebSocketPair()
        );
        server.accept();

        // Connect to pool
        const poolHost = CONFIG.POOL_URL.split(":")[0];
        const poolPort = CONFIG.POOL_URL.split(":")[1] || "3333";
        const poolUrl = `ws://${poolHost}:${poolPort}`;
        const poolSocket = await connectToPool(poolUrl);
        
        // Relay: pool → client
        poolSocket.onmessage = (event) => {
          try { server.send(event.data); } catch(e) {}
        };
        poolSocket.onerror = (err) => console.error("Pool error:", err);
        poolSocket.onclose = () => {
          try { server.close(); } catch(e) {}
        };
        
        // Relay: client → pool
        server.onmessage = (event) => {
          try { poolSocket.send(event.data); } catch(e) {}
        };
        server.onclose = () => {
          try { poolSocket.close(); } catch(e) {}
        };

        return new Response(null, {
          status: 101,
          webSocket: client,
          headers: corsHeaders,
        });
      } catch (e) {
        console.error("Relay error:", e);
        return new Response("Relay failed: " + e.message, { status: 500 });
      }
    }

    // Health check
    return new Response("BTX Relay OK - Pool: " + CONFIG.POOL_URL, {
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  },
};

async function connectToPool(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onopen = () => {
      console.log("Connected to pool:", url);
      resolve(ws);
    };
    ws.onerror = (err) => reject(err);
    ws.onclose = () => reject(new Error("Pool connection closed"));
  });
}
