import { ToastActionCreators } from '@revenge-mod/discord/actions'
import { getAssetIdByName } from '@revenge-mod/assets'
import { lookupModule } from '@revenge-mod/modules/finders'
import { withProps } from '@revenge-mod/modules/finders/filters'
import { after, before, instead } from '@revenge-mod/patcher'
import { React } from '@revenge-mod/react'
import { findInTree } from '@revenge-mod/utils/tree'

import { DEFAULTS } from './defualts'
import SettingsComponent from './Settings'

type Settings = {
	overrideNative: boolean
}

let pendingSilentEditMessageId: string | null = null

function findModuleExports(filter: any): any {
	const result = lookupModule(filter, { returnNamespace: true })

	return result.length ? (result as any)[0] : undefined
}

function showError(message: string) {
	ToastActionCreators.open('SILENT_EDIT_ERROR', {
		text: message,
		variant: 'critical',
	})
}

function getErrorMessage(error: any): string {
	return (
		error?.body?.message ||
		error?.message ||
		String(error)
	)
}

export default plugin<{ jsonStorage: Settings }>({
	jsonStorage: {
		load: true,
		default: DEFAULTS,
	},

	start({ cleanup, jsonStorage, plugin }) {
		pendingSilentEditMessageId = null

		const RestAPI = findModuleExports(
			withProps('get', 'post', 'del', 'patch'),
		)

		const MessageActions = findModuleExports(
			withProps('editMessage'),
		)

		const UserStore = findModuleExports(
			withProps('getCurrentUser'),
		)

		const LazyActionSheet = findModuleExports(
			withProps('openLazy', 'hideActionSheet'),
		)

		const ActionSheetModule = findModuleExports(
			withProps('ActionSheetRow'),
		)

		const ActionSheetRow = ActionSheetModule?.ActionSheetRow
		const EditIcon = getAssetIdByName('PencilIcon')

		if (
			RestAPI &&
			typeof RestAPI.get === 'function' &&
			typeof RestAPI.post === 'function' &&
			typeof RestAPI.del === 'function' &&
			typeof MessageActions?.editMessage === 'function'
		) {
			cleanup(
				instead(
					MessageActions,
					'editMessage',
					async (args, original) => {
						const [channelId, messageId, reqData] = args as any[]

						if (
							!jsonStorage.cache?.overrideNative &&
							pendingSilentEditMessageId !== messageId
						) {
							return original(...args)
						}

						pendingSilentEditMessageId = null

						if (
							typeof channelId !== 'string' ||
							typeof messageId !== 'string' ||
							typeof reqData?.content !== 'string'
						) {
							return original(...args)
						}

						try {
							const originalMessage = await RestAPI.get({
								url: `/channels/${channelId}/messages`,
								query: {
									limit: 1,
									around: messageId,
								},
							})

							const msgArray = originalMessage?.body

							if (!Array.isArray(msgArray)) {
								return original(...args)
							}

							const msg = msgArray.find(
								(item: any) => item.id === messageId,
							)

							if (!msg) {
								return original(...args)
							}

							let content: string = reqData.content

							const regex = /\.filename\s+(\S+)/g
							let matches = [...content.matchAll(regex)]

							let attachments:
								| {
										id: string
										filename: string
										uploaded_filename: string
								  }[]
								| undefined

							if (matches.length > 0) {
								matches = matches.slice(0, 10)

								attachments = matches.map((match, index) => {
									const uploadedFilename = match[1]
									const filename =
										uploadedFilename.split('/').pop() ||
										'image.png'

									return {
										id: String(index),
										filename,
										uploaded_filename: uploadedFilename,
									}
								})

								content = content
									.replace(/\.filename\s+\S+/g, '')
									.trim()
							}

							const body: Record<string, any> = {
								content,
								nonce: messageId,
								tts: false,
								flags: msg.flags ?? 0,
								mobile_network_type: 'wifi',
							}

							if (attachments) {
								body.attachments = attachments
							}

							if (msg.message_reference) {
								body.message_reference = {
									message_id:
										msg.message_reference.message_id,
									channel_id:
										msg.message_reference.channel_id,
									guild_id:
										msg.message_reference.guild_id,
								}

								const repliedUser =
									msg.referenced_message?.author?.id

								const hasPing = repliedUser
									? msg.mentions?.some(
											(mention: any) =>
												mention.id === repliedUser,
										)
									: false

								body.allowed_mentions = {
									replied_user: hasPing,
									parse: ['users', 'roles', 'everyone'],
								}
							}

							const response = await RestAPI.post({
								url: `/channels/${channelId}/messages`,
								body,
							})

							await RestAPI.del({
								url: `/channels/${channelId}/messages/${messageId}`,
							})

							return response
						} catch (error: unknown) {
							showError(getErrorMessage(error))
							return original(...args)
						}
					},
				),
			)
		} else {
			plugin.reportError(
				new Error(
					'Silent Edit could not find the required message or REST API modules.',
				),
			)
		}

		
		if (
			LazyActionSheet &&
			typeof LazyActionSheet.openLazy === 'function'
		) {
			cleanup(
				before(
					LazyActionSheet,
					'openLazy',
					([component, key, msg]: any[]) => {
						if (jsonStorage.cache?.overrideNative ?? true) {
							return
						}

						const message = msg?.message

						if (
							key !== 'MessageLongPressActionSheet' ||
							!message
						) {
							return
						}

						pendingSilentEditMessageId = null

						const currentUser = UserStore?.getCurrentUser()

						if (
							!currentUser ||
							message.author?.id !== currentUser.id
						) {
							return
						}

						if (
							!component ||
							typeof component.then !== 'function'
						) {
							return
						}

						void component
							.then((instance: any) => {
								if (
									!instance ||
									typeof instance.default !== 'function'
								) {
									return
								}

								const unpatch = after(
									instance,
									'default',
									(comp: any) => {
										React.useEffect(
											() => () => unpatch(),
											[],
										)

										const groups = findInTree(
											comp as any,
											(c: any) =>
												Array.isArray(c) &&
												c[0]?.type?.name ===
													'ActionSheetRowGroup',
										) as any[] | undefined

										if (!groups?.length) {
											return comp
										}

										let editRowOnPress: any = null
										let targetGroupChildren:
											| any[]
											| null = null
										let targetIndex = -1

										for (const group of groups) {
											const groupChildren =
												findInTree(
													group as any,
													(c: any) =>
														Array.isArray(c) &&
														c.some(
															(child: any) =>
																child?.type
																	?.name ===
																'ActionSheetRow',
														),
												) as any[] | undefined

											if (!groupChildren) continue

											const editRowIndex =
												groupChildren.findIndex(
													(child: any) => {
														const label = String(
															child?.props?.label ??
																child?.props
																	?.message ??
																'',
														).toLowerCase()

														return label.includes(
															'edit',
														)
													},
												)

											if (editRowIndex < 0) continue

											editRowOnPress =
												groupChildren[editRowIndex]
													?.props?.onPress

											targetGroupChildren =
												groupChildren

											targetIndex = editRowIndex
											break
										}

										if (
											typeof editRowOnPress !==
												'function' ||
											!targetGroupChildren ||
											!ActionSheetRow
										) {
											return comp
										}

										const IconComponent =
											ActionSheetRow.Icon

										const silentEditBtn =
											React.createElement(
												ActionSheetRow,
												{
													label: 'Silent Edit',
													icon: IconComponent
														? React.createElement(
																IconComponent,
																{
																	source:
																		EditIcon,
																},
															)
														: undefined,
													onPress: () => {
														pendingSilentEditMessageId =
															message.id

														editRowOnPress()
													},
												},
											)

										targetGroupChildren.splice(
											targetIndex + 1,
											0,
											silentEditBtn,
										)

										return comp
									},
								)

								cleanup(unpatch)
							})
							.catch((error: unknown) => {
								plugin.reportError(error)
							})
					},
				),
			)
		} else {
			plugin.reportError(
				new Error(
					'Silent Edit could not find the action sheet module.',
				),
			)
		}
	},

	SettingsComponent,
})