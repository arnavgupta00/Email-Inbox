/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import * as PostalMime from 'postal-mime';

export default {
	/**
	 * Email handler fires automatically for every message
	 * sent to *@dejavu.social.
	 */
	async email(message: ForwardableEmailMessage, env, ctx) {
		const parser = new PostalMime.default();
		const rawEmail = new Response(message.raw);
		const email = await parser.parse(await rawEmail.arrayBuffer());
		console.log('email', email.to);
		if (email && email.to && email.to.length > 0 && email.to[0] && email.to[0].address && email.to[0].address.includes('dejavu.social')) {
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

			await fetch(`https://durable-object-pubsub.adv-dep-test.workers.dev/webhook/room/${email.to[0].address}`, requestOptions)
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
			console.log('Not a dejavu.social email, ignoring.');
		}
	},
} satisfies ExportedHandler<Env>;
