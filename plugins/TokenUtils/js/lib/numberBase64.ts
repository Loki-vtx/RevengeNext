export const characters =
	'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

// Discord's URL-safe variant of the alphabet.
export const characters2 = characters.replace('+/', '_-')

/**
 * Encodes a non-negative integer in base64, most significant digit first.
 * With `discord` set, the URL-safe alphabet is used.
 */
export function encode(data: number, discord = false): string {
	if (typeof data !== 'number')
		throw new Error(`Passed data isn't a number (received: ${typeof data})`)

	const alphabet = discord ? characters2 : characters
	let result = ''
	while (data > 0) {
		result = alphabet.charAt(data % 64) + result
		data = Math.floor(data / 64)
	}
	return result
}