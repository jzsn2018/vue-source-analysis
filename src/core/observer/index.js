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
    //* 只在处理 data的时候  ob.vmCount++ 了
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
    //* target是undefined或者原始值的话，会抛出错误。不允许这样操作
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  //* 当target是数组传递的key又是合法的索引时（大于等于0的正整数且有边界 isFinite()）
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key) //* 取数组长度以及传递的索引之间最大值
    target.splice(key, 1, val)//! 通过 set在为数组增加项的时候是通过 splice方法去实现
    return val
  }
  //* key已经是 target 对象的成员以及 key 不是 Object.prototype(对象的原型) 对象的属性的时候
  if (key in target && !(key in Object.prototype)) {
    //* 直接返回 target 原有属性的value，不再进行多余的操作
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  //* 如果当前是 Vue实例 (src\core\instance\init.js中定义的)
  //* 或者是 vue实例的 根数据data (ob.vmCount 只在对 data 属性进行 observe的时候传递了 asRootDta为true，所以只有key是data的时候ob.vmCount是1，其他的observer的vmCount都是0)
  //* 均不允许添加响应式属性
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  //* ob 是响应式属性的 __ob__ ，target.__ob__ 是 watcher 实例
  //* 如果当前的 target 没有 ob 属性的话，就说明不是响应式队形，所以直接返回
  if (!ob) {
    target[key] = val
    return val
  }
  //* 为满足条件的对象和属性添加响应式
  //* ob.value 是  Observer构造函数接受的value参数 this.value = value
  //* ob.value 就是 target
  defineReactive(ob.value, key, val) //* 遍历添加getter 和 setter 
  ob.dep.notify() //* 发送通知
  return val
}

/**
 * Delete a property and trigger change if necessary.
 * 删除一个属性并在必要情况下触发更新
 */
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
  //* undefined 和 非原始值 不允许进行 delete操作
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  //* 当target 是 数组并且 传递的key是合法索引
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1) //! 通过 splice进行实现数组的删除操作, 里面会调用 notify 方法
    return
  }
  const ob = (target: any).__ob__
  //* vue实例 和 data根属性 不允许进行删除属性操作
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  //* 如果删除的 key 不是当前 target 的属性 的时候 直接返回
  //*  Object.prototype.hasOwnProperty.call(obj, key) 判断key是不是当前target的属性（原型链上的属性不属于当前target的OwnProperty）
  if (!hasOwn(target, key)) {
    return
  }
  //! 通过 delete 操作符 直接删除 对象的 key 属性
  delete target[key]
  if (!ob) {
    return
  }
  //* 发送更新通知
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
