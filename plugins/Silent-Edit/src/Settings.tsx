import Page from '@revenge-mod/components/Page'
import { Design } from '@revenge-mod/discord/design'
import type { ComponentProps } from 'react'
import type { PluginSettingsComponent } from '@revenge-mod/plugins/types'

type Settings = {
	overrideNative?: boolean
}

type Props = ComponentProps<
	PluginSettingsComponent<{ jsonStorage: Settings }>
>

const { TableRowGroup, TableSwitchRow } = Design

export default function SettingsComponent({
	api: { jsonStorage },
}: Props) {
	const settings = jsonStorage.use()

	return (
		<Page>
			<TableRowGroup title="Silent Edit">
				<TableSwitchRow
					label="Inject Original Edit"
					subLabel="Replace the original edit with Silent Edit."
					value={settings.overrideNative ?? true}
					onValueChange={value =>
						jsonStorage.set({ overrideNative: value })
					}
				/>
			</TableRowGroup>
		</Page>
	)
}
