declare namespace Cloudflare {
	interface Env {
		WS_BASE_URL: string;
	}
}
interface Env extends Cloudflare.Env {}
