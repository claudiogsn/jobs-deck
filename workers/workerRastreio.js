require('dotenv').config();
const { log } = require('../utils/logger');
const axios = require('axios');

const empresas = [42557, 42458, 41815];
const server = (process.env.NODE_ENV === 'development')
    ? 'http://localhost/dispatch-bot-api/index.php'
    : 'https://vemprodeck.com.br/dispatch-bot/api/index.php';

async function callPHP(method, data) {
    try {
        const response = await axios.post(server, {
            method,
            data
        });
        return response.data;
    } catch (error) {
        log('❌ Erro chamando método ' + method + ': ' + (error.response?.data || error.message), 'workerRastreio');
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
        const linksResponse = await callPHP('fetchLinksFromAPI', solicitacao_id);

        if (!linksResponse || !linksResponse.success || !linksResponse.response) {
            log(`⚠️ Erro ao buscar links para solicitacao_id ${solicitacao_id}`, 'workerRastreio');
            continue;
        }

        for (const parada of linksResponse.response) {
            const parada_id = parada.parada_id;
            const link_rastreio = parada.link_rastreio;

            log(`✅ Atualizando parada_id: ${parada_id}`, 'workerRastreio');
            const updateResponse = await callPHP('updateParadas', {
                parada_id,
                link_rastreio_pedido: link_rastreio
            });

            if (updateResponse && updateResponse.success) {
                log(`🎯 Parada ${parada_id} atualizada com sucesso!`, 'workerRastreio');
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

        log('⏳ Aguardando 1 minuto para próxima execução do dispatcher...', 'workerRastreio');
        await new Promise(resolve => setTimeout(resolve, 60000)); // espera 60 segundos
    }
}

module.exports = { dispatchLoop };

if (require.main === module) {
    dispatchLoop();
}
