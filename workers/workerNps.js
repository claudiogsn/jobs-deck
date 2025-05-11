require('dotenv').config();
const { log } = require('../utils/logger');
const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const sqs = new SQSClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

// === Setup log file ===
const LOG_DIR = path.resolve(__dirname, '../logs');
const LOG_PATH = path.resolve(LOG_DIR, 'api.log');

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

// === Envio para PHP Dispatcher ===
async function callDispatcherLog(mensagem, retorno) {
    const payload = {
        method: "salvarLogNps",
        data: {
            mensagem,
            retorno
        }
    };

    appendApiLog(`➡️ REQUEST: salvarLogNps - ${JSON.stringify(payload)}`);

    try {
        const response = await axios.post(process.env.DISPATCHER_URL, payload);
        appendApiLog(`✅ RESPONSE (salvarLogNps): ${JSON.stringify(response.data)}`);
        return true;
    } catch (error) {
        const errorContent = error.response?.data || error.message || 'Erro desconhecido';
        appendApiLog(`❌ ERROR (salvarLogNps): ${JSON.stringify(errorContent)}`);
        return false;
    }
}

async function sendMessage(data) {
    const {
        telefone,
        identificador_conta,
        cod,
        link_nps,
    } = data;

    try {
        const response = await axios.post(
            `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: "whatsapp",
                to: telefone,
                type: "template",
                template: {
                    name: "nps_clientes_deck",
                    language: { code: "pt_BR" },
                    components: [
                        {
                            type: "body",
                            parameters: [
                                { type: "text", text: identificador_conta },
                                { type: "text", text: cod },
                                { type: "text", text: "Deck" },
                                { type: "text", text: link_nps },

                            ]
                        }
                    ]
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                    "Content-Type": "application/json"
                }
            }
        );

        log(`✅ Mensagem enviada para ${telefone}`, 'workerNps');
        appendApiLog(`✅ Mensagem enviada para ${telefone} com ID: ${response.data.messages?.[0]?.id || 'desconhecido'}`);

        // ✅ Enviar log para o PHP dispatcher
        await callDispatcherLog(data, response.data);

        return true;
    } catch (error) {
        const errorLog = error.response?.data || error.message;
        log('❌ Erro ao enviar mensagem WhatsApp: ' + JSON.stringify(errorLog), 'workerNps');
        appendApiLog(`❌ Erro ao enviar mensagem WhatsApp: ${JSON.stringify(errorLog)}`);
        return false;
    }
}

async function processQueueNps() {
    while (true) {
        try {
            const command = new ReceiveMessageCommand({
                QueueUrl: process.env.NPS_QUEUE_URL,
                MaxNumberOfMessages: 1,
                WaitTimeSeconds: 10,
                VisibilityTimeout: 300
            });

            const data = await sqs.send(command);

            if (!data.Messages || data.Messages.length === 0) {
                log('📭 Nenhuma mensagem na fila, aguardando...', 'workerNps');
                continue;
            }

            for (const message of data.Messages) {
                const body = JSON.parse(message.Body);
                const payload = typeof body === 'string' ? JSON.parse(body) : body;

                log('📨 Processando mensagem para ' + payload.telefone, 'workerNps');

                const success = await sendMessage(payload);

                if (success) {
                    await sqs.send(new DeleteMessageCommand({
                        QueueUrl: process.env.NPS_QUEUE_URL,
                        ReceiptHandle: message.ReceiptHandle
                    }));
                    log('🗑️ Mensagem deletada da fila com sucesso.', 'workerNps');
                } else {
                    log('⚠️ Envio falhou, mensagem NÃO deletada.', 'workerNps');
                }
            }
        } catch (err) {
            log('❌ Erro no processamento da fila: ' + err.message, 'workerNps');
            appendApiLog(`❌ Erro no loop de fila: ${err.message}`);
        }
    }
}

module.exports = { processQueueNps };

if (require.main === module) {
    processQueueNps();
}
