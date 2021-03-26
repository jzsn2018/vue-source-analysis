/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { isPlainObject, validateComponentName } from '../util/index'

export function initAssetRegisters (Vue: GlobalAPI) {
  /**
   * Create asset registration methods.
   */
  // directive component filter
  ASSET_TYPES.forEach(type => {
    Vue[type] = function (
      id: string,
      definition: Function | Object
    ): Function | Object | void {
      if (!definition) {
        //* 只传递 id的话，就是获取的功能了（例如 获取 component directive filter）
        return this.options[type + 's'][id]
      } else {
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production' && type === 'component') {
          validateComponentName(id)
        }
        if (type === 'component' && isPlainObject(definition) /* 判断是否是原始对象 toString返回的结果是不是 [[object Object]] */) {
          definition.name = definition.name || id // 给组件 设置 名称 默认是传递的第一个id参数作为component name
          // ._base 是 Vue构造函数 
          definition = this.options._base.extend(definition) // 会将普通对象传递给 VueComponent构造函数，并返回VueComponent构造函数本身
        }
        if (type === 'directive' && typeof definition === 'function') {
          definition = { bind: definition, update: definition } // * Vue指令的，如果第二个参数是函数的话，直接赋值给 bind 和 update 两个钩子函数
        }
        //* 全局注册，并赋值
        this.options[type + 's'][id] = definition
        return definition // 返回传递的第二个参数 Function | Object
      }
    }
  })
}
