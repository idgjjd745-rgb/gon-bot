const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, downloadContentFromMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const config = require('./config');

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    // توليد كود الاقتران عند التشغيل لأول مرة
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(config.ownerNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(`\n===================================`);
                console.log(`🔑 كود الاقتران الخاص بالبوت [${config.botName}]: ${code}`);
                console.log(`===================================\n`);
            } catch (error) {
                console.error("خطأ في طلب كود الاقتران:", error);
            }
        }, 3000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log(`✅ تم اتصال البوت [${config.botName}] بنجاح! المالك: ${config.ownerName}`);
        }
    });

    // استجابة البوت للأوامر في الجروبات والشات
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || 
                     msg.message.imageMessage?.caption || 
                     msg.message.videoMessage?.caption || "";

        // ==================== أمر الأوامر / الأقسام (المستوحاة من صورك) ====================
        if (text === `${config.prefix}اوامر` || text === `${config.prefix}الأوامر` || text === `${config.prefix}الاقسام`) {
            const menuText = `🌲 *~ أقسـام أوامـر بوت ${config.botName} ~* 🌲\n\n` +
                             `👤 *المالك:* ${config.ownerName}\n` +
                             `🏷️ *البريفكس:* [ ${config.prefix} ]\n` +
                             `────────────────────\n` +
                             `📁 *${config.prefix}التحميل* : عرض أوامر التحميل\n` +
                             `👥 *${config.prefix}المجموعات* : أوامر إدارة الجروبات\n` +
                             `🌅 *${config.prefix}الملصقات* : أوامر الملصقات والستيكر\n` +
                             `❇️ *${config.prefix}امثله* : أمثلة الاستخدام\n` +
                             `🛠 *${config.prefix}الادوات* : الأدوات الذكية والمساعدات\n` +
                             `🌐 *${config.prefix}البحث* : أدوات البحث المختلفة\n` +
                             `🛡 *${config.prefix}المشرفين* : أوامر المشرفين (Admins)\n` +
                             `🎮 *${config.prefix}الالعاب* : ألعاب التسلية الجماعية\n` +
                             `🌟 *${config.prefix}الجيف* : تحويل الفيديوهات لـ GIF\n` +
                             `🏛 *${config.prefix}البنك* : نظام النقاط والعملات\n` +
                             `🤖 *${config.prefix}الذكاء* : أوامر الذكاء الاصطناعي\n` +
                             `🕹 *${config.prefix}البوتات* : إدارة البوتات الفرعية\n` +
                             `💻 *${config.prefix}معلومات* : معلومات البوت والسيرفر\n` +
                             `🕌 *${config.prefix}الدين* : القرآن والأذكار\n` +
                             `🛡 *${config.prefix}الحماية* : حماية الجروبات والسبام\n` +
                             `🏰 *${config.prefix}النقابات* : نظام الفرق والكلانات\n` +
                             `⚔️ *${config.prefix}التطوير* : أوامر المطور حصرياً\n` +
                             `────────────────────\n` +
                             `💡 *ملاحظة هامة:* لسرقة أي ملصق، اعمل ريبلاي عليه واكتب: *${config.prefix}سرقة*`;
            
            await sock.sendMessage(from, { text: menuText }, { quoted: msg });
        }

        // ==================== أمر سرقة الملصق (.سرقة) ====================
        if (text === `${config.prefix}سرقة` || text === `${config.prefix}سرقه`) {
            const quotedMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quotedMsg || !quotedMsg.stickerMessage) {
                return await sock.sendMessage(from, { text: '❌ من فضلك اعمل ريبلاي (رد) على الملصق اللي عايز تسرقه واكتب الأمر ثاني!' }, { quoted: msg });
            }

            try {
                const stream = await downloadContentFromMessage(quotedMsg.stickerMessage, 'sticker');
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }

                await sock.sendMessage(from, { sticker: buffer }, { quoted: msg });
            } catch (err) {
                console.error("خطأ أثناء سرقة الملصق:", err);
                await sock.sendMessage(from, { text: '❌ حدث خطأ أثناء سرقة الملصق، تأكد أن الملصق سليم.' }, { quoted: msg });
            }
        }

        // ==================== الأوامر الإضافية السريعة ====================
        if (text === `${config.prefix}بينج`) {
            await sock.sendMessage(from, { text: '🏓 البوت شغال تمام وبسرعة عالية جداً!' }, { quoted: msg });
        }

        if (text === `${config.prefix}مطور` || text === `${config.prefix}التطوير`) {
            await sock.sendMessage(from, { text: `👨‍💻 مطور بوت غون هو:\n${config.ownerName}\nرقم المطور: +${config.ownerNumber}` }, { quoted: msg });
        }
    });
}

startBot();
