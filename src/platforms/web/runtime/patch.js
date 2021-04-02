/* @flow */

import * as nodeOps from 'web/runtime/node-ops'
import { createPatchFunction } from 'core/vdom/patch'
import baseModules from 'core/vdom/modules/index' //! 指令和ref相关
import platformModules from 'web/runtime/modules/index' //!和平台相关的 attrs class dom-props event style

// the directive module should be applied last, after all
// built-in modules have been applied.
const modules = platformModules.concat(baseModules)
//! nodeOps dom 操作 api 
//! modules 
export const patch: Function = createPatchFunction({ nodeOps, modules })
