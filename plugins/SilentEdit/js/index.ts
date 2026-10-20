// by me(Loki-vtd) fixed by me and also ai (not sure it will work)
import type { JsonStorage } from '@revenge-mod/json-storage'
import Settings, { DEFAULTS, type SilentEditStorage } from './settings'

const SENT_STATE = 'SENT'
const SILENT_EDIT_LABEL = 'Silent Edit'
const FILENAME_PATTERN = /\.filename\s+(\S+)/g

let storage: JsonStorage<SilentEditStorage> | undefined
// Set when the user taps "Silent Edit". The next editMessage call for this id is silent.
let pendingSilentEditId: string | null = null
// Own sent message whose long-press sheet is open right now (only when overrideNative is off).
let pending: { message: any } | null = null

// storage.cache is plain data; storage.use() is a React hook and must not be
// called from patched code.
function settings(): SilentEditStorage {
	return { ...DEFAULTS, ...(storage?.cache ?? {}) }
}

function currentUserId(): string | undefined {
	try {
		return (revenge as any).discord?.flux?.Stores?.UserStore?.getCurrentUser?.()
			?.id
	} catch {
		return undefined
	}
}

function toast(text: string, critical = false) {
	try {
		revenge.discord.actions?.ToastActionCreators?.open(
			`silent-edit-${Date.now()}`,
			{ text, ...(critical ? { variant: 'critical' } : {}) } as any,
		)
	} catch {}
}

function getHttp(): any {
	const [http] = revenge.modules.finders.lookupModule(
		revenge.modules.finders.filters.withProps('getAPIBaseURL', 'get', 'post'),
	)
	return http
}

// Same request shape the other plugins in this repo use: relative URLs, and
// failures come back as a response instead of a throw.
async function request(
	method: 'get' | 'post' | 'del',
	url: string,
	options: { body?: unknown; query?: Record<string, unknown> } = {},
): Promise<any> {
	const http = getHttp()
	if (!http) throw new Error('Discord request utilities are not available yet')

	const resp = await http[method]({
		url,
		...(options.body !== undefined ? { body: options.body } : {}),
		...(options.query !== undefined ? { query: options.query } : {}),
		oldFormErrors: true,
		rejectWithError: false,
	})
	if (!resp?.ok) {
		throw new Error(`Request failed (${resp?.status ?? 'no response'})`)
	}
	return resp
}

// Turns ".filename <path>" tokens in the text into attachments (max 10).
function parseAttachments(text: string): { content: string; attachments?: any[] } {
	const matches = [...text.matchAll(FILENAME_PATTERN)].slice(0, 10)
	if (matches.length === 0) return { content: text }

	const attachments = matches.map((match, index) => {
		const uploadedFilename = match[1]
		const filename = uploadedFilename.split('/').pop() || 'image.png'
		return { id: String(index), filename, uploaded_filename: uploadedFilename }
	})
	return {
		content: text.replace(FILENAME_PATTERN, '').trim(),
		attachments,
	}
}

function patchEditMessage(): () => void {
	const unpatch: Array<() => void> = []
	try {
		const stop = (revenge as any).discord.utils.modules.finders.getModuleWithImportedPath(
			'actions/MessageActionCreators.tsx',
			(ns: any) => {
				const owner = ns?.default ?? ns
				if (typeof owner?.editMessage !== 'function') return

				unpatch.push(
					revenge.patcher.instead(
						owner,
						'editMessage',
						async (args: any[], original: any) => {
							const [channelId, messageId, reqData] = args

							if (!settings().overrideNative && pendingSilentEditId !== messageId) {
								return original(...args)
							}
							pendingSilentEditId = null

							try {
								const fetched = await request(
									'get',
									`/channels/${channelId}/messages`,
									{ query: { limit: 1, around: messageId } },
								)
								const msg = Array.isArray(fetched.body)
									? fetched.body.find((m: any) => m.id === messageId)
									: undefined
								if (!msg) return original(...args)

								const text =
									typeof reqData?.content === 'string' ? reqData.content : ''
								const { content, attachments } = parseAttachments(text)

								const body: any = {
									content,
									nonce: messageId,
									tts: false,
									flags: msg.flags ?? 0,
									mobile_network_type: 'wifi',
								}
								if (attachments) body.attachments = attachments

								if (msg.message_reference) {
									body.message_reference = {
										message_id: msg.message_reference.message_id,
										channel_id: msg.message_reference.channel_id,
										guild_id: msg.message_reference.guild_id,
									}
									const repliedUser = msg.referenced_message?.author?.id
									const hasPing = repliedUser
										? msg.mentions?.some((m: any) => m.id === repliedUser)
										: false
									body.allowed_mentions = {
										replied_user: hasPing,
										parse: ['users', 'roles', 'everyone'],
									}
								}

								const response = await request(
									'post',
									`/channels/${channelId}/messages`,
									{ body },
								)
								await request('del', `/channels/${channelId}/messages/${messageId}`)
								return response
							} catch (err: any) {
								toast(
									'Error: ' + (err?.body?.message || err?.message || String(err)),
									true,
								)
								return original(...args)
							}
						},
					),
				)
			},
		)
		if (typeof stop === 'function') unpatch.push(stop)
	} catch (error) {
		console.error(error)
	}
	return () => {
		for (const fn of unpatch) fn?.()
	}
}

// Remembers whether the open long-press sheet belongs to an own sent message.
// Only relevant when overrideNative is off, because then the button is shown.
function patchOpenLazy(): () => void {
	const unpatch: Array<() => void> = []
	try {
		const stop = (revenge as any).discord.utils.modules.finders.getModuleWithImportedPath(
			'modules/action_sheet/native/ActionSheetActionCreators.tsx',
			(ns: any) => {
				const owner = ns?.default ?? ns
				if (typeof owner?.openLazy !== 'function') return

				unpatch.push(
					revenge.patcher.before(owner, 'openLazy', (args: any) => {
						const [, key, loc] = args ?? []
						const message =
							key === 'MessageLongPressActionSheet' ? loc?.message : null
						const isOwnSentMessage =
							!!message &&
							message.state === SENT_STATE &&
							message.author?.id === currentUserId()

						pending =
							isOwnSentMessage && !settings().overrideNative
								? { message }
								: null
						return args
					}),
				)
			},
		)
		if (typeof stop === 'function') unpatch.push(stop)
	} catch (error) {
		console.error(error)
	}
	return () => {
		for (const fn of unpatch) fn?.()
	}
}

function isEditRow(row: any): boolean {
	const label = row?.props?.label ?? row?.props?.message
	return typeof label === 'string' && label.toLowerCase().includes('edit')
}

// Finds the row array that contains a row matching `isTarget`.
function findRowGroup(tree: any, isTarget: (row: any) => boolean): any[] | null {
	if (!tree || typeof tree !== 'object') return null
	if (Array.isArray(tree)) {
		if (tree.some(isTarget)) return tree
		for (const child of tree) {
			const found = findRowGroup(child, isTarget)
			if (found) return found
		}
		return null
	}
	return findRowGroup(tree?.props?.children, isTarget)
}

// Puts "Silent Edit" right after the Edit row. It reuses the Edit row's
// component and icon, and calls its onPress after marking the message as silent.
function insertSilentEditRow(res: any, message: any): any {
	const group = findRowGroup(res, isEditRow)
	if (!group) return res

	const index = group.findIndex(isEditRow)
	const template = group[index]
	const Row = template?.type
	if (!Row) return res

	const editOnPress = template.props?.onPress
	const { React } = revenge.react
	const row = React.createElement(Row, {
		key: 'silent-edit',
		label: SILENT_EDIT_LABEL,
		icon: template.props?.icon,
		onPress: () => {
			pendingSilentEditId = message.id
			editOnPress?.()
		},
	})
	group.splice(index + 1, 0, row)
	return res
}

function wrapDefault(ns: any): () => void {
	const mod = ns?.default ?? ns
	if (typeof mod !== 'function') return () => {}

	const orig = mod
	const wrapped = (props: any) => {
		const res = orig(props)
		try {
			const p = pending
			return p ? insertSilentEditRow(res, p.message) : res
		} catch {
			return res
		}
	}
	ns.default = wrapped

	return () => {
		if (ns.default === wrapped) ns.default = orig
	}
}

function patchLongPressSheet(): () => void {
	const unpatch: Array<() => void> = []
	try {
		const stop = (revenge as any).discord.utils.modules.finders.getModuleWithImportedPath(
			'modules/messages/native/long_press/LongPressMessageActionSheet.tsx',
			(ns: any) => {
				unpatch.push(wrapDefault(ns))
			},
		)
		if (typeof stop === 'function') unpatch.push(stop)
	} catch (error) {
		console.error(error)
	}
	return () => {
		for (const fn of unpatch) fn?.()
	}
}

export default plugin<{ jsonStorage: SilentEditStorage }>({
	jsonStorage: {
		load: true,
		default: DEFAULTS,
	},
	start({ cleanup, jsonStorage, plugin }) {
		storage = jsonStorage

		try {
			cleanup(patchEditMessage())
		} catch (error) {
			plugin.reportError(error)
		}

		try {
			cleanup(patchOpenLazy())
		} catch (error) {
			plugin.reportError(error)
		}

		try {
			cleanup(patchLongPressSheet())
		} catch (error) {
			plugin.reportError(error)
		}
	},
	SettingsComponent: Settings,
})