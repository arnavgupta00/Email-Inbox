import PostalMime from 'postal-mime';

function normalizeRecipient(recipient: string | undefined | null) {
	return recipient?.trim().toLowerCase() || null;
}

export default {
	async fetch() {
		return new Response('Aliasr email router OK');
	},

	async email(message: ForwardableEmailMessage, env: Env) {
		const recipient = normalizeRecipient(message.to);

		if (!recipient || !recipient.endsWith('@aliasr.xyz')) {
			console.log('Ignoring non-aliasr recipient', { recipient });
			return;
		}

		try {
			const email = await PostalMime.parse(message.raw);
			const wsBaseUrl = (env.WS_BASE_URL || 'https://aliasr-ws.aliasr.xyz').replace(/\/$/, '');
			const webhookUrl = `${wsBaseUrl}/webhook/room/${encodeURIComponent(recipient)}`;
			const payload = {
				subject: email.subject,
				from: email.from ?? { address: message.from },
				to: email.to?.length ? email.to : [{ name: '', address: recipient }],
				text: email.text,
				html: email.html,
				attachments: email.attachments,
				timestamp: email.date,
			};

			console.log('Forwarding inbound email', {
				recipient,
				webhookUrl,
				subject: payload.subject,
			});

			const response = await fetch(webhookUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Webhook forward failed: ${response.status} ${errorText}`);
			}

			console.log('Email forwarded successfully', { recipient });
		} catch (error) {
			console.error('Failed to process inbound email', {
				recipient,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	},
} satisfies ExportedHandler<Env>;
