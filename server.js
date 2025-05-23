require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const { getLogs } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api-logs', (req, res) => {
    const logFilePath = path.resolve(__dirname, 'logs/api.log');

    fs.readFile(logFilePath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Erro ao ler o arquivo de log.' });

        const lines = data.trim().split('\n').reverse(); // Mais recentes primeiro
        res.json(lines);
    });
});

app.get('/api-view', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Logs API</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-900 text-white font-mono p-6">
      <div class="max-w-6xl mx-auto">
        <h1 class="text-3xl mb-4">📡 Logs da API (api.log)</h1>

        <div class="flex gap-2 mb-4">
          <button onclick="setFilter('ALL')" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded">Todos</button>
          <button onclick="setFilter('➡️')" class="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded">Requests ➡️</button>
          <button onclick="setFilter('✅')" class="px-3 py-1 bg-green-600 hover:bg-green-500 rounded">Sucesso ✅</button>
          <button onclick="setFilter('❌')" class="px-3 py-1 bg-red-600 hover:bg-red-500 rounded">Erros ❌</button>
        </div>

        <div id="logContainer" class="bg-gray-800 p-4 rounded h-[75vh] overflow-y-auto text-sm whitespace-pre-wrap"></div>
      </div>

      <script>
        let currentFilter = 'ALL';

        function setFilter(f) {
          currentFilter = f;
          fetchLogs();
        }

        async function fetchLogs() {
          try {
            const res = await fetch('/api-logs');
            const data = await res.json();
            const filtered = currentFilter === 'ALL'
              ? data
              : data.filter(line => line.includes(currentFilter));

            const formatted = filtered.map(formatLog).join('\\n');
            const container = document.getElementById('logContainer');
            container.textContent = formatted;
            container.scrollTop = 0; // rola para o topo (últimos logs primeiro)
          } catch (err) {
            document.getElementById('logContainer').textContent = 'Erro ao carregar logs.';
          }
        }

        function formatLog(line) {
          if (line.includes('✅')) return '✅ ' + line;
          if (line.includes('❌')) return '❌ ' + line;
          if (line.includes('➡️')) return '➡️ ' + line;
          return line;
        }

        setInterval(fetchLogs, 3000);
        fetchLogs();
      </script>
    </body>
    </html>
  `);
});


// Rota para retornar logs em JSON
app.get('/logs', (req, res) => {
    const allLogs = getLogs();
    const reversedLogs = [...allLogs].reverse(); // Mostrar logs mais recentes primeiro
    res.json(reversedLogs);
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

        <div class="flex flex-wrap gap-4 mb-4">
          <button onclick="setFilter('ALL')" class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded">Todos</button>
          <button onclick="setFilter('workerWhatsapp')" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded">WhatsApp</button>
          <button onclick="setFilter('workerRastreio')" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded">Rastreio</button>
          <button id="toggleButton" onclick="togglePause()" class="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded">⏸️ Pausar</button>
        </div>

        <div class="bg-gray-800 p-4 rounded-lg shadow-lg h-[75vh] overflow-y-auto" id="logs">
          Carregando logs...
        </div>
      </div>

      <script>
        let currentFilter = 'ALL';
        let paused = false;
        let intervalId;

        function setFilter(filter) {
          currentFilter = filter;
          if (!paused) loadLogs();
        }

        function togglePause() {
          paused = !paused;
          const button = document.getElementById('toggleButton');
          if (paused) {
            button.innerText = '▶️ Retomar';
          } else {
            button.innerText = '⏸️ Pausar';
            loadLogs();
          }
        }

        async function loadLogs() {
          if (paused) return;
          try {
            const res = await fetch('/logs');
            const logs = await res.json();
            const filteredLogs = logs.filter(log => {
              if (currentFilter === 'ALL') return true;
              return log.includes('[' + currentFilter + ' ');
            });
            document.getElementById('logs').innerText = filteredLogs.join('\\n');
          } catch (err) {
            document.getElementById('logs').innerText = 'Erro ao carregar logs.';
          }
        }

        intervalId = setInterval(loadLogs, 3000);
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
