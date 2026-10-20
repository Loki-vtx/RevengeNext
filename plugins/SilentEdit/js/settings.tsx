import type { PluginApi } from '@revenge-mod/plugins/types'

export interface SilentEditStorage {
	// true: every edit is sent as a silent edit.
	// false: the long-press menu shows a "Silent Edit" button next to "Edit".
	overrideNative: boolean
}

export const DEFAULTS: SilentEditStorage = {
	overrideNative: true,
}

export default function Settings({
	api,
}: {
	api: PluginApi<{ jsonStorage: SilentEditStorage }>
}) {
	const { ScrollView } = revenge.react.ReactNative
	const { Stack, TableRowGroup, TableSwitchRow } = revenge.discord.design.Design

	const s = { ...DEFAULTS, ...(api.jsonStorage.use() ?? {}) }

	return (
		<ScrollView contentContainerStyle={{ padding: 0 }}>
			<Stack>
				<TableRowGroup title="Settings">
					<TableSwitchRow
						label="Inject Original Edit"
						subLabel="Replace the original edit with a silent edit. When off, a Silent Edit button appears in the message menu."
						value={s.overrideNative}
						onValueChange={v => api.jsonStorage.set({ ...s, overrideNative: v })}
					/>
				</TableRowGroup>
			</Stack>
		</ScrollView>
	)
}