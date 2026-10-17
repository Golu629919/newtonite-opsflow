// Server-Sent Events (SSE) Live Broadcast Manager

class SSEManager {
  constructor() {
    this.clients = new Set();
  }

  addClient(res, req) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    res.write('event: connected\ndata: {"status":"connected"}\n\n');

    const client = { res, id: Date.now(), user: req.user };
    this.clients.add(client);

    // Heartbeat every 20 seconds to prevent connection timeouts
    const interval = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 20000);

    req.on('close', () => {
      clearInterval(interval);
      this.clients.delete(client);
    });
  }

  broadcast(eventType, data) {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      try {
        client.res.write(payload);
      } catch (err) {
        this.clients.delete(client);
      }
    }
  }
}

export const sseManager = new SSEManager();
