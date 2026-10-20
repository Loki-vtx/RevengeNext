/** Returns `length` characters picked at random from `chars`. */
export function generateRandomString(chars: string, length = 27): string {
	if (typeof chars !== 'string') throw new Error("Passed chars isn't a string")
	if (chars.length <= 0) throw new Error('Invalid chars length')

	let result = ''
	for (let i = 0; i < length; i++) {
		result += chars[Math.floor(Math.random() * chars.length)]
	}
	return result
}