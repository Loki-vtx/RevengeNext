import { generateRandomString } from './common'
import { characters, characters2, encode } from './numberBase64'

// Subtracted from the timestamp, as in the original TokenUtils.
const TOKEN_EPOCH_OFFSET = 1293840000

/**
 * Standard base64 of an ASCII string, without padding.
 * Discord user IDs are digits, so ASCII is enough and no Buffer is needed.
 */
export function base64Ascii(input: string): string {
	let out = ''
	for (let i = 0; i < input.length; i += 3) {
		const a = input.charCodeAt(i)
		const b = input.charCodeAt(i + 1)
		const c = input.charCodeAt(i + 2)
		const n = (a << 16) | ((b || 0) << 8) | (c || 0)

		out += characters[(n >> 18) & 63] + characters[(n >> 12) & 63]
		if (i + 1 < input.length) out += characters[(n >> 6) & 63]
		if (i + 2 < input.length) out += characters[n & 63]
	}
	return out
}

/**
 * Builds a token-shaped string for another user: base64(id) . timestamp . random.
 * The random part is not a real signature, so this will not log anyone in.
 * Only the account's own token works for `/token login`.
 */
export function makeFakeToken(userId: string): string {
	return [
		base64Ascii(userId),
		encode(+Date.now() - TOKEN_EPOCH_OFFSET, true),
		generateRandomString(characters2, 27),
	].join('.')
}