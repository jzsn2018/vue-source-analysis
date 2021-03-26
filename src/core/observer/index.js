/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer类会附属在每一个observe对象上。一旦附属上，observer实例就会转换目标对象的每一个属性
 * 变成 getter 和 setter；其目的就是为了收集依赖和派发更新
 * 
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
  value: any;
  dep: Dep;
  //* 实例（含有根 $data 属性的对象 ）计数器
  vmCount: number; // number of vms that have this object as root $data 

  constructor (value: any) {
    this.value = value
    this.dep = new Dep() //* dep 属性 是 一个 Dep 实例
    this.vmCount = 0
    //! 将Observer实例 挂载到观察对象 __ob__
    def(value, '__ob__', this) //! 这里设置了  enumerable 可枚举 false，阻止 __ob__ 属性被 value 属性循环枚举出来
    //* 数组响应式 处理
    if (Array.isArray(value)) {
      //* arrayMethods 中，里面已经对 array 中的会改变原数组的方法 进行修补了
      if (hasProto) {
        protoAugment(value, arrayMethods)
      } else {
        copyAugment(value, arrayMethods, arrayKeys)
      }
      //* 为数组的每一项添加 observe(value[i])
      //* observe函数里面有判断的 Array.isArray(value) || isPlainObject(value)才会进行添加 Observer实例
      this.observeArray(value)
    } else {
      //* 对象数据类型 遍历每一个属性 转换成 setter / getter
      this.walk(value)
    }
  }

  //* 遍历所有的属性，将其转换成getter 和 setter
  //* walk方法只有当 value 是对象的时候才会被 调用
  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i]) //* 添加依赖 dep
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {
    //* 遍历数组中的成员，添加响应式（items[i] 需要是 object 否则在函数中会被 return 出来）
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  //* 传递的value数据不是 对象 以及 value 是 VNode虚拟DOM的时候，就 不需要进行响应式数据处理
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  //* 缓存处理 存在 __ob__ 属性，以及 __ob__ 属性是否是 Observer 的实例
  //* __ob__ 是在 Observer类里面定义的
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__ //* 返回已经存在的ob实例
  } else if (
    //* 判断当前传递的value是否可以被observer
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) && //* 判断value是否数组或者普通的对象
    Object.isExtensible(value) && //* 判断 value 是否可以扩展， 不能扩展的话，返回的ob就是undefined
    !value._isVue //* 不对 vue实例 进行 observer
  ) {
    ob = new Observer(value) //* 创建 observer
  }
  if (asRootData && ob) {
    //* 处理根数据的时候，给计数 vmCount++
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 */
//* 为一个对象定义响应式属性
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean //* 浅的 true 的时候，只转换一层
) {
  //* 创建依赖对象实例
  const dep = new Dep()
  //* 获取传递的obj对象的key属性的属性描述符
  const property = Object.getOwnPropertyDescriptor(obj, key)
  //* 当前属性 不可配置 的时候， 直接返回 
  if (property && property.configurable === false) {
    return
  }

  //* 提供预定义的 getter 和 setter；
  //* 如果传递的属性本身就是定义了 getter 和 setter的时候，会先备份一下getter 和 setter，
  //* 在重写这个属性的getter和setter的时候会在特定时机使用
  // cater for pre-defined getter/setters
  const getter = property && property.get
  const setter = property && property.set
  //* 获取当前 属性key 对应的 value 值
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }
  //* 判断是否 递归 观察子对象，并将子对象的属性都转换成 getter 和 setter ， 返回子观察对象
  let childOb = !shallow && observe(val)
  //* 将属性转换 成 getter 和 setter
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      //* 当前属性预定义了getter存在，那么属性的value就等于getter执行之后的结果
      //* 否则直接等于 obj[key]
      const value = getter ? getter.call(obj) : val
      //* 如果存在当前依赖目标，即 Watcher对象 ，则建立依赖
      //! 在 Watcher中赋值的 pushTarget
      if (Dep.target) {
        dep.depend()
        //* 如果子观察目标存在，建立子对象的依赖关系
        if (childOb) {
          childOb.dep.depend()
          //* 如果属性是对象的时候，做特殊处理
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      if (getter && !setter) return
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      childOb = !shallow && observe(newVal)
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  defineReactive(ob.value, key, val)
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
