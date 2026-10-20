import type { PluginApi } from '@revenge-mod/plugins/types'

export interface SilentDeleteStorage {
	replacementText: string
	deleteDelay: number
	suppressNotifications: boolean
	deleteOriginal: boolean
}

export const DEFAULTS: SilentDeleteStorage = {
	replacementText: '** **',
	deleteDelay: 200,
	suppressNotifications: true,
	deleteOriginal: true,
}

function InputRow({
	label,
	subLabel,
	value,
	placeholder,
	onChange,
}: {
	label: string
	subLabel?: string
	value: string
	placeholder?: string
	onChange: (value: string) => void
}) {
	const { View } = revenge.react.ReactNative
	const { TableRow, TextInput, Text } = revenge.discord.design.Design

	const labelNode = (
		<View style={{ flex: 1, gap: 4, paddingVertical: 4 }}>
			<Text variant="text-md/semibold">{label}</Text>
			<TextInput
				placeholder={placeholder}
				value={value}
				onChange={onChange}
			/>
			{subLabel ? (
				<Text variant="text-sm/medium" color="text-muted">
					{subLabel}
				</Text>
			) : null}
		</View>
	)

	return <TableRow label={labelNode as any} />
}

export default function Settings({
	api,
}: {
	api: PluginApi<{ jsonStorage: SilentDeleteStorage }>
}) {
	const { ScrollView } = revenge.react.ReactNative
	const { Stack, TableRowGroup, TableSwitchRow } = revenge.discord.design.Design

	const s = { ...DEFAULTS, ...(api.jsonStorage.use() ?? {}) }
	const set = (patch: Partial<SilentDeleteStorage>) =>
		api.jsonStorage.set({ ...s, ...patch })

	return (
		<ScrollView contentContainerStyle={{ padding: 0 }}>
			<Stack>
				<TableRowGroup title="Behavior">
					<InputRow
						label="Replacement text"
						subLabel="Text the message is swapped for before it is deleted."
						placeholder="** **"
						value={s.replacementText}
						onChange={v => set({ replacementText: v })}
					/>
					<TableSwitchRow
						label="Suppress notifications"
						subLabel="Stops the placeholder from pinging anyone it mentions."
						value={s.suppressNotifications}
						onValueChange={v => set({ suppressNotifications: v })}
					/>
					<TableSwitchRow
						label="Delete original message"
						subLabel="When off, the original message stays on the server. Only the placeholder is deleted."
						value={s.deleteOriginal}
						onValueChange={v => set({ deleteOriginal: v })}
					/>
				</TableRowGroup>

				<TableRowGroup title="Timing (milliseconds)">
					<InputRow
						label="Delete delay"
						subLabel="Wait before deleting the placeholder."
						placeholder="200"
						value={String(s.deleteDelay)}
						onChange={v => {
							const n = parseInt(v, 10)
							if (!Number.isNaN(n) && n >= 0) set({ deleteDelay: n })
						}}
					/>
				</TableRowGroup>
			</Stack>
		</ScrollView>
	)
}