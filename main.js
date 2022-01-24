const config = require('./config.json');
const discord = require('discord.js');
const {Webhook} = require('simple-discord-webhooks');
const client = new discord.Client({intents: [discord.Intents.FLAGS.GUILD_MESSAGES, discord.Intents.FLAGS.GUILDS, discord.Intents.FLAGS.GUILD_WEBHOOKS, discord.Intents.FLAGS.GUILD_MEMBERS]});

client.on('ready', () => {
    console.log('READY AS ' + client.user.tag);
});

client.on('messageCreate', async (msg) => {
    if (msg.system || msg.author.bot) return;
    if (!msg.guild || msg.guild.id !== config.guildID) return;
    if (!msg.member.roles.cache.has(config.requiredRole)) return;
    const user = config.users.find(u => u.id === msg.author.id);
    if (!user) return msg.reply({
        components: [{
            type: 'ACTION_ROW',
            components: [{
                customId: 'dismiss',
                emoji: '❎',
                type: 'BUTTON',
                label: 'Dismiss',
                style: 'SECONDARY'
            }, {customId: 'optout', emoji: '🚫', type: 'BUTTON', label: 'Opt-Out', style: 'DANGER'}]
        }],
        content: 'You have the participating DID-Role, but no configuration about your identities was found. Please contact <@413429490342035466> to finish setup fully.',
        allowedMentions: {parse: []}
    });
    const possibleFormats = [];
    for (const identify of user.names) {
        possibleFormats.push({format: user.format.replaceAll('{{name}}', identify.toLowerCase()), name: identify});
    }
    let matched = null;
    let matchedFormat = null;
    for (const format of possibleFormats) {
        if (matched) continue;
        if (msg.content.toLowerCase().includes(format.format)) {
            matched = format.name;
            matchedFormat = format.format;
        }
    }
    if (!matched) return;
    const webhooks = await msg.channel.fetchWebhooks();
    let webhook = webhooks.find(w => w.owner.id === client.user.id);
    if (!webhook) webhook = await msg.channel.createWebhook(client.user.username);
    const w = new Webhook(webhook.url, matched, msg.author.avatarURL());
    const regEx = new RegExp(matchedFormat, 'ig');
    let content = '';
    if ((msg.reference || {}).messageId) {
        const m = await msg.channel.messages.fetch(msg.reference.messageId);
        content = content + content + `> ${m.content}\n[replied to](${m.url}) <@${m.author.id}>\n\n`;
    }
    content = content + msg.content.replace(regEx, '');
    for (const attachment of msg.attachments.values()) {
        content = content + '\n' + attachment.url;
    }
    await w.send(content, [], {parse: []});
    await msg.delete();
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.member.roles.cache.has(config.requiredRole)) return interaction.reply({
        ephemeral: true,
        content: 'Sorry, but you are not opted in. Please contact <@413429490342035466>.'
    });
    if (interaction.message.author.id !== client.user.id) return;
    if (interaction.customId === 'dismiss') await interaction.message.delete();
    if (interaction.customId === 'optout') await interaction.member.roles.remove(config.requiredRole);
    await interaction.reply({content: 'Action executed successfully', ephemeral: true});
});

client.login(config.token).catch((e) => {
    console.error('COULD NOT LOG-IN: ' + e);
});