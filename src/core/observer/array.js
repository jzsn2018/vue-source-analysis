/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)
//* 都是修改原数组的数组 api
const methodsToPatch = [
  'push', //* add
  'pop',
  'shift',
  'unshift', //* add
  'splice', //* add 可能会增加元素 
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  const original = arrayProto[method];
  //* mutator 重写数组原有的 methodsToPatch 方法
  def(arrayMethods, method, function mutator (...args) {
    //* args数组 是调用这些方法的时候传递的参数
    const result = original.apply(this, args)
    const ob = this.__ob__
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2) // * splice方法的第三个参数是替换元素，也是新增的元素
        break
    }
    if (inserted) ob.observeArray(inserted) //* 将新增的元素转换成 getter 和 setter
    // notify change
    ob.dep.notify()
    return result
  })
})
