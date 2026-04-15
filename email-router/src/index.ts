import * as PostalMime from 'postal-mime';

export default {
	async email(message: ForwardableEmailMessage, env: Env, ctx) {
		const parser = new PostalMime.default();
		const rawEmail = new Response(message.raw);
		const email = await parser.parse(await rawEmail.arrayBuffer());
		console.log('email', email.to);
		if (email && email.to && email.to.length > 0 && email.to[0] && email.to[0].address && email.to[0].address.includes('aliasr.xyz')) {
			const requestOptions = {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					subject: email.subject,
					from: email.from,
					to: email.to,
					text: email.text,
					html: email.html,
					attachments: email.attachments,
					timestamp: email.date,
				}),
			};
			console.log('requestOptions', requestOptions);

			const wsBaseUrl = env.WS_BASE_URL || 'https://aliasr-ws.aliasr.xyz';
			await fetch(`${wsBaseUrl}/webhook/room/${email.to[0].address}`, requestOptions)
				.then((response) => {
					if (!response.ok) {
						throw new Error(`HTTP error! status: ${response.status}`);
					}
					console.log('Response:', response);
					return response.json();
				})
				.then((result) => console.log(result))
				.catch((error) => console.error(error));
		} else {
			console.log('Not an aliasr.xyz email, ignoring.');
		}
	},
} satisfies ExportedHandler<Env>;
