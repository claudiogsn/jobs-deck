require('dotenv').config();
const { log } = require('../utils/logger');
const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const axios = require('axios');

const TELEFONE_FIXO_TESTE = '5583999275543';

const sqs = new SQSClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

async function sendWhatsappMessage(body) {
    try {
        await axios.post(
            `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: "whatsapp",
                to: TELEFONE_FIXO_TESTE,
                type: "template",
                template: {
                    name: "hello_world",
                    language: { code: "en_US" }
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                    "Content-Type": "application/json"
                }
            }
        );
        log('✅ Mensagem enviada para ' + TELEFONE_FIXO_TESTE, 'workerWhatsapp');
        return true;
    } catch (error) {
        log('❌ Erro ao enviar mensagem WhatsApp: ' + (error.response?.data || error.message), 'workerWhatsapp');
        return false;
    }
}

async function processQueue() {
    while (true) {
        try {
            const command = new ReceiveMessageCommand({
                QueueUrl: process.env.SQS_QUEUE_URL,
                MaxNumberOfMessages: 1,
                WaitTimeSeconds: 10,
                VisibilityTimeout: 300
            });

            const data = await sqs.send(command);

            if (!data.Messages || data.Messages.length === 0) {
                log('📭 Nenhuma mensagem na fila, aguardando...', 'workerWhatsapp');
                continue;
            }

            for (const message of data.Messages) {
                const body = JSON.parse(message.Body);
                log('📨 Processando mensagem...', 'workerWhatsapp');
                const success = await sendWhatsappMessage(body);

                if (success) {
                    await sqs.send(new DeleteMessageCommand({
                        QueueUrl: process.env.SQS_QUEUE_URL,
                        ReceiptHandle: message.ReceiptHandle
                    }));
                    log('🗑️ Mensagem deletada da fila com sucesso.', 'workerWhatsapp');
                } else {
                    log('⚠️ Envio falhou, mensagem NÃO deletada.', 'workerWhatsapp');
                }
            }
        } catch (err) {
            log('❌ Erro no processamento da fila: ' + err.message, 'workerWhatsapp');
        }
    }
}

module.exports = { processQueue };

if (require.main === module) {
    processQueue();
}
