/* @flow */
/* globals MutationObserver */

import { noop } from 'shared/util'
import { handleError } from './error'
import { isIE, isIOS, isNative } from './env'

const callbacks = []
let pending = false

//* flushCallbacks 放在 timerFunc中
function flushCallbacks () {
  pending = false //* 标记处理结束
  const copies = callbacks.slice(0) //* 从索引0开始截取到数组的尾部； 就是为了备份数组
  callbacks.length = 0 //* 清空数组
  for (let i = 0; i < copies.length; i++) {
    copies[i]() //* 执行数组中存放的回调函数cb
  }
}

// Here we have async deferring wrappers using microtasks.
// In 2.5 we used (macro) tasks (in combination with microtasks).
// However, it has subtle problems when state is changed right before repaint
// (e.g. #6813, out-in transitions).
// Also, using (macro) tasks in event handler would cause some weird behaviors
// that cannot be circumvented (e.g. #7109, #7153, #7546, #7834, #8109).
// So we now use microtasks everywhere, again.
// A major drawback of this tradeoff is that there are some scenarios
// where microtasks have too high a priority and fire in between supposedly
// sequential events (e.g. #4521, #6690, which have workarounds)
// or even between bubbling of the same event (#6566).
//在这里，我们使用微任务异步延迟包装器。
//在2.5中，我们使用了（宏）任务（与微任务结合使用）。
//但是，当在重新绘制之前更改状态时，它存在一些细微的问题
//（例如＃6813，由外向内的转换）。
//此外，在事件处理程序中使用（宏）任务会导致一些奇怪的行为
//无法规避的代码（例如＃7109，＃7153，＃7546，＃7834，＃8109）。
//因此，我们现在再次在各处使用微任务。
//这种折衷的主要缺点是存在一些场景
//微任务的优先级过高，并且在两者之间触发
//顺序事件（例如＃4521，＃6690，它们具有解决方法）
//甚至在同一事件冒泡之间（＃6566）。 

let timerFunc

// The nextTick behavior leverages the microtask queue, which can be accessed
// via either native Promise.then or MutationObserver.
// MutationObserver has wider support, however it is seriously bugged in
// UIWebView in iOS >= 9.3.3 when triggered in touch event handlers. It
// completely stops working after triggering a few times... so, if native
// Promise is available, we will use it:

//nextTick行为利用了微任务队列，可以访问它
//通过本地Promise.then或MutationObserver。
//MutationObserver拥有更广泛的支持，但是在此方面存在严重错误
//在触摸事件处理程序中触发时，iOS> = 9.3.3中的UIWebView。它
//触发几次后完全停止工作...因此，如果是本机的
//Promise可用，我们将使用它： 

/* istanbul ignore next, $flow-disable-line */
if (typeof Promise !== 'undefined' && isNative(Promise)) {
  const p = Promise.resolve()
  //* 函数赋值
  timerFunc = () => {
    //* 微任务
    p.then(flushCallbacks)
    // In problematic UIWebViews, Promise.then doesn't completely break, but
    // it can get stuck in a weird state where callbacks are pushed into the
    // microtask queue but the queue isn't being flushed, until the browser
    // needs to do some other work, e.g. handle a timer. Therefore we can
    // "force" the microtask queue to be flushed by adding an empty timer.
    if (isIOS) setTimeout(noop)
  }
} else if (!isIE && typeof MutationObserver !== 'undefined' && (
  isNative(MutationObserver) ||
  // PhantomJS and iOS 7.x
  MutationObserver.toString() === '[object MutationObserverConstructor]'
)) {
  // Use MutationObserver where native Promise is not available,
  // e.g. PhantomJS, iOS7, Android 4.4
  // (#6466 MutationObserver is unreliable in IE11)
  let counter = 1
  const observer = new MutationObserver(flushCallbacks)
  const textNode = document.createTextNode(String(counter))
  observer.observe(textNode, {
    characterData: true
  })
  timerFunc = () => {
    counter = (counter + 1) % 2
    textNode.data = String(counter)
  }
} else if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
  //* ie浏览器 nodejs环境
  // Fallback to setImmediate.
  // Techinically it leverages the (macro) task queue,
  // but it is still a better choice than setTimeout.
  timerFunc = () => {
    setImmediate(flushCallbacks)
  }
} else {
  // Fallback to setTimeout.
  timerFunc = () => {
    setTimeout(flushCallbacks, 0)
  }
}

//* 回调函数 上下文
export function nextTick (cb?: Function, ctx?: Object) {
  let _resolve
  callbacks.push(() => {
    if (cb) {
      //* 用户传递的函数会包裹在 try catch 中 防止报错
      try {
        cb.call(ctx)
      } catch (e) {
        handleError(e, ctx, 'nextTick')
      }
    } else if (_resolve) {
      _resolve(ctx)
    }
  })
  if (!pending) {
    pending = true //* 标记正在被处理
    timerFunc()
  }
  // $flow-disable-line
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(resolve => {
      _resolve = resolve
    })
  }
}
