import { ToastActionCreators } from '@revenge-mod/discord/actions'
import { lookupModule } from '@revenge-mod/modules/finders'
import { withProps } from '@revenge-mod/modules/finders/filters'

type TokenModule = {
	getToken(): string
}

type AccountSwitchModule = {
	switchAccountToken(token: string): unknown
}

let cachedUserStore: any

export function setUserStore(store: any): void {
	cachedUserStore = store
}

function getUserStore(): any {
	if (!cachedUserStore) {
		try {
			cachedUserStore = (revenge as any).discord?.flux?.Stores?.UserStore
		} catch {}
	}
	return cachedUserStore
}

export function getCurrentUserId(): string | undefined {
	try {
		return getUserStore()?.getCurrentUser?.()?.id
	} catch {
		return undefined
	}
}

export function getOwnToken(): string {
	const [tokenModule] = lookupModule(withProps<TokenModule>('getToken'))
	const token = tokenModule?.getToken?.()
	if (typeof token !== 'string' || token.length === 0) {
		throw new Error('Could not read the token of the current account.')
	}
	return token
}

export function switchAccount(token: string): void {
	const [switchModule] = lookupModule(
		withProps<AccountSwitchModule>('login', 'logout', 'switchAccountToken'),
	)
	if (!switchModule) {
		throw new Error('Could not find the account switching module.')
	}
	switchModule.switchAccountToken(token)
}

export function copyText(text: string): void {
	const clipboard = (revenge as any).externals?.ReactNativeClipboard?.Clipboard
	if (typeof clipboard?.setString !== 'function') {
		throw new Error('Clipboard is unavailable.')
	}
	clipboard.setString(text)
}

export function toast(text: string, critical = false): void {
	ToastActionCreators.open(`token-utils-${Date.now()}`, {
		text,
		...(critical ? { variant: 'critical' } : {}),
	} as any)
}

export function hideActionSheet(): void {
	try {
		;(revenge as any).discord?.actions?.ActionSheetActionCreators?.hideActionSheet?.()
	} catch {}
}