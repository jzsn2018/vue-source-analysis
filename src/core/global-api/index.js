/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'
import { observe } from 'core/observer/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

export function initGlobalAPI (Vue: GlobalAPI) {
  // config
  //* 通过 Object.defineProperty() 初始化Vue config静态属性
  const configDef = {}
  configDef.get = () => config
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        //? 警告不要对 Vue.config  静态属性进行覆盖
        'Do not replace the Vue.config object, set individual fields instead.' 
      )
    }
  }
  Object.defineProperty(Vue, 'config', configDef)

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  //* 2.6 explicit observable API 明确的响应式 Api observable
  Vue.observable = <>(obj: T): T => {
    observe(obj)
    return obj
  }
  //* 初始化一个options对象，通过Object.create创建一个原型对象为null的对象（提升性能）
  Vue.options = Object.create(null)
  // ['component','directive','filter']
  ASSET_TYPES.forEach(type => {
    //* 给options对象挂载属性'component','directive','filter' 属性
    //* 其实这里就是在注册组件、注册指令、注册过滤器 
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  //* 记录Vue构造函数
  Vue.options._base = Vue
//* 浅拷贝 ，将 builtInComponents 拷贝给 Vue.options.components
//* 这里是 为了 注册 KeepAlive 组件
  extend(Vue.options.components, builtInComponents)
//* 注册 Vue.use -- 注册插件的方法
  initUse(Vue)
//* 注册 Vue.mixin() 实现混入
  initMixin(Vue)
//* 注册 Vue.extend() 基于传入的options返回一个组件的构造函数 （ 自定义组件 应用）
  initExtend(Vue)
// * 注册 Vue.directive() 、Vue.component() 、Vue.filter()
//* 因为上面三者使用的方式都是一样的，所以使用了通用的实现器
  initAssetRegisters(Vue)
}
