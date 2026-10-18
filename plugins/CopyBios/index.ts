// tes5 fucked up code, the first one had some little problems with start and cleanuo shit, and something helped me fixing it ig....
import { getModules } from '@revenge-mod/modules/finders'
import { withName } from '@revenge-mod/modules/finders/filters'
import { ReactNative } from '@revenge-mod/react'
import { after } from '@revenge-mod/patcher'

function textSelection(node: any): void {
    if (!node || typeof node !== 'object') return

    if (node.type === ReactNative.Text && node.props) {
        node.props.selectable = true

        if (typeof node.props.onPress !== 'function') {
            node.props.onPress = () => {}
        }
    }

    const children = node.props?.children

    if (Array.isArray(children)) {
        for (const child of children) {
            textSelection(child)
        }
    } else if (children && typeof children === 'object') {
        textSelection(children)
    }
}

export default plugin({
    start({ cleanup, plugin }) {
        cleanup(
            getModules(
                withName('BioText'),
                module => {
                    if (
                        !('default' in module) ||
                        typeof module.default !== 'function'
                    ) {
                        return
                    }

                    cleanup(
                        after(module, 'default', result => {
                            if (!result?.props) return result

                            result.props.selectable = true

                            if (
                                typeof result.props.onPress !== 'function'
                            ) {
                                result.props.onPress = () => {}
                            }

                            textSelection(result)

                            return result
                        }),
                    )
                },
                {
                    returnNamespace: true,
                    max: 1,
                },
            ),
        )

        if (plugin.startedLate) {
            plugin.requireReload()
        }
    },
})
// alao dont ask why theres this if plugin stared late...  just me fcking around}