import { makeFakeToken } from './fakeToken'
import {
	copyText,
	getCurrentUserId,
	getOwnToken,
	hideActionSheet,
	toast,
} from './token'

const COPY_LABEL = 'Copy Token'
const PROFILE_OVERFLOW_PATH =
	'modules/user_profile/native/UserProfileOverflowMenu.tsx'

function isMenuItem(item: any): boolean {
	return (
		!!item &&
		typeof item === 'object' &&
		typeof item.label === 'string' &&
		typeof item.action === 'function'
	)
}

function isCategory(category: any): boolean {
	return (
		Array.isArray(category) && category.length > 0 && isMenuItem(category[0])
	)
}

// The profile overflow ContextMenu: props.items is an array of categories,
// each one an array of { label, action } objects.
function isOverflowMenu(element: any): boolean {
	const p = element?.props
	return (
		!!p &&
		Array.isArray(p.items) &&
		p.items.length >= 2 &&
		typeof p.children === 'function' &&
		typeof p.onOpen === 'function' &&
		isCategory(p.items[0]) &&
		(isCategory(p.items[1]) ||
			(Array.isArray(p.items[1]) && p.items[1].length === 0))
	)
}

function findMenu(tree: any): any {
	if (tree == null || typeof tree !== 'object') return null
	if (isOverflowMenu(tree)) return tree
	if (Array.isArray(tree)) {
		for (const child of tree) {
			const found = findMenu(child)
			if (found) return found
		}
		return null
	}
	return findMenu(tree?.props?.children)
}

function rebuild(tree: any, target: any, replacement: any, React: any): any {
	if (tree == null || typeof tree !== 'object') return tree
	if (tree === target) return replacement
	if (Array.isArray(tree)) {
		const next = tree.map(child => rebuild(child, target, replacement, React))
		return next.some((node, index) => node !== tree[index]) ? next : tree
	}
	const children = tree?.props?.children
	if (children != null && typeof children === 'object') {
		const nextChildren = rebuild(children, target, replacement, React)
		if (nextChildren !== children) {
			return React.cloneElement(tree, { children: nextChildren })
		}
	}
	return tree
}

function displayName(user: any): string {
	return (
		user?.globalName ??
		user?.username ??
		user?.user?.globalName ??
		user?.user?.username ??
		'user'
	)
}

function copyItem(targetId: string, name: string, isSelf: boolean): any {
	return {
		label: COPY_LABEL,
		variant: 'destructive',
		action: () => {
			try {
				if (isSelf) {
					copyText(getOwnToken())
					toast('Copied your token')
				} else {
					copyText(makeFakeToken(targetId))
					toast(`Copied token of ${name}`)
				}
			} catch (error) {
				console.error(error)
				toast('Could not copy the token', true)
			}
			hideActionSheet()
		},
	}
}

function inject(res: any, props: any): any {
	if (!res || typeof res !== 'object') return res
	try {
		const menu = findMenu(res)
		if (!menu) return res

		const items: any[] = menu.props.items
		const user = props?.user
        console.log('TokenUtils props', Object.keys(props ?? {}), props?.user)
		const targetId: string | undefined = user?.id ?? user?.user?.id
		const ownId = getCurrentUserId()
		// Without a known current user we cannot tell our own profile apart.
		if (!targetId || !ownId) return res

		const alreadyInjected = items.some(
			(category: any) =>
				Array.isArray(category) &&
				category.some((item: any) => item?.label === COPY_LABEL),
		)
		if (alreadyInjected) return res

		const React = (revenge as any).react?.React
		if (!React) return res

		const isSelf = targetId === ownId
		const item = copyItem(targetId, displayName(user), isSelf)

		// The original plugin put the option at the top of the first group.
		const nextItems = [[item, ...items[0]], ...items.slice(1)]
		const nextMenu = React.cloneElement(menu, { items: nextItems })
		return rebuild(res, menu, nextMenu, React)
	} catch {
		return res
	}
}

function installWrapper(ns: any): () => void {
	const mod = ns?.default ?? ns
	if (typeof mod !== 'function') return () => {}

	const orig = mod
	const wrapped = (props: any) => {
		const element = orig(props)
		try {
			return inject(element, props)
		} catch {
			return element
		}
	}
	;(wrapped as any).displayName = 'TokenUtilsUserProfileOverflowMenu'
	ns.default = wrapped

	return () => {
		if (ns.default === wrapped) ns.default = orig
	}
}

export function patchOverflow(): () => void {
	const unpatch: Array<() => void> = []
	try {
		const stop = (revenge as any).discord.utils.modules.finders.getModuleWithImportedPath(
			PROFILE_OVERFLOW_PATH,
			(ns: any) => {
				unpatch.push(installWrapper(ns))
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