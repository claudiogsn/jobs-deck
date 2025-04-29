const { processQueue } = require('./workers/workerWhatsapp');
const { dispatchLoop } = require('./workers/workerRastreio');

// Inicia os dois workers ao mesmo tempo
processQueue();      // WhatsApp Worker
dispatchLoop();      // Rastreio Worker


require('./server');

console.log('🚀 Workers iniciados: WhatsApp + Rastreio');
