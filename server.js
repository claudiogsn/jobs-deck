require('dotenv').config();
const express = require('express');
const { getLogs } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Rota para retornar logs em JSON
app.get('/logs', (req, res) => {
    res.json(getLogs());
});

// Página de visualização
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Logs em Tempo Real</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-900 text-green-400 font-mono p-6">
      <div class="max-w-7xl mx-auto">
        <h1 class="text-3xl mb-4">📋 Logs em Tempo Real</h1>
        <div class="bg-gray-800 p-4 rounded-lg shadow-lg h-[80vh] overflow-y-auto" id="logs">
          Carregando logs...
        </div>
      </div>

      <script>
        async function loadLogs() {
          const res = await fetch('/logs');
          const logs = await res.json();
          document.getElementById('logs').innerText = logs.join('\\n');
        }
        setInterval(loadLogs, 3000); // Atualiza a cada 3 segundos
        loadLogs();
      </script>
    </body>
    </html>
  `);
});

// Start server
app.listen(PORT, () => {
    console.log(`[server - ${new Date().toLocaleString()}] - Servidor de logs rodando na porta ${PORT}`);
});
