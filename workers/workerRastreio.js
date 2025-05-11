require('dotenv').config();
const { log } = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const empresas = [42557, 42458, 41815];

const server = process.env.DISPATCHER_URL;

const LOG_DIR = path.resolve(__dirname, '../logs');
const LOG_PATH = path.resolve(LOG_DIR, 'api.log');

// Cria diretório e arquivo se necessário
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}
if (!fs.existsSync(LOG_PATH)) {
    fs.writeFileSync(LOG_PATH, '');
}

function appendApiLog(content) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${content}\n`;
    fs.appendFileSync(LOG_PATH, logEntry);
}

async function callPHP(method, data) {
    const payload = {
        method,
        data
    };

    appendApiLog(`➡️ REQUEST: ${method} - ${JSON.stringify(payload)}`);

    try {
        const response = await axios.post(server,payload);

        appendApiLog(`✅ RESPONSE (${method}): ${JSON.stringify(response.data)}`);
        return response.data;

    } catch (error) {
        const errorContent = error.response?.data || error.message || 'Erro desconhecido';
        appendApiLog(`❌ ERROR (${method}): ${JSON.stringify(errorContent)}`);
        return null;
    }
}

async function processEmpresa(empresa_id) {
    log(`🔍 Processando empresa_id: ${empresa_id}`, 'workerRastreio');

    const solicitacoesResponse = await callPHP('fetchSolicitacoesSemRastreio', { empresa_id });

    if (!solicitacoesResponse || !solicitacoesResponse.success) {
        log(`⚠️ Falha ao buscar solicitações para empresa_id ${empresa_id}`, 'workerRastreio');
        return;
    }

    const solicitacoes = solicitacoesResponse.data || [];

    for (const solicitacao_id of solicitacoes) {
        log(`➡️ Buscando links para solicitacao_id: ${solicitacao_id}`, 'workerRastreio');
        const linksResponse = await callPHP('fetchLinksFromAPI', { solicitacao_id });


        if (!linksResponse || !linksResponse.success) {
            log(`⚠️ Erro ao buscar links para solicitacao_id ${solicitacao_id}`, 'workerRastreio');
            continue;
        }

        const paradas = linksResponse.response || [];

        for (const parada of paradas) {
            const parada_id = parada.parada_id;
            const link_rastreio = parada.link_rastreio;

            log(`✅ Atualizando parada_id: ${parada_id}`, 'workerRastreio');
            const updateResponse = await callPHP('updateParadas', {
                parada_id,
                link_rastreio: link_rastreio
            });

            if (updateResponse && updateResponse.success) {
                log(`🎯 Parada ${parada_id} atualizada com sucesso!`, 'workerRastreio');

                const sendResult = await callPHP('sendWhatsapp', {
                    parada_id: updateResponse.parada_id,
                    cod: updateResponse.cod,
                    link_rastreio: updateResponse.link_rastreio
                });

                if (sendResult && sendResult.success) {
                    log(`📤 Mensagem enviada para fila SQS com sucesso para parada ${parada_id}`, 'workerRastreio');
                } else {
                    log(`❌ Falha ao enfileirar mensagem para parada ${parada_id}`, 'workerRastreio');
                    console.log(sendResult);
                }
            } else {
                log(`❌ Erro ao atualizar parada ${parada_id}`, 'workerRastreio');
            }
        }
    }

    log(`🏁 Finalizado processamento para empresa_id: ${empresa_id}`, 'workerRastreio');
}

async function dispatchLoop() {
    while (true) {
        log(`🚀 Iniciando novo ciclo de dispatcher`, 'workerRastreio');

        for (const empresa_id of empresas) {
            await processEmpresa(empresa_id);
        }

        // 👉 Aqui: processamento de NPS após todas as empresas
        await dispatchNps();

        log('⏳ Aguardando 1 minuto para próxima execução do dispatcher...', 'workerRastreio');
        await new Promise(resolve => setTimeout(resolve, 60000));
    }
}

async function dispatchNps() {
    log(`🔍 Buscando pedidos para NPS...`, 'workerNps');

    const response = await callPHP('getOrdersToNps', {});

    if (!response || !response.success) {
        log(`⚠️ Nenhum pedido retornado para envio de NPS`, 'workerNps');
        return;
    }

    const pedidos = response.data;

    if (!Array.isArray(pedidos) || pedidos.length === 0) {
        log(`⚠️ Lista de pedidos NPS está vazia`, 'workerNps');
        return;
    }

    log(`📦 Enviando ${pedidos.length} pedidos para a fila NPS...`, 'workerNps');

    const envio = await callPHP('sendNpsToQueue', pedidos);

    if (envio) {
        log(`✅ Envio para fila NPS finalizado`, 'workerNps');
    } else {
        log(`❌ Falha ao enviar para fila NPS`, 'workerNps');
    }
}


module.exports = { dispatchLoop };

if (require.main === module) {
    dispatchLoop();
}
