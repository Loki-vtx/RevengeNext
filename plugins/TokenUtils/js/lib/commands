import { getModules } from '@revenge-mod/modules/finders'
import { withProps } from '@revenge-mod/modules/finders/filters'
import { instead } from '@revenge-mod/patcher'
import { copyText, getOwnToken, switchAccount, toast } from './token'

type BuiltInCommandOption = {
	name: string
	displayName: string
	untranslatedName: string
	description: string
	displayDescription: string
	untranslatedDescription: string
	type: number
	required: boolean
}

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
	options: BuiltInCommandOption[]
	execute: (args: unknown, context: unknown) => Promise<void>
}

type BuiltInCommandsModule = {
	getBuiltInCommands(type: unknown, ...args: unknown[]): unknown[]
}

// Discord option type 3 is STRING.
const STRING_OPTION = 3

function optionValue(args: unknown, name: string): string | undefined {
	if (!Array.isArray(args)) return undefined
	const option = args.find((arg: any) => arg?.name === name)
	return typeof option?.value === 'string' ? option.value.trim() : undefined
}

function reportCommandError(error: unknown, failure: string): void {
	console.error(error)
	toast(failure, true)
}

function buildCommands(): BuiltInCommand[] {
	const getDescription = 'Copies your current account token to the clipboard.'
	const loginDescription = 'Switches to an account using its token.'

	return [
		{
			id: '',
			name: 'token-get',
			displayName: 'token-get',
			untranslatedName: 'token-get',
			description: getDescription,
			displayDescription: getDescription,
			untranslatedDescription: getDescription,
			applicationId: '-1',
			inputType: 1,
			type: 1,
			options: [],
			execute: async () => {
				try {
					copyText(getOwnToken())
					toast('Copied your token to the clipboard')
				} catch (error) {
					reportCommandError(error, 'Could not copy your token')
				}
			},
		},
		{
			id: '',
			name: 'token-login',
			displayName: 'token-login',
			untranslatedName: 'token-login',
			description: loginDescription,
			displayDescription: loginDescription,
			untranslatedDescription: loginDescription,
			applicationId: '-1',
			inputType: 1,
			type: 1,
			options: [
				{
					name: 'token',
					displayName: 'token',
					untranslatedName: 'token',
					description: 'Token of the account to switch to',
					displayDescription: 'Token of the account to switch to',
					untranslatedDescription: 'Token of the account to switch to',
					type: STRING_OPTION,
					required: true,
				},
			],
			execute: async (args: unknown) => {
				const token = optionValue(args, 'token')
				if (!token) {
					toast('Enter a token to switch accounts', true)
					return
				}
				try {
					switchAccount(token)
					toast('Switching accounts…')
				} catch (error) {
					reportCommandError(error, 'Failed to switch accounts')
				}
			},
		},
	]
}

/**
 * Adds the token commands to the built-in command list.
 *
 * Same approach as GIF Roulette: wrap `getBuiltInCommands` and append our
 * commands when the caller asks for type 1 (the chat input commands).
 */
export function registerTokenCommands(cleanup: (dispose: () => void) => unknown) {
	const commands = buildCommands()

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

			// Negative IDs that sit below the built-ins. The offset keeps us clear
			// of GIF Roulette, which uses min(-1, ...ids) - 1.
			const base = Math.min(-1, ...ids) - 100
			commands.forEach((command, index) => {
				command.id = String(base - index)
			})

			cleanup(
				instead(module, 'getBuiltInCommands', ([type, ...args], original) => {
					const result = original(type, ...args)
					if (!Array.isArray(result)) return result

					const wantsChatCommands = Array.isArray(type)
						? type.includes(1)
						: type === 1

					return wantsChatCommands ? [...result, ...commands] : result
				}),
			)
		},
		{ max: 1 },
	)
}