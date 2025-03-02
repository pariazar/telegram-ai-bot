const { Telegraf } = require('telegraf');
const fastify = require('fastify')({ logger: true });
const BOT_TOKEN = 'TELEGRAM_BOT_TOKEN';
const fs = require('fs');
const path = require('path');
const dataPath = path.join(__dirname, 'data.json');

// Register CORS and create Telegraf instance
fastify.register(require('@fastify/cors'), { origin: '*', methods: ['POST'] });
const bot = new Telegraf(BOT_TOKEN);

// Chat schema validation
const chatSchema = {
    body: {
        type: 'object',
        required: ['model', 'messages'],
        properties: {
            model: {
                type: 'string',
                enum: [
                    'gpt-3.5-turbo',
                    'gpt-4',
                    'gpt-4-turbo',
                    'gpt-4o-mini',
                    'meta-llama/Llama-3.3-70B-Instruct-Turbo',
                    'claude-3-haiku-20240307',
                    'mistralai/Mistral-Small-24B-Instruct-2501'
                ]
            },
            messages: {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['role', 'content'],
                    properties: {
                        role: { type: 'string' },
                        content: { type: 'string' }
                    }
                }
            }
        }
    }
};

// Add data read/write functions
function readData() {
    try {
        const data = fs.readFileSync(dataPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

function saveData(data) {
    const trimmedData = data.slice(-10); // Keep only the last 10 entries
    fs.writeFileSync(dataPath, JSON.stringify(trimmedData, null, 2));
    return trimmedData;
}

// Combined endpoints
fastify.post('/chat', { schema: chatSchema }, async (request, reply) => {
    try {
        const { model, messages } = request.body;
        const lastMessage = messages[messages.length - 1];

        if (!lastMessage || lastMessage.role !== 'user') {
            reply.code(400);
            return { status: 'error', message: 'Last message must be from user' };
        }

        const response = await fetch('https://bookmind.plushub.ir/api/ai//v1/chat/completions', {
            method: 'POST',
            headers: {
                'Connection': 'keep-alive',
                'Origin': 'https://bookmind.plushub.ir',
                'Referer': 'https://bookmind.plushub.ir/books/OL450063W',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-US,en;q=0.9,fa-IR;q=0.8,fa;q=0.7',
                'authorization': 'Bearer sk-1234567890abcdef',
                'content-type': 'application/json',
                'priority': 'u=1, i',
                'sec-ch-ua': '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"'
            },
            body: JSON.stringify({ model, messages, max_tokens: 100, temperature: 0.7, n: 1 })
        });

        const data = await response.json();
        return { status: 'success', data: { model, response: data.choices[0].message.content } };

    } catch (error) {
        request.log.error('Error processing request:', error);
        reply.code(500);
        return { status: 'error', message: 'Internal server error', details: error.message };
    }
});

// Telegram bot handlers
bot.on('message', async (ctx) => {
    try {
        if (ctx.chat.type === 'private' || !ctx.message.text) return;
        const messageText = ctx.message.text;

        // Add condition to clear data when "فراموش کن" is received
        if (messageText.trim().toLowerCase() === 'فراموش کن') {
            fs.writeFileSync(dataPath, JSON.stringify([], null, 2));
            return ctx.reply('همه چیز فراموش شد! از اول شروع میکنیم.', { reply_to_message_id: ctx.message.message_id });
        }

        // Check if message is a reply to the bot or contains mention
        const isReplyToBot = ctx.message.reply_to_message &&
            ctx.message.reply_to_message.from.username === ctx.botInfo.username;
        const isMentioned = messageText.includes('حامد') || messageText.includes(`@${ctx.botInfo.username}`);

        if (!isReplyToBot && !isMentioned) return;

        const query = messageText
            .replace(/\/حامد\s*/, '')
            .replace(new RegExp(`@${ctx.botInfo.username}`, 'g'), '')
            .trim();

        if (!query) return ctx.reply('Please provide a question after حامد command');

        // Store user message
        // const userData = {
        //     username: ctx.from.username || ctx.from.first_name,
        //     message: query,
        //     timestamp: new Date().toISOString()
        // };
        // let history = readData();
        // history.push(userData);
        // history = saveData(history);

        await ctx.sendChatAction('typing');

        const system = 'تو یک ربات چت هستی به اسم حامد. با لحن عامیانه و دوستانه صحبت میکنی. بعضی مواقع هم با لحن لوتی و شوخ صحبت میکنی. سعی کن جواب هایت کوتاه و مفید باشد و از اصطلاحات عامیانه استفاده کنی.';

        // const mainMessage = history.pop();

        // const his = history.map(entry => entry.message).join('+');
        // console.log(his)
        // Prepare messages with history
        const messages = [
            { role: 'user', content: system + query },
        ];

        const response = await fetch('http://localhost:8787/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: messages
            })
        });

        const data = await response.json();
        await ctx.reply(data.data.response, { reply_to_message_id: ctx.message.message_id, parse_mode: 'Markdown' });

    } catch (error) {
        console.error('Error:', error);
        ctx.reply('Sorry, there was an error processing your request');
    }
});

// Start both services
const start = async () => {
    try {
        await fastify.listen({ port: 8787 });
        await bot.launch();
        console.log('Server and bot started successfully');
    } catch (err) {
        console.error('Startup failed:', err);
        process.exit(1);
    }
};

start();

// Graceful shutdown
process.once('SIGINT', () => { bot.stop('SIGINT'); fastify.close(); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); fastify.close(); });