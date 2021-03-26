/* @flow */

import { toArray } from '../util/index'

export function initUse (Vue: GlobalAPI) {
  Vue.use = function (plugin: Function | Object) {
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    //* additional parameters 获取 Vue.use额外的参数
    //* 多传递的参数将 传递给 plugin 函数中
    const args = toArray(arguments, 1)
    args.unshift(this)
    //* plugin 是一个含有install属性函数的对象的
    if (typeof plugin.install === 'function') {
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
    //* plugin 是一个函数
      plugin.apply(null, args)
    }
    installedPlugins.push(plugin)
    return this
  }
}
