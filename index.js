const { processQueue } = require('./workers/workerWhatsapp');
const { processQueueNps } = require('./workers/workerNps');
const { dispatchLoop } = require('./workers/workerRastreio');

// Inicia os dois workers ao mesmo tempo
processQueue();      // WhatsApp Worker
processQueueNps();      // Nps Worker
dispatchLoop();      // Rastreio Worker



require('./server');

console.log('🚀 Workers iniciados: WhatsApp + Rastreio');
