import { registerTokenCommands } from './lib/commands'
import { patchOverflow } from './lib/overflow'
import { setUserStore } from './lib/token'

export default plugin({
	start({ cleanup, plugin }) {
		cleanup(
			revenge.discord.flux.getStore('UserStore', (store: any) => {
				setUserStore(store)
			}),
		)

		try {
			cleanup(patchOverflow())
		} catch (error) {
			plugin.reportError(error)
		}

		try {
			cleanup(registerTokenCommands(cleanup))
		} catch (error) {
			plugin.reportError(error)
		}
	},
})