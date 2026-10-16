// yes ai helped me coding some shit here but not everything.

import { ToastActionCreators } from '@revenge-mod/discord/actions'
import { lookupModule, getModules } from '@revenge-mod/modules/finders'
import { withProps } from '@revenge-mod/modules/finders/filters'
import { instead } from '@revenge-mod/patcher'

type BuiltInCommand = {
	id: string
	name: string
	displayName: string
	untranslatedName: string
	description: string
	displayDescription: string
	untranslatedDescription: string
	applicationId: string
	inputType: number
	type: number
	options: unknown[]
	execute: (args: unknown, context: unknown) => Promise<void>
}

type BuiltInCommandsModule = {
	getBuiltInCommands(type: unknown, ...args: unknown[]): unknown[]
}

type MessageModule = {
	sendMessage(
		channelId: string,
		message: { content: string },
		options?: unknown,
		extra?: { nonce: string },
	): unknown
	editMessage: (...args: unknown[]) => unknown
}

type FrecencyModule = {
	FrecencyUserSettingsActionCreators?: {
		getCurrentValue?: () => unknown
	}
}

function getRandomFavoriteGif(): string {
	const [settingsModule] = lookupModule(
		withProps<FrecencyModule>('FrecencyUserSettingsActionCreators'),
	)

	const settings =
		settingsModule?.FrecencyUserSettingsActionCreators?.getCurrentValue?.()

	if (typeof settings !== 'object' || settings === null) {
		throw new Error('Could not read your favorite GIFs.')
	}

	if (!('favoriteGifs' in settings)) {
		throw new Error('Could not find your favorite GIFs.')
	}

	const favorites = settings.favoriteGifs

	if (
		typeof favorites !== 'object' ||
		favorites === null ||
		!('gifs' in favorites) ||
		typeof favorites.gifs !== 'object' ||
		favorites.gifs === null
	) {
		throw new Error(
			"You don't have any favorite GIFs! Favorite some GIFs in Discord first.",
		)
	}

	const urls = Object.keys(favorites.gifs)

	if (urls.length === 0) {
		throw new Error(
			"You don't have any favorite GIFs! Favorite some GIFs in Discord first.",
		)
	}

	return urls[Math.floor(Math.random() * urls.length)]
}

function registerGifRoulette(
	cleanup: (dispose: () => void) => unknown,
	execute: (args: unknown, context: unknown) => Promise<void>,
) {
	return getModules(
		withProps<BuiltInCommandsModule>('getBuiltInCommands'),
		module => {
			let builtIns: unknown[]

			try {
				builtIns = module.getBuiltInCommands(1, true, false)
			} catch {
				builtIns = module.getBuiltInCommands([1], true, false)
			}

			const ids = builtIns.flatMap(command => {
				if (
					typeof command !== 'object' ||
					command === null ||
					!('id' in command) ||
					typeof command.id !== 'string'
				) {
					return []
				}

				const id = Number(command.id)
				return Number.isSafeInteger(id) ? [id] : []
			})

			const description =
				'Sends a random GIF from your favorite GIFs.'

			const command: BuiltInCommand = {
				id: String(Math.min(-1, ...ids) - 1),
				name: 'gifroulette',
				displayName: 'GIF Roulette',
				untranslatedName: 'gifroulette',
				description,
				displayDescription: description,
				untranslatedDescription: description,
				applicationId: '-1',
				inputType: 1,
				type: 1,
				options: [],
				execute,
			}

			cleanup(
				instead(
					module,
					'getBuiltInCommands',
					([type, ...args], original) => {
						const result = original(type, ...args)

						if (!Array.isArray(result)) return result

						if (
							Array.isArray(type)
								? type.includes(1)
								: type === 1
						) {
							return [...result, command]
						}

						return result
					},
				),
			)
		},
		{ max: 1 },
	)
}

// THANK YOU btmc727 >333

export default plugin({
	start({ cleanup, plugin }) {
		cleanup(
			registerGifRoulette(cleanup, async (_args, context) => {
				try {
					if (
						typeof context !== 'object' ||
						context === null ||
						!('channel' in context) ||
						typeof context.channel !== 'object' ||
						context.channel === null ||
						!('id' in context.channel) ||
						typeof context.channel.id !== 'string'
					) {
						throw new Error('Could not find the current channel.')
					}

					const channelId = context.channel.id
					const content = getRandomFavoriteGif()

					const [messageModule] = lookupModule(
						withProps<MessageModule>(
							'sendMessage',
							'editMessage',
						),
					)

					if (!messageModule) {
						throw new Error(
							'Could not find the message sending module.',
						)
					}

					messageModule.sendMessage(
						channelId,
						{ content },
						undefined,
						{ nonce: Date.now().toString() },
					)
				} catch (error) {
					plugin.reportError(error)

					ToastActionCreators.open('GIF_ROULETTE_ERROR', {
						text:
							error instanceof Error
								? error.message
								: 'Could not send a random favorite GIF.',
						variant: 'critical',
					})
				}
			}),
		)
	},
})
