import type { JsonStorage } from '@revenge-mod/json-storage'
import Settings, { DEFAULTS, type SilentDeleteStorage } from './settings'

const ROW_LABEL = 'Silent Delete'
const SENT_STATE = 'SENT'
// Discord message flag: SUPPRESS_NOTIFICATIONS.
const SUPPRESS_NOTIFICATIONS_FLAG = 4096

let storage: JsonStorage<SilentDeleteStorage> | undefined
// The message whose long-press sheet is open right now, if it is ours.
let pending: { message: any; channelId: string } | null = null

// storage.cache is plain data; storage.use() is a React hook and must not be
// called from patched code.
function settings(): SilentDeleteStorage {
	return { ...DEFAULTS, ...(storage?.cache ?? {}) }
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function currentUserId(): string | undefined {
	try {
		return (revenge as any).discord?.flux?.Stores?.UserStore?.getCurrentUser?.()
			?.id
	} catch {
		return undefined
	}
}

function hideSheet() {
	try {
		revenge.discord.actions?.ActionSheetActionCreators?.hideActionSheet?.()
	} catch {}
}

function toast(text: string, critical = false) {
	try {
		revenge.discord.actions?.ToastActionCreators?.open(
			`silent-delete-${Date.now()}`,
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
async function call(
	method: 'post' | 'del',
	url: string,
	body?: unknown,
): Promise<any> {
	const http = getHttp()
	if (!http) throw new Error('Discord request utilities are not available yet')

	const resp = await http[method]({
		url,
		...(body !== undefined ? { body } : {}),
		oldFormErrors: true,
		rejectWithError: false,
	})
	if (!resp?.ok) {
		throw new Error(`Request failed (${resp?.status ?? 'no response'})`)
	}
	return resp
}

async function silentDelete(channelId: string, messageId: string) {
	const s = settings()
	try {
		const placeholder = await call('post', `/channels/${channelId}/messages`, {
			content: s.replacementText,
			flags: s.suppressNotifications ? SUPPRESS_NOTIFICATIONS_FLAG : 0,
			mobile_network_type: 'unknown',
			nonce: messageId,
			tts: false,
		})

		await sleep(s.deleteDelay)
		await call('del', `/channels/${channelId}/messages/${placeholder.body.id}`)

		await sleep(100)
		if (s.deleteOriginal) {
			await call('del', `/channels/${channelId}/messages/${messageId}`)
		}
	} catch (error) {
		console.error(error)
		toast('Silent Delete failed', true)
	}
}

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

						pending = isOwnSentMessage
							? {
									message,
									channelId: loc?.channel?.id ?? message.channel_id,
								}
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

function isDeleteRow(row: any): boolean {
	return row?.props?.variant === 'danger'
}

// Finds the row array that holds Discord's destructive "Delete" row.
function findDeleteGroup(tree: any): any[] | null {
	if (!tree || typeof tree !== 'object') return null
	if (Array.isArray(tree)) {
		if (tree.some(isDeleteRow)) return tree
		for (const child of tree) {
			const found = findDeleteGroup(child)
			if (found) return found
		}
		return null
	}
	return findDeleteGroup(tree?.props?.children)
}

// Puts "Silent Delete" directly above the Delete row. It reuses that row's
// component and icon, so it looks the same as the rows around it.
function insertRow(res: any, message: any, channelId: string): any {
	const group = findDeleteGroup(res)
	if (!group) return res

	const index = group.findIndex(isDeleteRow)
	const template = group[index]
	const Row = template?.type
	if (!Row) return res

	const { React } = revenge.react
	const row = React.createElement(Row, {
		key: 'silent-delete',
		label: ROW_LABEL,
		variant: 'danger',
		icon: template.props?.icon,
		onPress: () => {
			hideSheet()
			void silentDelete(channelId, message.id)
		},
	})
	group.splice(index, 0, row)
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
			return p ? insertRow(res, p.message, p.channelId) : res
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

export default plugin<{ jsonStorage: SilentDeleteStorage }>({
	jsonStorage: {
		load: true,
		default: DEFAULTS,
	},
	start({ cleanup, jsonStorage, plugin }) {
		storage = jsonStorage

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