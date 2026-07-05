// relay.js v2 - Cloudflare Worker untuk BTX Stratum Mining
// Terjemahkan stratum protocol ke WebSocket dan sebaliknya

const CONFIG = {
  // Pool BTX - ninjaraider (54% network share, 2% fee)
  POOL_URL: "stratum.ninjaraider.com:44920", 
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Origin",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // WebSocket relay for stratum mining
    if (url.pathname === "/relay") {
      try {
        const upgradeHeader = request.headers.get("Upgrade");
        if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
          return new Response("Expected WebSocket upgrade", { status: 400 });
        }

        const [client, server] = Object.entries(new WebSocketPair());
        server.accept();

        // Connect to pool via standard WebSocket (stratum over ws)
        const poolHost = CONFIG.POOL_URL.split(":")[0];
        const poolPort = CONFIG.POOL_URL.split(":")[1] || "3333";
        const poolUrl = `ws://${poolHost}:${poolPort}`;
        
        let poolSocket = null;
        let reconnectAttempts = 0;
        let reconnectTimer = null;

        async function connectToPool() {
          return new Promise((resolve, reject) => {
            console.log("Connecting to pool:", poolUrl);
            const ws = new WebSocket(poolUrl);
            ws.onopen = () => {
              console.log("Connected to pool");
              reconnectAttempts = 0;
              resolve(ws);
            };
            ws.onerror = (err) => reject(err);
            ws.onclose = () => reject(new Error("Pool closed"));
          });
        }

        async function startRelay() {
          try {
            if (poolSocket) { poolSocket.close(); }
            poolSocket = await connectToPool();
            
            poolSocket.onmessage = (event) => {
              try { 
                // Pool -> Miner: relay raw (stratum is text over ws)
                if (typeof event.data === 'string') {
                  server.send(event.data); 
                } else {
                  const reader = event.data.getReader();
                  reader.read().then(({value}) => server.send(value));
                }
              } catch(e) {}
            };
            
            poolSocket.onerror = (err) => {
              console.error("Pool error:", err);
              startRelay(); // Auto reconnect
            };
            
            poolSocket.onclose = () => {
              console.log("Pool disconnected");
              startRelay(); // Auto reconnect
            };
            
            server.onmessage = (event) => {
              try {
                // Miner -> Pool: relay raw
                if (typeof event.data === 'string') {
                  poolSocket.send(event.data);
                } else {
                  const reader = event.data.getReader();
                  reader.read().then(({value}) => poolSocket.send(value));
                }
              } catch(e) {}
            };
            
            server.onclose = () => {
              console.log("Miner disconnected");
              if (poolSocket) poolSocket.close();
            };
            
          } catch (e) {
            console.error("Relay error:", e.message);
            setTimeout(startRelay, 1000);
          }
        }

        startRelay();

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

    return new Response("BTX Relay OK - Pool: " + CONFIG.POOL_URL, {
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  },
};
